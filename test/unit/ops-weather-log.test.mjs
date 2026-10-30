import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SOURCE = fs.readFileSync('allotment_v2/js/ops/99-ops-weather-log.js', 'utf8');

// The adapter in a vm realm: a legacy wxFetch that records what it was asked, and a laOps that records server calls.
// answers: 'METHOD /path' → value | Error.
function runtime({ enabled = true, answers = {} } = {}) {
  const legacy = [], calls = [];
  const respond = (method, path, body) => {
    calls.push(method + ' ' + path + (body === undefined ? '' : ' ' + JSON.stringify(body)));
    const a = answers[method + ' ' + path];
    return a instanceof Error ? Promise.reject(a) : Promise.resolve(a === undefined ? {} : a);
  };
  const window = {
    wxFetch: (url, opt) => { legacy.push([url, opt && opt.method || 'GET']); return Promise.resolve({ legacy: true }); },
    laOps: {
      enabled: () => enabled,
      get: (p) => respond('GET', p),
      call: (method, p, body) => respond(method, p, body),
    },
  };
  window.window = window;
  vm.runInNewContext(SOURCE, window);
  return { window, legacy, calls };
}

test('wxFetch\'s legacy paths go to /v1/weather with their query, the method kept', async () => {
  const rt = runtime({ answers: { 'GET /v1/weather/points': { points: [{ id: 'similan' }] } } });
  const wx = rt.window.wxFetch;
  assert.equal(wx.__opsWx, true);
  assert.deepEqual(JSON.parse(JSON.stringify(await wx('/api/weather/points'))), { points: [{ id: 'similan' }] });
  await wx('/api/weather?from=2026-10-01&to=2026-10-07');
  await wx('/api/weather?from=2026-06-01&to=2026-10-30');
  await wx('/api/weather/fetch?date=2026-10-31&kind=fc05', { method: 'POST' });
  await wx('/api/weather/backfill?from=2026-06-01', { method: 'post' });
  await wx('/api/weather/backfill');
  assert.deepEqual(rt.calls, [
    'GET /v1/weather/points',
    'GET /v1/weather?from=2026-10-01&to=2026-10-07',
    'GET /v1/weather?from=2026-06-01&to=2026-10-30',
    'POST /v1/weather/fetch?date=2026-10-31&kind=fc05',
    'POST /v1/weather/backfill?from=2026-06-01',
    'GET /v1/weather/backfill',
  ]);
  assert.deepEqual(rt.legacy, [], 'legacy server.js is never asked in ops mode');
});

test('§wx2: the decision log reads and writes /v1/weather with 12-weather.js\'s JSON body, and hands back the server\'s answer', async () => {
  const log = { decisions: [{ point_id: 'phiphi' }], reports: [] };
  const rt = runtime({ answers: { 'GET /v1/weather/log?from=2026-10-01&to=2026-10-31': log, 'POST /v1/weather/decision': { ok: true, by: 'ops', at: 'now' } } });
  const post = (body) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const wx = rt.window.wxFetch;
  assert.deepEqual(JSON.parse(JSON.stringify(await wx('/api/weather/log?from=2026-10-01&to=2026-10-31'))), log);
  const saved = await wx('/api/weather/decision', post({ pointId: 'phiphi', date: '2026-10-31', decision: 'ran_part', reason: 'swell' }));
  assert.equal(saved.by, 'ops');
  await wx('/api/weather/turnback', post({ pointId: 'phiphi', date: '2026-10-31', list: [{ bid: 'b1' }] }));
  await wx('/api/weather/report', post({ date: '2026-10-31', boatId: 'b1', sea: 3 }));
  assert.deepEqual(rt.calls, [
    'GET /v1/weather/log?from=2026-10-01&to=2026-10-31',
    'POST /v1/weather/decision {"pointId":"phiphi","date":"2026-10-31","decision":"ran_part","reason":"swell"}',
    'POST /v1/weather/turnback {"pointId":"phiphi","date":"2026-10-31","list":[{"bid":"b1"}]}',
    'POST /v1/weather/report {"date":"2026-10-31","boatId":"b1","sea":3}',
  ]);
  assert.deepEqual(rt.legacy, []);
});

test('a refusal rejects with the server\'s message, so 12-weather.js logs it (card stays empty) or alerts it (buttons)', async () => {
  const no = Object.assign(new Error('Needs the operations area'), { status: 403, code: 'forbidden' });
  const rt = runtime({ answers: { 'POST /v1/weather/backfill?from=2026-06-01': no, 'GET /v1/weather/points': new Error('HTTP 404') } });
  await assert.rejects(rt.window.wxFetch('/api/weather/backfill?from=2026-06-01', { method: 'POST' }), /Needs the operations area/);
  await assert.rejects(rt.window.wxFetch('/api/weather/points'), /HTTP 404/);
});

test('not in ops mode, or not a weather path: legacy\'s wxFetch, untouched', async () => {
  const off = runtime({ enabled: false });
  await off.window.wxFetch('/api/weather/points');
  assert.deepEqual(off.calls, []);
  assert.deepEqual(off.legacy, [['/api/weather/points', 'GET']]);

  const on = runtime();
  for (const url of ['/api/weather-closures', '/api/weatherx', '/api/load', '/api/weather/other']) await on.window.wxFetch(url);
  assert.deepEqual(on.calls, []);
  assert.equal(on.legacy.length, 4);
  assert.equal(on.window.wxFetch.opsPath('/api/weather?from=2026-10-01'), '/v1/weather?from=2026-10-01');
});

test('loading twice wraps once', () => {
  const rt = runtime();
  const first = rt.window.wxFetch;
  vm.runInNewContext(SOURCE, rt.window);
  assert.equal(rt.window.wxFetch, first);
});
