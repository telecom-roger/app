import fs from "node:fs";
import path from "node:path";
import { Server } from "node:http";

import express, { type Express } from "express";
import runApp, { app, setIndexHtml } from "./app";

// --------------------------------------------------------
// 🟢 HEALTH CHECKS — sempre no topo (antes de tudo)
// --------------------------------------------------------

app.get("/", (_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.status(200).end("<!DOCTYPE html><html><body>OK</body></html>");
});

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

// --------------------------------------------------------

let cachedIndexHtml: string | null = null;

export async function serveStatic(app: Express, _server: Server) {
  const distPath = path.resolve(import.meta.dirname, "..", "dist", "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find build folder: ${distPath}. Run "npm run build" first`,
    );
  }

  // Carrega index.html uma vez
  cachedIndexHtml = fs.readFileSync(path.join(distPath, "index.html"), "utf8");

  setIndexHtml(cachedIndexHtml);

  // --------------------------------------------------------
  // 🟣 Conteúdo estático do build (SEM interceptar "/")
  // --------------------------------------------------------
  app.use(
    express.static(distPath, {
      maxAge: "1h",
      fallthrough: true,
      index: false, // evita servir index.html automaticamente
    }),
  );

  // --------------------------------------------------------
  // 🟣 FALLBACK FINAL — entrega index.html
  // (somente se não for / e não for /health)
  // --------------------------------------------------------
  app.use((req, res, next) => {
    // Nunca interceptar healthchecks
    if (req.path === "/" || req.path.startsWith("/health")) {
      return next();
    }

    // Se não achar rota ou arquivo, entrega o SPA
    res.setHeader("Content-Type", "text/html");
    return res.status(200).send(cachedIndexHtml);
  });
}

// --------------------------------------------------------
// Inicializa sem criar servidor duplicado
// AQUI não coloque tarefas pesadas! (cron jobs, automações, etc.)
// --------------------------------------------------------
(async () => {
  try {
    await runApp(serveStatic);

    // --------------------------------------------------------
    // 🔵 Inicializações pesadas somente DEPOIS que o servidor subiu
    // --------------------------------------------------------
    // Exemplo:
    // startCampaignScheduler();
    // startAutomationCronJobs();
    // bootstrapWhatsApp();

    console.log("Server started. Heavy tasks initialized.");
  } catch (err) {
    console.error("Error starting server:", err);
  }
})();
