import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Sync 11-16..11-23 gaps, adapter side (lk-inbox ff9462e4..b0bc24b6). The server side is operation-backend #52 (merged)
// and #55. Each wrapper here replaces legacy's function in ops mode, so legacy's change has to be carried by hand.
//  §lkSubDay    a sub-group under a bulk lock is one travel day's: service_date              ops/30-ops-locks.js
//  §selfAsk     grouping a self-arrive booking asks first, sends self_arrive                 ops/34-ops-vans.js
//  §cotBill     COT already paid through the invoice: cot_bill mapped, collect_anyway        ops/44-ops-pier-money.js
//  §fjOwnDue    the job header's owner / due date go to the server                           ops/24-ops-fleet-jobs.js
//  §paySlip     By trip payment-window slips: booking slips, then the payment's slip_ids     ops/38, ops/30
//  §upgUndoUi   upgrade undo uses legacy's app dialogs, and the server's refusals open them  ops/40, ops/34
//  §pckMoveNs   the pier boat move list carries the server's `gone`                          ops/83
const src = (f) => fs.readFileSync(f, 'utf8').split('\r\n').join('\n');
const J = (v) => JSON.parse(JSON.stringify(v));   // vm objects come from another realm
const between = (s, a, b) => { const i = s.indexOf(a), j = s.indexOf(b, i + a.length); assert.ok(i >= 0 && j > i, `${a} .. ${b}`); return s.slice(i, j); };

test('§lkSubDay: a bulk lock sub-group sends its travel day; none picked = legacy\'s alert, nothing sent', async () => {
  const block = between(src('allotment_v2/js/ops/30-ops-locks.js'), "def('bookingV2SubCommit'", '/* ── edit (day, bulk, sub-group)');
  const sent = [], alerts = [];
  const run = (L, modal) => {
    const ctx = vm.createContext({
      _bkV2SubModal: modal, alert: (m) => alerts.push(m), console,
      find: () => L, isGroup: (x) => !!x.group, lockPath: (x) => (x.group ? '/v1/seat-lock-groups/' : '/v1/seat-locks/') + x.id,
      W: (m, p, v, b) => { sent.push([m, p, b]); return Promise.resolve({}); },
      go: (t, fn) => fn(), render: () => {},
      def: (name, fn) => { ctx[name] = fn; },
    });
    vm.runInContext(block + '\n', ctx);
    return ctx.bookingV2SubCommit();
  };
  run({ id: 'g1', group: true, opsVersion: 3 }, { parentId: 'g1', name: 'A', qty: 4, date: '' });
  assert.deepEqual(J(sent), []);
  assert.deepEqual(J(alerts), ['เลือกวันเดินทางของกรุ๊ปย่อยก่อน']);
  await run({ id: 'g1', group: true, opsVersion: 3 }, { parentId: 'g1', name: 'A', qty: 4, date: '2026-12-02' });
  assert.deepEqual(J(sent.at(-1)), ['POST', '/v1/seat-lock-groups/g1/sub-groups', { sub_name: 'A', pax: 4, service_date: '2026-12-02' }]);
  await run({ id: 'l1', group: false, opsVersion: 1 }, { parentId: 'l1', name: 'B', qty: 2 });
  assert.equal(sent.at(-1)[2].service_date, undefined, 'a day lock\'s sub-group needs no day');
});

test('§selfAsk: the ops wrapper asks in legacy\'s words and sends the answer as self_arrive', () => {
  const ops = between(src('allotment_v2/js/ops/34-ops-vans.js'), "wrap('bookingV2VanGroupSelected'", '/* ── commands on a whole group');
  const legacy = src('allotment_v2/js/booking/bookingV2VanGroupSelected.js');
  for (const text of ['ขาไปลูกค้ามาเองที่ท่าเรือ รถจะไม่ไปรับ และไม่ขึ้นในใบงานรถขาไป', "okLabel:'ส่งกลับอย่างเดียว'", "noLabel:'เอาติ๊กออก · ให้รถไปรับ'", "cancelLabel:'ยกเลิก ไม่จับกรุ๊ป'"]) {
    assert.ok(legacy.includes(text), `legacy still says ${text}`);
    assert.ok(ops.replace(/: '/g, ":'").includes(text), `the ops dialog says ${text}`);
  }
  assert.match(ops, /'return_only'\); \}/);
  assert.match(ops, /'clear'\); \}/);
  assert.match(ops, /\/members', Object\.assign\(\{ members: members \}, selfBody\)\)/, 'joining a group sends it');
  assert.match(ops, /Object\.assign\(\{ service_date: date, route_id: routeId, zone: zone, members: members \}, selfBody\)/, 'a new group sends it');
});

test('§cotBill: pckMoney carries cot_bill / cot_bill_no; the payment save answers the guard with collect_anyway', () => {
  const pm = src('allotment_v2/js/ops/44-ops-pier-money.js');
  assert.match(between(pm, "wrap('pckMoney'", "wrap('pckPayOpen'"), /m\.cotBill = n\(r\.cot_bill\); m\.cotBillNo = r\.cot_bill_no \|\| '';/);
  const save = between(pm, "wrap('pckPaySave'", "wrap('pckPayDel'");
  assert.match(save, /\{ collect_anyway: true \}/);
  assert.match(save, /paid_via_bill: \{ flag: 'collect_anyway' \}/);
  // legacy's guard reads the fields the adapter fills
  assert.match(src('allotment_v2/js/08-app.js'), /M\.cotBill>0 && !\(M\.due>0\) && !\(M\.pierPaid>0\)/);
});

test('§fjOwnDue: the job header\'s owner and due date are a PATCH, not a browser-only flSave', () => {
  const jobs = src('allotment_v2/js/ops/24-ops-fleet-jobs.js');
  const w = between(jobs, "wrap('flJobSaveOwnDue'", "wrap('flBoardPark'");
  assert.match(w, /patch\.owner = own/);
  assert.match(w, /patch\.due_date = due \|\| null/);
  assert.match(w, /O\.patch\('\/v1\/fleet\/jobs\/' \+ enc\(m\.id\), patch\)/);
  assert.doesNotMatch(w, /flSave\(/);
  assert.match(src('allotment_v2/js/05-fleet.js'), /function flJobSaveOwnDue\(id\)/, 'legacy still has the function the wrapper replaces');
});

test('§paySlip: a payment-window slip is a booking slip on the server, then the recorded payment\'s slip', () => {
  const att = src('allotment_v2/js/ops/38-ops-attachments.js');
  const pick = between(att, "wrapGlobal('bookingV2PaySlipPick'", 'O.paySlips={');
  assert.match(pick, /attachSlip\(bkId,bl,mime,name,function\(s\)\{ putPaySlip\(bkId,s\); \}\)/);
  assert.match(att, /O\.del\('\/v1\/bookings\/'\+encodeURIComponent\(b\.opsId\)\+'\/slips\/'\+encodeURIComponent\(slipId\)\)/);
  const rec = between(src('allotment_v2/js/ops/30-ops-money.js'), "wrap('bookingV2PayDoRecord'", "wrap('pfmEditOpen'");
  assert.match(rec, /slip_ids: sl\.map\(function\(s\)\{ return s\.id; \}\)/);
  assert.match(rec, /O\.paySlips\.unlink\(bkId, s\.slipId\)/);
});

test('§upgUndoUi: both undo wrappers use legacy\'s dialogs; the server\'s 409s open the blocked one', () => {
  const one = between(src('allotment_v2/js/ops/40-ops-bookings.js'), 'var origUpgUndo', '/* ── upgrade sale deleted');
  const van = between(src('allotment_v2/js/ops/34-ops-vans.js'), "wrap('bookingV2VanUpgUndo'", "wrap('bkUpgVanMoveStops'");
  for (const [name, w] of [['booking', one], ['whole van', van]]) {
    assert.doesNotMatch(w, /confirm\(/, `${name}: no browser confirm`);
    assert.match(w, /bkUpgSheet\(\{ mode: 'ask'/, `${name}: legacy's ask sheet`);
    assert.match(w, /bkUpgUndoBlocked\(/, `${name}: legacy's blocked sheet`);
    assert.match(w, /e\.code === 'route_closed'/, `${name}: route closed`);
    assert.match(w, /e\.code === 'not_enough_seats'/, `${name}: seats short`);
    assert.match(w, /\+bd\.needed/, `${name}: the server's needed`);
  }
  assert.match(one, /'ยืนยันยกเลิก Upgrade'/);
  assert.match(van, /'ยืนยันยกเลิกทั้งคัน'/);
});

test('§pckMoveNs: the pier boat move list carries the server\'s gone', () => {
  assert.match(src('allotment_v2/js/ops/83-ops-pier-move.js'), /gone: \+o\.gone \|\| 0 \}/);
});
