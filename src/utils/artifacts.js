// src/utils/artifacts.js
import fs from "fs";
import path from "path";

function ts() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createRunDir(base = path.resolve("runs")) {
  if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true });
  const dir = path.join(base, ts());
  fs.mkdirSync(dir);
  return dir;
}
