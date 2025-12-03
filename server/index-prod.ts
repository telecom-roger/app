import fs from "node:fs";
import path from "node:path";
import { Server } from "node:http";

import express, { type Express } from "express";
import runApp, { app, setIndexHtml } from "./app";

// --------------------------------------------------------
// 🟢 HEALTH CHECK IMEDIATO (primeira coisa, antes de TUDO)
// Isso garante resposta < 10ms durante o deploy
// --------------------------------------------------------
app.use((req, res, next) => {
  if (req.path === "/") {
    return res.status(200).type("text/html").send("OK");
  }
  if (req.path === "/health" || req.path.startsWith("/health")) {
    return res.status(200).type("application/json").send('{"ok":true}');
  }
  return next();
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

  // --------------------------------------------------------
  // 🟣 Carregar index.html de forma ASSÍNCRONA (não bloqueia health)
  // --------------------------------------------------------
  setImmediate(() => {
    try {
      cachedIndexHtml = fs.readFileSync(path.join(distPath, "index.html"), "utf8");
      setIndexHtml(cachedIndexHtml);
      console.log("✅ [PROD] index.html carregado em background");
    } catch (err) {
      console.error("❌ Erro ao carregar index.html:", err);
    }
  });

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
    // Nunca interceptar healthchecks (já respondidos acima)
    if (req.path === "/" || req.path.startsWith("/health") || req.path.startsWith("/api")) {
      return next();
    }

    // Se não achar rota ou arquivo, entrega o SPA
    if (cachedIndexHtml) {
      res.setHeader("Content-Type", "text/html");
      return res.status(200).send(cachedIndexHtml);
    }
    
    // Se ainda não carregou, aguarda um pouco
    return res.status(503).send("Loading...");
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
