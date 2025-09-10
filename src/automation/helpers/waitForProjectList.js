// src/automation/helpers/waitForProjectList.js
// Waits until the "Selezionare un progetto" <select> exists, is enabled, and has >1 options.
export async function waitForProjectList(page, timeoutMs = 20000) {
  const SEL = "#formAcqController\\:elencoGiocoPiatt";
  await page.waitForSelector(SEL, { timeout: timeoutMs });

  await page.waitForFunction(
    (selector) => {
      const el = document.querySelector(selector);
      if (!el) return false;
      const enabled = !el.disabled;
      const options = el.querySelectorAll("option").length;
      return enabled && options > 1;
    },
    SEL,
    { timeout: timeoutMs }
  );

  // small settle for JSF to rebind
  await page.waitForTimeout(300);
  return { ok: true };
}
