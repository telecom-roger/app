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

  // ✅ Fast root route that returns index.html immediately for SPA
  // This ensures deployment health checks on / pass instantly
  app.get("/", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });

  // Serve static files efficiently
  app.use(express.static(distPath, { maxAge: "1h" }));

  // Fall through to index.html for SPA routing
  // This middleware runs AFTER the / route handler, so health checks pass fast
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

(async () => {
  await runApp(serveStatic);
})();
