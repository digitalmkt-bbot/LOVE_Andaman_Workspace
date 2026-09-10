// b2c-catalog.js — the endpoint B2C calls to create an ops programme and get its route id back.
//
// Four classes of failure are worth a test here, and three of them have already happened for real
// in this system:
//   1. A route with a family the calendar does not know is INVISIBLE on the Booking screen, with no
//      error anywhere. Ranong hit it, then the first land programme hit it again. So: the family
//      list here must equal the one the client renders from, and an unknown family must be refused.
//   2. A column that field_mapping.json maps but operation_schemas_model.json does not list is never
//      INSERTed — the value is dropped at write time and the user sees their edit vanish on refresh.
//      That is exactly what happened to routes.familyid and routes.dailycap when they shipped
//      (2026-09-10, migrations 025/026): mapped, migrated, never written. server.js checks this
//      drift in the model→mapping direction only, so the mapping→model direction is checked here.
//   3. An RN (Ranong) seat price has no column to land in, so pricing a Ranong route silently
//      stores nothing.
//   4. The endpoint must be unreachable without the API key, before it touches the database.
//
// Run: node --test test/unit/b2c-catalog.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const require_ = createRequire(import.meta.url);
const cat = require_(path.join(ROOT, 'b2c-catalog.js'));
const osRepo = require_(path.join(ROOT, 'os-backend/src/mapping/os_repo.js'));
const osModel = require_(path.join(ROOT, 'os-backend/src/mapping/operation_schemas_model.json'));

const base = (over = {}) => Object.assign({
  externalId: 'POW-008', name: 'Phi Phi Bamboo by Big Boat', pier: 'panwa', familyId: 'phiphi',
}, over);

// ── payload validation ──────────────────────────────────────────────────────────────────────────
test('accepts a full variant payload and normalises it into a routes[] record', () => {
  const r = cat.normalizeRoutePayload(base({
    islands: 'เกาะพีพี, ไม้ไผ่', times: ['07:30', '09:00'], code: 'PPBB', color: '#c0392b',
    seasons: [{ type: 'open', from: '2026-01-01', to: '2026-12-31' }],
  }));
  assert.equal(r.error, undefined);
  assert.deepEqual(r.record.times, ['07:30', '09:00']);
  assert.equal(r.record.familyId, 'phiphi');
  assert.equal(r.record.extId, 'POW-008');
  assert.equal(r.record.dailyCap, null);          // marine route · capacity comes from the boats
  assert.equal(r.pricing, null);
  // Not attaching pricing is allowed, but the caller has to be told what it costs them.
  assert.ok(r.warnings.some(w => /Booking calendar/.test(w)));
});

test('externalId and name are required', () => {
  assert.match(cat.normalizeRoutePayload(base({ externalId: '' })).error, /externalId is required/);
  assert.match(cat.normalizeRoutePayload(base({ name: '  ' })).error, /name is required/);
  assert.match(cat.normalizeRoutePayload(base({ externalId: 'has space' })).error, /externalId must be/);
});

test('pier must be one of the four enum values — a UI label is not one', () => {
  assert.match(cat.normalizeRoutePayload(base({ pier: 'Visit Panwa' })).error, /unknown pier/);
  assert.match(cat.normalizeRoutePayload(base({ pier: 'visitpanwa' })).error, /unknown pier/);
  for (const p of cat.PIERS) {
    const r = cat.normalizeRoutePayload(base({ pier: p, familyId: 'similan' }));
    assert.equal(r.error, undefined, p);
  }
});

test('an unknown family is refused rather than stored — it would vanish from the calendar', () => {
  const r = cat.normalizeRoutePayload(base({ familyId: 'sunsetcruise' }));
  assert.match(r.error, /unknown familyId/);
  assert.match(r.error, /transfer/);              // the message must list what IS valid
});

test('a land programme defaults by name, a boat one falls back to the name guess', () => {
  // §routeKind · kind is the axis now; pier 'other' still accepted as the retired marker
  assert.equal(cat.normalizeRoutePayload(base({ kind: 'land', familyId: '' })).record.familyId, 'transfer');
  assert.equal(cat.normalizeRoutePayload(base({ kind: 'land', familyId: '', name: 'Phuket City Tour' })).record.familyId, 'citytour');
  assert.equal(cat.normalizeRoutePayload(base({ pier: 'other', familyId: '' })).record.kind, 'land');
  assert.equal(cat.normalizeRoutePayload(base({ pier: 'other', familyId: '' })).record.pier, '');
  assert.equal(cat.normalizeRoutePayload(base({ familyId: '', name: 'Similan Islands by Speedboat' })).record.familyId, 'similan');
  // Order matters: this name contains both 'Whale' and 'Phi Phi'.
  assert.equal(cat.guessFamily('Whale Shark Phi Phi Maiton Sunset'), 'whaleshark');
});

test('a name that infers no family is refused, not defaulted to none', () => {
  const r = cat.normalizeRoutePayload(base({ familyId: '', name: 'Sunset Cruise' }));
  assert.match(r.error, /familyId is required/);
  assert.match(r.error, /invisible on the Booking calendar/);
});

test('times and seasons are validated', () => {
  assert.match(cat.normalizeRoutePayload(base({ times: ['8:00'] })).error, /not a 24h HH:MM/);
  assert.match(cat.normalizeRoutePayload(base({ times: ['25:00'] })).error, /not a 24h HH:MM/);
  assert.deepEqual(cat.normalizeRoutePayload(base({ times: [] })).record.times, ['08:00']);
  assert.match(cat.normalizeRoutePayload(base({ seasons: [{ type: 'open', from: '2026-13-01', to: '2026-12-31' }] })).error, /YYYY-MM-DD/);
  assert.match(cat.normalizeRoutePayload(base({ seasons: [{ type: 'open', from: '2026-12-31', to: '2026-01-01' }] })).error, /on or after/);
  assert.match(cat.normalizeRoutePayload(base({ seasons: [{ type: 'shoulder', from: '2026-01-01', to: '2026-02-01' }] })).error, /"open" or "closed"/);
});

test('dailyCap is stored for a land route and ignored (with a warning) for a boat one', () => {
  const land = cat.normalizeRoutePayload(base({ kind: 'land', familyId: 'transfer', dailyCap: 50 }));
  assert.equal(land.record.dailyCap, 50);
  const sea = cat.normalizeRoutePayload(base({ dailyCap: 50 }));
  assert.equal(sea.record.dailyCap, null);
  assert.ok(sea.warnings.some(w => /dailyCap ignored/.test(w)));
  // A land route with no quota sells without a ceiling — say so.
  const free = cat.normalizeRoutePayload(base({ kind: 'land', familyId: 'transfer' }));
  assert.ok(free.warnings.some(w => /no seat ceiling/.test(w)));
});

// ── pricing ─────────────────────────────────────────────────────────────────────────────────────
test('pricing fills every pax type so a blank never reads as free', () => {
  const r = cat.normalizeRoutePayload(base({
    pricing: { rateTypeId: 'rt003', zones: { PK: { 'adult-fr': 2500, 'child-fr': 2000 } } },
  }));
  assert.equal(r.error, undefined);
  assert.deepEqual(r.pricing.zones.PK, {
    'adult-fr': 2500, 'child-fr': 2000, 'adult-thai': 0, 'child-thai': 0, 'infant-thai': 0, 'infant-fr': 0,
  });
});

test('pricing rejects what the schema cannot store or the app cannot read', () => {
  const p = (zones, over = {}) => cat.normalizeRoutePayload(base(Object.assign({ pricing: { rateTypeId: 'rt003', zones } }, over)));
  // RN has no columns in sb_rate_types__seatrates — storing it would drop the price in silence.
  assert.match(p({ RN: { 'adult-fr': 1 } }, { pier: 'ranong', familyId: 'selava' }).error, /rn_\* columns/);
  // KL does not apply to a Ranong route at all.
  assert.match(p({ KL: { 'adult-fr': 1 } }, { pier: 'ranong', familyId: 'selava' }).error, /does not apply to a ranong route/);
  assert.match(p({ PK: { adult: 1 } }).error, /unknown pax type/);
  assert.match(p({ PK: { 'adult-fr': -5 } }).error, />= 0/);
  assert.match(p({}).error, /zones is empty/);
  assert.match(cat.normalizeRoutePayload(base({ pricing: { zones: { PK: {} } } })).error, /rateTypeId is required/);
});

test('all-zero pricing is allowed but reported', () => {
  const r = cat.normalizeRoutePayload(base({ pricing: { rateTypeId: 'rt003', zones: { PK: { 'adult-fr': 0 } } } }));
  assert.equal(r.error, undefined);
  assert.ok(r.warnings.some(w => /bills nothing/.test(w)));
});

// ── ids ─────────────────────────────────────────────────────────────────────────────────────────
test('route ids keep the shape Config produces and never collide', () => {
  assert.equal(cat.nextRouteId(new Set(), 1789030036795), 'r1789030036795');
  assert.equal(cat.nextRouteId(new Set(['r100', 'r101']), 100), 'r102');
});

test('seasons get stable ids derived from the route', () => {
  const rec = cat.withSeasonIds({ seasons: [{ type: 'open', from: '2026-01-01', to: '2026-12-31' }] }, 'r9');
  assert.equal(rec.id, 'r9');
  assert.equal(rec.seasons[0].id, 'ss_r9_1');
});

// ── the two silent-data-loss guards ─────────────────────────────────────────────────────────────
test('FAMILIES matches _BKV2_FAMILIES in the client', () => {
  const src = fs.readFileSync(path.join(ROOT, 'allotment_v2/js/08-app.js'), 'utf8');
  const block = src.slice(src.indexOf('const _BKV2_FAMILIES = ['));
  const list = block.slice(0, block.indexOf('];'));
  const ids = [...list.matchAll(/id\s*:\s*'([^']+)'/g)].map(m => m[1]);
  assert.ok(ids.length >= 8, 'could not parse _BKV2_FAMILIES out of js/08-app.js');
  assert.deepEqual(cat.FAMILIES.map(f => f.id), ids,
    'b2c-catalog.js FAMILIES has drifted from js/08-app.js _BKV2_FAMILIES — a family in one list and not the other means B2C can create a route the Booking calendar will not draw');
});

test('every column field_mapping.json writes exists in operation_schemas_model.json', () => {
  // The direction server.js does NOT check. _restInsertRows builds its INSERT column list from the
  // model alone, so a mapped-but-unmodelled column is silently discarded on every write — how
  // routes.familyid and routes.dailycap shipped dead on 2026-09-10.
  const plan = osRepo._plan || {};
  const missing = [];
  for (const [table, p] of Object.entries(plan)) {
    const model = osModel[table];
    if (!model) continue;                                   // model→mapping drift · server.js reports that one
    const have = new Set(model.columns.map(c => c.name));
    const want = new Set();
    for (const k of ['pkCol', 'fkCol', 'idxCol', 'rowPkCol', 'keyCol', 'valueCol']) if (p[k]) want.add(p[k]);
    for (const dc of (p.dataCols || [])) want.add(dc.col);
    for (const c of want) if (!have.has(c)) missing.push(table + '.' + c);
  }
  assert.deepEqual(missing, [],
    'these columns are mapped but not in the model, so they are never INSERTed and the value disappears on refresh');
});

test('a route record survives the blob round trip with its new fields intact', () => {
  const rec = cat.withSeasonIds(cat.normalizeRoutePayload(base({
    kind: 'land', familyId: 'transfer', dailyCap: 50, times: ['09:00'],
    seasons: [{ type: 'open', from: '2026-01-01', to: '2026-12-31' }],
  })).record, 'rTEST');
  const rows = osRepo.decomposeBlob({ routes: [rec] });
  const cols = new Set(osModel.routes.columns.map(c => c.name));
  const dropped = Object.keys(rows.routes[0]).filter(k => !cols.has(k));
  assert.deepEqual(dropped, [], 'decomposed columns that the INSERT would not carry');
  const back = osRepo.assembleBlob(rows).routes[0];
  assert.equal(back.extId, 'POW-008');
  assert.equal(back.familyId, 'transfer');
  assert.equal(back.kind, 'land');           // §routeKind · must survive the round trip too
  assert.equal(back.dailyCap, 50);
  assert.deepEqual(back.times, ['09:00']);
  assert.equal(back.seasons[0].type, 'open');
});

// ── handler behaviour · fake database ───────────────────────────────────────────────────────────
// The write itself is one restTxn call, so the thing worth pinning down is the ops array it builds:
// a wrong resource name, a whole-record put where a patch belongs, or a seatRates key that is not
// the route id all corrupt a rate type that real agents bill from.
function fakeCtx({ routes = [], rateTypes = [], rtRoutes = [], txn } = {}) {
  const calls = { txn: null };
  const q = async (sql, params) => {
    if (/FROM\s+"?routes"?\s/.test(sql) && /extid/.test(sql) && params) return { rows: routes.filter(r => r.extid === params[0]) };
    if (/FROM\s+"?routes"?/.test(sql)) return { rows: routes };
    if (/FROM\s+"?sb_rate_types"?\s+WHERE/.test(sql)) return { rows: rateTypes.filter(r => r.id === params[0]) };
    if (/sb_rate_types__routes/.test(sql)) return { rows: rtRoutes.map(v => ({ v })) };
    if (/FROM\s+"?sb_rate_types"?/.test(sql)) return { rows: rateTypes };
    return { rows: [] };
  };
  let resolve;
  const done = new Promise(r => { resolve = r; });
  const ctx = {
    pool: { query: q }, dataBackend: 'relational',
    fqt: t => '"' + t + '"', qic: c => '"' + c + '"',
    J: (res, code, obj) => resolve({ code, body: obj }),
    readBody: (req, cb) => cb(req._body),
    restTxn: async (user, base, ops) => { calls.txn = { user, ops }; return (txn ? txn(ops) : { version: 42 }); },
    sseBroadcast: () => {},
  };
  return { ctx, done, calls };
}
const post = (body) => ({ headers: { 'x-api-key': 'k' }, method: 'POST', _body: JSON.stringify(body) });

test('create builds one put for the route and one narrow patch for the rate type', async () => {
  process.env.B2C_API_KEY = 'k';
  const { ctx, done, calls } = fakeCtx({
    routes: [{ id: 'r10', extid: null, name: 'Phi Phi Bamboo by Speedboat' }],
    rateTypes: [{ id: 'rt003', code: 'RT-COUNTER', active: true }],
    rtRoutes: ['r5', 'r6'],
  });
  cat.handle(post(base({ pricing: { rateTypeId: 'rt003', zones: { PK: { 'adult-fr': 2500 } } } })), {}, '/api/b2c/routes', '', ctx);
  const { code, body } = await done;
  assert.equal(code, 201);
  assert.equal(body.created, true);
  assert.match(body.routeId, /^r\d+$/);

  const [putOp, patchOp] = calls.txn.ops;
  assert.equal(putOp.op, 'put');
  assert.equal(putOp.r, 'routes');
  assert.equal(putOp.body.extId, 'POW-008');
  assert.equal(putOp.body.familyId, 'phiphi');
  assert.equal(patchOp.op, 'patch');
  assert.equal(patchOp.r, 'sb_rate_types');
  assert.equal(patchOp.id, 'rt003');
  // routes[] keeps what was already there; seatRates is merged under the new route id only, so
  // another route's prices in the same rate type cannot be clobbered.
  assert.deepEqual(patchOp.body.m.p.routes.v, ['r5', 'r6', body.routeId]);
  assert.deepEqual(Object.keys(patchOp.body.m.p.seatRates.m.p), [body.routeId]);
  assert.equal(patchOp.body.m.p.seatRates.m.p[body.routeId].v.PK['adult-fr'], 2500);
});

test('a repeat call for the same externalId returns the same route and writes nothing', async () => {
  process.env.B2C_API_KEY = 'k';
  const { ctx, done, calls } = fakeCtx({ routes: [{ id: 'r1789030036795', extid: 'POW-008', name: 'City tour' }] });
  cat.handle(post(base()), {}, '/api/b2c/routes', '', ctx);
  const { code, body } = await done;
  assert.equal(code, 200);                 // 200, not 201 — nothing was created
  assert.equal(body.created, false);
  assert.equal(body.routeId, 'r1789030036795');
  assert.equal(calls.txn, null);
});

test('an unknown rateTypeId is refused before anything is written', async () => {
  process.env.B2C_API_KEY = 'k';
  const { ctx, done, calls } = fakeCtx({ rateTypes: [] });
  cat.handle(post(base({ pricing: { rateTypeId: 'rt999', zones: { PK: { 'adult-fr': 1 } } } })), {}, '/api/b2c/routes', '', ctx);
  const { code, body } = await done;
  assert.equal(code, 400);
  assert.match(body.error, /unknown rateTypeId/);
  assert.equal(calls.txn, null);
});

test('losing the unique-index race reads back the winner instead of failing', async () => {
  process.env.B2C_API_KEY = 'k';
  const routes = [];
  const { ctx, done } = fakeCtx({
    routes,
    txn: () => { routes.push({ id: 'rWINNER', extid: 'POW-008', name: 'x' }); const e = new Error('duplicate key'); e.code = '23505'; throw e; },
  });
  cat.handle(post(base()), {}, '/api/b2c/routes', '', ctx);
  const { code, body } = await done;
  assert.equal(code, 200);
  assert.equal(body.routeId, 'rWINNER');
  assert.equal(body.created, false);
});

test('an inactive rate type is accepted but the caller is told the calendar still will not show it', async () => {
  process.env.B2C_API_KEY = 'k';
  const { ctx, done } = fakeCtx({ rateTypes: [{ id: 'rt002', code: 'RT-OTA-INT', active: false }] });
  cat.handle(post(base({ pricing: { rateTypeId: 'rt002', zones: { PK: { 'adult-fr': 1 } } } })), {}, '/api/b2c/routes', '', ctx);
  const { code, body } = await done;
  assert.equal(code, 201);
  assert.ok(body.warnings.some(w => /inactive/.test(w)));
});

// ── wiring · no database needed ─────────────────────────────────────────────────────────────────
// Boots the real server.js with no DATABASE_URL. The key check has to come first: a wrong key must
// look identical whether or not there is a database behind it.
test('the endpoint is behind X-Api-Key and answers before touching the database', async (t) => {
  const PORT = 8847;
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), B2C_API_KEY: 'test-key-123', DATABASE_URL: '', DATA_BACKEND: 'relational' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const logs = [];
  child.stdout.on('data', d => logs.push(String(d)));
  child.stderr.on('data', d => logs.push(String(d)));
  t.after(() => child.kill());

  const url = `http://127.0.0.1:${PORT}`;
  const deadline = Date.now() + 15000;
  let up = false;
  while (Date.now() < deadline && !up) {
    if (child.exitCode !== null) throw new Error('server.js exited early\n' + logs.join(''));
    try { await fetch(url + '/api/version'); up = true; } catch { await new Promise(r => setTimeout(r, 150)); }
  }
  assert.ok(up, 'server did not start\n' + logs.join(''));

  const noKey = await fetch(url + '/api/b2c/routes');
  assert.equal(noKey.status, 401);
  const badKey = await fetch(url + '/api/b2c/routes', { headers: { 'X-Api-Key': 'nope' } });
  assert.equal(badKey.status, 401);
  // Right key, no database → 503, which proves the route is wired and reached its handler.
  const okKey = await fetch(url + '/api/b2c/routes', { headers: { 'X-Api-Key': 'test-key-123' } });
  assert.equal(okKey.status, 503);
  const post = await fetch(url + '/api/b2c/routes', {
    method: 'POST', headers: { 'X-Api-Key': 'test-key-123', 'Content-Type': 'application/json' },
    body: JSON.stringify(base()),
  });
  assert.equal(post.status, 503);
  const rt = await fetch(url + '/api/b2c/rate-types', { headers: { 'X-Api-Key': 'test-key-123' } });
  assert.equal(rt.status, 503);
});
