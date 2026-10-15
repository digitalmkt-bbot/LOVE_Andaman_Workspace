// §tsScope · Travel Summary pier › route chips, document number and the selection's figures,
// rebuilt from server rows and drawn through legacy's own head builder (tsV6Head).
//   node --test test/unit/ops-travelsum-scope.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

import { load, handed, section, bk, SUMMARY } from './travelsum-harness.mjs';

const docNo = (html) => /data-ops-ts-docno="([^"]*)"/.exec(html)[1];

test('with no scope the head shows the server\'s whole-day figures, not a sum of rows', async () => {
  const summary = { ...SUMMARY, money: { ...SUMMARY.money, to_collect: 9999, due: 1234 } };
  const { ctx, host } = load({}, { summary });
  await ctx.window.renderTravelSum();
  const H = handed(host.innerHTML, 'H');
  assert.equal(docNo(host.innerHTML), 'TS-20261014-ALL');
  assert.equal(H.target, 9999, 'to_collect is the server\'s, the three rows sum to 6000');
  assert.equal(H.due, 1234);
  assert.equal(H.nBk, 3); assert.equal(H.booked, 6); assert.equal(H.trav, 6);
  for (const v of ['V-b1', 'V-b2', 'V-b3']) assert.ok(section(host.innerHTML, '03').includes(v), v);
  assert.equal(ctx.legacyCalled, undefined, 'the legacy renderer is not used in ops mode');
});

test('pier chips count the live roster per pier and route; cancelled bookings are not counted', async () => {
  const { ctx, host } = load();
  await ctx.window.renderTravelSum();
  const H = handed(host.innerHTML, 'H');
  assert.deepEqual(JSON.parse(JSON.stringify(H.pOrder)), ['panwa', 'tublamu']);
  assert.equal(H.pMap.panwa.n, 2); assert.equal(H.pMap.tublamu.n, 1, 'the cancelled b4 is not counted');
  assert.equal(H.pMap.panwa.pax, 4, 'the whole day travelled in full, so pax = booked');
  assert.equal(H.rMap.r_pw2.n, 1);
});

test('a pier scope keeps only that pier\'s rows and sums their money rows', async () => {
  const { ctx, host } = load();
  ctx._tsPier = 'panwa';
  await ctx.window.renderTravelSum();
  const s03 = section(host.innerHTML, '03');
  assert.ok(s03.includes('V-b1') && s03.includes('V-b2'));
  assert.ok(!s03.includes('V-b3'), 'the other pier is gone');
  assert.equal(docNo(host.innerHTML), 'TS-20261014-PANWA');
  const H = handed(host.innerHTML, 'H');
  assert.equal(H.target, 3000, 'to collect 1000 + 2000');
  assert.equal(H.nBk, 2);
  const M = handed(host.innerHTML, 'M');
  assert.equal(M.cash, 400); assert.equal(M.card, 0);
});

test('a route scope wins, sets its pier and shows its doc number', async () => {
  const { ctx, host } = load();
  ctx._tsRoute = 'r_pw2';
  await ctx.window.renderTravelSum();
  assert.equal(ctx._tsPier, 'panwa');
  const s04 = section(host.innerHTML, '04');
  assert.ok(s04.includes('V-b2') && !s04.includes('V-b1'));
  assert.equal(docNo(host.innerHTML), 'TS-20261014-R_PW2');
});

test('a stale route (not on this day) is cleared instead of showing an empty sheet', async () => {
  const { ctx, host } = load();
  ctx._tsRoute = 'r_gone';
  await ctx.window.renderTravelSum();
  assert.equal(ctx._tsRoute, '');
  assert.ok(section(host.innerHTML, '04').includes('V-b1'));
});

test('a scoped selection on a day with no-shows does not guess its travelled count', async () => {
  const summary = { ...SUMMARY, travelled: 5, no_show: 1 };
  const { ctx, host } = load({}, { summary });
  ctx._tsPier = 'tublamu';
  await ctx.window.renderTravelSum();
  assert.match(host.innerHTML, /data-tsv6="count">จอง <em>2<\/em> คน <small data-ops-ts-needs="b17"/);
  const H = handed(host.innerHTML, 'H');
  assert.equal(H.pMap.panwa.pax, 'จอง 4', 'per-pier pax is labelled booked');
  assert.match(section(host.innerHTML, '04'), /\? \/ 2/, 'per-booking travelled is unknown, not booked');
});

test('the manifest lists the day\'s cancelled bookings after the live ones of their route', async () => {
  const { ctx, host } = load();
  await ctx.window.renderTravelSum();
  const s04 = section(host.innerHTML, '04');
  assert.ok(s04.includes('V-b4'), 'cancelled b4 is on the sheet');
  assert.ok(s04.indexOf('V-b3') < s04.indexOf('V-b4'));
  assert.match(s04, /CXL &middot; ยกเลิก/);
});

test('if the roster read fails the server\'s whole-day sheet still renders, marked', async () => {
  const { ctx, host } = load();
  const get = ctx.laOps.get;
  ctx.laOps.get = (p, q) => (p === '/v1/bookings' ? Promise.reject(new Error('down')) : get(p, q));
  await ctx.window.renderTravelSum();
  assert.match(host.innerHTML, /data-ops-ts-noroster/);
  assert.equal(handed(host.innerHTML, 'H').target, 6000);
  assert.ok(section(host.innerHTML, '03').includes('V-b3'));
});

test('an empty server day is labelled as genuinely empty', async () => {
  const summary = { ...SUMMARY, bookings: 0, booked: 0, travelled: 0, collect_rows: [] };
  const { ctx, host } = load({}, { summary, bookings: [] });
  await ctx.window.renderTravelSum();
  assert.match(host.innerHTML, /data-ops-ts-empty/);
});

test('the server\'s moved-out count shows in section 02 although the list is not served', async () => {
  const { ctx, host } = load({}, { summary: { ...SUMMARY, moved_trips: 2 } });
  await ctx.window.renderTravelSum();
  assert.match(section(host.innerHTML, '02'), /เลื่อนวันไปแล้ว 2/);
  assert.match(section(host.innerHTML, '02'), /data-ops-ts-needs="moved"/);
});

test('legacy mode still draws the legacy screen', async () => {
  const { ctx } = load();
  ctx.laOps.enabled = () => false;
  ctx.window.renderTravelSum();
  assert.equal(ctx.legacyCalled, true);
});

test('van names come from the server van list', async () => {
  const bookings = [bk('b1', 'r_pw', { trips: [{ service_date: '2026-10-14', route_id: 'r_pw', pax_total: 2, operations: { van_parts: [{ idx: 0, group: { van_id: 'veh15' } }] } }] })];
  const { ctx, host } = load({}, { bookings, vans: [{ id: 'veh15', name: 'Queen1' }] });
  await ctx.window.renderTravelSum();
  assert.match(section(host.innerHTML, '04'), /&#128656; Queen1/);
});
