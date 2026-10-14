import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const B2C = fs.readFileSync('allotment_v2/js/ops/44-ops-b2c-health.js', 'utf8');

function runtime({ held = [], postFail = null } = {}) {
  const calls = [], fails = [], painted = { html: null };
  let open = held.slice();
  const O = {
    enabled: () => true,
    get: async (p) => {
      calls.push('GET ' + p);
      if (p.startsWith('/v1/b2c/held-orders')) return { held_orders: open };
      return { held_orders: open, issues: [], counts: { held: open.length, warn: 0, info: 0 }, signature: 's' };
    },
    post: async (p, b) => {
      calls.push('POST ' + p + ' ' + JSON.stringify(b));
      if (postFail) { const e = new Error(postFail); e.status = 409; throw e; }
      open = open.filter((h) => !p.includes('/' + h.id + '/'));
      return {};
    },
    queue: (fn) => fn(),
    fail: (t, e) => fails.push(t + ': ' + e.message),
    toast: () => {},
  };
  const sec = { id: 'la-b2c-held', remove() { painted.html = null; }, set innerHTML(v) { painted.html = v; } };
  const box = { innerHTML: '', querySelector: () => null, appendChild() {} };
  const document = {
    readyState: 'complete', hidden: false,
    getElementById: (id) => (id === 'la-b2c-issues-list' ? box : id === 'la-b2c-held' ? sec : null),
    createElement: () => sec,
  };
  const window = { laOps: O, confirm: () => true, _laB2CIssues() {} };
  vm.runInNewContext(B2C, { window, document, Promise, Array, Object, Error, String, Number, encodeURIComponent, setTimeout: () => 0, setInterval: () => 0 });
  return { window, calls, fails, painted };
}

const H = [{ id: 'h1', external_id: 'LK-1', problem: 'closed day' }];

test('held order Resolve posts to the server, then re-lists and repaints empty', async () => {
  const rt = runtime({ held: H });
  const ok = await rt.window.laOps.b2cHealth.heldAct('h1', 'resolve');
  assert.equal(ok, true);
  assert.ok(rt.calls.includes('POST /v1/b2c/held-orders/h1/resolve {}'));
  assert.ok(rt.calls.indexOf('GET /v1/b2c/held-orders?status=open') > rt.calls.findIndex((c) => c.startsWith('POST')));
  assert.equal(rt.painted.html, null);
});

test('held order Dismiss refusal shows the server message and keeps the row', async () => {
  const rt = runtime({ held: H, postFail: 'already resolved' });
  const ok = await rt.window.laOps.b2cHealth.heldAct('h1', 'dismiss');
  assert.equal(ok, false);
  assert.match(rt.fails[0], /already resolved/);
  assert.match(rt.painted.html, /LK-1/);
});

test('dismiss declined in the confirm box sends nothing', async () => {
  const rt = runtime({ held: H });
  rt.window.confirm = () => false;
  assert.equal(await rt.window.laOps.b2cHealth.heldAct('h1', 'dismiss'), false);
  assert.equal(rt.calls.length, 0);
});

test('panel list: held rows leave the issue list and get their own buttons', async () => {
  const rt = runtime({ held: H });
  const got = await new Promise((ok, no) => rt.window.laOpsB2CIssues(ok, no));
  assert.equal(got.issues.length, 0);
  await new Promise((r) => setImmediate(r));
  assert.match(rt.painted.html, /laOpsHeldBtn/);
  assert.match(rt.painted.html, /data-c="dismiss"/);
});
