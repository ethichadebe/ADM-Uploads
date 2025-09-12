// scripts/runOne.js
// Run the selection for a single provider to debug timing/DOM readiness.

import { createRunDir } from "../src/utils/artifacts.js";
import { uploadSelectProjectsBatch } from "../src/automation/uploadSelectProjectsBatch.js";
import { createRunLogger } from "../src/utils/logger.js";

function parseCsv(s) {
  return String(s || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

async function main() {
  const username = process.env.ADM_USERNAME;
  const password = process.env.ADM_PASSWORD;
  const provider = process.env.PROVIDER || process.argv[2];
  const projectValues = parseCsv(process.env.PROJECT_VALUES || process.argv[3] || "");

  if (!username || !password || !provider || projectValues.length === 0) {
    console.error(
      "Usage: set ADM_USERNAME, ADM_PASSWORD, and provide PROVIDER + PROJECT_VALUES (csv).\nExample: PROVIDER=15112 PROJECT_VALUES=123491,123494 node scripts/runOne.js"
    );
    process.exit(1);
  }

  const runDir = createRunDir();
  const logger = createRunLogger(runDir);
  const payload = { username, password, providers: [{ provider, projectValues }] };
  logger.info("runOne:start", { runDir, provider, projectValues });
  try {
    const result = await uploadSelectProjectsBatch(payload, runDir, logger);
    const out = { runDir, ...result };
    console.log(JSON.stringify(out, null, 2));
  } catch (e) {
    console.error("runOne failed:", e);
    process.exitCode = 1;
  }
}

main();

