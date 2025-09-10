// src/automation/helpers/dismissCookies.js
// Attempts to close the ADM cookie bar if present.
// Handles both Italian aria-label and English fallback text.
export async function dismissCookies(page, screenshotPath) {
  try {
    const bar = page.locator("#cookiebar-adm");
    const visible = await bar.isVisible({ timeout: 3000 }).catch(() => false);
    if (!visible) return { dismissed: false, reason: "not-visible" };

    // Prefer aria-label (Italian), fallback to link text
    const closeByAria = page.locator("a[aria-label*='Chiudi'][aria-label*='rifiuta']");
    const closeByEn = page.getByText("Close and reject cookies", { exact: false });
    const candidate = (await closeByAria.count()) ? closeByAria : closeByEn;

    await candidate.first().click({ timeout: 5000 });
    await page.waitForTimeout(300); // allow DOM to change

    const stillVisible = await bar.isVisible().catch(() => false);
    if (screenshotPath) await page.screenshot({ path: screenshotPath, fullPage: true });

    return { dismissed: !stillVisible, reason: !stillVisible ? "clicked" : "still-visible" };
  } catch (e) {
    if (screenshotPath) await page.screenshot({ path: screenshotPath, fullPage: true });
    return { dismissed: false, reason: e.message || "error" };
  }
}
