// src/index.js
import "dotenv/config";
import express from "express";
import { createRunDir } from "./utils/artifacts.js";
import { uploadSelectProjectsBatch } from "./automation/uploadSelectProjectsBatch.js";
import { navToUploadPage } from "./automation/navToUploadPage.js";

const app = express();
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (req, res) =>
  res.json({ ok: true, env: process.env.NODE_ENV || "development", now: new Date().toISOString() })
);

// Just the navigation (useful for debugging login/SSO/upload-page reachability)
app.post("/api/nav/upload", async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) throw Object.assign(new Error("username and password are required"), { status: 400 });

    const runDir = createRunDir();
    const nav = await navToUploadPage({ username, password }, runDir);
    res.json({ runDir, ok: true, ...nav, browser: undefined, context: undefined, page: undefined });
  } catch (e) { next(e); }
});

// M4: providers loop → Gioco → project selection
app.post("/api/upload/select-projects-batch", async (req, res, next) => {
  try {
    const { username, password, providers } = req.body || {};
    if (!username || !password) throw Object.assign(new Error("username and password are required"), { status: 400 });
    if (!Array.isArray(providers) || providers.length === 0) {
      throw Object.assign(new Error("providers must be a non-empty array"), { status: 400 });
    }

    const runDir = createRunDir();
    const result = await uploadSelectProjectsBatch({ username, password, providers }, runDir);
    res.json({ runDir, ...result });
  } catch (e) { next(e); }
});

// Error handler
app.use((err, req, res, next) => {
  console.error("[ERR]", err?.message);
  res.status(err.status || 500).json({ ok: false, error: err.message || "Internal error" });
});

const port = Number(process.env.PORT || 5000);
app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
