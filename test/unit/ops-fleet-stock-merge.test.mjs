// Row 151 · the Inventory duplicate-scan merge (invDupMerge) merged in the browser only: it re-pointed memos/jobs,
// spliced the dropped items out of FL_INVENTORY and called flSave (a no-op in ops mode), so the duplicates came
// back after a reload.  Now POST /v1/fleet/stock-items/:keep/merge {from_ids}, same keep rule as legacy (most history,
// then most stock), then a refetch.
//   node --test test/unit/ops-fleet-stock-merge.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SOURCE = fs.readFileSync(process.env.FLEETSTOCK_SRC || 'allotment_v2/js/ops/25-ops-fleet-stock.js', 'utf8');

function runtime({ enabled = true, confirmAnswer = true, refuse = false } = {}) {
  const posts = [], failures = [], legacy = [], toasts = [], opened = [];
  const dup = (id, history, qty) => ({ id, name: 'Oil Filter', partNo: 'OF-1', unit: 'ชิ้น', history: new Array(history).fill({}), totalQty: qty });
  const FL_INVENTORY = [dup('inv_b', 1, 4), dup('inv_a', 3, 1), dup('inv_c', 1, 9), { id: 'inv_z', name: 'Other', partNo: '', history: [], totalQty: 1 }];
  const O = {
    enabled: () => enabled, today: () => '2026-10-15', onChange() {}, wrote() {},
    get: async () => ({ items: [], memos: [], consumables: [] }),
    post: async (path, body) => { posts.push(path + ' ' + JSON.stringify(body)); if (refuse) { const e = new Error('merge refused'); throw e; } return { id: 'inv_a' }; },
    queue: (fn) => Promise.resolve().then(fn),
    fail: (title, e) => failures.push({ title, message: e && e.message }),
  };
  const window = { laOps: O, invDupMerge: () => { legacy.push('legacy merge'); } };
  const ctx = {
    window, console, Number, String, Object, Array, JSON, Date, Promise, encodeURIComponent, parseFloat, parseInt, Math, decodeURIComponent,
    FL_INVENTORY, FL_MEMOS: [], FL_CONSUMABLE_LOGS: [],
    laGuardEdit: () => true, confirm: () => confirmAnswer,
    _invAll: () => FL_INVENTORY, _invKeyOf: (n, p) => String(n).trim().toLowerCase() + '\u0000' + String(p || '').trim().toLowerCase(),
    invDupOpen: () => opened.push('open'), flShowToast: (t) => toasts.push(t), flRenderInventory() {},
  };
  vm.runInNewContext(SOURCE, ctx);
  return { window, posts, failures, legacy, toasts, opened, key: encodeURIComponent('oil filter\u0000of-1') };
}
const tick = () => new Promise((r) => setImmediate(r));

test('merge keeps the item with the most history, sends the others as from_ids (most stock first), then reopens the scan', async () => {
  const rt = runtime();
  await rt.window.invDupMerge(rt.key);
  assert.deepEqual(rt.posts, ['/v1/fleet/stock-items/inv_a/merge ' + JSON.stringify({ from_ids: ['inv_c', 'inv_b'] })]);
  assert.deepEqual(rt.opened, ['open']);
  assert.equal(rt.failures.length, 0);
  assert.equal(rt.legacy.length, 0);
});

test('declined confirm sends nothing; a refusal is a red toast and the scan is not reopened as if merged', async () => {
  const no = runtime({ confirmAnswer: false });
  await no.window.invDupMerge(no.key);
  assert.deepEqual(no.posts, []);
  const bad = runtime({ refuse: true });
  await bad.window.invDupMerge(bad.key);
  assert.equal(bad.failures.length, 1);
  assert.deepEqual(bad.opened, []);
});

test('fewer than two matches just reopens the scan, no request', async () => {
  const rt = runtime();
  await rt.window.invDupMerge(encodeURIComponent('other\u0000'));
  assert.deepEqual(rt.posts, []);
  assert.deepEqual(rt.opened, ['open']);
});

test('legacy mode: the original merge, zero requests', async () => {
  const rt = runtime({ enabled: false });
  await rt.window.invDupMerge(rt.key); await tick();
  assert.deepEqual(rt.posts, []);
  assert.deepEqual(rt.legacy, ['legacy merge']);
});
