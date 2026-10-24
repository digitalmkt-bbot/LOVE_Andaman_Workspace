import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SOURCE = fs.readFileSync('allotment_v2/js/ops/27-ops-weather.js', 'utf8');

// JSON copy so vm-realm objects compare cleanly with deepStrictEqual.
const A = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const apiErr = (status, code, message) => Object.assign(new Error(message), { status, code });
function gate() { let open; const p = new Promise((r) => { open = r; }); return { p, open }; }
const qsOf = (q) => {
  const parts = Object.keys(q || {}).filter((k) => q[k] !== undefined && q[k] !== null && q[k] !== '')
    .map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(q[k]));
  return parts.length ? '?' + parts.join('&') : '';
};

// answers: 'METHOD /path' → value | Error | (body) => value | Promise. Records every server call and its body.
function runtime({ enabled = true, answers = {}, confirmAnswers = [], closures = [], bookings = [], inputs = {} } = {}) {
  const calls = [], bodies = [], failures = [], toasts = [], wrote = [], reloads = [], legacy = [], confirms = [], modals = [];
  const renders = { op: 0, booking: 0 };
  const SB_WEATHER_CLOSURES = closures;
  const SB_BOOKINGS = bookings;

  const respond = (method, path, body) => {
    calls.push(method + ' ' + path);
    bodies.push(body === undefined ? null : A(body));
    const a = answers[method + ' ' + path];
    if (typeof a === 'function') return Promise.resolve().then(() => a(body));
    if (a instanceof Error) return Promise.reject(a);
    return Promise.resolve(a === undefined ? null : A(a));
  };

  const window = {
    laCanEditArea: () => true,
    laOps: {
      enabled: () => enabled,
      get: (p, q) => respond('GET', p + qsOf(q)),
      post: (p, b) => respond('POST', p, b === undefined ? {} : b),
      patch: (p, b) => respond('PATCH', p, b),
      bookingWrite: (method, p, bk, b) => respond(method, p, b),
      queue: (fn) => Promise.resolve().then(fn),
      wrote: (k) => wrote.push(k),
      fail: (title, e) => failures.push({ title, message: e && e.message }),
      toast: (t) => toasts.push(t),
      bookings: { reload: (id) => { reloads.push(id); return Promise.resolve(); } },
      today: () => '2026-10-12',
      shift: (ds, n) => { const d = new Date(ds + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); },
    },
    bookingV2WeatherCancel: (...a) => { legacy.push('bookingV2WeatherCancel'); return 'legacy:cancel'; },
    bookingV2WeatherMarkConfirm: (...a) => { legacy.push('bookingV2WeatherMarkConfirm'); return 'legacy:markConfirm'; },
    bookingV2WeatherUncancel: (...a) => { legacy.push('bookingV2WeatherUncancel'); return 'legacy:uncancel'; },
    bookingV2WeatherNotify: (...a) => { legacy.push('bookingV2WeatherNotify'); return 'legacy:notify'; },
    bookingV2WeatherResolveOne: (...a) => { legacy.push('bookingV2WeatherResolveOne'); return 'legacy:resolveOne'; },
    bookingV2WeatherPanel: (...a) => { legacy.push('bookingV2WeatherPanel'); return 'legacy:panel'; },
    bookingV2WeatherCountsFor: (...a) => { legacy.push('bookingV2WeatherCountsFor'); return 'legacy:counts'; },
    bookingV2WeatherTagBookings: (...a) => { legacy.push('bookingV2WeatherTagBookings'); return 'legacy:tag'; },
  };
  const document = {
    getElementById: (id) => (Object.prototype.hasOwnProperty.call(inputs, id) ? { value: inputs[id], style: {} } : null),
    addEventListener: () => {},
  };
  const ctx = {
    window, document, SB_WEATHER_CLOSURES, SB_BOOKINGS, console, Promise, Array, Object, Error, String, Date, JSON, Math, Number,
    ROUTES: [{ id: 'r10', name: 'Similan' }],
    confirm: (m) => { confirms.push(m); return confirmAnswers.length ? confirmAnswers.shift() : false; },
    alert: () => {},
    acctModal: (h) => modals.push(h),
    acctModalClose: () => modals.push('CLOSE'),
    renderOp: () => { renders.op++; },
    bookingV2Render: () => { renders.booking++; },
    encodeURIComponent, decodeURIComponent,
  };
  vm.runInNewContext(SOURCE, ctx);
  return { window, calls, bodies, failures, toasts, wrote, reloads, legacy, confirms, modals, renders, SB_WEATHER_CLOSURES, SB_BOOKINGS };
}

const ROW_WX1 = {
  id: 'wx_1', route_id: 'r10', service_date: '2026-10-05', note: 'high waves 3m', closed_by: 'ops1', closed_at: '2026-10-04T05:00:00.000Z',
  counts: { awaiting: 1, notified: 1, resolved: 2 }, pax: { pending: 6, cancelled: 2, rescheduled: 4, total: 12 }, bookings: [],
};
const WX1_CLOSURE = { opsId: 'wx_1', routeId: 'r10', date: '2026-10-05', reason: 'weather', note: 'high waves 3m', at: '', counts: null, pax: null };
const wxDetail = (bookings, extra = {}) => ({ ...ROW_WX1, bookings, ...extra });
const followUp = (over) => ({ booking_id: 'BK-1', voucher_ref: 'V-881', agent_id: 'a01', lead_pax: 'Ann', booking_status: 'confirmed',
  booking_mode: 'seat', pax: 4, on_trip: true, payment_state: 'paid', refundable: 5600, status: 'awaiting',
  notified_at: null, outcome: null, new_date: null, ...over });

test('load maps server closures to the legacy shape and keeps closures outside the range', async () => {
  const rt = runtime({
    closures: [{ opsId: 'wx_0', routeId: 'r9', date: '2026-09-01', reason: 'weather', note: '', at: '' }],
    answers: { 'GET /v1/weather-closures?from=2026-10-01&to=2026-10-31': { closures: [ROW_WX1] } },
  });
  const rows = await rt.window.laOps.weather.load('2026-10-01', '2026-10-31');
  assert.equal(rows.length, 1);
  assert.deepEqual(rt.calls, ['GET /v1/weather-closures?from=2026-10-01&to=2026-10-31', 'GET /v1/weather-closures?from=2026-10-01&to=2026-10-31&include_reopened=true']);   // the second one: follow-ups of re-opened trips
  assert.deepEqual(A(rt.SB_WEATHER_CLOSURES), [
    { opsId: 'wx_0', routeId: 'r9', date: '2026-09-01', reason: 'weather', note: '', at: '' },
    { opsId: 'wx_1', routeId: 'r10', date: '2026-10-05', reason: 'weather', note: 'high waves 3m', at: '2026-10-04T05:00:00.000Z',
      counts: { awaiting: 1, notified: 1, resolved: 2 }, pax: { pending: 6, cancelled: 2, rescheduled: 4, total: 12 }, snapshot: null, reasonLog: [], reopenedAt: null },
  ]);
});

test('create: nothing local before the server answers, then the closure is held with its server id', async () => {
  const g = gate();
  const rt = runtime({
    inputs: { 'wx-note': 'port closed' },
    answers: {
      'POST /v1/weather-closures': () => g.p.then(() => ({ ...ROW_WX1, id: 'wx_2', route_id: 'r10', service_date: '2026-10-06', note: 'port closed' })),
      'GET /v1/weather-closures/wx_2': () => ({ ...ROW_WX1, id: 'wx_2', route_id: 'r10', service_date: '2026-10-06', note: 'port closed', bookings: [] }),
    },
  });
  const p = rt.window.bookingV2WeatherMarkConfirm('r10', '2026-10-06');
  assert.equal(rt.SB_WEATHER_CLOSURES.length, 0, 'no local closure before the answer');
  g.open();
  await p;
  assert.deepEqual(rt.calls, ['POST /v1/weather-closures', 'GET /v1/weather-closures/wx_2']);
  assert.deepEqual(rt.bodies[0], { route_id: 'r10', service_date: '2026-10-06', note: 'port closed', reason: 'weather' });
  assert.equal(rt.SB_WEATHER_CLOSURES.length, 1);
  assert.equal(rt.SB_WEATHER_CLOSURES[0].opsId, 'wx_2');
  assert.deepEqual(rt.wrote, ['weather']);
  assert.equal(rt.legacy.length, 0);
});

test('create refused (409 already_closed): nothing local, the server message is shown', async () => {
  const rt = runtime({
    inputs: { 'wx-note': 'x' },
    answers: { 'POST /v1/weather-closures': apiErr(409, 'already_closed', 'trip already closed (wx_1)') },
  });
  await rt.window.bookingV2WeatherMarkConfirm('r10', '2026-10-05');
  assert.deepEqual(rt.calls, ['POST /v1/weather-closures']);
  assert.equal(rt.SB_WEATHER_CLOSURES.length, 0);
  assert.equal(rt.failures.length, 1);
  assert.match(rt.failures[0].message, /already closed/);
  assert.deepEqual(rt.wrote, []);
});

test('update note: PATCH with only the note; local note changes only from the answer', async () => {
  const g = gate();
  const rt = runtime({
    closures: [{ ...WX1_CLOSURE, note: 'old' }],
    inputs: { 'wx-note': 'updated' },
    answers: {
      'PATCH /v1/weather-closures/wx_1': () => g.p.then(() => ({ id: 'wx_1', note: 'updated' })),
      'GET /v1/weather-closures/wx_1': wxDetail([], { note: 'updated' }),
    },
  });
  const p = rt.window.bookingV2WeatherMarkConfirm('r10', '2026-10-05');
  assert.equal(rt.SB_WEATHER_CLOSURES[0].note, 'old', 'no local change before the answer');
  g.open();
  await p;
  assert.deepEqual(rt.calls, ['PATCH /v1/weather-closures/wx_1', 'GET /v1/weather-closures/wx_1']);
  assert.deepEqual(rt.bodies[0], { note: 'updated', reason: 'weather' }, 'the note and the reason picked on the form (the server logs a change)');
  assert.equal(rt.SB_WEATHER_CLOSURES[0].note, 'updated');
});

test('update note refused: the note stays as it was', async () => {
  const rt = runtime({
    closures: [{ ...WX1_CLOSURE, note: 'old' }],
    inputs: { 'wx-note': 'updated' },
    answers: { 'PATCH /v1/weather-closures/wx_1': apiErr(400, 'bad_request', 'note too long') },
  });
  await rt.window.bookingV2WeatherMarkConfirm('r10', '2026-10-05');
  assert.deepEqual(rt.calls, ['PATCH /v1/weather-closures/wx_1']);
  assert.equal(rt.SB_WEATHER_CLOSURES[0].note, 'old');
  assert.equal(rt.failures.length, 1);
});

test('notify: POST to the closure booking path with an empty body; status mirrored only after the answer', async () => {
  const bk = { id: 'local-1', opsId: 'BK-1', weatherResolve: { event: 'r10|2026-10-05', status: 'awaiting' } };
  const rt = runtime({
    closures: [{ ...WX1_CLOSURE }], bookings: [bk],
    answers: {
      'POST /v1/weather-closures/wx_1/bookings/BK-1/notify': { booking_id: 'BK-1', status: 'notified' },
      'GET /v1/weather-closures/wx_1': wxDetail([followUp({ status: 'notified', notified_at: '2026-10-12T03:00:00.000Z' })]),
    },
  });
  await rt.window.bookingV2WeatherNotify('local-1', 'wxr-');
  assert.deepEqual(rt.calls, ['POST /v1/weather-closures/wx_1/bookings/BK-1/notify', 'GET /v1/weather-closures/wx_1']);
  assert.deepEqual(rt.bodies[0], {});
  assert.equal(rt.SB_BOOKINGS[0].weatherResolve.status, 'notified');
  assert.equal(rt.renders.booking, 1);
});

test('notify refused (409 wrong_status): the booking keeps its status', async () => {
  const bk = { id: 'local-1', opsId: 'BK-1', weatherResolve: { event: 'r10|2026-10-05', status: 'awaiting' } };
  const rt = runtime({
    closures: [{ ...WX1_CLOSURE }], bookings: [bk],
    answers: { 'POST /v1/weather-closures/wx_1/bookings/BK-1/notify': apiErr(409, 'wrong_status', 'booking is not awaiting') },
  });
  await rt.window.bookingV2WeatherNotify('local-1', 'wxr-');
  assert.deepEqual(rt.calls, ['POST /v1/weather-closures/wx_1/bookings/BK-1/notify']);
  assert.equal(rt.SB_BOOKINGS[0].weatherResolve.status, 'awaiting');
  assert.equal(rt.failures.length, 1);
  assert.equal(rt.renders.booking, 0);
});

test('reschedule resolves through the booking command with reason weather; local booking reloaded only after the answer', async () => {
  const bk = { id: 'local-1', opsId: 'BK-1', weatherResolve: { event: 'r10|2026-10-05', status: 'notified' } };
  const rt = runtime({
    closures: [{ ...WX1_CLOSURE }], bookings: [bk],
    inputs: { 'wxr-out-local-1': 'reschedule', 'wxr-date-local-1': '2026-10-07' },
    answers: {
      'POST /v1/bookings/BK-1/reschedule': { id: 'BK-1', status: 'confirmed' },
      'GET /v1/weather-closures/wx_1': wxDetail([followUp({ status: 'resolved', outcome: 'reschedule', new_date: '2026-10-07' })]),
    },
  });
  await rt.window.bookingV2WeatherResolveOne('local-1', 'wxr-');
  assert.deepEqual(rt.calls, ['POST /v1/bookings/BK-1/reschedule', 'GET /v1/weather-closures/wx_1']);
  assert.deepEqual(rt.bodies[0], { from_date: '2026-10-05', to_date: '2026-10-07', reason: 'weather' });
  assert.deepEqual(rt.reloads, ['local-1']);
  assert.equal(rt.SB_BOOKINGS[0].weatherResolve.outcome, 'reschedule');
  assert.equal(rt.SB_BOOKINGS[0].weatherResolve.newDate, '2026-10-07');
});

test('reschedule refused: no reload, no local follow-up change', async () => {
  const bk = { id: 'local-1', opsId: 'BK-1', weatherResolve: { event: 'r10|2026-10-05', status: 'notified' } };
  const rt = runtime({
    closures: [{ ...WX1_CLOSURE }], bookings: [bk],
    inputs: { 'wxr-out-local-1': 'reschedule', 'wxr-date-local-1': '2026-10-07' },
    answers: { 'POST /v1/bookings/BK-1/reschedule': apiErr(409, 'capacity_full', 'the new day is full') },
  });
  await rt.window.bookingV2WeatherResolveOne('local-1', 'wxr-');
  assert.deepEqual(rt.calls, ['POST /v1/bookings/BK-1/reschedule']);
  assert.deepEqual(rt.reloads, []);
  assert.equal(rt.SB_BOOKINGS[0].weatherResolve.status, 'notified');
  assert.match(rt.failures[0].message, /full/);
});

test('cancel-weather as credit: sends the outcome only; the amount shown is the server answer', async () => {
  const bk = { id: 'local-1', opsId: 'BK-1', weatherResolve: { event: 'r10|2026-10-05', status: 'notified' } };
  const rt = runtime({
    closures: [{ ...WX1_CLOSURE }], bookings: [bk],
    inputs: { 'wxr-out-local-1': 'credit', 'wxr-date-local-1': '2026-10-05' },
    answers: {
      'POST /v1/bookings/BK-1/cancel-weather': { id: 'BK-1', status: 'cancelled_weather',
        refunds: [{ id: 'rf_1', kind: 'credit', amount: 5600, invoice_id: 'inv_1' }] },
      'GET /v1/weather-closures/wx_1': wxDetail([followUp({ status: 'resolved', outcome: 'credit' })]),
    },
  });
  await rt.window.bookingV2WeatherResolveOne('local-1', 'wxr-');
  assert.deepEqual(rt.calls, ['POST /v1/bookings/BK-1/cancel-weather', 'GET /v1/weather-closures/wx_1']);
  assert.deepEqual(rt.bodies[0], { outcome: 'credit' });
  assert.match(rt.toasts[0].sub, /credit/);
  assert.match(rt.toasts[0].sub, /5,600/);
  assert.equal(rt.SB_BOOKINGS[0].weatherResolve.outcome, 'credit');
});

test('cancel-weather refused (409 nothing_paid): nothing reloaded, the server message is shown', async () => {
  const bk = { id: 'local-1', opsId: 'BK-1', status: 'confirmed', weatherResolve: { event: 'r10|2026-10-05', status: 'notified' } };
  const rt = runtime({
    closures: [{ ...WX1_CLOSURE }], bookings: [bk],
    inputs: { 'wxr-out-local-1': 'credit' },
    answers: { 'POST /v1/bookings/BK-1/cancel-weather': apiErr(409, 'nothing_paid', 'nothing paid to keep as credit') },
  });
  await rt.window.bookingV2WeatherResolveOne('local-1', 'wxr-');
  assert.deepEqual(rt.calls, ['POST /v1/bookings/BK-1/cancel-weather']);
  assert.deepEqual(rt.reloads, []);
  assert.equal(rt.SB_BOOKINGS[0].status, 'confirmed');
  assert.equal(rt.SB_BOOKINGS[0].weatherResolve.status, 'notified');
  assert.match(rt.failures[0].message, /nothing paid/);
});

test('undo: 409 has_resolved asks, then re-sends with undo_anyway; resolved follow-ups are kept', async () => {
  const bk1 = { id: 'local-1', opsId: 'BK-1', weatherResolve: { event: 'r10|2026-10-05', status: 'notified' } };
  const bk2 = { id: 'local-2', opsId: 'BK-2', weatherResolve: { event: 'r10|2026-10-05', status: 'resolved', outcome: 'refund' } };
  const rt = runtime({
    closures: [{ ...WX1_CLOSURE }], bookings: [bk1, bk2], confirmAnswers: [true],
    answers: {
      'POST /v1/weather-closures/wx_1/undo': (body) => (body && body.undo_anyway
        ? { id: 'wx_1', reopened_at: '2026-10-12T04:00:00.000Z' }
        : Promise.reject(apiErr(409, 'has_resolved', 'resolved: BK-2 · refund'))),
      // after the undo the follow-up rows are read again so a resolved booking keeps its outcome (legacy keeps bk.weatherResolve)
      'GET /v1/weather-closures/wx_1': { id: 'wx_1', route_id: 'r10', service_date: '2026-10-05', reopened_at: '2026-10-12T04:00:00.000Z',
        bookings: [{ booking_id: 'BK-2', status: 'resolved', outcome: 'refund' }] },
    },
  });
  await rt.window.bookingV2WeatherUncancel('r10', '2026-10-05');
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(rt.calls, ['POST /v1/weather-closures/wx_1/undo', 'POST /v1/weather-closures/wx_1/undo', 'GET /v1/weather-closures/wx_1']);
  assert.deepEqual(rt.bodies.slice(0, 2), [{}, { undo_anyway: true }]);
  assert.equal(rt.confirms.length, 1);
  assert.match(rt.confirms[0], /resolved: BK-2/);
  assert.equal(rt.SB_WEATHER_CLOSURES.length, 0);
  assert.equal(rt.SB_BOOKINGS[0].weatherResolve, undefined);
  assert.equal(rt.SB_BOOKINGS[1].weatherResolve.status, 'resolved');
  assert.equal(rt.failures.length, 0);
});

test('undo declined at the has_resolved question: one call, the closure stays', async () => {
  const rt = runtime({
    closures: [{ ...WX1_CLOSURE }], confirmAnswers: [false],
    answers: { 'POST /v1/weather-closures/wx_1/undo': apiErr(409, 'has_resolved', 'resolved: BK-2 · refund') },
  });
  await rt.window.bookingV2WeatherUncancel('r10', '2026-10-05');
  assert.deepEqual(rt.calls, ['POST /v1/weather-closures/wx_1/undo']);
  assert.equal(rt.SB_WEATHER_CLOSURES.length, 1);
});

test('a closure with no server id is refused locally: no call, a clear message', async () => {
  const rt = runtime({ closures: [{ routeId: 'r10', date: '2026-10-05', reason: 'weather', note: '' }] });
  await rt.window.bookingV2WeatherUncancel('r10', '2026-10-05');
  assert.deepEqual(rt.calls, []);
  assert.equal(rt.SB_WEATHER_CLOSURES.length, 1);
  assert.match(rt.failures[0].message, /no operation-backend id/);
});

test('a booking with no server id is refused locally: no call, nothing reloaded', async () => {
  const bk = { id: 'local-9', weatherResolve: { event: 'r10|2026-10-05', status: 'notified' } };
  const rt = runtime({ closures: [{ ...WX1_CLOSURE }], bookings: [bk], inputs: { 'wxr-out-local-9': 'refund' } });
  await rt.window.bookingV2WeatherResolveOne('local-9', 'wxr-');
  assert.deepEqual(rt.calls, []);
  assert.deepEqual(rt.reloads, []);
  assert.equal(rt.SB_BOOKINGS[0].weatherResolve.status, 'notified');
  assert.match(rt.failures[0].message, /no operation-backend id/);
});

test('the panel reads the server follow-up list (looking the closure up when it is not held)', async () => {
  const rt = runtime({
    answers: {
      'GET /v1/weather-closures?from=2026-10-05&to=2026-10-05&route_id=r10': { closures: [{ ...ROW_WX1 }] },
      'GET /v1/weather-closures/wx_1': wxDetail([followUp({ status: 'awaiting' })]),
    },
  });
  await rt.window.bookingV2WeatherPanel('r10', '2026-10-05');
  assert.deepEqual(rt.calls, ['GET /v1/weather-closures?from=2026-10-05&to=2026-10-05&route_id=r10', 'GET /v1/weather-closures/wx_1']);
  const html = rt.modals[rt.modals.length - 1];
  assert.match(html, /data-la-wx="notify" data-cid="wx_1" data-bid="BK-1"/);
  assert.match(html, /V-881/);
  assert.equal(rt.legacy.length, 0);
});

test('calendar tallies come from the server counts; the legacy tag step does nothing in ops mode', async () => {
  const rt = runtime({ closures: [{ ...WX1_CLOSURE, pax: { pending: 6, cancelled: 2, rescheduled: 4, total: 12 } }] });
  const c = rt.window.bookingV2WeatherCountsFor('r10', '2026-10-05');
  assert.deepEqual(A(c), { cancelled: 2, rescheduled: 4, pending: 6, total: 12 });
  assert.equal(rt.window.bookingV2WeatherTagBookings('r10', '2026-10-05'), undefined);
  assert.deepEqual(rt.calls, []);
  assert.deepEqual(rt.legacy, []);
});

test('legacy mode: every wrapper delegates to the original and makes zero API calls', async () => {
  const rt = runtime({ enabled: false, closures: [{ ...WX1_CLOSURE }], bookings: [{ id: 'local-1', opsId: 'BK-1', weatherResolve: { event: 'r10|2026-10-05', status: 'awaiting' } }] });
  const w = rt.window;
  assert.equal(w.bookingV2WeatherCancel('r10', '2026-10-05'), 'legacy:cancel');
  assert.equal(w.bookingV2WeatherMarkConfirm('r10', '2026-10-05'), 'legacy:markConfirm');
  assert.equal(w.bookingV2WeatherUncancel('r10', '2026-10-05'), 'legacy:uncancel');
  assert.equal(w.bookingV2WeatherNotify('local-1', 'wxr-'), 'legacy:notify');
  assert.equal(w.bookingV2WeatherResolveOne('local-1', 'wxr-'), 'legacy:resolveOne');
  assert.equal(w.bookingV2WeatherPanel('r10', '2026-10-05'), 'legacy:panel');
  assert.equal(w.bookingV2WeatherCountsFor('r10', '2026-10-05'), 'legacy:counts');
  assert.equal(w.bookingV2WeatherTagBookings('r10', '2026-10-05'), 'legacy:tag');
  assert.deepEqual(rt.legacy, ['bookingV2WeatherCancel', 'bookingV2WeatherMarkConfirm', 'bookingV2WeatherUncancel', 'bookingV2WeatherNotify',
    'bookingV2WeatherResolveOne', 'bookingV2WeatherPanel', 'bookingV2WeatherCountsFor', 'bookingV2WeatherTagBookings']);
  assert.deepEqual(rt.calls, []);
  assert.deepEqual(rt.wrote, []);
});

test('the read-side mapping of one closure row keeps the server id and tallies', () => {
  const rt = runtime();
  const m = A(rt.window.laOps.weather.mapClosure(ROW_WX1));
  assert.deepEqual(m, { opsId: 'wx_1', routeId: 'r10', date: '2026-10-05', reason: 'weather', note: 'high waves 3m',
    at: '2026-10-04T05:00:00.000Z', counts: { awaiting: 1, notified: 1, resolved: 2 }, pax: { pending: 6, cancelled: 2, rescheduled: 4, total: 12 }, snapshot: null, reasonLog: [], reopenedAt: null });
});

test('reschedule refused when the booking has another trip that day: the server would move it too', async () => {
  const bk = { id: 'local-1', opsId: 'BK-1', weatherResolve: { event: 'r10|2026-10-05', status: 'notified' },
    trips: [{ date: '2026-10-05', routeId: 'r10' }, { date: '2026-10-05', routeId: 'r2' }] };
  const rt = runtime({
    closures: [{ ...WX1_CLOSURE }], bookings: [bk],
    inputs: { 'wxr-out-local-1': 'reschedule', 'wxr-date-local-1': '2026-10-07' },
    answers: { 'POST /v1/bookings/BK-1/reschedule': { id: 'BK-1' } },
  });
  await rt.window.bookingV2WeatherResolveOne('local-1', 'wxr-');
  assert.deepEqual(rt.calls, []);
  assert.deepEqual(rt.reloads, []);
  assert.equal(rt.SB_BOOKINGS[0].weatherResolve.status, 'notified');
  assert.match(rt.failures[0].message, /other trip/);
});
