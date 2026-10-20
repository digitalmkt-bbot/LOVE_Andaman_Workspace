import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime, plain } from './fe-harness.mjs';

// R2-2: the Inventory Overview tab draws the server's figures (GET /v1/fleet/stock-overview) through legacy's ivoData() shape.
const PRE = `
var IVO_WH = [{k:'VP',loc:'คลัง Visit Panwa',n:'Visit Panwa'},{k:'TL',loc:'คลัง Tub Lamu',n:'Tub Lamu'},{k:'RN',loc:'คลัง Ranong',n:'Ranong'}];
var TODAY_STR = '2030-03-20'; var redraws = 0; function flRenderInventory(){ redraws++; }
var tabs = []; function invSwitchTab(t){ tabs.push(t); }
function ivoData(){ return 'legacy'; } function ivoFixLoc(){ return 'legacy-fix'; }
`;
const wh = (extra = {}) => ({
  lines: 0, with_qty: 0, zero: 0, units: 0, value: 0, below: [], out_of_stock: 0, by_category: { engine: { qty: 0, value: 0 }, gearbox: { qty: 0, value: 0 }, propeller: { qty: 0, value: 0 }, hull: { qty: 0, value: 0 }, general: { qty: 0, value: 0 } },
  received: { qty: 0, value: 0 }, withdrawn: { qty: 0, value: 0 }, top_withdrawn: [], memos_pending: { count: 0, amount: 0 }, ...extra,
});
const ANSWER = {
  from: '2030-02-19', to: '2030-03-20', sort: 'value', bad_loc: 0, no_loc: 0,
  warehouses: {
    panwa: wh({ lines: 3, with_qty: 2, zero: 0, units: 13, value: 130, below: [{ item_id: 'c', name: 'Item c', qty: 0, min: 2 }], out_of_stock: 1,
      by_category: { engine: { qty: 10, value: 100 }, gearbox: { qty: 0, value: 0 }, propeller: { qty: 0, value: 0 }, hull: { qty: 0, value: 0 }, general: { qty: 3, value: 30 } },
      received: { qty: 28, value: 280 }, withdrawn: { qty: 8, value: 80 }, top_withdrawn: [{ item_id: 'c', name: 'Item c', qty: 5, value: 50 }, { item_id: 'a', name: 'Item a', qty: 3, value: 30 }], memos_pending: { count: 2, amount: 101 } }),
    tublamu: wh({ lines: 2, with_qty: 2, units: 3, value: 30 }),
    ranong: wh(),
  },
  ranked: {
    panwa: { rows: [{ item_id: 'a', name: 'Item a', part_no: 'PA-1', category: 'engine', unit: 'pcs', qty: 10, cost: 10, value: 100, warehouses: ['panwa'] }, { item_id: 'b', name: 'Item b', part_no: null, category: 'general', unit: 'pcs', qty: 3, cost: 10, value: 30, warehouses: ['panwa'] }], top10: 130, total: 130 },
    tublamu: { rows: [{ item_id: 'a', name: 'Item a', part_no: 'PA-1', category: 'engine', unit: 'pcs', qty: 2, cost: 10, value: 20, warehouses: ['tublamu'] }], top10: 20, total: 20 },
    ranong: { rows: [], top10: 0, total: 0 },
    all: { rows: [], top10: 0, total: 0 },
  },
};
const H = { 'GET /v1/fleet/stock-overview': { body: ANSWER } };
function rt(handlers = H, enabled = true) {
  const r = runtime({ files: [], pre: PRE, handlers, enabled });
  r.O.activeView = () => 'fl-inventory'; r.O.busy = () => false;
  r.load('99-ops-inv-overview.js');
  return r;
}

test('a miss answers legacy-shaped zeros and asks once; the answer maps to legacy\'s W{VP,TL,RN} and the page is drawn again', async () => {
  const r = rt();
  const first = plain(r.ctx.ivoData());
  assert.deepEqual(Object.keys(first.W), ['VP', 'TL', 'RN']);
  assert.deepEqual([first.W.VP.value, first.W.VP.rows.length, first.badLoc, first.noLoc, first.to], [0, 0, [], 0, '2030-03-20']);
  await r.settle();
  assert.equal(r.ctx.redraws, 1);
  const D = plain(r.ctx.ivoData());
  assert.equal(r.requests.length, 1, 'one ask; the second read is from the cache');
  assert.deepEqual([D.from, D.to, D.badLoc, D.noLoc], ['2030-02-19', '2030-03-20', [], 0]);
  const VP = D.W.VP;
  assert.deepEqual([VP.lines, VP.withQty, VP.zero, VP.units, VP.value, VP.recQ, VP.recV, VP.wdQ, VP.wdV, VP.memoN, VP.memoV], [3, 2, 0, 13, 130, 28, 280, 8, 80, 2, 101]);
  assert.deepEqual(VP.below, [{ id: 'c', name: 'Item c', q: 0, mn: 2 }]);
  assert.deepEqual(VP.cat, { engine: { q: 10, v: 100 }, general: { q: 3, v: 30 } }, 'only the categories that hold stock, as legacy');
  assert.deepEqual(VP.wdTop, { c: { name: 'Item c', q: 5, v: 50 }, a: { name: 'Item a', q: 3, v: 30 } });
  assert.deepEqual(VP.rows[0], { id: 'a', name: 'Item a', partNo: 'PA-1', cat: 'engine', unit: 'pcs', q: 10, cost: 10, v: 100 });
  assert.equal(VP.rows[1].partNo, '');
  assert.deepEqual([D.W.TL.value, D.W.TL.rows.length, D.W.RN.lines], [30, 1, 0], 'TL is tublamu, RN is ranong');
  assert.equal(VP.w.k, 'VP', 'the legacy warehouse record rides along for the card');
});

test('opening the Overview tab asks again; an unchanged answer does not redraw', async () => {
  const r = rt();
  r.ctx.ivoData(); await r.settle();
  assert.equal(r.ctx.redraws, 1);
  r.ctx.invSwitchTab('overview'); r.ctx.ivoData(); await r.settle();
  assert.deepEqual(plain(r.ctx.tabs), ['overview']);
  assert.equal(r.requests.length, 2);
  assert.equal(r.ctx.redraws, 1, 'same answer: no second draw');
  r.ctx.invSwitchTab('stock'); r.ctx.ivoData();
  assert.equal(r.requests.length, 2, 'other tabs use the cache');
});

test('ivoFixLoc never writes: it tells the user the names are standard', () => {
  const r = rt();
  assert.equal(r.ctx.ivoFixLoc(), undefined);
  assert.deepEqual(r.alerts, ['All warehouse names are already standard.']);
  assert.equal(r.requests.length, 0);
});

test('a failed ask shows a toast and keeps empty figures; off ops mode legacy answers', async () => {
  const r = rt({ 'GET /v1/fleet/stock-overview': { status: 500, body: { message: 'boom' } } });
  const D = plain(r.ctx.ivoData()); await r.settle();
  assert.equal(D.W.VP.value, 0);
  assert.ok(r.toasts.length >= 1);
  const off = rt(H, false);
  assert.equal(off.ctx.ivoData(), 'legacy');
  assert.equal(off.ctx.ivoFixLoc(), 'legacy-fix');
  assert.equal(off.requests.length, 0);
});
