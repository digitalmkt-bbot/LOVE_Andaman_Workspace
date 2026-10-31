'use strict';
/**
 * b2c-v1-availability.js · GET /v1/availability, the same call on the same contract as
 * operation-backend's, answered from this monolith's data.
 *
 * Why it exists: Love Kingdom reads seats straight from our database (v_seat_availability through
 * OPS_DATABASE_URL). This gives it an HTTP call to move to instead. operation-backend already serves
 * this exact path and these exact fields (README "GET /v1/availability"), so when bookings move there
 * Love Kingdom changes a host and nothing else.
 *
 *   GET /v1/availability?route_id=r10&date=2030-01-04               one route, one day
 *   GET /v1/availability?from=2030-01-01&to=2030-01-31[&route_id=]  a range, inclusive
 *   optional: exclude_booking_id, exclude_lock_id
 *
 * Auth: X-Api-Key = B2C_API_KEY, the key /api/b2c/availability already uses. There is no /v1/login
 * here, so a Bearer token means nothing on this host.
 *
 * Sell against `available_seats` only. On a marine day with no boat it is 0 and the day still sells
 * (`unplaced_pax`), and on a land route it is null (`unlimited`): both as operation-backend answers.
 *
 * Where the numbers come from, because this data has burned every reader that took a shortcut:
 *   · deployments: trips__boat first, then the wide b*_route columns for pairs it does not carry yet.
 *     A boat added after the mapping has NO wide column, so reading those alone never sees it. Same
 *     rule as v_seat_availability (migration 020). /api/b2c/availability still reads the wide columns
 *     only, so this endpoint and that one disagree on such a boat, and this one is right.
 *   · chartered boats: a Boat-Op row typed 'charter' OR a boat a live charter booking holds that day
 *     (ops_boatsplits, else ops_boatid, else charterboatid). The staff app (baCharterBoatMap) already
 *     reads it that way; reading the row type alone sold a held boat's seats (r5, 1 Nov 2026: Romeo).
 *     Overnight-hold days between a charter's out and return dates are NOT covered here yet.
 *   · seats per boat: the day's override, clamped to registered seats (licensepax, else cap), as the
 *     view does.
 *   · booked / charter pax: the view's `demand` CTE. The trip date goes through f_trip_date_iso,
 *     every pax term is COALESCE'd, and a NULL bookingmode counts as a seat.
 *   · locks: top-level locks only, what is left after the children's draws. pendqty is taken off, as
 *     /api/b2c/availability does: a pending seat holds nothing (§lkPend).
 *   · open/closed: the client's getDayStatus, as /api/b2c/availability does.
 *
 * Differs from operation-backend on purpose: `open` is also on the single-day form, a closed day
 * always answers available_seats 0, available_seats is floored at 0, and an unknown route is 404.
 * Not served: `boat_broken` (the Action Board's, needs the open-work read) and `split` (400).
 */
const crypto = require('crypto');

const PATH = '/v1/availability';
const SEAT_RELEASING = ['cancelled', 'cancelled_weather', 'rejected'];
const MAX_DAYS_ONE_ROUTE = 400;
const MAX_DAYS_ALL_ROUTES = 62;
const LAND_KIND = 'land';
const LEGACY_LAND_PIER = 'other';
const TRIP_TYPES = ['early', 'normal'];

function matches(pathname) { return pathname === PATH; }

const isIsoDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '')
  && !isNaN(Date.parse(s + 'T00:00:00Z'))
  && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;

function eachDate(from, to) {
  const out = [];
  for (let d = new Date(from + 'T00:00:00Z'); d.toISOString().slice(0, 10) <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function keyMatches(sent, key) {
  const digest = v => crypto.createHash('sha256').update(String(v)).digest();
  return crypto.timingSafeEqual(digest(sent), digest(key));
}

const isLand = r => r.kind === LAND_KIND || (!r.kind && r.pier === LEGACY_LAND_PIER);

/** What one boat may sell that day and its registered ceiling. Mirrors v_seat_availability's `cap`. */
function boatSeats(boat, override) {
  const cap = Number(boat.cap) || 0;
  const ceiling = Number(boat.licensepax) || cap;
  const operational = override == null ? cap : Math.max(0, Math.round(override));
  return { sellable: Math.min(operational, ceiling), licensed: ceiling };
}

/** Mirrors the client's getDayStatus: an override wins, then a season, and outside every open season is closed. */
function calendarOf(seasons, overrides) {
  const seasonsOf = {}, overrideOf = {};
  for (const s of seasons) (seasonsOf[s.routes_id] = seasonsOf[s.routes_id] || []).push(s);
  // Ops overrides arrive JSON-quoted ("closed"), seasons do not.
  for (const o of overrides) overrideOf[o.routes_id + '|' + o.k] = String(o.v == null ? '' : o.v).replace(/^"|"$/g, '');
  return (routeId, date) => {
    const override = overrideOf[routeId + '|' + date];
    if (override) return override === 'open';
    const mine = seasonsOf[routeId] || [];
    if (!mine.length) return true;
    const hit = mine.find(s => s.f <= date && s.t >= date);
    if (hit) return hit.ty === 'open';
    return !mine.some(s => s.ty === 'open');
  };
}

/** Boats deployed per `date|route`: trips__boat wins, the wide columns serve only the pairs it lacks. */
function deploymentsOf({ boats, trips, tripBoats, capOverrides, charterBoats = [] }) {
  const boatOf = {}, override = {}, plans = {};
  // §charterBooking · a boat a charter booking holds that day is chartered, whatever its Boat-Op row says.
  const heldByCharter = new Set(charterBoats.map(r => r.date + '|' + r.boat_id));
  for (const b of boats) boatOf[b.id] = b;
  for (const r of capOverrides) if (r.cap != null && !isNaN(Number(r.cap))) override[r.k] = Number(r.cap);
  const plan = (date, boatId, route, type) => { plans[date + '|' + boatId] = { date, boatId, route, type }; };
  for (const row of trips) for (const b of boats) plan(row.key, b.id, row[b.id + '_route'], row[b.id + '_type']);
  for (const row of tripBoats) {
    let op = null;
    try { op = JSON.parse(row.value); } catch (e) { /* an unreadable row must not sink the whole answer */ }
    if (op && typeof op === 'object') plan(row.trips_id, row.key, op.route, op.type);
  }
  const byDay = {};
  for (const { date, boatId, route, type } of Object.values(plans)) {
    const boat = boatOf[boatId];
    if (!boat || !route) continue;
    const seats = boatSeats(boat, override[date + '::' + boatId]);
    (byDay[date + '|' + route] = byDay[date + '|' + route] || []).push({
      boat_id: boatId, capacity: seats.sellable, licensed: seats.licensed,
      license_pax: Number(boat.licensepax) || null,
      chartered: type === 'charter' || heldByCharter.has(date + '|' + boatId),
      trip_type: TRIP_TYPES.includes(type) ? type : 'normal',
    });
  }
  for (const list of Object.values(byDay)) list.sort((a, b) => a.boat_id.localeCompare(b.boat_id));
  return byDay;
}

/** (date, boat) pairs held by charter bookings. Mirrors the client's bkBoatIdsOn: splits win, then the single boat. */
function charterBoatsOf(rows) {
  const out = [];
  const splitIds = v => {
    let list = v;
    if (typeof v === 'string') { try { list = JSON.parse(v); } catch (e) { return []; } }
    return Array.isArray(list) ? list.map(x => x && x.boatId).filter(Boolean) : [];
  };
  for (const r of rows) {
    const first = Number(r.idx) === 0;
    let ids = splitIds(first ? r.bk_splits : r.trip_splits);
    if (!ids.length) { const one = (first ? r.bk_boat : r.trip_boat) || r.charterboatid; if (one) ids = [one]; }
    for (const id of new Set(ids)) out.push({ date: r.date, boat_id: id });
  }
  return out;
}

/** One entry per route-day, date first and then routes as given. No database in here, so it is testable. */
function buildDays(data, dates) {
  const deployed = deploymentsOf(data);
  const isOpen = calendarOf(data.seasons, data.overrides);
  const demandOf = {}, lockedOf = {};
  for (const r of data.demand) demandOf[r.date + '|' + r.routeid] = r;
  for (const r of data.locks) lockedOf[r.date + '|' + r.routeid] = Number(r.locked) || 0;
  const days = [];
  for (const date of dates) {
    for (const route of data.routes) {
      const key = date + '|' + route.id;
      const boats = deployed[key] || [];
      const booked = Number(demandOf[key] && demandOf[key].booked) || 0;
      const charter = Number(demandOf[key] && demandOf[key].charter) || 0;
      const locked = lockedOf[key] || 0;
      const unlimited = isLand(route);
      const pooled = !unlimited && boats.length > 0;
      const open = isOpen(route.id, date);
      const sum = (list, field) => list.reduce((total, boat) => total + boat[field], 0);
      const unchartered = boats.filter(boat => !boat.chartered);
      days.push({
        route_id: route.id, service_date: date, open,
        deployed_capacity: sum(boats, 'capacity'),
        licensed_capacity: sum(boats, 'licensed'),
        booked_pax: booked, charter_pax: charter, locked_pax: locked,
        available_seats: unlimited ? null : (pooled && open ? Math.max(sum(unchartered, 'capacity') - booked - locked, 0) : 0),
        unlimited,
        unplaced_pax: unlimited || pooled ? 0 : booked + charter + locked,
        licensed_free: unlimited ? null : (pooled ? Math.max(sum(unchartered, 'licensed') - booked, 0) : 0),
        deployments: boats.map(({ licensed, ...boat }) => boat),
      });
    }
  }
  return days;
}

/** Everything buildDays needs, in as few queries as the range allows. */
async function readDays(pool, { fqt, qic }, routes, from, to, excludeBookingId, excludeLockId) {
  const routeIds = routes.map(r => r.id);
  const tripDate = `${fqt('f_trip_date_iso')}(t.date, b.createdat)`;
  const pax = `COALESCE(t.pax_ad,0)     + COALESCE(t.pax_ad_fr,0)  + COALESCE(t.pax_ad_th,0)
             + COALESCE(t.pax_chd_fr,0) + COALESCE(t.pax_chd_th,0)
             + COALESCE(t.pax_inf_fr,0) + COALESCE(t.pax_inf_th,0)
             + COALESCE(t.pax_foc,0)    + COALESCE(t.pax_foc_fr,0) + COALESCE(t.pax_foc_th,0)`;
  const [demand, locks, boats, trips, tripBoats, capOverrides, seasons, overrides, charterTrips] = await Promise.all([
    // A B2C order is one ops row per line, b2c_<order>_<line>, so excluding the order takes them all.
    // left() rather than LIKE: `_` is a LIKE wildcard, so 'b2c_BK-1_%' would also match BK-10.
    pool.query(
      `SELECT ${tripDate} AS date, t.routeid,
              COALESCE(SUM(${pax}) FILTER (WHERE t.bookingmode IS DISTINCT FROM 'charter'), 0)::int AS booked,
              COALESCE(SUM(${pax}) FILTER (WHERE t.bookingmode = 'charter'), 0)::int AS charter
       FROM ${fqt('sb_bookings__trips')} t
       JOIN ${fqt('sb_bookings')} b ON b.id = t.sb_bookings_id
       WHERE t.routeid = ANY($1) AND ${tripDate} >= $2 AND ${tripDate} <= $3
         AND b.status <> ALL($4::text[])
         AND ($5::text IS NULL OR (b.id <> $5 AND left(b.id, length('b2c_' || $5 || '_')) <> 'b2c_' || $5 || '_'))
       GROUP BY 1, 2`,
      [routeIds, from, to, SEAT_RELEASING, excludeBookingId]),
    pool.query(
      `SELECT left(sl.date, 10) AS date, sl.routeid,
              COALESCE(SUM(GREATEST(sl.qty - COALESCE(sl.used,0) - COALESCE(ch.child_used,0) - COALESCE(sl.pendqty,0), 0)), 0)::int AS locked
       FROM ${fqt('sb_seat_locks')} sl
       LEFT JOIN LATERAL (
         SELECT COALESCE(SUM(COALESCE(c.used,0)),0) AS child_used
         FROM ${fqt('sb_seat_locks')} c WHERE c.parentid = sl.id
       ) ch ON true
       WHERE sl.routeid = ANY($1) AND left(sl.date, 10) >= $2 AND left(sl.date, 10) <= $3 AND sl.status = 'active'
         AND (sl.parentid IS NULL OR sl.parentid = '')
         AND ($4::text IS NULL OR sl.id <> $4)
       GROUP BY 1, 2`,
      [routeIds, from, to, excludeLockId]),
    pool.query(`SELECT id, cap, licensepax FROM ${fqt('boats')}`),
    pool.query(`SELECT * FROM ${fqt('trips')} WHERE ${qic('key')} >= $1 AND ${qic('key')} <= $2`, [from, to]),
    pool.query(
      `SELECT DISTINCT ON (trips_id, ${qic('key')}) trips_id, ${qic('key')} AS key, value
       FROM ${fqt('trips__boat')} WHERE trips_id >= $1 AND trips_id <= $2
       ORDER BY trips_id, ${qic('key')}, row_pk DESC`,
      [from, to]),
    // left(key,10): the key is '<date>::<boatId>', so a plain key<=to drops same-day ranges.
    pool.query(`SELECT ${qic('key')} AS k, cap FROM ${fqt('boat_capovr')}
                WHERE left(${qic('key')},10) >= $1 AND left(${qic('key')},10) <= $2`, [from, to]),
    pool.query(`SELECT routes_id, ${qic('type')} AS ty, ${qic('from')} AS f, ${qic('to')} AS t
                FROM ${fqt('routes__seasons')} WHERE routes_id = ANY($1)`, [routeIds]),
    pool.query(`SELECT routes_id, ${qic('key')} AS k, ${qic('value')} AS v
                FROM ${fqt('routes__overrides')}
                WHERE routes_id = ANY($1) AND ${qic('key')} >= $2 AND ${qic('key')} <= $3`, [routeIds, from, to]),
    // Boats held by live charter bookings. The first trip of a booking keeps its ops on the booking row,
    // later ones on the trip row (client bkOpsRead). Not filtered by route: the boat is held either way.
    pool.query(
      `SELECT ${tripDate} AS date, t.idx, t.charterboatid, t.ops_boatid AS trip_boat, t.ops_boatsplits AS trip_splits,
              b.ops_boatid AS bk_boat, b.ops_boatsplits AS bk_splits
       FROM ${fqt('sb_bookings__trips')} t
       JOIN ${fqt('sb_bookings')} b ON b.id = t.sb_bookings_id
       WHERE t.bookingmode = 'charter' AND ${tripDate} >= $1 AND ${tripDate} <= $2
         AND b.status <> ALL($3::text[])`,
      [from, to, SEAT_RELEASING]),
  ]);
  return buildDays({
    routes, demand: demand.rows, locks: locks.rows, boats: boats.rows, trips: trips.rows, tripBoats: tripBoats.rows,
    capOverrides: capOverrides.rows, seasons: seasons.rows, overrides: overrides.rows,
    charterBoats: charterBoatsOf(charterTrips.rows),
  }, eachDate(from, to));
}

/**
 * @param ctx {{pool, fqt, qic, J, dataBackend}} injected rather than imported, as in b2c-catalog.js,
 *   so this module stays testable without a database or a running server.
 */
function handle(req, res, query, ctx) {
  const { J, pool } = ctx;
  const refuse = (statusCode, error, message) => J(res, statusCode, { statusCode, error, message });
  const unauthorized = message => refuse(401, 'Unauthorized', message);
  const badRequest = message => refuse(400, 'Bad Request', message);

  const key = (process.env.B2C_API_KEY || '').trim();
  const sent = req.headers['x-api-key'];
  if (!key) return unauthorized('X-Api-Key is not accepted: B2C_API_KEY is not set');
  if (sent === undefined) return unauthorized('X-Api-Key is required');
  if (typeof sent !== 'string' || !keyMatches(sent, key)) return unauthorized('Invalid X-Api-Key');
  if (req.method !== 'GET') return refuse(403, 'Forbidden', 'The X-Api-Key opens GET /v1/availability only');
  if (!pool) return refuse(503, 'Service Unavailable', 'no database');
  if (ctx.dataBackend !== 'relational') return refuse(503, 'Service Unavailable', 'requires relational backend');

  const params = new URLSearchParams(query);
  const text = name => params.get(name) || undefined;
  const routeId = text('route_id'), date = text('service_date') || text('date'), from = text('from'), to = text('to');
  if (params.has('split')) return badRequest('split is not served on this host');
  const single = from === undefined && to === undefined;
  if (single) {
    if (!routeId) return badRequest('route_id is required');
    if (!date) return badRequest('date is required, or from and to for a range');
    if (!isIsoDate(date)) return badRequest('date must be a YYYY-MM-DD date');
  } else {
    if (date !== undefined) return badRequest('Pass either date or from and to, not both');
    if (from === undefined || to === undefined) return badRequest('from and to must be supplied together');
    if (!isIsoDate(from) || !isIsoDate(to)) return badRequest('from and to must be YYYY-MM-DD dates');
    if (to < from) return badRequest('to must not precede from');
    const span = eachDate(from, to).length;
    const limit = routeId === undefined ? MAX_DAYS_ALL_ROUTES : MAX_DAYS_ONE_ROUTE;
    if (span > limit) return badRequest(`Range covers ${span} days; the maximum is ${limit}${routeId === undefined ? ' without route_id' : ''}`);
  }

  const excludeBookingId = text('exclude_booking_id') || null, excludeLockId = text('exclude_lock_id') || null;
  return pool.query(`SELECT id, pier, kind FROM ${ctx.fqt('routes')} ORDER BY sort NULLS LAST, id`)
    .then(async ({ rows }) => {
      const routes = routeId === undefined ? rows : rows.filter(r => r.id === routeId);
      if (routeId !== undefined && !routes.length) return refuse(404, 'Not Found', 'Route not found');
      const days = await readDays(pool, ctx, routes, single ? date : from, single ? date : to, excludeBookingId, excludeLockId);
      if (!single) return J(res, 200, { days });
      const { deployments, ...day } = days[0];
      return J(res, 200, day);
    })
    .catch(e => {
      console.error('[v1/availability] failed:', e.message);
      refuse(500, 'Internal Server Error', 'availability read failed');
    });
}

module.exports = {
  matches, handle,
  // exported for tests
  buildDays, charterBoatsOf, boatSeats, calendarOf, deploymentsOf, isIsoDate,
};
