import bcrypt from "bcrypt";
import passport from "passport";
import LocalStrategy from "passport-local";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import * as storage from "./storage";

async function createSessionStoreWithRetry(maxRetries = 3, retryDelayMs = 1000): Promise<any> {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const pgStore = connectPg(session);
      const sessionStore = new pgStore({
        conString: process.env.DATABASE_URL,
        createTableIfMissing: false,
        ttl: sessionTtl,
        tableName: "sessions",
      });
      
      // Add error handler for session store connection issues
      sessionStore.on?.('error', (err) => {
        console.error("⚠️ Session store error:", err);
        // Don't crash - session store errors should not bring down the server
      });
      
      console.log(`✅ PostgreSQL session store connected (attempt ${attempt}/${maxRetries})`);
      return sessionStore;
    } catch (err) {
      console.error(`❌ Failed to create session store (attempt ${attempt}/${maxRetries}):`, err);
      
      if (attempt < maxRetries) {
        const delay = retryDelayMs * attempt; // Exponential backoff
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.warn("⚠️ Max retries reached. Falling back to in-memory session store (sessions will not persist across restarts)");
        throw err; // Final attempt failed, throw to trigger fallback
      }
    }
  }
  
  return null; // Should never reach here
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  
  // Return session middleware immediately
  // Store will be created asynchronously during setupAuth
  return session({
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionTtl,
    },
  });
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function setupAuth(app: Express) {
  try {
    app.set("trust proxy", 1);
    
    // Try to create PostgreSQL session store with retry/backoff
    const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
    let sessionMiddleware;
    
    try {
      const sessionStore = await createSessionStoreWithRetry(3, 1000);
      sessionMiddleware = session({
        secret: process.env.SESSION_SECRET!,
        store: sessionStore,
        resave: false,
        saveUninitialized: false,
        cookie: {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          maxAge: sessionTtl,
        },
      });
    } catch (err) {
      // Fallback to in-memory session store
      console.warn("⚠️ Using in-memory session store as fallback");
      sessionMiddleware = session({
        secret: process.env.SESSION_SECRET!,
        resave: false,
        saveUninitialized: false,
        cookie: {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          maxAge: sessionTtl,
        },
      });
    }
    
    app.use(sessionMiddleware);
    app.use(passport.initialize());
    app.use(passport.session());
  } catch (err) {
    console.error("❌ Error setting up authentication middleware:", err);
    throw err; // Re-throw to be caught by runApp error handler
  }

  // Local strategy for email/password
  passport.use(
    new LocalStrategy.Strategy(
      {
        usernameField: "email",
        passwordField: "password",
      },
      async (email: string, password: string, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          if (!user) {
            return done(null, false, { message: "Usuário não encontrado" });
          }

          const passwordMatch = await verifyPassword(password, user.passwordHash);
          if (!passwordMatch) {
            return done(null, false, { message: "Senha incorreta" });
          }

          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  passport.serializeUser((user: any, cb) => cb(null, user?.id));
  passport.deserializeUser(async (id: string, cb) => {
    try {
      if (!id) {
        return cb(null, null);
      }
      const user = await storage.getUserById(id);
      cb(null, user || null);
    } catch (error) {
      console.error("Deserialize error:", error);
      cb(null, null);
    }
  });

  // Login route
  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    res.json({ user: req.user });
  });

  // Logout route
  app.post("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) return res.status(500).json({ error: "Logout failed" });
      res.json({ success: true });
    });
  });

  // Get current authenticated user
  app.get("/api/auth/user", (req, res) => {
    if (req.isAuthenticated()) {
      res.json(req.user);
    } else {
      res.status(401).json({ error: "Unauthorized" });
    }
  });

  // Register route
  app.post("/api/register", async (req, res) => {
    try {
      const { email, password, firstName, lastName } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "Email e senha são obrigatórios" });
      }

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "Usuário já existe" });
      }

      const passwordHash = await hashPassword(password);
      const user = await storage.createUser({
        email,
        passwordHash,
        firstName,
        lastName,
      });

      res.status(201).json({ user });
    } catch (error: any) {
      console.error("Error registering user:", error);
      res.status(500).json({ error: "Falha ao registrar usuário" });
    }
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};
