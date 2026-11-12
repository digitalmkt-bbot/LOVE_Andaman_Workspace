import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Sync 11-12 gaps, adapter side.
// 1. §bopSwap / §swRelease: the swap form's "fixing from tomorrow" checkbox goes to the server as fixing_from_next_day,
//    and the broken boat is read again after a record or an undo (ops/20). The release on job close is server-only.
// 2. §rnRateCol: importer only, nothing here.
// 3. §flAud: flAudGet answers the server's fl_audit (ops/61's cache), flAudMark sends nothing and reads it again (ops/99-boat-audit).
// 4. §posSales: ctRead / ctWrite('pos_sales_YYYYMM') are the server's days (ops/99-pos-sales).
const tick = () => new Promise((r) => setTimeout(r, 0));

function core(extra = {}) {
  const calls = [];
  const O = {
    enabled: () => true, today: () => '2026-11-12', shift: (d) => d, wrote: () => {}, fail: (t, e) => { calls.push(['fail', t, e && e.message]); },
    clone: (v) => (v == null ? v : JSON.parse(JSON.stringify(v))),
    get: (p, q) => { calls.push(['GET', p, q]); return Promise.resolve(extra.answer ? extra.answer(p, q) : {}); },
    call: (m, p, b) => { calls.push([m, p, b]); return Promise.resolve(extra.answer ? extra.answer(p, b, m) : {}); },
    del: (p) => { calls.push(['DELETE', p]); return Promise.resolve(null); },
    queue: (fn) => Promise.resolve().then(fn),
    onWrite: (fn) => { O._onWrite = fn; },
    ...extra.O,
  };
  return { O, calls };
}

test('§bopSwap: the checkbox goes as fixing_from_next_day, read before legacy closes the form; the broken boat is read again', async () => {
  const src = fs.readFileSync('allotment_v2/js/ops/20-ops-deployments.js', 'utf8');
  const start = src.indexOf('  function swapPath('), end = src.indexOf('  O.deployments = {');
  assert.ok(start > 0 && end > start);
  const { O, calls } = core();
  const refetched = [];
  O.fleetBoats = { refetchBoat: (id) => { refetched.push(id); return Promise.resolve({}); } };
  const TRIPS = { '2026-11-12': { A: { route: 'r1' } } };
  let checked = true;
  const window = {
    _bop2Sw: { d: '2026-11-12', from: 'A' },
    bop2SwapSave() { checked = false; TRIPS['2026-11-12'].A.swap = { id: 'sw1', to: 'B', cause: 'engine', logId: 'sl-local' }; },
    bop2SwapUndo(d, f) { delete TRIPS[d][f].swap; },
  };
  const ctx = {
    window, O, ready: true, swapBusy: {}, synced: {}, snapTrips: null,
    trips: () => TRIPS, key: (d, b) => d + '|' + b, cellOf: (r) => ({ route: r.route_id }), capFor: () => 20,
    snapshot() {}, rerender() {}, schedule() {}, bop2SwClose() {},
    document: { getElementById: (id) => (id === 'bop2sw-st' ? { checked } : null) },
    console, JSON, Object, Promise, encodeURIComponent,
  };
  vm.runInNewContext(src.slice(start, end), ctx);
  window.bop2SwapSave();
  await tick(); await tick();
  const put = calls.find((c) => c[0] === 'PUT');
  assert.ok(put, 'sent');
  assert.equal(put[1], '/operations/deployments/2026-11-12/A/mid-trip-swap');
  assert.equal(put[2].fixing_from_next_day, true, 'the checkbox as it was before the form closed');
  assert.equal(put[2].to_boat_id, 'B');
  assert.deepEqual(refetched, ['A']);
  window.bop2SwapUndo('2026-11-12', 'A');
  await tick(); await tick();
  assert.ok(calls.some((c) => c[0] === 'DELETE' && c[1] === '/operations/deployments/2026-11-12/A/mid-trip-swap'));
  assert.deepEqual(refetched, ['A', 'A'], 'read again after the undo too (the server removed the row)');
});

function loadAudit(entry) {
  const src = fs.readFileSync('allotment_v2/js/ops/99-ops-boat-audit.js', 'utf8');
  const { O, calls } = core({ answer: (p) => (p === '/v1/config/fl_audit' ? { key: 'fl_audit', value: { b1: { cb: 'Nok', ca: '2026-11-11T01:00:00Z', ub: 'Ton', ua: '2026-11-11T02:00:00Z' } }, version: 3 } : {}) });
  let redrawn = 0;
  O.configStore = { active: () => true, loaded: () => true, ents: entry === undefined ? {} : { fl_audit: { value: entry, version: 1 } }, redraw: () => { redrawn++; } };
  let legacyMarks = 0;
  const window = { laOps: O, flAudGet: () => ({ local: { cb: 'browser' } }), flAudMark: () => { legacyMarks++; } };
  vm.runInNewContext(src, { window, console, setTimeout, clearTimeout, JSON, Object, Array, String, Promise });
  return { window, O, calls, marks: () => legacyMarks, redrawn: () => redrawn };
}

test('§flAud: flAudGet is the server\'s fl_audit, not the browser blob; nothing saved yet reads as {}', () => {
  const a = loadAudit({ b1: { cb: 'Nok', ca: '2026-11-11T01:00:00Z' } });
  assert.deepEqual(JSON.parse(JSON.stringify(a.window.flAudGet())), { b1: { cb: 'Nok', ca: '2026-11-11T01:00:00Z' } });
  assert.deepEqual(JSON.parse(JSON.stringify(loadAudit(undefined).window.flAudGet())), {});
});

test('§flAud: flAudMark writes no blob; a boat write reads fl_audit again and draws the screen', async () => {
  const a = loadAudit({});
  a.window.flAudMark(['b1'], 'u');
  assert.equal(a.marks(), 0, 'legacy\'s blob write does not run');
  a.O._onWrite('boat-status-log');
  await new Promise((r) => setTimeout(r, 450));
  await tick(); await tick();
  assert.equal(a.calls.filter((c) => c[0] === 'GET' && c[1] === '/v1/config/fl_audit').length, 1, 'one read for the burst');
  assert.equal(JSON.parse(JSON.stringify(a.window.flAudGet())).b1.ub, 'Ton');
  assert.ok(a.redrawn() >= 1);
  a.O._onWrite('booking');
  await new Promise((r) => setTimeout(r, 450));
  assert.equal(a.calls.filter((c) => c[1] === '/v1/config/fl_audit').length, 1, 'other writes do not read it');
});

function loadPos(server = {}) {
  const src = fs.readFileSync('allotment_v2/js/ops/99-ops-pos-sales.js', 'utf8');
  const { O, calls } = core({
    answer: (p, q, m) => {
      if (p === '/v1/pier-office/pos-sales') return server[q.pier + '|' + (q.month || 'all')] ?? { days: [] };
      if (m === 'PUT') return server.put ? server.put(p, q) : { day: { pier: p.split('/')[4], date: p.split('/')[5], file_name: q.file_name, uploaded_at: '2026-11-12T03:00:00.000Z', uploaded_by: 'pier.panwa', items: q.items } };
      return {};
    },
  });
  O.deployments = { ensureDays: (d) => { calls.push(['ensureDays', d]); } };
  let drawn = 0;
  const blob = { pos_sales_202611: { 'panwa|2026-11-01': { local: true } } };
  const window = {
    laOps: O, LA_ME: { username: 'pier.panwa' }, _psl: { pier: 'panwa', date: '2026-11-12', tab: 'day', mon: '' },
    ctRead: (k) => blob[k] ?? null, ctWrite: (k, v) => { blob[k] = v; },
    laBlob: () => blob,
    renderPosSales: () => { drawn++; },
    pslAnData: (pier, mon) => Object.keys(window.laBlob()).filter((k) => /^pos_sales_\d{6}$/.test(k)).map((k) => [k, window.ctRead(k)]),
  };
  const document = { querySelector: () => null };
  vm.runInNewContext(src, { window, document, console, JSON, Object, Array, String, Date, Promise, encodeURIComponent, setTimeout });
  return { window, calls, blob, drawn: () => drawn };
}

test('§posSales read: ctRead(pos_sales_YYYYMM) is both piers\' server days for that month, drawn again when they land; other keys are legacy\'s', async () => {
  const day = { pier: 'tublamu', date: '2026-11-11', file_name: 'GPOS.xlsx', uploaded_at: '2026-11-11T09:00:00.000Z', uploaded_by: 'Pier TL', items: [{ n: 'Water', q: 3, net: 60, pf: 20, a: { b4: { q: 2, nat: 'CN' } } }] };
  const p = loadPos({ 'tublamu|2026-11': { days: [day] } });
  assert.deepEqual(JSON.parse(JSON.stringify(p.window.ctRead('pos_sales_202611'))), {}, 'nothing yet: not the browser blob');
  await tick(); await tick(); await tick();
  assert.deepEqual(p.calls.filter((c) => c[0] === 'GET').map((c) => [c[2].pier, c[2].month]), [['panwa', '2026-11'], ['tublamu', '2026-11']]);
  assert.deepEqual(JSON.parse(JSON.stringify(p.window.ctRead('pos_sales_202611'))), { 'tublamu|2026-11-11': { f: 'GPOS.xlsx', at: '2026-11-11T09:00:00.000Z', by: 'Pier TL', items: day.items } });
  assert.ok(p.drawn() >= 1);
  assert.equal(p.window.ctRead('guides'), null, 'another key goes to legacy\'s ctRead (ops/61 serves it)');
});

test('§posSales write: only the changed day is sent (PUT), a removed day is DELETE; the cache takes the edit at once', async () => {
  const p = loadPos();
  p.window.ctRead('pos_sales_202611');
  await tick(); await tick(); await tick();
  const rec = { f: 'pos.xlsx', at: '2026-11-12T10:00:00.000Z', by: 'me', items: [{ n: 'Hat', q: 2, net: 500, pf: 200, a: { b1: { q: 1, nat: '' } } }] };
  p.window.ctWrite('pos_sales_202611', { 'panwa|2026-11-12': rec });
  assert.deepEqual(JSON.parse(JSON.stringify(p.window.ctRead('pos_sales_202611')))['panwa|2026-11-12'], rec, 'legacy draws right after: it sees its edit');
  await tick(); await tick(); await tick();
  const puts = p.calls.filter((c) => c[0] === 'PUT');
  assert.equal(puts.length, 1);
  assert.equal(puts[0][1], '/v1/pier-office/pos-sales/panwa/2026-11-12');
  assert.deepEqual(JSON.parse(JSON.stringify(puts[0][2])), { file_name: 'pos.xlsx', uploaded_at: '2026-11-12T10:00:00.000Z', items: rec.items });
  assert.equal(p.window.ctRead('pos_sales_202611')['panwa|2026-11-12'].at, '2026-11-12T03:00:00.000Z', 'the server\'s upload stamp');
  assert.equal(p.blob.pos_sales_202611['panwa|2026-11-01'].local, true, 'the browser blob is not written');
  p.window.ctWrite('pos_sales_202611', {});
  await tick(); await tick(); await tick();
  assert.ok(p.calls.some((c) => c[0] === 'DELETE' && c[1] === '/v1/pier-office/pos-sales/panwa/2026-11-12'));
});

test('§posSales analysis: pslAnData sees the months read here, not the blob\'s; the day view asks for that day\'s boat plan', async () => {
  const p = loadPos({ 'panwa|2026-10': { days: [{ pier: 'panwa', date: '2026-10-03', items: [{ n: 'A', q: 1, net: 1, pf: 0 }] }] } });
  p.window.ctRead('pos_sales_202610');
  await tick(); await tick(); await tick();
  const out = p.window.pslAnData('panwa', '2026-10');
  assert.deepEqual(out.map((x) => x[0]), ['pos_sales_202610']);
  assert.ok(out[0][1]['panwa|2026-10-03']);
  assert.equal(typeof p.window.laBlob, 'function');
  assert.ok(p.window.laBlob().pos_sales_202611, 'laBlob is legacy\'s again afterwards');
  p.window.renderPosSales('panwa');
  assert.ok(p.calls.some((c) => c[0] === 'ensureDays' && c[1][0] === '2026-11-12'));
});
