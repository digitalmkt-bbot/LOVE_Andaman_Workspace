// §bootLater / §bootShare (00-ops-core.js): background loads after the first draw, two at a time, and identical GETs in flight sent once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runtime, plain } from './fe-harness.mjs';

const tick = () => new Promise((r) => setImmediate(r));
// a GET whose answer arrives only when the test releases it
function gate() {
  const waiting = [];
  return { handler: () => new Promise((resolve) => waiting.push(resolve)), release: (body) => { const r = waiting.shift(); r && r({ body }); }, get size() { return waiting.length; } };
}

test('queued loads wait for start(), then run by rank, two at a time', async () => {
  // the harness's setTimeout runs at once; the queue's 20 s fallback start must not fire here
  const { O, settle } = runtime({ globals: { setTimeout: () => 0, clearTimeout: () => {} } });
  const ran = [], free = [];
  const job = (name) => () => new Promise((resolve) => { ran.push(name); free.push(resolve); });
  O.later('assets', job('assets'), 5);
  O.later('money', job('money'), 1);
  O.later('jobs', job('jobs'), 2);
  O.later('daily', job('daily'), 4);
  await settle();
  assert.deepEqual(ran, [], 'nothing runs before the boot starts the queue');
  let finished = 0;
  O.later.whenDone(() => { finished++; });
  O.later.start();
  await settle();
  assert.deepEqual(ran, ['money', 'jobs'], 'lowest ranks first, two at a time');
  free.shift()(); await settle();
  assert.deepEqual(ran, ['money', 'jobs', 'daily'], 'a finished load lets the next one in');
  assert.equal(O.later.done(), false);
  while (free.length) { free.shift()(); await settle(); }
  assert.deepEqual(ran, ['money', 'jobs', 'daily', 'assets']);
  assert.equal(O.later.done(), true);
  assert.equal(finished, 1, 'whenDone fires once, when all are in');
});

test('now() runs everything left at once; a failed load still counts as finished', async () => {
  const { O, settle } = runtime();
  const ran = [];
  O.later('a', () => { ran.push('a'); return new Promise(() => {}); }, 1);   // never finishes
  O.later('b', () => { ran.push('b'); return Promise.reject(new Error('down')); }, 2);
  O.later('c', () => { ran.push('c'); return Promise.resolve(); }, 3);
  O.later.now();
  await settle();
  assert.deepEqual(ran, ['a', 'b', 'c'], 'all three started together');
  assert.deepEqual(plain(O.later.names()), ['a …', 'b ✓', 'c ✓']);
});

test('a load with views waits for one of its screens: start() and done() leave it out, open(view) runs it once', async () => {
  const { O, settle } = runtime({ globals: { setTimeout: () => 0, clearTimeout: () => {} } });
  const ran = [];
  O.later('jobs', () => { ran.push('jobs'); return Promise.resolve(); }, 2);
  O.later('stock', () => { ran.push('stock'); return Promise.resolve(); }, 3, ['fl-*']);
  O.later('market', () => { ran.push('market'); return Promise.resolve(); }, 6, ['marketdata', 'pickupmap']);
  let finished = 0;
  O.later.whenDone(() => { finished++; });
  O.later.start();
  await settle();
  assert.deepEqual(ran, ['jobs'], 'only the load every screen needs runs after the first draw');
  assert.equal(O.later.done(), true, 'done() means the loads every screen needs are in');
  assert.equal(finished, 1);

  assert.equal(await O.later.open('dashboard'), false, 'a screen none of them is for starts nothing');
  assert.equal(await O.later.open('fl-inventory'), true, "a fleet screen starts the 'fl-*' load and asks for a redraw");
  assert.deepEqual(ran, ['jobs', 'stock']);
  assert.equal(await O.later.open('fl-work'), false, 'the next fleet screen finds it loaded: no second request, no redraw');
  assert.equal(await O.later.open('fl'), false, "'fl-*' is a prefix: 'fl' is not one of them");
  assert.equal(await O.later.open('pickupmap'), true, 'an exact view id');
  assert.deepEqual(ran, ['jobs', 'stock', 'market']);
  assert.deepEqual(plain(O.later.names()), ['jobs ✓', 'stock ✓', 'market ✓']);
});

test('open(view) before start() also runs what the queue still holds; now() still runs everything', async () => {
  const { O, settle } = runtime({ globals: { setTimeout: () => 0, clearTimeout: () => {} } });
  const ran = [];
  O.later('money', () => { ran.push('money'); return Promise.resolve(); }, 1);
  O.later('assets', () => { ran.push('assets'); return Promise.resolve(); }, 5, ['fl-*']);
  O.later('market', () => { ran.push('market'); return Promise.resolve(); }, 6, ['marketdata']);
  await O.later.open('booking');
  assert.deepEqual(ran, ['money'], 'a screen opened early gets the shared loads, not other screens\' ones');
  await O.later.now();
  await settle();
  assert.deepEqual(ran, ['money', 'assets', 'market']);
});

test('the same GET asked twice while in flight is sent once; each caller gets its own copy', async () => {
  const g = gate();
  const { O, requests, settle } = runtime({ handlers: { 'GET /v1/boats': g.handler } });
  const a = O.get('/v1/boats'), b = O.get('/v1/boats');
  await tick();
  assert.equal(requests.length, 1);
  g.release({ boats: [{ id: 'b1' }] });
  const [ra, rb] = await Promise.all([a, b]);
  assert.deepEqual(ra, rb);
  assert.notEqual(ra, rb, 'two parsed copies, not one shared object');
  ra.boats[0].id = 'changed';
  assert.equal(rb.boats[0].id, 'b1');
  await settle();
  // after the answer: asking again goes to the server again
  const c = O.get('/v1/boats'); await tick();
  assert.equal(requests.length, 2);
  g.release({ boats: [] }); await c;
});

test('a write in between sends the next GET fresh instead of joining the one in flight', async () => {
  const g = gate();
  const { O, requests, settle } = runtime({ handlers: { 'GET /v1/boats': g.handler, 'PATCH /v1/boats/b1': { id: 'b1' } } });
  const a = O.get('/v1/boats');
  await tick();
  await O.patch('/v1/boats/b1', { name: 'x' });
  const b = O.get('/v1/boats');
  await tick();
  assert.deepEqual(requests.map((r) => r.method + ' ' + r.path), ['GET /v1/boats', 'PATCH /v1/boats/b1', 'GET /v1/boats']);
  g.release({ boats: [] }); g.release({ boats: [] });
  await Promise.all([a, b]); await settle();
});

test('a refused GET is not kept: the next ask goes out again', async () => {
  let n = 0;
  const { O, requests } = runtime({ handlers: { 'GET /v1/boats': () => (++n === 1 ? { status: 500, body: { message: 'down' } } : { body: { boats: [] } }) } });
  await assert.rejects(O.get('/v1/boats'), /down/);
  assert.deepEqual(await O.get('/v1/boats'), { boats: [] });
  assert.equal(requests.length, 2);
});
