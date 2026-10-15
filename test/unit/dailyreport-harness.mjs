// Shared vm harness for the Daily Report adapter tests (not a test file).
//   The page's drawing helpers are lk-inbox's own: they are lifted out of 08-app.js / 04-data-core.js
//   by name, so a test sees the real markup and classes, not a stub.
import fs from 'node:fs';
import vm from 'node:vm';

const APP = fs.readFileSync('allotment_v2/js/08-app.js', 'utf8');
const CORE = fs.readFileSync('allotment_v2/js/04-data-core.js', 'utf8');
const REPORTS = fs.readFileSync('allotment_v2/js/ops/33-ops-money-reports.js', 'utf8');
const TREND = fs.readFileSync('allotment_v2/js/ops/58-ops-daily-trend.js', 'utf8');
const PAGE_PATH = 'allotment_v2/js/ops/59-ops-daily-report.js';
export const DATE = '2026-10-15';

/** One top-level declaration (the LAST one of that name, as the browser keeps), up to the next top-level line. */
export function lift(src, name) {
  const re = new RegExp('^(function ' + name + '\\(|var ' + name + '\\s*=)', 'gm');
  let m, at = -1;
  while ((m = re.exec(src))) at = m.index;
  if (at < 0) throw new Error('not found: ' + name);
  const rest = src.slice(at + 1);
  const end = rest.search(/\n(function |var |\/\/|\/\*)/);
  return src.slice(at, end < 0 ? undefined : at + 1 + end);
}
const HELPERS = ['DR_PALETTE', 'DR_TABS', 'DR_PIER_NM', 'ckEsc', 'drB', 'drK2', 'drPct', 'drK', 'drBar', 'drTile', 'drInitials', 'drSq',
  'drDonut', 'drSmooth', 'drChart', 'drCSS', 'drPierNm', 'drPierTxt'].map((n) => lift(APP, n)).join('\n') + '\n' + lift(CORE, 'laMonAbbrTH');

const clone = (x) => JSON.parse(JSON.stringify(x));
const M = (id, name, pax) => ({ id, name, color: null, bookings: 1, pax, revenue: pax * 1000 });
export const DAILY = {
  date: DATE, bookings: 5, pax: { ad: 9, chd: 2, inf: 1, foc: 1, total: 13 }, paying_pax: 13, revenue: 26000, revenue_per_pax: 2000,
  by_route: [
    { route_id: 'r2', name: 'Early Tiger', bookings: 3, pax: 8, revenue: 16000, per_pax: 2000, share_pct: 61.5 },
    { route_id: 'r10', name: 'Phi Phi', bookings: 2, pax: 5, revenue: 10000, per_pax: 2000, share_pct: 38.5 },
  ],
  by_market: [M('ru', 'Russian Market', 5), M('b2c', 'b2c', 3), M('ww', 'World Wide', 2), M('ap', 'Asia Pacific', 1), M('hpk', 'Hotel Phuket', 1), M('ota', 'Online Travel Agent', 1)],
  by_channel: { invoice: 16000, proforma: 6000, cot: 4000, transfer: 0, other: 0 },
  by_agent: [
    { key: 'a13', agent_id: 'a13', name: 'SAYAMA', market_id: 'ru', pay_type: 'invoice', bookings: 3, ad: 7, chd: 1, inf: 0, foc: 0, pax: 8, revenue: 16000, due: 0, docs: { verified: 2, pending: 1 } },
    { key: 'b2c', agent_id: 'b2c', name: 'Love Andaman', market_id: 'b2c', pay_type: 'cot', bookings: 2, ad: 2, chd: 1, inf: 1, foc: 1, pax: 5, revenue: 10000, due: 1234, docs: { nofiles: 2 } },
  ],
  upgrades: { collected: 100, due: 50 }, internal_free: { bookings: 1, pax: 1 },
  due: 1234, got: 300, no_slip: 2, extras: 700,
  van_cost: { total: 3400, estimated: false, vans: 2, default_rate_vans: 1, per_van_fallback: 1700, by_van: { veh1: 1500, veh2: 1900 } },
  longtail: { charter_boats: 1, join_pax: 4, cost: 777, by_route: [] }, known_cost: 4177,
  net_before_boat_costs: 99999,      // deliberately not revenue - cost: the page must show the server's figure
  settings: { van_cost: 1700, van_quota: 1, target_per_pax: 130 },
};
export const PIERS = {
  tublamu: { pier: 'tublamu', date: DATE, boats: [
    { boat_id: 'b2', boat_name: 'Artemis', route_id: 'r2', booked: { on_board: 6 } },
    { boat_id: 'b3', boat_name: 'Okeanos', route_id: 'r2', booked: { on_board: 2 } },
    { boat_id: 'b6', boat_name: 'Zeus', route_id: 'r1', booked: { on_board: 0 } },
  ] },
  panwa: { pier: 'panwa', date: DATE, boats: [{ boat_id: 'b12', boat_name: 'Hermetis', route_id: 'r10', booked: { on_board: 5 } }] },
  ranong: { pier: 'ranong', date: DATE, boats: [] },
};
export const DEPLOY = { deployments: [
  { boat_id: 'b2', route_id: 'r2', capacity: 5 }, { boat_id: 'b3', route_id: 'r2', capacity: 10 },
  { boat_id: 'b6', route_id: 'r1', capacity: 40 }, { boat_id: 'b12', route_id: 'r10', capacity: 20 },
] };
export const BOARD = { date: DATE, routes: [{ route_id: 'r2', departs: '06:45' }, { route_id: 'r10', departs: '09:00' }] };
export const JOBS = { date: DATE, jobs: [
  { van_id: 'veh1', van: { name: 'Queen1', plate: '30-8678', capacity: 12, ownership: 'partner' }, driver: { name: 'Ju', phone: '098', plate: '30-8678' }, zones: ['PK'], pax: 7, bookings: 3, capacity: 12 },
  { van_id: 'veh2', van: { name: 'Love5', plate: '31-1', capacity: 10, ownership: 'own' }, driver: {}, zones: ['KL'], pax: 4, bookings: 2, capacity: 10 },
  { van_id: null, van: null, driver: {}, zones: ['PK'], pax: 2, bookings: 1 },
], return_unarranged: [{ booking_id: 'x1', pax: 2 }, { booking_id: 'x2', pax: 3 }], self_arrive: [] };
export const VANS = { vans: [{ id: 'veh1', type: 'van' }, { id: 'veh2', type: 'minibus' }] };
const bk = (id, route, extra = {}) => ({ id, voucher_ref: 'V-' + id, status: 'confirmed', agent_id: 'a13', lead_pax: 'Lead ' + id, lead_phone: '081',
  hotel_name: 'Hotel ' + id, guide_english: true, special_meals_veg: 0,
  trips: [{ service_date: DATE, route_id: route, pickup_time: '07:00', pax: { ad_fr: 2, chd_th: 1 }, pax_total: 3, operations: {} }], ...extra });
export const ROSTER = { bookings: [bk('k1', 'r2'), bk('k2', 'r10', { special_meals_halal: 2, dropoff_same: false, dropoff_hotel_name: 'Airport' }), bk('k3', 'r2', { status: 'cancelled' })] };
export const COUNTS = { days: [{ date: DATE, bookings: 4, pax: 9 }] };

export function load({ enabled = true, data = {}, extra = {}, page = true } = {}) {
  const host = { innerHTML: '', querySelector: () => null };
  const reads = [], toasts = [], fails = [], legacy = [];
  let localReads = 0;
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, Promise, Date, Object, Array, Math, String, Number, JSON, RegExp, encodeURIComponent, parseFloat, setTimeout,
    document: { getElementById: (id) => (id === 'dailyreport-host' ? host : null) },
    _drDate: DATE, _drTab: 'ov', _drTrendMode: 'travel',
    renderTravelSum() {}, renderAccounting() {}, acctDashboardHtml() { return ''; }, acctStatementOpen() {}, drCfgSet() {},
    renderDailyReport() { legacy.push('renderDailyReport'); },
    drMailShow() { legacy.push('drMailShow'); },
    // the legacy page's own counting must never run while laOps is on
    drData() { localReads++; throw new Error('local drData'); },
    tsRows() { localReads++; return []; },
    getRoute: (id) => ({ r2: { name: 'Early Tiger', color: '#378ADD' }, r10: { name: 'Phi Phi', color: '#ff9999' } })[id],
    getBoat: (id) => ({ b2: { type: 'Speedboat', pier: 'tublamu' }, b3: { type: 'Speedboat', pier: 'panwa' }, b12: { type: 'Catamaran', pier: 'panwa' } })[id],
    ...extra,
  };
  Object.defineProperty(ctx, 'SB_BOOKINGS', { get() { localReads++; return []; } });
  ctx.window = ctx;
  const D = { daily: DAILY, piers: PIERS, deploy: DEPLOY, board: BOARD, jobs: JOBS, vans: VANS, roster: ROSTER, counts: COUNTS, ...data };
  ctx.laOps = {
    enabled: () => enabled,
    get: (path, q) => {
      reads.push([path, q]);
      if (D.fail && D.fail(path, q)) return Promise.reject(new Error('boom'));
      if (path === '/v1/reports/daily') return Promise.resolve({ ...clone(D.daily), date: q.date });
      if (path === '/v1/reports/daily/settings') return Promise.resolve(clone(D.daily.settings));
      const pm = /^\/v1\/pier-office\/(\w+)\/days\/([\d-]+)\/boats$/.exec(path);
      if (pm) return Promise.resolve(clone(D.piers[pm[1]] || { boats: [] }));
      if (path === '/operations/deployments') return Promise.resolve(clone(D.deploy));
      if (path === '/operations/van-board') return Promise.resolve(clone(D.board));
      if (path === '/operations/van-jobs') return Promise.resolve(clone(D.jobs));
      if (path === '/operations/vans') return Promise.resolve(clone(D.vans));
      if (path === '/v1/bookings') return Promise.resolve(clone(D.roster));
      if (path === '/v1/bookings/daily-counts') return Promise.resolve(clone(D.counts));
      return Promise.reject(new Error('unexpected GET ' + path));
    },
    call: () => Promise.reject(new Error('no write expected')), queue: (fn) => fn(),
    onWrite() {}, wrote() {}, fail: (t) => fails.push(t), toast: (o) => toasts.push(o), loadingHtml: () => 'loading', today: () => DATE,
  };
  vm.createContext(ctx);
  vm.runInContext(HELPERS, ctx);
  vm.runInContext(REPORTS, ctx);
  vm.runInContext(TREND, ctx);
  if (page) vm.runInContext(fs.readFileSync(PAGE_PATH, 'utf8'), ctx);
  return { ctx, host, reads, toasts, fails, legacy, localReads: () => localReads };
}
export const settle = () => new Promise((r) => setTimeout(r, 20));
export async function show(h, tab, mode) {
  h.ctx._drTab = tab; if (mode) h.ctx._drTrendMode = mode;
  await h.ctx.window.renderDailyReport();
  await settle();
  return h.host.innerHTML;
}
/** Visible text, roughly: tags and the <style> block dropped. */
export const textOf = (html) => html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/&#(\d+);/g, (m, c) => String.fromCodePoint(+c)).replace(/\s+/g, ' ');
