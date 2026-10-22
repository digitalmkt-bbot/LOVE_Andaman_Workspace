// §flBat · fleet_batteries rows survive the SQL round-trip · photos[] and log[] as json_text
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const osRepo = require('../../os-backend/src/mapping/os_repo.js');

const B = { id: 'bat1', boatId: 'b2', pos: 'Port', brand: '3K', model: 'N150', cap: '150Ah', volt: '12V', serial: 'ART-BT-P-01', cost: 4900, supplier: 'ร้านแบต',
  status: 'installed', installDate: '2026-10-22', buyDate: '2026-10-20', lifeMonths: 18, warrantyMonths: 12, spareLocation: '', memoNo: 'MO-231', replacedId: 'bat0', replacedById: '',
  retiredDate: '', retiredReason: '', note: '', photos: [{ id: 'ph_1', attId: 'att1', url: '/api/attach/att1', mime: 'image/jpeg', size: 10, name: 'a.jpg', cap: 'ป้ายซีเรียล', stage: 'Battery', addedAt: '2026-10-22T01:00:00.000Z', by: 'RM', kind: 'photo' }],
  log: [{ date: '2026-10-22', type: 'install', desc: 'ติดตั้ง Artemis Port', by: 'RM' }, { date: '2026-10-22', type: 'volt', volt: 12.6, desc: 'วัดโวลต์ 12.6V', by: 'RM' }] };
const viaDb = rows => JSON.parse(JSON.stringify(rows));

test('fleet_batteries survives decompose -> assemble', () => {
  const back = osRepo.assembleBlob(viaDb(osRepo.decomposeBlob({ fleet_batteries: [JSON.parse(JSON.stringify(B))] })));
  assert.deepEqual(back.fleet_batteries[0], B);
});
test('photos and log are json_text columns, no child tables', () => {
  const rows = osRepo.decomposeBlob({ fleet_batteries: [JSON.parse(JSON.stringify(B))] });
  assert.equal(typeof rows.fleet_batteries[0].photos, 'string');
  assert.equal(typeof rows.fleet_batteries[0].log, 'string');
  assert.equal(rows.fleet_batteries__log, undefined);
  assert.equal(rows.fleet_batteries[0].installdate, '2026-10-22');
  assert.equal(rows.fleet_batteries[0].lifemonths, 18);
});
