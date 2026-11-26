import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';

// K1 (parity 2026-11-26c): the Seat Locks tab's ghost-seat banner and "คืนที่นั่งทั้งหมด" answer from the server
// (GET /v1/seat-locks/sweep, POST /v1/seat-locks/sweep/fix, operation-backend migration 690), and a lock's `used`
// is the server's used_pax (legacy's counter). ops/30-ops-locks.js.
const src = (f) => fs.readFileSync(f, 'utf8').split('\r\n').join('\n');
const J = (v) => JSON.parse(JSON.stringify(v));
const between = (s, a, b) => { const i = s.indexOf(a), j = s.indexOf(b, i + a.length); assert.ok(i >= 0 && j > i, `${a} .. ${b}`); return s.slice(i, j); };
const file = src('allotment_v2/js/ops/30-ops-locks.js');

test('the sweep in legacy\'s shape: names from legacy\'s helpers, the server\'s counts', () => {
  const block = between(file, "defO('bookingV2LockSweep'", "/* seats held off sale on a route-day");
  const A = [{ id: 'lock_1', holderType: 'agent', holderId: 'a1' }, { id: 'lock_k', parentId: 'lock_1', subName: 'A' }, { id: 'lg_g', holderType: 'office' }];
  const ctx = vm.createContext({
    sweepData: {
      rows: [{ lock_id: 'lock_1', group_id: null, parent_id: null, service_date: '2026-11-20', route_id: 'r1', qty: 6, used: 3, live: 2, diff: 1, moved: 0, dead: 1, vcs: ['BK-1 (ยกเลิก)'] },
        { lock_id: null, group_id: 'lg_g', service_date: '2026-11-01', route_id: 'r2', qty: 8, used: 10, live: 9, diff: 1, moved: 0, dead: 0, vcs: [] }],
      over: [{ lock_id: 'lock_1', group_id: null, service_date: '2026-11-20', route_id: 'r1', qty: 6, alloc: 3, unalloc: 3, used: 4, over: 1 }],
      locks: 3060, n_bad: 2, n_over: 1, seats: 2, seats_moved: 0, seats_dead: 2, seats_over: 1,
    },
    locks: () => A, bookingV2LockHolderName: (l) => (l.holderType === 'agent' ? 'Agent ' + l.holderId : 'Office hold'),
    defO: (name, fn) => { ctx[name] = () => fn(null); },
  });
  vm.runInContext(block, ctx);
  const S = J(ctx.bookingV2LockSweep());
  assert.deepEqual([S.nBad, S.seats, S.nOver, S.seatsOver, S.seatsDead, S.locks], [2, 2, 1, 1, 2, 3060]);
  assert.deepEqual(S.rows.map((r) => [r.id, r.name, r.used, r.live, r.diff, r.vcs]), [['lock_1', 'Agent a1', 3, 2, 1, ['BK-1 (ยกเลิก)']], ['lg_g', 'Office hold', 10, 9, 1, []]]);
  assert.deepEqual(S.over.map((r) => [r.id, r.qty, r.alloc, r.used, r.over]), [['lock_1', 6, 3, 4, 1]]);
});

test('"คืนที่นั่งทั้งหมด" sends the one command after legacy\'s confirm; nothing to fix = legacy\'s alert, nothing sent', async () => {
  const block = between(file, "def('bookingV2LockSweepFixAll'", "/* ── legacy's lock rules answered from the server's numbers");
  const sent = [], alerts = [], asks = [];
  const run = (S, yes) => {
    const ctx = vm.createContext({
      window: { bookingV2LockSweep: () => S }, alert: (m) => alerts.push(m), confirm: (m) => { asks.push(m); return yes; },
      O: { post: (p, b) => { sent.push([p, b]); return Promise.resolve({ locks: 2, seats: 5 }); } },
      go: (t, fn) => fn(), render: () => {},
      def: (name, fn) => { ctx[name] = fn; },
    });
    vm.runInContext(block, ctx);
    return ctx.bookingV2LockSweepFixAll();
  };
  run({ nBad: 0 }, true);
  assert.deepEqual([J(sent), alerts.at(-1)], [[], 'ไม่มีล็อคไหนที่ตัวนับไม่ตรงกับใบจอง']);
  run({ nBad: 2, seats: 5, seatsMoved: 0, seatsDead: 5 }, false);
  assert.deepEqual(J(sent), [], 'cancelled at the confirm');
  assert.match(asks.at(-1), /^คืนที่นั่งที่ไม่มีใบจองรออยู่ กลับเข้าล็อคทั้งหมด\?\n\n2 ล็อค · 5 ที่/);
  await run({ nBad: 2, seats: 5, seatsMoved: 0, seatsDead: 5 }, true);
  assert.deepEqual(J(sent), [['/v1/seat-locks/sweep/fix', {}]]);
  assert.equal(alerts.at(-1), 'คืนแล้ว 5 ที่ จาก 2 ล็อค');
});

test('a lock\'s used is the server\'s used_pax (legacy\'s counter); a bulk lock\'s is the group\'s', () => {
  assert.match(file, /function usedOf\(r\)\{ return r\.used_pax != null \? \(\+r\.used_pax \|\| 0\) : \(\+r\.drawn_pax \|\| 0\); \}/);
  assert.match(between(file, 'function one(r){', 'function srvOf'), /drawn = usedOf\(r\)/);
  assert.match(file, /if\(g\.used_pax != null\) G\.used = \+g\.used_pax \|\| 0;/);
  assert.match(file, /O\.get\('\/v1\/seat-locks\/sweep'\)/);
});
