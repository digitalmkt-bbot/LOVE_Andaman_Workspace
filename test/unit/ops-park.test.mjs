import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SOURCE = fs.readFileSync('allotment_v2/js/ops/32-ops-park.js', 'utf8');
const J = (x) => JSON.parse(JSON.stringify(x === undefined ? null : x));
const DATE = '2026-10-12';
const DAY_PATH = '/v1/pier-office/tublamu/park-tickets';
const GET_PATH = DAY_PATH + '?date=' + DATE;
const GET_KEY = 'GET ' + GET_PATH;
const NAMES = 'PUT ' + DAY_PATH + '/' + DATE + '/names';
const FIXES = 'PUT ' + DAY_PATH + '/' + DATE + '/fixes';
const TYPES_GET = 'GET /v1/pier-office/park-types';

const TYPES = [
  { key: 'adTH', name: 'ผู้ใหญ่ชาวไทย', short: 'ผญ ไทย', group: 'ad', code: 'YTRGRVMY', base: true },
  { key: 'chTH', name: 'เด็กไทย (อายุ 3-14 ปี)', short: 'ดญ ไทย', group: 'chd', code: 'BRUAWXAX', base: true },
  { key: 'adFR', name: 'ผู้ใหญ่ชาวต่างชาติ', short: 'ผญ ตปท', group: 'ad', code: 'JGRPPCYF', base: true },
  { key: 'chFR', name: 'เด็กชาวต่างชาติ (อายุ 3-14 ปี)', short: 'ดญ ตปท', group: 'chd', code: 'EUMJVBAU', base: true },
  { key: 'inf', name: 'เด็กอายุต่ำกว่า 3 ปี', short: 'ต่ำกว่า 3', group: 'inf', code: 'CCTBTNPB', base: true },
  { key: 'p1', name: 'Custom', short: 'Custom', group: 'ad', code: 'X1', base: false },
];

// One day as the server answers it: boat b1 on route r1, one passenger, one typed-empty seat, one typed seat, one orphan.
function dayFixture() {
  return {
    pier: 'tublamu', date: DATE, types: TYPES,
    tickets: [{ type: 'adFR', code: 'JGRPPCYF', count: 1 }],
    boats: [{
      booking_ids: ['bk1'], route_id: 'r1', route_name: 'Similan', boat_id: 'b1', boat_name: 'Boat One', booked: 3,
      counts: { adTH: 2, chTH: 0, adFR: 1, chFR: 0, inf: 0 }, tot: 3,
      miss: { adTH: 0, chTH: 0, adFR: 1, chFR: 0, inf: 0, p1: 0 }, miss_total: 1,
      people: [
        { booking_id: 'bk1', ph: false, seq: null, slot: '0', full: 'Somchai Dee', first: 'Somchai', last: 'Dee', nationality: 'TH', auto: 'adTH', cat: 'adTH', fixed: false, mismatch: false, over: false, typed: true, voucher: 'V1' },
        { booking_id: 'bk1', ph: true, seq: 1, slot: 'ph:adFR:1', full: '', first: '', last: '', nationality: 'US', auto: 'adFR', cat: 'adFR', fixed: false, mismatch: false, over: false, typed: false, voucher: 'V1' },
        { booking_id: 'bk1', ph: true, seq: 2, slot: 'ph:adTH:2', full: 'Typed Person', first: 'Typed', last: 'Person', nationality: 'TH', auto: 'adTH', cat: 'adTH', fixed: false, mismatch: false, over: false, typed: true, voucher: 'V1' },
      ],
      orphans: [{ booking_id: 'bk1', cat: 'adFR', seq: 3, full: 'Old Name' }],
    }],
  };
}

function runtime({ enabled = true, answers = {}, confirmAnswer = true, modalOpen = false } = {}) {
  const calls = [];
  const fails = [];
  const toasts = [];
  const wrote = [];
  const legacy = [];
  const persists = [];
  const state = { day: dayFixture(), types: J(TYPES) };

  const req = (method, path, body) => {
    // the going heads by nationality come from the pier day's boats (read next to the park tickets); not part of what the tests count
    if (method === 'GET' && path === '/v1/pier-office/tublamu/days/' + DATE + '/boats') return Promise.resolve(J({ boats: [] }));
    calls.push(body === undefined ? { method, path } : { method, path, body: J(body) });
    const key = method + ' ' + path;
    const a = answers[key];
    if (typeof a === 'function') return Promise.resolve().then(a);
    if (a instanceof Error) return Promise.reject(a);
    if (a !== undefined) return Promise.resolve(J(a));
    return Promise.reject(new Error('no answer for ' + key));
  };

  const winObj = {
    laOps: {
      enabled: () => enabled,
      get: (p, q) => req('GET', p + (q ? '?' + Object.keys(q).map((k) => k + '=' + q[k]).join('&') : '')),
      call: (method, path, body) => req(method, path, body),
      queue: (fn) => Promise.resolve().then(fn),
      wrote: (k) => wrote.push(k),
      fail: (title, e) => fails.push({ title, code: e && e.code, message: e && e.message }),
      toast: (o) => toasts.push(o),
    },
    _poPier: 'tublamu',
    _poDate: DATE,
    PK_BASE: [
      { k: 'adTH', c: '#0F6E56', ch: ['ad_th', 'foc_th'] }, { k: 'chTH', c: '#3B6D11', ch: ['chd_th'] },
      { k: 'adFR', c: '#12518F', ch: ['ad_fr', 'foc_fr'] }, { k: 'chFR', c: '#5B289A', ch: ['chd_fr'] },
      { k: 'inf', c: '#8a857d', ch: ['inf_th', 'inf_fr'] },
    ],
    PK_ADDC: ['#B4560A'],
    DEFAULT_ROUTES: [{ id: 'r1', color: '#123456' }],
    renderPierPark: () => { legacy.push('renderPierPark'); },
    pkTkData: () => { legacy.push('pkTkData'); return ['LEGACY']; },
    pkTypes: () => { legacy.push('pkTypes'); return [{ k: 'legacy' }]; },
    pkTyModal: () => { legacy.push('pkTyModal'); },
    pkNmEdit: () => { legacy.push('pkNmEdit'); return 'legacy'; },
    pkFixSet: () => { legacy.push('pkFixSet'); return 'legacy'; },
    pkNmClearBoat: () => { legacy.push('pkNmClearBoat'); return 'legacy'; },
    pkNmDropOver: () => { legacy.push('pkNmDropOver'); return 'legacy'; },
    pkNmFillLead: () => { legacy.push('pkNmFillLead'); return 'legacy'; },
    pkNmDropLeadDup: () => { legacy.push('pkNmDropLeadDup'); return 'legacy'; },
    pkTypeSet: () => { legacy.push('pkTypeSet'); return 'legacy'; },
    pkTypeAdd: () => { legacy.push('pkTypeAdd'); return 'legacy'; },
    pkTypeDel: () => { legacy.push('pkTypeDel'); return 'legacy'; },
    poPersist: () => { persists.push(1); },
  };
  // the day and type answers are read from `state`, so a test can change what the server holds
  answers[GET_KEY] = answers[GET_KEY] || (() => state.day);
  answers[TYPES_GET] = answers[TYPES_GET] || (() => ({ types: state.types }));

  const ctx = {
    window: winObj, console, Promise, Array, Object, Error, String, Number, JSON, encodeURIComponent,
    confirm: () => confirmAnswer,
    document: { getElementById: (id) => (modalOpen && id === 'po-modal' ? {} : null) },
  };
  vm.runInNewContext(SOURCE, ctx);
  const flush = () => new Promise((r) => setImmediate(r));
  return { w: winObj, calls, fails, toasts, wrote, legacy, persists, state, flush };
}

const names = (rt) => rt.calls.filter((c) => c.method === 'PUT' && c.path.endsWith('/names'));

test('legacy mode: every wrapper delegates and no API call is made', async () => {
  const rt = runtime({ enabled: false });
  assert.deepEqual(J(rt.w.pkTkData(DATE, 'tublamu')), ['LEGACY']);
  assert.deepEqual(J(rt.w.pkTypes()), [{ k: 'legacy' }]);
  rt.w.renderPierPark('tublamu');
  rt.w.pkNmEdit({ value: 'X' }, DATE, 'bk1', 'adFR', 1);
  rt.w.pkFixSet(DATE, 'bk1', '0', 'chFR');
  rt.w.pkNmClearBoat(DATE, 'b1', 'tublamu');
  rt.w.pkNmDropOver(DATE, 'b1', 'tublamu');
  rt.w.pkNmFillLead(DATE, 'b1', 'tublamu');
  rt.w.pkNmDropLeadDup(DATE, 'b1', 'tublamu');
  rt.w.pkTypeSet('p1', 'n', 'x');
  rt.w.pkTypeAdd();
  rt.w.pkTypeDel('p1');
  rt.w.pkTyModal();
  await rt.flush();
  assert.deepEqual(rt.calls, []);
  assert.deepEqual(rt.legacy, ['pkTkData', 'pkTypes', 'renderPierPark', 'pkNmEdit', 'pkFixSet', 'pkNmClearBoat', 'pkNmDropOver',
    'pkNmFillLead', 'pkNmDropLeadDup', 'pkTypeSet', 'pkTypeAdd', 'pkTypeDel', 'pkTyModal']);
  assert.deepEqual(rt.persists, []);
});

test('ops mode: the day is read from the server, shown as the server counts it, and nothing is recounted', async () => {
  const rt = runtime();
  assert.deepEqual(J(rt.w.pkTkData(DATE, 'tublamu')), [], 'nothing is shown before the day is loaded');
  rt.w.renderPierPark();
  await rt.flush();
  assert.deepEqual(rt.calls, [{ method: 'GET', path: GET_PATH }]);
  assert.equal(rt.legacy.includes('pkTkData'), false, 'legacy recount never runs in ops mode');
  const groups = J(rt.w.pkTkData(DATE, 'tublamu'));
  assert.equal(groups.length, 1);
  assert.equal(groups[0].rid, 'r1');
  assert.deepEqual(groups[0].route, { name: 'Similan', color: '#123456' });
  const B = groups[0].boats[0];
  assert.equal(B.bid, 'b1');
  assert.deepEqual(B.boat, { id: 'b1', name: 'Boat One' });
  assert.deepEqual(B.cnt, { adTH: 2, chTH: 0, adFR: 1, chFR: 0, inf: 0 });
  assert.equal(B.tot, 3);
  assert.equal(B.booked, 3);
  assert.equal(B.missTot, 1);
  assert.equal(B.people.length, 3);
  assert.equal(B.people[0].full, 'Somchai Dee');
  assert.equal(B.people[0].vc, 'V1');
  assert.equal(B.people[1].ph, true);
  assert.equal(B.people[1].typed, false);
  assert.equal(B.people[2].typed, true);
  assert.deepEqual(B.orphan.map((o) => [o.full, o.cat, o.seq]), [['Old Name', 'adFR', 3]]);
  assert.equal(rt.persists.length, 0, 'no legacy blob write');
});

test('ops mode: the day is fetched once per pier and date, not once per render', async () => {
  const rt = runtime();
  rt.w.renderPierPark();
  rt.w.renderPierPark();
  await rt.flush();
  rt.w.renderPierPark();
  await rt.flush();
  assert.equal(rt.calls.filter((c) => c.method === 'GET').length, 1);
});

test('names: no local change before the server answers; the day is re-read after it does', async () => {
  let release;
  const pending = new Promise((r) => { release = r; });
  const rt = runtime({ answers: { [NAMES]: () => pending } });
  rt.w.renderPierPark(); await rt.flush();
  const before = J(rt.w.pkTkData(DATE, 'tublamu'));
  rt.w.pkNmEdit({ value: 'Jane Doe' }, DATE, 'bk1', 'adFR', 1);
  await rt.flush();
  assert.deepEqual(J(rt.w.pkTkData(DATE, 'tublamu')), before, 'screen unchanged while the write is in flight');
  rt.state.day.boats[0].people[1].full = 'Jane Doe';
  rt.state.day.boats[0].people[1].typed = true;
  release({ pier: 'tublamu', date: DATE, booking_id: 'bk1', cat: 'adFR', seq: 1, name: 'Jane Doe' });
  await rt.flush(); await rt.flush();
  assert.deepEqual(names(rt).map((c) => [c.method, c.path, c.body]), [[
    'PUT', DAY_PATH + '/' + DATE + '/names', { booking_id: 'bk1', cat: 'adFR', seq: 1, name: 'Jane Doe' },
  ]]);
  assert.equal(rt.calls.filter((c) => c.method === 'GET').length, 2, 'day re-read after the write');
  assert.equal(J(rt.w.pkTkData(DATE, 'tublamu'))[0].boats[0].people[1].full, 'Jane Doe');
  assert.deepEqual(rt.wrote, ['park']);
  assert.equal(rt.persists.length, 0);
});

test('names: a 409 duplicate_name is shown, nothing changes, and the day is not re-read', async () => {
  const refusal = Object.assign(new Error('Somchai Dee is already on this day (this booking)'), { code: 'duplicate_name', status: 409 });
  const rt = runtime({ answers: { [NAMES]: refusal } });
  rt.w.renderPierPark(); await rt.flush();
  const before = J(rt.w.pkTkData(DATE, 'tublamu'));
  rt.w.pkNmEdit({ value: 'Somchai Dee' }, DATE, 'bk1', 'adFR', 1);
  await rt.flush(); await rt.flush();
  assert.equal(rt.fails.length, 1);
  assert.equal(rt.fails[0].title, 'Name not saved · duplicate_name');
  assert.match(rt.fails[0].message, /already on this day/);
  assert.deepEqual(J(rt.w.pkTkData(DATE, 'tublamu')), before);
  assert.equal(rt.calls.filter((c) => c.method === 'GET').length, 1, 'no re-read after a refusal');
  assert.deepEqual(rt.wrote, []);
  assert.equal(rt.persists.length, 0);
});

test('names: a clear sends name null for the seat, typed under its own type', async () => {
  const rt = runtime({ answers: { [NAMES]: () => ({ pier: 'tublamu', date: DATE, booking_id: 'bk1', cat: 'adTH', seq: 2, name: null }) } });
  rt.w.renderPierPark(); await rt.flush();
  // the renderer passes the seat's shown type; here the fixed type equals its own, so the seat is found either way
  rt.w.pkNmEdit({ value: '' }, DATE, 'bk1', 'adTH', 2);
  await rt.flush(); await rt.flush();
  assert.deepEqual(names(rt).map((c) => c.body), [{ booking_id: 'bk1', cat: 'adTH', seq: 2, name: null }]);
});

test('names: an unknown seat is refused locally with nothing sent', async () => {
  const rt = runtime();
  rt.w.renderPierPark(); await rt.flush();
  rt.w.pkNmEdit({ value: 'X' }, DATE, 'bk1', 'chTH', 9);
  await rt.flush();
  assert.deepEqual(rt.calls.map((c) => c.method), ['GET']);
  assert.equal(rt.fails.length, 1);
});

test('fixes: the passenger index, the lead and a typed seat are sent as server slots; clearing sends type null', async () => {
  const rt = runtime({ answers: { [FIXES]: (() => ({ ok: true })) } });
  rt.w.renderPierPark(); await rt.flush();
  rt.w.pkFixSet(DATE, 'bk1', '0', 'chFR');
  await rt.flush(); await rt.flush();
  rt.w.pkFixSet(DATE, 'bk1', 'ph|adFR|1', 'chTH');
  await rt.flush(); await rt.flush();
  rt.w.pkFixSet(DATE, 'bk1', '0', '');
  await rt.flush(); await rt.flush();
  const fixes = rt.calls.filter((c) => c.path === DAY_PATH + '/' + DATE + '/fixes');
  assert.deepEqual(fixes.map((c) => c.body), [
    { booking_id: 'bk1', slot: '0', type: 'chFR' },
    { booking_id: 'bk1', slot: 'ph:adFR:1', type: 'chTH' },
    { booking_id: 'bk1', slot: '0', type: null },
  ]);
  assert.equal(rt.persists.length, 0);
});

test('fixes: a refusal leaves the count where it was', async () => {
  const refusal = Object.assign(new Error('slot must be a passenger index'), { code: '', status: 400 });
  const rt = runtime({ answers: { [FIXES]: refusal } });
  rt.w.renderPierPark(); await rt.flush();
  rt.w.pkFixSet(DATE, 'bk1', '0', 'chFR');
  await rt.flush(); await rt.flush();
  assert.equal(rt.fails.length, 1);
  assert.equal(rt.calls.filter((c) => c.method === 'GET').length, 1);
  assert.equal(J(rt.w.pkTkData(DATE, 'tublamu'))[0].boats[0].people[0].cat, 'adTH');
});

test('clear boat: each typed seat is cleared with its own PUT, then the day is re-read', async () => {
  const rt = runtime({ answers: { [NAMES]: () => ({ ok: true }) } });
  rt.w.renderPierPark(); await rt.flush();
  rt.w.pkNmClearBoat(DATE, 'b1', 'tublamu');
  await rt.flush(); await rt.flush(); await rt.flush();
  assert.deepEqual(names(rt).map((c) => c.body), [{ booking_id: 'bk1', cat: 'adTH', seq: 2, name: null }]);
  assert.equal(rt.calls.filter((c) => c.method === 'GET').length, 2);
});

test('drop over: the orphan names are cleared by the server, one PUT each', async () => {
  const rt = runtime({ answers: { [NAMES]: () => ({ ok: true }) } });
  rt.w.renderPierPark(); await rt.flush();
  rt.w.pkNmDropOver(DATE, 'b1', 'tublamu');
  await rt.flush(); await rt.flush(); await rt.flush();
  assert.deepEqual(names(rt).map((c) => c.body), [{ booking_id: 'bk1', cat: 'adFR', seq: 3, name: null }]);
});

test('drop over and clear boat: a confirm that is cancelled sends nothing', async () => {
  const rt = runtime({ confirmAnswer: false });
  rt.w.renderPierPark(); await rt.flush();
  rt.w.pkNmClearBoat(DATE, 'b1', 'tublamu');
  rt.w.pkNmDropOver(DATE, 'b1', 'tublamu');
  await rt.flush();
  assert.deepEqual(rt.calls.map((c) => c.method), ['GET']);
});

test('lead-based fills are not on operation-backend: a notice, no write, no legacy persist', async () => {
  const rt = runtime();
  rt.w.renderPierPark(); await rt.flush();
  rt.w.pkNmFillLead(DATE, 'b1', 'tublamu');
  rt.w.pkNmDropLeadDup(DATE, 'b1', 'tublamu');
  await rt.flush();
  assert.equal(rt.calls.filter((c) => c.method !== 'GET').length, 0);
  assert.equal(rt.toasts.length, 2);
  assert.equal(rt.legacy.includes('pkNmFillLead'), false);
  assert.equal(rt.persists.length, 0);
});

test('types: the catalogue is read from the server and shown in the legacy shape', async () => {
  const rt = runtime();
  rt.w.pkTyModal();
  await rt.flush(); await rt.flush();
  assert.deepEqual(rt.calls.map((c) => c.method + ' ' + c.path), [TYPES_GET, GET_KEY]);
  assert.equal(rt.legacy.filter((x) => x === 'pkTyModal').length, 1, 'legacy modal opened once, then refreshed');
  const T = J(rt.w.pkTypes());
  assert.equal(T.length, 6);
  assert.deepEqual(T[0], { k: 'adTH', n: 'ผู้ใหญ่ชาวไทย', s: 'ผญ ไทย', grp: 'ad', code: 'YTRGRVMY', c: '#0F6E56', ch: ['ad_th', 'foc_th'], base: true });
  assert.deepEqual(T[5], { k: 'p1', n: 'Custom', s: 'Custom', grp: 'ad', code: 'X1', c: '#B4560A', ch: [], base: false });
});

test('types: a rename is PATCHed and shown only after the server answers', async () => {
  let release;
  const pending = new Promise((r) => { release = r; });
  const rt = runtime({ answers: { 'PATCH /v1/pier-office/park-types/p1': () => pending } });
  rt.w.pkTyModal(); await rt.flush(); await rt.flush();
  rt.w.pkTypeSet('p1', 'n', 'Renamed');
  await rt.flush();
  assert.equal(J(rt.w.pkTypes())[5].n, 'Custom', 'still the old name while in flight');
  release({ type: { key: 'p1', name: 'Renamed', short: 'Renamed', group: 'ad', code: 'X1', base: false } });
  await rt.flush(); await rt.flush();
  assert.deepEqual(rt.calls.filter((c) => c.method === 'PATCH').map((c) => [c.path, c.body]), [
    ['/v1/pier-office/park-types/p1', { name: 'Renamed' }],
  ]);
  assert.equal(J(rt.w.pkTypes())[5].n, 'Renamed');
});

test('types: a base type recode with an empty code sends null (clears the override)', async () => {
  const rt = runtime({ answers: { 'PATCH /v1/pier-office/park-types/adTH': () => ({ type: { key: 'adTH', name: 'ผู้ใหญ่ชาวไทย', short: 'ผญ ไทย', group: 'ad', code: 'YTRGRVMY', base: true } }) } });
  rt.w.pkTypeSet('adTH', 'code', '  ');
  await rt.flush(); await rt.flush();
  assert.deepEqual(rt.calls.filter((c) => c.method === 'PATCH').map((c) => [c.method, c.path, c.body]), [['PATCH', '/v1/pier-office/park-types/adTH', { code: null }]]);
});

test('types: a group change sends group', async () => {
  let rt;
  rt = runtime({ answers: { 'PATCH /v1/pier-office/park-types/p1': () => { rt.state.types[5].group = 'chd'; rt.state.day.types = J(rt.state.types); return { type: rt.state.types[5] }; } } });
  rt.w.pkTypeSet('p1', 'grp', 'chd');
  await rt.flush(); await rt.flush();
  assert.deepEqual(rt.calls.filter((c) => c.method === 'PATCH').map((c) => [c.method, c.body]), [['PATCH', { group: 'chd' }]]);
  assert.equal(J(rt.w.pkTypes())[5].grp, 'chd');
});

test('types: add posts name and group, and the returned key is used', async () => {
  let rt;
  rt = runtime({ answers: { 'POST /v1/pier-office/park-types': () => { const t = { key: 'p9', name: 'ประเภทใหม่', short: 'ประเภทใหม่', group: 'ad', code: '', base: false }; rt.state.types.push(t); rt.state.day.types = J(rt.state.types); return { type: t }; } } });
  rt.w.pkTypeAdd();
  await rt.flush(); await rt.flush();
  assert.deepEqual(rt.calls.filter((c) => c.method === 'POST').map((c) => [c.method, c.path, c.body]), [['POST', '/v1/pier-office/park-types', { name: 'ประเภทใหม่', group: 'ad' }]]);
  assert.equal(J(rt.w.pkTypes()).some((t) => t.k === 'p9'), true);
});

test('types: a delete the server refuses with 409 code_in_use shows it and removes nothing', async () => {
  const refusal = Object.assign(new Error('The ticket type is in use by 1 fixed person(s)'), { code: 'code_in_use', status: 409 });
  const rt = runtime({ answers: { 'DELETE /v1/pier-office/park-types/p1': refusal } });
  rt.w.pkTyModal(); await rt.flush(); await rt.flush();
  rt.w.pkTypeDel('p1');
  await rt.flush(); await rt.flush();
  assert.equal(rt.fails.length, 1);
  assert.equal(rt.fails[0].title, 'Type not deleted · code_in_use');
  assert.equal(J(rt.w.pkTypes()).some((t) => t.k === 'p1'), true);
});

test('types: a delete that the server accepts (204) removes the type', async () => {
  const rt = runtime({ answers: { 'DELETE /v1/pier-office/park-types/p1': () => null } });
  rt.w.pkTyModal(); await rt.flush(); await rt.flush();
  rt.w.pkTypeDel('p1');
  await rt.flush(); await rt.flush();
  assert.equal(rt.fails.length, 0);
  assert.equal(J(rt.w.pkTypes()).some((t) => t.k === 'p1'), false);
});

test('O.park.load is exposed for the boot step and reads the given day', async () => {
  const rt = runtime();
  assert.equal(typeof rt.w.laOps.park.load, 'function');
  await rt.w.laOps.park.load('tublamu', DATE);
  assert.deepEqual(rt.calls, [{ method: 'GET', path: GET_PATH }]);
  assert.equal(J(rt.w.pkTkData(DATE, 'tublamu'))[0].boats.length, 1);
});
