import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';

// Booking page › boat column › จัดการ › sub-group (2026-11-28): a sub-group short of its parent's room grows the parent
// (operation-backend `auto_adjust: true`; the answer's adjusted_pax / adjusted_parent). ops/30-ops-locks.js.
const src = (f) => fs.readFileSync(f, 'utf8').split('\r\n').join('\n');
const J = (v) => JSON.parse(JSON.stringify(v));
const between = (s, a, b) => { const i = s.indexOf(a), j = s.indexOf(b, i + a.length); assert.ok(i >= 0 && j > i, `${a} .. ${b}`); return s.slice(i, j); };
const file = src('allotment_v2/js/ops/30-ops-locks.js');
const block = between(file, "def('bookingV2SubCommit'", '/* ── edit (day, bulk, sub-group)');
const overlays = between(file, '/* the dialogs still say legacy', 'O.locks = {');

function world(answer, extra = {}, code = block) {
  const sent = [], alerts = [];
  const ctx = vm.createContext({
    alert: (m) => alerts.push(m), setTimeout: (fn) => fn(),
    find: (id) => ({ id, opsVersion: 4, status: 'active' }), isGroup: (L) => !!L.isGroup, lockPath: (L) => '/v1/seat-locks/' + L.id,
    W: (m, p, v, b) => { sent.push([m, p, v, b]); return Promise.resolve(answer); }, go: (t, fn) => fn(), render: () => {},
    def: (name, fn) => { ctx[name] = fn; }, defO: (name, fn) => { ctx[name] = (...a) => fn(ctx.__orig, ...a); },
    ...extra,
  });
  vm.runInContext(code, ctx);
  return { ctx, sent, alerts };
}

test('the sub-group form sends auto_adjust and says how much the parent grew, and what waits', async () => {
  const w = world({ id: 'lock_b', adjusted_pax: 3, adjusted_parent: { id: 'lock_p', pax: 12, pending_pax: 2 } },
    { _bkV2SubModal: { parentId: 'lock_p', name: ' B ', qty: '5', reason: '' } });
  await w.ctx.bookingV2SubCommit();
  assert.deepEqual(J(w.sent), [['POST', '/v1/seat-locks/lock_p/sub-groups', 4, { sub_name: 'B', pax: 5, auto_adjust: true }]]);
  assert.equal(w.ctx._bkV2SubModal, null, 'the form closes');
  assert.equal(w.alerts.length, 1);
  assert.match(w.alerts[0], /^ที่นั่งในล็อกแม่ไม่พอ · เพิ่มที่นั่งให้ล็อกแม่อัตโนมัติ 3 ที่/);
  assert.match(w.alerts[0], /รอที่ว่าง \(Pending\) 2 ที่/);
});

test('a sub-group that fit says nothing; all seats free says no Pending', async () => {
  const fit = world({ id: 'lock_b' }, { _bkV2SubModal: { parentId: 'lock_p', name: 'A', qty: '2' } });
  await fit.ctx.bookingV2SubCommit();
  assert.deepEqual(fit.alerts, []);
  const free = world({ id: 'lock_b', adjusted_pax: 1, adjusted_parent: { pending_pax: 0 } }, { _bkV2SubModal: { parentId: 'lock_p', name: 'A', qty: '2' } });
  await free.ctx.bookingV2SubCommit();
  assert.deepEqual(free.alerts, ['ที่นั่งในล็อกแม่ไม่พอ · เพิ่มที่นั่งให้ล็อกแม่อัตโนมัติ 1 ที่']);
});

test('the dialogs drop legacy\'s limit, and Manage keeps "+ กรุ๊ปย่อย" on a fully split lock', () => {
  const rel = '<button onclick="bookingV2LockReleaseConfirm(\'lk1\')" style="x">ปล่อย</button>';
  const html = '<div>ยังไม่จัด <b>0</b> ที่ · แบ่งได้ไม่เกินนี้</div>'
    + '<input type="number" min="1" max="0" value="" oninput="bookingV2SubSet(\'qty\',this.value)">'
    + 'เพิ่มแล้วที่นั่งจะถูกกันออกจาก pool ที่ขายได้ทันที · กรุ๊ปย่อยเพิ่มได้ไม่เกินที่ล็อกแม่ยังไม่ได้แบ่ง</div>' + rel;
  const w = world(null, { _bkV2LockManageId: 'lk1', __orig: () => html }, overlays);
  const out = w.ctx.bookingV2LockOverlays();
  assert.match(out, /ที่ · ใส่เกินได้ · ล็อกแม่จะเพิ่มที่นั่งให้อัตโนมัติ/);
  assert.doesNotMatch(out, /max="0"/);
  assert.match(out, /กรุ๊ปย่อยที่ที่นั่งไม่พอ ล็อกแม่จะเพิ่มที่นั่งให้อัตโนมัติ/);
  assert.ok(out.indexOf('bookingV2SubOpen(\'lk1\')') >= 0 && out.indexOf('bookingV2SubOpen(\'lk1\')') < out.indexOf(rel), 'the button, before ปล่อย');
  const twice = world(null, { _bkV2LockManageId: 'lk1', __orig: () => out }, overlays).ctx.bookingV2LockOverlays();
  assert.equal(twice.split('bookingV2SubOpen(\'lk1\')').length, 2, 'never two buttons');
  const none = world(null, { _bkV2LockManageId: null, __orig: () => rel }, overlays).ctx.bookingV2LockOverlays();
  assert.equal(none, rel, 'no Manage panel open: untouched');
});

test('"+ ที่นั่ง" and edit send auto_adjust on a sub-group only', () => {
  const add = between(file, "def('bookingV2LockAddSubmit'", '/* ── release seats');
  assert.match(add, /if\(L\.parentId\) b\.auto_adjust = true;/);
  assert.match(add, /render\(\); autoAdjusted\(r\); \}\);/);
  const edit = between(file, "def('bookingV2LockEditSubmit'", '/* ── whole-boat holds');
  assert.match(between(edit, 'if(L.parentId){', '} else {'), /if\(body\.pax !== undefined\) body\.auto_adjust = true;/);
  assert.match(edit, /render\(\); autoAdjusted\(r\); \}\);/);
});
