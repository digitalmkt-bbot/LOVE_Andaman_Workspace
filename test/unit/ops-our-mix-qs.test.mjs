import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// ops/73-ops-our-mix.js, parity round 8 (2026-11-27): the Ops & Guides pickup zones are the server's, and the booking form's
// nationality votes go to the server (the name guess of the Market Data figures is the server's, legacy bkV2GuessNationality).
const SOURCE = fs.readFileSync('allotment_v2/js/ops/73-ops-our-mix.js', 'utf8');
function load(opts = {}) {
  const calls = [];
  const answer = opts.answer === undefined ? { mix: [], coverage: {}, missing_nationality: { bookings: [], count: 0 }, lead_time: { buckets: [], markets: [] }, on_the_books: { weeks: [] }, pickup_zones: [{ zone: 'PK', pax: 23626 }, { zone: 'NoTransfer', pax: 8202 }] } : opts.answer;
  const O = {
    enabled: () => opts.enabled !== false, activeView: () => 'marketdata', busy: () => false, onWrite: () => {}, fail: () => {},
    srv: { read: () => answer },
    get: (p) => { calls.push(['GET', p]); return Promise.resolve({}); },
    post: (p, b) => { calls.push(['POST', p, b]); return Promise.resolve({ tokens: 1 }); },
  };
  const local = [];
  const window = { laOps: O };
  ['mdOurMixByCode', 'mdOurNatCoverage', 'mdMissingNat', 'mdLeadByMarket', 'mdOnTheBooks', 'mdOpenBk'].forEach((f) => { window[f] = () => 'legacy'; });
  window.mdZoneDemand = () => ({ PK: 1 });
  window.natLearnRecordMany = (pairs) => { local.push(pairs); return pairs.length; };
  vm.runInNewContext(SOURCE, { window, console, Number, String, Object, Array, JSON, Promise });
  return { window, calls, local };
}

test('Ops & Guides pickup zones: the server\'s pickup_zones, legacy\'s sum until the answer or in legacy mode', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(load().window.mdZoneDemand())), { PK: 23626, NoTransfer: 8202 });
  assert.deepEqual(load({ answer: null }).window.mdZoneDemand(), { PK: 1 });
  assert.deepEqual(load({ enabled: false }).window.mdZoneDemand(), { PK: 1 });
});

test('the booking save\'s names are kept locally and sent to the server; OTHER and blank are not sent; legacy mode sends nothing', () => {
  const { window, calls, local } = load();
  assert.equal(window.natLearnRecordMany([['Ivan Petrov', 'RU'], ['Nobody', 'OTHER'], ['', 'TH']]), 3);
  assert.equal(local.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [['POST', '/v1/bookings/nationality-votes', { people: [{ name: 'Ivan Petrov', nationality: 'RU' }] }]]);
  const off = load({ enabled: false });
  off.window.natLearnRecordMany([['Ivan Petrov', 'RU']]);
  assert.equal(off.calls.length, 0);
});
