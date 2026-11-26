// §tsPenPack (lk-inbox c0a2f5c6) · the penalty-decision evidence prints at the END of the Daily Report's own print, as legacy
// (tsPrintSheet → _tsPackPages → _tsPenPage), one case per page; there is no separate "หลักฐาน N" button.
//   node --test test/unit/ops-travelsum-penpack.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { load, BOOKINGS, DATE } from './travelsum-harness.mjs';

const AFTER = { rows: [
  { booking_id: 'b1', version: 1, noshow: { decision: 'full', amount: 1200, note: 'ref 7', by: 'ops1' },
    penalty_files: [{ id: 'att1', name: 'chat.png', mime: 'image/png', by: 'ops1' }, { id: 'att2', name: 'mail.pdf', mime: 'application/pdf', by: '' }] },
  { booking_id: 'b2', version: 1, penalty_files: [] },
] };

async function run() {
  const h = load({ tsPenPackList() { return ['legacy']; } }, { bookings: BOOKINGS, after: AFTER });
  await h.ctx.window.renderTravelSum();
  return h;
}

test('no evidence button on the bar: the pages go into the sheet print', async () => {
  const { host } = await run();
  assert.doesNotMatch(host.innerHTML, /data-ops-ts-penpack|printPack\(\?'pen\?'\)/);
});

test('tsPenPackList answers legacy\'s shape from the server\'s penalty_files: cases with files only, decision and captions as legacy', async () => {
  const { ctx } = await run();
  const list = JSON.parse(JSON.stringify(ctx.window.tsPenPackList(DATE)));
  assert.equal(list.length, 1, 'b2 has no file: no page');
  const [p] = list;
  assert.deepEqual(p.bk, { id: 'b1', leadPax: '', agentId: 'ag1', voucherRef: 'V-b1' });
  assert.deepEqual(p.trip, { routeId: 'r_pw' });
  assert.deepEqual(p.dec, { decision: 'full', amount: 1200, note: 'ref 7', by: 'ops1' });
  assert.deepEqual(p.imgs.map((x) => [x.f.id, x.f.mime, x.cap]), [['att1', 'image/png', 'chat.png · แนบโดย ops1'], ['att2', 'application/pdf', 'mail.pdf']]);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.window.tsPenPackList('2026-10-15'))), [], 'another day than the sheet in view: nothing');
});
