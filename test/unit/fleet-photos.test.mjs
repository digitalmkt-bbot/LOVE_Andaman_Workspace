// §flPhoto · photos[] on maintenance jobs and problem reports survive the SQL round-trip
// 2026-10-18 · Fleet Work "add photo" · refs only (file lives in attachments) · hidden flag kept
import { test as nodeTest } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
// os-backend lives on lk-inbox only, so on main these tests skip instead of failing
const HAS_OS = fs.existsSync(new URL('../../os-backend/src/mapping/os_repo.js', import.meta.url));
const osRepo = HAS_OS ? require('../../os-backend/src/mapping/os_repo.js') : null;
const test = HAS_OS ? nodeTest : nodeTest.skip;

const PH = [
  { id: 'ph_1', attId: 'att1', url: '/api/attach/att1', mime: 'image/jpeg', size: 1234, name: 'a.jpg', cap: 'ถอดเกียร์แล้ว', stage: 'Repairing', addedAt: '2026-10-18T10:00:00.000Z', by: 'Pae' },
  { id: 'ph_2', attId: '', url: 'https://drive.example/x.jpg', mime: '', size: 0, name: 'link', cap: '', stage: 'Done', addedAt: '2026-10-18T11:00:00.000Z', by: 'Pae',
    removed: true, removedBy: 'Pae', removedAt: '2026-10-18T12:00:00.000Z' },
];
const blob = () => ({
  fleet_maintenance: [{ id: 'mjX', no: 'MJ-900', boatId: 'b1', title: 'test', status: 'done', endDate: '2026-10-09', photos: JSON.parse(JSON.stringify(PH)),
                        progressLog: [{ date: '2026-10-18', text: 'Photo added · 1 file', by: 'Pae' }] }],
  fleet_incidents:   [{ id: 'incX', no: 'INC-900', boatId: 'b1', title: 'test', status: 'open', photos: JSON.parse(JSON.stringify(PH)) }],
});
const viaDb = rows => JSON.parse(JSON.stringify(rows));

test('maintenance job photos[] survive decompose -> assemble', () => {
  const back = osRepo.assembleBlob(viaDb(osRepo.decomposeBlob(blob())));
  assert.deepEqual(back.fleet_maintenance[0].photos, PH);
  assert.equal(back.fleet_maintenance[0].progressLog[0].text, 'Photo added · 1 file');
});
test('incident photos[] survive decompose -> assemble', () => {
  const back = osRepo.assembleBlob(viaDb(osRepo.decomposeBlob(blob())));
  assert.deepEqual(back.fleet_incidents[0].photos, PH);
});
test('photos land in one json_text column, not a child table', () => {
  const rows = osRepo.decomposeBlob(blob());
  assert.equal(typeof rows.fleet_maintenance[0].photos, 'string');
  assert.equal(rows.fleet_maintenance__photos, undefined);
  assert.equal(JSON.parse(rows.fleet_incidents[0].photos).length, 2);
});
