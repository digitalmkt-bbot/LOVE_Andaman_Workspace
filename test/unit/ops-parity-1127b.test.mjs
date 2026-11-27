// Parity round 7 (2026-11-27b), agent O: the PR/PO sheet's departure times come with the server's answer (O3).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('O3: while PR/PO draws, pjDepOf answers the boat-day departure the prep report carries (legacy read PIER_JOB.dep)', () => {
  const answer = { piers: [{ pier: 'panwa', programmes: [{ route_id: 'r7', cells: [
    { date: '2026-11-10', boat_id: 'b4', departure: '06:00', capacity: 40, booking_rows: [] },
    { date: '2026-11-10', boat_id: 'b5', departure: null, capacity: 40, booking_rows: [] },
  ] }], restaurants: [] }] };
  const seen = [];
  const window = {
    _ppFrom: '2026-11-01', _ppTo: '2026-11-30',
    pjDepOf: (d, b, fb) => 'legacy:' + fb,
    renderPrPo: () => { seen.push(window.pjDepOf('2026-11-10', 'b4', '06:30'), window.pjDepOf('2026-11-10', 'b5', '06:30'), window.pjDepOf('2026-11-11', 'b4', '06:30')); },
    ppRows: () => [], ppCapOf: () => 0, ppCapTag: () => '', ppPierCapTag: () => '',
  };
  window.laOps = { enabled: () => true, srv: { read: () => answer, status: () => 'ok' }, activeView: () => 'prpo', whenFree: (f) => f() };
  const ctx = vm.createContext({ window, document: { getElementById: () => null }, Number, String, Object, Array, JSON, Math });
  vm.runInContext(fs.readFileSync('allotment_v2/js/ops/73-ops-prep.js', 'utf8'), ctx);
  window.renderPrPo();
  assert.deepEqual(seen, ['06:00', 'legacy:06:30', 'legacy:06:30']);
  assert.equal(window.pjDepOf('2026-11-10', 'b4', '06:30'), 'legacy:06:30', 'restored after the draw');
});
