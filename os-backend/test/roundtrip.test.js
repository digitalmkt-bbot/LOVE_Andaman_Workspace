// Synthetic round-trip test (no DB). Validates every shape the engine handles:
// top-level array, nested object (companyInfo), child array (trips w/ pax un-flatten),
// child array (addOns, history), grandchild array-of-scalars (repairHistory.assets),
// top-level keyed map w/ object value (fleet_daily.b2), top-level scalar-value map (_app_hooks),
// and top-level scalars (app_meta: version, data_version).
//
// Run: node --test
const test = require('node:test');
const assert = require('node:assert');
const { assembleBlob, decomposeBlob, _plan } = require('../src/mapping/os_repo.js');

function defaultBlob() {
  const b = {};
  for (const t of Object.keys(_plan)) {
    const p = _plan[t];
    if (p.isChild) continue;
    if (p.container === 'array') b[p.appKey] = [];
    else if (p.container === 'map') b[p.appKey] = {};
  }
  return b;
}

function sampleBlob() {
  const b = defaultBlob();
  b.sb_agents = [{
    id: 'a01', code: 'BIB', name: 'Biblio Globus', market: 'ru',
    companyInfo: { legalName: 'Biblio Globus LLC', address: 'Moscow', tatLicense: '31/00986' }
  }];
  b.sb_bookings = [{
    id: 'BK-260701-XY', schemaVer: 2, leadPax: 'John Smith', createdBy: 'IRIS', voucherRef: 'EXC1',
    trips: [
      { routeId: 'r5', date: '2026-07-01', zone: 'PK', pax: { ad_fr: 2, chd_fr: 1, ad_th: 0 } },
      { routeId: 'r10', date: '2026-07-03', zone: 'KL', pax: { ad_fr: 0, ad_th: 4 } }
    ],
    addOns: [{ type: 'longtail-join', qty: 2, amount: 1300 }],
    history: [{ at: '2026-07-01T02:00:00.000Z', tag: 'Created', by: 'IRIS' }]
  }];
  b.boats = [{
    id: 'b15', name: 'Rolanda', type: 'Speedboat',
    repairHistory: [{ date: '2026-06-01', jobNo: 'MJ-1', title: 'oil change', assets: ['e1', 'e2'] }]
  }];
  b.fleet_daily = { '2026-07-01': { b2: { fuel: 120, paxActual: 30 } } };
  b._app_hooks = { someFlag: true, other: false };
  b.version = '2026o';
  b.data_version = 'x1';
  return b;
}

test('blob -> tables -> blob is lossless for core shapes', () => {
  const blob = sampleBlob();
  const tables = decomposeBlob(blob);
  const back = assembleBlob(tables);
  assert.deepStrictEqual(back, blob);
});

test('tables -> blob -> tables preserves row counts (nested)', () => {
  const blob = sampleBlob();
  const t1 = decomposeBlob(blob);
  const t2 = decomposeBlob(assembleBlob(t1));
  const count = (t, k) => (t[k] || []).length;
  for (const k of ['sb_bookings', 'sb_bookings__trips', 'sb_bookings__addons', 'sb_bookings__history',
    'boats', 'boats__repairhistory', 'boats__repairhistory__assets', 'sb_agents', 'fleet_daily']) {
    assert.strictEqual(count(t2, k), count(t1, k), 'row count mismatch: ' + k);
  }
  assert.strictEqual(count(t1, 'sb_bookings__trips'), 2);
  assert.strictEqual(count(t1, 'boats__repairhistory__assets'), 2);
});

test('pax un-flatten + re-nest is exact', () => {
  const blob = sampleBlob();
  const back = assembleBlob(decomposeBlob(blob));
  assert.deepStrictEqual(back.sb_bookings[0].trips[0].pax, { ad_fr: 2, chd_fr: 1, ad_th: 0 });
  assert.deepStrictEqual(back.sb_agents[0].companyInfo, blob.sb_agents[0].companyInfo);
  assert.deepStrictEqual(back.boats[0].repairHistory[0].assets, ['e1', 'e2']);
  assert.strictEqual(back._app_hooks.someFlag, true);
  assert.strictEqual(back.version, '2026o');
});

test('idempotent: decompose(assemble(tables)) equals tables ignoring generated synthetic keys', () => {
  const blob = sampleBlob();
  const t1 = decomposeBlob(blob);
  const t2 = decomposeBlob(assembleBlob(t1));
  const strip = (rows, table) => (rows || []).map(r => {
    const c = { ...r };
    delete c.row_pk;                                  // generated child pk (differs per run)
    const fk = _plan[table] && _plan[table].fkCol;    // fk to a generated parent key -> also synthetic noise
    if (fk) delete c[fk];
    return c;
  });
  for (const k of Object.keys(t1)) {
    assert.deepStrictEqual(strip(t2[k], k), strip(t1[k], k), 'table drift: ' + k);
  }
});
