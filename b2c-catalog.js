'use strict';
/**
 * B2C catalog API — create an ops programme (route) from the B2C side and hand back its ops id.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────────────────────────
 * Everything operational in this system keys off a ROUTE id (r5, r10, …): seat availability, boat
 * deployment, van job orders, pier run sheets, the Booking calendar. B2C already stores that id —
 * `programs_own.ops_route_id` — and server.js reads it back through b2cProgramRouteCatalog() to
 * resolve every imported day-trip line to an ops route. Until now the id on the ops side had to be
 * created BY HAND in Config, then copied into B2C. A B2C product that nobody copied over imports
 * with routeId null and renders a bare "—" where the route name goes (that is exactly how POW-006
 * and POW-007 landed, see the §Program → ops route note in server.js).
 *
 * This endpoint closes that loop: B2C creates the product, calls here, gets `routeId` back, stores
 * it in ops_route_id, and the very first order imports with its route already attached.
 *
 * ── Variants ────────────────────────────────────────────────────────────────────────────────────
 * A B2C product with variants ("by speedboat" / "by big boat" / "early bird") maps to ONE OPS ROUTE
 * PER VARIANT — that is what a route already is in this system. r7/r8/r9/r10 are four variants of
 * the same Phi Phi Bamboo trip, and each carries its own boat, its own departure time and its own
 * seat prices. They are held together by `familyId`, which is the group the Booking calendar draws
 * as one card. So: one POST per variant, same `familyId`, different `externalId`.
 *
 * A family is NOT free text. The list lives in the client (js/08-app.js · _BKV2_FAMILIES) and is
 * mirrored below; a route whose familyId is not in it never appears on the Booking calendar at all,
 * silently. That failure has now happened twice (Ranong, then the first land programme), so this
 * endpoint REFUSES an unknown family instead of storing it — and refuses a route with no family at
 * all, for the same reason. Adding a genuinely new family is a code change in both places.
 *
 * ── Pricing ─────────────────────────────────────────────────────────────────────────────────────
 * Optional, and deliberately so. A B2C order carries its OWN money into ops: relSyncB2C writes the
 * line's subtotal straight into the booking's priceBreakdown and ops never reprices it. So a route
 * that is only ever sold on the webshop needs no ops price to bill correctly.
 *
 * What an ops price buys you is two things, both real:
 *   1. Visibility. bkV2Routes() (js/08-app.js) builds the Booking calendar from routes referenced
 *      by an ACTIVE RATE TYPE or by an existing booking — nothing else. A brand-new route in no
 *      rate type is invisible on that screen until its first order arrives. Boat Operation is
 *      unaffected (it reads ROUTES directly), so boats can still be assigned.
 *   2. Counter sales. If staff also sell the product from the ops Booking screen, the seat price
 *      comes from the agent's rate type — with no entry for this route, that booking bills 0.
 *
 * Pass `pricing` when you want either. It writes seatRates[routeId] on ONE named rate type; per
 * variant, because seatRates is keyed by route id, so two variants of a product hold two prices.
 *
 * ── Env ─────────────────────────────────────────────────────────────────────────────────────────
 *   B2C_API_KEY   shared secret, sent as X-Api-Key. Same key /api/b2c/availability uses.
 *                 Unset = every route here answers 401, i.e. the module is off.
 */

// ── Piers and kind ──────────────────────────────────────────────────────────────────────────────
// Exact enum. UI labels ("Tub Lamu", "Visit Panwa") are NOT values — writing one breaks the pill
// grouping on Boat Op / Boat Status / Pier Office.
//
// §routeKind · what makes a programme "land" is route.kind, not its pier. A land programme may
// legitimately have a pier — TR-004 Private Transfer to Pier runs Phuket → Visit Panwa — so the
// two are independent. pier 'other' is the OLD marker and is still accepted on input: it maps to
// kind 'land' with no pier, which is what migration 028 did to the rows already on prod.
const PIERS = ['tublamu', 'panwa', 'ranong'];
const LEGACY_LAND_PIER = 'other';
const KIND_LAND = 'land', KIND_MARINE = 'marine';
const KINDS = [KIND_MARINE, KIND_LAND];

// ── Programme families ──────────────────────────────────────────────────────────────────────────
// Mirror of _BKV2_FAMILIES (allotment_v2/js/08-app.js). Kept as a copy rather than imported because
// that file is 47k lines of browser globals with no module boundary. If you add a family there, add
// it here — the test asserts the two lists agree, so a drift fails CI rather than silently dropping
// a B2C product off the calendar.
const FAMILIES = [
  { id: 'similan',    name: 'Similan Islands' },
  { id: 'surin',      name: 'Surin Islands' },
  { id: 'phiphi',     name: 'Phi Phi Bamboo' },
  { id: 'krabi',      name: 'Krabi + Phang Nga' },
  { id: 'whaleshark', name: 'Whale Shark Phi Phi Maiton' },
  { id: 'selava',     name: 'Day Trip - Se La Va' },
  { id: 'nyaung',     name: 'Day Trip - Nyaung Oo Phee Island' },
  { id: 'transfer',   name: 'Transfer' },
  { id: 'citytour',   name: 'City Tour' },
];
const FAMILY_IDS = new Set(FAMILIES.map(f => f.id));

// Same keyword ladder as bkV2RouteFamilyGuess, same ORDER — "Whale Shark Phi Phi Maiton" contains
// both 'Whale' and 'Phi Phi', and the first match wins. Only a convenience: familyId in the request
// always beats it, and when neither answers the request is refused rather than guessed at.
function guessFamily(name) {
  const n = String(name || '');
  if (n.includes('Nyaung') || n.includes('Oo Phee')) return 'nyaung';
  if (n.includes('Se La Va') || n.includes('SeLaVa')) return 'selava';
  if (n.includes('Whale')) return 'whaleshark';
  if (n.includes('Similan')) return 'similan';
  if (n.includes('Surin')) return 'surin';
  if (n.includes('Phi Phi')) return 'phiphi';
  if (n.includes('Krabi') || n.includes('Phang Nga')) return 'krabi';
  return null;
}

// ── Seat-rate shape ─────────────────────────────────────────────────────────────────────────────
// seatRates[routeId][zone][paxType]. Zones depend on the pier (rtZonesForRoute, js/08-app.js:138).
const PAX_TYPES = ['adult-thai', 'adult-fr', 'child-thai', 'child-fr', 'infant-thai', 'infant-fr'];
function zonesForPier(pier) { return pier === 'ranong' ? ['RN', 'NoTransfer'] : ['PK', 'KL', 'NoTransfer']; }
// A land programme is priced by the pickup zone the guest is collected from, never by a pier.
function zonesFor(kind, pier) { return kind === KIND_LAND ? ['PK', 'KL', 'NoTransfer'] : zonesForPier(pier); }
// operation_schemas.sb_rate_types__seatrates is a WIDE table: one column per zone×paxType
// (pk_adult_fr, kl_child_thai, notransfer_…). There are no rn_* columns, so an RN price has
// physically nowhere to land — decompose writes it into a column that does not exist and the value
// is dropped without a word. Verified on prod 2026-09-10: both Ranong routes sit in rt003 with
// NoTransfer only. Refusing RN here is not a limitation of this endpoint, it is the honest report
// of a gap in the schema; price a Ranong route under NoTransfer, or add the columns first.
const PERSISTABLE_ZONES = new Set(['PK', 'KL', 'NoTransfer']);

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EXTID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

const str = v => (v == null ? '' : String(v)).trim();
// The shape check alone lets '2026-13-01' and '2026-02-31' through, and every date comparison in
// this system — getDayStatus, the availability endpoint, the season lookup — is a STRING compare.
// An impossible month sorts perfectly well against real ones and silently never matches a day.
function validDate(s) {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/**
 * Validate + normalise one create request into the record shape the ops blob uses.
 * Pure: no database, no clock beyond ids the caller supplies. Returns
 *   { error }                      → 400, `error` is the message
 *   { record, pricing, warnings }  → record is a routes[] entry minus its id
 */
function normalizeRoutePayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'body must be a JSON object' };
  const warnings = [];

  const externalId = str(body.externalId);
  if (!externalId) return { error: 'externalId is required — the B2C program or variant id (e.g. "POW-008"), used to make repeat calls idempotent' };
  if (!EXTID_RE.test(externalId)) return { error: 'externalId must be 1-64 chars of A-Z a-z 0-9 . _ : - and start alphanumeric' };

  const name = str(body.name);
  if (!name) return { error: 'name is required' };
  if (name.length > 120) return { error: 'name must be 120 characters or fewer' };

  // §routeKind · kind decides marine/land. pier 'other' is the retired marker and still maps to
  // land, so a caller written against the old shape keeps working.
  let pier = str(body.pier);
  let kind = str(body.kind);
  if (pier === LEGACY_LAND_PIER) { kind = kind || KIND_LAND; pier = ''; }
  if (!kind) kind = pier ? KIND_MARINE : '';
  if (!kind) return { error: 'kind is required — ' + KINDS.join(' or ') + " ('land' = a programme that uses no boat, e.g. a city tour or a transfer)" };
  if (!KINDS.includes(kind)) return { error: 'unknown kind "' + kind + '" — must be ' + KINDS.join(' or ') };
  if (kind === KIND_MARINE && !pier) return { error: 'pier is required for a marine programme — one of ' + PIERS.join(', ') };
  if (pier && !PIERS.includes(pier)) return { error: 'unknown pier "' + pier + '" — must be one of ' + PIERS.join(', ') };

  // Family. Explicit wins; then the land default; then the name guess. No family = the route exists
  // but never renders on the Booking calendar, so an unresolved one is an error, not a default.
  let familyId = str(body.familyId);
  // A land programme with no family stated is a transfer far more often than a tour, and City Tour
  // is named plainly enough for the guess below to catch it. Guessing wrong here is cheap: the
  // route still appears, just under the other land group.
  if (!familyId && kind === KIND_LAND) familyId = /city\s*tour/i.test(name) ? 'citytour' : 'transfer';
  if (!familyId) familyId = guessFamily(name) || '';
  if (!familyId) {
    return { error: 'familyId is required — could not infer it from the name. Valid ids: ' + FAMILIES.map(f => f.id).join(', ') +
                    '. A route with no family is invisible on the Booking calendar.' };
  }
  if (!FAMILY_IDS.has(familyId)) {
    return { error: 'unknown familyId "' + familyId + '" — valid ids: ' + FAMILIES.map(f => f.id).join(', ') +
                    '. Adding a new family is a code change on both sides (b2c-catalog.js FAMILIES + js/08-app.js _BKV2_FAMILIES).' };
  }

  // Departure times. Default matches the Config modal's own default rather than leaving it empty —
  // an empty times[] renders a programme with no departure anywhere it is listed.
  let times = body.times === undefined ? ['08:00'] : body.times;
  if (!Array.isArray(times)) return { error: 'times must be an array of "HH:MM" strings' };
  times = times.map(str).filter(Boolean);
  if (!times.length) times = ['08:00'];
  const badTime = times.find(t => !TIME_RE.test(t));
  if (badTime) return { error: 'times: "' + badTime + '" is not a 24h HH:MM time' };

  // Seasons. Absent = the route runs every day: getDayStatus returns null with no seasons and
  // bkV2IsRouteOpenOn treats that as open. A route with ONLY closed seasons still reads as open
  // outside them, so a seasonal product needs its open windows listed, not its closed ones.
  const seasonsIn = body.seasons === undefined ? [] : body.seasons;
  if (!Array.isArray(seasonsIn)) return { error: 'seasons must be an array of {type,from,to}' };
  const seasons = [];
  for (let i = 0; i < seasonsIn.length; i++) {
    const s = seasonsIn[i] || {};
    const type = str(s.type) || 'open';
    if (type !== 'open' && type !== 'closed') return { error: 'seasons[' + i + '].type must be "open" or "closed"' };
    const from = str(s.from), to = str(s.to);
    if (!validDate(from) || !validDate(to)) return { error: 'seasons[' + i + ']: from/to must be a real calendar date in YYYY-MM-DD' };
    if (to < from) return { error: 'seasons[' + i + ']: to must be on or after from' };
    seasons.push({ type, from, to });
  }
  if (seasons.length && !seasons.some(s => s.type === 'open')) {
    warnings.push('seasons list has no "open" window — dates outside every declared season read as CLOSED only when at least one open season exists, so this route still sells on every date not explicitly closed');
  }

  // Daily quota. Land programmes only, exactly as saveRoute() stores it: a boat route takes its
  // capacity from the boats Boat Operation assigns that day and ignores this column entirely.
  let dailyCap = null;
  if (body.dailyCap !== undefined && body.dailyCap !== null && str(body.dailyCap) !== '') {
    const n = Number(body.dailyCap);
    if (!isFinite(n) || n < 0) return { error: 'dailyCap must be a positive number of seats, or null for unlimited' };
    if (kind !== KIND_LAND) warnings.push('dailyCap ignored: only a land programme (kind "land") uses it — a boat route is capped by the boats deployed that day');
    else if (n > 0) dailyCap = Math.round(n);
  }
  if (kind === KIND_LAND && dailyCap == null) {
    warnings.push('no dailyCap set — this land programme sells with no seat ceiling at all (the booking form shows NO LIMIT)');
  }

  const color = str(body.color);
  if (color && !COLOR_RE.test(color)) return { error: 'color must be a #rrggbb hex string' };
  const code = str(body.code);
  if (code.length > 16) return { error: 'code must be 16 characters or fewer' };

  let sort = null;
  if (body.sort !== undefined && body.sort !== null && str(body.sort) !== '') {
    const n = Number(body.sort);
    if (!isFinite(n)) return { error: 'sort must be a number' };
    sort = Math.round(n);
  }

  const record = { extId: externalId, name, pier, kind, familyId, times, seasons };   // §routeKind
  const islands = str(body.islands);
  if (islands) record.islands = islands;
  if (color) record.color = color;
  if (code) record.code = code;
  if (sort != null) record.sort = sort;
  record.dailyCap = dailyCap;   // always written: null is a meaningful value (no quota)

  const pr = normalizePricing(body.pricing, pier, kind);
  if (pr.error) return { error: pr.error };
  if (pr.warnings) warnings.push(...pr.warnings);
  if (!pr.pricing) {
    warnings.push('no pricing attached — the route will not appear on the ops Booking calendar until it is added to an active rate type or receives its first booking (bkV2Routes). Boat Operation shows it either way.');
  }

  return { record, pricing: pr.pricing, warnings };
}

/** { rateTypeId, zones:{ZONE:{paxType:price}}, validity:{from,to} } → the same, validated. */
function normalizePricing(pricing, pier, kind) {
  if (pricing === undefined || pricing === null) return { pricing: null };
  if (typeof pricing !== 'object' || Array.isArray(pricing)) return { error: 'pricing must be an object' };
  const warnings = [];

  const rateTypeId = str(pricing.rateTypeId);
  if (!rateTypeId) return { error: 'pricing.rateTypeId is required — the ops rate type the seat prices belong to (GET /api/b2c/rate-types lists them)' };

  const zonesIn = pricing.zones;
  if (!zonesIn || typeof zonesIn !== 'object' || Array.isArray(zonesIn)) return { error: 'pricing.zones must be an object keyed by zone (PK, KL, NoTransfer)' };
  const allowed = zonesFor(kind, pier);
  const zones = {};
  for (const z of Object.keys(zonesIn)) {
    if (!allowed.includes(z)) return { error: 'zone "' + z + '" does not apply to a ' + (kind === KIND_LAND ? 'land' : pier) + ' route — allowed: ' + allowed.join(', ') };
    if (!PERSISTABLE_ZONES.has(z)) {
      return { error: 'zone "' + z + '" cannot be stored: operation_schemas.sb_rate_types__seatrates has no ' +
                      z.toLowerCase() + '_* columns, so the price would be silently dropped. Price this route under NoTransfer, ' +
                      'or add the columns (migration + field_mapping.json) first.' };
    }
    const rowIn = zonesIn[z] || {};
    if (typeof rowIn !== 'object' || Array.isArray(rowIn)) return { error: 'pricing.zones.' + z + ' must be an object keyed by pax type' };
    const row = {};
    for (const k of Object.keys(rowIn)) {
      if (!PAX_TYPES.includes(k)) return { error: 'unknown pax type "' + k + '" in zone ' + z + ' — valid: ' + PAX_TYPES.join(', ') };
      const n = Number(rowIn[k]);
      if (!isFinite(n) || n < 0) return { error: 'pricing.zones.' + z + '.' + k + ' must be a number >= 0' };
      row[k] = Math.round(n);
    }
    // Seed the whole pax-type row: a missing column reads as null in the app and renders blank,
    // which is indistinguishable from "free". 0 is the honest value for "not sold to this pax type".
    for (const k of PAX_TYPES) if (row[k] === undefined) row[k] = 0;
    zones[z] = row;
  }
  if (!Object.keys(zones).length) return { error: 'pricing.zones is empty — give at least one zone' };
  if (!Object.values(zones).some(r => PAX_TYPES.some(k => r[k] > 0))) {
    warnings.push('every price in pricing.zones is 0 — the route joins the rate type but bills nothing');
  }

  let validity = null;
  if (pricing.validity !== undefined && pricing.validity !== null) {
    const v = pricing.validity;
    if (typeof v !== 'object' || Array.isArray(v)) return { error: 'pricing.validity must be {from,to}' };
    const from = str(v.from), to = str(v.to);
    if (from && !validDate(from)) return { error: 'pricing.validity.from must be a real calendar date in YYYY-MM-DD' };
    if (to && !validDate(to)) return { error: 'pricing.validity.to must be a real calendar date in YYYY-MM-DD' };
    if (from && to && to < from) return { error: 'pricing.validity.to must be on or after from' };
    if (from || to) validity = { from, to };
  }

  return { pricing: { rateTypeId, zones, validity }, warnings };
}

/** Season rows need stable ids (the app keys edit/delete off them). Deterministic, per route. */
function withSeasonIds(record, routeId) {
  const out = Object.assign({}, record, { id: routeId });
  out.seasons = (record.seasons || []).map((s, i) => Object.assign({ id: 'ss_' + routeId + '_' + (i + 1) }, s));
  return out;
}

/**
 * Same id shape the Config modal produces ('r' + epoch ms), so a route created here is
 * indistinguishable from one a human made — nothing in the app parses a route id, but the ids do
 * get read by people comparing the two systems. `taken` is the set of ids already in use.
 */
function nextRouteId(taken, now) {
  let n = Number(now) || Date.now();
  let id = 'r' + n;
  while (taken.has(id)) id = 'r' + (++n);
  return id;
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// HTTP surface
// ════════════════════════════════════════════════════════════════════════════════════════════════
const PATHS = ['/api/b2c/routes', '/api/b2c/rate-types'];
function matches(pathname) { return PATHS.includes(pathname); }
function apiKey() { return (process.env.B2C_API_KEY || '').trim(); }

/**
 * @param ctx {{pool, fqt, qic, J, readBody, restTxn, sseBroadcast, dataBackend}}
 *   fqt/qic quote a table / an identifier the same way server.js does; restTxn runs the ops in one
 *   transaction, bumps app_state.version and returns {version}. Injected rather than imported so
 *   this module stays testable without a database or a running server.
 */
function handle(req, res, pathname, query, ctx) {
  const { J } = ctx;
  const key = apiKey();
  if (!key || (req.headers['x-api-key'] || '') !== key) return J(res, 401, { error: 'invalid or missing X-Api-Key' });
  if (!ctx.pool) return J(res, 503, { error: 'no database' });
  if (ctx.dataBackend !== 'relational') return J(res, 503, { error: 'requires relational backend' });

  if (pathname === '/api/b2c/rate-types') {
    if (req.method !== 'GET') return J(res, 405, { error: 'method not allowed' });
    return listRateTypes(res, ctx).catch(e => J(res, 500, { error: e.message }));
  }
  if (req.method === 'GET') return listRoutes(res, query, ctx).catch(e => J(res, 500, { error: e.message }));
  if (req.method === 'POST') {
    return ctx.readBody(req, body => {
      let parsed;
      try { parsed = JSON.parse(body || '{}'); } catch (e) { return J(res, 400, { error: 'invalid JSON' }); }
      createRoute(res, parsed, ctx).catch(e => {
        console.error('[b2c-catalog] create failed:', e.message);
        J(res, 500, { error: e.message });
      });
    });
  }
  return J(res, 405, { error: 'method not allowed' });
}

/** GET /api/b2c/routes[?externalId=POW-008] — what ops has, so B2C can map instead of duplicating. */
async function listRoutes(res, query, ctx) {
  const { pool, fqt, qic, J } = ctx;
  const wanted = (query.match(/(?:^|&)externalId=([^&]*)/) || [])[1];
  const extFilter = wanted ? decodeURIComponent(wanted) : null;

  const [routes, times, seasons, rtRoutes] = await Promise.all([
    pool.query(`SELECT id, ${qic('extid')} AS extid, name, islands, pier, ${qic('kind')} AS kind, ${qic('familyid')} AS familyid,
                       ${qic('dailycap')} AS dailycap, code, color FROM ${fqt('routes')} ORDER BY id`),
    pool.query(`SELECT routes_id, ${qic('value')} AS v FROM ${fqt('routes__times')} ORDER BY routes_id, idx`),
    pool.query(`SELECT routes_id, ${qic('type')} AS ty, ${qic('from')} AS f, ${qic('to')} AS t
                FROM ${fqt('routes__seasons')} ORDER BY routes_id, idx`),
    // Which rate types carry the route — the same condition bkV2Routes() uses to decide whether the
    // Booking calendar shows it at all, so a caller can see "created but invisible" without guessing.
    pool.query(`SELECT r.${qic('value')} AS route_id, rt.id, rt.code, rt.active
                FROM ${fqt('sb_rate_types__routes')} r JOIN ${fqt('sb_rate_types')} rt ON rt.id = r.sb_rate_types_id`),
  ]);

  const byRoute = (rows, k, f) => { const m = new Map(); for (const r of rows) { const a = m.get(r[k]) || []; a.push(f(r)); m.set(r[k], a); } return m; };
  const tMap = byRoute(times.rows, 'routes_id', r => r.v);
  const sMap = byRoute(seasons.rows, 'routes_id', r => ({ type: r.ty, from: r.f, to: r.t }));
  const rtMap = byRoute(rtRoutes.rows, 'route_id', r => ({ id: r.id, code: r.code, active: r.active === true }));

  const famName = id => (FAMILIES.find(f => f.id === id) || {}).name || null;
  const out = routes.rows
    .filter(r => !extFilter || String(r.extid || '') === extFilter)
    .map(r => {
      const rts = rtMap.get(r.id) || [];
      return {
        routeId: r.id,
        externalId: r.extid || null,
        name: r.name,
        islands: r.islands || '',
        pier: r.pier || null,
        // §routeKind · NULL on rows written before 028 · the app reads those through the pier='other'
        // fallback, so report the same answer the app would rather than a bare null.
        kind: r.kind || (r.pier === LEGACY_LAND_PIER ? KIND_LAND : KIND_MARINE),
        familyId: r.familyid,                  // null = never set · the app falls back to a name guess
        familyName: famName(r.familyid),
        dailyCap: r.dailycap == null ? null : Number(r.dailycap),
        code: r.code || null,
        color: r.color || null,
        times: tMap.get(r.id) || [],
        seasons: sMap.get(r.id) || [],
        rateTypes: rts,
        bookingCalendarVisible: rts.some(x => x.active),
      };
    });

  if (extFilter) {
    if (!out.length) return J(res, 404, { error: 'no ops route mapped to externalId "' + extFilter + '"' });
    return J(res, 200, out[0]);
  }
  return J(res, 200, { routes: out, families: FAMILIES, piers: PIERS });
}

/** GET /api/b2c/rate-types — so a caller can name one in `pricing.rateTypeId` without a DB peek. */
async function listRateTypes(res, ctx) {
  const { pool, fqt, J } = ctx;
  const { rows } = await pool.query(`SELECT id, code, name, active FROM ${fqt('sb_rate_types')} ORDER BY code`);
  return J(res, 200, { rateTypes: rows.map(r => ({ id: r.id, code: r.code, name: r.name, active: r.active === true })) });
}

/** POST /api/b2c/routes — create (or return) the ops route for one B2C product/variant. */
async function createRoute(res, body, ctx) {
  const { pool, fqt, qic, J, restTxn, sseBroadcast } = ctx;
  const norm = normalizeRoutePayload(body);
  if (norm.error) return J(res, 400, { error: norm.error });
  const { record, pricing } = norm;
  const warnings = norm.warnings.slice();

  const existing = await pool.query(`SELECT id, ${qic('extid')} AS extid, name FROM ${fqt('routes')}`);
  const hit = existing.rows.find(r => String(r.extid || '') === record.extId);
  if (hit) {
    // Idempotent by design: B2C retries, double submits and re-runs of an import script must not
    // fan out into duplicate programmes. Returning 200 (not 201) says "already yours".
    return J(res, 200, {
      ok: true, routeId: hit.id, created: false, externalId: record.extId,
      note: 'externalId already mapped to this ops route — nothing was changed',
    });
  }
  const clash = existing.rows.find(r => String(r.name || '').trim().toLowerCase() === record.name.toLowerCase());
  if (clash) warnings.push('a different route already carries this name ("' + clash.id + '") — ops staff will see two identical entries on the programme list');

  const routeId = nextRouteId(new Set(existing.rows.map(r => r.id)), Date.now());
  const ops = [{ op: 'put', r: 'routes', id: routeId, body: withSeasonIds(record, routeId) }];

  if (pricing) {
    const rt = await pool.query(`SELECT id, code, active FROM ${fqt('sb_rate_types')} WHERE id = $1`, [pricing.rateTypeId]);
    if (!rt.rows.length) return J(res, 400, { error: 'unknown rateTypeId "' + pricing.rateTypeId + '" — GET /api/b2c/rate-types lists valid ids' });
    if (rt.rows[0].active !== true) warnings.push('rate type "' + rt.rows[0].code + '" is inactive — bkV2Routes ignores inactive rate types, so this route still will not show on the Booking calendar');
    const cur = await pool.query(
      `SELECT ${qic('value')} AS v FROM ${fqt('sb_rate_types__routes')} WHERE sb_rate_types_id = $1 ORDER BY idx`, [pricing.rateTypeId]);
    const routeList = cur.rows.map(r => r.v).filter(Boolean);
    if (!routeList.includes(routeId)) routeList.push(routeId);
    // A per-FIELD patch, not a whole-record put: seatRates is merged one route key at a time, so a
    // staff member editing another route's prices in the same rate type does not lose them. The
    // routes[] array has no append primitive in applyObj, so it is replaced with the list read just
    // above — a concurrent edit to THAT array in the same second would be overwritten. Narrow enough
    // to accept for a create-a-product call; do not widen this patch to other fields.
    const p = { routes: { v: routeList }, seatRates: { m: { p: { [routeId]: { v: pricing.zones } } } } };
    if (pricing.validity) p.routeValidity = { m: { p: { [routeId]: { v: pricing.validity } } } };
    ops.push({ op: 'patch', r: 'sb_rate_types', id: pricing.rateTypeId, body: { m: { p } } });
  }

  let result;
  try {
    result = await restTxn('b2c-api', -1, ops);
  } catch (e) {
    // 23505 = the partial unique index on routes.extid (migration 027). Two concurrent creates for
    // the same product: the loser reads back the winner's row and reports the same success, which is
    // what an idempotent create means.
    if (e && e.code === '23505') {
      const again = await pool.query(`SELECT id FROM ${fqt('routes')} WHERE ${qic('extid')} = $1`, [record.extId]);
      if (again.rows.length) return J(res, 200, { ok: true, routeId: again.rows[0].id, created: false, externalId: record.extId, note: 'created concurrently by another request' });
    }
    throw e;
  }
  console.log('[b2c-catalog] created route ' + routeId + ' ext=' + record.extId + ' family=' + record.familyId + ' pier=' + record.pier + (pricing ? ' priced in ' + pricing.rateTypeId : ' no pricing'));
  if (sseBroadcast) sseBroadcast({ version: result.version, updated_by: 'b2c-api' });

  return J(res, 201, {
    ok: true, created: true, routeId, externalId: record.extId,
    familyId: record.familyId, pier: record.pier, version: result.version,
    warnings,
    next: 'store routeId in programs_own.ops_route_id (or the variant\'s equivalent) — that is what makes an order import with its route attached',
  });
}

module.exports = {
  matches, handle,
  // exported for tests
  normalizeRoutePayload, normalizePricing, nextRouteId, withSeasonIds, guessFamily,
  FAMILIES, PIERS, PAX_TYPES, zonesForPier,
};
