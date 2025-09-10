// src/automation/helpers/waitForProgressivo.js
// Waits until the "Selezionare il progressivo richiesta" control appears
// and is usable (its adjacent/select element is enabled and populated).
export async function waitForProgressivo(page, screenshotPath, timeoutMs = 30000) {
  const PHRASE = "selezionare il progressivo richiesta";

  await page.waitForFunction(
    (phrase) => {
      const lower = String(phrase).toLowerCase();
      const nodes = Array.from(document.querySelectorAll('label, span, div, td, th, p'));
      const lbl = nodes.find((n) => (n.textContent || '').toLowerCase().includes(lower));
      if (!lbl) return false;

      // Try to find a related <select> nearby or by heuristic id/name
      const searchNearbySelect = (start) => {
        let c = start.closest('tr, div, fieldset, form') || start.parentElement;
        let depth = 0;
        while (c && depth < 4) {
          const s = c.querySelector('select');
          if (s) return s;
          c = c.parentElement;
          depth++;
        }
        return null;
      };

      let select = searchNearbySelect(lbl);
      if (!select) {
        select = document.querySelector(
          "select[id*='progress' i], select[name*='progress' i], select[id*='richiest' i], select[name*='richiest' i]"
        );
      }

      if (!select) return true; // label exists; at minimum we saw it
      const enabled = !select.disabled;
      const options = select.querySelectorAll('option').length;
      return enabled && options > 0;
    },
    PHRASE,
    { timeout: timeoutMs }
  );

  await page.waitForTimeout(300);
  if (screenshotPath) await page.screenshot({ path: screenshotPath, fullPage: true });
  return { ok: true };
}

