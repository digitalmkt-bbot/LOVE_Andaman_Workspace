// LOVE Andaman · server for Railway: static app + login (users) + cloud sync with overwrite-guard.
// Data is one JSON blob (loveandaman_v2) in Postgres, versioned (optimistic concurrency).
const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

let Pool = null, PgClient = null;
try {
  const pg = require('pg'); Pool = pg.Pool; PgClient = pg.Client;
  pg.types.setTypeParser(20, v => v == null ? null : Number(v));   // int8 -> Number (default is string → the app string-concatenates caps/pax)
} catch(e){ console.warn('[db] pg not installed'); }

const ROOT   = __dirname;
const PORT   = process.env.PORT || 3000;
const DB_URL = process.env.DATABASE_URL || '';
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'); // set SESSION_SECRET to keep logins across redeploys
const ADMIN_USER = (process.env.ADMIN_USER || '').trim();
const ADMIN_PASS = process.env.ADMIN_PASS || '';
const STATE_KEY  = 'loveandaman_v2';
const SESS_DAYS  = 30;   // session cookie lifetime · long so refresh/redeploy never forces re-login

// ── relational backend (DATA_BACKEND=relational): app_state blob is assembled from / decomposed
//    into the operation_schemas tables via os_repo. blob mode (default) is unchanged. ──
const DATA_BACKEND = (process.env.DATA_BACKEND || 'blob').toLowerCase();
const OS_SCHEMA = 'operation_schemas';
// users auth table (2026-07-10 · feat/validation-deprecate-blob): relational backend keeps it in
// operation_schemas (migrated via os-backend/scripts/migrate_users_to_os_schema.js — run BEFORE
// deploying this); blob mode keeps the legacy unqualified `users` (resolves via the role's search_path,
// e.g. allotment.users on prod). app_state + attachments stay unqualified in both modes.
const USERS_T = DATA_BACKEND === 'relational' ? OS_SCHEMA + '.users' : 'users';
// os_repo mapping engine + schema model — used by the relational save path AND the per-entity REST API.
const osRepo  = require('./os-backend/src/mapping/os_repo.js');
const osModel = require('./os-backend/src/mapping/operation_schemas_model.json');
const OS_TABLES = Object.keys(osModel);
const OS_COLS = {};
for (const t of OS_TABLES) OS_COLS[t] = osModel[t].columns.map(c => c.name);
// column type map · used by _bindVal to coerce bad scalars (e.g. "" into a bigint col) → null.
// One bad value used to throw mid-transaction and wedge the ENTIRE batch on retry forever
// (2026-07-15: a bulk agent import shipped creditDays:"" → "invalid input syntax for type bigint").
const OS_COLTYPE = {};
for (const t of OS_TABLES){ OS_COLTYPE[t] = {}; for (const c of osModel[t].columns) OS_COLTYPE[t][c.name] = c.type || ''; }
function _bindVal(t, c, row){
  let v = row[c] === undefined ? null : row[c];
  const ty = (OS_COLTYPE[t] && OS_COLTYPE[t][c]) || '';
  if (/^(bigint|integer|int|smallint|numeric|decimal|double|real|float)/i.test(ty)){
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v === 'string'){ const s = v.trim(); if (s === '') return null; const n = Number(s); return Number.isFinite(n) ? n : null; }
    return null;                                   // "", null, boolean, object → null (never a valid number)
  }
  if (/^bool/i.test(ty)){
    if (typeof v === 'boolean') return v;
    if (v === 'true' || v === 1 || v === '1') return true;
    if (v === 'false' || v === 0 || v === '0') return false;
    return null;                                   // "" etc → null (avoids "invalid input syntax for type boolean")
  }
  return v;
}
const _osDepth = t => t.split('__').length - 1;                       // children deeper than parents
const OS_ASC  = [...OS_TABLES].sort((a, b) => _osDepth(a) - _osDepth(b));   // parents first (insert)
const OS_DESC = [...OS_TABLES].sort((a, b) => _osDepth(b) - _osDepth(a));   // children first (delete)
const qic = id => '"' + String(id).replace(/"/g, '""') + '"';
const fqt = t => qic(OS_SCHEMA) + '.' + qic(t);

// ── save-safety guard (2026-07-10 · feat/validation-deprecate-blob) ──────────────────────────────
// A stale / old whole-blob client can post data whose collections are empty or drastically shorter than
// what the DB already holds; the relational save then DELETEs the table and re-INSERTs ~nothing → records
// silently revert to DEFAULT_* seeds (e.g. boat pier, agent name). This guard refuses any save that would
// wipe or heavily shrink a top-level table that currently has data. Protects every main entity table.
// Bypass an INTENTIONAL bulk clear with payload.confirm (whole-blob) / op.confirm (per-entity putall).
const OS_TOP = OS_TABLES.filter(t => !t.includes('__') && t !== 'app_meta');   // all main entity tables
const GUARD_MINROWS = 5, GUARD_LOSS_ABS = 20, GUARD_LOSS_FRAC = 0.5;
function shrinkGuard(curCount, incCount){                                       // -> [{table,from,to}] that would be wiped/shrunk
  const bad = [];
  for (const t of OS_TOP){
    const cur = curCount[t] || 0, inc = incCount[t] || 0;
    if (cur >= GUARD_MINROWS && (inc === 0 || (cur - inc >= GUARD_LOSS_ABS && inc < cur * GUARD_LOSS_FRAC)))
      bad.push({ table: t, from: cur, to: inc });
  }
  return bad;
}
function shrinkErr(bad){ const e = new Error('SHRINK_GUARD'); e.code = 'SHRINK_GUARD'; e.detail = bad; return e; }

async function relLoad() {                                           // operation_schemas -> blob (parallel)
  const results = await Promise.all(OS_TABLES.map(t => pool.query(`SELECT * FROM ${fqt(t)}`)));
  const data = {};
  OS_TABLES.forEach((t, i) => { data[t] = results[i].rows; });
  return osRepo.assembleBlob(data);
}

// ── B2C external database sync ──────────────────────────────────────────────────────────────────
// Called on every login (relational mode only). Upserts B2C bookings into operation_schemas so
// they appear as native bookings in allotment (editable, boat/van assignable). Ops columns (boat,
// van, pickup) are always preserved on conflict — only B2C-owned fields are overwritten.
//
// B2C tables live in a named schema (love_kingdom on the shared dev Postgres, whose search_path
// is `allotment, public` — an unqualified `booking_items` there fails). Set B2C_SCHEMA to match.
const B2C_SCHEMA = (process.env.B2C_SCHEMA || 'public').replace(/[^a-zA-Z0-9_]/g, '');
const b2cT = t => `"${B2C_SCHEMA}"."${t}"`;
//
// Fill in null entries when the allotment route for each B2C product is decided:
const B2C_ROUTE_MAP = {
  // Day trip programs (matched via product_id)
  'POW-001': 'r5',   // Day Trip - Similan Island → Similan Islands by Speedboat
  'POW-002': 'r6',   // Day Trip - Surin Island → Surin Islands by Speedboat
  'POW-003': 'r10',  // Day Trip - Phi Phi Island → Phi Phi Bamboo by Speedboat
  'POW-004': 'r12',  // Day Trip - Phi Phi - Maiton → Whale Shark Phi Phi Maiton Sunset
  // Private routes (matched via route_id on private_own items)
  'PR-001':  'r5',   // Private Similan → Similan Islands by Speedboat
  'PR-002':  'r6',   // Private Surin → Surin Islands by Speedboat
  'PR-003':  'r10',  // Private Phi Phi + Bamboo → Phi Phi Bamboo by Speedboat
  'PR-004':  'r12',  // Private Phi Phi + Maiton → Whale Shark Phi Phi Maiton Sunset
};
const B2C_PRODUCT_NAME = {
  'POW-001': 'Day Trip - Similan Island',
  'POW-002': 'Day Trip - Surin Island',
  'POW-003': 'Day Trip - Phi Phi Island',
  'POW-004': 'Day Trip - Phi Phi - Maiton',
  'PR-001':  'Private - Similan Island',
  'PR-002':  'Private - Surin Islands',
  'PR-003':  'Private - Phi Phi + Bamboo Islands',
  'PR-004':  'Private - Phi Phi + Maiton (Sunset)',
};
// pickupareaid rides along here: matched best-effort from the B2C free-text location on first sync,
// then owned by ops (staff re-assignment must survive resyncs) — excluded from conflict-update.
const B2C_OPS_BK   = new Set(['ops_boatid','ops_vangroup','ops_vanseq','ops_vanreturnid','ops_vanid','ops_returnsamevan','ops_pickuptimefinal','ops_reconfirm','ops_vansplits','pickupareaid']);
const B2C_OPS_TRIP = new Set(['ops_boatid','ops_vanid','ops_vanreturnid','ops_returnsamevan','ops_vangroup','ops_vanseq','ops_pickuptimefinal','ops_vansplits','ops_reconfirm']);

function mapB2CStatus(s) {
  if (s === 'cancelled') return 'cancelled';
  if (s === 'pending')   return 'pending_approval';
  return 'confirmed';
}

// Line-item seat price = Σ(pax_<cat> × details.unitPrices.<cat>) over adult/child/infant/foc.
// details is jsonb (parsed by pg); falls back to the stored subtotal column if rates are missing.
function b2cLineSeat(item) {
  let det = item.details;
  if (typeof det === 'string') { try { det = JSON.parse(det); } catch (_) { det = null; } }
  const up = (det && det.unitPrices) || {};
  const seat = (Number(item.pax_adult)  || 0) * (Number(up.adult)  || 0)
             + (Number(item.pax_child)  || 0) * (Number(up.child)  || 0)
             + (Number(item.pax_infant) || 0) * (Number(up.infant) || 0)
             + (Number(item.pax_foc)    || 0) * (Number(up.foc)    || 0);
  return Math.round(seat || Number(item.subtotal) || 0);
}

// One allotment booking PER B2C booking_item — items sit at booking level, not nested as trips.
// id = b2c_<booking_id>_<line_no>; voucher = the B2C booking_id verbatim (no added prefix —
// new B2C ids already carry their own LOV- prefix); each carries a single trip.
// isFirstLine: order-level payment (deposit/balance) attaches only to the first line of the order,
// so a multi-item order's payment isn't multiplied across its item-bookings.
function mapB2CItemBooking(item, isFirstLine, findAreaId) {
  const h = item;
  // pg returns date columns as JS Date objects — String(d).slice(0,10) gives "Sat Jul 18",
  // not YYYY-MM-DD, which the frontend cannot parse. Format in local time explicitly.
  const td = d => {
    if (!d) return null;
    if (d instanceof Date) {
      const p = n => String(n).padStart(2, '0');
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    }
    const s = String(d).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  };
  // Item-level travel_date first; order-level (bookings.travel_date) as fallback — the B2C
  // checkout sometimes stores the trip date only on the order header.
  const date = td(h.travel_date) || td(h.bk_travel_date) || null;
  const seat = b2cLineSeat(h);
  // pax_adult = total adults; pax_thai/pax_foreign = nationality split (may be 0/0 when unknown).
  // Never use pax_foreign||pax_adult — a Thai-only booking (fr=0, th=5, ad=5) double-counts to 10.
  const adTh = Number(h.pax_thai) || 0;
  const adFrRaw = Number(h.pax_foreign) || 0;
  const adFr = adFrRaw > 0 ? adFrRaw : Math.max(0, (Number(h.pax_adult) || 0) - adTh);
  // Lead name: the booking's own passenger/booker name beats the CRM customers row — the B2C
  // backend dedupes customers by email, so customers.name can be a stale earlier customer.
  let leadFromPax = '';
  try {
    let ps = h.bk_passengers;
    if (typeof ps === 'string') ps = JSON.parse(ps);
    if (Array.isArray(ps) && ps[0] && ps[0].name) leadFromPax = String(ps[0].name).trim();
  } catch (_) {}
  // private_own = whole-boat charter; day_trip = shared seat. B2C is the source of truth for product
  // type, so derive the mode here — a charter must NOT consume the day-trip seat pool
  // (getSeatsConsumed / baCharterBoatIds exclude bookingMode==='charter'). Detect from BOTH signals:
  // the item type AND a PR-xxx product/route id (private items carry PR-*; day trips carry POW-*/r*),
  // so a private booking is caught however B2C tags it.
  const isPrivateId = id => /^PR-/i.test(String(id || ''));
  const isCharter = h.type === 'private_own' || isPrivateId(h.product_id) || isPrivateId(h.route_id);
  // Pickup (details jsonb): B2C only knows the 3 coarse transfer zones (PK/KL/NoTransfer) plus a
  // free-text pickupLocation — the 37 ops pickup areas never cross the API (B2C_PICKUP_ZONE_DATA.md).
  // hotelName/pickupZone/pickupSelf are B2C-owned (refreshed every sync); pickupAreaId is matched
  // best-effort against sb_pickup_areas and preserved on conflict (see B2C_OPS_BK).
  let det = h.details;
  if (typeof det === 'string') { try { det = JSON.parse(det); } catch (_) { det = null; } }
  det = det || {};
  const pickupLoc  = String(det.pickupLocation || '').trim();
  const noTransfer = det.noTransfer === true;
  const pickupZone = noTransfer ? 'NoTransfer' : String(det.pickupZone || '').trim();
  const areaId = (typeof findAreaId === 'function') ? findAreaId(pickupLoc, pickupZone) : null;
  const dropoffLoc = (det.dropoffSame === false) ? String(det.dropoffLocation || '').trim() : '';
  const trip = {
    id: 'b2c_' + h.booking_id + '_' + h.line_no + '_t0',
    routeId: B2C_ROUTE_MAP[h.product_id] || B2C_ROUTE_MAP[h.route_id] || null,
    date: date,
    bookingMode: isCharter ? 'charter' : 'seat',
    pax: {
      ad_fr: adFr,
      ad_th: adTh,
      chd_fr: Number(h.pax_child) || 0,
      chd_th: 0,
      inf_fr: Number(h.pax_infant) || 0,
      inf_th: 0,
      foc: Number(h.pax_foc) || 0,
    },
    seatSource: { locked: 0, general: 0 },
    lockDrawSel: {},
    subtotal: seat,
  };
  // Charter: keep the B2C-paid amount as a manual charter price so it isn't recomputed from the
  // rate card once ops assigns a boat. charterBoatId stays null — ops picks the boat in-app.
  if (isCharter) {
    trip.charterBoatId = null;
    trip.charterPriceMode = 'manual';
    trip.charterPriceManual = seat;
  }
  return {
    id: 'b2c_' + h.booking_id + '_' + h.line_no,
    schemaVer: 2,
    createdAt: h.bk_created_at ? new Date(h.bk_created_at).toISOString() : new Date().toISOString(),
    createdBy: 'b2c_sync',
    voucherRef: String(h.booking_id),
    agentId: 'a_b2c',
    leadPax: leadFromPax || h.customer_name || h.booked_by_name || '',
    leadNationality: '',
    leadPhone: h.customer_phone || '',
    leadEmail: h.booked_by_email || '',
    status: mapB2CStatus(h.bk_status),
    bookingDate: date,
    hotelName: pickupLoc,
    pickupZone: pickupZone,
    pickupSelf: noTransfer,
    pickupAreaId: areaId,
    dropoffHotelName: dropoffLoc,
    note: ['B2C', h.channel_name, String(h.booking_id), B2C_PRODUCT_NAME[h.product_id] || B2C_PRODUCT_NAME[h.route_id] || h.product_id,
           (pickupLoc && !areaId && !noTransfer) ? `Pickup: ${pickupLoc}${pickupZone ? ' (' + pickupZone + ')' : ''} — area unassigned` : null].filter(Boolean).join(' · '),
    trips: [trip],
    passengers: [],
    addOns: [],
    adjustments: [],
    total: seat,
    priceBreakdown: {
      seat: seat,
      addOn: 0,
      focDiscount: 0,
      discount: 0,
      extra: 0,
      total: seat,
    },
    paymentSnapshot: {
      deposit: isFirstLine ? (Number(h.bk_deposit) || 0) : 0,
      balance: isFirstLine ? (Number(h.bk_balance) || 0) : 0,
      method: h.payment_method_id || '',
    },
    ops: {},
    history: [],
  };
}

// booking_items JOIN query — drives everything from items, bookings table is optional enrichment only
const B2C_ITEM_JOIN = `
  SELECT bi.*,
         b.status        AS bk_status,
         b.travel_date   AS bk_travel_date,
         b.passengers    AS bk_passengers,
         b.booked_by_name, b.booked_by_email,
         b.subtotal      AS bk_subtotal,
         b.discount_amount AS bk_discount,
         b.surcharge_amount AS bk_surcharge,
         b.total         AS bk_total,
         b.deposit       AS bk_deposit,
         b.balance       AS bk_balance,
         b.payment_method_id,
         b.created_at    AS bk_created_at,
         ch.name         AS channel_name,
         c.name          AS customer_name,
         c.phone         AS customer_phone
  FROM ${b2cT('booking_items')} bi
  LEFT JOIN ${b2cT('bookings')} b       ON b.id  = bi.booking_id
  LEFT JOIN ${b2cT('b2c_channels')} ch  ON ch.id = b.channel_id
  LEFT JOIN ${b2cT('customers')} c      ON c.id  = b.customer_id
  WHERE bi.type IN ('day_trip','private_own')`;

async function relSyncB2C(singleExtId = null) {
  if (!b2cPool || !pool || DATA_BACKEND !== 'relational') return;
  try {
    let itemRows;
    if (singleExtId) {
      ({ rows: itemRows } = await b2cPool.query(
        B2C_ITEM_JOIN + ` AND bi.booking_id = $1 ORDER BY bi.line_no`, [singleExtId]
      ));
      if (!itemRows.length) {
        const r = await pool.query(
          `UPDATE ${fqt('sb_bookings')} SET status='cancelled'
           WHERE id ~ ('^b2c_' || $1::text || '(_[0-9]+)?$') AND status NOT IN ('cancelled','cancelled_weather','rejected')`,
          [String(singleExtId)]
        );
        console.log(`[b2c-sync] booking ${singleExtId} removed in B2C — ${r.rowCount} line(s) marked cancelled`);
        return;
      }
    } else {
      ({ rows: itemRows } = await b2cPool.query(
        B2C_ITEM_JOIN + ` ORDER BY bi.booking_id, bi.line_no LIMIT 2000`
      ));
      if (!itemRows.length) return;
    }

    // Change detection (full runs only): hash the raw source rows and compare with the last synced
    // hash. Unchanged → skip the whole upsert (fast path — this runs on EVERY /api/load). Changed →
    // upsert, then bump app_state version + SSE so clients actually reload the new data. Without the
    // bump, /api/load saw "version unchanged" and served the pre-sync cached blob — new B2C bookings
    // sat in the tables but never reached the app until an unrelated save bumped the version.
    let srcHash = null;
    if (!singleExtId) {
      srcHash = crypto.createHash('sha1').update(JSON.stringify(itemRows)).digest('hex');
      try {
        const hr = await pool.query('SELECT data FROM app_state WHERE id=$1', ['b2c_sync_hash']);
        if (hr.rows[0] && hr.rows[0].data === srcHash) return;   // B2C unchanged since last sync
      } catch (_) {}
    }

    // Pickup-area matcher: B2C sends a free-text pickupLocation; resolve it to an ops pickup area
    // only when the match is unambiguous (exact name, else a single substring hit, zone-compatible).
    // No match → area stays unassigned for ops staff (flagged in the booking note).
    let areaRows = [];
    try { ({ rows: areaRows } = await pool.query(`SELECT id, name, zone FROM ${fqt('sb_pickup_areas')}`)); }
    catch (e) { console.warn('[b2c-sync] pickup areas unavailable — skipping area match:', e.message); }
    const _norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const findAreaId = (loc, zone) => {
      const L = _norm(loc);
      if (!L) return null;
      const cand = areaRows.filter(a => !zone || !a.zone || a.zone === zone);
      let hit = cand.filter(a => _norm(a.name) === L);
      if (!hit.length) hit = cand.filter(a => { const N = _norm(a.name); return N.includes(L) || L.includes(N); });
      return hit.length === 1 ? hit[0].id : null;
    };

    // Flatten: one allotment booking per line item. Group only to flag the first line of each
    // B2C order (order-level payment attaches to that line — see mapB2CItemBooking).
    const byId = {};
    for (const item of itemRows) { (byId[item.booking_id] = byId[item.booking_id] || []).push(item); }
    const b2cBks = [];
    for (const items of Object.values(byId)) {
      items.sort((a, b) => Number(a.line_no) - Number(b.line_no));
      items.forEach((it, i) => b2cBks.push(mapB2CItemBooking(it, i === 0, findAreaId)));
    }
    const tables  = osRepo.decomposeBlob({ sb_bookings: b2cBks });
    const b2cIds  = b2cBks.map(b => b.id);

    const BK_COLS   = OS_COLS['sb_bookings'];
    const TRIP_COLS = OS_COLS['sb_bookings__trips'];
    const PAX_COLS  = OS_COLS['sb_bookings__passengers'];
    const ADN_COLS  = OS_COLS['sb_bookings__addons'];
    const BK_UPDATE = BK_COLS.filter(c => c !== 'id' && c !== 'createdat' && c !== 'createdby' && !B2C_OPS_BK.has(c));

    const bkColSql  = BK_COLS.map(qic).join(', ');
    const bkPh      = BK_COLS.map((_, i) => '$' + (i + 1)).join(', ');
    // Sticky cancel: an ops-side cancellation must survive B2C re-sync. B2C can still MOVE a booking INTO
    // a cancelled state (existing not-cancelled → takes EXCLUDED), but can never resurrect one ops cancelled.
    const bkSet     = BK_UPDATE.map(c => c === 'status'
      ? `${qic(c)} = CASE WHEN ${qic('sb_bookings')}.${qic(c)} IN ('cancelled','cancelled_weather','rejected') THEN ${qic('sb_bookings')}.${qic(c)} ELSE EXCLUDED.${qic(c)} END`
      : `${qic(c)} = EXCLUDED.${qic(c)}`).join(', ');
    const tripColSql = TRIP_COLS.map(qic).join(', ');
    const tripPh    = TRIP_COLS.map((_, i) => '$' + (i + 1)).join(', ');
    const paxColSql = PAX_COLS.map(qic).join(', ');
    const paxPh     = PAX_COLS.map((_, i) => '$' + (i + 1)).join(', ');
    const adnColSql = ADN_COLS.map(qic).join(', ');
    const adnPh     = ADN_COLS.map((_, i) => '$' + (i + 1)).join(', ');

    const client = await pool.connect();
    let _phase = 'begin';
    try {
      await client.query('BEGIN');

      // 1. Upsert main booking rows — ops columns preserved on conflict
      _phase = 'upsert sb_bookings';
      for (const row of tables['sb_bookings'] || []) {
        await client.query(
          `INSERT INTO ${fqt('sb_bookings')} (${bkColSql}) VALUES (${bkPh})
           ON CONFLICT (id) DO UPDATE SET ${bkSet}`,
          BK_COLS.map(c => row[c] === undefined ? null : row[c])
        );
      }

      // 2. Refresh trips: save per-trip ops → delete → re-insert → restore ops by idx
      _phase = 'save existing trip ops';
      const { rows: existingTrips } = await client.query(
        `SELECT sb_bookings_id, idx, ops_boatid, ops_vanid, ops_vanreturnid, ops_returnsamevan,
                ops_vangroup, ops_vanseq, ops_pickuptimefinal, ops_vansplits, ops_reconfirm
         FROM ${fqt('sb_bookings__trips')} WHERE sb_bookings_id = ANY($1)`, [b2cIds]
      );
      const savedTripOps = {};
      for (const r of existingTrips) {
        (savedTripOps[r.sb_bookings_id] = savedTripOps[r.sb_bookings_id] || {})[r.idx] = r;
      }
      _phase = 'delete+re-insert trips';
      await client.query(`DELETE FROM ${fqt('sb_bookings__trips')} WHERE sb_bookings_id = ANY($1)`, [b2cIds]);
      for (const row of tables['sb_bookings__trips'] || []) {
        await client.query(
          `INSERT INTO ${fqt('sb_bookings__trips')} (${tripColSql}) VALUES (${tripPh})`,
          TRIP_COLS.map(c => row[c] === undefined ? null : row[c])
        );
      }
      _phase = 'restore trip ops';
      for (const [bkId, byIdx] of Object.entries(savedTripOps)) {
        for (const [idx, ops] of Object.entries(byIdx)) {
          if (ops.ops_boatid == null && ops.ops_vanid == null) continue;
          await client.query(
            `UPDATE ${fqt('sb_bookings__trips')} SET
               ops_boatid=$1, ops_vanid=$2, ops_vanreturnid=$3, ops_returnsamevan=$4,
               ops_vangroup=$5, ops_vanseq=$6, ops_pickuptimefinal=$7, ops_vansplits=$8, ops_reconfirm=$9
             WHERE sb_bookings_id=$10 AND idx=$11`,
            [ops.ops_boatid, ops.ops_vanid, ops.ops_vanreturnid, ops.ops_returnsamevan,
             ops.ops_vangroup, ops.ops_vanseq, ops.ops_pickuptimefinal, ops.ops_vansplits, ops.ops_reconfirm,
             bkId, Number(idx)]
          );
        }
      }

      // 3. Refresh passengers + addons (B2C is source of truth for these)
      _phase = 'refresh passengers';
      await client.query(`DELETE FROM ${fqt('sb_bookings__passengers')} WHERE sb_bookings_id = ANY($1)`, [b2cIds]);
      for (const row of tables['sb_bookings__passengers'] || []) {
        await client.query(
          `INSERT INTO ${fqt('sb_bookings__passengers')} (${paxColSql}) VALUES (${paxPh})`,
          PAX_COLS.map(c => row[c] === undefined ? null : row[c])
        );
      }
      _phase = 'refresh addons';
      await client.query(`DELETE FROM ${fqt('sb_bookings__addons')} WHERE sb_bookings_id = ANY($1)`, [b2cIds]);
      for (const row of tables['sb_bookings__addons'] || []) {
        await client.query(
          `INSERT INTO ${fqt('sb_bookings__addons')} (${adnColSql}) VALUES (${adnPh})`,
          ADN_COLS.map(c => row[c] === undefined ? null : row[c])
        );
      }
      // 4. Cancel line-bookings whose line disappeared from a synced order (per-item cancellation).
      //    Scoped to the B2C order_ids present in this run; keeps lines we just upserted (b2cIds).
      _phase = 'cancel removed lines';
      const presentOrderIds = [...new Set(itemRows.map(i => String(i.booking_id)))];
      await client.query(
        `UPDATE ${fqt('sb_bookings')} SET status='cancelled'
         WHERE id ~ '^b2c_[0-9]+(_[0-9]+)?$'
           AND split_part(id, '_', 2) = ANY($1)
           AND id <> ALL($2)
           AND status NOT IN ('cancelled','cancelled_weather','rejected')`,
        [presentOrderIds, b2cIds]
      );

      // 5. Oversell safety net. B2C bypasses the ops capacity guard (relSyncB2C writes rows directly, never
      //    through bkV2CommitBooking), so a sale past the deployed seat capacity can land here. For each
      //    route/date touched in this run that HAS boats deployed, flag the OVERFLOW B2C bookings
      //    (oldest kept confirmed, newest pushed to pending_approval) so ops must add a boat / fix capacity.
      //    Idempotent: re-applied every sync until capacity covers demand; dates with no deployment
      //    (capacity 0 — e.g. far-future advance bookings) are skipped so normal bookings aren't flagged.
      _phase = 'oversell flag';
      const NUL = ' ';
      const affPairs = [...new Set((tables['sb_bookings__trips'] || [])
        .filter(t => t.bookingmode === 'seat' && t.routeid && t.date)
        .map(t => t.routeid + NUL + t.date))];
      if (affPairs.length) {
        const affDates = [...new Set(affPairs.map(p => p.split(NUL)[1]))];
        const { rows: capBoats } = await client.query(`SELECT id, cap FROM ${fqt('boats')}`);
        const boatCap2 = {}, boatIds2 = [];
        for (const b of capBoats) { boatCap2[b.id] = Number(b.cap) || 0; boatIds2.push(b.id); }
        const tripByDate = {};
        for (const r of (await client.query(`SELECT * FROM ${fqt('trips')} WHERE ${qic('key')} = ANY($1)`, [affDates])).rows) tripByDate[r.key] = r;
        const lockByKey = {};
        for (const r of (await client.query(
          `SELECT routeid, date, COALESCE(SUM(GREATEST(qty - used, 0)), 0)::int AS n
           FROM ${fqt('sb_seat_locks')} WHERE date = ANY($1) AND status='active' GROUP BY routeid, date`, [affDates])).rows)
          lockByKey[r.routeid + NUL + r.date] = r.n;
        const bkByKey = {};
        for (const r of (await client.query(
          `SELECT t.routeid, t.date, b.id, b.status,
                  (t.pax_ad_fr + t.pax_chd_fr + t.pax_inf_fr + t.pax_foc_fr
                 + t.pax_ad_th + t.pax_chd_th + t.pax_inf_th + t.pax_foc_th)::int AS pax
           FROM ${fqt('sb_bookings__trips')} t JOIN ${fqt('sb_bookings')} b ON b.id = t.sb_bookings_id
           WHERE t.date = ANY($1) AND t.bookingmode='seat' AND b.status <> ALL($2::text[])
           ORDER BY b.createdat ASC NULLS FIRST, b.id ASC`,
          [affDates, ['cancelled','cancelled_weather','rejected']])).rows)
          (bkByKey[r.routeid + NUL + r.date] = bkByKey[r.routeid + NUL + r.date] || []).push(r);
        const toFlag = [];
        for (const pair of affPairs) {
          const [rid, dk] = pair.split(NUL);
          const trow = tripByDate[dk] || {};
          let capacity = 0;
          for (const bid of boatIds2) {
            if (trow[bid + '_route'] === rid && trow[bid + '_type'] !== 'charter') capacity += boatCap2[bid] || 0;
          }
          if (capacity <= 0) continue;                          // no boats deployed yet → no constraint
          const fillLine = capacity - (lockByKey[pair] || 0);   // seats sellable to bookings after locks
          let cum = 0;
          for (const r of (bkByKey[pair] || [])) {
            if (cum + r.pax > fillLine && /^b2c_/.test(r.id) && r.status === 'confirmed') toFlag.push(r.id);
            cum += r.pax;
          }
        }
        if (toFlag.length) {
          const fr = await client.query(
            `UPDATE ${fqt('sb_bookings')} SET status='pending_approval' WHERE id = ANY($1) AND status='confirmed'`, [toFlag]);
          console.log(`[b2c-sync] oversell — flagged ${fr.rowCount} B2C booking(s) pending_approval across ${affPairs.length} route/date(s)`);
        }
      }

      // NOTE: history, upgrades, feeitems, partialcancels, adjustments, over are allotment-owned — never touched here.

      await client.query('COMMIT');
      const label = singleExtId ? `b2c_${singleExtId}` : `${b2cBks.length} bookings`;
      console.log(`[b2c-sync] synced ${label}`);
      if (srcHash) {
        await pool.query(`INSERT INTO app_state(id,data,version) VALUES('b2c_sync_hash',$1,0)
                          ON CONFLICT(id) DO UPDATE SET data=$1, updated_at=now()`, [srcHash]);
        const vr = await pool.query('SELECT version FROM app_state WHERE id=$1', [STATE_KEY]);
        const nv = (vr.rows[0] ? vr.rows[0].version : 0) + 1;
        await pool.query(`INSERT INTO app_state(id,data,version,updated_by,updated_at) VALUES($1,NULL,$2,$3,now())
                          ON CONFLICT(id) DO UPDATE SET version=$2, updated_by=$3, updated_at=now()`, [STATE_KEY, nv, 'B2C']);
        sseBroadcast({ version: nv, updated_by: 'B2C', source: 'b2c' });
      }
    } catch (e) {
      await client.query('ROLLBACK');
      throw Object.assign(e, { _phase });
    } finally {
      client.release();
    }
  } catch (e) {
    console.error(`[b2c-sync] failed at "${e._phase || 'fetch'}" — ${e.message}`);
    // Non-fatal: relLoad proceeds even if sync fails
  }
}
// read-modify-write the whole schema in ONE transaction, serialized by an advisory lock (no lost saves).
// ponytail: full DELETE+INSERT of all tables per save; fine at this data size, switch to targeted upserts if slow.
async function relApplyAndSave(payload, username, base) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(918273645)');
    const vr = await client.query('SELECT version FROM app_state WHERE id=$1', [STATE_KEY]);
    const curVer = vr.rows[0] ? vr.rows[0].version : 0;
    const behind = (base !== -1 && base < curVer);
    const data = {};
    for (const t of OS_TABLES) { const r = await client.query(`SELECT * FROM ${fqt(t)}`); data[t] = r.rows; }
    let blob = osRepo.assembleBlob(data);
    if (payload.full && typeof payload.full === 'string') blob = JSON.parse(payload.full);
    else applyDiff(blob, payload.diff || {});
    const tables = osRepo.decomposeBlob(blob);
    if (!payload.confirm) {                                            // save-safety: refuse a stale/whole-blob overwrite that would wipe existing data
      const curCount = {}, incCount = {};
      for (const t of OS_TOP) { curCount[t] = (data[t] || []).length; incCount[t] = (tables[t] || []).length; }
      const bad = shrinkGuard(curCount, incCount);
      if (bad.length) throw shrinkErr(bad);                            // rolled back by the catch below · handler returns 409
    }
    for (const t of OS_DESC) await client.query(`DELETE FROM ${fqt(t)}`);
    for (const t of OS_ASC) {                                        // batched multi-row insert (fast: ~1-2 queries/table)
      const rows = tables[t] || []; if (!rows.length) continue;
      const cols = OS_COLS[t]; const colSql = cols.map(qic).join(',');
      const perChunk = Math.max(1, Math.floor(60000 / cols.length));  // stay under the 65535 bound-param limit
      for (let i = 0; i < rows.length; i += perChunk) {
        const params = [], tuples = [];
        for (const row of rows.slice(i, i + perChunk)) {
          tuples.push('(' + cols.map(c => { params.push(_bindVal(t, c, row)); return '$' + params.length; }).join(',') + ')');
        }
        await client.query(`INSERT INTO ${fqt(t)} (${colSql}) VALUES ${tuples.join(',')}`, params);
      }
    }
    const nv = curVer + 1;
    await client.query('INSERT INTO app_state(id,data,version,updated_by,updated_at) VALUES($1,NULL,$2,$3,now()) ON CONFLICT(id) DO UPDATE SET version=$2, updated_by=$3, updated_at=now()', [STATE_KEY, nv, username]);
    await client.query('COMMIT');
    return { version: nv, behind };
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

let pool = null, dbReady = false;
if (Pool && DB_URL) {
  pool = new Pool({ connectionString: DB_URL, ssl: (DB_URL.includes('rlwy')||DB_URL.includes('railway')||process.env.PGSSL) ? { rejectUnauthorized:false } : false });
  pool.on('error', e => console.error('[db] idle client error (ignored):', e.message));   // a dropped idle connection must not crash the process
  initDb();
} else {
  console.warn('[db] no DATABASE_URL — login & sync disabled');
}
const B2C_DB_URL = process.env.B2C_DB_URL || '';
let b2cPool = null;
if (Pool && B2C_DB_URL) {
  b2cPool = new Pool({ connectionString: B2C_DB_URL, ssl: /railway|rlwy/.test(B2C_DB_URL) ? { rejectUnauthorized: false } : false, max: 3 });
  b2cPool.on('error', e => console.error('[b2c] idle client error:', e.message));
  console.log('[b2c] pool ready');
}

// LISTEN/NOTIFY listener — receives instant push from B2C DB when a booking changes.
// Uses a dedicated persistent pg.Client (not the pool) as required by LISTEN.
// Auto-reconnects on disconnect (Railway restarts, network blips).
function startB2CListener() {
  if (!PgClient || !B2C_DB_URL) return;
  const ssl = /railway|rlwy/.test(B2C_DB_URL) ? { rejectUnauthorized: false } : false;
  function connect() {
    const client = new PgClient({ connectionString: B2C_DB_URL, ssl });
    client.connect()
      .then(() => client.query('LISTEN booking_changed'))
      .then(() => {
        console.log('[b2c-listen] listening for booking_changed');
        client.on('notification', async (msg) => {
          const extId = msg.payload;
          console.log('[b2c-listen] booking changed:', extId);
          try {
            await relSyncB2C(extId);
            // Bump version so all logged-in clients refresh via SSE
            const vr = await pool.query('SELECT version FROM app_state WHERE id=$1', [STATE_KEY]);
            const nv = (vr.rows[0] ? vr.rows[0].version : 0) + 1;
            await pool.query(
              'INSERT INTO app_state(id,data,version,updated_by,updated_at) VALUES($1,NULL,$2,$3,now()) ON CONFLICT(id) DO UPDATE SET version=$2, updated_by=$3, updated_at=now()',
              [STATE_KEY, nv, 'B2C']
            );
            sseBroadcast({ version: nv, updated_by: 'B2C', source: 'b2c' });
          } catch(e) { console.error('[b2c-listen] sync error:', e.message); }
        });
        client.on('error', e => { console.error('[b2c-listen] error:', e.message); client.end().catch(()=>{}); });
        client.on('end', () => { console.warn('[b2c-listen] disconnected — reconnecting in 5s'); setTimeout(connect, 5000); });
      })
      .catch(e => { console.error('[b2c-listen] connect failed:', e.message); setTimeout(connect, 5000); });
  }
  connect();
}
async function initDb(){
  let _step = 'start';
  const sq = async (label, q, ...args) => { _step = label; await pool.query(q, ...args); };
  try{
    if(DATA_BACKEND === 'relational') await sq('create schema', `CREATE SCHEMA IF NOT EXISTS ${OS_SCHEMA}`);
    await sq('create users table', `CREATE TABLE IF NOT EXISTS ${USERS_T} (id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL, pass_hash TEXT NOT NULL, name TEXT, role TEXT DEFAULT 'staff', created_at TIMESTAMPTZ DEFAULT now())`);
    await sq('create app_state', "CREATE TABLE IF NOT EXISTS app_state (id TEXT PRIMARY KEY, data TEXT, version INT DEFAULT 0, updated_by TEXT, updated_at TIMESTAMPTZ DEFAULT now())");
    await sq('app_state.version col', "ALTER TABLE app_state ADD COLUMN IF NOT EXISTS version INT DEFAULT 0");
    await sq('app_state.updated_by col', "ALTER TABLE app_state ADD COLUMN IF NOT EXISTS updated_by TEXT");
    await sq('users.perms col', `ALTER TABLE ${USERS_T} ADD COLUMN IF NOT EXISTS perms TEXT`);
    await sq('users.can_edit col', `ALTER TABLE ${USERS_T} ADD COLUMN IF NOT EXISTS can_edit BOOLEAN DEFAULT true`);
    await sq('users.edit_areas col', `ALTER TABLE ${USERS_T} ADD COLUMN IF NOT EXISTS edit_areas TEXT`);
    await sq('users.dept col', `ALTER TABLE ${USERS_T} ADD COLUMN IF NOT EXISTS dept TEXT`);
    await sq('users.sales_id col', `ALTER TABLE ${USERS_T} ADD COLUMN IF NOT EXISTS sales_id TEXT`);
    // §sort (2026-07-11): top-level lists had NO ordering column — os_repo only preserves order for CHILD
    // tables (via idx), so a drag-reorder of the markets / routes list never survived a reload. `sort` is a
    // plain scalar in the mapping, so decompose/assemble carry it with zero changes to os_repo, and the
    // client diff sees it as an ordinary changed field (→ patch ops). Additive: existing rows get NULL.
    if(DATA_BACKEND === 'relational'){
      await sq('sb_markets.sort col', `ALTER TABLE ${OS_SCHEMA}."sb_markets" ADD COLUMN IF NOT EXISTS "sort" bigint`);
      await sq('routes.sort col',     `ALTER TABLE ${OS_SCHEMA}."routes"     ADD COLUMN IF NOT EXISTS "sort" bigint`);
      await sq('sb_agents.companyinfo_taxid col', `ALTER TABLE ${OS_SCHEMA}."sb_agents" ADD COLUMN IF NOT EXISTS "companyinfo_taxid" text`);
      const _tripOps = [['ops_boatid','text'],['ops_vanid','text'],['ops_vanreturnid','text'],
                        ['ops_returnsamevan','boolean'],['ops_vangroup','bigint'],['ops_vanseq','bigint'],
                        ['ops_pickuptimefinal','text'],['ops_vansplits','text'],['ops_reconfirm','text']];
      for(const [c,t] of _tripOps){
        await sq(`sb_bookings__trips.${c} col`, `ALTER TABLE ${OS_SCHEMA}."sb_bookings__trips" ADD COLUMN IF NOT EXISTS "${c}" ${t}`);
      }
      await sq('sb_rate_types.pricetiers col', `ALTER TABLE ${OS_SCHEMA}."sb_rate_types" ADD COLUMN IF NOT EXISTS "pricetiers" text`);
      // §per-rate-type nationality scope (2026-07-18, from lk-inbox): both | thai | fr — filters price columns, contract, and booking pax fields. NULL/absent → 'both' on the client.
      await sq('sb_rate_types.nationalityscope col', `ALTER TABLE ${OS_SCHEMA}."sb_rate_types" ADD COLUMN IF NOT EXISTS "nationalityscope" text`);
      // §per-rate-type owner (2026-07-22): sales id that "owns" the rate type · '' = Shared/central (visible to all).
      // Without this column the owner field never reached Postgres → reverted to Shared on every reload.
      await sq('sb_rate_types.owner col', `ALTER TABLE ${OS_SCHEMA}."sb_rate_types" ADD COLUMN IF NOT EXISTS "owner" text`);
      await sq('sb_sales.targets col', `ALTER TABLE ${OS_SCHEMA}."sb_sales" ADD COLUMN IF NOT EXISTS "targets" text`);
      await sq('sb_sales.followup col', `ALTER TABLE ${OS_SCHEMA}."sb_sales" ADD COLUMN IF NOT EXISTS "followup" text`);
      await sq('contract_templates table', `CREATE TABLE IF NOT EXISTS ${OS_SCHEMA}."contract_templates" (id text PRIMARY KEY, key text, value text)`);
      await sq('sb_agents.contracttemplateid col', `ALTER TABLE ${OS_SCHEMA}."sb_agents" ADD COLUMN IF NOT EXISTS "contracttemplateid" text`);
      // §Rate/Contract model (2026-07-23 · Phase 1): multiple contracts per agent (main + time-boxed promo
      // overlays). No auto-create for osModel entity tables → create explicitly here. Client store = SB_CONTRACTS.
      await sq('sb_contracts table', `CREATE TABLE IF NOT EXISTS ${OS_SCHEMA}."sb_contracts" (id text PRIMARY KEY, agentid text, kind text, ratetypeid text, activefrom text, activeto text, priority bigint, version text, status text, createddate text, createdby text, note text, docid text)`);
      await sq('sb_contracts__programperiods table', `CREATE TABLE IF NOT EXISTS ${OS_SCHEMA}."sb_contracts__programperiods" (sb_contracts_id text, idx bigint, row_pk text PRIMARY KEY, routeid text, bookfrom text, bookto text, travelfrom text, travelto text, note text)`);
      await sq('sb_contracts__programperiods index', `CREATE INDEX IF NOT EXISTS idx_sbcontracts_pp ON ${OS_SCHEMA}."sb_contracts__programperiods"(sb_contracts_id)`);
      await sq('sb_vehicles.color col', `ALTER TABLE ${OS_SCHEMA}."sb_vehicles" ADD COLUMN IF NOT EXISTS "color" text`);
      await sq('boats.color col', `ALTER TABLE ${OS_SCHEMA}."boats" ADD COLUMN IF NOT EXISTS "color" text`);
      await sq('sb_bookings pkey', `
        DO $do$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = '${OS_SCHEMA}.sb_bookings'::regclass AND contype IN ('p','u')
              AND array_length(conkey,1) = 1
              AND conkey[1] = (SELECT attnum FROM pg_attribute
                               WHERE attrelid='${OS_SCHEMA}.sb_bookings'::regclass AND attname='id')
          ) THEN
            ALTER TABLE ${OS_SCHEMA}."sb_bookings" ADD CONSTRAINT sb_bookings_pkey PRIMARY KEY (id);
          END IF;
        END $do$
      `);
    }
    await sq('create attachments table', "CREATE TABLE IF NOT EXISTS attachments (id TEXT PRIMARY KEY, booking_id TEXT, filename TEXT, mime TEXT, size INT, data BYTEA, uploaded_by TEXT, created_at TIMESTAMPTZ DEFAULT now())");
    await sq('attachments index', "CREATE INDEX IF NOT EXISTS idx_attach_booking ON attachments(booking_id)");
    _step = 'seed admin';
    const c = await pool.query(`SELECT count(*)::int n FROM ${USERS_T}`);
    if (c.rows[0].n === 0 && ADMIN_USER && ADMIN_PASS) {
      await pool.query(`INSERT INTO ${USERS_T}(username,pass_hash,name,role) VALUES($1,$2,$3,$4)`, [ADMIN_USER, hashPw(ADMIN_PASS), 'Admin', 'admin']);
      console.log('[db] seeded admin user:', ADMIN_USER);
    }
    dbReady = true; console.log('[db] ready');
    startB2CListener();
  }catch(e){ console.error(`[db] init failed at step "${_step}": ${e.message}`); }
}

// dept: short free-text department key used only for UI grouping · null = auto-guess from username
function cleanDept(d){ d=(d==null?'':String(d)).trim(); return d ? d.slice(0,40) : null; }
function cleanSalesId(s){ s=(s==null?'':String(s)).trim(); return s ? s.slice(0,40) : null; }   // §user→sales · SB_SALES id or null
// ── perms helpers (per-user area access · null/invalid = all areas) ──
function parsePerms(v){ if(v==null) return null; try{ const a=JSON.parse(v); return Array.isArray(a)?a:null; }catch(e){ return null; } }
const PERM_KEYS=new Set(['overview','operations','sales','accounting','fleet','config',  // group keys (back-compat)
  // §2026-07-13: 'reconfirm' and 'bookingflow' were missing here AND from LA_NAV on the client, so the two
  // pages were outside the permission system entirely — laAllowed() lets an unknown view through, meaning
  // every user could open them regardless of their ticks. Adding them to the client alone is not enough:
  // cleanPerms() filters against this Set, so an admin ticking "Booking Flow" would have had the tick
  // silently dropped on save and the box would come back empty.
  'dashboard','calendar','daily','booking','reconfirm','bookingflow','doccheck','operation','insurance','vehicles','vanjobs','pickup-setup',
  'agents','sales-board','rate-types','contract-tmpl','b2c','staff','marketdata','focdetail','pickupmap','dailypfm',
  'fl-dashboard','fl-boatstatus','fl-dailyreport','fl-incident','fl-projects','fl-maintenance','fl-inventory','fl-consumables','fl-cost','fl-insights','fl-fuel','fl-asset',
  'settings','teammkt','addonsvc']);   // 'accounting' already present as a group key
function cleanPerms(a){ return Array.isArray(a)?a.filter(x=>PERM_KEYS.has(x)):null; }
const AREA_KEYS=new Set(['overview','operations','sales','accounting','fleet','config']);
function cleanAreas(a){ return Array.isArray(a)?a.filter(x=>AREA_KEYS.has(x)):null; }
// A user's editable-areas + "can edit anything" flag · editAreas null → falls back to legacy can_edit
function editInfo(usr){ const ea=parsePerms(usr.edit_areas); const arr=Array.isArray(ea)?ea.filter(x=>AREA_KEYS.has(x)):null; const any = arr ? arr.length>0 : (usr.can_edit!==false); return {editAreas:arr, canEditAny:any}; }

// ── password hashing (scrypt) ──
function hashPw(pw){ const salt = crypto.randomBytes(16).toString('hex'); const h = crypto.scryptSync(String(pw), salt, 32).toString('hex'); return salt+':'+h; }
function verifyPw(pw, stored){ try{ const [salt,h] = String(stored).split(':'); const c = crypto.scryptSync(String(pw), salt, 32).toString('hex'); return crypto.timingSafeEqual(Buffer.from(h,'hex'), Buffer.from(c,'hex')); }catch(e){ return false; } }

// ── signed session cookie ──
function sign(payloadObj){ const p = Buffer.from(JSON.stringify(payloadObj)).toString('base64url'); const sig = crypto.createHmac('sha256', SECRET).update(p).digest('base64url'); return p+'.'+sig; }
function verify(token){ try{ const [p,sig] = String(token).split('.'); const exp = crypto.createHmac('sha256', SECRET).update(p).digest('base64url'); if(!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(exp))) return null; const o = JSON.parse(Buffer.from(p,'base64url').toString()); if(o.exp && Date.now() > o.exp) return null; return o; }catch(e){ return null; } }
function cookies(req){ const h = req.headers.cookie||''; const o={}; h.split(';').forEach(s=>{ const i=s.indexOf('='); if(i>0) o[s.slice(0,i).trim()] = decodeURIComponent(s.slice(i+1).trim()); }); return o; }
function session(req){ return verify(cookies(req).sess||''); }
// Daily session reset (2026-07-08): sessions expire at the next 03:00 ICT so every user re-logs in each morning → fresh data on login.
const ICT_OFFSET_MS = 7*3600e3, DAILY_RESET_HOUR = 3;
function nextDailyExpiry(){ const nowIct = Date.now()+ICT_OFFSET_MS; const d = new Date(nowIct); d.setUTCHours(DAILY_RESET_HOUR,0,0,0); let exp = d.getTime(); if(exp <= nowIct) exp += 864e5; return exp - ICT_OFFSET_MS; }

const MIME = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.svg':'image/svg+xml','.ico':'image/x-icon','.webp':'image/webp','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','.csv':'text/csv; charset=utf-8','.txt':'text/plain; charset=utf-8' };
// §static gzip (2026-07-18): compress text assets (HTML/JS/CSS/JSON/SVG/CSV/TXT) — the ~5MB app file was sent
// raw on every load / after each deploy. gzip cuts it ~5x. Buffer cached per (path,etag) so it compresses once,
// not on every request. Images/fonts (.png/.woff2/…) are already compressed → skipped.
const GZIP_EXT = new Set(['.html','.js','.css','.json','.svg','.csv','.txt']);
const _gzCache = new Map();   // fp -> { etag, buf }
// §/api/load cache (perf): assembling the ~6MB blob from 103 tables + stringify + gzip on EVERY login was the
// bottleneck (morning stampede: all users re-login at 03:00 reset → server rebuilds the same payload N times).
// Cache the built payload (plain string + gzipped buffer) keyed by app_state.version. A cheap version query gates
// each request; any write bumps version → next load rebuilds. Cache hit = serve the prebuilt buffer instantly.
let _loadCache = null;   // { version, str, gz }
function readBody(req, cb){ let ch=[], n=0; req.on('data',c=>{ n+=c.length; if(n>20*1024*1024){req.destroy();return;} ch.push(c); }); req.on('end',()=>cb(Buffer.concat(ch).toString('utf8'))); }
function J(res, code, obj, extra){ const h=Object.assign({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}, extra||{}); res.writeHead(code,h); res.end(JSON.stringify(obj)); }
// gzip variant for large payloads (/api/load) — falls back to plain when the client doesn't accept gzip
function JZ(req, res, code, obj){
  const body = JSON.stringify(obj);
  if (body.length > 50*1024 && /\bgzip\b/.test(req.headers['accept-encoding']||'')){
    const zlib = require('zlib');
    return zlib.gzip(body, (err, buf)=>{
      if (err){ res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(body); }
      res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Content-Encoding':'gzip','Cache-Control':'no-store'});
      res.end(buf);
    });
  }
  res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(body);
}
// Send a cached /api/load payload · gzip on first send then reuse the buffer (so a version's payload is gzipped once)
function sendLoadPayload(req, res, cache){
  const acceptsGz = /\bgzip\b/.test(req.headers['accept-encoding']||'');
  if(acceptsGz){
    if(cache.gz){ res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Content-Encoding':'gzip'}); return res.end(cache.gz); }
    const zlib = require('zlib');
    return zlib.gzip(cache.str, (err,buf)=>{
      if(err){ res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'}); return res.end(cache.str); }
      cache.gz = buf;   // remember the gzipped buffer → every later hit on this version is instant
      res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Content-Encoding':'gzip'});
      res.end(buf);
    });
  }
  res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});
  res.end(cache.str);
}
// ── Server-Sent Events · push "data changed" to all open clients instantly (real-time) ──
const sseClients = new Set();
function sseBroadcast(obj){ const msg='data: '+JSON.stringify(obj)+'\n\n'; sseClients.forEach(r=>{ try{ r.write(msg); }catch(e){ sseClients.delete(r); } }); }
// Deep-merge a plain-object patch onto target · patch={p:{key:{v:val}|{m:subdiff}}, d:[deletedKeys]}
function applyObj(target, diff){
  const p=(diff&&diff.p)||{}, d=(diff&&diff.d)||[];
  Object.keys(p).forEach(k=>{ const e=p[k]||{};
    if('v' in e) target[k]=e.v;
    else if('m' in e){ if(!target[k]||typeof target[k]!=='object'||Array.isArray(target[k])) target[k]={}; applyObj(target[k], e.m); } });
  d.forEach(k=>{ delete target[k]; });
}
// Merge a client diff onto the server blob (concurrent-safe per record + per object sub-key).
// diff = { sets:{key:value|null}, cols:{key:{idf,up,del}}, objs:{key:{p,d}} }
function applyDiff(blob, diff){
  const sets = (diff && diff.sets) || {}, cols = (diff && diff.cols) || {}, objs = (diff && diff.objs) || {};
  Object.keys(sets).forEach(k=>{ const v=sets[k]; if(v===null) delete blob[k]; else blob[k]=v; });
  Object.keys(objs).forEach(k=>{ if(!blob[k]||typeof blob[k]!=='object'||Array.isArray(blob[k])) blob[k]={}; applyObj(blob[k], objs[k]); });
  Object.keys(cols).forEach(k=>{ const c=cols[k]||{}; const idf=c.idf||'id';
    const arr = Array.isArray(blob[k]) ? blob[k] : [];
    const map = new Map(); let n=0;
    arr.forEach(x=>{ if(x && x[idf]!=null) map.set(String(x[idf]), x); else map.set('__noid_'+(n++), x); });
    (c.up||[]).forEach(rec=>{ if(rec && rec[idf]!=null) map.set(String(rec[idf]), rec); });   // full insert/replace (new records)
    (c.patch||[]).forEach(pr=>{ if(pr && pr.id!=null){ const id=String(pr.id); const tgt=map.get(id);   // per-field merge onto server's CURRENT record → concurrent edits to different fields both survive
      if(tgt && typeof tgt==='object' && !Array.isArray(tgt)) applyObj(tgt, pr.m||{});
      else if(pr.full!=null) map.set(id, pr.full); } });
    (c.del||[]).forEach(id=>{ map.delete(String(id)); });
    blob[k] = Array.from(map.values());
  });
}

// ═══════════════ Per-entity REST API (v1) over operation_schemas ═══════════════
// Generic CRUD for every top-level entity, driven by the os_repo PLAN. One record (+ its nested
// children) per request via the same assemble/decompose engine, scoped to that entity's subtree.
// Requires DATA_BACKEND=relational (operation_schemas is the store). Auth = session, writes = edit right.
const REST_PLAN = osRepo._plan, REST_KIDS = osRepo._children;
const REST_RES = {};                       // resourceName (appKey) -> { table, pkCol, container }
for (const [t, pl] of Object.entries(REST_PLAN)) {
  if (!pl.isChild && (pl.container === 'array' || pl.container === 'map') && pl.appKey)
    REST_RES[pl.appKey] = { table: t, pkCol: pl.pkCol || pl.keyCol, container: pl.container };
}
function restDescendants(table){ const out = []; (function rec(t){ for (const c of (REST_KIDS[t]||[])){ out.push(c); rec(c); } })(table); return out; }
// scoped load: parent rows (all, or one id) + every descendant child row linked by the FK chain
// db = pool (default) or an open transaction client (patch reads must see earlier ops in the same txn)
async function restLoad(table, id, db){
  db = db || pool;
  const pl = REST_PLAN[table], pkc = pl.pkCol || pl.keyCol, data = {};
  const pr = id == null ? await db.query(`SELECT * FROM ${fqt(table)}`)
                        : await db.query(`SELECT * FROM ${fqt(table)} WHERE ${qic(pkc)}=$1`, [id]);
  data[table] = pr.rows;
  async function kids(t, pkvals){
    if (!pkvals.length) return;
    for (const c of (REST_KIDS[t]||[])){
      const cp = REST_PLAN[c];
      const r = await db.query(`SELECT * FROM ${fqt(c)} WHERE ${qic(cp.fkCol)} = ANY($1)`, [pkvals]);
      data[c] = (data[c]||[]).concat(r.rows);
      await kids(c, r.rows.map(x => x[cp.rowPkCol != null ? cp.rowPkCol : cp.pkCol]).filter(v => v != null));
    }
  }
  await kids(table, data[table].map(r => r[pkc]).filter(v => v != null));
  return data;
}
async function restGet(res, resName, id){
  const R = REST_RES[resName]; if (!R) return J(res, 404, { error: 'unknown resource: ' + resName });
  const { table, container } = R, appKey = REST_PLAN[table].appKey;
  const blob = osRepo.assembleBlob(await restLoad(table, id));
  const val = blob[appKey];
  if (id == null) return J(res, 200, { [resName]: val === undefined ? (container === 'map' ? {} : []) : val });
  const rec = container === 'array' ? (Array.isArray(val) ? val.find(x => x && String(x.id) === String(id)) : null) : (val ? val[id] : null);
  return rec !== undefined && rec !== null ? J(res, 200, rec) : J(res, 404, { error: 'not found' });
}
async function _restInsertRows(client, tables, rows){          // parents first, batched multi-row
  for (const t of tables){
    const rws = rows[t] || []; if (!rws.length) continue;
    const cols = OS_COLS[t], colSql = cols.map(qic).join(','), per = Math.max(1, Math.floor(60000 / cols.length));
    for (let i = 0; i < rws.length; i += per){
      const params = [], tuples = [];
      for (const row of rws.slice(i, i + per)) tuples.push('(' + cols.map(c => { params.push(_bindVal(t, c, row)); return '$' + params.length; }).join(',') + ')');
      await client.query(`INSERT INTO ${fqt(t)} (${colSql}) VALUES ${tuples.join(',')}`, params);
    }
  }
}
// Apply ONE write op inside an open transaction. Ops:
//   {op:'put',    r, id, body}  replace/create one record (nested children re-inserted; map value may be any JSON)
//   {op:'patch',  r, id, body:{m,full}}  per-FIELD merge onto the record's CURRENT server state (m = deep diff
//                               {p,d} · applyObj) — two users editing different fields of the same record both
//                               survive. Record missing / not an object → falls back to body.full (full replace).
//   {op:'del',    r, id}        delete one record (children cascade)
//   {op:'putall', r, body}      replace the whole collection (id-less wholesale sets · body null/[]/{}= clear)
//   {op:'meta',   id, body}     upsert one top-level scalar in app_meta (body null = delete the key)
async function restApplyOp(client, op){
  if (op.op === 'meta'){
    await client.query(`DELETE FROM ${fqt('app_meta')} WHERE ${qic('key')}=$1`, [op.id]);
    if (op.body !== null && op.body !== undefined)
      await client.query(`INSERT INTO ${fqt('app_meta')} (${qic('key')},${qic('value')}) VALUES ($1,$2)`, [op.id, JSON.stringify(op.body)]);
    return op.id;
  }
  const R = REST_RES[op.r]; if (!R) throw new Error('unknown resource: ' + op.r);
  const { table, pkCol, container } = R, appKey = REST_PLAN[table].appKey;
  const subtree = [table, ...restDescendants(table)].sort((a, b) => _osDepth(a) - _osDepth(b));
  if (op.op === 'del'){ await client.query(`DELETE FROM ${fqt(table)} WHERE ${qic(pkCol)}=$1`, [op.id]); return op.id; }
  if (op.op === 'patch'){
    if (op.id == null) throw new Error(op.r + ': patch needs an id');
    const b = op.body || {};
    const blob = osRepo.assembleBlob(await restLoad(table, op.id, client));
    const val = blob[appKey];
    const cur = container === 'array' ? (Array.isArray(val) ? val.find(x => x && String(x.id) === String(op.id)) : null)
                                      : (val ? val[op.id] : null);
    let merged;
    if (cur && typeof cur === 'object' && !Array.isArray(cur)) { applyObj(cur, b.m || {}); merged = cur; }
    else if (b.full !== undefined && b.full !== null) merged = b.full;      // record gone / not an object → full replace
    else throw new Error(op.r + '/' + op.id + ': patch target not found (no full fallback)');
    return restApplyOp(client, { op: 'put', r: op.r, id: op.id, body: merged });
  }
  if (op.op === 'putall'){
    if (!op.confirm && OS_TOP.indexOf(table) >= 0){                      // save-safety: refuse wiping an existing collection wholesale
      const curN = (await client.query(`SELECT count(*)::int n FROM ${fqt(table)}`)).rows[0].n;
      let incN = 0; if (op.body != null){ const rr = osRepo.decomposeBlob({ [appKey]: op.body }); incN = (rr[table] || []).length; }
      const bad = shrinkGuard({ [table]: curN }, { [table]: incN });
      if (bad.length) throw shrinkErr(bad);
    }
    await client.query(`DELETE FROM ${fqt(table)}`);                     // children cascade
    if (op.body == null) return op.r;
    const rows = osRepo.decomposeBlob({ [appKey]: op.body });
    await _restInsertRows(client, subtree, rows);
    return op.r;
  }
  // put — single record
  let body = op.body;
  if (container === 'array'){
    if (body == null || typeof body !== 'object' || Array.isArray(body)) throw new Error(op.r + ': body must be a record object');
    if (op.id != null) body.id = op.id;
    if (body.id == null) throw new Error(op.r + ': record needs an id');
  } else if (op.id == null) throw new Error(op.r + ': map resource needs an id');
  const recKey = container === 'array' ? body.id : op.id;
  const rows = osRepo.decomposeBlob({ [appKey]: container === 'array' ? [body] : { [recKey]: body } });
  await client.query(`DELETE FROM ${fqt(table)} WHERE ${qic(pkCol)}=$1`, [recKey]);   // replace (children cascade)
  await _restInsertRows(client, subtree, rows);
  return recKey;
}
// Run a batch of ops in ONE transaction (serialized with the legacy save path via the same advisory
// lock), bump the app_state version once, return {version, behind} — same contract as /api/save.
async function restTxn(username, baseVersion, ops){
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(918273645)');
    const vr = await client.query('SELECT version FROM app_state WHERE id=$1', [STATE_KEY]);
    const curVer = vr.rows[0] ? vr.rows[0].version : 0;
    const behind = (baseVersion !== -1 && baseVersion != null && baseVersion < curVer);
    const applied = [];
    for (const op of ops) applied.push(await restApplyOp(client, op));
    const nv = curVer + 1;
    await client.query('INSERT INTO app_state(id,data,version,updated_by,updated_at) VALUES($1,NULL,$2,$3,now()) ON CONFLICT(id) DO UPDATE SET version=$2, updated_by=$3, updated_at=now()', [STATE_KEY, nv, username]);
    await client.query('COMMIT');
    return { version: nv, behind, applied };
  } catch (e){ await client.query('ROLLBACK').catch(()=>{}); throw e; } finally { client.release(); }
}

const server = http.createServer((req, res) => {
  const u = (req.url||'/').split('?')[0];
  const q = (req.url||'').split('?')[1]||'';

  // ───── AUTH ─────
  if(u === '/api/login' && req.method === 'POST'){
    if(!pool) return J(res,503,{error:'no database'});
    readBody(req, body => {
      let b={}; try{ b=JSON.parse(body); }catch(e){}
      pool.query(`SELECT * FROM ${USERS_T} WHERE lower(username)=lower($1)`, [String(b.username||'').trim()])
        .then(r => { const usr=r.rows[0];
          if(!usr || !verifyPw(b.password||'', usr.pass_hash)) return J(res,401,{error:'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'});
          const perms = parsePerms(usr.perms); const ei = editInfo(usr);
          const EXP = Date.now() + SESS_DAYS*864e5;   // §102 REVERTED 2026-07-10: back to 30-day session. The daily 03:00 re-login forced every client to reload each morning, which is what fired the latent loadData version-mismatch reseed. nextDailyExpiry() kept for reference (unused).
          const tok = sign({uid:usr.id, username:usr.username, name:usr.name, role:usr.role, perms:perms, edit:ei.canEditAny, editAreas:ei.editAreas, salesId:usr.sales_id||null, exp:EXP});
          J(res,200,{username:usr.username,name:usr.name,role:usr.role,perms:perms,canEdit:ei.canEditAny,editAreas:ei.editAreas,salesId:usr.sales_id||null}, {'Set-Cookie':`sess=${tok}; HttpOnly; Path=/; SameSite=Lax; Secure; Max-Age=${Math.max(60,Math.floor((EXP-Date.now())/1000))}`});
        }).catch(e=>J(res,500,{error:e.message}));
    }); return;
  }
  if(u === '/api/logout'){ J(res,200,{ok:true},{'Set-Cookie':'sess=; HttpOnly; Path=/; Max-Age=0'}); return; }
  if(u === '/api/me'){ const s=session(req); return s ? J(res,200,{username:s.username,name:s.name,role:s.role,perms:(s.perms!==undefined?s.perms:null),canEdit:(s.edit!==false),editAreas:(s.editAreas!==undefined?s.editAreas:null),salesId:(s.salesId!==undefined?s.salesId:null)}) : J(res,401,{error:'not logged in'}); }

  // ───── DATA (require login) ─────
  if(u === '/api/load'){
    const s=session(req); if(!s) return J(res,401,{error:'login required'});
    if(!pool) return J(res,503,{error:'no database'});
    if(DATA_BACKEND==='relational'){
      relSyncB2C()
        .then(() => pool.query('SELECT version,updated_by,updated_at FROM app_state WHERE id=$1',[STATE_KEY]))
        .then(async r => {
          const m = r.rows[0]||{}; const version = m.version||0;
          if(_loadCache && _loadCache.version === version){ return sendLoadPayload(req,res,_loadCache); }
          const blob = await relLoad();
          const str = JSON.stringify({data:JSON.stringify(blob),version,updated_by:m.updated_by,updated_at:m.updated_at});
          _loadCache = { version, str, gz:null };
          return sendLoadPayload(req,res,_loadCache);
        })
        .catch(e=>J(res,500,{error:e.message}));
      return;
    }
    pool.query('SELECT data,version,updated_by,updated_at FROM app_state WHERE id=$1',[STATE_KEY])
      .then(r => r.rows[0] ? JZ(req,res,200,{data:r.rows[0].data,version:r.rows[0].version,updated_by:r.rows[0].updated_by,updated_at:r.rows[0].updated_at})
                           : J(res,200,{data:null,version:0}))
      .catch(e=>J(res,500,{error:e.message}));
    return;
  }
  // Hard-reset the B2C-synced bookings: wipe every b2c_ row (+ child tables) then full re-sync.
  // Session-authed + POST-only (so accidental navigation can't trigger it). Ops on b2c bookings
  // are intentionally discarded — B2C is the source of truth for these records.
  if(u === '/api/b2c/reset' && req.method === 'POST'){
    const s=session(req); if(!s) return J(res,401,{error:'login required'});
    if(!pool) return J(res,503,{error:'no database'});
    if(DATA_BACKEND!=='relational' || !b2cPool) return J(res,400,{error:'B2C sync not configured'});
    (async () => {
      const CHILD = ['sb_bookings__trips','sb_bookings__passengers','sb_bookings__addons',
        'sb_bookings__adjustments','sb_bookings__feeitems','sb_bookings__history',
        'sb_bookings__over','sb_bookings__partialcancels','sb_bookings__upgrades'];
      const client = await pool.connect();
      let deleted = 0;
      try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(918273645)');
        for (const t of CHILD) {
          await client.query(`DELETE FROM ${fqt(t)} WHERE substr(sb_bookings_id,1,4) = 'b2c_'`);
        }
        const r = await client.query(`DELETE FROM ${fqt('sb_bookings')} WHERE substr(id,1,4) = 'b2c_'`);
        deleted = r.rowCount || 0;
        await client.query('COMMIT');
      } catch(e){ await client.query('ROLLBACK').catch(()=>{}); client.release(); return J(res,500,{error:'delete failed: '+e.message}); }
      client.release();
      try { await relSyncB2C(); } catch(e){ return J(res,500,{error:`deleted ${deleted} rows but re-sync failed: ${e.message}`}); }
      let nv = 0;
      try {
        const vr = await pool.query('SELECT version FROM app_state WHERE id=$1',[STATE_KEY]);
        nv = (vr.rows[0] ? vr.rows[0].version : 0) + 1;
        await pool.query('INSERT INTO app_state(id,data,version,updated_by,updated_at) VALUES($1,NULL,$2,$3,now()) ON CONFLICT(id) DO UPDATE SET version=$2, updated_by=$3, updated_at=now()',[STATE_KEY,nv,'B2C']);
        sseBroadcast({ version: nv, updated_by: 'B2C', source: 'b2c_reset' });
      } catch(e){ console.error('[b2c-reset] version bump failed:', e.message); }
      console.log(`[b2c-reset] wiped ${deleted} b2c bookings, re-synced, version=${nv}`);
      J(res,200,{ok:true, deleted, version:nv});
    })();
    return;
  }
  if(u === '/api/version'){
    const s=session(req); if(!s) return J(res,401,{error:'login required'}); if(!pool) return J(res,503,{error:'no database'});
    pool.query('SELECT version,updated_by,updated_at FROM app_state WHERE id=$1',[STATE_KEY])
      .then(r=>J(res,200, r.rows[0]?{version:r.rows[0].version,updated_by:r.rows[0].updated_by,updated_at:r.rows[0].updated_at}:{version:0}))
      .catch(e=>J(res,500,{error:e.message}));
    return;
  }
  if(u === '/api/events'){   // SSE stream · server pushes version-bump events → clients refresh instantly
    const s=session(req); if(!s){ res.writeHead(401); return res.end(); }
    res.writeHead(200, {'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
    res.write('retry: 5000\n\n');
    sseClients.add(res);
    const hb=setInterval(()=>{ try{ res.write(':hb\n\n'); }catch(e){} }, 25000);
    req.on('close', ()=>{ clearInterval(hb); sseClients.delete(res); });
    return;
  }
  if(u === '/api/save' && req.method === 'POST'){
    const s=session(req); if(!s) return J(res,401,{error:'login required'});
    if(s.role!=='admin' && s.edit===false) return J(res,403,{error:'view only · ไม่มีสิทธิ์แก้ไข'});   // read-only user cannot change cloud data
    if(!pool) return J(res,503,{error:'no database'});
    readBody(req, body => {
      let payload; try{ payload=JSON.parse(body); }catch(e){ return J(res,400,{error:'invalid JSON'}); }
      const base = (payload.baseVersion==null ? -1 : payload.baseVersion);
      if(DATA_BACKEND==='relational'){
        // visibility: normal saves go through /api/v1/_batch (per-entity). Landing here means the legacy
        // whole-blob rewrite path was used — seed, old client, or MAPPING DRIFT (a key /api/v1 doesn't know).
        try{ const d=payload.diff||{}; console.warn('[save] LEGACY whole-blob path · user='+s.username
          +(payload.full?' · FULL seed':' · diff sets=['+Object.keys(d.sets||{}).join(',')+'] cols=['+Object.keys(d.cols||{}).join(',')+'] objs=['+Object.keys(d.objs||{}).join(',')+']')
          +' — run os-backend/scripts/check_mapping_drift.js if this repeats'); }catch(e){}
        relApplyAndSave(payload, s.username, base)
          .then(({version,behind})=>{ J(res,200,{ok:true,version,behind}); sseBroadcast({version, updated_by:s.username}); })
          .catch(e=> e.code==='SHRINK_GUARD'
            ? J(res,409,{error:'save_would_delete_data', code:'SHRINK_GUARD', detail:e.detail})
            : J(res,500,{error:e.message}));
        return;
      }
      pool.query('SELECT data,version FROM app_state WHERE id=$1',[STATE_KEY]).then(r=>{
        const curVer = r.rows[0] ? r.rows[0].version : 0;
        let blob={}; if(r.rows[0] && r.rows[0].data){ try{ blob=JSON.parse(r.rows[0].data); }catch(e){ blob={}; } }
        const behind = (base !== -1 && base < curVer);   // others saved since this client loaded → recommend refresh
        if(payload.full && typeof payload.full==='string'){ try{ blob=JSON.parse(payload.full); }catch(e){ return J(res,400,{error:'bad full'}); } }   // seed/first push
        else { try{ applyDiff(blob, payload.diff||{}); }catch(e){ return J(res,400,{error:'bad diff: '+e.message}); } }
        const nv = curVer+1, out = JSON.stringify(blob);
        pool.query('INSERT INTO app_state(id,data,version,updated_by,updated_at) VALUES($1,$2,$3,$4,now()) ON CONFLICT(id) DO UPDATE SET data=excluded.data, version=$3, updated_by=$4, updated_at=now()',[STATE_KEY,out,nv,s.username])
          .then(()=>{ J(res,200,{ok:true,version:nv,behind:behind,bytes:out.length}); sseBroadcast({version:nv, updated_by:s.username}); }).catch(e=>J(res,500,{error:e.message}));
      }).catch(e=>J(res,500,{error:e.message}));
    }); return;
  }

  // ───── ATTACHMENTS (document files · stored server-side · booking keeps only a ref in the app blob) ─────
  if(u === '/api/attach' && req.method === 'POST'){   // upload one file (base64 JSON)
    const s=session(req); if(!s) return J(res,401,{error:'login required'});
    if(s.role!=='admin' && s.edit===false) return J(res,403,{error:'view only · ไม่มีสิทธิ์แนบไฟล์'});
    if(!pool) return J(res,503,{error:'no database'});
    readBody(req, body=>{
      let b={}; try{ b=JSON.parse(body); }catch(e){ return J(res,400,{error:'invalid JSON'}); }
      let buf=null; try{ buf=Buffer.from(String(b.dataB64||''),'base64'); }catch(e){ buf=null; }
      if(!buf || !buf.length) return J(res,400,{error:'no file data'});
      if(buf.length > 6*1024*1024) return J(res,413,{error:'ไฟล์ใหญ่เกิน 6MB'});
      const id = 'att_'+Date.now().toString(36)+'_'+crypto.randomBytes(5).toString('hex');
      const mime = String(b.mime||'application/octet-stream').slice(0,100);
      const fn   = String(b.filename||'file').slice(0,200);
      const bkId = String(b.bookingId||'').slice(0,80);
      pool.query('INSERT INTO attachments(id,booking_id,filename,mime,size,data,uploaded_by) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,bkId,fn,mime,buf.length,buf,s.username])
        .then(()=>J(res,200,{id:id,filename:fn,mime:mime,size:buf.length,uploaded_by:s.username})).catch(e=>J(res,500,{error:e.message}));
    }); return;
  }
  if(u === '/api/attach' && req.method === 'GET'){   // list metadata for a booking (?booking=<id>)
    const s=session(req); if(!s) return J(res,401,{error:'login required'}); if(!pool) return J(res,503,{error:'no database'});
    const bk=decodeURIComponent((q.match(/booking=([^&]*)/)||[])[1]||'');
    pool.query('SELECT id,filename,mime,size,uploaded_by,created_at FROM attachments WHERE booking_id=$1 ORDER BY created_at',[bk])
      .then(r=>J(res,200,{files:r.rows})).catch(e=>J(res,500,{error:e.message})); return;
  }
  if(u.startsWith('/api/attach/') && req.method === 'GET'){   // stream one file inline
    const s=session(req); if(!s){ res.writeHead(401); return res.end('login required'); } if(!pool){ res.writeHead(503); return res.end('no db'); }
    const id=decodeURIComponent(u.slice('/api/attach/'.length));
    pool.query('SELECT filename,mime,data FROM attachments WHERE id=$1',[id]).then(r=>{
      const row=r.rows[0]; if(!row){ res.writeHead(404); return res.end('not found'); }
      const buf = Buffer.isBuffer(row.data)?row.data:Buffer.from(row.data||'');
      res.writeHead(200,{'Content-Type':row.mime||'application/octet-stream','Content-Length':buf.length,'Content-Disposition':'inline; filename="'+encodeURIComponent(row.filename||'file')+'"','Cache-Control':'private, max-age=86400'});
      res.end(buf);
    }).catch(e=>{ res.writeHead(500); res.end(e.message); }); return;
  }
  if(u.startsWith('/api/attach/') && req.method === 'DELETE'){
    const s=session(req); if(!s) return J(res,401,{error:'login required'});
    if(s.role!=='admin' && s.edit===false) return J(res,403,{error:'view only'});
    if(!pool) return J(res,503,{error:'no database'});
    const id=decodeURIComponent(u.slice('/api/attach/'.length));
    pool.query('DELETE FROM attachments WHERE id=$1',[id]).then(()=>J(res,200,{ok:true})).catch(e=>J(res,500,{error:e.message})); return;
  }

  // ───── ADMIN: user management (admin only) ─────
  if(u === '/api/users'){
    const s=session(req); if(!s) return J(res,401,{error:'login required'}); if(s.role!=='admin') return J(res,403,{error:'admin only'});
    if(!pool) return J(res,503,{error:'no database'});
    if(req.method === 'GET'){ pool.query(`SELECT id,username,name,role,perms,can_edit,edit_areas,dept,sales_id,created_at FROM ${USERS_T} ORDER BY id`).then(r=>J(res,200,{users:r.rows.map(x=>{const ei=editInfo(x); return {id:x.id,username:x.username,name:x.name,role:x.role,perms:parsePerms(x.perms),canEdit:ei.canEditAny,editAreas:ei.editAreas,dept:x.dept||null,salesId:x.sales_id||null,created_at:x.created_at};})})).catch(e=>J(res,500,{error:e.message})); return; }
    if(req.method === 'POST'){ readBody(req, body=>{ let b={}; try{b=JSON.parse(body);}catch(e){} const un=String(b.username||'').trim(); if(!un||!b.password) return J(res,400,{error:'ต้องมี username + password'});
      const perms = cleanPerms(b.perms); const permsStr = perms ? JSON.stringify(perms) : null;
      const ea = cleanAreas(b.editAreas); const eaStr = ea ? JSON.stringify(ea) : null; const canEdit = ea ? ea.length>0 : (b.canEdit!==false);
      pool.query(`INSERT INTO ${USERS_T}(username,pass_hash,name,role,perms,can_edit,edit_areas,dept,sales_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[un,hashPw(b.password),(b.name||un),(b.role==='admin'?'admin':'staff'),permsStr,canEdit,eaStr,cleanDept(b.dept),cleanSalesId(b.salesId)])
        .then(()=>J(res,200,{ok:true})).catch(e=>J(res, e.code==='23505'?409:500, {error: e.code==='23505'?'username นี้มีอยู่แล้ว':e.message})); }); return; }
    if(req.method === 'DELETE'){ const id=parseInt((q.match(/id=(\d+)/)||[])[1]||'0',10); if(!id) return J(res,400,{error:'no id'}); if(id===s.uid) return J(res,400,{error:'ลบบัญชีตัวเองไม่ได้'});
      pool.query(`DELETE FROM ${USERS_T} WHERE id=$1`,[id]).then(()=>J(res,200,{ok:true})).catch(e=>J(res,500,{error:e.message})); return; }
  }
  if(u === '/api/users/password' && req.method === 'POST'){
    const s=session(req); if(!s) return J(res,401,{error:'login required'}); if(s.role!=='admin') return J(res,403,{error:'admin only'});
    readBody(req, body=>{ let b={}; try{b=JSON.parse(body);}catch(e){} if(!b.id||!b.password) return J(res,400,{error:'no id/password'});
      pool.query(`UPDATE ${USERS_T} SET pass_hash=$1 WHERE id=$2`,[hashPw(b.password),parseInt(b.id,10)]).then(()=>J(res,200,{ok:true})).catch(e=>J(res,500,{error:e.message})); }); return;
  }
  if(u === '/api/users/perms' && req.method === 'POST'){   // admin sets a user's area access · role optional
    const s=session(req); if(!s) return J(res,401,{error:'login required'}); if(s.role!=='admin') return J(res,403,{error:'admin only'});
    readBody(req, body=>{ let b={}; try{b=JSON.parse(body);}catch(e){} const id=parseInt(b.id,10); if(!id) return J(res,400,{error:'no id'});
      const perms = cleanPerms(b.perms); const permsStr = perms ? JSON.stringify(perms) : null;
      const ea = cleanAreas(b.editAreas); const eaStr = ea ? JSON.stringify(ea) : null; const canEdit = ea ? ea.length>0 : (b.canEdit!==false);
      if(b.role==='admin'||b.role==='staff'){ pool.query(`UPDATE ${USERS_T} SET perms=$1, role=$2, can_edit=$3, edit_areas=$4, dept=$6, sales_id=$7 WHERE id=$5`,[permsStr,b.role,canEdit,eaStr,id,cleanDept(b.dept),cleanSalesId(b.salesId)]).then(()=>J(res,200,{ok:true})).catch(e=>J(res,500,{error:e.message})); }
      else { pool.query(`UPDATE ${USERS_T} SET perms=$1, can_edit=$2, edit_areas=$3, dept=$5, sales_id=$6 WHERE id=$4`,[permsStr,canEdit,eaStr,id,cleanDept(b.dept),cleanSalesId(b.salesId)]).then(()=>J(res,200,{ok:true})).catch(e=>J(res,500,{error:e.message})); }
    }); return;
  }

  // ───── Per-entity REST API (v1) ─────
  //   GET  /api/v1                     resource index {resources:{name:container}}
  //   GET  /api/v1/<entity>[/<id>]     list / one record (nested children assembled)
  //   POST/PUT/DELETE /api/v1/<entity>[/<id>]   create / replace / delete one record
  //   POST /api/v1/_batch              {baseVersion, ops:[{op,r,id,body}]} — many ops, ONE transaction
  // Every write bumps the app_state version + broadcasts on SSE (same live-refresh contract as /api/save).
  if(u === '/api/v1' || u.startsWith('/api/v1/')){
    const s=session(req); if(!s) return J(res,401,{error:'login required'});
    if(!pool) return J(res,503,{error:'no database'});
    if(DATA_BACKEND!=='relational') return J(res,503,{error:'REST API requires DATA_BACKEND=relational'});
    const seg = u === '/api/v1' ? [] : u.slice('/api/v1/'.length).split('/').filter(Boolean).map(decodeURIComponent);
    const resName = seg[0], id = seg.length>1 ? seg[1] : null, m = req.method;
    const done=e=>J(res,500,{error:e.message});
    if(!resName){ const out={}; for(const [n,r] of Object.entries(REST_RES)) out[n]=r.container; return J(res,200,{resources:out}); }
    const canWrite = s.role==='admin' || s.edit!==false;
    if(resName==='_batch'){
      if(m!=='POST') return J(res,405,{error:'method not allowed'});
      if(!canWrite) return J(res,403,{error:'view only · ไม่มีสิทธิ์แก้ไข'});
      readBody(req, body=>{
        let p; try{ p=JSON.parse(body); }catch(e){ return J(res,400,{error:'invalid JSON'}); }
        const ops = Array.isArray(p.ops) ? p.ops : null;
        if(!ops || !ops.length) return J(res,400,{error:'ops required'});
        if(!ops.every(o=>o && (o.op==='meta' ? o.id!=null : (o.op==='put'||o.op==='patch'||o.op==='del'||o.op==='putall') && o.r))) return J(res,400,{error:'bad op shape'});
        restTxn(s.username, p.baseVersion==null?-1:p.baseVersion, ops)
          .then(({version,behind})=>{ try{ const summ=ops.slice(0,25).map(o=>o.op+':'+(o.r||o.id||'')).join(','); console.log('[batch] user='+s.username+' v'+version+' ops='+ops.length+' ['+summ+']'); }catch(e){}   // 2026-07-10: log who saved what (per-entity saves had no username trail — the incident was untraceable)
            J(res,200,{ok:true,version,behind,applied:ops.length}); sseBroadcast({version, updated_by:s.username}); })
          .catch(e=> {
            if(e.code!=='SHRINK_GUARD') console.error('[batch] error user='+s.username+' ops='+ops.length+' —', e.message);
            return e.code==='SHRINK_GUARD'
              ? J(res,409,{error:'save_would_delete_data', code:'SHRINK_GUARD', detail:e.detail})
              : J(res, /unknown resource|needs an id|record object|patch target not found/.test(e.message)?400:500, {error:e.message});
          });
      }); return;
    }
    if(m==='GET'){ restGet(res,resName,id).catch(done); return; }
    if(!canWrite) return J(res,403,{error:'view only · ไม่มีสิทธิ์แก้ไข'});
    const one = op => restTxn(s.username, -1, [op])
      .then(({version,applied})=>{ J(res, m==='POST'?201:200, {ok:true, id:applied[0], version}); sseBroadcast({version, updated_by:s.username}); })
      .catch(e=> e.code==='SHRINK_GUARD'
        ? J(res,409,{error:'save_would_delete_data', code:'SHRINK_GUARD', detail:e.detail})
        : J(res, /unknown resource|needs an id|record object|patch target not found/.test(e.message)?400:500, {error:e.message}));
    if(m==='DELETE'){ if(id==null) return J(res,400,{error:'id required'}); one({op:'del', r:resName, id}); return; }
    if(m==='POST'||m==='PUT'){
      if(m==='PUT'&&id==null) return J(res,400,{error:'id required for PUT'});
      readBody(req, body=>{ let b; try{ b=JSON.parse(body||'{}'); }catch(e){ return J(res,400,{error:'invalid JSON'}); } one({op:'put', r:resName, id, body:b}); }); return;
    }
    return J(res,405,{error:'method not allowed'});
  }

  // ───── B2C availability API (no session — API key auth) ─────
  // GET /api/b2c/availability?route=r6&dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD[&rateTypeId=xxx]
  // Returns booked+locked seat counts + pricing for the requested route/date range.
  // Secured via X-Api-Key header matched against B2C_API_KEY env var.
  if (u === '/api/b2c/availability' && req.method === 'GET') {
    const B2C_API_KEY = process.env.B2C_API_KEY || '';
    if (!B2C_API_KEY || (req.headers['x-api-key'] || '') !== B2C_API_KEY)
      return J(res, 401, { error: 'invalid or missing X-Api-Key' });
    if (!pool) return J(res, 503, { error: 'no database' });
    if (DATA_BACKEND !== 'relational') return J(res, 503, { error: 'requires relational backend' });
    const routeId    = (q.match(/route=([^&]*)/)    || [])[1] ? decodeURIComponent((q.match(/route=([^&]*)/)||[])[1]) : null;
    const dateFrom   = (q.match(/dateFrom=([^&]*)/) || [])[1] ? decodeURIComponent((q.match(/dateFrom=([^&]*)/)||[])[1]) : null;
    const dateTo     = (q.match(/dateTo=([^&]*)/)   || [])[1] ? decodeURIComponent((q.match(/dateTo=([^&]*)/)||[])[1]) : null;
    const rateTypeId = (q.match(/rateTypeId=([^&]*)/)||[])[1] ? decodeURIComponent((q.match(/rateTypeId=([^&]*)/)||[])[1]) : null;
    if (!routeId || !dateFrom || !dateTo) return J(res, 400, { error: 'route, dateFrom, dateTo required' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) return J(res, 400, { error: 'dates must be YYYY-MM-DD' });
    if (dateTo < dateFrom) return J(res, 400, { error: 'dateTo must be >= dateFrom' });
    const CANCELLED = ['cancelled','cancelled_weather','rejected'];
    Promise.all([
      // booked seats per date (seat-mode trips only, non-cancelled bookings)
      pool.query(
        `SELECT t.date,
                COALESCE(SUM(t.pax_ad_fr + t.pax_chd_fr + t.pax_inf_fr + t.pax_foc_fr
                           + t.pax_ad_th + t.pax_chd_th + t.pax_inf_th + t.pax_foc_th), 0)::int AS booked
         FROM ${fqt('sb_bookings__trips')} t
         JOIN ${fqt('sb_bookings')} b ON b.id = t.sb_bookings_id
         WHERE t.routeid=$1 AND t.date>=$2 AND t.date<=$3
           AND t.bookingmode='seat'
           AND b.status != ALL($4::text[])
         GROUP BY t.date`,
        [routeId, dateFrom, dateTo, CANCELLED]
      ),
      // locked seats per date (active locks, respecting qty-used)
      pool.query(
        `SELECT date,
                COALESCE(SUM(GREATEST(qty - used, 0)), 0)::int AS locked
         FROM ${fqt('sb_seat_locks')}
         WHERE routeid=$1 AND date>=$2 AND date<=$3 AND status='active'
         GROUP BY date`,
        [routeId, dateFrom, dateTo]
      ),
      // pricing — seat rates for this route from active rate type(s)
      pool.query(
        `SELECT rt.id AS rate_type_id, rt.code, rt.name,
                s.pk_adult_fr, s.pk_adult_thai, s.pk_child_fr, s.pk_child_thai, s.pk_infant_fr, s.pk_infant_thai,
                s.kl_adult_fr, s.kl_adult_thai, s.kl_child_fr, s.kl_child_thai, s.kl_infant_fr, s.kl_infant_thai,
                s.notransfer_adult_fr, s.notransfer_adult_thai, s.notransfer_child_fr, s.notransfer_child_thai
         FROM ${fqt('sb_rate_types')} rt
         JOIN ${fqt('sb_rate_types__seatrates')} s ON s.sb_rate_types_id = rt.id
         WHERE rt.active = true AND s.key=$1 ${rateTypeId ? 'AND rt.id=$2' : ''}`,
        rateTypeId ? [routeId, rateTypeId] : [routeId]
      ),
      // deployed seat capacity per date: boats.cap × which boats run this route in trips (charter excluded).
      // Mirrors the client getAllotment: a charter deployment (bN_type='charter') does NOT add seat capacity.
      pool.query(`SELECT id, cap FROM ${fqt('boats')}`),
      pool.query(`SELECT * FROM ${fqt('trips')} WHERE ${qic('key')} >= $1 AND ${qic('key')} <= $2`, [dateFrom, dateTo]),
    ]).then(([bkRes, lockRes, rtRes, boatRes, tripRes]) => {
      const bookedMap = {}, lockedMap = {};
      for (const r of bkRes.rows)   bookedMap[r.date]  = r.booked;
      for (const r of lockRes.rows) lockedMap[r.date]  = r.locked;
      const boatCap = {}, boatIds = [];
      for (const b of boatRes.rows) { boatCap[b.id] = Number(b.cap) || 0; boatIds.push(b.id); }
      const tripsByDate = {};
      for (const r of tripRes.rows) tripsByDate[r.key] = r;
      // build all dates in range
      const dates = [];
      for (let d = new Date(dateFrom + 'T00:00:00Z'); d.toISOString().slice(0,10) <= dateTo; d.setUTCDate(d.getUTCDate()+1)) {
        const dk = d.toISOString().slice(0, 10);
        const booked = bookedMap[dk] || 0, locked = lockedMap[dk] || 0;
        const trow = tripsByDate[dk] || {};
        let capacity = 0;
        for (const bid of boatIds) {
          if (trow[bid + '_route'] === routeId && trow[bid + '_type'] !== 'charter') capacity += boatCap[bid] || 0;
        }
        const seatsAvailable = Math.max(0, capacity - booked - locked);
        dates.push({ date: dk, capacity, bookedSeats: booked, lockedSeats: locked, totalConsumed: booked + locked, seatsAvailable });
      }
      // shape pricing by rate type
      const pricing = rtRes.rows.map(r => ({
        rateTypeId: r.rate_type_id, code: r.code, name: r.name,
        PK: { adult_fr: r.pk_adult_fr, adult_th: r.pk_adult_thai, child_fr: r.pk_child_fr, child_th: r.pk_child_thai, infant_fr: r.pk_infant_fr, infant_th: r.pk_infant_thai },
        KL: { adult_fr: r.kl_adult_fr, adult_th: r.kl_adult_thai, child_fr: r.kl_child_fr, child_th: r.kl_child_thai, infant_fr: r.kl_infant_fr, infant_th: r.kl_infant_thai },
        NoTransfer: { adult_fr: r.notransfer_adult_fr, adult_th: r.notransfer_adult_thai, child_fr: r.notransfer_child_fr, child_th: r.notransfer_child_thai },
      }));
      J(res, 200, { route: routeId, dateFrom, dateTo, dates, pricing });
    }).catch(e => J(res, 500, { error: e.message }));
    return;
  }

  // ───── static files ─────
  let p = decodeURIComponent(u); if(p==='/'||p==='') p='/allotment_v2/allotment_v2.html';
  const fp = path.normalize(path.join(ROOT,p));
  if(!fp.startsWith(ROOT)){ res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(fp,(err,data)=>{ if(err){ res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'}); return res.end('Not found'); }
    const etag = '"'+crypto.createHash('sha1').update(data).digest('hex').slice(0,20)+'"';
    if((req.headers['if-none-match']||'') === etag){ res.writeHead(304,{'ETag':etag,'Cache-Control':'no-cache'}); return res.end(); }
    const ext = path.extname(fp).toLowerCase();
    const ctype = MIME[ext]||'application/octet-stream';
    const acceptsGzip = /\bgzip\b/.test(req.headers['accept-encoding']||'');
    if(acceptsGzip && GZIP_EXT.has(ext) && data.length > 1024){
      const send=(buf)=>{ res.writeHead(200,{'Content-Type':ctype,'ETag':etag,'Cache-Control':'no-cache','Vary':'Accept-Encoding','Content-Encoding':'gzip'}); res.end(buf); };
      const cached=_gzCache.get(fp); if(cached && cached.etag===etag) return send(cached.buf);
      const zlib=require('zlib');
      return zlib.gzip(data,(gzErr,buf)=>{ if(gzErr){ res.writeHead(200,{'Content-Type':ctype,'ETag':etag,'Cache-Control':'no-cache','Vary':'Accept-Encoding'}); return res.end(data); }
        _gzCache.set(fp,{etag,buf}); send(buf); });
    }
    res.writeHead(200,{'Content-Type':ctype,'ETag':etag,'Cache-Control':'no-cache','Vary':'Accept-Encoding'}); res.end(data); });
});
server.listen(PORT, ()=>console.log('LOVE Andaman on '+PORT+(pool?' · db on':' · db off')));
