import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime, plain } from './fe-harness.mjs';

// lk-inbox sync 2026-11-03: what the sync brought that saved only in the browser or read only the loaded dates on main.
// The van check-in LINE follow-up's send log and its template (§vckLine), and the Transfer Fleet month grid's day figures (§vehMxHead).
const DAY = '2026-11-03';
const PRE = `
function setInterval(){ return 1; } function clearInterval(){}
var SB_BOOKINGS = [{ id: 'BK-1', opsId: 'ob_1', ops: { vanCheckin: { at: null, lineSent: [{ at: '09:00', by: 'A' }] } },
  trips: [{ date: '${DAY}', routeId: 'r1', opsTripId: 't_1', pax: { ad_fr: 2 } }], passengers: [] }];
function ckRead(b, d, kind){ return kind === 'van' ? b.ops.vanCheckin : null; }
var legacyWrites = 0; function ckWrite(){ legacyWrites++; }
var rendered = 0, after = []; function vckLineRender(){ rendered++; } function ckAfter(k){ after.push(k); }
var _vckLnState = { bkId: 'BK-1', date: '${DAY}', kind: 'van' };
var VCK_LINE_TPL_DEF = 'DEFAULT {voucher}', VCK_LINE_EXTRA_DEF = ['one', 'two'];
function vckLineTpl(){ return 'legacy'; } function vckLineExtras(){ return ['legacy']; } function vckLineOffice(){ return 'legacy'; }
function vckLineTplSave(){ legacyWrites++; } function vckLineTplReset(){ legacyWrites++; }
function ckGuard(){ return true; }
function _vehDayStats(){ return 'legacy walk'; } function _vehGroupsForDay(){ return 'legacy'; } function _vehRouteDemand(){ return 'legacy'; }
function _vehDayJobN(){ return 0; } function _vehRouteZone(){ return null; } function vanCostSet(){}
`;
const local = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const rt = (handlers, files, globals = {}) => {
  const r = runtime({ files: [], handlers, pre: PRE, globals: { localStorage: local, ...globals } });
  files.forEach((f) => r.load(f));
  return r;
};
const sent = (r, re) => r.requests.filter((q) => re.test(q.path) && q.method !== 'GET').map((q) => [q.method, q.path, q.body]);
const tripWithLog = (log) => ({ body: { trip: { id: 't_1', service_date: DAY, operations: { checkins: { van: [{ kind: 'van', slot: 0, line_sent: log, events: [] }], pier: [] } } } } });

test('§vckLine: a LINE copy (one more line in lineSent, nothing else) is POST …/line-sent, not the whole-record PUT', async () => {
  const r = rt({ 'POST /operations/trip-ops/t_1/checkins/van/0/line-sent': tripWithLog([{ at: '09:00', by: 'A' }, { at: '10:15', by: 'B' }]) }, ['40-ops-bookings.js', '36-ops-day-actions.js']);
  const b = r.ctx.SB_BOOKINGS[0], cur = b.ops.vanCheckin;
  r.ctx.ckWrite(b, DAY, 'van', { ...cur, lineSent: [...cur.lineSent, { at: '10:15', by: 'B' }] });
  await r.settle();
  assert.deepEqual(plain(sent(r, /checkins/)), [['POST', '/operations/trip-ops/t_1/checkins/van/0/line-sent', {}]]);
  assert.deepEqual([r.ctx.rendered > 0, plain(r.ctx.after)], [true, ['van']]);
});

test('§vckLine: clearing the log is DELETE …/line-sent', async () => {
  const r = rt({ 'DELETE /operations/trip-ops/t_1/checkins/van/0/line-sent': tripWithLog([]) }, ['40-ops-bookings.js', '36-ops-day-actions.js']);
  const b = r.ctx.SB_BOOKINGS[0];
  r.ctx.ckWrite(b, DAY, 'van', { ...b.ops.vanCheckin, lineSent: [] });
  await r.settle();
  assert.deepEqual(plain(sent(r, /checkins/).map((x) => [x[0], x[1]])), [['DELETE', '/operations/trip-ops/t_1/checkins/van/0/line-sent']]);
});

test('§vckLine: a write that changes anything else is not taken for a log write', async () => {
  const r = rt({ 'PUT /operations/trip-ops/t_1/checkins/van/0': tripWithLog([]) }, ['40-ops-bookings.js', '36-ops-day-actions.js']);
  const b = r.ctx.SB_BOOKINGS[0], cur = b.ops.vanCheckin;
  r.ctx.ckWrite(b, DAY, 'van', { ...cur, at: '11:00', lineSent: [...cur.lineSent, { at: '11:00', by: 'B' }] });
  await r.settle();
  assert.deepEqual(plain(sent(r, /checkins/).map((x) => x[0])), ['PUT']);
});

const CFG = (entries) => ({ 'GET /v1/config': { body: { entries } } });
test('§vckLine: the template, extra lines and office name read from the config store; empty is legacy\'s built-in one', async () => {
  const r = rt(CFG([{ key: 'vck_line_tpl', value: '', version: 1 }, { key: 'vck_line_extras', value: ['x'], version: 1 }, { key: 'vck_line_office', value: '088', version: 1 }]), ['61-ops-config-store.js']);
  r.ctx.vckLineTpl();
  await r.settle();
  assert.deepEqual([r.ctx.vckLineTpl(), plain(r.ctx.vckLineExtras()), r.ctx.vckLineOffice()], ['DEFAULT {voucher}', ['x'], '088']);
});

test('§vckLine: Save sends the three settings; the built-in template and lines are saved as empty', async () => {
  const fields = { 'vck-ln-tpl': { value: 'DEFAULT {voucher}' }, 'vck-ln-ex0': { value: ' a ' }, 'vck-ln-ex1': { value: '' }, 'vck-ln-ex2': { value: 'b' }, 'vck-ln-office': { value: ' 088 ' } };
  const doc = { getElementById: (id) => fields[id] || null, querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {} };
  const put = (b, p) => ({ body: { key: p.split('/').pop(), value: b.value, version: 2 } });
  const r = rt({ ...CFG([]), 'PUT /v1/config/vck_line_tpl': put, 'PUT /v1/config/vck_line_extras': put, 'PUT /v1/config/vck_line_office': put }, ['61-ops-config-store.js'], { document: doc });
  r.ctx.vckLineTpl();
  await r.settle();
  r.ctx.vckLineTplSave();
  await r.settle();
  assert.deepEqual(plain(sent(r, /config/).map((x) => [x[1], x[2].value])), [['/v1/config/vck_line_tpl', ''], ['/v1/config/vck_line_extras', ['a', 'b']], ['/v1/config/vck_line_office', '088']]);
  assert.equal(r.ctx.legacyWrites, 0, 'not the blob');
});

test('§vehMxHead: the month grid\'s day figures come from the van board, not the loaded bookings', async () => {
  const r = runtime({ files: [], pre: PRE, globals: { localStorage: local }, handlers: {
    'GET /operations/van-board': { body: { date: DAY, routes: [{ route_id: 'r1', demand: { pax: 30, pickup: 22 }, groups_with_van: 2, groups_without_van: 1 }, { route_id: 'r2', demand: { pax: 4, pickup: 0 } }] } },
  } });
  r.O.vanJobs = { cellOf: () => null };
  r.load('94-ops-fleet-w6.js');
  assert.equal(r.ctx._vehDayStats(DAY), 'legacy walk', 'before the board is in, legacy\'s walk answers');
  await r.settle();
  assert.deepEqual(plain(r.ctx._vehDayStats(DAY)), { dm: { r1: { pax: 30, pickup: 22 }, r2: { pax: 4, pickup: 0 } }, grp: { r1: { total: 3, withVan: 2, woVan: 1 } } });
});
