// UI parity · report.md from one or more run.mjs output folders
//
//   node test/uiparity/report.mjs <run-dir> [<rerun-dir> …] [--out=<file>]
//
// A later folder replaces the earlier one's states for every page it covers (rerun a few pages with
// `--views=… --workers=1` and merge them in). The slow backend calls come from each folder's ops-backend.log.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function buildReport(dirs) {
  const runs = dirs.map((d) => ({ dir: d, cmp: JSON.parse(fs.readFileSync(path.join(d, 'compare.json'), 'utf8')), meta: JSON.parse(fs.readFileSync(path.join(d, 'states.json'), 'utf8')) }));
  const pagesOf = (r) => new Set(r.cmp.map((c) => c.page));
  let cmp = [];
  for (const r of runs) { const p = pagesOf(r); cmp = cmp.filter((c) => !p.has(c.page)).concat(r.cmp); }
  const order = runs[0].meta.sidebar.legacy.map((it) => it.view + (it.citytour ? '#citytour' : ''));
  cmp.sort((a, b) => order.indexOf(a.page) - order.indexOf(b.page));
  const boot = runs[0].meta.boot;

  const esc = (x) => String(x == null ? '' : x).replace(/\|/g, '\\|').replace(/\n/g, ' ').slice(0, 160);
  const diff = cmp.filter((c) => c.verdict !== 'same');
  const byCls = {};
  for (const c of diff) byCls[c.cls] = (byCls[c.cls] || 0) + 1;
  const pages = [...new Set(cmp.map((c) => c.page))];
  const md = [];
  md.push('# UI parity · legacy (lk-inbox) vs new (main + operation-backend)', '',
    `From ${runs.map((r) => '`' + path.basename(r.dir) + '`').join(' + ')} · ${pages.length} pages · ${cmp.length} page × toggle states · `
    + `${cmp.filter((c) => c.verdict === 'same').length} same · ${cmp.filter((c) => c.verdict === 'numbers').length} same layout with other numbers · ${cmp.filter((c) => c.verdict === 'differs').length} differ`, '');
  md.push('## Boot', '', '| | legacy | new |', '|---|---|---|');
  for (const k of Object.keys(boot.legacy.counts)) md.push(`| ${k} | ${boot.legacy.counts[k]} | ${boot.new.counts[k]} |`);
  md.push(`| JS errors at boot | ${boot.legacy.errors.length} | ${boot.new.errors.length} |`, `| failed calls at boot | ${boot.legacy.failed.length} | ${esc(boot.new.failed.join('; '))} |`, '');

  md.push('## Per page', '', '| page | states | same | numbers only | differ | new side load (page open) |', '|---|---|---|---|---|---|');
  for (const p of pages) {
    const xs = cmp.filter((c) => c.page === p), open = xs.find((c) => c.kind === 'page');
    const ms = open && open.loadMs ? open.loadMs[1] : 0;
    md.push(`| ${p} | ${xs.length} | ${xs.filter((c) => c.verdict === 'same').length} | ${xs.filter((c) => c.verdict === 'numbers').length} | ${xs.filter((c) => c.verdict === 'differs').length} | ${ms > 1000 ? (ms / 1000).toFixed(1) + ' s' : '–'} |`);
  }
  md.push('', '## Differences by kind (first guess from the evidence)', '', '| kind | states |', '|---|---|', ...Object.entries(byCls).sort((a, b) => b[1] - a[1]).map(([k, v]) => `| ${k} | ${v} |`), '');

  const ep = {};
  for (const c of cmp) for (const f of c.failed) { const k = f.replace(/\/[0-9a-zA-Z_-]{12,}/g, '/:id').replace(/\/\d{4}-\d{2}-\d{2}/g, '/:date').replace(/\?.*?(?= →)/, '').replace(/ → (\d+|network|failed)(.*)/, (m, s, rest) => ` → ${s} ${rest.replace(/.*"message":"([^"]{0,110}).*/, '$1')}`); (ep[k] = ep[k] || new Set()).add(c.page); }
  md.push('## Failed API calls on the new side', '', '| call → answer | pages |', '|---|---|', ...Object.entries(ep).map(([k, v]) => `| ${esc(k)} | ${esc([...v].slice(0, 8).join(', '))} |`), '');

  const slow = {};
  for (const r of runs) {
    const f = path.join(r.dir, 'ops-backend.log'); if (!fs.existsSync(f)) continue;
    const req = {};
    for (const l of fs.readFileSync(f, 'utf8').split('\n')) {
      let j; try { j = JSON.parse(l); } catch (_) { continue; }
      if (j.req && j.reqId) req[j.reqId] = j.req.method + ' ' + j.req.url;
      if (j.res && j.responseTime != null) {
        const k = String(req[j.reqId] || '?').replace(/\?.*/, '').replace(/\/\d{4}-\d{2}(-\d{2})?/g, '/:date').replace(/\/(b|bk|veh|ps_|a)[A-Za-z_-]*[0-9][A-Za-z0-9_-]*(?=\/|$)/g, '/:id');
        const e = slow[k] = slow[k] || { n: 0, max: 0, sum: 0 }; e.n++; e.max = Math.max(e.max, j.responseTime); e.sum += j.responseTime;
      }
    }
  }
  md.push('## Slowest backend calls (local Docker DB, two app pairs at once)', '', '| call | max | avg | calls |', '|---|---|---|---|',
    ...Object.entries(slow).filter(([, e]) => e.max > 3000).sort((a, b) => b[1].max - a[1].max).slice(0, 25).map(([k, e]) => `| ${esc(k)} | ${(e.max / 1000).toFixed(1)} s | ${(e.sum / e.n / 1000).toFixed(1)} s | ${e.n} |`), '');

  md.push('## Every differing state', '', '| page | toggle | legacy | new | kind |', '|---|---|---|---|---|');
  for (const c of diff) {
    const lg = `${c.rows[0]} rows · ${c.lineCount[0]} lines` + ((c.layMissing[0] || c.missing[0]) ? ' · e.g. "' + esc(c.layMissing[0] || c.missing[0]).slice(0, 70) + '"' : '') + (c.btnMissing.length ? ' · buttons: ' + esc(c.btnMissing.slice(0, 4).join(', ')) : '');
    const nw = `${c.rows[1]} rows · ${c.lineCount[1]} lines` + (c.loadMs && c.loadMs[1] > 2000 ? ` · loaded in ${(c.loadMs[1] / 1000).toFixed(1)}s` : '') + ((c.layExtra[0] || c.extra[0]) ? ' · e.g. "' + esc(c.layExtra[0] || c.extra[0]).slice(0, 70) + '"' : '') + (c.failed.length ? ' · ' + esc(c.failed.slice(0, 2).join('; ')) : '') + (c.newErrors.length ? ' · ' + esc(c.newErrors[0]) : '');
    md.push(`| ${esc(c.page)} | ${esc(c.toggle)} | ${lg} | ${nw} | ${esc(c.cls)} (${esc(c.why)}) |`);
  }
  return { md: md.join('\n') + '\n', cmp };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dirs = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const outArg = process.argv.find((a) => a.startsWith('--out='));
  if (!dirs.length) { console.error('usage: node test/uiparity/report.mjs <run-dir> [<rerun-dir> …] [--out=<file>]'); process.exit(2); }
  const { md } = buildReport(dirs);
  if (outArg) fs.writeFileSync(outArg.slice(6), md); else process.stdout.write(md);
}
