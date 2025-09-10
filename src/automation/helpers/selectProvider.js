// src/automation/helpers/selectProvider.js
// Selects provider by value or label fragment (fallback).
export async function selectProvider(page, providerTarget, screenshotPath, logger) {
  const SELECT = "#formAcqController\\:elencoConc";
  await page.waitForSelector(SELECT, { timeout: 15000 });

  // Try by value first
  const byValue = await page.selectOption(SELECT, { value: String(providerTarget) }).catch(() => []);
  if (byValue.length === 0) {
    // Fallback: find option containing the fragment in text
    const opts = await page.$$eval(`${SELECT} option`, (els) =>
      els.map((o) => ({ value: o.value, label: (o.textContent || "").trim() }))
    );
    logger?.info?.("provider:fallback-search", { providerTarget, options: opts.length });
    const lower = String(providerTarget).toLowerCase();
    const found = opts.find((o) => (o.label || "").toLowerCase().includes(lower) && o.value);
    if (!found) return { ok: false, reason: "provider-not-found" };
    await page.selectOption(SELECT, { value: found.value });
  }

  // Trigger JSF change
  await page.dispatchEvent(SELECT, "change").catch(() => {});
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(200);
  if (screenshotPath) await page.screenshot({ path: screenshotPath, fullPage: true });

  // After provider change, radios are often re-rendered. Ensure Gioco exists.
  const GIOCO = "#formAcqController\\:tipoProgetto\\:1";
  await page.waitForSelector(GIOCO, { timeout: 20000 });

  logger?.info?.("provider:selected", { providerTarget });
  return { ok: true };
}
