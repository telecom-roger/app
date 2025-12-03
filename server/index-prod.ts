import fs from "node:fs";
import path from "node:path";
import { Server } from "node:http";

import express, { type Express } from "express";
import runApp, { setIndexHtml } from "./app";

let cachedIndexHtml: string | null = null;

export async function serveStatic(app: Express, _server: Server) {
  const distPath = path.resolve(import.meta.dirname, "..", "dist", "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find build folder: ${distPath}. Run "npm run build" first`,
    );
  }

  // --------------------------------------------------------
  // 🟣 Carregar index.html
  // --------------------------------------------------------
  try {
    cachedIndexHtml = fs.readFileSync(path.join(distPath, "index.html"), "utf8");
    setIndexHtml(cachedIndexHtml);
    console.log("✅ [PROD] index.html carregado");
  } catch (err) {
    console.error("❌ Erro ao carregar index.html:", err);
  }

  // --------------------------------------------------------
  // 🟣 Conteúdo estático do build (SEM interceptar "/")
  // --------------------------------------------------------
  app.use(
    express.static(distPath, {
      maxAge: "1h",
      fallthrough: true,
      index: false,
    }),
  );

  // --------------------------------------------------------
  // 🟣 FALLBACK FINAL — entrega index.html para SPA routes
  // --------------------------------------------------------
  app.use((req, res, next) => {
    // Never intercept API routes
    if (req.path.startsWith("/api")) {
      return next();
    }

    // Serve SPA fallback for all routes (including /)
    if (cachedIndexHtml) {
      res.setHeader("Content-Type", "text/html");
      return res.status(200).send(cachedIndexHtml);
    }
    
    return next();
  });
}

// --------------------------------------------------------
// Inicializa (health checks já respondem ANTES disso)
// --------------------------------------------------------
(async () => {
  try {
    await runApp(serveStatic);
    console.log("✅ [PROD] Server started successfully.");
  } catch (err) {
    console.error("❌ Error starting server:", err);
  }
})();
