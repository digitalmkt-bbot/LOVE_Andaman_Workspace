import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// §ckSse (2026-11-28) · the change feed reads GET /v1/changes/stream with fetch (Bearer) and applies each row like a poll.
const SRC = fs.readFileSync('allotment_v2/js/ops/70-ops-changes.js', 'utf8');
const tick = async (n = 10) => { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); };

function harness({ view = 'piercheckin', status = 200 } = {}) {
  const enc = new TextEncoder();
  let push = null, end = null; const opened = []; const drawn = []; const polls = []; const intervals = [];
  const doc = { hidden: false, hasFocus: () => true, _vis: null,
    querySelector: (s) => (s === '.nav-item.active' ? { dataset: { view } } : null),
    addEventListener(ev, fn) { if (ev === 'visibilitychange') doc._vis = fn; },
    body: { appendChild() {}, classList: { contains: () => false } }, getElementById: () => null,
    createElement: () => ({ setAttribute() {}, appendChild() {}, querySelector: () => null, classList: { add() {} } }) };
  const O = { enabled: () => true, state: { loaded: true }, busy: () => false, changed() {}, wrote() {}, onChange() {}, vanJobs: { dropDay() {} },
    get: async (path, q) => { polls.push(q ? q.since : 'base'); return { version: 5, changes: [] }; } };
  const window = { LA_LEGACY_UNAVAILABLE: true, LA_ME: { username: 'me' }, laOps: O, _pckDate: '2026-11-28', _vanCkDate: '2026-11-28',
    _laRerender: () => drawn.push(Date.now()), addEventListener() {},
    laOpsFetch: (path, opts) => {
      opened.push({ path, opts });
      if (status !== 200) return Promise.resolve({ ok: false, status });
      const q = [];
      let wake = null;
      push = (txt) => { q.push(enc.encode(txt)); if (wake) { const w = wake; wake = null; w(); } };
      end = () => { q.push(null); if (wake) { const w = wake; wake = null; w(); } };
      opts.signal.addEventListener('abort', () => end());
      const reader = { read: () => new Promise((res) => {
        const give = () => { const v = q.shift(); res(v === null ? { done: true } : { done: false, value: v }); };
        if (q.length) give(); else wake = give; }) };
      return Promise.resolve({ ok: true, status: 200, body: { getReader: () => reader } });
    } };
  const ctx = { window, document: doc, console: { warn() {}, log() {} }, Promise, Number, Array, String, Object, JSON, Math, Date,
    TextDecoder, AbortController, setInterval: (fn, ms) => { intervals.push({ fn, ms }); return 0; }, setTimeout: (fn, ms) => (ms ? 0 : (setImmediate(fn), 0)), clearTimeout() {} };
  vm.runInNewContext(SRC, ctx);
  return { O, doc, opened, drawn, polls, intervals, push: (t) => push(t), end: () => end() };
}
const row = (v, by = 'A') => `id: ${v}\nevent: change\ndata: ${JSON.stringify({ version: v, kind: 'booking', action: 'updated', entity_id: 'b' + v, changed_by: by, route_days: [{ route_id: 'r', service_date: '2026-11-28' }] })}\n\n`;

test('opens the stream from the cursor with the Bearer fetch, and a pushed check-in redraws the open screen', async () => {
  const h = harness(); await tick();
  assert.equal(h.opened.length, 1);
  assert.equal(h.opened[0].path, '/v1/changes/stream?since=5');
  assert.equal(h.opened[0].opts.headers.Accept, 'text/event-stream');
  h.push('retry: 5000\n\n'); await tick();
  assert.equal(h.drawn.length, 0);
  h.push(row(6)); await tick();
  assert.equal(h.drawn.length, 1);
  assert.equal(h.O.changes.version(), 6);
  assert.equal(h.O.changes.stream().live, true);
});

test('a row split across chunks, CRLF lines and a duplicate version are handled', async () => {
  const h = harness(); await tick();
  const r = row(7).replace(/\n/g, '\r\n');
  h.push(r.slice(0, 20)); await tick(); assert.equal(h.O.changes.version(), 5);
  h.push(r.slice(20)); await tick(); assert.equal(h.O.changes.version(), 7);
  h.push(row(7)); h.push(row(6)); await tick();
  assert.equal(h.O.changes.version(), 7);
});

test('polls stop while the stream is up and come back when it drops', async () => {
  const h = harness(); await tick();
  const poll20 = h.intervals.find((i) => i.ms === 20000);
  h.push('event: hb\ndata: {"version":5}\n\n'); await tick();
  const before = h.polls.length; poll20.fn(); await tick();
  assert.equal(h.polls.length, before, 'no poll while live');
  h.end(); await tick();
  assert.equal(h.O.changes.stream().open, false);
  assert.ok(h.polls.length > before, 'dropping the stream polls at once');
});

test('a heartbeat ahead of the cursor asks /v1/changes for what was missed', async () => {
  const h = harness(); await tick();
  const n = h.polls.length;
  h.push('event: hb\ndata: {"version":9,"health":{}}\n\n'); await tick();
  assert.equal(h.polls.length, n + 1);
  assert.equal(h.polls[h.polls.length - 1], 5);
});

test('a hidden tab closes its stream and reopens it from the cursor when shown', async () => {
  const h = harness(); await tick();
  h.push(row(8)); await tick();
  h.doc.hidden = true; h.doc._vis(); await tick();
  assert.equal(h.O.changes.stream().open, false);
  h.doc.hidden = false; h.doc._vis(); await tick();
  assert.equal(h.opened.length, 2);
  assert.equal(h.opened[1].path, '/v1/changes/stream?since=8');
});

test('a refused stream falls back to polling', async () => {
  const h = harness({ status: 404 }); await tick();
  assert.equal(h.O.changes.stream().live, false);
  assert.ok(h.polls.length >= 2);
});
