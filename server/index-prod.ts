import fs from "node:fs";
import path from "node:path";
import { type Server } from "node:http";

import express, { type Express } from "express";
import runApp, { app, setIndexHtml } from "./app";

// ENDPOINT RAIZ SUPER RÁPIDO (Replit exige)
app.get("/", (_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.status(200).end("<!DOCTYPE html><html><body>OK</body></html>");
});

// health
app.get("/health", (_req, res) => res.status(200).json({ ok: true }));

let cachedIndexHtml: string | null = null;
let distPath: string | null = null;

// ❗️ NÃO CRIAR SERVIDOR AQUI – runApp controla isso
let server: Server | null = null;

export async function serveStatic(app: Express, _server: Server) {
  distPath = path.resolve(import.meta.dirname, "..", "dist", "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(`Could not find the build directory: ${distPath}`);
  }

  // Preload
  cachedIndexHtml = fs.readFileSync(
    path.resolve(distPath, "index.html"),
    "utf-8",
  );

  setIndexHtml(cachedIndexHtml);

  // static
  app.use(express.static(distPath, { maxAge: "1h", fallthrough: true }));

  // fallback
  app.use((req, res, next) => {
    if (req.path === "/" || req.path === "/health") return next();

    if (cachedIndexHtml) {
      res.setHeader("Content-Type", "text/html");
      return res.status(200).send(cachedIndexHtml);
    }

    return res.status(500).send("Application not ready");
  });
}

// inicialização
(async () => {
  try {
    await runApp(serveStatic); // ✔️ NÃO PASSA MAIS SERVER
  } catch (err) {
    console.error("Error during app setup:", err);
  }
})();
