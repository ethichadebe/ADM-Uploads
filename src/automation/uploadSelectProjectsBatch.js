// src/automation/uploadSelectProjectsBatch.js
import path from "path";
import { navToUploadPage } from "./navToUploadPage.js";
import { selectProvider } from "./helpers/selectProvider.js";
import { clickGioco } from "./helpers/clickGioco.js";
import { selectProjectFromValues } from "./helpers/selectProjectFromValues.js";
import { waitForProgressivo } from "./helpers/waitForProgressivo.js";
import { selectLastVersion } from "./helpers/selectLastVersion.js";
import { waitForDettagli } from "./helpers/waitForDettagli.js";
import { selectProduttore } from "./helpers/selectProduttore.js";
import { populateDettagli } from "./helpers/populateDettagli.js";
import { createRunLogger } from "../utils/logger.js";

// Normalizes input: accept { provider } or { Provider }
// projectValues supports strings or objects with shape { Selezionare_un_progetto: "value", ...details }
// If Selezionare_un_progetto is missing, we also accept Selezionare_un_produttore to provide the project value.
function normProviderItem(item) {
  const provider = String(item?.provider ?? item?.Provider ?? "").trim();
  const raw = item?.projectValues || [];
  const projectValues = [];
  const detailsByValue = Object.create(null);
  for (const it of raw) {
    if (it == null) continue;
    if (typeof it === 'string' || typeof it === 'number') {
      projectValues.push(String(it));
    } else if (typeof it === 'object') {
      const val = it.Selezionare_un_progetto ?? it.Selezionare_un_produttore ?? it.value ?? it.projectValue ?? it.Progetto ?? it.progetto;
      if (!val) continue;
      const v = String(val);
      projectValues.push(v);
      const { Selezionare_un_progetto, Selezionare_un_produttore, value, projectValue, Progetto, progetto, ...details } = it;
      detailsByValue[v] = details;
    }
  }
  return { provider, projectValues, detailsByValue };
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
      const { provider, projectValues, detailsByValue } = normProviderItem(raw);
      const perShots = {
        afterProvider: path.join(runDir, `05_provider_${idx}_${provider}.png`),
        afterGioco: path.join(runDir, `06_gioco_${idx}_${provider}.png`),
        afterProject: path.join(runDir, `07_project_${idx}_${provider}.png`),
        afterProgressivo: path.join(runDir, `08_progressivo_${idx}_${provider}.png`),
        afterVersion: path.join(runDir, `09_version_${idx}_${provider}.png`),
        afterDettagli: path.join(runDir, `10_dettagli_${idx}_${provider}.png`),
        afterProduttore: path.join(runDir, `10_produttore_${idx}_${provider}.png`),
        afterFilled: path.join(runDir, `11_filled_${idx}_${provider}.png`)
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

        // 7) Populate the Dettagli del progetto fields, if provided for the chosen project.
        const chosenVal = entry.chosen?.value;
        const dettagliPayload = chosenVal ? detailsByValue[chosenVal] : null;
        if (dettagliPayload && Object.keys(dettagliPayload).length > 0) {
          logger.info("dettagli:populate:start", { chosen: chosenVal });
          // Prefer matching producer by visible label; fallback to value when label is absent
          if (dettagliPayload.Produttore) {
            await selectProduttore(page, dettagliPayload.Produttore, perShots.afterProduttore, logger, 30000, { matchBy: 'label' });
            await logger.snapshotDom(page, `10_produttore_${idx}_${provider}`);
          } else if (dettagliPayload.Selezionare_un_produttore) {
            await selectProduttore(page, String(dettagliPayload.Selezionare_un_produttore), perShots.afterProduttore, logger, 30000, { matchBy: 'value' });
            await logger.snapshotDom(page, `10_produttore_${idx}_${provider}`);
          }
          await populateDettagli(page, dettagliPayload, perShots.afterFilled, logger);
          await logger.snapshotDom(page, `11_filled_${idx}_${provider}`);
        } else {
          logger.info("dettagli:populate:skipped", { reason: "no-payload", chosen: chosenVal });
        }
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
