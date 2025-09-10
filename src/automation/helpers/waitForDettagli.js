// src/automation/helpers/waitForDettagli.js
// Waits until the section "Dettagli del progetto" is displayed.
export async function waitForDettagli(page, screenshotPath, timeoutMs = 40000) {
  const PHRASE = 'dettagli del progetto';
  await page.waitForFunction(
    (phrase) => {
      const lower = String(phrase).toLowerCase();
      const nodes = Array.from(document.querySelectorAll('h1, h2, h3, h4, label, span, div, th, td, p'));
      const el = nodes.find((n) => (n.textContent || '').toLowerCase().includes(lower));
      return !!el;
    },
    PHRASE,
    { timeout: timeoutMs }
  );

  await page.waitForTimeout(300);
  if (screenshotPath) await page.screenshot({ path: screenshotPath, fullPage: true });
  return { ok: true };
}

