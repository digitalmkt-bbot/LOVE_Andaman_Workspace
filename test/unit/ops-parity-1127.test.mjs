import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// UI parity round 6 (2026-11-27), agent N: the booking page's Seat Locks tab, the van bill sheet, fleet insights, PR/PO.
const src = (f) => fs.readFileSync(f, 'utf8').split('\r\n').join('\n');
const between = (s, a, b) => { const i = s.indexOf(a), j = s.indexOf(b, i + a.length); assert.ok(i >= 0 && j > i, `${a} .. ${b}`); return s.slice(i, j); };
const locks = src('allotment_v2/js/ops/30-ops-locks.js');

test('N1: a lock legacy held for a free-text name shows that name (holder_name); any other lock keeps legacy\'s name', () => {
  const block = between(locks, "defO('bookingV2LockHolderName'", '/* release cutoff');
  const ctx = vm.createContext({ defO: (name, fn) => { ctx[name] = (l) => fn((x) => (x.holderType === 'office' ? 'Office hold' : x.holderId), l); } });
  vm.runInContext(block, ctx);
  assert.equal(ctx.bookingV2LockHolderName({ holderType: 'office', holderName: 'GUIDE MAN' }), 'GUIDE MAN');
  assert.equal(ctx.bookingV2LockHolderName({ holderType: 'office', holderName: '' }), 'Office hold');
  assert.equal(ctx.bookingV2LockHolderName({ holderType: 'agent', holderId: 'a10' }), 'a10');
  assert.match(between(locks, 'function common(r)', 'function usedOf'), /holderName: r\.holder_name \|\| ''/);
});

test('N1: a bulk lock with every round released still shows what it holds (asked − released), not what was asked', () => {
  const block = between(locks, 'var ref = open || deps[deps.length - 1] || null;', 'G.status =');
  const run = (open, deps, g) => { const ctx = vm.createContext({ open, deps, g, G: {} }); vm.runInContext('var ref = open || deps[deps.length - 1] || null;' + block, ctx); return ctx.G; };
  const rel = { pax: 37, released_pax: 33, status: 'released' };
  assert.deepEqual([run(null, [rel, rel], { pax: 37 }).qty, run(null, [rel], { pax: 37 }).releasedPax], [4, 33], 'legacy lkmvxqf2a8qrrt4: 4, not 37');
  assert.equal(run({ pax: 10, released_pax: 2 }, [], { pax: 10 }).qty, 8);
  assert.equal(run(null, [], { pax: 6 }).qty, 6, 'no round at all: the group\'s seats');
});

test('N4: Cost by job type adds up the period\'s jobs, also when the server gave the job count', () => {
  const fleet = src('allotment_v2/js/05-fleet.js');
  assert.match(fleet, /const periodJobList = periodJobs;/);
  assert.match(fleet, /periodJobList\.forEach\(j=>\{ if\(typeMap\[j\.type\]!==undefined\) typeMap\[j\.type\] \+= calcCost\(j\); \}\);/);
  assert.ok(fleet.indexOf('const periodJobList') < fleet.indexOf('periodJobs=new Array('), 'the list is kept before periodJobs becomes a count');
});

test('N4: incidents are kept in legacy\'s order (by id), as the jobs; PR/PO rows carry the food note', () => {
  assert.match(src('allotment_v2/js/ops/24-ops-fleet-jobs.js'), /map\(fromServerIncident\)\.sort\(byLegacyId\)/);
  assert.match(src('allotment_v2/js/ops/73-ops-prep.js'), /mNote: r\.meal_note \|\| ''/);
});

test('N3: the owner list is every partner van owner, idle ones too, in Thai order', () => {
  const block = between(src('allotment_v2/js/ops/45-ops-van-bills.js'), 'function partnerNames(){', 'function host(){');
  const view = { partners: [{ partner: 'โกหมง' }, { partner: 'GM' }], idle_partners: ['(ไม่ระบุผู้ให้บริการ)', 'GM', 'รถนอก ท่าเรือวิสิษฐ์พันวา'] };
  const ctx = vm.createContext({ cache: { k: { view } }, overviewKey: () => 'k', text: (v) => (v == null ? '' : String(v)) });
  vm.runInContext(block, ctx);
  const names = JSON.parse(JSON.stringify(ctx.partnerNames()));
  assert.deepEqual([...names].sort(), ['(ไม่ระบุผู้ให้บริการ)', 'GM', 'รถนอก ท่าเรือวิสิษฐ์พันวา', 'โกหมง'].sort());
  assert.equal(names.length, 4, 'each name once');
});
