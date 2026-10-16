// §ptRoutes · Rate Type private transfer survives the SQL round-trip for every route
// 2026-10-16 · "Russian DMC Special Rate Sayama" · private transfer added, gone after refresh:
// only r4/r5/r6/r10/r11/r12 had tables, every other route was dropped by decomposeBlob.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const osRepo = require('../../os-backend/src/mapping/os_repo.js');

const PT = {
  unit: 'per trip',
  r5: { PK: { sedan: 0, van: 3500 }, KL: { sedan: 0, van: 2000 } },          // had a table before
  r8: { PK: { sedan: 1200, van: 2000 } },                                       // did not
  r2: { KL: { sedan: 900, van: 1800 } },                                        // did not
  r1789031919260: { PK: { sedan: 500, van: 800 }, KL: { sedan: 600, van: 900 } }, // a route added later
};
const blob = () => ({ sb_rate_types: [{ id: 'rtX', name: 'Test', routes: ['r5', 'r8', 'r2'],
  addOns: { privateTransfer: JSON.parse(JSON.stringify(PT)),
            longtail: { applies: ['r8'], byRoute: { r8: { join: { adult: 300, child: 300 } } } } } }] });
// DB rows come back without the synthetic undefineds; mimic a real load by dropping undefined values
const viaDb = rows => JSON.parse(JSON.stringify(rows));

test('every private transfer route survives decompose -> assemble', () => {
  const back = osRepo.assembleBlob(viaDb(osRepo.decomposeBlob(blob())));
  const rt = back.sb_rate_types[0];
  assert.deepEqual(rt.addOns.privateTransfer, PT);
  assert.equal('ptRoutes' in rt, false, 'helper field must not leak into the record');
  assert.deepEqual(rt.addOns.longtail.byRoute.r8.join, { adult: 300, child: 300 });
});

test('one row per (rate type, route) · unit is not a route', () => {
  const rows = osRepo.decomposeBlob(blob()).sb_rate_types__ptroutes;
  assert.deepEqual(rows.map(r => r.key).sort(), ['r1789031919260', 'r2', 'r5', 'r8']);
  assert.ok(rows.every(r => r.sb_rate_types_id === 'rtX' && typeof r.value === 'string' && r.row_pk));
});

test('a route removed in the app is gone after the round-trip', () => {
  const b = blob(); delete b.sb_rate_types[0].addOns.privateTransfer.r8;
  const back = osRepo.assembleBlob(viaDb(osRepo.decomposeBlob(b)));
  assert.equal('r8' in back.sb_rate_types[0].addOns.privateTransfer, false);
});

test('rows saved before this table existed (old r* tables only) still load', () => {
  const rows = viaDb(osRepo.decomposeBlob(blob()));
  rows.sb_rate_types__ptroutes = [];
  const pt = osRepo.assembleBlob(rows).sb_rate_types[0].addOns.privateTransfer;
  assert.deepEqual(pt.r5, PT.r5);
  assert.equal(pt.unit, 'per trip');
});

test('the table is wired as a child of sb_rate_types (load + cascade)', () => {
  assert.ok((osRepo._children.sb_rate_types || []).includes('sb_rate_types__ptroutes'));
  assert.equal(osRepo._plan.sb_rate_types__ptroutes.field, 'ptRoutes');
});
