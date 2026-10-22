import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SOURCE = fs.readFileSync('allotment_v2/js/ops/00-ops-core.js', 'utf8');

function core(){
  const handlers = {};
  const window = { addEventListener: (n, f) => { handlers[n] = f; }, location: { search: '', hostname: 'x' }, sessionStorage: { getItem: () => null, setItem(){}, removeItem(){} } };
  const document = { getElementById: () => null, body: null, addEventListener(){} };
  vm.runInNewContext(SOURCE, { window, document, console, Promise, Object, JSON, Date, setTimeout, clearTimeout, Number, String, Array, Math, location: window.location, sessionStorage: window.sessionStorage }, {});
  return { O: window.laOps, handlers };
}

test('a reload while writes wait in the queue is warned about; an empty queue is not', async () => {
  const { O, handlers } = core();
  assert.equal(O.pending(), 0);
  const warn = () => { const ev = { prevented: false, preventDefault(){ this.prevented = true; } }; handlers.beforeunload(ev); return ev.prevented; };
  assert.equal(warn(), false);
  let release;
  const slow = O.queue(() => new Promise(r => { release = r; }));
  const behind = O.queue(() => 'second');
  assert.equal(O.pending(), 2);
  assert.equal(warn(), true);
  await new Promise(r => setTimeout(r, 0));
  release('ok');
  await slow; await behind;
  await new Promise(r => setTimeout(r, 0));
  assert.equal(O.pending(), 0);
  assert.equal(warn(), false);
});

test('a failed write still leaves the queue', async () => {
  const { O } = core();
  await O.queue(() => Promise.reject(new Error('refused'))).catch(() => {});
  await new Promise(r => setTimeout(r, 0));
  assert.equal(O.pending(), 0);
});
