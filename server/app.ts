import { type Server } from "node:http";

import express, {
  type Express,
  type Request,
  Response,
  NextFunction,
} from "express";

import { registerRoutes } from "./routes";

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

  // Auto-reconnect WhatsApp sessions on startup (after hot reload or restart)
  setTimeout(async () => {
    log("🔄 Verificando sessões WhatsApp para reconexão automática...");
    try {
      const storage = await import("./storage");
      const whatsappService = await import("./whatsappService");
      const allSessions = await storage.getAllWhatsappSessions();
      let reconnected = 0;
      
      for (const session of allSessions) {
        // Check if session should be alive but isn't in memory
        if (session.status === "conectada") {
          const isAlive = await whatsappService.isSessionAlive(session.sessionId);
          
          if (!isAlive && whatsappService.isSessionCredentialsSaved(session.sessionId)) {
            log(`✨ Reconectando sessão ${session.sessionId}...`);
            whatsappService.initializeWhatsAppSession(session.sessionId).catch(err => {
              log(`Erro ao reconectar ${session.sessionId}: ${err.message}`, "whatsapp");
            });
            reconnected++;
          }
        }
      }
      
      if (reconnected > 0) {
        log(`✅ ${reconnected} sessão(ões) marcada(s) para reconexão`);
      }
    } catch (err) {
      log(`⚠️ Erro ao auto-reconectar sessões: ${err}`, "whatsapp");
    }
  }, 1000); // Wait 1 second after server starts

  // importantly run the final setup after setting up all the other routes so
  // the catch-all route doesn't interfere with the other routes
  await setup(app, server);

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
  });
}
