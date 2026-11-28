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

// §b2cOnly (2026-11-28) · owner: only B2C-synced bookings pop up; B2B / staff changes draw no bottom-left card.
test('staff booking changes (created, updated, deleted) draw no bottom-left card', async () => {
  assert.deepEqual(await feed([1, 2, 3, 4, 5].map((i) => bk('updated', 'lg_BK-2611469' + i + '-AAAA', 'RSVN05', 1 + i))), []);
  assert.deepEqual(await feed([bk('created', 'booking_203a2127-acd4-4b7e-8096-7a58bff59e6a', 'RSVN.Trainee01', 2)]), []);
  assert.deepEqual(await feed([bk('updated', 'lg_BK-1', 'A', 2), bk('created', 'lg_BK-3', 'A', 4), bk('deleted', 'lg_BK-4', 'C', 5)]), []);
  assert.deepEqual(await feed([1, 2, 3].map((i) => bk('updated', 'b2c_LOV-' + i, 'lk_service', 1 + i))), []);
});

test('the card code is kept behind NOTES_ON = false', () => {
  const src = fs.readFileSync('allotment_v2/js/ops/70-ops-changes.js', 'utf8');
  assert.match(src, /var NOTES_ON = false;/);
  assert.match(src, /b2cCreated\(change\);\n    if\(!NOTES_ON\) return;/);
});

test('legacy "new data" banner stays away for sync accounts, and hides the live card while it shows', () => {
  const css = fs.readFileSync('allotment_v2/css/01-base.css', 'utf8');
  assert.match(css, /body:has\(#la-refresh\) #la-live-wrap\{display:none\}/);
  const auth = fs.readFileSync('allotment_v2/js/01-auth-sync.js', 'utf8');
  assert.match(auth, /if\(info && _laSysActor\(info\.updated_by\)\) return;/);
});

// §b2cPopOps (2026-11-28) · owner chose "Bring back legacy top-right card" for a new B2C booking.
async function b2cFeed(changes, books) {
  const body = fakeEl('body');
  const document = { hidden: false, body, addEventListener() {}, querySelector: () => null, createElement: fakeEl,
    getElementById: (id) => body.children.find((c) => c.id === id) || null };
  let calls = 0; const shown = []; const asked = [];
  const laOps = {
    enabled: () => true, state: { loaded: true }, changed() {}, wrote() {}, toast() {},
    bookings: { fromServer: (ob) => ({ id: ob.external_id || ob.id, opsId: ob.id, agentId: ob.agent_id || null, status: ob.status }) },
    get: async (path) => {
      if (/^\/v1\/bookings\//.test(path)) { asked.push(path); const id = decodeURIComponent(path.split('/').pop()); return books[id]; }
      return ++calls === 1 ? { version: 1, changes: [] } : { version: 99, changes };
    },
  };
  const window = { LA_LEGACY_UNAVAILABLE: true, LA_ME: { username: 'me' }, laOps, _laB2CAlertBookings: (bks) => shown.push(bks) };
  const ctx = { window, document, console, Promise, Number, Array, String, Object, JSON, Math, Date,
    setInterval: () => 0, setTimeout: () => 0, clearTimeout() {}, encodeURIComponent, decodeURIComponent };
  vm.runInNewContext(fs.readFileSync('allotment_v2/js/ops/70-ops-changes.js', 'utf8'), ctx);
  for (let i = 0; i < 2; i++) { await laOps.changes.pull(); for (let k = 0; k < 5; k++) await new Promise((r) => setImmediate(r)); }
  return { shown, asked, live: body.children.find((c) => c.id === 'la-live-wrap') };
}

test('a new B2C booking from lk_service draws the legacy top-right card once, not the bottom-left one', async () => {
  const r = await b2cFeed([bk('created', 'booking_a', 'lk_service', 2), bk('created', 'booking_b', 'lk_service', 3)],
    { booking_a: { id: 'booking_a', external_id: 'b2c_LOV-1_1' }, booking_b: { id: 'booking_b', external_id: 'b2c_LOV-2_1' } });
  assert.equal(r.shown.length, 1);
  assert.deepEqual(r.shown[0].map((b) => b.id), ['b2c_LOV-1_1', 'b2c_LOV-2_1']);
  assert.equal(r.live, undefined);
});

test('updates, my own bookings and non-B2C bookings draw no B2C card', async () => {
  const books = { booking_a: { id: 'booking_a', external_id: 'b2c_LOV-1_1' }, booking_c: { id: 'booking_c', external_id: 'BK-9' } };
  const upd = await b2cFeed([bk('updated', 'booking_a', 'lk_service', 2)], books);
  assert.equal(upd.shown.length, 0); assert.equal(upd.asked.length, 0);
  const own = await b2cFeed([bk('created', 'booking_a', 'me', 2)], books);
  assert.equal(own.shown.length, 0);
  const staff = await b2cFeed([bk('created', 'booking_c', 'RSVN05', 2)], books);
  assert.equal(staff.shown.length, 0);
  const agent = await b2cFeed([bk('created', 'booking_d', 'RSVN05', 2)], { booking_d: { id: 'booking_d', external_id: 'LOV-77', agent_id: 'a_b2c' } });
  assert.equal(agent.shown.length, 1);
});

test('01-auth-sync.js exposes the legacy card for ops mode', () => {
  const src = fs.readFileSync('allotment_v2/js/01-auth-sync.js', 'utf8');
  assert.match(src, /window\._laB2CAlertBookings=function/);
  assert.match(src, /out\.push\(_laB2CItem\(b, rm\)\)/);
});
