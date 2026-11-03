// §poMvEdit · a pier move's after-the-fact edit stamp survives the SQL round-trip (migration 045 · pier_moves)
// Before 045 there were no columns, so decomposeBlob dropped editBy / editAt and the ledger's
// "แก้ย้อนหลังโดย …" line was gone after a refresh.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const osRepo = require('../../os-backend/src/mapping/os_repo.js');
const MAP = require('../../os-backend/src/mapping/field_mapping.json');
const MODEL = require('../../os-backend/src/mapping/operation_schemas_model.json');

const move = () => ({ id: 'pm_1', date: '2026-11-03', pier: 'panwa', itemId: 'pi_mask', boatId: 'b1', type: 'adjust', qty: -2,
  note: 'counted short', by: 'Pier A', at: '2026-11-03T02:00:00.000Z', editBy: 'Pier B', editAt: '2026-11-03T09:30:00.000Z' });
const viaDb = (rows) => JSON.parse(JSON.stringify(rows));

test('an edited move keeps editBy / editAt through decompose -> assemble', () => {
  const back = osRepo.assembleBlob(viaDb(osRepo.decomposeBlob({ pier_moves: [move()] })));
  assert.deepEqual(back.pier_moves[0], move());
});

test('a move that was never edited grows no stamp', () => {
  const m = { id: 'pm_2', date: '2026-11-03', pier: 'panwa', itemId: 'pi_mask', boatId: 'b1', type: 'issue', qty: 5 };
  const back = osRepo.assembleBlob(viaDb(osRepo.decomposeBlob({ pier_moves: [m] })));
  assert.equal(back.pier_moves[0].editBy, undefined);
  assert.equal(back.pier_moves[0].editAt, undefined);
});

test('mapping, model and migration 045 name the same columns', () => {
  const sql = fs.readFileSync(new URL('../../db/migrations/045_pier_move_edit_stamp.sql', import.meta.url), 'utf8');
  const block = sql.slice(sql.indexOf('ALTER TABLE operation_schemas.pier_moves')).split(';')[0];
  for (const c of ['editby', 'editat']) {
    assert.ok(MAP.pier_moves[c], `pier_moves.${c} is mapped`);
    assert.ok(MODEL.pier_moves.columns.some(x => x.name === c && x.type === MAP.pier_moves[c].db_type), `pier_moves.${c} is in the model`);
    assert.match(block, new RegExp(`ADD COLUMN IF NOT EXISTS ${c}\\s`), `pier_moves.${c} is in the migration`);
  }
});
