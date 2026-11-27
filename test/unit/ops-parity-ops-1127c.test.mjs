// UI parity round 8 (2026-11-27, agent T): pier cash long-tail booked side from the sheet (§ltSheetBooked, 85-ops-cash-longtail-w5.js)
// and the B2C order line's reference from the server (§opsDisplayCode, booking/bookingV2DisplayCode.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const J = (x) => JSON.parse(JSON.stringify(x));

function ltRuntime(sheet) {
  const asked = [];
  const win = {
    laOps: {
      enabled: () => true, busy: () => false,
      pierCash: { cache: { sheet } },
      pier: {
        loaded: true,
        dayBoats: {
          entry: () => null, boat: () => null,
          want: (pier, date) => asked.push('want ' + pier + ' ' + date),
          wantRange: (pier, from, to) => asked.push('range ' + pier + ' ' + from + ' ' + to),
        },
      },
    },
    pxLongtail: (date, bid) => { asked.push('legacy ' + date + ' ' + bid); return { chtr: 9, join: 9, upg: 0, upgDue: 0 }; },
    pc2LT: (pier) => [window_.pxLongtail('2026-11-06', 'b6'), window_.pxLongtail('2026-11-07', 'b9')],
    pc2LTDay: (pier, ds) => window_.pxLongtail(ds, 'b6'),
    _pcYM: '2026-11', _pcDate: '2026-11-27',
  };
  const window_ = win;
  const ctx = vm.createContext({ window: win, console, Object, Array, String, Number, Date, setTimeout, clearTimeout });
  vm.runInContext(fs.readFileSync('allotment_v2/js/ops/85-ops-cash-longtail-w5.js', 'utf8'), ctx);
  return { w: win, asked };
}

const month = {
  pier: 'tublamu', month: '2026-11',
  days: [{ date: '2026-11-06', boats: [{ boat_id: 'b6', booked: { join_heads: 3, charter_boats: 1, upgrades: 1, upgrades_due: 0 } }] }],
  totals: {}, booked: {},
};

test('§ltSheetBooked: the month cards answer from the long-tail sheet, with no per-day boats read and no legacy walk', () => {
  const rt = ltRuntime({ 'longtail|tublamu|2026-11': month });
  const [a, b] = rt.w.pc2LT('tublamu');
  assert.deepEqual(J(a), { chtr: 1, join: 3, upg: 1, upgDue: 0 }, 'the sheet boat');
  assert.deepEqual(J(b), { chtr: 9, join: 9, upg: 0, upgDue: 0 }, 'a boat the sheet does not list: the old path');
  assert.deepEqual(rt.asked, ['want tublamu 2026-11-07', 'legacy 2026-11-07 b9'], 'no month-wide boats read (§daysOne wantRange is gone)');
});

test('§ltSheetBooked: before the sheet of the month is read, nothing is booked and nothing is asked (the sheet redraws when it lands)', () => {
  const rt = ltRuntime({});
  assert.deepEqual(J(rt.w.pc2LTDay('tublamu', '2026-11-06')), { chtr: 0, join: 0, upg: 0, upgDue: 0 });
  assert.deepEqual(rt.asked, []);
});

test('§ltSheetBooked: an older backend without upgrades in the sheet falls back to the boats read', () => {
  const old = JSON.parse(JSON.stringify(month)); delete old.days[0].boats[0].booked.upgrades;
  const rt = ltRuntime({ 'longtail|tublamu|2026-11|2026-11-06': old });
  rt.w.pc2LTDay('tublamu', '2026-11-06');
  assert.deepEqual(rt.asked, ['want tublamu 2026-11-06', 'legacy 2026-11-06 b6']);
});

function codeRuntime(bookings, ops = true) {
  const ctx = vm.createContext({ window: { LA_LEGACY_UNAVAILABLE: ops }, SB_BOOKINGS: bookings, Array, Number });
  vm.runInContext(fs.readFileSync('allotment_v2/js/booking/bookingV2DisplayCode.js', 'utf8'), ctx);
  return ctx.bookingV2DisplayCode;
}

test('§opsDisplayCode: an order line shows the server\'s display_code, also from a list row that only carries the id', () => {
  const raw = { id: 'b2c_LOV-7228679_8', voucherRef: 'LOV-7228679', displayCode: 'LOV-7228679-8' };
  const sib = { id: 'b2c_LOV-7228679_7', voucherRef: 'LOV-7228679', displayCode: 'LOV-7228679-7' };
  const code = codeRuntime([sib, raw]);
  assert.equal(code(raw), 'LOV-7228679-8', 'not -2: the browser holds 2 of the order\'s 8 lines');
  assert.equal(code({ id: 'b2c_LOV-7228679_8', voucherRef: 'LOV-7228679' }), 'LOV-7228679-8', 'a list row (bkV2Norm) finds its raw booking');
  assert.equal(codeRuntime([sib, { id: raw.id, voucherRef: raw.voucherRef }], false)({ id: raw.id, voucherRef: raw.voucherRef }), 'LOV-7228679-2', 'legacy mode: legacy\'s own count');
});
