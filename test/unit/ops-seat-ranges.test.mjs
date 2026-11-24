import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// §opsCapHist: a boat's seat ranges (legacy boats[].capHist) ⇄ /v1/boats/{id}/seat-ranges (ops/23-ops-seat-ranges.js).
const CORE = fs.readFileSync('allotment_v2/js/ops/00-ops-core.js', 'utf8');
const SOURCE = fs.readFileSync('allotment_v2/js/ops/23-ops-seat-ranges.js', 'utf8');
const plain = (x) => JSON.parse(JSON.stringify(x === undefined ? null : x));
const srv = (id, from, to, cap, extra = {}) => ({ id, boat_id: 'b10', from_date: from, to_date: to, capacity: cap, reason: null, note: null, set_by: 'ops', set_at: '2026-11-14T09:23:20.047Z', ...extra });

function runtime({ handlers = {}, confirm = () => true, ranges = [srv('sr_1', '2026-11-15', '2027-05-15', 57)] } = {}) {
  const requests = [];
  const boats = [{ id: 'b10', name: 'Lucky', cap: 50, licensePax: 60 }, { id: 'b11', name: 'Other', cap: 30 }];
  const ctx = {
    console, Promise, Error, JSON, Object, Array, Set, Number, String, Math, Date,
    LA_LEGACY_UNAVAILABLE: true, sessionStorage: { getItem: () => 'tok' },
    BOATS: boats, getBoat: (id) => boats.find((b) => b.id === id),
    alert: () => {}, confirm: (...a) => confirm(...a),
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], body: { appendChild() {} },
      createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, appendChild() {}, setAttribute() {}, remove() {}, addEventListener() {} }) },
    setTimeout: (fn) => { fn(); return 1; }, clearTimeout: () => {},
  };
  ctx.window = ctx;
  const all = { 'GET /v1/seat-ranges': { body: { ranges } }, 'GET /v1/boats/b10/seat-ranges': { body: { ranges } }, ...handlers };
  ctx.laOpsFetch = async (path, opts) => {
    const body = opts.body === undefined ? undefined : JSON.parse(opts.body);
    requests.push({ method: opts.method, path, body });
    const h = all[opts.method + ' ' + path.split('?')[0]];
    if (h === undefined) throw new Error('unexpected request ' + opts.method + ' ' + path);
    const r = typeof h === 'function' ? await h(body, path) : h;
    const status = r && r.status ? r.status : 200;
    const out = r && 'body' in r ? r.body : null;
    return { status, ok: status >= 200 && status < 300, text: async () => (out == null ? '' : JSON.stringify(out)) };
  };
  vm.createContext(ctx);
  // legacy's seat window and charter form (07-charter.js), reduced to what they write
  vm.runInContext(`
    var _chCapDraft = null, _chCapBoatId = '';
    function chCapApply(b){ if(!_chCapDraft || !b || b.id !== _chCapBoatId) return; b.capHist = _chCapDraft.slice(); _chCapDraft = null; }
    function capMgrSave(){ var b = getBoat(_chCapBoatId); b.cap = __base; chCapApply(b); _chCapBoatId = ''; }
  `, ctx);
  vm.runInContext(CORE, ctx);
  ctx.laOps.catalogue = { load: () => Promise.resolve() };
  vm.runInContext(SOURCE, ctx);
  const settle = async () => { for (let i = 0; i < 40; i++) await new Promise((r) => setImmediate(r)); };
  const writes = () => requests.filter((r) => r.method !== 'GET').map((r) => [r.method, r.path, r.body]);
  return { ctx, requests, writes, settle, O: ctx.laOps, boats };
}

test('the boot fills every boat\'s capHist in legacy\'s shape', async () => {
  const rt = runtime();
  await rt.O.catalogue.load(); await rt.settle();
  assert.deepEqual(plain(rt.boats[0].capHist), [{ id: 'sr_1', from: '2026-11-15', to: '2027-05-15', cap: 57, reason: '', note: '', by: 'ops', at: '2026-11-14T09:23:20.047Z' }]);
  assert.deepEqual(plain(rt.boats[1].capHist), []);
});

test('the seat window sends the boat\'s own seats first, then each range it added, changed or removed', async () => {
  const handlers = {
    'PATCH /v1/boats/b10': (b) => ({ body: { id: 'b10', capacity: b.capacity, license_pax: 60 } }),
    'DELETE /v1/boats/b10/seat-ranges/sr_1': { body: { deleted: 'sr_1' } },
    'POST /v1/boats/b10/seat-ranges': { status: 201, body: { range: srv('sr_2', '2027-01-01', null, 55) } },
  };
  const rt = runtime({ handlers });
  await rt.O.catalogue.load(); await rt.settle();
  rt.ctx.__base = 48;
  rt.ctx._chCapBoatId = 'b10';
  rt.ctx._chCapDraft = [{ id: 'ch_new', from: '2027-01-01', to: '', cap: 55, reason: 'refit', note: '' }];
  rt.ctx.capMgrSave(); await rt.settle();
  assert.deepEqual(plain(rt.writes()), [
    ['PATCH', '/v1/boats/b10', { capacity: 48, license_pax: 60 }],
    ['DELETE', '/v1/boats/b10/seat-ranges/sr_1', null],
    ['POST', '/v1/boats/b10/seat-ranges', { from_date: '2027-01-01', to_date: null, capacity: 55, reason: 'refit', note: null }],
  ].map(([m, p, b]) => (b === null ? [m, p, undefined] : [m, p, b])).map(plain));
});

test('a range that oversells a day asks first (409 seats_sold → capacity_anyway); an unchanged range sends nothing', async () => {
  const sent = [];
  const handlers = {
    'PATCH /v1/boats/b10/seat-ranges/sr_1': (b) => {
      sent.push(b);
      if (!b.capacity_anyway) return { status: 409, body: { code: 'seats_sold', message: 'Lucky would carry more passengers than its seats on 1 day(s): 2026-12-01 (r1: 1 booking(s), 25 pax, 20 seats). Send capacity_anyway: true to go ahead' } };
      return { body: { range: srv('sr_1', '2026-11-15', '2027-05-15', 20) } };
    },
  };
  const asked = [];
  const rt = runtime({ handlers, confirm: (q) => { asked.push(q); return true; } });
  await rt.O.catalogue.load(); await rt.settle();
  rt.ctx._chCapBoatId = 'b10';
  rt.ctx._chCapDraft = [{ ...plain(rt.boats[0].capHist[0]), cap: 20 }];
  rt.ctx.chCapApply(rt.boats[0]); await rt.settle();
  assert.equal(sent.length, 2);
  assert.equal(sent[1].capacity_anyway, true);
  assert.match(asked[0], /25 pax, 20 seats\)\n\nบันทึกที่นั่งนี้ต่อ\?/);
  const before = rt.writes().length;
  rt.ctx._chCapBoatId = 'b10';
  rt.ctx._chCapDraft = plain(rt.boats[0].capHist);
  rt.ctx.chCapApply(rt.boats[0]); await rt.settle();
  assert.equal(rt.writes().length, before, 'nothing changed, nothing sent');
});
