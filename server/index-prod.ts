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
  app.use(express.static(distPath, { maxAge: "1h" }));

  // Fall through to index.html for SPA routing
  // Read index.html ONCE and cache it
  const indexHtmlPath = path.resolve(distPath, "index.html");
  const indexHtml = fs.readFileSync(indexHtmlPath, "utf-8");
  
  app.use("*", (_req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.status(200).send(indexHtml);
  });
}

(async () => {
  await runApp(serveStatic);
})();
