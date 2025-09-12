// scripts/runPayload.js
// Run the batch using providers payload from a JSON file and creds from env.

import fs from 'fs';
import path from 'path';
import { createRunDir } from "../src/utils/artifacts.js";
import { uploadSelectProjectsBatch } from "../src/automation/uploadSelectProjectsBatch.js";
import { createRunLogger } from "../src/utils/logger.js";

const filePath = process.argv[2] || path.resolve('scripts/payload.json');

if (!process.env.ADM_USERNAME || !process.env.ADM_PASSWORD) {
  console.error('Set ADM_USERNAME and ADM_PASSWORD in env.');
  process.exit(1);
}

const providers = JSON.parse(fs.readFileSync(filePath, 'utf8')).providers;
const payload = {
  username: process.env.ADM_USERNAME,
  password: process.env.ADM_PASSWORD,
  providers
};

async function main() {
  const runDir = createRunDir();
  const logger = createRunLogger(runDir);
  const result = await uploadSelectProjectsBatch(payload, runDir, logger);
  console.log(JSON.stringify({ runDir, ...result }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });

