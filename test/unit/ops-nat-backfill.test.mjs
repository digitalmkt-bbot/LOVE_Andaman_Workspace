import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SRC = fs.readFileSync('allotment_v2/js/ops/28-ops-nationalities.js', 'utf8');

function runtime({ enabled = true, refuse = [] } = {}) {
  const writes = [], alerts = [], hist = [], legacy = [];
  const bks = [
    { id: 'a', opsId: 'o1', opsVersion: 3, status: 'confirmed', leadPax: 'Ivan', leadNationality: '' },
    { id: 'b', opsId: 'o2', opsVersion: 1, status: 'confirmed', leadPax: 'Ivan2', leadNationality: '' },
    { id: 'c', opsId: 'o3', status: 'confirmed', leadPax: 'x', leadNationality: 'GB' },
    { id: 'd', opsId: 'o4', status: 'cancelled', leadPax: 'Ivan', leadNationality: '' },
  ];
  let inQueue = 0;
  const O = {
    enabled: () => enabled,
    toast() {}, fail() {}, wrote() {},
    queue: async (fn) => { assert.equal(inQueue, 0, 'writes must be one at a time'); inQueue++; try { return await fn(); } finally { inQueue--; } },
    bookingWrite: async (m, path, bk, body) => {
      writes.push({ m, path, ifv: bk.opsVersion, body });
      if (refuse.includes(path)) { const e = new Error('booking is closed'); e.status = 409; throw e; }
      return { lead_nationality: body.lead_nationality, version: 9 };
    },
  };
  const window = { laOps: O, mdBackfillNat: () => legacy.push('legacy') };
  const ctx = {
    window, Promise, Array, Object, Error, String, Number, encodeURIComponent, JSON,
    SB_BOOKINGS: bks,
    confirm: () => true, alert: (m) => alerts.push(m), renderMarketData() {},
    mdValidNat: (c) => String(c || '').toUpperCase().slice(0, 2).length === 2 ? String(c).toUpperCase() : '',
    bookingV2GuessNationality: (n) => (/^Ivan/.test(n) ? 'RU' : ''),
    bookingV2AddHistory: (b, k, t) => hist.push(b.id + ':' + t),
  };
  vm.runInNewContext(SRC, ctx);
  return { window, bks, writes, alerts, hist, legacy };
}

test('backfill PATCHes lead_nationality per booking, one queued write each, then sets local', async () => {
  const rt = runtime();
  const r = await rt.window.mdBackfillNat();
  assert.deepEqual([...rt.writes.map((w) => w.path)], ['/v1/bookings/o1', '/v1/bookings/o2']);
  assert.deepEqual(JSON.parse(JSON.stringify(rt.writes[0].body)), { lead_nationality: 'RU' });
  assert.equal(rt.bks[0].leadNationality, 'RU');
  assert.equal(r.filled, 2);
  assert.equal(rt.hist.length, 2);
  assert.match(rt.alerts[0], /Filled by guess: 2/);
});

test('a refused write keeps the booking blank and is reported', async () => {
  const rt = runtime({ refuse: ['/v1/bookings/o2'] });
  const r = await rt.window.mdBackfillNat();
  assert.equal(rt.bks[0].leadNationality, 'RU');
  assert.equal(rt.bks[1].leadNationality, '');
  assert.equal(r.failed, 1);
  assert.equal(rt.hist.length, 1);
  assert.match(rt.alerts[0], /Refused by server \(left blank\): 1/);
  assert.match(rt.alerts[0], /booking is closed/);
});

test('legacy mode still runs the original local backfill', () => {
  const rt = runtime({ enabled: false });
  rt.window.mdBackfillNat();
  assert.deepEqual(rt.legacy, ['legacy']);
  assert.equal(rt.writes.length, 0);
});
