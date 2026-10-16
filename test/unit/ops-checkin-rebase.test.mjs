// Row 75 · "moving a checked-in van row back un-checks it first".  vckStatus runs ckToggle (un-check: at = null) and
// then vckSetFlow (flow = standby) in the same tick.  In ops mode local state changes only when the server answers, so
// the second write was built from the SAME stale record and carried the `at` the first one had just cleared; a PUT is
// the whole record, so the server checked the row in again.  A write issued while another for the same row is in
// flight now takes over what that write changed.
//   node --test test/unit/ops-checkin-rebase.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SOURCE = fs.readFileSync(process.env.DAYACT_SRC || 'allotment_v2/js/ops/36-ops-day-actions.js', 'utf8');

function runtime() {
  const puts = [];
  const gate = [];                                     // each PUT waits until the test lets it answer
  const O = {
    enabled: () => true,
    queue: (fn) => Promise.resolve().then(fn),
    call: (method, path, body) => new Promise((resolve) => { puts.push({ method, path, body }); gate.push(() => resolve({})); }),
    del: async () => ({}), wrote() {}, fail() {},
  };
  const window = { laOps: O, ckWrite: () => 'legacy' };
  const stale = { actualPax: 2, expected: 2, at: '2026-10-12T08:00:00.000Z', by: 'PierStaff', events: [] };
  window.ckRead = () => stale;                          // the local record: unchanged until the server answers
  const bk = { id: 'bk1', trips: [{ date: '2026-10-12', opsTripId: 'trip1' }], ops: {} };
  vm.runInNewContext(SOURCE, {
    window, console, Number, String, Object, Array, JSON, Date, Promise, encodeURIComponent, parseInt, Math,
  });
  const answer = async () => { gate.shift()(); await new Promise((r) => setImmediate(r)); };
  return { window, puts, stale, bk, answer, tick: () => new Promise((r) => setImmediate(r)) };
}

test('un-check then flow in one tick: the flow write does not bring the cleared `at` back', async () => {
  const rt = runtime();
  rt.window.ckWrite(rt.bk, '2026-10-12', 'van', Object.assign({}, rt.stale, { at: null, by: null }));            // ckToggle
  rt.window.ckWrite(rt.bk, '2026-10-12', 'van', Object.assign({}, rt.stale, { flow: 'standby', flowAt: '08:05' })); // vckSetFlow
  await rt.tick();
  assert.equal(rt.puts[0].body.checked_in_at, null);
  await rt.answer(); await rt.tick();
  assert.equal(rt.puts.length, 2);
  assert.equal(rt.puts[1].body.checked_in_at, null, 'the second PUT must not re-check the row in');
  assert.equal(rt.puts[1].body.checked_in_by, null);
  assert.equal(rt.puts[1].body.flow, 'standby');
});

test('a field the later write changes itself is its own: no override', async () => {
  const rt = runtime();
  rt.window.ckWrite(rt.bk, '2026-10-12', 'van', Object.assign({}, rt.stale, { at: null, by: null }));
  rt.window.ckWrite(rt.bk, '2026-10-12', 'van', Object.assign({}, rt.stale, { at: '2026-10-12T09:00:00.000Z', by: 'Other' }));
  await rt.tick(); await rt.answer(); await rt.tick();
  assert.equal(rt.puts[1].body.checked_in_at, '2026-10-12T09:00:00.000Z');
  assert.equal(rt.puts[1].body.checked_in_by, 'Other');
});

test('once the first write has been answered nothing is carried over', async () => {
  const rt = runtime();
  rt.window.ckWrite(rt.bk, '2026-10-12', 'van', Object.assign({}, rt.stale, { at: null, by: null }));
  await rt.tick(); await rt.answer(); await rt.tick();
  rt.window.ckWrite(rt.bk, '2026-10-12', 'van', Object.assign({}, rt.stale, { flow: 'standby' }));   // stale on purpose
  await rt.tick();
  assert.equal(rt.puts[1].body.checked_in_at, '2026-10-12T08:00:00.000Z');
});

test('another row in flight is not touched', async () => {
  const rt = runtime();
  const other = { id: 'bk2', trips: [{ date: '2026-10-12', opsTripId: 'trip2' }], ops: {} };
  rt.window.ckWrite(rt.bk, '2026-10-12', 'van', Object.assign({}, rt.stale, { at: null, by: null }));
  rt.window.ckWrite(other, '2026-10-12', 'van', Object.assign({}, rt.stale, { flow: 'standby' }));
  await rt.tick(); await rt.answer(); await rt.tick();
  assert.equal(rt.puts[1].body.checked_in_at, '2026-10-12T08:00:00.000Z');
});
