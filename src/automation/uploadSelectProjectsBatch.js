// src/automation/uploadSelectProjectsBatch.js
import path from "path";
import { navToUploadPage } from "./navToUploadPage.js";
import { selectProvider } from "./helpers/selectProvider.js";
import { clickGioco } from "./helpers/clickGioco.js";
import { selectProjectFromValues } from "./helpers/selectProjectFromValues.js";
import { waitForProgressivo } from "./helpers/waitForProgressivo.js";
import { selectLastVersion } from "./helpers/selectLastVersion.js";
import { waitForDettagli } from "./helpers/waitForDettagli.js";
import { createRunLogger } from "../utils/logger.js";

// Normalizes input: accept { provider } or { Provider }
function normProviderItem(item) {
  const provider = String(item?.provider ?? item?.Provider ?? "").trim();
  const projectValues = (item?.projectValues || []).map(String);
  return { provider, projectValues };
}

export async function uploadSelectProjectsBatch({ username, password, providers }, runDir, loggerParam) {
  // 0) Navigate to upload page and return a Playwright Page
  const logger = loggerParam || createRunLogger(runDir);
  const nav = await navToUploadPage({ username, password }, runDir, logger);
  const { browser, context, page, shots: navShots, tracePath } = nav;

  const results = [];
  try {
    let idx = 0;
    for (const raw of providers || []) {
      idx++;
      const { provider, projectValues } = normProviderItem(raw);
      const perShots = {
        afterProvider: path.join(runDir, `05_provider_${idx}_${provider}.png`),
        afterGioco: path.join(runDir, `06_gioco_${idx}_${provider}.png`),
        afterProject: path.join(runDir, `07_project_${idx}_${provider}.png`),
        afterProgressivo: path.join(runDir, `08_progressivo_${idx}_${provider}.png`),
        afterVersion: path.join(runDir, `09_version_${idx}_${provider}.png`),
        afterDettagli: path.join(runDir, `10_dettagli_${idx}_${provider}.png`)
      };

      const entry = {
        provider,
        projectValues,
        ok: false,
        reason: null,
        chosen: null,
        shots: perShots
      };

      try {
        if (!provider) throw new Error("missing-provider");
        if (!projectValues.length) throw new Error("missing-projectValues");

        // 1) Provider
        logger.info("provider:select", { provider, idx });
        const sp = await selectProvider(page, provider, perShots.afterProvider, logger);
        if (!sp.ok) throw new Error(sp.reason || "provider-select-failed");
        await logger.snapshotDom(page, `05_provider_${idx}_${provider}`);

        // 2) Gioco
        const g = await clickGioco(page, perShots.afterGioco, logger);
        if (!g.ok) throw new Error(g.reason || "gioco-click-failed");
        await logger.snapshotDom(page, `06_gioco_${idx}_${provider}`);

        // 3) Project (first match from provided list)
        const pj = await selectProjectFromValues(page, projectValues, perShots.afterProject, logger);
        if (!pj.ok) throw new Error(pj.reason || "project-select-failed");

        entry.ok = true;
        entry.chosen = pj.chosen;

        // 4) Wait for "Selezionare il progressivo richiesta" to appear/populate and capture.
        logger.info("progressivo:wait");
        await waitForProgressivo(page, perShots.afterProgressivo, 40000);
        await logger.snapshotDom(page, `08_progressivo_${idx}_${provider}`);

        // 5) Select the last version from the "Selezionare una versione" dropdown
        const ver = await selectLastVersion(page, perShots.afterVersion, logger);
        if (!ver.ok) throw new Error(ver.reason || "version-select-failed");
        await logger.snapshotDom(page, `09_version_${idx}_${provider}`);

        // 6) Wait for Dettagli del progetto and capture
        await waitForDettagli(page, perShots.afterDettagli, 45000);
        await logger.snapshotDom(page, `10_dettagli_${idx}_${provider}`);
      } catch (e) {
        entry.reason = e?.message || String(e);
        logger.warn("item-failed", { idx, provider, reason: entry.reason });
      }

      results.push(entry);
    }

    const okAll = results.length > 0 && results.every((r) => r.ok);
    return {
      ok: okAll,
      nav: { url: nav.url, title: nav.title, shots: navShots, cookieDismissed: nav.cookieDismissed, tracePath, logs: nav.logs },
      items: results
    };
  } finally {
    try {
      if (context) {
        await context.tracing.stop({ path: tracePath }).catch(() => {});
      }
    } catch {}
    await browser.close();
  }
}
