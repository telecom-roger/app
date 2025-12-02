import fs from "node:fs";
import path from "node:path";
import { type Server } from "node:http";

import express, { type Express } from "express";
import runApp from "./app";
import { setIndexHtml } from "./app";

// ✅ GLOBAL CACHE - pre-loaded during startup for instant serving
let cachedIndexHtml: string | null = null;
let distPath: string | null = null;

export async function serveStatic(app: Express, _server: Server) {
  // ✅ FIXED: Correct path to dist/public directory in production build
  distPath = path.resolve(import.meta.dirname, "..", "dist", "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // PRE-LOAD index.html during startup (synchronously) for instant serving
  try {
    cachedIndexHtml = fs.readFileSync(path.resolve(distPath, "index.html"), "utf-8");
    // Share with app.ts so "/" endpoint can serve it instantly
    setIndexHtml(cachedIndexHtml);
  } catch (err) {
    console.error("Error pre-loading index.html:", err);
    throw err;
  }

  // Serve static files efficiently (CSS, JS, assets)
  app.use(express.static(distPath, { maxAge: "1h", fallthrough: true }));

  // Fall through to index.html for SPA routing
  // ⚠️ SKIP health check routes - let app.ts handlers respond instantly
  app.use("*", (req, res, next) => {
    // Skip health check routes - they're handled by fast endpoints in app.ts
    if (req.path === "/health") {
      return next();
    }
    
    // Serve pre-loaded index.html for SPA routes
    if (cachedIndexHtml) {
      res.setHeader("Content-Type", "text/html");
      res.status(200).send(cachedIndexHtml);
    } else {
      res.status(500).send("Application not ready");
    }
  });
}

(async () => {
  await runApp(serveStatic);
})();
