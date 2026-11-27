// UI parity · check 4, action scenarios: the same staff task done through the UI on both systems
//
//   node test/uiparity/scenarios.mjs [--only=name,name] [--out=dir] [--one-copy] [--keep-dbs]
//   --one-copy  one fresh pair for the whole batch instead of one per scenario (a slow disk: a copy of legacy can take
//               20 minutes). Only for scenarios that touch disjoint records (each its own lead name / booking / day).
//   --keep-dbs  leave the last pair in place to inspect · --reuse-dbs  run on the pair left in place (iterating on a scenario)
//
// Each scenario (scenarios/*.mjs) is a list of steps run on legacy and on the new frontend from the same
// starting data. Before each scenario the runner makes fresh databases from the pipeline's templates:
//   <SC_PREFIX>legacy_sc      ← legacy       (legacy's data)
//   <SC_PREFIX>operations_sc  ← operations   (ours, after the cutover import)
// each with the uiparity login, and boots both servers on them (harness.mjs, as run.mjs does, same clock).
// After every step it compares (1) the message: native alert/confirm/prompt text, toast and the open dialog's
// first line, exactly; (2) the screen, with run.mjs's snapshot and compare. At the end it compares (3) the data:
// the records the task changed, read from both databases (read-only) and matched by content, not by id.
// Report: <out>/scenarios.md and scenarios.json; seen.json lists the legacy handlers that ran (coverage.mjs).
//
// A scenario module exports default { name, title, prepare?, steps, data }:
//   prepare({ legacy, ops, today, addDays }) → vars     read-only queries to pick the case (a booking, a day)
//   steps(vars) → [step]                                 see STEP below
//   data({ legacy, ops, vars }) → { legacy: [rec], new: [rec] }   the changed records, as plain comparable objects
// A step is one of (label optional on all):
//   { nav: 'booking', citytour? }              open a sidebar page
//   { click: 'label|fn' }                      the run.mjs key (digits as #, bkV2 = bookingV2); page, then dialogs
//   { clickText: 'Save', within?: 'css' }      the first visible button / [onclick] whose text is exactly this
//   { fill: 'css', value }                     type into an input (input + change events)
//   { choose: 'css', value }                   pick an option (by value, else by label)
//   { answer: true | 'text' | false }          the next native confirm/prompt is accepted (with text) / dismissed
//   { call: 'fn', args: [] }                   call the same page function on both sides (bkV2X ↔ bookingV2X)
//   { call: 'fn', argsFrom: { legacy: sql, ops: sql } }   … with arguments read from each side's database
//   { wait: ms }
// and any step may carry { legacy: {...}, new: {...} } to override itself per side (say why in a comment).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { startHarness, bootPair, PROBE, snapBoth, onBoth, settle, compare, assertLocal } from './harness.mjs';
import { legacyItems } from './coverage.mjs';

const require = createRequire(import.meta.url);
const pg = require('pg');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : (process.argv.includes('--' + k) ? true : d); };
const LEGACY_DIR = process.env.LEGACY_DIR || 'D:/projects/wt-uip-legacy';
const OPS_DIR = process.env.OPS_BACKEND_DIR || 'D:/projects/operation-backend';
const ADMIN = process.env.SC_ADMIN_DB || 'postgres://postgres:postgres@localhost:55433/postgres';
const PREFIX = process.env.SC_PREFIX || '';
const DB = { legacy: PREFIX + 'legacy_sc', ops: PREFIX + 'operations_sc' };
const TPL = { legacy: process.env.SC_LEGACY_TEMPLATE || 'legacy', ops: process.env.SC_OPS_TEMPLATE || 'operations' };
const dbUrl = (name) => { const u = new URL(ADMIN); u.pathname = '/' + name; return u.toString(); };
assertLocal({ SC_ADMIN_DB: ADMIN });
const ONLY = arg('only', '') ? String(arg('only')).split(',') : null;
const OUT = path.resolve(arg('out', path.join(HERE, 'out', 'sc-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19))));
fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => { console.log(...a); fs.appendFileSync(path.join(OUT, 'run.log'), a.join(' ') + '\n'); };

// ── fresh databases per scenario ──
async function admin(sql) { const c = new pg.Client({ connectionString: ADMIN }); await c.connect(); try { return await c.query(sql); } finally { await c.end(); } }
async function freshDbs() {
  const H = crypto.randomBytes(16).toString('hex'); const hash = H + ':' + crypto.scryptSync('uiparity', H, 32).toString('hex');
  for (const k of ['legacy', 'ops']) {
    await admin(`DROP DATABASE IF EXISTS ${DB[k]} WITH (FORCE)`);
    // FILE_COPY copies the template's files (seconds, not minutes); the template must have no session open
    for (let i = 0; ; i++) {
      try { await admin(`CREATE DATABASE ${DB[k]} TEMPLATE ${TPL[k]} STRATEGY = FILE_COPY`); break; } catch (e) {
        if (i > 60 || !/being accessed by other users/.test(e.message)) throw e;
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
    const c = new pg.Client({ connectionString: dbUrl(DB[k]) }); await c.connect();
    await c.query(`INSERT INTO ${k === 'legacy' ? 'operation_schemas.users' : 'users'}(username,pass_hash,name,role,can_edit) VALUES('uiparity',$1,'UI Parity','admin',true)`, [hash]);
    await c.end();
  }
  // the template may be older than the backend under test: bring our copy to its schema (clean env, local URL)
  const base = {};
  for (const k of ['PATH', 'Path', 'SystemRoot', 'TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'HOME', 'ComSpec', 'PATHEXT']) if (process.env[k]) base[k] = process.env[k];
  const r = spawnSync(process.execPath, ['--import', 'tsx', 'src/migrate.ts'], { cwd: OPS_DIR, env: { ...base, DATABASE_URL: dbUrl(DB.ops) }, encoding: 'utf8' });
  if (r.status !== 0) throw new Error('migrate failed: ' + (r.stderr || r.stdout).slice(-800));
  log('   ' + (r.stdout.trim().split('\n').pop() || ''));
}
// read-only query helpers on the scenario databases
async function reader(name) {
  const c = new pg.Client({ connectionString: dbUrl(name) }); await c.connect();
  await c.query('SET default_transaction_read_only = on');
  const q = async (sql, params) => (await c.query(sql, params)).rows;
  q.end = () => c.end();
  return q;
}

// ── the steps ──
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const STEP = {
  nav: (S, st) => S.page.evaluate(PROBE.nav, { view: st.nav, citytour: !!st.citytour }),
  click: (S, st) => S.page.evaluate(PROBE.clickKey, st.click),
  clickText: (S, st) => S.page.evaluate(({ t, within }) => {
    const n = (s) => String(s || '').replace(/\s+/g, ' ').trim();
    const vis = (e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
    const scope = within ? [...document.querySelectorAll(within)].filter(vis) : [document];
    for (const sc of scope.reverse()) { const el = [...sc.querySelectorAll('button, [onclick], a')].filter(vis).find((e) => n(e.innerText || e.value) === t); if (el) { el.click(); return true; } }
    return false;
  }, { t: st.clickText, within: st.within }),
  // a control found by its handler (bkV2 = bookingV2) inside the nearest block whose text has `near`
  clickFn: (S, st) => S.page.evaluate(({ f, near, nth }) => {
    const fn = (e) => { const m = /([A-Za-z_$][\w$.]*)\s*\(/.exec(e.getAttribute('onclick') || ''); return m ? m[1].replace(/^bookingV2/, 'bkV2') : ''; };
    const els = [...document.querySelectorAll('[onclick]')].filter((e) => e.getClientRects().length && fn(e) === f.replace(/^bookingV2/, 'bkV2'));
    const ok = (e) => { if (!near) return true; for (let p = e, i = 0; p && i < 8; p = p.parentElement, i++) if ((p.innerText || '').includes(near)) return true; return false; };
    const el = els.filter(ok)[nth || 0];
    if (!el) return false;
    el.click(); return true;
  }, { f: st.clickFn, near: st.near, nth: st.nth }),
  clickSel: async (S, st) => { const l = S.page.locator(st.clickSel).filter({ visible: true }).first(); await l.click({ timeout: 10000 }); return true; },
  press: async (S, st) => { const l = S.page.locator(st.press).filter({ visible: true }).first(); await l.press(st.key || 'Enter', { timeout: 10000 }); return true; },
  fill: async (S, st) => { const l = S.page.locator(st.fill).filter({ visible: true }).first(); await l.fill(String(st.value), { timeout: 10000 }); await l.dispatchEvent('change'); return true; },
  choose: async (S, st) => {
    const l = S.page.locator(st.choose).filter({ visible: true }).first();
    try { await l.selectOption(String(st.value), { timeout: 10000 }); } catch (_) { await l.selectOption({ label: String(st.value) }, { timeout: 10000 }); }
    return true;
  },
  answer: (S, st) => { S.answers.push(st.answer === false ? { accept: false } : { accept: true, text: typeof st.answer === 'string' ? st.answer : undefined }); return true; },
  call: (S, st) => S.page.evaluate(({ fn, args }) => {
    const f = window[fn] || window[fn.replace(/^bkV2/, 'bookingV2')] || window[fn.replace(/^bookingV2/, 'bkV2')];
    if (typeof f !== 'function') return 'no function ' + fn;
    const r = f(...(args || [])); return r === undefined ? true : (typeof r === 'object' ? true : r);
  }, { fn: st.call, args: st.args }),
  wait: async (S, st) => { await S.page.waitForTimeout(st.wait); return true; },
};
const stepKind = (st) => Object.keys(STEP).find((k) => k in st);
const stepLabel = (st) => st.label || (stepKind(st) + ' ' + JSON.stringify(st[stepKind(st)]) + (st.value != null ? ' = ' + st.value : ''));

async function runStep(H, P, st, R) {
  const sides = [['legacy', P.legacy], ['new', P.neu]];
  P.legacy.reset(); P.neu.reset();
  const r = await Promise.all(sides.map(async ([n, S]) => {
    const s = { ...st, ...(st[n] || {}) };
    // argsFrom: { legacy: sql, ops: sql } · the call's arguments read from that side's database (an id the UI made)
    if (s.argsFrom) { const rows = await R[n === 'legacy' ? 'legacy' : 'ops'](s.argsFrom[n === 'legacy' ? 'legacy' : 'ops']); s.args = rows.length ? Object.values(rows[0]) : ['(not found)']; }
    try { return await STEP[stepKind(s)](S, s); } catch (e) { return 'error: ' + String(e.message || e).split('\n')[0].slice(0, 200); }
  }));
  await Promise.all(sides.map(([, S]) => settle(H, S, st.settle || 500)));
  return r;
}
const message = (side) => [...(side.dialogs || []), ...(side.toast || []).map((t) => 'toast: ' + t), ...(side.modal ? ['dialog: ' + side.modal[0]] : [])];

// ── compare the data: records matched by content ──
const canon = (x) => JSON.stringify(x, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((kk) => [kk, v[kk]])) : v));
function compareData(d) {
  const a = (d.legacy || []).map(canon), b = (d.new || []).map(canon);
  const left = [...b];
  const onlyLegacy = [];
  for (const x of a) { const i = left.indexOf(x); if (i >= 0) left.splice(i, 1); else onlyLegacy.push(x); }
  return { same: !onlyLegacy.length && !left.length, legacy: a.length, new: b.length, onlyLegacy, onlyNew: left };
}

// ── run ──
const files = fs.readdirSync(path.join(HERE, 'scenarios')).filter((f) => f.endsWith('.mjs') && !f.startsWith('_')).sort();
const recordNames = legacyItems(LEGACY_DIR).items.filter((i) => i.type === 'handler').map((i) => i.name);
const results = [];
const seen = { calls: {}, dialogIds: {}, pages: {} };
const today = (() => { const b = new Date(Date.now() + 7 * 3600e3); return b.toISOString().slice(0, 10); })();
const addDays = (d, n) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
for (const f of files) {
  const sc = (await import(pathToFileURL(path.join(HERE, 'scenarios', f)).href)).default;
  if (ONLY && !ONLY.includes(sc.name)) continue;
  const res = { name: sc.name, title: sc.title, file: f, steps: [], data: null, error: null };
  results.push(res);
  const dir = path.join(OUT, sc.name);
  let H;
  try {
    log(`── ${sc.name} · fresh databases …`);
    if (!arg('reuse-dbs', false) && (!arg('one-copy', false) || !results.indexOf(res))) await freshDbs();
    const R = { legacy: await reader(DB.legacy), ops: await reader(DB.ops) };
    const vars = sc.prepare ? await sc.prepare({ ...R, today, addDays }) : {};
    res.vars = vars;
    log(`   vars ${JSON.stringify(vars).slice(0, 300)}`);
    H = await startHarness({ out: dir, legacyDir: LEGACY_DIR, opsDir: OPS_DIR, legacyDb: dbUrl(DB.legacy), opsDb: dbUrl(DB.ops),
      legacyPort: +(process.env.LEGACY_PORT || 3911), opsPort: +(process.env.OPS_PORT || 3912), user: 'uiparity', pass: 'uiparity', log });
    // one fixed clock for both browsers: 10:00 Bangkok of today (run.mjs uses the same start before 07:00)
    const P = await bootPair(H, 1, { recordNames, clock: today + 'T10:00:00+07:00' });
    for (const [i, st] of sc.steps(vars).entries()) {
      const found = await runStep(H, P, st, R);
      const snap = await snapBoth(P, { page: sc.name, toggle: stepLabel(st), kind: 'step', found: { legacy: found[0], new: found[1] } }, { scope: 'modal' });
      const c = compare(snap);
      const mL = message(snap.legacy), mN = message(snap.new);
      const msgSame = canon(mL.map(norm)) === canon(mN.map(norm));
      const ok = found[0] === true || found[0] === 'true';
      const step = { i: i + 1, label: stepLabel(st), found, message: { same: msgSame, legacy: mL, new: mN }, screen: { verdict: c.verdict, why: c.why, missing: c.layMissing.slice(0, 8), extra: c.layExtra.slice(0, 8), failed: c.failed, newErrors: c.newErrors },
        writes: { legacy: snap.legacy.writes, new: snap.new.writes }, legacyRan: ok };
      res.steps.push(step);
      for (const n of snap.legacy.calls || []) seen.calls[n] = seen.calls[n] || sc.name + ' · ' + step.label;
      for (const d of snap.legacy.openIds || []) seen.dialogIds[d] = seen.dialogIds[d] || sc.name + ' · ' + step.label;
      if (st.nav) seen.pages[st.nav + (st.citytour ? '#citytour' : '')] = seen.pages[st.nav] || sc.name;
      log(`   ${i + 1}. ${step.label} · found ${found.map(String).join('/')} · message ${msgSame ? 'same' : 'DIFFERENT'} · screen ${c.verdict}${c.why ? ' (' + c.why + ')' : ''}`);
      if (c.verdict !== 'same') log(`      legacy-only: ${c.layMissing.slice(0, 4).join(' ¦ ').slice(0, 300)}\n      new-only:    ${c.layExtra.slice(0, 4).join(' ¦ ').slice(0, 300)}${c.failed.length ? '\n      failed: ' + c.failed.join(' ¦ ').slice(0, 300) : ''}`);
      if (!msgSame) log(`      legacy: ${mL.join(' ¦ ').slice(0, 300)}\n      new:    ${mN.join(' ¦ ').slice(0, 300)}`);
      if (!ok) log('      ! the step did not run on legacy: the scenario is wrong, not the new side');
    }
    // let both sides finish saving (legacy's whole-state sync, our API calls)
    await Promise.all([P.legacy, P.neu].map((S) => settle(H, S, 3000)));
    res.data = compareData(await sc.data({ ...R, vars }));
    log(`   data ${res.data.same ? 'same' : 'DIFFERENT'} · legacy ${res.data.legacy} records · new ${res.data.new}`);
    if (!res.data.same) log(`      only legacy: ${res.data.onlyLegacy.join('\n                   ').slice(0, 1500)}\n      only new:    ${res.data.onlyNew.join('\n                   ').slice(0, 1500)}`);
    await R.legacy.end(); await R.ops.end();
  } catch (e) { res.error = String(e.stack || e).slice(0, 1500); log(`   ! ${sc.name}: ${res.error}`); }
  if (H) H.cleanup();
  fs.writeFileSync(path.join(OUT, 'scenarios.json'), JSON.stringify(results, null, 1));   // so far, in case the run dies
  await new Promise((r) => setTimeout(r, 1500));
}
if (!arg('keep-dbs', false)) for (const k of ['legacy', 'ops']) await admin(`DROP DATABASE IF EXISTS ${DB[k]} WITH (FORCE)`).catch(() => {});

// ── report ──
const esc = (x) => String(x == null ? '' : x).replace(/\|/g, '\\|').replace(/\n/g, ' ').slice(0, 220);
const sameStep = (s) => s.message.same && s.screen.verdict !== 'differs';
const md = ['# Action scenarios · legacy vs new (check 4)', '', `From \`${path.basename(OUT)}\` · ${results.length} scenarios · each from fresh copies of \`${TPL.legacy}\` / \`${TPL.ops}\`.`, '',
  'Message = native alert/confirm/prompt, toast and the open dialog\'s first line, exactly. Screen = run.mjs compare (`numbers` = same layout, other figures). Data = the records the task changed, matched by content.', '',
  '| scenario | steps same | message differs | screen differs | data | verdict |', '|---|---|---|---|---|---|'];
for (const r of results) {
  const v = r.error ? 'ERROR' : (r.steps.every(sameStep) && r.data && r.data.same ? 'same' : 'different');
  md.push(`| ${r.name} · ${esc(r.title)} | ${r.steps.filter(sameStep).length}/${r.steps.length} | ${r.steps.filter((s) => !s.message.same).length} | ${r.steps.filter((s) => s.screen.verdict === 'differs').length} | ${r.data ? (r.data.same ? 'same' : `different (${r.data.onlyLegacy.length} legacy-only, ${r.data.onlyNew.length} new-only)`) : '–'} | ${v} |`);
}
for (const r of results) {
  md.push('', `## ${r.name} · ${esc(r.title)}`, '');
  if (r.vars) md.push('Case: `' + esc(JSON.stringify(r.vars)) + '`', '');
  if (r.error) md.push('**Error:** `' + esc(r.error) + '`', '');
  md.push('| # | step | ran (legacy / new) | message | screen | evidence |', '|---|---|---|---|---|---|');
  for (const s of r.steps) {
    const ev = [];
    if (!s.message.same) ev.push('legacy: "' + esc(s.message.legacy.join(' ¦ ')).slice(0, 160) + '" · new: "' + esc(s.message.new.join(' ¦ ')).slice(0, 160) + '"');
    if (s.screen.verdict !== 'same') ev.push(esc(s.screen.why) + (s.screen.missing.length ? ' · legacy-only line "' + esc(s.screen.missing[0]).slice(0, 80) + '"' : '') + (s.screen.extra.length ? ' · new-only line "' + esc(s.screen.extra[0]).slice(0, 80) + '"' : '') + (s.screen.failed.length ? ' · ' + esc(s.screen.failed[0]) : ''));
    md.push(`| ${s.i} | ${esc(s.label)} | ${esc(s.found.map(String).join(' / '))} | ${s.message.same ? 'same' : '**different**'} | ${s.screen.verdict} | ${ev.join(' · ') || '–'} |`);
  }
  if (r.data) {
    md.push('', `Data: **${r.data.same ? 'same' : 'different'}** · legacy ${r.data.legacy} records, new ${r.data.new}.`);
    for (const x of r.data.onlyLegacy) md.push('- legacy only: `' + esc(x).slice(0, 400) + '`');
    for (const x of r.data.onlyNew) md.push('- new only: `' + esc(x).slice(0, 400) + '`');
  }
}
fs.writeFileSync(path.join(OUT, 'scenarios.md'), md.join('\n') + '\n');
fs.writeFileSync(path.join(OUT, 'scenarios.json'), JSON.stringify(results, null, 1));
fs.writeFileSync(path.join(OUT, 'seen.json'), JSON.stringify(seen, null, 1));
const bad = results.filter((r) => r.error || !(r.steps.every(sameStep) && r.data && r.data.same));
log(`done · ${results.length} scenarios · ${results.length - bad.length} same · ${bad.length} different · ${path.join(OUT, 'scenarios.md')}`);
process.exit(bad.length ? 1 : 0);
