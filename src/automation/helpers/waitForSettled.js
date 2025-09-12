// src/automation/helpers/waitForSettled.js
// Generic "page is settled" wait for JSF/PrimeFaces-style apps.
// - waits for document.readyState === 'complete'
// - waits for Playwright 'networkidle'
// - waits until no obvious blocking overlays/spinners are visible
// - adds a small settle delay
export async function waitForSettled(page, timeoutMs = 45000) {
  // 1) Document complete
  try {
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: timeoutMs });
  } catch (e) {
    // ignore; sometimes pages keep readyState at 'interactive'
  }

  // 2) Network idle (best-effort)
  try { await page.waitForLoadState('networkidle'); } catch {}

  // 3) No obvious overlays/spinners
  const overlaySelectors = [
    '.ui-blockui',
    '.ui-widget-overlay',
    '.block-ui',
    '.loading',
    '.spinner',
    '[aria-busy="true"]'
  ].join(',');

  try {
    await page.waitForFunction(
      (sel) => {
        const els = Array.from(document.querySelectorAll(sel));
        return els.every((el) => {
          const style = getComputedStyle(el);
          const hidden = style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0';
          const rect = el.getBoundingClientRect();
          const off = rect.width === 0 || rect.height === 0;
          return hidden || off;
        });
      },
      overlaySelectors,
      { timeout: timeoutMs }
    );
  } catch {}

  // 4) Small final settle
  await page.waitForTimeout(250);
}

