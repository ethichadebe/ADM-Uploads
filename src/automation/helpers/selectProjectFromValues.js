// src/automation/helpers/selectProjectFromValues.js
import { waitForProjectList } from "./waitForProjectList.js";
import { waitForSettled } from "./waitForSettled.js";

// Picks the first projectValue that exists in the list.
// Returns { ok, chosen, available } where chosen is the selected {value,label} or null.
export async function selectProjectFromValues(page, projectValues, screenshotPath, logger) {
  const SEL = "#formAcqController\\:elencoGiocoPiatt";
  await waitForProjectList(page, 20000);

  const available = await page.$$eval(`${SEL} option`, (els) =>
    els
      .map((o) => ({
        value: o.value,
        label: (o.textContent || "").replace(/&amp;#039;/g, "'").trim()
      }))
      .filter((o) => o.value)
  );

  const set = new Set((projectValues || []).map(String));
  const match = available.find((o) => set.has(String(o.value))) || null;

  if (!match) {
    if (screenshotPath) await page.screenshot({ path: screenshotPath, fullPage: true });
    logger?.warn?.("project:no-match", { provided: projectValues, availableCount: available.length });
    // Save available options for analysis
    try { await logger?.saveJSON?.(`insights/available_${Date.now()}.json`, available); } catch {}
    return { ok: false, chosen: null, available, reason: "no-match" };
  }

  await page.selectOption(SEL, { value: match.value });
  await page.dispatchEvent(SEL, "change").catch(() => {});
  await page.waitForLoadState("networkidle").catch(() => {});
  await waitForSettled(page, 40000).catch(() => {});
  await page.waitForTimeout(150);

  if (screenshotPath) await page.screenshot({ path: screenshotPath, fullPage: true });
  logger?.info?.("project:selected", { chosen: match });
  return { ok: true, chosen: match, available };
}
