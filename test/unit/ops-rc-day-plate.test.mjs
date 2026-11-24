// §rcDayPlate (ops/39-ops-rc-day-plate.js): Re-confirm and Pier Check-in read the day's plate (van-days `plate`) into VANJOB_DRIVER,
// so legacy's vanJobsDriverInfo(van, date) shows it before the van's registered plate.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runtime, plain } from './fe-harness.mjs';

const D = '2026-11-24';
function setup({ days, drivers = {} } = {}) {
  const drawn = [];
  const VANJOB_DRIVER = drivers;
  const vehicles = { veh01: { id: 'veh01', plate: 'REG-1' }, veh02: { id: 'veh02', plate: 'REG-2' } };
  const r = runtime({
    globals: {
      VANJOB_DRIVER, _rcDate: D, _pckDate: D,
      document: { getElementById: (id) => (id === 'reconfirm-host' || id === 'piercheckin-host' ? {} : null), querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {} },
      renderReconfirm: () => drawn.push('reconfirm'), renderPierCheckin: () => drawn.push('pier'),
      // legacy's reader, as 08-app.js has it: the day's override first, then the van's own
      vanJobsDriverInfo: (vanId, date) => { const o = VANJOB_DRIVER[date + '::' + vanId]; return { plate: (o && o.plate) || vehicles[vanId].plate }; },
    },
    handlers: { 'GET /operations/van-days': () => ({ body: { from: D, to: D, vans: [], days: days || [
      { van_id: 'veh01', service_date: D, driver: null, driver_phone: null, plate: '31-6675' },
      { van_id: 'veh02', service_date: D, driver: null, driver_phone: null, plate: null },
    ] } }) },
  });
  r.load('39-ops-rc-day-plate.js');
  return { ...r, drawn, VANJOB_DRIVER };
}

test('Re-confirm reads its day once: the day’s plate replaces the registered one, and the screen is drawn again', async () => {
  const { ctx, requests, settle, drawn } = setup();
  assert.equal(ctx.vanJobsDriverInfo('veh01', D).plate, 'REG-1', 'before: the registered plate');
  ctx.renderReconfirm();
  await settle();
  assert.deepEqual(requests.map((q) => q.path), ['/operations/van-days?from=2026-11-24&to=2026-11-24']);
  assert.equal(ctx.vanJobsDriverInfo('veh01', D).plate, '31-6675', 'the plate typed for that day');
  assert.equal(ctx.vanJobsDriverInfo('veh02', D).plate, 'REG-2', 'no plate of the day: the van’s own');
  assert.deepEqual(drawn, ['reconfirm', 'reconfirm'], 'drawn, then drawn again with the plate; the redraw does not ask again');
  assert.equal(requests.length, 1);
});

test('a day whose overrides did not change is not redrawn; a removed override goes; Pier Check-in reads its day too', async () => {
  const same = setup({ drivers: { [`${D}::veh01`]: { driver: '', phone: '', plate: '31-6675' } } });
  same.ctx.renderPierCheckin();
  await same.settle();
  assert.deepEqual(same.drawn, ['pier']);

  const gone = setup({ days: [], drivers: { [`${D}::veh01`]: { driver: '', phone: '', plate: 'OLD' }, ['2026-11-25::veh01']: { driver: 'x', phone: '', plate: '' } } });
  gone.ctx.renderReconfirm();
  await gone.settle();
  assert.deepEqual(plain(gone.VANJOB_DRIVER), { '2026-11-25::veh01': { driver: 'x', phone: '', plate: '' } }, 'only that day’s entries are replaced');
  assert.deepEqual(gone.drawn, ['reconfirm', 'reconfirm']);
});
