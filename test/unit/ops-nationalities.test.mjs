import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SOURCE = fs.readFileSync('allotment_v2/js/ops/28-ops-nationalities.js', 'utf8');

// Stand-in for operation-backend answers, plus the legacy cleanup that must stay untouched in legacy mode.
function runtime({ enabled = true, answers = {}, confirmAnswer = true } = {}) {
  const calls = [];
  const failures = [];
  const wrote = [];
  const legacyCalls = [];
  const alerts = [];
  const SB_CUSTOM_NATIONALITIES = [
    { code: 'CUS', name: 'Ghanaian', custom: true },
    { code: 'USA', name: 'United States', custom: true },
  ];
  const SB_BOOKINGS = [
    { id: 'b1', leadNationality: 'USA', passengers: [{ nationality: 'USA' }, { nationality: 'TH' }] },
    { id: 'b2', leadNationality: 'CUS', passengers: [] },
  ];
  const respond = async (method, path) => {
    calls.push(method + ' ' + path);
    const a = answers[method + ' ' + path];
    if (a instanceof Error) throw a;
    return a;
  };
  const window = {
    laOps: {
      enabled: () => enabled,
      get: (p) => respond('GET', p),
      post: (p, b) => respond('POST', p, b),
      queue: (fn) => Promise.resolve().then(fn),
      wrote: (k) => wrote.push(k),
      fail: (title, e) => failures.push({ title, message: e && e.message }),
    },
    mdCleanupNats: () => { legacyCalls.push('mdCleanupNats'); return 'legacy'; },
  };
  const ctx = {
    window, SB_CUSTOM_NATIONALITIES, SB_BOOKINGS, console, Promise, Array, Object, Error, String,
    confirm: () => confirmAnswer,
    alert: (m) => alerts.push(m),
    renderMarketData: () => {},
    localStorage: { setItem: () => { throw new Error('blob write in ops mode'); }, getItem: () => null },
  };
  vm.runInNewContext(SOURCE, ctx);
  return { window, ctx, calls, failures, wrote, legacyCalls, alerts, SB_CUSTOM_NATIONALITIES, SB_BOOKINGS };
}

const CLEAN_PREVIEW = { removed: 1, kept: 1, bookings_rewritten: 2, passengers_rewritten: 1, folds: [{ from: 'USA', into: 'US', bookings_rewritten: 2, passengers_rewritten: 1 }], dry_run: true };
const CLEAN_RUN = { ...CLEAN_PREVIEW, dry_run: false };

test('load replaces the custom list from the server, keeping versions', async () => {
  const rt = runtime({ answers: { 'GET /v1/nationalities': { nationalities: [
    { code: 'US', name: 'United States', custom: false, version: 1 },
    { code: 'GHA', name: 'Ghanaian', custom: true, version: 3 },
  ] } } });
  await rt.window.laOps.nationalities?.load?.();
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(JSON.parse(JSON.stringify(rt.SB_CUSTOM_NATIONALITIES)), [{ code: 'GHA', name: 'Ghanaian', custom: true, version: 3 }]);
});

test('cancelling the confirm changes nothing after the dry run', async () => {
  const rt = runtime({ confirmAnswer: false, answers: { 'POST /v1/nationalities/cleanup?dry_run=true': CLEAN_PREVIEW } });
  await rt.window.mdCleanupNats();
  assert.deepEqual(rt.calls, ['POST /v1/nationalities/cleanup?dry_run=true']);
  assert.equal(rt.SB_BOOKINGS[0].leadNationality, 'USA');
  assert.equal(rt.SB_CUSTOM_NATIONALITIES.length, 2);
});

test('a confirmed cleanup applies the server folds and writes nothing to the legacy blob', async () => {
  const rt = runtime({ answers: {
    'POST /v1/nationalities/cleanup?dry_run=true': CLEAN_PREVIEW,
    'POST /v1/nationalities/cleanup': CLEAN_RUN,
  } });
  await rt.window.mdCleanupNats();
  assert.deepEqual(rt.calls, ['POST /v1/nationalities/cleanup?dry_run=true', 'POST /v1/nationalities/cleanup']);
  assert.equal(rt.SB_BOOKINGS[0].leadNationality, 'US');
  assert.equal(rt.SB_BOOKINGS[0].passengers[0].nationality, 'US');
  assert.equal(rt.SB_BOOKINGS[0].passengers[1].nationality, 'TH');
  assert.deepEqual(rt.SB_CUSTOM_NATIONALITIES.map((n) => n.code), ['CUS']);
  assert.deepEqual(rt.wrote, ['nationalities']);
});

test('a refused cleanup leaves the bookings and list as they were', async () => {
  const refusal = Object.assign(new Error('server refused'), { code: 'x' });
  const rt = runtime({ answers: {
    'POST /v1/nationalities/cleanup?dry_run=true': CLEAN_PREVIEW,
    'POST /v1/nationalities/cleanup': refusal,
  } });
  await rt.window.mdCleanupNats();
  assert.equal(rt.SB_BOOKINGS[0].leadNationality, 'USA');
  assert.equal(rt.SB_CUSTOM_NATIONALITIES.length, 2);
  assert.equal(rt.failures.length, 1);
  assert.deepEqual(rt.wrote, []);
});

test('legacy mode delegates to the original cleanup and makes no API call', async () => {
  const rt = runtime({ enabled: false });
  const out = rt.window.mdCleanupNats();
  assert.equal(out, 'legacy');
  assert.deepEqual(rt.legacyCalls, ['mdCleanupNats']);
  assert.deepEqual(rt.calls, []);
});
