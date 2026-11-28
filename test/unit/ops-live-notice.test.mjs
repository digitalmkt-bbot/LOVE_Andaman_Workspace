import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// §liveNotice (2026-11-28) · another person's booking changes: one bottom-left card per action and person, readable codes.
function fakeEl(tag) {
  const el = {
    tagName: tag, children: [], attrs: {}, innerHTML: '', id: '', className: '', parentNode: null,
    classList: { add(c) { el.className += ' ' + c; } },
    setAttribute(k, v) { el.attrs[k] = v; },
    appendChild(c) { c.parentNode = el; el.children.push(c); return c; },
    removeChild(c) { el.children.splice(el.children.indexOf(c), 1); c.parentNode = null; return c; },
    get firstChild() { return el.children[0]; },
    querySelector() { return { addEventListener() {} }; },
    addEventListener() {},
  };
  return el;
}
async function feed(changes, win = {}) {
  const body = fakeEl('body');
  const document = {
    hidden: false, body, addEventListener() {}, querySelector: () => null,
    createElement: fakeEl,
    getElementById: (id) => body.children.find((c) => c.id === id) || null,
  };
  let calls = 0;
  const laOps = {
    enabled: () => true, state: { loaded: true }, changed() {}, wrote() {}, toast() { throw new Error('no save toast for remote changes'); },
    get: async () => (++calls === 1 ? { version: 1, changes: [] } : { version: 99, changes }),
  };
  const window = { LA_LEGACY_UNAVAILABLE: true, LA_ME: { username: 'me' }, laOps, ...win };
  const ctx = { window, document, console, Promise, Number, Array, String, Object, JSON, Math, Date,
    setInterval: () => 0, setTimeout: () => 0, clearTimeout() {}, SB_BOOKINGS: win.SB_BOOKINGS };
  vm.runInNewContext(fs.readFileSync('allotment_v2/js/ops/70-ops-changes.js', 'utf8'), ctx);
  await laOps.changes.pull(); await new Promise((r) => setImmediate(r));
  await laOps.changes.pull(); await new Promise((r) => setImmediate(r));
  const wrap = body.children.find((c) => c.id === 'la-live-wrap');
  return wrap ? wrap.children.map((c) => c.innerHTML) : [];
}
const bk = (action, id, by, v) => ({ kind: 'booking', action, entity_id: id, changed_by: by, version: v });

test('a run of re-confirms by one person is one card with a count, no list of codes', async () => {
  const cards = await feed([1, 2, 3, 4, 5].map((i) => bk('updated', 'lg_BK-2611469' + i + '-AAAA', 'RSVN05', 1 + i)));
  assert.equal(cards.length, 1);
  assert.match(cards[0], /อัปเดต booking 5 ใบ/);
  assert.doesNotMatch(cards[0], /BK-26114691/);
  assert.match(cards[0], /โดย RSVN05/);
});

test('one or two bookings show their codes, never lg_ or booking_<uuid>', async () => {
  const two = await feed([bk('updated', 'lg_BK-1-A', 'RSVN05', 2), bk('updated', 'lg_BK-2-B', 'RSVN05', 3)]);
  assert.match(two[0], /<span>BK-1-A<\/span> <span>BK-2-B<\/span>/);
  assert.doesNotMatch(two[0], /lg_BK/);
  const id = 'booking_203a2127-acd4-4b7e-8096-7a58bff59e6a';
  const bare = await feed([bk('created', id, 'RSVN.Trainee01', 2)]);
  assert.match(bare[0], /Booking ใหม่/);
  assert.doesNotMatch(bare[0], /booking_203a/);
  const known = await feed([bk('created', id, 'RSVN.Trainee01', 2)], { SB_BOOKINGS: [{ id: 'x', opsId: id, code: 'BK-26114699-ZZZZ' }] });
  assert.match(known[0], /BK-26114699-ZZZZ/);
});

test('different people and actions share ONE card with counts', async () => {
  const cards = await feed([bk('updated', 'lg_BK-1', 'A', 2), bk('updated', 'lg_BK-2', 'B', 3), bk('created', 'lg_BK-3', 'A', 4), bk('deleted', 'lg_BK-4', 'C', 5)]);
  assert.equal(cards.length, 1);
  assert.match(cards[0], /มีการเปลี่ยนแปลง booking 4 ใบ/);
  assert.match(cards[0], /ใหม่ 1 · อัปเดต 2 · ลบ 1/);
  assert.match(cards[0], /โดย A, B \+1/);
});

test('my own changes and background sync accounts (lk_service) show no card', async () => {
  assert.deepEqual(await feed([bk('updated', 'lg_BK-1', 'me', 2)]), []);
  assert.deepEqual(await feed([1, 2, 3].map((i) => bk('updated', 'b2c_LOV-' + i, 'lk_service', 1 + i))), []);
  const mixed = await feed([bk('updated', 'lg_BK-1', 'lk_service', 2), bk('updated', 'lg_BK-2', 'RSVN05', 3)]);
  assert.equal(mixed.length, 1);
  assert.doesNotMatch(mixed[0], /lk_service/);
});

test('legacy "new data" banner stays away for sync accounts, and hides the live card while it shows', () => {
  const css = fs.readFileSync('allotment_v2/css/01-base.css', 'utf8');
  assert.match(css, /body:has\(#la-refresh\) #la-live-wrap\{display:none\}/);
  const auth = fs.readFileSync('allotment_v2/js/01-auth-sync.js', 'utf8');
  assert.match(auth, /if\(info && _laSysActor\(info\.updated_by\)\) return;/);
});
