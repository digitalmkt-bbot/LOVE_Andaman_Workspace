// Booking calendar (73-ops-bk-calendar.js): cancelled variants. The server answers families[] NET of the cut variants plus
// closed_routes / cut / all_closed / reason_label; the wrappers give legacy's renderers a GROSS aggregate (+cut) and the split.
//   node --test test/unit/ops-bk-calendar-cxl.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime, plain } from './fe-harness.mjs';

const Z = { total: 0, ad: 0, chd: 0, inf: 0, foc: 0, pk: 0, kl: 0, nt: 0 };
const pre = `
  var TCX_R = { weather: { en: 'Weather' }, minpax: { en: 'Below break-even' }, other: { en: 'Other' } };
  function bookingV2FamilyAggregate(){ return { legacy: 'agg' }; }
  function bookingV2FamCxlSplit(){ return { legacy: 'split' }; }`;

async function setup(families) {
  const rt = runtime({
    pre,
    files: ['73-ops-srv-reads.js', '73-ops-bk-calendar.js'],
    handlers: { 'GET /v1/bookings/calendar': { body: { days: [{ date: '2026-10-20', families }] } } },
  });
  rt.ctx.window._bkV2 = { tab: 'cal' };
  const call = () => [plain(rt.ctx.bookingV2FamilyAggregate('f1', '2026-10-20')), plain(rt.ctx.bookingV2FamCxlSplit('f1', '2026-10-20'))];
  call(); await rt.settle();
  return call();
}

test('one of two variants cancelled: aggregate is gross (net + cut), cut once, running heads = net', async () => {
  const [agg, cx] = await setup([{ family_id: 'f1', total: 10, ad: 8, chd: 2, inf: 0, foc: 0, pk: 0, kl: 0, nt: 0,
    closed_routes: ['r2'], cut: { ...Z, total: 2, ad: 2 }, all_closed: false, reason: 'weather', reason_label: 'Cancelled (Weather)' }]);
  assert.equal(agg.total, 12); assert.equal(agg.ad, 10); assert.equal(agg.cut.total, 2);
  assert.equal(agg.total - cx.cut.total, 10);   // what legacy's renderer shows: the server's net
  assert.deepEqual(cx.closed, ['r2']); assert.equal(cx.all, false);
  assert.equal(cx.lbl, 'Cancelled (Weather)'); assert.equal(cx.R.en, 'Weather');
});

test('all variants cancelled: struck, reason label, the chip still has its count', async () => {
  const [agg, cx] = await setup([{ family_id: 'f1', ...Z, closed_routes: ['r1', 'r2'], cut: { ...Z, total: 5, ad: 5 },
    all_closed: true, reason: 'minpax', reason_label: 'Cancelled (Below break-even)' }]);
  assert.equal(agg.total, 5);
  assert.equal(cx.all, true); assert.equal(cx.lbl, 'Cancelled (Below break-even)'); assert.equal(cx.R.en, 'Below break-even');
});

test('no closure: unchanged figures, empty split', async () => {
  const [agg, cx] = await setup([{ family_id: 'f1', total: 7, ad: 7, chd: 0, inf: 0, foc: 0, pk: 0, kl: 0, nt: 0,
    closed_routes: [], cut: { ...Z }, all_closed: false, reason: null, reason_label: '' }]);
  assert.equal(agg.total, 7); assert.equal(cx.cut.total, 0); assert.deepEqual(cx.closed, []);
  assert.equal(cx.all, false); assert.equal(cx.lbl, ''); assert.equal(cx.R, null);
});

test('old answer without the new fields: aggregate as sent, split falls back to legacy', async () => {
  const [agg, cx] = await setup([{ family_id: 'f1', total: 7, ad: 7, chd: 0, inf: 0, foc: 0, pk: 0, kl: 0, nt: 0 }]);
  assert.equal(agg.total, 7); assert.equal(agg.cut, undefined);
  assert.deepEqual(cx, { legacy: 'split' });
});
