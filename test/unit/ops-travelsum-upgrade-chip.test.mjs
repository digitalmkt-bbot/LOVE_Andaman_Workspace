// §tsUpChip · section 03 counts an upgrade collected at check-in as money taken, not "ยังไม่เก็บ".
//   node --test test/unit/ops-travelsum-upgrade-chip.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { load, bk, SUMMARY, section } from './travelsum-harness.mjs';

const b1 = { ...bk('b1', 'r_pw'), upgrades: [{ id: 'u1', label: 'Longtail', sell_price: 600, collected: true, method: 'cash' }] };
const b2 = { ...bk('b2', 'r_pw'), upgrades: [{ id: 'u2', label: 'Longtail', sell_price: 600, collected: true, method: 'transfer' }] };
const b3 = { ...bk('b3', 'r_pw'), upgrades: [{ id: 'u3', label: 'Longtail', sell_price: 600, collected: false, method: 'cash' }] };
const summary = { ...SUMMARY, collect_rows: [
  { booking_id: 'b1', target: 0, paid: 0, due: 0, cot: 0, upgrades_due: 0, received: { cash: 600 } },
  { booking_id: 'b2', target: 0, paid: 600, due: 0, cot: 0, upgrades_due: 0, received: { transfer: 600 } },
  { booking_id: 'b3', target: 600, paid: 0, due: 600, cot: 0, upgrades_due: 600, received: {} },
] };
const ROWS = {
  b1: { booking_id: 'b1', payments: [], tour_sales: [], covered_upgrade_ids: [] },
  b2: { booking_id: 'b2', payments: [{ id: 'p1', method: 'transfer', amount: 600, slips: [] }], tour_sales: [], covered_upgrade_ids: ['u2'] },
  b3: { booking_id: 'b3', payments: [], tour_sales: [], covered_upgrade_ids: [] },
};
const rowOf = (html, id) => section(html, '03').split('data-ops-ts-collect="' + id + '"')[1].split('</tr>')[0];

test('a collected upgrade shows as money taken; a covered one is not counted twice; an uncollected one stays owed', async () => {
  const h = load({}, { bookings: [b1, b2, b3], summary });
  h.ctx.laOpsPierMoney = { rowById: (id) => ROWS[id] || null, sigOf: () => 's', loadDay: () => Promise.resolve({}) };
  await h.ctx.window.renderTravelSum();
  const html = h.host.innerHTML;
  const r1 = rowOf(html, 'b1');
  assert.match(r1, /เงินสด ฿600 <i[^>]*>อัปเกรด<\/i>/);
  assert.doesNotMatch(r1, /ยังไม่เก็บ/);
  const r2 = rowOf(html, 'b2');
  assert.match(r2, /โอนเงิน ฿600/);
  assert.doesNotMatch(r2, /อัปเกรด<\/i>/, 'the pier payment already carries this money');
  assert.match(rowOf(html, 'b3'), /ยังไม่เก็บ/);
});
