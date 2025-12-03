import { createServer, type Server } from "node:http";
import express, {
  type Express,
  type Request,
  Response,
  NextFunction,
} from "express";

import {
  registerRoutes,
  bootstrapWhatsAppSessions,
  startCampaignScheduler,
} from "./routes";
import { startAutomationCron } from "./automationService";
import { setupAuth } from "./localAuth";

// --------------------------------------------------------
// Logger util
// --------------------------------------------------------
export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

// --------------------------------------------------------
// Express app
// --------------------------------------------------------
export const app = express();

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// --------------------------------------------------------
// Flags internas
// --------------------------------------------------------
let serverReady = false;
export function markServerReady() {
  serverReady = true;
}

let routesReady = false;
export function markRoutesReady() {
  routesReady = true;
}

// Preload SPA index.html
let preloadedIndexHtml: string | null = null;
export function setIndexHtml(html: string) {
  preloadedIndexHtml = html;
}

// Controle de operações pesadas
let expensiveOpsStarted = false;
function startExpensiveOpsOnce() {
  if (expensiveOpsStarted) return;
  expensiveOpsStarted = true;

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
      void bootstrapWhatsAppSessions();
    } catch (err) {
      console.error("❌ Erro ao iniciar bootstrap WhatsApp:", err);
    }
  })();
}

// ========================================================
// 🟢 HEALTH CHECKS - FIRST MIDDLEWARE (only /health)
// Responds immediately, bypasses all other middleware
// ========================================================
app.use((req, res, next) => {
  const path = req.path;
  const method = req.method;
  
  // Only health endpoint responds immediately
  if (path === "/health" && (method === "GET" || method === "HEAD")) {
    res.status(200).type("application/json");
    return res.end('{"ok":true}');
  }
  
  next();
});

// --------------------------------------------------------
// Startup guard - ONLY blocks if server not ready
// Health checks already handled above, so never reach here
// --------------------------------------------------------
app.use((req, res, next) => {
  if (!serverReady) {
    return res.status(503).json({ error: "Server starting" });
  }
  next();
});

// --------------------------------------------------------
// Middlewares normais
// --------------------------------------------------------
app.use(
  express.json({
    limit: "50mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "50mb" }));

// Logger para rotas /api
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse)
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      if (logLine.length > 80) logLine = logLine.slice(0, 79) + "…";
      log(logLine);
    }
  });

  next();
});

// --------------------------------------------------------
// SPA fallback (em /app) - só em produção
// --------------------------------------------------------
if (process.env.NODE_ENV === "production") {
  app.get("/app", (_req, res) => {
    res.setHeader("Content-Type", "text/html");
    if (preloadedIndexHtml) {
      res.status(200).end(preloadedIndexHtml);
    } else {
      res
        .status(200)
        .end("<!DOCTYPE html><html><body>Loading...</body></html>");
    }
  });
}

// --------------------------------------------------------
// RUN APP
// --------------------------------------------------------
export default async function runApp(
  setup: (app: Express, server: Server) => Promise<void>,
) {
  const server = createServer(app);

  // Error handler global
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("❌ Error handler caught:", err);
    res.status(status).json({ message });
  });

  const port = Number(process.env.PORT || 5000);

  server.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
    markServerReady();

    void (async () => {
      try {
        log("🔐 Initializing authentication...");
        await setupAuth(app);
        log("✅ Authentication initialized");

        log("🛣️  Registering routes...");
        await registerRoutes(app, server);
        log("✅ Routes registered");

        markRoutesReady();
        log("✅ Application routes ready for traffic");

        log("📁 Setting up static file serving...");
        await setup(app, server);
        log("✅ Static files ready");

        // Start heavy operations with 2s delay (avoid CPU spike during health checks)
        setTimeout(() => {
          startExpensiveOpsOnce();
        }, 2000);
      } catch (err) {
        console.error("❌ FATAL: Error during server initialization:", err);
      }
    })();
  });
}
