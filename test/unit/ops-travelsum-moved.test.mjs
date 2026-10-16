// B34 · Travel Summary moved-out bookings (legacy §tsStrand / tsMvRows) from the server's moved_rows:
// a faded row each in section 02 and in the manifest, in the pier/route/VAT scope, counting nothing.
//   node --test test/unit/ops-travelsum-moved.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { load, SUMMARY, handed, section } from './travelsum-harness.mjs';

const moved = [
  { booking_id: 'm1', code: 'BK-M1', voucher_ref: 'CTP589783', agent_id: 'agV', lead_pax: 'Abigail Baldwin', lead_phone: '44-77', route_id: 'r_tl',
    pax: { ad_fr: 4, chd_fr: 2 }, pax_total: 6, to_date: '2026-10-17', reason: null, at: '2026-10-11T14:06:00Z', by: 'RSVN01' },
  { booking_id: 'm2', code: 'BK-M2', voucher_ref: null, agent_id: 'agN', lead_pax: 'YU JaeSeop', lead_phone: null, route_id: 'r_pw',
    pax: { ad_fr: 2 }, pax_total: 2, to_date: '2026-11-15', reason: 'เลื่อนวันเดินทาง', at: '2026-10-11T13:33:00Z', by: 'RSVN01' },
];
const AGENTS = { agV: { id: 'agV', name: 'KLOOK', vatMode: 'exclude' }, agN: { id: 'agN', name: 'Pink Dugong', vatMode: 'none' }, ag1: { id: 'ag1', name: 'Acme', vatMode: 'none' } };
const extra = {
  sbGetAgent: (id) => AGENTS[id] || null,
  ckDayShortTh: (d) => ({ '2026-10-17': '17 ต.ค.', '2026-11-15': '15 พ.ย.' })[d] || d,
  ckShortDay: (iso) => ({ '2026-10-11T14:06:00Z': '11 ต.ค. 21:06', '2026-10-11T13:33:00Z': '11 ต.ค. 20:33' })[iso] || '',
};
const run = async (state = {}) => { const h = load({ ...extra, ...state }, { summary: { ...SUMMARY, moved_trips: 2, moved_rows: moved } }); await h.ctx.window.renderTravelSum(); return h; };
const movedRows02 = (html) => section(html, '02').split('data-ops-ts-moved="').slice(1).map((x) => x.split('</tr>')[0]);

test('section 02 lists each moved-out booking in legacy\'s layout', async () => {
  const { host } = await run();
  const s02 = section(host.innerHTML, '02');
  assert.match(s02, /เลื่อนวันไปแล้ว 2</);
  assert.doesNotMatch(s02, /data-ops-ts-needs="moved"/, 'the list is served now: no placeholder');
  const rows = movedRows02(host.innerHTML);
  assert.equal(rows.length, 2);
  const m1 = rows.find((r) => r.startsWith('m1'));
  assert.match(m1, /<span class="ts-vch">CTP589783<\/span>/);
  assert.match(m1, /Abigail Baldwin/);
  assert.match(m1, /&#10007; เลื่อนวัน 6/);
  assert.match(m1, /เลื่อนไป 17 ต\.ค\. · 11 ต\.ค\. 21:06 · RSVN01<div class="ts-tel">Route r_tl<\/div>/);
  assert.match(m1, /ยอดเงินไปอยู่กับวันใหม่แล้ว/);
  assert.match(m1, /ts-chip p">เลื่อนวันแล้ว/);
  assert.match(rows.find((r) => r.startsWith('m2')), /<span class="ts-vch">—<\/span>/, 'no voucher: a dash, as legacy');
});

test('moved rows follow the pier and the VAT selection', async () => {
  let h = await run({ _tsPier: 'panwa' });
  assert.deepEqual(movedRows02(h.host.innerHTML).map((r) => r.split('"')[0]), ['m2']);
  assert.match(section(h.host.innerHTML, '02'), /เลื่อนวันไปแล้ว 1</);
  h = await run({ _tsVatF: 'vat' });
  assert.deepEqual(movedRows02(h.host.innerHTML).map((r) => r.split('"')[0]), ['m1']);
});

test('the manifest shows them faded after the route\'s rows, counted in the route header, not in any total', async () => {
  const { host } = await run();
  const s04 = section(host.innerHTML, '04');
  const row = s04.split('data-ops-ts-man="m1"')[1].split('</tr>')[0];
  assert.match(s04, /data-tsman="cxl" class="ts-cxlrow ts-mvrow" data-ops-ts-man="m1"/);
  assert.match(row, /title="เลื่อนวันออกไปแล้ว · จอง 4">4</);
  assert.match(row, /<span style="color:var\(--rs700\)">0<\/span> \/ 6/);
  assert.match(row, /ยอดเงินไปอยู่กับวันใหม่แล้ว/);
  assert.match(row, /&#10007; เลื่อนวัน<\/span><div class="ts-tel" style="margin-top:3px">ไป 17 ต\.ค\./);
  assert.ok(s04.indexOf('V-b3') < s04.indexOf('data-ops-ts-man="m1"'));
  assert.match(s04, /ยกเลิกทั้งใบ 1 ใบ<\/b> · <b style="color:var\(--pu700\)">เลื่อนวันไปแล้ว 1 ใบ/, 'r_tl: b4 cancelled, m1 moved');
  assert.match(s04, /รวมทั้งวัน · 3 ใบ/, 'the day total counts the three live bookings only');
  const H = handed(host.innerHTML, 'H');
  assert.equal(H.nBk, 3); assert.equal(H.booked, 6);
});
