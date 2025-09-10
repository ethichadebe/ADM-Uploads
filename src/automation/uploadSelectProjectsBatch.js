// src/automation/uploadSelectProjectsBatch.js
import path from "path";
import { navToUploadPage } from "./navToUploadPage.js";
import { selectProvider } from "./helpers/selectProvider.js";
import { clickGioco } from "./helpers/clickGioco.js";
import { selectProjectFromValues } from "./helpers/selectProjectFromValues.js";

// Normalizes input: accept { provider } or { Provider }
function normProviderItem(item) {
  const provider = String(item?.provider ?? item?.Provider ?? "").trim();
  const projectValues = (item?.projectValues || []).map(String);
  return { provider, projectValues };
}

export async function uploadSelectProjectsBatch({ username, password, providers }, runDir) {
  // 0) Navigate to upload page and return a Playwright Page
  const nav = await navToUploadPage({ username, password }, runDir);
  const { browser, page, shots: navShots } = nav;

  const results = [];
  try {
    let idx = 0;
    for (const raw of providers || []) {
      idx++;
      const { provider, projectValues } = normProviderItem(raw);
      const perShots = {
        afterProvider: path.join(runDir, `05_provider_${idx}_${provider}.png`),
        afterGioco: path.join(runDir, `06_gioco_${idx}_${provider}.png`),
        afterProject: path.join(runDir, `07_project_${idx}_${provider}.png`)
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
        const sp = await selectProvider(page, provider, perShots.afterProvider);
        if (!sp.ok) throw new Error(sp.reason || "provider-select-failed");

        // 2) Gioco
        const g = await clickGioco(page, perShots.afterGioco);
        if (!g.ok) throw new Error(g.reason || "gioco-click-failed");

        // 3) Project (first match from provided list)
        const pj = await selectProjectFromValues(page, projectValues, perShots.afterProject);
        if (!pj.ok) throw new Error(pj.reason || "project-select-failed");

        entry.ok = true;
        entry.chosen = pj.chosen;
      } catch (e) {
        entry.reason = e?.message || String(e);
      }

      results.push(entry);
    }

    const okAll = results.length > 0 && results.every((r) => r.ok);
    return {
      ok: okAll,
      nav: { url: nav.url, title: nav.title, shots: navShots, cookieDismissed: nav.cookieDismissed },
      items: results
    };
  } finally {
    await browser.close();
  }
}
