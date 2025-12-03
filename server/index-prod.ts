import fs from "node:fs";
import path from "node:path";
import { type Server } from "node:http";

import express, { type Express } from "express";
import runApp, { app } from "./app";
import { setIndexHtml } from "./app";

// 🚨 ENDPOINT RAIZ SUPER RÁPIDO — obrigatório para o Replit
app.get("/", (_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.status(200).end("<!DOCTYPE html><html><body>OK</body></html>");
});

// (Opcional) health explícito:
// app.get("/health", (_req, res) => res.status(200).json({ ok: true }));

// ---------------------------------------------

let cachedIndexHtml: string | null = null;
let distPath: string | null = null;

export async function serveStatic(app: Express, _server: Server) {
  distPath = path.resolve(import.meta.dirname, "..", "dist", "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Pré-carrega index.html
  try {
    cachedIndexHtml = fs.readFileSync(
      path.resolve(distPath, "index.html"),
      "utf-8",
    );

    setIndexHtml(cachedIndexHtml);
  } catch (err) {
    console.error("Error pre-loading index.html:", err);
    throw err;
  }

  // Arquivos estáticos
  app.use(express.static(distPath, { maxAge: "1h", fallthrough: true }));

  // 🚨 NOVO FALLBACK — NÃO captura "/" e "/health"
  app.use((req, res, next) => {
    // deixa o health check passar
    if (req.path === "/" || req.path === "/health") {
      return next();
    }

    // fallback do SPA
    if (cachedIndexHtml) {
      res.setHeader("Content-Type", "text/html");
      return res.status(200).send(cachedIndexHtml);
    }

    return res.status(500).send("Application not ready");
  });
}

(async () => {
  await runApp(serveStatic);
})();
