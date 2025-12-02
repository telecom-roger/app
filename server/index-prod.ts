import fs from "node:fs";
import path from "node:path";
import { type Server } from "node:http";

import express, { type Express } from "express";
import runApp from "./app";

export async function serveStatic(app: Express, _server: Server) {
  // ✅ FIXED: Correct path to dist/public directory in production build
  const distPath = path.resolve(import.meta.dirname, "..", "dist", "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Serve static files efficiently (CSS, JS, assets)
  // NO BLOCKING OPERATIONS - just setup routes
  app.use(express.static(distPath, { maxAge: "1h", fallthrough: true }));

  // Fall through to index.html for SPA routing (lazy-loaded, no blocking)
  // This middleware only runs if no static file was found
  // Lazy cache: read index.html only on first SPA route request
  let cachedIndexHtml: string | null = null;
  const indexHtmlPath = path.resolve(distPath, "index.html");
  
  app.use("*", (_req, res) => {
    // Lazy-load index.html on first request (async, non-blocking)
    if (!cachedIndexHtml) {
      cachedIndexHtml = fs.readFileSync(indexHtmlPath, "utf-8");
    }
    res.setHeader("Content-Type", "text/html");
    res.status(200).send(cachedIndexHtml);
  });
}

(async () => {
  await runApp(serveStatic);
})();
