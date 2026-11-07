import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime, plain } from './fe-harness.mjs';

// lk-inbox sync 2026-11-07: the overnight outbound day's return label (§ovnOutNoRet) and the pickup-area popup moving the trip zone (§zoneFollow).
const local = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

// ── §ovnOutNoRet ──
const OVN_PRE = `
function setInterval(){ return 1; } function clearInterval(){}
var SB_BOOKINGS = [];
function ckRetVan(){ return { t: 'legacy', kind: 'legacy' }; } function pckJobDrop(){ return { t: 'legacy' }; } function tsSendBack(){ return { t: 'legacy' }; }
function ovnDayTh(d){ return d === '2026-11-07' ? '7 พ.ย.' : d; }
function vehGet(id){ return { name: 'VAN' + id.slice(1) }; }
`;
test('§ovnOutNoRet: the server\'s ovn return reads as legacy\'s "ค้างเกาะ · กลับ <date>" on the pier sheet, van check-in and Travel Summary', () => {
  const r = runtime({ files: ['94-ops-pier-w6.js'], pre: OVN_PRE, globals: { localStorage: local } });
  let ret = { kind: 'ovn', van_id: null, drop_off: 'The SIS Kata', ovn_return_date: '2026-11-07' };
  r.O.travelServer = { rowFor: () => ({ return: ret }) };
  const b = { id: 'BK-1', trips: [] };
  assert.deepEqual(plain(r.ctx.ckRetVan(b, '2026-11-06')), { t: 'ค้างเกาะ · กลับ 7 พ.ย.', kind: 'ovn' });
  assert.deepEqual(plain(r.ctx.pckJobDrop(b, '2026-11-06')), { t: '', self: false, van: { t: 'ค้างเกาะ · กลับ 7 พ.ย.', kind: 'ovn' }, ovn: true }, 'not "ส่ง The SIS Kata" today');
  assert.deepEqual(plain(r.ctx.tsSendBack(b, '2026-11-06')), { t: 'ค้างเกาะ', tag: '🌙 กลับ 7 พ.ย.', cls: 'n' });
  // the return leg: the server names the van it sits in
  ret = { kind: 'van', van_id: 'v12', drop_off: 'The SIS Kata' };
  assert.deepEqual(plain(r.ctx.ckRetVan(b, '2026-11-07')), { t: 'VAN12', kind: 'van' });
  assert.deepEqual(plain(r.ctx.pckJobDrop(b, '2026-11-07')), { t: 'The SIS Kata', self: false, van: { t: 'VAN12', kind: 'van' } });
});

// ── §zoneFollow ──
const ZONE_PRE = `
function setInterval(){ return 1; } function clearInterval(){}
var SB_BOOKINGS = [{ id: 'BK-1', opsId: 'ob_1', opsVersion: 3, _fromOpsBackend: true, pickupAreaId: 'a_kata', trips: [{ date: '2026-11-06', zone: 'PK', opsTripId: 't1' }] }];
var _bkV2ZonePick = { bkId: 'BK-1', sel: 'a_pier' }, legacyConfirm = 0, redrawn = 0;
function _bkV2ZonePickPlan(){ return { area: { id: 'a_pier', zone: 'NoTransfer' }, times: [], priceZones: ['PK'], zoneDiff: true }; }
function bookingV2ZonePickConfirm(){ legacyConfirm++; }
function bookingV2RenderKeep(){ redrawn++; }
function acctCanEditBookings(){ return true; }
`;
const zoneDoc = (els) => ({ getElementById: (id) => els[id] || null, querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {} });
test('§zoneFollow: the ticked "trip zone follows" box is sent as follow_zone; unticked or not shown, it is not', async () => {
  for (const [els, want] of [[{ 'bkv2-zonepick-zone': { checked: true } }, true], [{ 'bkv2-zonepick-zone': { checked: false } }, 'absent'], [{}, 'absent']]) {
    const r = runtime({ files: ['74-ops-pickup-plan.js'], pre: ZONE_PRE, globals: { localStorage: local }, handlers: {
      'PATCH /v1/bookings/ob_1': { body: { id: 'ob_1', version: 4 } } } });
    r.ctx.document = zoneDoc({ ...els, 'bkv2-zonepick': { remove: () => {} } });
    await r.ctx.bookingV2ZonePickConfirm();
    await r.settle();
    const body = r.requests.find((q) => q.method === 'PATCH').body;
    assert.deepEqual([body.pickup_area_id, 'follow_zone' in body ? body.follow_zone : 'absent'], ['a_pier', want]);
    assert.equal(r.ctx.legacyConfirm, 0, 'the browser changes nothing itself');
  }
});
