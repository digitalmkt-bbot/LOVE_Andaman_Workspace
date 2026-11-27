// Parity round 12 (agent AA, 2026-11-28), booking "By trip · date" on 28 Nov:
//  · "2 holders · 4 locks": a sub-group of a bulk lock whose parent's round is released stays active, as legacy's own status
//    (lkmwk3d9wt4263x, lkmw39dd62vj5bk on r10), so bookingV2LocksFor counts it (ops/30-ops-locks.js build).
//  · no "1 boat" on Early Phi Phi Bamboo: baCharterBoatMap is every boat a charter takes (the panel's day charter_taken),
//    not the Boat Operation cell (is_charter) — Tadeo carries BK-26091059-U8M5 by dispatch (ops/82-ops-w5c-boats.js).
//   node --test test/unit/ops-parity-pier-1128c.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';

const src = (f) => fs.readFileSync(f, 'utf8').split('\r\n').join('\n');
const J = (v) => JSON.parse(JSON.stringify(v));
const between = (s, a, b) => { const i = s.indexOf(a), j = s.indexOf(b, i + a.length); assert.ok(i >= 0 && j > i, `${a} .. ${b}`); return s.slice(i, j); };

test('a bulk sub-group keeps legacy\'s own status when its parent\'s round is released', () => {
  const file = src('allotment_v2/js/ops/30-ops-locks.js');
  const block = between(file, '  function sortBy(', '  /* ── read');
  const ctx = vm.createContext({ SB_AGENTS: [], Date });
  vm.runInContext(block + '\nthis.build = build;', ctx);
  const dep = (d, status) => ({ id: `lg_P_${d}`, route_id: 'r10', service_date: d, pax: 8, released_pax: status === 'released' ? 8 : 0, agent_id: 'a01', holder_type: 'agent', status, state: status, group_id: 'lg_P', version: 1 });
  const kid = (d, status, state, sub) => ({ id: `lg_${sub}_${d}`, route_id: 'r10', service_date: d, pax: 4, released_pax: 2, agent_id: 'a01', holder_type: 'agent', status, state, group_id: 'lg_P', parent_id: `lg_P_${d}`, sub_name: sub, created_at: '2026-11-17', version: 1 });
  const rows = [dep('2026-11-19', 'released'), dep('2026-11-28', 'released'),
    // the server: a sub-group of a released departure is 'released' (seat-locks.ts), its own row stays active
    kid('2026-11-19', 'active', 'released', 'Aura'), kid('2026-11-28', 'active', 'released', 'Aura'),
    // a sub-group legacy released itself stays released
    kid('2026-11-19', 'released', 'released', 'Gone')];
  const group = { id: 'lg_P', route_id: 'r10', holder_type: 'agent', agent_id: 'a01', date_from: '2026-11-19', date_to: '2026-11-30', weekdays: [], pax: 8, state: 'active', version: 1 };
  const out = J(ctx.build(rows, [group]));
  const by = (sub) => out.find((l) => l.parentId === 'lg_P' && l.subName === sub);
  assert.equal(by('Aura').status, 'active', 'a wrong released is the parent\'s released round (legacy: releasedDates on the parent only)');
  assert.equal(by('Gone').status, 'released');
  assert.deepEqual(out.find((l) => l.id === 'lg_P').releasedDates, ['2026-11-19', '2026-11-28'], 'the parent\'s rounds stay released');
});

test('baCharterBoatMap: every boat a charter takes (the day\'s charter_taken), not the cell (is_charter)', () => {
  const file = src('allotment_v2/js/ops/82-ops-w5c-boats.js');
  // Tadeo (b8) is in the shop on 28 Nov: not in assigned, yet BK-26091059-U8M5 rides it by dispatch
  const day = { assigned: [
    { boat_id: 'b7', is_charter: true, charter_booking_id: 'lg_BK-26100399-22CV' },
    { boat_id: 'b6', is_charter: true, charter_booking_id: null },   // marked Charter by hand: no booking takes it
    { boat_id: 'b3', is_charter: false, charter_booking_id: null },
  ], charter_taken: { b8: 'lg_BK-26091059-U8M5', b7: 'lg_BK-26100399-22CV' } };
  const ctx = {
    console, Map, Set, Array, Object, String,
    SB_BOOKINGS: [{ id: 'BK-26091059-U8M5', opsId: 'lg_BK-26091059-U8M5' }, { id: 'BK-26100399-22CV', opsId: 'lg_BK-26100399-22CV' }],
    baCharterBoatMap: () => new Map([['legacy', 'walk']]), bkOvnHoldMap: () => new Map(),
    laOps: { enabled: () => true, boatOperation: { day: () => day, ensure() {} }, activeView: () => '' },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(file, ctx);
  const m = ctx.baCharterBoatMap('2026-11-28');
  assert.deepEqual([...m.entries()], [['b8', 'BK-26091059-U8M5'], ['b7', 'BK-26100399-22CV']],
    'a missing b8 is the cell rule: By trip then counts Tadeo as "1 boat" of Early Phi Phi Bamboo');
});
