// §natBoot · natLearnBootstrap used to parse + stringify the whole state blob once PER PASSENGER.
// On prod (~23 MB blob, ~9k name pairs) that froze a never-bootstrapped browser for minutes and
// hung the cs embed. These run the real functions out of 08-app.js against a fake localStorage
// and count the work, so the per-passenger shape cannot quietly come back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SRC = fs.readFileSync(new URL('../../allotment_v2/js/08-app.js', import.meta.url), 'utf8');
const from = SRC.indexOf('let _natRaw = null');
const to = SRC.indexOf('// Trigger bootstrap once DOM is ready', from);
assert.ok(from > 0 && to > from, 'nat-learn block not found in 08-app.js');
const BLOCK = SRC.slice(from, to);

function harness({ embed = false, edit = true, bookings = 200 } = {}) {
  let mem = JSON.stringify({ pad: 'x'.repeat(200000) });
  const ls = {};
  const n = { parse: 0, set: 0 };
  const localStorage = {
    getItem: k => k === 'loveandaman_v2' ? mem : (k in ls ? ls[k] : null),
    setItem: (k, v) => { if (k === 'loveandaman_v2') { mem = v; n.set++; } else ls[k] = String(v); },
  };
  const nats = ['TH', 'GB', 'RU', 'CN', 'DE'];
  const SB_BOOKINGS = [];
  for (let i = 0; i < bookings; i++) SB_BOOKINGS.push({
    leadPax: 'MR John Smith' + (i % 50), leadNationality: nats[i % 5],
    passengers: [{ name: 'Anna Lee' + (i % 7), nationality: nats[(i + 1) % 5] }, { name: 'Bo', nationality: 'TH' }],
  });
  const J = { parse: s => { n.parse++; return JSON.parse(s); }, stringify: JSON.stringify };
  const ctx = { localStorage, SB_BOOKINGS, JSON: J, Array, console: { log() {}, warn() {} },
    window: { __laEmbed: embed }, laCanEdit: () => edit };
  vm.createContext(ctx);
  vm.runInContext(BLOCK + ';this.api={natLearnBootstrap,natLearnRecordMany,_natLearnPairs,_natLearnLoad}', ctx);
  return { api: ctx.api, n, ls, blob: () => JSON.parse(mem) };
}

test('bootstrap: one save for every booking, not one per passenger', () => {
  const h = harness({ bookings: 200 });
  h.api.natLearnBootstrap();
  assert.equal(h.n.set, 1);
  assert.ok(h.n.parse <= 2, 'parses: ' + h.n.parse);
  assert.equal(h.ls._nat_bootstrap_done, '1');
  const t = h.blob().nat_learn;
  assert.equal(t.JOHN.TH + t.JOHN.GB + t.JOHN.RU + t.JOHN.CN + t.JOHN.DE, 200);
  assert.equal(t.BO.TH, 200);
  assert.equal(t.MR, undefined, 'honorifics are not tokens');
});

test('bootstrap: second run is a no-op', () => {
  const h = harness();
  h.api.natLearnBootstrap();
  const sets = h.n.set;
  h.api.natLearnBootstrap();
  assert.equal(h.n.set, sets);
});

test('bootstrap: skipped for embed and view-only sessions', () => {
  for (const o of [{ embed: true }, { edit: false }]) {
    const h = harness(o);
    h.api.natLearnBootstrap();
    assert.equal(h.n.set, 0);
    assert.equal(h.ls._nat_bootstrap_done, undefined, 'must not mark done, a later editor session still seeds');
  }
});

test('reads do not re-parse an unchanged blob', () => {
  const h = harness();
  h.api._natLearnLoad();
  const p = h.n.parse;
  for (let i = 0; i < 500; i++) h.api._natLearnLoad();
  assert.equal(h.n.parse, p);
});

test('a booking save records lead + passengers in one write', () => {
  const h = harness();
  const pairs = h.api._natLearnPairs('Jane Doe', 'GB', [{ name: 'Ivan Petrov', nationality: 'RU' }, { name: 'X', nationality: '' }, null]);
  assert.equal(pairs.length, 2);
  assert.equal(h.api.natLearnRecordMany(pairs), 2);
  assert.equal(h.n.set, 1);
  assert.equal(h.blob().nat_learn.IVAN.RU, 1);
});
