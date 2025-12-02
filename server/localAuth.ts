import bcrypt from "bcrypt";
import passport from "passport";
import LocalStrategy from "passport-local";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import * as storage from "./storage";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
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
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

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
