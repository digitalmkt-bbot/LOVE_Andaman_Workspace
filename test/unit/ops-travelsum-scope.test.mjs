// §tsScope · Travel Summary pier/route chips + document number, rebuilt from server rows.
//   node --test test/unit/ops-travelsum-scope.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

import { load, DATE } from './travelsum-harness.mjs';

test('with no scope every money row shows and the doc number says ALL', async () => {
  const { ctx, host } = load();
  await ctx.window.renderTravelSum();
  assert.match(host.innerHTML, /Doc no\. TS-20261014-ALL/);
  for (const v of ['V-b1', 'V-b2', 'V-b3']) assert.ok(host.innerHTML.includes(v), v);
  assert.doesNotMatch(host.innerHTML, /data-ops-ts-subtotal/);
});

test('chips list piers and routes from the server roster; cancelled bookings are not counted', async () => {
  const { ctx, host } = load();
  await ctx.window.renderTravelSum();
  assert.match(host.innerHTML, /Visit Panwa <b>2<\/b>/);
  assert.match(host.innerHTML, /Tub Lamu <b>1<\/b>/, 'the cancelled b4 is not counted');
  assert.match(host.innerHTML, /tsPickPier\('panwa'\)/);
});

test('a pier scope keeps only that pier\'s money rows and sums them', async () => {
  const { ctx, host } = load();
  ctx._tsPier = 'panwa';
  await ctx.window.renderTravelSum();
  assert.ok(host.innerHTML.includes('V-b1') && host.innerHTML.includes('V-b2'));
  assert.ok(!host.innerHTML.includes('V-b3'), 'the other pier is gone');
  assert.match(host.innerHTML, /Doc no\. TS-20261014-PANWA/);
  assert.match(host.innerHTML, /data-ops-ts-subtotal/);
  assert.match(host.innerHTML, /฿3,000/, 'to collect 1000 + 2000');
  assert.match(host.innerHTML, /tsPickRoute\('r_pw'\)/, 'route chips narrow to the pier');
  assert.ok(!host.innerHTML.includes("tsPickRoute('r_tl')"));
});

test('a route scope wins, sets its pier and shows its doc number', async () => {
  const { ctx, host } = load();
  ctx._tsRoute = 'r_pw2';
  await ctx.window.renderTravelSum();
  assert.equal(ctx._tsPier, 'panwa');
  assert.ok(host.innerHTML.includes('V-b2') && !host.innerHTML.includes('V-b1'));
  assert.match(host.innerHTML, /Doc no\. TS-20261014-R_PW2/);
});

test('a stale route (not on this day) is cleared instead of showing an empty sheet', async () => {
  const { ctx, host } = load();
  ctx._tsRoute = 'r_gone';
  await ctx.window.renderTravelSum();
  assert.equal(ctx._tsRoute, '');
  assert.ok(host.innerHTML.includes('V-b1'));
});

test('if the roster read fails the summary still renders unscoped', async () => {
  const { ctx, host } = load();
  const get = ctx.laOps.get;
  ctx.laOps.get = (p, q) => (p === '/v1/bookings' ? Promise.reject(new Error('down')) : get(p, q));
  await ctx.window.renderTravelSum();
  assert.ok(host.innerHTML.includes('V-b3'));
  assert.doesNotMatch(host.innerHTML, /data-ops-ts-scope/);
});
