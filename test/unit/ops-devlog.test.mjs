import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

/* vm tests for ops/63-ops-devlog.js · laOps is stubbed, nothing here reaches a network. */
const source = fs.readFileSync(process.env.DEVLOG_FILE || 'allotment_v2/js/ops/63-ops-devlog.js', 'utf8');

const N = (id, extra = {}) => ({ id, text: 'note ' + id, tag: 'task', done: false, at: 1000, by: 'Admin', doneAt: null, doneBy: null, ...extra });

function harness({ enabled = true, admin = true, list = [N('a'), N('b')], version = 3 } = {}) {
  const calls = [], local = [], errors = [], repaints = [];
  const server = { value: list, version, beforePut: null, deny: null };
  let chain = Promise.resolve();
  const ctx = {
    console, Promise, setTimeout, clearTimeout, Date, JSON,
    document: { getElementById: id => (id === 'devlog-host' ? {} : null), querySelector: () => null },
    /* the legacy functions, as 08-app.js has them (blob based) */
    devlogLoad() { local.push('load'); return []; },
    devlogSave(arr) { local.push(['save', arr.length]); },
    devlogIsAdmin() { return admin; },
    renderDevLog() { repaints.push(ctx.devlogLoad().map(x => x.id + (x.done ? '*' : ''))); },
  };
  ctx.window = ctx;
  ctx.laOps = {
    enabled: () => enabled, state: { loaded: true }, busy: () => false,
    clone: v => (v == null ? v : JSON.parse(JSON.stringify(v))),
    fail: (t, e) => errors.push([t, e.message, e.code]),
    queue(fn) { const p = chain.then(fn); chain = p.catch(() => {}); return p; },
    get: async p => { calls.push(['GET', p]); return { key: 'admin_devlog', value: JSON.parse(JSON.stringify(server.value)), version: server.version }; },
    call: async (m, p, body) => {
      calls.push([m, p, JSON.parse(JSON.stringify(body))]);
      if (server.beforePut) { const f = server.beforePut; server.beforePut = null; f(); }
      if (server.deny) throw Object.assign(new Error(server.deny.message), server.deny);
      if (body.version != null && body.version !== server.version) throw Object.assign(new Error('stale'), { status: 409, code: 'stale_version' });
      server.value = body.value; server.version++;
      return { key: 'admin_devlog', value: JSON.parse(JSON.stringify(server.value)), version: server.version };
    },
  };
  ctx.laOps.configStore = {
    active: () => enabled && !ctx.LA_ME?.agentId,
    redraw: () => repaints.push('redraw'),
    cell(title, fetch) {
      const c = { title, loaded: false, loading: null };
      c.load = () => (c.loading ||= fetch().then(() => { c.loaded = true; c.loading = null; }));
      c.miss = () => { c.load().then(() => ctx.renderDevLog()); };
      return c;
    },
  };
  vm.createContext(ctx); vm.runInContext(source, ctx);
  return { ctx, calls, local, errors, repaints, server };
}
const tick = () => new Promise(r => setTimeout(r, 10));
const ids = l => l.map(x => x.id + (x.done ? '*' : ''));
const puts = h => h.calls.filter(c => c[0] === 'PUT');

test('load: devlogLoad answers the server list (a copy), never the blob', async () => {
  const h = await (async () => { const x = harness(); await tick(); return x; })();
  assert.deepEqual(h.calls[0], ['GET', '/v1/config/admin_devlog']);
  const l = h.ctx.devlogLoad();
  assert.deepEqual(ids(l), ['a', 'b']);
  l[0].text = 'changed'; assert.equal(h.ctx.devlogLoad()[0].text, 'note a', 'reads are copies');
  assert.deepEqual(h.local, [], 'the blob is never touched');
});

test('add: the new note goes to the server as the whole list with the version read; the screen shows it at once', async () => {
  const h = harness(); await tick();
  const arr = h.ctx.devlogLoad(); arr.unshift(N('new', { text: 'ระบบ' }));
  h.ctx.devlogSave(arr);
  assert.deepEqual(ids(h.ctx.devlogLoad()), ['new', 'a', 'b'], 'shown before the answer');
  await tick();
  const p = puts(h); assert.equal(p.length, 1);
  assert.equal(p[0][2].version, 3);
  assert.deepEqual(ids(p[0][2].value), ['new', 'a', 'b']);
  assert.equal(p[0][2].value[0].text, 'ระบบ');
  assert.deepEqual(ids(h.server.value), ['new', 'a', 'b']);
  assert.deepEqual(h.local, []);
});

test('toggle and delete: each is one write with the done stamp / without the note', async () => {
  const h = harness(); await tick();
  let arr = h.ctx.devlogLoad(); arr[0].done = true; arr[0].doneAt = 5000; arr[0].doneBy = 'Tata';
  h.ctx.devlogSave(arr); await tick();
  assert.deepEqual(h.server.value[0], N('a', { done: true, doneAt: 5000, doneBy: 'Tata' }));
  arr = h.ctx.devlogLoad().filter(x => x.id !== 'b');
  h.ctx.devlogSave(arr); await tick();
  assert.deepEqual(ids(h.server.value), ['a*']);
  assert.equal(puts(h).length, 2);
  assert.equal(puts(h)[1][2].version, 4, 'the second write carries the version the first answered');
});

test('409 stale_version: reads the list again and applies the same action to it, losing neither note', async () => {
  const h = harness(); await tick();
  /* another admin saves between our read and our write */
  h.server.beforePut = () => { h.server.value = [N('theirs'), ...h.server.value]; h.server.version++; };
  const arr = h.ctx.devlogLoad(); arr.unshift(N('mine'));
  h.ctx.devlogSave(arr); await tick();
  assert.deepEqual(ids(h.server.value), ['mine', 'theirs', 'a', 'b'], 'both notes survive');
  assert.equal(puts(h).length, 2, 'refused once, sent again');
  assert.equal(h.calls.filter(c => c[0] === 'GET').length, 2, 'the list was read again');
  assert.deepEqual(ids(h.ctx.devlogLoad()), ['mine', 'theirs', 'a', 'b'], 'and the screen shows the merge');
  assert.deepEqual(h.errors, []);
});

test('409 on a tick and a delete re-applies to the fresh list too', async () => {
  const h = harness({ list: [N('a'), N('b'), N('c')] }); await tick();
  h.server.beforePut = () => { h.server.value = h.server.value.filter(x => x.id !== 'c'); h.server.value.unshift(N('theirs')); h.server.version++; };
  let arr = h.ctx.devlogLoad(); arr.find(x => x.id === 'a').done = true; arr.find(x => x.id === 'a').doneAt = 9; arr.find(x => x.id === 'a').doneBy = 'T';
  h.ctx.devlogSave(arr); await tick();
  assert.deepEqual(ids(h.server.value), ['theirs', 'a*', 'b']);
  h.server.beforePut = () => { h.server.value = [N('x2'), ...h.server.value]; h.server.version++; };
  h.ctx.devlogSave(h.ctx.devlogLoad().filter(x => x.id !== 'b')); await tick();
  assert.deepEqual(ids(h.server.value), ['x2', 'theirs', 'a*']);
});

test('a refused save is taken off the screen again, with the server message', async () => {
  const h = harness(); await tick();
  h.server.deny = { status: 403, code: 'forbidden', message: 'Only an admin may do this' };
  const arr = h.ctx.devlogLoad(); arr.unshift(N('nope'));
  h.ctx.devlogSave(arr);
  assert.deepEqual(ids(h.ctx.devlogLoad()), ['nope', 'a', 'b']);
  await tick();
  assert.deepEqual(ids(h.ctx.devlogLoad()), ['a', 'b']);
  assert.deepEqual(h.errors, [['System Log note not saved', 'Only an admin may do this', 'forbidden']]);
});

test('legacy mode (ops off) and a non-admin login: the blob functions run unchanged, nothing is requested', async () => {
  for (const o of [{ enabled: false }, { admin: false }]) {
    const h = harness(o); await tick();
    h.ctx.devlogLoad(); h.ctx.devlogSave([N('z')]);
    assert.deepEqual(h.local, ['load', ['save', 1]]);
    assert.deepEqual(h.calls, []);
  }
});

test('saving before the first answer is refused with a message, not sent blind', async () => {
  const h = harness();
  h.ctx.devlogSave([N('early')]);
  assert.equal(puts(h).length, 0);
  assert.equal(h.errors.length, 1);
});
