import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const ctx = {};
vm.runInNewContext(fs.readFileSync('allotment_v2/js/booking/bookingV2CotChip.js', 'utf8') + '\nthis.chip = bookingV2CotChip;', ctx);
const chip = (bk, n) => ctx.chip(bk, n);

test('server booking: structured cash_on_tour fields make the chip', () => {
  const r = chip({ _fromOpsBackend: true, cashOnTour: { amount: 1500, currency: 'THB', handling: 'deduct' } }, '');
  assert.match(r.chip, /COT ฿1,500/);
});

test('server booking: a "cash on tour" word in notes is NOT a chip when the server has no COT', () => {
  const r = chip({ _fromOpsBackend: true, cashOnTour: null }, 'guest says cash on tour 2000');
  assert.equal(r.chip, '');
  assert.equal(r.note, 'guest says cash on tour 2000');
});

test('legacy booking: notes still parse into a chip and the COT part leaves the note', () => {
  const r = chip({ cashOnTour: null }, 'vegan · cash on tour 2,000');
  assert.match(r.chip, /COT ฿2,000/);
  assert.equal(r.note, 'vegan');
});

test('server booking: foreign currency renders as before', () => {
  const r = chip({ _fromOpsBackend: true, cashOnTour: { amount: 40, currency: 'USD' } }, '');
  assert.match(r.chip, /COT USD 40/);
});
