import { createServer, type Server } from "node:http";

import express, {
  type Express,
  type Request,
  Response,
  NextFunction,
} from "express";

import { registerRoutes, bootstrapWhatsAppSessions, startCampaignScheduler } from "./routes";
import { startAutomationCron } from "./automationService";
import { setupAuth } from "./localAuth";

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}

// Server ready state for health checks
let serverReady = false;
export function markServerReady() { serverReady = true; }

// Routes ready state - gates traffic until auth/routes are initialized
let routesReady = false;
export function markRoutesReady() { routesReady = true; }

// Pre-loaded index.html for instant SPA serving
let preloadedIndexHtml: string | null = null;
export function setIndexHtml(html: string) { preloadedIndexHtml = html; }

// ✅ Flag para lazy-load de operações caras (apenas UMA VEZ)
let expensiveOpsStarted = false;
function startExpensiveOpsOnce() {
  if (expensiveOpsStarted) return;
  expensiveOpsStarted = true;

  // Fire-and-forget: completamente async, sem block
  void (async () => {
    try {
      void startCampaignScheduler();
      log("📅 Campaign Scheduler iniciado!");
    } catch (err) {
      console.error("❌ Erro ao iniciar campaign scheduler:", err);
    }

    try {
      void startAutomationCron();
      log("🤖 Automation Cron Jobs iniciados!");
    } catch (err) {
      console.error("❌ Erro ao iniciar cron jobs:", err);
    }

    try {
      void bootstrapWhatsAppSessions().catch(err => {
        console.error("❌ Erro ao bootstrap WhatsApp sessions:", err);
      });
    } catch (err) {
      console.error("❌ Erro ao iniciar bootstrap WhatsApp:", err);
    }
  })();
}

// ⚡ ULTRA-FAST HEALTH CHECK + ROOT ENDPOINTS - MUST be BEFORE ANY MIDDLEWARE
// These respond instantly without ANY processing
app.get("/health", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.status(200).end('{"ok":true}');
});

// ⚡ FAST ROOT ENDPOINT - serves pre-loaded index.html instantly (PRODUCTION ONLY)
// In development, Vite handles "/" so we skip this endpoint
if (process.env.NODE_ENV === "production") {
  app.get("/", (_req, res) => {
    res.setHeader("Content-Type", "text/html");
    // Serve pre-loaded index.html for instant response (no file system access)
    if (preloadedIndexHtml) {
      res.status(200).end(preloadedIndexHtml);
    } else {
      // Fallback during startup before index.html is loaded
      res.status(200).end('<!DOCTYPE html><html><body>Loading...</body></html>');
    }
  });
}

app.head("/health", (req, res) => {
  res.status(200).end();
});

// Startup guard middleware - returns 503 for non-health routes until initialization is complete
// This ensures the server can accept connections and respond to health checks immediately
// while other routes wait for auth/database/routing to finish initializing
app.use((req, res, next) => {
  // Always allow health checks through
  if (req.path === "/health") {
    return next();
  }
  
  // Allow root endpoint through (serves pre-loaded HTML or fallback)
  if (req.path === "/") {
    return next();
  }
  
  // Check if routes are ready for all other requests
  if (!routesReady) {
    return res.status(503).json({ 
      error: "Service initializing", 
      message: "The application is starting up. Please try again in a few seconds."
    });
  }
  
  next();
});

// ALL MIDDLEWARES must come AFTER health check routes and startup guard
app.use(express.json({
  limit: "50mb",
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false, limit: "50mb" }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

export default async function runApp(
  setup: (app: Express, server: Server) => Promise<void>,
) {
  // Create HTTP server FIRST before any blocking operations
  const server = createServer(app);

  // Add global error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Log error for debugging but don't rethrow to avoid crashing the process
    console.error("❌ Error handler caught:", err);
    res.status(status).json({ message });
  });

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  
  // ⚡ START LISTENING IMMEDIATELY - BEFORE setupAuth and registerRoutes
  // This ensures /health endpoint responds instantly for deployment health checks
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    // CRITICAL: Mark server as ready for health checks IMMEDIATELY
    // NO DELAYS - health checks must pass instantly
    markServerReady();
    
    // Initialize auth, routes, and static files asynchronously
    // This runs in background without blocking health checks
    void (async () => {
      try {
        log("🔐 Initializing authentication...");
        await setupAuth(app);
        log("✅ Authentication initialized");
        
        log("🛣️  Registering routes...");
        await registerRoutes(app, server);
        log("✅ Routes registered");
        
        // Mark routes as ready - removes 503 guard
        markRoutesReady();
        log("✅ Application routes ready for traffic");
        
        log("📁 Setting up static file serving...");
        await setup(app, server);
        log("✅ Static files ready");
      } catch (err) {
        console.error("❌ FATAL: Error during server initialization:", err);
        // Don't crash the server - health checks should still pass
        // but routes will remain gated with 503
      }
    })();

    // Trigger expensive operations with delay to ensure health checks pass during deployment
    setTimeout(() => startExpensiveOpsOnce(), 15000);
  });
}
