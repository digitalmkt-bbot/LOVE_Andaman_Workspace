// §flnWd · Fleet Work › Add work: the parts picked in the form are withdrawn onto the job the server made (O.fleetStock.withdrawForJob).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runtime, plain } from './fe-harness.mjs';

// the harness runs setTimeout at once; the boot queue's 20 s fallback (which would load the memos) must not fire here
const G = { FL_INVENTORY: [], FL_MEMOS: [], FL_CONSUMABLE_LOGS: [], setTimeout: () => 0, clearTimeout: () => {} };
const item = (id, qty) => ({ id, name: id, part_no: '', unit: 'pc', cost: 10, total_qty: qty, primary_warehouse: 'tublamu', stocks: [{ warehouse: 'tublamu', qty }], movements: [] });

test('each picked part is one POST …/jobs/{id}/parts; a refused one is named, the others still go', async () => {
  const { O, requests, settle } = runtime({
    files: ['25-ops-fleet-stock.js'],
    globals: G,
    handlers: {
      'POST /v1/fleet/jobs/mj1/parts': (body) => (body.item_id === 'inv_short'
        ? { status: 409, body: { statusCode: 409, code: 'insufficient_stock', message: 'Only 1 left at tublamu' } }
        : { body: { item: item(body.item_id, 5) } }),
    },
  });
  const W = await O.fleetStock.withdrawForJob('mj1', [
    { invId: 'inv_oil', name: 'Engine oil', loc: 'คลัง Tub Lamu', qty: 2 },
    { invId: 'inv_short', name: 'Fuel filter', loc: 'คลัง Tub Lamu', qty: 3 },
    { invId: 'inv_belt', name: 'V-belt', loc: 'คลัง Visit Panwa', qty: 1 },
  ]);
  await settle();
  assert.deepEqual(plain(W), { ok: 2, bad: ['Fuel filter'] });
  assert.deepEqual(requests.map((r) => [r.method, r.path, r.body]), [
    ['POST', '/v1/fleet/jobs/mj1/parts', { item_id: 'inv_oil', warehouse: 'tublamu', qty: 2 }],
    ['POST', '/v1/fleet/jobs/mj1/parts', { item_id: 'inv_short', warehouse: 'tublamu', qty: 3 }],
    ['POST', '/v1/fleet/jobs/mj1/parts', { item_id: 'inv_belt', warehouse: 'panwa', qty: 1 }],
  ], 'one at a time, in the order picked, warehouses as the server names them');
});

test('no parts picked: nothing is sent', async () => {
  const { O, requests } = runtime({ files: ['25-ops-fleet-stock.js'], globals: G });
  assert.deepEqual(plain(await O.fleetStock.withdrawForJob('mj1', [])), { ok: 0, bad: [] });
  assert.equal(requests.length, 0);
});
