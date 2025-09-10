// src/automation/helpers/selectLastVersion.js
// Finds the "Selezionare una versione" <select>, selects the last available option,
// and waits for JSF/Ajax to settle.
export async function selectLastVersion(page, screenshotPath, logger, timeoutMs = 30000) {
  const SEL = "select[id*='vers' i], select[name*='vers' i]";

  await page.waitForSelector(SEL, { timeout: timeoutMs });

  // Ensure it is enabled and has options
  await page.waitForFunction(
    (selector) => {
      const el = document.querySelector(selector);
      if (!el) return false;
      const enabled = !el.disabled;
      const options = el.querySelectorAll('option').length;
      return enabled && options > 0;
    },
    SEL,
    { timeout: timeoutMs }
  );

  const available = await page.$$eval(SEL, (els) => {
    const el = els[0];
    return Array.from(el.querySelectorAll('option'))
      .map((o) => ({ value: o.value, label: (o.textContent || '').trim(), disabled: o.disabled }))
      .filter((o) => o.value);
  });

  if (!available || available.length === 0) {
    if (screenshotPath) await page.screenshot({ path: screenshotPath, fullPage: true });
    logger?.warn?.('version:no-options');
    return { ok: false, reason: 'no-version-options', chosen: null, available: [] };
  }

  const chosen = available[available.length - 1]; // last one
  await page.selectOption(SEL, { value: chosen.value });
  await page.dispatchEvent(SEL, 'change').catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(250);

  if (screenshotPath) await page.screenshot({ path: screenshotPath, fullPage: true });
  logger?.info?.('version:selected', { chosen });
  return { ok: true, chosen, available };
}

