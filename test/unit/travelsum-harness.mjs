// Shared vm harness for the Travel Summary adapter tests (not a test file).
// Loads 33 (the summary loader), 57 (rows, scope, packs, writes) and 59 (the screen). The legacy
// layout builders (tsV6Head / tsV6Overview / tsV6Money) are stubbed to print the numbers they are
// handed as JSON, so a test reads exactly what the screen was told to show.
import fs from 'node:fs';
import vm from 'node:vm';

const REPORTS = fs.readFileSync('allotment_v2/js/ops/33-ops-money-reports.js', 'utf8');
const ROWS = fs.readFileSync('allotment_v2/js/ops/57-ops-travelsum-rows.js', 'utf8');
const VIEW = fs.readFileSync('allotment_v2/js/ops/59-ops-travelsum-view.js', 'utf8');
export const DATE = '2026-10-14';

export const bk = (id, route, extra = {}) => ({ id, voucher_ref: 'V-' + id, status: 'confirmed', agent_id: 'ag1', trips: [{ service_date: DATE, route_id: route, pax_total: 2 }], ...extra });
export const BOOKINGS = [bk('b1', 'r_pw'), bk('b2', 'r_pw2'), bk('b3', 'r_tl'), bk('b4', 'r_tl', { status: 'cancelled' })];
export const SUMMARY = {
  date: DATE, bookings: 3, booked: 6, travelled: 6, no_show: 0, cxl: 0, moved_trips: 0, cancelled_trips: 1,
  money: { to_collect: 6000, to_collect_bookings: 3, due: 2600, cash: 400, transfer: 0, card: 3000, received: 3400, net: 3400 },
  cot: { total: 500, undecided_bookings: 1 }, noshow: { cases: 0, pending: 0, decided: 0, postponed: 0, charged: 0 },
  collect_rows: [
    { booking_id: 'b1', voucher_ref: 'V-b1', route_id: 'r_pw', target: 1000, paid: 400, due: 600, cot: 0, received: { cash: 400 } },
    { booking_id: 'b2', voucher_ref: 'V-b2', route_id: 'r_pw2', target: 2000, paid: 0, due: 2000, cot: 0 },
    { booking_id: 'b3', voucher_ref: 'V-b3', route_id: 'r_tl', target: 3000, paid: 3000, due: 0, cot: 500, received: { card: 3000 } },
  ],
};

const json = (tag, v) => '<!--' + tag + ':' + JSON.stringify(v) + '-->';
/* The numbers a legacy builder was handed, read back from the stub's comment. */
export const handed = (html, tag) => { const m = new RegExp('<!--' + tag + ':(.*?)-->').exec(html); return m ? JSON.parse(m[1]) : null; };
/* One section (01 / 02 / 03 / 04) of the drawn sheet. */
export const section = (html, n) => (html.split('class="ts-sec ts-s' + n + '"')[1] || '').split('class="ts-sec ts-s')[0];

export function load(extra = {}, data = {}) {
  const host = { innerHTML: '' };
  const PIER = { r_pw: 'panwa', r_pw2: 'panwa', r_tl: 'tublamu' };
  const ctx = {
    console: { log() {}, warn() {} }, Promise, Date, Object, Array, Math, String, Number, JSON, RegExp, encodeURIComponent, parseFloat, setTimeout,
    document: { getElementById: (id) => (id === 'travelsum-host' ? host : null) },
    _tsDate: DATE, _tsPier: '', _tsRoute: '', _tsVatF: '', _tsOnlyIssue: false,
    renderTravelSum() { ctx.legacyCalled = true; }, renderAccounting() {}, acctDashboardHtml() { return ''; }, acctStatementOpen() {}, renderDailyReport() {}, drCfgSet() {},
    tsPick() { ctx.legacyCalled = true; }, tsClear() { ctx.legacyCalled = true; }, tsCustom() { ctx.legacyCalled = true; }, tsPostpone() { ctx.legacyCalled = true; },
    tsRefPackList() { return ['legacy']; }, tsSlipPackList() { return ['legacy']; },
    tsPierOf: (r) => PIER[r] || 'other',
    tsPierName: (p) => ({ panwa: 'Visit Panwa', tublamu: 'Tub Lamu' })[p] || 'Other',
    tsRouteName: (r) => 'Route ' + r,
    // Legacy layout builders: print what they are handed.
    tsV6Head: (H) => '<div class="h4-count" data-tsv6="count">' + H.trav + ' / ' + H.booked + '</div><ul><li data-tschk="bk">bk</li><li data-tschk="ns">ns</li></ul><button class="h4-pri">print</button>' + json('H', H),
    tsV6Overview: (O) => '<div class="ts-scr ts-noprint s5-g1" data-tsv6="s01"><div><b>' + O.trav + '</b></div><div class="s5-tiles"></div></div>' + json('O', O),
    tsV6Money: (M) => json('M', M),
    tsCSS: () => '', tsCSSv6: () => '',
    ...extra,
  };
  ctx.window = ctx;
  const calls = [];
  ctx.laOps = {
    enabled: () => true,
    get: (path, q) => {
      calls.push([path, q]);
      if (path === '/v1/reports/travel-summary') return Promise.resolve(JSON.parse(JSON.stringify(data.summary || SUMMARY)));
      if (path === '/v1/bookings') return Promise.resolve({ bookings: data.bookings || BOOKINGS });
      if (path === '/v1/after-trip' && data.after) return Promise.resolve(data.after);
      if (path === '/operations/vans' && data.vans) return Promise.resolve({ vans: data.vans });
      return Promise.reject(new Error('unexpected GET ' + path));
    },
    call: () => Promise.reject(new Error('no')), queue: (fn) => fn(),
    onWrite() {}, wrote() {}, fail() {}, loadingHtml: () => 'loading', today: () => DATE,
  };
  vm.createContext(ctx);
  vm.runInContext(REPORTS, ctx);
  vm.runInContext(ROWS, ctx);
  if (!process.env.TS_NO_VIEW) vm.runInContext(VIEW, ctx);
  return { ctx, host, calls };
}
