// src/utils/logger.js
import fs from 'fs';
import path from 'path';

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

function sanitizeFilePart(s) {
  return String(s || '')
    .replace(/https?:\/\//g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .slice(0, 140);
}

export function createRunLogger(runDir) {
  const logsDir = path.join(runDir, 'logs');
  const netDir = path.join(runDir, 'net');
  const domDir = path.join(runDir, 'dom');
  const insightsDir = path.join(runDir, 'insights');
  [logsDir, netDir, domDir, insightsDir].forEach(ensureDir);

  const textLogPath = path.join(logsDir, 'run.log');
  const ndjsonPath = path.join(logsDir, 'events.ndjson');
  let respSeq = 0;

  function writeLine(line) {
    fs.appendFileSync(textLogPath, line + '\n');
  }

  function writeEvent(obj) {
    fs.appendFileSync(ndjsonPath, JSON.stringify(obj) + '\n');
  }

  function entry(level, msg, data) {
    const ev = { t: nowIso(), level, msg, ...(data ? { data } : {}) };
    writeLine(`[${ev.t}] [${level}] ${msg}${data ? ' ' + JSON.stringify(data) : ''}`);
    writeEvent(ev);
  }

  async function saveText(rel, content) {
    const full = path.join(runDir, rel);
    ensureDir(path.dirname(full));
    fs.writeFileSync(full, content ?? '', 'utf8');
    return full;
  }

  async function saveJSON(rel, obj) {
    return saveText(rel, JSON.stringify(obj, null, 2));
  }

  function shouldCaptureBody(contentType, sizeHint = 0) {
    if (!contentType) return false;
    const ct = contentType.toLowerCase();
    const textual = ['text/', 'application/json', 'application/xhtml', 'application/xml', 'application/javascript'].some((p) => ct.startsWith(p) || ct.includes(p));
    if (!textual) return false;
    if (sizeHint && sizeHint > 200 * 1024) return false; // avoid huge bodies
    return true;
  }

  function attachPage(page) {
    page.on('console', (msg) => {
      // Avoid logging potentially sensitive text in full if too long
      const text = msg.text();
      entry('console', `page.console.${msg.type()}`, { text: text.slice(0, 500) });
    });
    page.on('pageerror', (err) => entry('pageerror', err?.message || String(err)));
    page.on('requestfailed', (req) => entry('requestfailed', req.url(), { method: req.method(), failure: req.failure()?.errorText }));
    page.on('response', async (res) => {
      try {
        const url = res.url();
        const status = res.status();
        const headers = res.headers();
        const ct = headers['content-type'] || headers['Content-Type'] || '';
        const suggestedExt = ct.includes('json') ? 'json' : ct.includes('html') ? 'html' : 'txt';
        const fname = `${String(++respSeq).padStart(4, '0')}_${status}_${sanitizeFilePart(url)}.${suggestedExt}`;
        const rel = path.join('net', fname);

        let savedPath = null;
        const lengthHeader = Number(headers['content-length'] || 0);
        if (shouldCaptureBody(ct, lengthHeader)) {
          const bodyText = await res.text().catch(() => '<<unavailable>>');
          await saveText(rel, bodyText);
          savedPath = rel;
        }
        entry('response', url, { status, contentType: ct || null, saved: savedPath });
      } catch (e) {
        entry('logger-error', 'response-capture-failed', { reason: e.message });
      }
    });
  }

  async function snapshotDom(page, name) {
    try {
      const url = page.url();
      const title = await page.title();
      const html = await page.content();
      const domPath = await saveText(path.join('dom', `${sanitizeFilePart(name)}.html`), html);

      const state = await page.evaluate(() => {
        const pickOptions = (sel) => {
          const el = document.querySelector(sel);
          if (!el) return null;
          const opts = Array.from(el.querySelectorAll('option')).map((o) => ({ value: o.value, label: (o.textContent || '').trim(), disabled: o.disabled }));
          return { disabled: el.disabled, optionsCount: opts.length, options: opts.slice(0, 200) }; // cap
        };
        const providersSel = '#formAcqController\\:elencoConc';
        const giocoSel = '#formAcqController\\:tipoProgetto\\:1';
        const projectSel = '#formAcqController\\:elencoGiocoPiatt';
        const giocoEl = document.querySelector(giocoSel);
        return {
          providers: pickOptions(providersSel),
          giocoPresent: !!giocoEl,
          giocoChecked: giocoEl ? !!giocoEl.checked : null,
          projects: pickOptions(projectSel)
        };
      });

      const insightRel = path.join('insights', `${sanitizeFilePart(name)}.json`);
      await saveJSON(insightRel, { t: nowIso(), url, title, state });
      entry('snapshot', name, { url, title, dom: domPath, insight: insightRel });
    } catch (e) {
      entry('logger-error', 'snapshot-failed', { name, reason: e.message });
    }
  }

  return {
    info: (m, d) => entry('info', m, d),
    warn: (m, d) => entry('warn', m, d),
    error: (m, d) => entry('error', m, d),
    attachPage,
    snapshotDom,
    saveText,
    saveJSON,
    paths: { textLogPath, ndjsonPath, netDir, domDir, insightsDir }
  };
}

