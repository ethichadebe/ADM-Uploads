// src/automation/helpers/populateDettagli.js
// Populates the "Dettagli del progetto" form using label heuristics.

function normalize(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/_/g, ' ')
    .toLowerCase();
}

const LABEL_ALIASES = {
  Produttore: ['produttore'],
  Id_versione_produttore: ['id versione produttore', 'id versione del produttore'],
  Percentuale_RTP_di_riferimento: ['percentuale rtp di riferimento', 'rtp di riferimento'],
  Deviazione_standard: ['deviazione standard'],
  Probabilita_di_vincita: ['probabilita di vincita', 'probabilità di vincita'],
  Message_digest_SHA1_o_MD5_della_documentazione_completa: [
    'message digest',
    'sha1 o md5',
    'documentazione completa',
    'digest'
  ]
};

function entriesFromPayload(payload) {
  const out = [];
  for (const [key, value] of Object.entries(payload || {})) {
    if (key === 'Produttore' || key === 'Selezionare_un_produttore') continue; // handled separately
    const aliases = LABEL_ALIASES[key] || [normalize(key)];
    out.push({ key, value, aliases: aliases.map(normalize) });
  }
  return out;
}

export async function populateDettagli(page, payload, screenshotPath, logger) {
  // 1) Explicit ID-based population for known fields
  const idMap = [
    { key: 'Id_versione_produttore', sel: "#formAcqController\\:idVersProduttore", type: 'text' },
    { key: 'Percentuale_RTP_di_riferimento', sel: "#formAcqController\\:idPercRTPRif_input", type: 'number', scale: 3 },
    { key: 'Deviazione_standard', sel: "#formAcqController\\:idDevStd_input", type: 'number', scale: 3 },
    { key: 'Probabilita_di_vincita', sel: "#formAcqController\\:idProbVincita_input", type: 'number', scale: 2 },
    { key: 'Message_digest_SHA1_o_MD5_della_documentazione_completa', sel: "#formAcqController\\:idMessageDigest", type: 'text' }
  ];

  const usedKeys = new Set();
  // Format number to dot-decimal (as screenshots show decimals with '.')
  const toDotNumber = (v, scale) => {
    const n = Number(String(v).replace(/,/g, '.'));
    if (!isFinite(n)) return '';
    return typeof scale === 'number' ? n.toFixed(scale) : String(n);
  };

  for (const { key, sel, type, scale } of idMap) {
    if (!(payload && key in payload)) continue;
    const raw = payload[key];
    const value = type === 'number' ? toDotNumber(raw, scale) : String(raw ?? '');
    try {
      await page.waitForSelector(sel, { timeout: 5000 });
      // Try typing to let masked inputs parse correctly
      const loc = page.locator(sel);
      await loc.click({ timeout: 3000 }).catch(() => {});
      try { await page.keyboard.press('Control+A'); } catch {}
      try { await page.keyboard.press('Backspace'); } catch {}
      await loc.type(value, { delay: 10 }).catch(async () => {
        // Fallback to direct fill if typing fails
        await page.fill(sel, value).catch(async () => {
          // Last resort: set via DOM
          await page.$eval(sel, (el, v) => {
            el.value = v;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }, value);
        });
      });
      // Also update hidden input (PrimeFaces inputNumber keeps a hidden field without _input)
      if (type === 'number') {
        const hiddenSel = sel.replace(/_input$/, '');
        try {
          await page.$eval(hiddenSel, (el, rawVal, sc) => {
            if (!el) return;
            // hidden also dot-decimal
            const n = Number(String(rawVal).replace(/,/g, '.'));
            const normalized = isFinite(n) ? (typeof sc === 'number' ? n.toFixed(sc) : String(n)) : '';
            el.value = normalized;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }, raw, scale);
        } catch {}
      }

      // Blur to commit widget formatting (e.g., PrimeFaces InputNumber)
      try { await page.keyboard.press('Tab'); } catch {}
      // Read back the displayed value for diagnostics
      const displayed = await page.$eval(sel, (el) => el.value);
      logger?.info?.('dettagli:field-id', { key, selector: sel, wrote: value, displayed });
      usedKeys.add(key);
    } catch (e) {
      logger?.warn?.('dettagli:field-id-failed', { key, selector: sel, reason: e?.message || String(e) });
    }
  }

  // 2) Heuristic fallback for any remaining fields
  const filtered = Object.fromEntries(Object.entries(payload || {}).filter(([k]) => !usedKeys.has(k)));
  const items = entriesFromPayload(filtered);

  for (const item of items) {
    const res = await page.evaluate(({ aliases, val }) => {
      const matches = (txt) => {
        const n = (txt || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        return aliases.some((a) => n.includes(a));
      };

      const findInputNear = (start) => {
        // by label[for]
        if (start && start.getAttribute) {
          const fid = start.getAttribute('for');
          if (fid) {
            const byFor = document.getElementById(fid);
            if (byFor && (byFor.tagName === 'INPUT' || byFor.tagName === 'TEXTAREA')) return byFor;
          }
        }
        // walk up to find a nearby input/textarea in the same container/row
        let c = start?.closest('tr, div, fieldset, form') || start?.parentElement || document.body;
        let depth = 0;
        while (c && depth < 5) {
          const el = c.querySelector('input[type="text"], textarea, input:not([type]), input[type="search"], input[type="number"]');
          if (el) return el;
          c = c.parentElement;
          depth++;
        }
        return null;
      };

      // search likely label nodes
      const all = Array.from(document.querySelectorAll('label, span, div, td, th, p'));
      const labelNode = all.find((n) => matches(n.textContent || ''));
      const input = findInputNear(labelNode);
      if (!input) return { ok: false, reason: 'input-not-found' };

      const v = String(val ?? '');
      input.focus();
      input.value = v;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: true };
    }, { aliases: item.aliases, val: item.value });

    logger?.info?.('dettagli:field', { key: item.key, ok: !!res?.ok });
  }

  await page.waitForTimeout(300);
  if (screenshotPath) await page.screenshot({ path: screenshotPath, fullPage: true });
  return { ok: true };
}

