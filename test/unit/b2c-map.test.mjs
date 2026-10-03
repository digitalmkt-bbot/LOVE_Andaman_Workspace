// §b2cMapMod / §b2cCheck · the B2C → ops import, tested on real (scrubbed) B2C orders.
//
//   node --test test/unit/b2c-map.test.mjs            · run
//   UPDATE_B2C_SNAPSHOTS=1 node --test test/unit/b2c-map.test.mjs   · accept a deliberate output change
//
// Three layers:
//   1. PINNED  — one test per past import bug, asserting the exact field that was wrong. These are the
//                point: a mapper change that brings an old bug back fails here by name.
//   2. SNAPSHOT — the whole mapper output per fixture. Catches the change nobody meant to make. When a
//                change IS meant, re-run with UPDATE_B2C_SNAPSHOTS=1, read the diff, bump B2C_MAP_VER.
//   3. CHECKS  — b2cCheckOrders stays quiet on good data and names each kind of bad data.
//
// Adding a case: node tools/b2c-fixture-capture.mjs LOV-xxxxxxx "<what went wrong>", then a PINNED test.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
const map = require_('../../b2c-map.js');
const { loadFixture, listFixtures, runFixture, DIR } = require_('../helpers/b2c-fixture.cjs');

const one = id => { const out = runFixture(loadFixture(id)); assert.equal(out.length, 1, id + ' should map to one booking'); return out[0]; };
const trip = bk => bk.trips[0];
// Run a fixture with its source rows edited — for the cases real data has not produced yet.
const runWith = (id, edit) => { const fx = loadFixture(id); edit(fx); return runFixture(fx); };
const checks = (fx, bks, opsNat) => map.b2cCheckOrders(fx.items, bks, new Map([[fx.id, fx.paxRows || []]]), opsNat);
const warns = list => list.filter(i => i.sev === 'warn').map(i => i.code);

// ── 1. PINNED ───────────────────────────────────────────────────────────────────────────────────
test('§b2cNat · LOV-7485231 lead TH + TH + US sold Thai → price 3 Thai, park fee 2 Thai', () => {
  const b = one('LOV-7485231');
  assert.equal(trip(b).pax.ad_th, 3, 'the seat PRICE stays what B2C sold');
  assert.deepEqual(trip(b).nat, { ad: 2, chd: 0, inf: 0, foc: 0 });
});
test('§b2cNat · LOV-3345176 lead TH + TR sold as 2 Thai → 1 Thai', () => {
  assert.deepEqual(trip(one('LOV-3345176')).nat, { ad: 1, chd: 0, inf: 0, foc: 0 });
});
test('§b2cNat · LOV-6682744 lead TH + 3 TR sold as 4 Thai → 1 Thai', () => {
  assert.deepEqual(trip(one('LOV-6682744')).nat, { ad: 1, chd: 0, inf: 0, foc: 0 });
});
test('§b2cNat · LOV-0824931 all-Thai party → nat equals every head', () => {
  assert.deepEqual(trip(one('LOV-0824931')).nat, { ad: 2, chd: 0, inf: 0, foc: 0 });
});
test('v11 · LOV-9930593 Thai group with no split follows the lead → 16 Thai, not 16 foreign', () => {
  const p = trip(one('LOV-9930593')).pax;
  assert.equal(p.ad_th, 16); assert.equal(p.ad_fr, 0);
});
test('v10 · LOV-9930593 order-level discount applied → 54,400, not 55,984', () => {
  const b = one('LOV-9930593');
  assert.equal(b.priceBreakdown.total, 54400);
  assert.equal(b.priceBreakdown.discount, -1584);
});
test('§b2cDrop v24 · LOV-5003086 drop-off elsewhere → dropoffSame false + area', () => {
  const b = one('LOV-5003086');
  assert.equal(b.dropoffSame, false);
  assert.equal(b.dropoffArea, 'Naithon');
});
test('§b2cDiscShare v25 · LOV-3488828 order credit is shared by line value, not dumped on the boat line', () => {
  const b = one('LOV-3488828');
  assert.equal(b.priceBreakdown.total, 5347);
  assert.ok(b.priceBreakdown.total > 0, 'the v25 bug imported this trip at ฿0');
});
test('§b2cTransfer v26/v27 · LOV-1592241 transfer lines import, TR-OTHER resolves through routes.extid', () => {
  const out = runFixture(loadFixture('LOV-1592241'));
  assert.deepEqual(out.map(b => b.id), ['b2c_LOV-1592241_1', 'b2c_LOV-1592241_3', 'b2c_LOV-1592241_4']);
  for (const b of out) assert.ok(trip(b).routeId, b.id + ' must resolve a route');
  assert.match(out[2].notes, /Sedan × 1/, 'vehicle size goes to notes — the van job order prints it');
});
test('v19 · LOV-9260122 demonyms resolve (Czech lead, Slovak passenger), not blank', () => {
  const b = one('LOV-9260122');
  assert.equal(b.leadNationality, 'CZ');
  assert.deepEqual(b.passengers.map(p => p.nationality), ['SK']);
});
test('v6/v17 · LOV-6682744 fully paid order reads paid from B2C', () => {
  const ps = one('LOV-6682744').paymentSnapshot;
  assert.equal(ps.paid, 9496); assert.equal(ps.paidStatus, 'paid'); assert.equal(ps.method, 'bt');
});
test('v9 · passengers[] excludes the lead (customer is the lead, passengers are the others)', () => {
  const b = one('LOV-7485231');
  assert.equal(b.passengers.length, 2);
  assert.ok(b.leadPax && !b.passengers.some(p => p.name === b.leadPax));
});
test('v32 · Laotian resolves to LA', () => {
  assert.equal(map.b2cNatCode('Laotian'), 'LA');
});

// ── §b2cNat edge cases real data has not produced yet ──────────────────────────────────────────
const setPax = (fx, list) => { fx.paxRows = list.map((n, i) => ({ paxNo: i + 1, name: 'P' + i, nationality: n })); };
test('§b2cNat · short traveller list → no nat (fall back to price fields, never guess)', () => {
  const [b] = runWith('LOV-7485231', fx => setPax(fx, ['US']));
  assert.equal(trip(b).nat, undefined);
});
test('§b2cNat · a traveller with blank nationality → no nat', () => {
  const [b] = runWith('LOV-7485231', fx => setPax(fx, ['US', '']));
  assert.equal(trip(b).nat, undefined);
});
test('§b2cNat · mixed party with a child → no nat (passengers carry no age, the child is unknowable)', () => {
  const [b] = runWith('LOV-7485231', fx => { fx.items[0].pax_adult = 2; fx.items[0].pax_child = 1; setPax(fx, ['US', 'TH']); });
  assert.equal(trip(b).nat, undefined);
});
test('§b2cNat · all-Thai party with a child → nat covers adults and child', () => {
  const [b] = runWith('LOV-7485231', fx => { fx.items[0].pax_adult = 2; fx.items[0].pax_child = 1; setPax(fx, ['TH', 'TH']); });
  assert.deepEqual(trip(b).nat, { ad: 2, chd: 1, inf: 0, foc: 0 });
});
test('§b2cNat · nobody Thai → nat all zero (checked, none Thai — not the same as unknown)', () => {
  const [b] = runWith('LOV-7485231', fx => { fx.items[0].bk_customer_nat = 'US'; setPax(fx, ['US', 'GB']); });
  assert.deepEqual(trip(b).nat, { ad: 0, chd: 0, inf: 0, foc: 0 });
});

// ── 2. SNAPSHOT ─────────────────────────────────────────────────────────────────────────────────
const SNAP = path.join(DIR, '__expected__');
for (const id of listFixtures()) {
  test('snapshot · ' + id, () => {
    const got = JSON.parse(JSON.stringify(runFixture(loadFixture(id))));
    const file = path.join(SNAP, id + '.json');
    if (process.env.UPDATE_B2C_SNAPSHOTS === '1' || !fs.existsSync(file)) {
      fs.mkdirSync(SNAP, { recursive: true });
      fs.writeFileSync(file, JSON.stringify(got, null, 1) + '\n');
      return;
    }
    assert.deepEqual(got, JSON.parse(fs.readFileSync(file, 'utf8')),
      'mapper output changed — if deliberate, re-run with UPDATE_B2C_SNAPSHOTS=1 and bump B2C_MAP_VER');
  });
}

// ── 3. CHECKS ───────────────────────────────────────────────────────────────────────────────────
test('§b2cCheck · every fixture (all bugs fixed) raises no warning', () => {
  for (const id of listFixtures()) {
    const fx = loadFixture(id);
    assert.deepEqual(warns(checks(fx, runFixture(fx))), [], id);
  }
});
test('§b2cCheck · nat_mix — Thai-priced party with a foreigner and an incomplete list', () => {
  const fx = loadFixture('LOV-7485231'); setPax(fx, ['US']);
  const bks = runFixture(fx);
  assert.deepEqual(warns(checks(fx, bks)), ['nat_mix']);
  assert.match(checks(fx, bks)[0].msg, /รู้สัญชาติแค่ 2 จาก 3/);
  assert.deepEqual(warns(checks(fx, bks, new Set([bks[0].id]))), [], 'a nat typed by hand in ops answers it');
});
test('§b2cCheck · nat_mix stays quiet when B2C sent its own Thai/foreign split', () => {
  const fx = loadFixture('LOV-7485231'); setPax(fx, ['US']);
  fx.items[0].pax_thai = 2; fx.items[0].pax_foreign = 1;
  assert.deepEqual(warns(checks(fx, runFixture(fx))), []);
});
test('§b2cCheck · nat_unread — a nationality b2cNatCode cannot read', () => {
  const fx = loadFixture('LOV-9260122'); fx.items[0].bk_customer_nat = 'Wakandan';
  assert.ok(warns(checks(fx, runFixture(fx))).includes('nat_unread'));
});
test('§b2cCheck · route — a line no catalog resolves', () => {
  const fx = loadFixture('LOV-0824931');
  fx.catalogs.prog = []; fx.catalogs.ext = [];
  const it = fx.items[0]; it.product_id = 'POW-999'; it.route_id = null;
  if (it.details && typeof it.details === 'object') delete it.details.opsRouteId;
  if (typeof it.details === 'string') { const d = JSON.parse(it.details); delete d.opsRouteId; it.details = JSON.stringify(d); }
  assert.ok(warns(checks(fx, runFixture(fx))).includes('route'));
});
test('§b2cCheck · pax0 — a confirmed day trip with nobody on it', () => {
  const fx = loadFixture('LOV-0824931'); fx.items[0].pax_adult = 0; fx.items[0].pax_thai = 0;
  assert.ok(warns(checks(fx, runFixture(fx))).includes('pax0'));
});
test('§b2cCheck · money_parts / money_order', () => {
  const fx = loadFixture('LOV-0824931');
  const bks = runFixture(fx);
  bks[0].priceBreakdown.seat += 100;
  assert.ok(warns(checks(fx, bks)).includes('money_parts'));
  const fx2 = loadFixture('LOV-0824931'); fx2.items[0].bk_total = 1000;
  assert.ok(warns(checks(fx2, runFixture(fx2))).includes('money_order'));
});
test('§b2cCheck · a cancelled order is never flagged', () => {
  const fx = loadFixture('LOV-0824931'); fx.items[0].pax_adult = 0; fx.items[0].pax_thai = 0;
  const bks = runFixture(fx); bks.forEach(b => { b.status = 'cancelled'; });
  assert.deepEqual(checks(fx, bks), []);
});
