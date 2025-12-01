import { type Server } from "node:http";

import express, {
  type Express,
  type Request,
  Response,
  NextFunction,
} from "express";

import { registerRoutes, bootstrapWhatsAppSessions } from "./routes";
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

// ⚡ ULTRA-FAST HEALTH CHECK - responds immediately before any middleware
// Must respond INSTANTLY without any conditional logic
app.get("/health", (req, res) => {
  res.status(200).json({ ok: true });
});

app.head("/health", (req, res) => {
  res.status(200).end();
});

// HEAD "/" for rapid deployment health checks
app.head("/", (req, res) => {
  res.status(200).end();
});

// Server ready state for health checks
let serverReady = false;
export function markServerReady() { serverReady = true; }

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
    // This must happen BEFORE any other operations
    markServerReady();
    
    // Setup static file serving AFTER server is listening (non-blocking)
    // This must run after health check is ready, so deployment probes pass immediately
    process.nextTick(() => {
      try {
        void setup(app, server);
      } catch (err) {
        console.error("❌ Erro ao setup static files:", err);
      }
    });
    
    // Start automation cron jobs AFTER server is listening (fire-and-forget, non-blocking)
    // Use setTimeout to ensure it runs after setup
    setTimeout(() => {
      try {
        startAutomationCron();
        log("🤖 Automation Cron Jobs iniciados!");
      } catch (err) {
        console.error("❌ Erro ao iniciar cron jobs:", err);
      }
    }, 50);
    
    // Bootstrap WhatsApp sessions in COMPLETELY async context
    // Fire-and-forget: do NOT await, do NOT block
    // Failures are caught and logged but do not affect server health
    setTimeout(() => {
      try {
        // Call without await - let it run completely async
        void bootstrapWhatsAppSessions().catch(err => {
          console.error("❌ Erro ao bootstrap WhatsApp sessions:", err);
        });
      } catch (err) {
        console.error("❌ Erro ao iniciar bootstrap WhatsApp:", err);
      }
    }, 100);
  });
}
