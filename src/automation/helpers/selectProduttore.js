// src/automation/helpers/selectProduttore.js
// Selects a value in the "Selezionare un produttore" dropdown by visible text.
// `target` can be a label string (visible text) or a value string when options.matchBy === 'value'
export async function selectProduttore(page, target, screenshotPath, logger, timeoutMs = 30000, options = {}) {
  if (!target) return { ok: true, skipped: true };
  const LABEL_TEXT = 'produttore';

  // Find the select near the label "Produttore"
  const handle = await page.evaluateHandle((labelText) => {
    const lower = String(labelText).toLowerCase();
    const labels = Array.from(document.querySelectorAll('label, span, div, td, th, p'));
    const node = labels.find((n) => (n.textContent || '').toLowerCase().includes(lower));
    const row = node?.closest('tr');
    let sel = row?.querySelector('select') || null;
    if (!sel) {
      sel = document.querySelector("select[id*='produttore' i], select[name*='produttore' i]");
    }
    return sel || null;
  }, LABEL_TEXT);

  const el = await handle.asElement();
  if (!el) {
    logger?.warn?.('produttore:not-found');
    return { ok: false, reason: 'produttore-select-not-found' };
  }

  // Wait until it has options
  await page.waitForFunction((sel) => sel && !sel.disabled && sel.querySelectorAll('option').length > 0, el, { timeout: timeoutMs });

  // Capture options for diagnostics
  const optionsList = await el.evaluate((sel) => Array.from(sel.options).map(o => ({ value: o.value, label: (o.textContent||'').trim(), disabled: o.disabled })));
  try { await logger?.saveJSON?.(`insights/producer_options_${Date.now()}.json`, optionsList); } catch {}

  const mode = options.matchBy || 'label';
  const desired = (() => {
    if (mode === 'value') return optionsList.find(o => o.value === String(target));
    const lower = String(target).toLowerCase();
    return optionsList.find(o => (o.label || '').toLowerCase().includes(lower));
  })();

  if (!desired) {
    logger?.warn?.('produttore:option-not-found', { target, mode, options: optionsList.length });
    return { ok: false, reason: 'produttore-option-not-found' };
  }

  // Use Playwright API to select by value, then verify
  await el.selectOption({ value: desired.value }).catch(() => {});
  let chosen = await el.evaluate((sel) => ({ value: sel.value, label: sel.options[sel.selectedIndex]?.textContent?.trim() || '' }));
  if (chosen.value !== desired.value) {
    // Fallback via DOM + events
    chosen = await el.evaluate((sel, val) => {
      const opt = Array.from(sel.options).find(o => o.value === val);
      if (!opt) return { value: sel.value, label: sel.options[sel.selectedIndex]?.textContent?.trim() || '' };
      sel.value = val;
      sel.dispatchEvent(new Event('input', { bubbles: true }));
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      return { value: sel.value, label: sel.options[sel.selectedIndex]?.textContent?.trim() || '' };
    }, desired.value);
  }

  await page.waitForLoadState('networkidle').catch(() => {});
  try {
    const { waitForSettled } = await import('./waitForSettled.js');
    await waitForSettled(page, 40000);
  } catch {}
  await page.waitForTimeout(150);
  if (screenshotPath) await page.screenshot({ path: screenshotPath, fullPage: true });
  logger?.info?.('produttore:selected', { chosen, mode: options.matchBy || 'label' });
  return { ok: true, chosen };
}
