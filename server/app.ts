import { type Server } from "node:http";

import express, {
  type Express,
  type Request,
  Response,
  NextFunction,
} from "express";

import { registerRoutes, bootstrapWhatsAppSessions, startCampaignScheduler } from "./routes";
import { startAutomationCron } from "./automationService";

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

app.head("/health", (req, res) => {
  res.status(200).end();
});

// ✅ ROOT ROUTE - ZERO operations, pure health check
// Responds instantly with JSON, ZERO side effects
app.get("/", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.status(200).end('{"ok":true}');
});

// ALL MIDDLEWARES must come AFTER health check routes
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
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    // CRITICAL: Mark server as ready for health checks IMMEDIATELY
    // NO DELAYS - health checks must pass instantly
    markServerReady();
    
    // Setup static file serving completely async (fire-and-forget)
    // This runs in background without blocking health checks
    void (async () => {
      try {
        await setup(app, server);
      } catch (err) {
        console.error("❌ Erro ao setup static files:", err);
      }
    })();

    // Trigger expensive operations on next tick (after health checks pass)
    // This ensures health checks respond instantly
    process.nextTick(() => {
      startExpensiveOpsOnce();
    });
  });
}
