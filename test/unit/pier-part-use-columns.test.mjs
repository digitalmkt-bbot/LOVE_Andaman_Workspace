// §poRpPier · a mask repair's links survive the SQL round-trip (migration 044 · pier_moves + fleet_consumable_logs)
// Before 044 there were no columns, so decomposeBlob dropped them: after a refresh the move lost its boat and cost, and
// flConsumeDelete no longer saw src 'pier_fix', so deleting the consumable never returned the parts to pier stock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const osRepo = require('../../os-backend/src/mapping/os_repo.js');
const MAP = require('../../os-backend/src/mapping/field_mapping.json');
const MODEL = require('../../os-backend/src/mapping/operation_schemas_model.json');

const move = () => ({ id: 'pm_1', date: '2026-11-03', pier: 'panwa', itemId: 'pi_strap', type: 'part_use', qty: 2, note: 'B1 · repair',
  by: 'Pier A', at: '2026-11-03T02:00:00.000Z', forBoat: 'b1', fixItem: 'pi_mask', fixQty: 3, unitCost: 12.5, cost: 25, consumeId: 'cons_1' });
const log = () => ({ id: 'cons_1', date: '2026-11-03', itemId: 'pi_strap', itemName: 'Strap', unit: 'pc', qty: 2, unitCost: 12.5, cost: 25,
  location: 'pier stock', boatId: 'b1', engineId: '', engineLabel: '', by: 'Pier A', note: 'repair',
  src: 'pier_fix', pier: 'panwa', poItemId: 'pi_mask', fixQty: 3, pierMoveId: 'pm_1' });
const viaDb = (rows) => JSON.parse(JSON.stringify(rows));

test('a part_use move and its consumable keep their links through decompose -> assemble', () => {
  const back = osRepo.assembleBlob(viaDb(osRepo.decomposeBlob({ pier_moves: [move()], fleet_consumable_logs: [log()] })));
  assert.deepEqual(back.pier_moves[0], move());
  assert.deepEqual(back.fleet_consumable_logs[0], log());
});

test('zero cost and no boat stay what they were', () => {
  const m = { ...move(), forBoat: '', unitCost: 0, cost: 0 };
  const back = osRepo.assembleBlob(viaDb(osRepo.decomposeBlob({ pier_moves: [m] })));
  assert.equal(back.pier_moves[0].forBoat, '');
  assert.equal(back.pier_moves[0].cost, 0, 'a known zero must not fall back to the current Fleet price');
});

test('an ordinary move and an ordinary consumable grow no new keys', () => {
  const m = { id: 'pm_2', date: '2026-11-03', pier: 'panwa', itemId: 'pi_mask', boatId: 'b1', type: 'issue', qty: 5 };
  const l = { id: 'cons_2', date: '2026-11-03', itemId: 'inv_1', qty: 1, boatId: 'b1' };
  const back = osRepo.assembleBlob(viaDb(osRepo.decomposeBlob({ pier_moves: [m], fleet_consumable_logs: [l] })));
  assert.equal(back.pier_moves[0].forBoat, undefined);
  assert.equal(back.fleet_consumable_logs[0].src, undefined);
});

test('mapping, model and migration 044 name the same columns', () => {
  const sql = fs.readFileSync(new URL('../../db/migrations/044_pier_part_use_links.sql', import.meta.url), 'utf8');
  const want = { pier_moves: ['forboat', 'fixitem', 'fixqty', 'unitcost', 'cost', 'consumeid'],
    fleet_consumable_logs: ['src', 'pier', 'poitemid', 'fixqty', 'piermoveid'] };
  for (const [table, cols] of Object.entries(want)) {
    const block = sql.slice(sql.indexOf(`ALTER TABLE operation_schemas.${table}`)).split(';')[0];
    for (const c of cols) {
      assert.ok(MAP[table][c], `${table}.${c} is mapped`);
      assert.ok(MODEL[table].columns.some(x => x.name === c && x.type === MAP[table][c].db_type), `${table}.${c} is in the model`);
      assert.match(block, new RegExp(`ADD COLUMN IF NOT EXISTS ${c}\\s`), `${table}.${c} is in the migration`);
    }
  }
});
