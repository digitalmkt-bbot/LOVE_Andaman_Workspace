import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const USERS = fs.readFileSync('allotment_v2/js/ops/14-ops-users.js', 'utf8');
const B2C = fs.readFileSync('allotment_v2/js/ops/44-ops-b2c-health.js', 'utf8');

// Fake synchronous XHR: records the call and answers from a table keyed "METHOD /path".
function runtime({ enabled = true, answers = {} } = {}) {
  const sent = [];
  class XHR {
    open(m, url) { this.m = m; this.path = url.replace('https://ops.test', ''); this.h = {}; }
    setRequestHeader(k, v) { this.h[k] = v; }
    send(body) {
      sent.push({ key: this.m + ' ' + this.path, body: body ? JSON.parse(body) : null, auth: this.h.Authorization });
      const a = answers[this.m + ' ' + this.path] || [404, { message: 'nope' }];
      this.status = a[0]; this.responseText = JSON.stringify(a[1]);
    }
  }
  const getCalls = [];
  const badges = [];
  const window = {
    LA_OPS_BACKEND: 'https://ops.test',
    laOps: {
      enabled: () => enabled,
      get: (p) => { getCalls.push(p); const a = answers['GET ' + p]; return a ? Promise.resolve(a[1]) : Promise.reject(new Error('down')); },
    },
    _laB2CIssues: (h) => badges.push(h),
  };
  const ctx = { window, XMLHttpRequest: XHR, sessionStorage: { getItem: () => 'tok', removeItem() {} }, location: { reload() {} }, JSON, Promise, Array, Object, Error, String, Number, encodeURIComponent, setTimeout: () => 0, setInterval: () => 0 };
  vm.runInNewContext(USERS, ctx);
  vm.runInNewContext(B2C, ctx);
  return { window, sent, getCalls, badges };
}

const SRV_USER = { id: 7, username: 'RSVN07', name: 'Joy', role: 'staff', dept: 'rsvn', sales_id: 's1', agent_id: null, edit_areas: ['sales'], view_perms: ['agents', '*explicit'], actions: ['act-approve'], disabled_at: null };

test('list maps server users to the legacy rows and hides disabled logins', () => {
  const rt = runtime({ answers: { 'GET /v1/users': [200, { users: [SRV_USER, { ...SRV_USER, id: 8, disabled_at: '2026-10-01' }] }] } });
  const r = rt.window.laOpsUsersSx('GET', '/api/users');
  assert.equal(r.status, 200);
  assert.equal(r.json.users.length, 1);
  const u = r.json.users[0];
  assert.deepEqual(JSON.parse(JSON.stringify(u.perms)), ['agents', '*explicit', 'act-approve']);
  assert.deepEqual(JSON.parse(JSON.stringify(u.editAreas)), ['sales']);
  assert.equal(u.salesId, 's1');
  assert.equal(rt.sent[0].auth, 'Bearer tok');
});

test('perms save splits act keys into actions and uses PATCH', () => {
  const rt = runtime({ answers: { 'PATCH /v1/users/7': [200, SRV_USER] } });
  const r = rt.window.laOpsUsersSx('POST', '/api/users/perms', JSON.stringify({ id: 7, role: 'staff', dept: 'rsvn', perms: ['agents', 'act-approve', '*explicit'], editAreas: ['sales'], salesId: 's1' }));
  assert.equal(r.status, 200);
  assert.deepEqual(rt.sent[0].body, { role: 'staff', dept: 'rsvn', sales_id: 's1', edit_areas: ['sales'], view_perms: ['agents', '*explicit'], actions: ['act-approve'] });
});

test('create answers 200 for the server 201 and sends password', () => {
  const rt = runtime({ answers: { 'POST /v1/users': [201, SRV_USER] } });
  const r = rt.window.laOpsUsersSx('POST', '/api/users', JSON.stringify({ username: 'RSVN07', name: '', password: 'secret1', role: 'staff', dept: 'rsvn', perms: ['agents'], editAreas: [], salesId: '' }));
  assert.equal(r.status, 200);
  assert.equal(rt.sent[0].body.password, 'secret1');
  assert.equal(rt.sent[0].body.name, 'RSVN07');
  assert.equal(rt.sent[0].body.sales_id, null);
});

test('password reset posts to the user id', () => {
  const rt = runtime({ answers: { 'POST /v1/users/7/password': [200, SRV_USER] } });
  assert.equal(rt.window.laOpsUsersSx('POST', '/api/users/password', JSON.stringify({ id: 7, password: 'abcdef' })).status, 200);
  assert.deepEqual(rt.sent[0].body, { password: 'abcdef' });
});

test('delete disables the login instead', () => {
  const rt = runtime({ answers: { 'PATCH /v1/users/7': [200, SRV_USER] } });
  assert.equal(rt.window.laOpsUsersSx('DELETE', '/api/users?id=7').status, 200);
  assert.deepEqual(rt.sent[0].body, { disabled: true });
});

test('a refusal keeps the server message and a non-200 status', () => {
  const rt = runtime({ answers: { 'PATCH /v1/users/7': [400, { message: 'An admin cannot disable or demote their own login' }] } });
  const r = rt.window.laOpsUsersSx('DELETE', '/api/users?id=7');
  assert.equal(r.status, 400);
  assert.match(r.json.error, /cannot disable/);
});

test('operation mode off leaves sx on its legacy path', () => {
  const rt = runtime({ enabled: false });
  assert.equal(rt.window.laOpsUsersSx('GET', '/api/users'), null);
  assert.equal(rt.sent.length, 0);
});

test('b2c panel rows come from issues and held orders; badge from counts and signature', async () => {
  const j = { held_orders: [{ id: 'h1', booking_id: null, external_id: 'LK-1', problem: 'closed day' }],
    issues: [{ booking_id: 'b9', external_id: 'LK-9', code: 'nat_unread', severity: 'warn', message: 'bad nat' }],
    counts: { held: 1, warn: 1, info: 0 }, signature: 'abc123' };
  const rt = runtime({ answers: { 'GET /v1/b2c/issues': [200, j] } });
  const got = await new Promise((ok, no) => rt.window.laOpsB2CIssues(ok, no));
  assert.equal(got.issues.length, 2);
  assert.equal(got.issues[0].ref, 'LK-1');
  assert.equal(got.issues[1].id, 'b9');
  assert.equal(got.issues[1].msg, 'bad nat');
  rt.window.laOps.b2cHealth.poll();
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(JSON.parse(JSON.stringify(rt.badges)), [{ issueCount: 2, issueSig: 'abc123' }]);
});

test('b2c list failure calls fail', async () => {
  const rt = runtime();
  await assert.rejects(new Promise((ok, no) => rt.window.laOpsB2CIssues(ok, no)));
});
