// §b2cChg · the pure diff behind the "B2C changed" history line (b2c-changelog.js)
//   node --test test/unit/b2c-changelog.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const chg = createRequire(import.meta.url)('../../b2c-changelog.js');

const snap = (bk, trips, extra) => Object.assign({ bk, trips: trips || [], named: 0, addons: '' }, extra || {});
const trip = (date, routeid, ad, chd) => ({ idx: 0, routeid, date, mode: 'seat', pax: { ad, chd: chd || 0, inf: 0, foc: 0 } });
const routeName = id => ({ r6: 'Phi Phi Premium', r7: 'Phi Phi Classic' })[id] || id;

test('no change → no segments (money compared as money, "2000" == "2000.00")', () => {
  const a = snap({ status: 'confirmed', total: '2000', hotelname: 'X' }, [trip('2026-10-12', 'r6', 2)]);
  const b = snap({ status: 'confirmed', total: '2000.00', hotelname: 'X' }, [trip('2026-10-12', 'r6', 2)]);
  assert.deepEqual(chg.diff(a, b, { routeName }), []);
});
test('date, route, pax, hotel, total → one segment each, fixed order and shape', () => {
  const a = snap({ status: 'confirmed', total: 3600, hotelname: 'Patong Bay Hotel' }, [trip('2026-10-12', 'r6', 2)]);
  const b = snap({ status: 'confirmed', total: 5400, hotelname: 'Kata Beach Resort' }, [trip('2026-10-14', 'r7', 2, 1)]);
  assert.deepEqual(chg.diff(a, b, { routeName }), [
    'Date: 12 Oct → 14 Oct', 'Route: Phi Phi Premium → Phi Phi Classic', 'Pax: 2 Ad → 2 Ad + 1 Chd',
    'Hotel: Patong Bay Hotel → Kata Beach Resort', 'Total: ฿3,600 → ฿5,400']);
});
test('status, self-arrive, paid, names, add-ons', () => {
  const a = snap({ status: 'confirmed', pickupself: false, paymentsnapshot_paidstatus: 'deposit' }, [], { named: 1, addons: '' });
  const b = snap({ status: 'cancelled', pickupself: true, paymentsnapshot_paidstatus: 'paid' }, [], { named: 3, addons: 'Longtail x2' });
  assert.deepEqual(chg.diff(a, b), ['Status: Confirmed → Cancelled', 'Self-arrive: No → Yes', 'Paid: Deposit → Paid',
    'Names: 1 listed → 3 listed', 'Add-ons: — → Longtail x2']);
});
test('values cannot break the " · " / " → " shape the client parses', () => {
  const a = snap({ note: 'old' }), b = snap({ note: 'A · B → C\nD' });
  const segs = chg.diff(a, b);
  assert.equal(segs.length, 1);
  assert.equal(segs[0], 'Note: old → A, B -> C D');
  assert.equal(segs.join(' · ').split(' · ').length, 1);
  assert.match(segs[0], /^([^:]+): (.*) → (.*)$/);
});
test('long values are cut', () => {
  const segs = chg.diff(snap({ note: '' }), snap({ note: 'x'.repeat(200) }));
  assert.ok(segs[0].length < 80, segs[0]);
  assert.ok(segs[0].endsWith('…'));
});
test('multi-trip bookings name the trip; a trip added shows as Trips n → m', () => {
  const a = snap({}, [trip('2026-10-12', 'r6', 2), Object.assign(trip('2026-10-13', 'r6', 2), { idx: 1 })]);
  const b = snap({}, [trip('2026-10-12', 'r6', 2), Object.assign(trip('2026-10-15', 'r6', 2), { idx: 1 }), Object.assign(trip('2026-10-16', 'r6', 2), { idx: 2 })]);
  assert.deepEqual(chg.diff(a, b), ['Trips: 2 → 3', 'Date (trip 2): 13 Oct → 15 Oct']);
});
test('entries: changed → kind b2c · new → kind b2c_new with date/route/pax · logNew:false skips new', () => {
  const before = new Map([['b1', snap({ hotelname: 'A' }, [trip('2026-10-12', 'r6', 2)])]]);
  const after = new Map([['b1', snap({ hotelname: 'B' }, [trip('2026-10-12', 'r6', 2)])],
                         ['b2', snap({}, [trip('2026-10-09', 'r7', 2)])]]);
  assert.deepEqual(chg.entries(before, after, { routeName }), [
    { id: 'b1', kind: 'b2c', tag: 'B2C', text: 'Hotel: A → B' },
    { id: 'b2', kind: 'b2c_new', tag: 'B2C', text: 'New booking from B2C · 9 Oct · Phi Phi Classic · 2 Ad' }]);
  assert.deepEqual(chg.entries(before, after, { routeName, logNew: false }).map(e => e.id), ['b1']);
});
test('writeEntries appends after the current last idx and quotes "by"', async () => {
  const calls = [];
  const db = { query: async (sql, params) => { calls.push({ sql, params });
    return /max\(idx\)/.test(sql) ? { rows: [{ sb_bookings_id: 'b1', m: 4 }] } : { rows: [] }; } };
  const qic = x => '"' + x + '"', fqt = t => '"s"."' + t + '"';
  const n = await chg.writeEntries(db, [{ id: 'b1', kind: 'b2c', tag: 'B2C', text: 't1' }, { id: 'b1', kind: 'b2c', tag: 'B2C', text: 't2' }, { id: 'b9', kind: 'b2c_new', tag: 'B2C', text: 'n' }],
    { fqt, qic, histCols: ['sb_bookings_id', 'idx', 'row_pk', 'at', 'kind', 'text', 'tag', 'by'], at: '2026-10-08T00:00:00Z' });
  assert.equal(n, 3);
  const ins = calls.filter(c => /^INSERT/.test(c.sql));
  assert.deepEqual(ins.map(c => [c.params[0], c.params[1]]), [['b1', 5], ['b1', 6], ['b9', 0]]);
  assert.match(ins[0].sql, /"by"/);
  assert.equal(ins[0].params[7], 'B2C sync');
  assert.notEqual(ins[0].params[2], ins[1].params[2], 'row_pk unique');
});
