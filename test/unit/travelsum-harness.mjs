// Shared vm harness for the Travel Summary / Daily Report adapter tests (not a test file).
import fs from 'node:fs';
import vm from 'node:vm';

const REPORTS = fs.readFileSync('allotment_v2/js/ops/33-ops-money-reports.js', 'utf8');
const ROWS = fs.readFileSync('allotment_v2/js/ops/57-ops-travelsum-rows.js', 'utf8');
export const DATE = '2026-10-14';

export const bk = (id, route, extra = {}) => ({ id, voucher_ref: 'V-' + id, status: 'confirmed', agent_id: 'ag1', trips: [{ service_date: DATE, route_id: route }], ...extra });
export const BOOKINGS = [bk('b1', 'r_pw'), bk('b2', 'r_pw2'), bk('b3', 'r_tl'), bk('b4', 'r_tl', { status: 'cancelled' })];
export const SUMMARY = {
  date: DATE, bookings: 3, booked: 9, travelled: 9, no_show: 0, cxl: 0, money: {}, cot: {}, noshow: {},
  collect_rows: [
    { booking_id: 'b1', voucher_ref: 'V-b1', route_id: 'r_pw', target: 1000, paid: 400, due: 600, cot: 0 },
    { booking_id: 'b2', voucher_ref: 'V-b2', route_id: 'r_pw2', target: 2000, paid: 0, due: 2000, cot: 0 },
    { booking_id: 'b3', voucher_ref: 'V-b3', route_id: 'r_tl', target: 3000, paid: 3000, due: 0, cot: 500 },
  ],
};

export function load(extra = {}, data = {}) {
  const host = { innerHTML: '' };
  const PIER = { r_pw: 'panwa', r_pw2: 'panwa', r_tl: 'tublamu' };
  const ctx = {
    console: { log() {}, warn() {} }, Promise, Date, Object, Array, Math, String, Number, JSON, encodeURIComponent, parseFloat, setTimeout,
    document: { getElementById: (id) => (id === 'travelsum-host' ? host : null) },
    _tsDate: DATE, _tsPier: '', _tsRoute: '', _tsVatF: '',
    renderTravelSum() {}, renderAccounting() {}, acctDashboardHtml() { return ''; }, acctStatementOpen() {}, renderDailyReport() {}, drCfgSet() {},
    tsPierOf: (r) => PIER[r] || 'other',
    tsPierName: (p) => ({ panwa: 'Visit Panwa', tublamu: 'Tub Lamu' })[p] || 'Other',
    tsRouteName: (r) => 'Route ' + r,
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
      return Promise.reject(new Error('unexpected GET ' + path));
    },
    call: () => Promise.reject(new Error('no')), queue: (fn) => fn(),
    onWrite() {}, wrote() {}, fail() {}, loadingHtml: () => 'loading', today: () => DATE,
  };
  vm.createContext(ctx);
  vm.runInContext(REPORTS, ctx);
  vm.runInContext(ROWS, ctx);
  return { ctx, host, calls };
}

