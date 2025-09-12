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
  const items = entriesFromPayload(payload);

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

