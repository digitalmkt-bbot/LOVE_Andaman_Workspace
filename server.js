// LOVE Andaman · server for Railway: static app + login (users) + cloud sync with overwrite-guard.
// Data is one JSON blob (loveandaman_v2) in Postgres, versioned (optimistic concurrency).
const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const zlib   = require('zlib');

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
  if (/^(bigint|integer|int|smallint)/i.test(ty)){   // whole-number columns → ROUND (a stray decimal like a qty "3.6" must never abort the whole batch)
    if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v) : null;
    if (typeof v === 'string'){ const s = v.trim(); if (s === '') return null; const n = Number(s); return Number.isFinite(n) ? Math.round(n) : null; }
    return null;                                   // "", null, boolean, object → null (never a valid number)
  }
  if (/^(numeric|decimal|double|real|float)/i.test(ty)){   // decimal columns → keep the fractional value as-is
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v === 'string'){ const s = v.trim(); if (s === '') return null; const n = Number(s); return Number.isFinite(n) ? n : null; }
    return null;
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
  'POW-005': 'r1784542898734',  // Day Trip - Se La Va (Ranong) → r1784542898734
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
  'POW-005': 'Day Trip - Se La Va',
  'PR-001':  'Private - Similan Island',
  'PR-002':  'Private - Surin Islands',
  'PR-003':  'Private - Phi Phi + Bamboo Islands',
  'PR-004':  'Private - Phi Phi + Maiton (Sunset)',
};
// pickupareaid rides along here: matched best-effort from the B2C free-text location on first sync,
// then owned by ops (staff re-assignment must survive resyncs) — excluded from conflict-update.
// B2C bookings.payment_type — mirrors SB_PAYMENT_TYPES ids in the app. Whitelisted so an unexpected
// value can't leak into the Pay column (bkV2PayLabel falls through to the raw string).
const B2C_PAY_TYPES = new Set(['proforma', 'invoice', 'bt', 'cot']);
// ── B2C re-sync · ฟิลด์ไหน B2C ทับได้ (2026-08-02) ──────────────────────────────────────────────
// เดิมเป็น "บัญชีดำ": ทับทุกคอลัมน์ ยกเว้นชุด ops ที่ระบุไว้ — ซึ่งกลับด้านผิด เพราะทุกครั้งที่มี
// ฟิลด์ใหม่ฝั่ง ops ("ค่าเริ่มต้นคือโดนทับ") มันจะถูกล้างเงียบๆ ตอน B2C sync โดยไม่มีใครรู้
// ตรวจจริงเมื่อ 2 ส.ค. พบว่ามี 97 คอลัมน์ในสถานะนั้น รวมของที่เสียหายหนัก:
//   pierpayments (เงินที่เก็บหน้าท่า + สลิป) · ops_piercheckin / ops_vancheckin (ผลเช็คอิน)
//   ops_boatsplits (การแยกลงเรือ) · cancellation_* (เหตุผล/ค่าปรับการยกเลิก) · reschedule_* · rebook_*
//   guides_* (ภาษาไกด์) · specialmeals_* · altpickups (รับหลายจุด) · doccheck · attachments · paymentslips
// ตอนนี้เป็น "บัญชีขาว": ทับได้เฉพาะคอลัมน์ที่ mapB2CItemBooking สร้างจริงเท่านั้น
// ฟิลด์ใหม่ = ถูกคุ้มครองโดยอัตโนมัติ · ถ้าลืมใส่ลิสต์ ผลคือค่าไม่อัปเดต (ไม่ใช่ข้อมูลหาย) ซึ่งปลอดภัยกว่ามาก
// ไม่มี pickupareaid ในลิสต์ตั้งใจ — ฝั่ง ops แก้การจับคู่โซนเอง B2C ต้องไม่ทับ (เหมือนกติกาเดิม)
const B2C_OWN_BK = new Set([
  'schemaver','voucherref','agentid',
  'leadpax','leadnationality','leadphone','leademail',
  'status','total','note','bookingdate',
  'pickupself','pickuparea','pickupzone','hotelname','dropoffhotelname',
  'paymentsnapshot_method','paymentsnapshot_netdays','paymentsnapshot_source',
  'paymentsnapshot_contractversion','paymentsnapshot_paid','paymentsnapshot_paidstatus',
  'pricebreakdown_seat','pricebreakdown_addon','pricebreakdown_focdiscount',
  'pricebreakdown_discount','pricebreakdown_extra','pricebreakdown_total',
]);

// Bump whenever mapB2CItemBooking changes how it reads the source. The full-sync change detector
// hashes the source rows, so a mapper fix alone would never re-apply to bookings whose source rows
// are untouched — folding this version into the hash forces exactly one corrective re-upsert.
// The re-upsert goes through the normal ON CONFLICT path, so only B2C_OWN_BK columns are touched.
// v4: mapper now reads bookings.payment_type and details.pickupHotel / bi.pickuphotel.
// v5: corrects v4 — pickupLocation is the AREA name, not a fallback hotel. v4 matched the area
//     against the hotel string, so every booking carrying pickupHotel resolved to no area at all.
// v6: adds the derived paid state (paymentSnapshot.paid / .paidStatus) from Σpayments +
//     Σcredits_applied vs bookings.total — payment_type alone never says whether money arrived.
// v7: carries the pickup AREA NAME through as pickupArea (ops area name when matched, else B2C's
//     raw text) — the ops Zone column prints that field, so unmatched rows showed a bare dash.
// v8: imports the traveller list (bookings.passengers via v_booking_passengers) into
//     passengers[] — name + nationality only. Until v8 the array was always empty.
// v9: corrects v8 and earlier — bookings.passengers EXCLUDES the lead, it is the other travellers.
//     leadPax now comes from the booking's own customer block (was passengers[0].name, which put
//     traveller #2 in the lead slot and then dropped them from the list, leaving "lead only" on a
//     booking that had a second guest). Also carries customer.nationality into leadNationality.
// v10: applies the ORDER-level discount / surcharge (bookings.discount_amount, surcharge_amount)
//      to line 0. They were selected but never read, so the line seat price stood in for the whole
//      total — LOV-9930593 imported at 55,984 against a real 54,400.
// v11: a line with no nationality split of its own (pax_thai = pax_foreign = 0) follows the LEAD's
//      nationality instead of counting everyone as foreign.
// v12: ignore promo ids like PR-001 on day_trip rows. B2C promoId shares the PR-* prefix used by
//      private routes; if it leaks into product_id, keep the item as a seat booking and recover the
//      real day-trip program from details.programId / route_id instead.
// v13: if B2C did not fan out bookings.items into booking_items, synthesize item rows directly from
//      bookings.items[] so discount/map bookings still import.
// v14: normalize B2C paymentMethod/paymentType labels (PM-BANK, Bank transfer) to app pay code 'bt'.
// v15: imports details.addonsSelected into addOns[] and prices it as subtotal − seat, instead of
//      hardcoding addOns: [] / priceBreakdown.addOn: 0. Also puts the add-on into lineTotal, which
//      it was always missing from — an add-on line imported short of what the guest paid and read
//      as overpaid. The re-upsert this bump forces backfills the 16 existing orders whose add-ons
//      were discarded; both pricebreakdown_addon and the sb_bookings__addons child rows are
//      refreshed by the normal sync path, so no separate migration is needed.
// v16: prefers the catalog-resolved name carried on each addonsSelected entry, with a stable B2C
//      add-on id fallback. The bump refreshes previously imported generic labels.
const B2C_MAP_VER = 16;

// ── B2C sync health (2026-07-31) ─────────────────────────────────────────────────────────────────
// A failed sync used to be a single console line and nothing else: no alert, no flag in the app, no
// row anywhere saying an order never arrived. Ops would only notice when a customer phoned about a
// booking nobody could see. This tracks the state so the app can say so out loud.
//
// consecutive counts FAILED RUNS, not failed fetches — a run that fetches fine but dies during the
// upsert is just as broken from ops' point of view. A run with nothing to do (no rows, or the hash
// says B2C is unchanged) is a SUCCESS: the connection worked and there was nothing to import.
const B2C_HEALTH = { lastOk: null, lastFail: null, consecutive: 0, message: '', phase: '' };
function _b2cHealthOk() {
  B2C_HEALTH.lastOk = Date.now();
  B2C_HEALTH.consecutive = 0;
  B2C_HEALTH.message = '';
  B2C_HEALTH.phase = '';
}
function _b2cHealthFail(e) {
  B2C_HEALTH.lastFail = Date.now();
  B2C_HEALTH.consecutive++;
  B2C_HEALTH.message = String((e && e.message) || e || 'unknown error');
  B2C_HEALTH.phase = String((e && e._phase) || '');
}
// What /api/version reports to the client. Two independent ways this goes wrong:
//   consecutive >= 3  — the sync is erroring. 3 runs at the 45s poll ≈ 2 min, so a single blip
//                       (a restart, a dropped connection) never nags anyone.
//   stale             — no successful run in 10 min while the poller should have managed ~13.
//                       Catches the failure mode a counter cannot see: a query that hangs instead
//                       of throwing, so nothing ever increments and nothing ever succeeds either.
const B2C_STALE_MS = 10 * 60 * 1000;
const _b2cBootAt = Date.now();
function b2cHealthReport() {
  // Mirrors relSyncB2C's own guard exactly. If any of these is false the sync never runs at all, so
  // there is nothing to be unhealthy about — and reporting stale-ness would raise a false alarm ten
  // minutes after every boot on a deployment that simply has no B2C source.
  const configured = !!b2cPool && !!pool && DATA_BACKEND === 'relational';
  if (!configured) return { configured: false, ok: true };
  const now = Date.now();
  const sinceOk = B2C_HEALTH.lastOk ? now - B2C_HEALTH.lastOk : null;
  // Never-succeeded-since-boot only counts as stale once the window has actually elapsed, otherwise
  // every deploy would alert for its first few seconds.
  const stale = sinceOk === null ? (now - _b2cBootAt > B2C_STALE_MS) : (sinceOk > B2C_STALE_MS);
  return {
    configured: true,
    ok: B2C_HEALTH.consecutive < 3 && !stale,
    consecutive: B2C_HEALTH.consecutive,
    staleMin: sinceOk === null ? null : Math.round(sinceOk / 60000),
    neverOk: B2C_HEALTH.lastOk === null,
    message: B2C_HEALTH.message,
    phase: B2C_HEALTH.phase,
  };
}

function mapB2CStatus(s) {
  if (s === 'cancelled') return 'cancelled';
  if (s === 'pending')   return 'pending_approval';
  return 'confirmed';
}

function b2cPayCode(h) {
  const vals = [h && h.bk_payment_type, h && h.payment_method_id, h && h.bk_payment_method, h && h.bk_payment_method_name]
    .map(v => String(v || '').trim()).filter(Boolean);
  for (const raw of vals) {
    const s = raw.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (B2C_PAY_TYPES.has(s)) return s;
    if (/^(pm )?(bank|transfer|bank transfer|banktransfer)$/.test(s) || s === 'pm bank' || s === 'pm transfer') return 'bt';
    if (s.includes('bank') || s.includes('transfer')) return 'bt';
    if (s.includes('cash') || s === 'cot') return 'cot';
    if (s.includes('proforma') || s.includes('pro forma')) return 'proforma';
    if (s.includes('invoice') || s === 'credit') return 'invoice';
  }
  return '';
}

// Line-item money, split into seat + add-on.
//   seat   = Σ(pax_<cat> × details.unitPrices.<cat>) over adult/child/infant/foc — unitPrices is
//            SEAT ONLY, verified on prod (LOV-4190737: 2 × 3500 = the 7,000 seat total).
//   addOn  = subtotal − seat. B2C folds the add-on into the line subtotal and prices it nowhere
//            else: addonsSelected carries no unitPrice/amount on ANY entry in the B2C database
//            (census 2026-08-06, 0 of 25). Verified on all 16 add-on-carrying lines — 15 positive,
//            1 zero, 0 negative — and it matches the paid-vs-total gap on every order checked.
// We must NOT re-price from our own rate card: B2C charged 500/rider on LOV-4190737 where rt003
// says 400 adult / 300 child. Whatever B2C charged is what ops and accounting show.
// When unitPrices is missing there is nothing to subtract from — subtotal is all we have and it
// cannot be split, so it stays wholly seat. That keeps the line TOTAL right (it always was) and
// merely leaves the add-on unattributed, which is what the old subtotal fallback did anyway.
function b2cLineMoney(item) {
  let det = item.details;
  if (typeof det === 'string') { try { det = JSON.parse(det); } catch (_) { det = null; } }
  const up = (det && det.unitPrices) || {};
  const sub = Math.round(Number(item.subtotal) || 0);
  const rated = (Number(item.pax_adult)  || 0) * (Number(up.adult)  || 0)
              + (Number(item.pax_child)  || 0) * (Number(up.child)  || 0)
              + (Number(item.pax_infant) || 0) * (Number(up.infant) || 0)
              + (Number(item.pax_foc)    || 0) * (Number(up.foc)    || 0);
  if (!(rated > 0)) return { seat: sub, addOn: 0 };
  const seat = Math.round(rated);
  return { seat, addOn: Math.max(0, sub - seat) };
}
// Seat alone — same value the old b2cLineSeat returned, kept for any caller that wants just the seat.
function b2cLineSeat(item) { return b2cLineMoney(item).seat; }

// details.addonsSelected → ops addOns[{type,label,amount,qty,note}].
// Ops identifies an add-on by the literal `type` string — bkV2AddOnFlags matches 'longtail-join',
// 'longtail-charter' and a 'transfer-' prefix, and there is no id registry to look anything up in
// (sb_addon_types is empty). B2C's `code` uses the same slugs, so it maps 1:1 with no table.
// B2C started sending code/qtyAdult/qtyChild on 2026-08-06; older entries carry only {qty, addonId}.
// An entry with no `code` gets a namespaced type ('b2c-ad-001') that deliberately matches none of
// the patterns above: importing it as a generic line is honest, whereas guessing "longtail" from an
// unknown code would put phantom boats on the pier. Fill in the real slugs once B2C confirms what
// AD-001 / AD-002 are (docs/B2C_LONGTAIL_ADDON.md §4 Q1).
function b2cMapAddOns(det, addOnTotal) {
  const arr = (det && Array.isArray(det.addonsSelected)) ? det.addonsSelected : [];
  if (!arr.length) return [];
  const rows = arr.map(a => {
    const code = String((a && a.code) || '').trim().toLowerCase();
    const id   = String((a && a.addonId) || '').trim();
    const type = code || (id ? 'b2c-' + id.toLowerCase() : 'b2c-addon');
    const qty  = Math.round(Number(a && a.qty) || 0) || 1;
    const ad = Number(a && a.qtyAdult), ch = Number(a && a.qtyChild);
    const name = String((a && a.name) || '').trim() || `B2C add-on ${id || '?'}`;
    // Mirror the B2B label shape ("Longtail Join (2A + 0C)") when B2C sent the adult/child split.
    const label = (Number.isFinite(ad) && Number.isFinite(ch)) ? `${name} (${ad}A + ${ch}C)`
                                                               : `${name} × ${qty}`;
    return { type, label, amount: 0, qty, note: '' };
  });
  // subtotal − seat gives the COMBINED add-on money for the line. With one entry that is its exact
  // amount; with several (AD-001 + AD-002 together, 6 orders) it cannot be split without per-entry
  // prices, so each stays 0 and priceBreakdown.addOn carries the money. Splitting it by qty would
  // be a guess and would show made-up figures against a named product.
  if (rows.length === 1) rows[0].amount = Math.max(0, Math.round(addOnTotal) || 0);
  return rows;
}

// One allotment booking PER B2C booking_item — items sit at booking level, not nested as trips.
// id = b2c_<booking_id>_<line_no>; voucher = the B2C booking_id verbatim (no added prefix —
// new B2C ids already carry their own LOV- prefix); each carries a single trip.
// isFirstLine: order-level payment (deposit/balance) attaches only to the first line of the order,
// so a multi-item order's payment isn't multiplied across its item-bookings.
function mapB2CItemBooking(item, isFirstLine, findArea, paxRows) {
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
  const { seat, addOn } = b2cLineMoney(h);
  // pax_adult = total adults; pax_thai/pax_foreign = nationality split (may be 0/0 when unknown).
  // Never use pax_foreign||pax_adult — a Thai-only booking (fr=0, th=5, ad=5) double-counts to 10.
  // Pay type: bookings.paymentType/paymentMethod can be either app ids (bt/cot) or B2C labels
  // (Bank transfer / PM-BANK). Normalize to the app pay code so B2C does not fall back to contract
  // credit/prepaid wording in booking detail/accounting chips.
  const payType = b2cPayCode(h);
  // Paid state — derived, never read off payment_type. bk_paid is Σpayments + Σcredits_applied
  // computed in B2C_ITEM_JOIN; the thresholds mirror the B2C team's reference SQL exactly:
  // paid<=0 → unpaid · paid>=total → paid · otherwise → deposit (part-paid).
  // Both figures are ORDER-level. The amount attaches to the first line only (same rule as
  // deposit/balance, so a 3-item order doesn't report 3× the money), but the STATUS is a property
  // of the whole order and rides on every line — ops reading line 2 must still see "paid".
  const bkTotal    = Number(h.bk_total) || 0;
  const paidAmt    = Math.round(Number(h.bk_paid) || 0);
  const paidStatus = paidAmt <= 0 ? 'unpaid' : (paidAmt >= bkTotal ? 'paid' : 'deposit');
  // The discount / surcharge are ORDER-level too, so they attach to line 0 like the payment does.
  // Until this was read, the line seat price WAS the whole total: LOV-9930593 imported at 55,984
  // (16 × 3,499) against a real total of 54,400 after a 1,584 discount — every revenue aggregate
  // over-reported the sale, while paidStatus (which compares bk_total) still said fully paid.
  const discAmt  = isFirstLine ? Math.max(0, Math.round(Number(h.bk_discount)  || 0)) : 0;
  const extraAmt = isFirstLine ? Math.max(0, Math.round(Number(h.bk_surcharge) || 0)) : 0;
  // Σ lines = the order total. The add-on has to be in here: it is inside bi.subtotal and inside
  // bookings.total, so leaving it out made an add-on line import 1,000 short of what the guest paid
  // (LOV-4190737: total 7,000 against paid 8,000) and read as overpaid in accounting.
  const lineTotal = Math.max(0, seat + addOn - discAmt + extraAmt);
  const adTh = Number(h.pax_thai) || 0;
  const adFrRaw = Number(h.pax_foreign) || 0;
  const adFr = adFrRaw > 0 ? adFrRaw : Math.max(0, (Number(h.pax_adult) || 0) - adTh);
  // Lead = the booking's own customer block, exactly as B2C's own webhook mapper reads it
  // (erp/src/mapExternalBooking.js: leadPax = ext.customer.name). bookings.passengers is NOT the
  // lead — it holds the OTHER travellers, so a 2-adult booking is customer + 1 passenger row.
  // Order: the booking's own customer, then the CRM customers row (deduped by email, so it can be
  // a stale earlier customer), then the booker, and only as a last resort the first traveller.
  let leadFromPax = '';
  try {
    let ps = h.bk_passengers;
    if (typeof ps === 'string') ps = JSON.parse(ps);
    if (Array.isArray(ps) && ps[0] && ps[0].name) leadFromPax = String(ps[0].name).trim();
  } catch (_) {}
  const leadName = String(h.bk_customer_name || h.customer_name || h.booked_by_name || leadFromPax || '').trim();
  const leadNat  = b2cNatCode(h.bk_customer_nat || h.crm_nationality);
  // Nationality split: B2C carries pax_thai / pax_foreign per item, but leaves BOTH 0 when the split
  // was never captured — and the fallback then charged the whole line to foreigners. A Thai group
  // booked in Thai (LOV-9930593: lead "คุณชุติกาญจน์", 16 adults, split 0/0) read as 16 FR in the
  // market mix. With no split of its own, the line follows the LEAD's nationality; children and
  // infants follow it too, since they are the same party.
  const splitKnown = adTh > 0 || adFrRaw > 0;
  const paxAllThai = !splitKnown && leadNat === 'TH';
  const chd = Number(h.pax_child) || 0;
  const inf = Number(h.pax_infant) || 0;
  // private_own = whole-boat charter; day_trip = shared seat. B2C is the source of truth for product
  // type, so derive the mode here — a charter must NOT consume the day-trip seat pool
  // (getSeatsConsumed / baCharterBoatIds exclude bookingMode==='charter'). Detect from BOTH signals:
  // the item type AND a PR-xxx product/route id (private items carry PR-*; day trips carry POW-*/r*),
  // so a private booking is caught however B2C tags it.
  const isPrivateId = id => /^PR-/i.test(String(id || ''));
  const isPowId = id => /^POW-/i.test(String(id || ''));
  // Pickup (details jsonb) — THREE distinct keys, do not collapse them:
  //   pickupZone     'PK' | 'KL' | 'NoTransfer'  — the coarse transfer region. Casing is
  //                  deliberately inconsistent (two codes, one CamelCase word); match the literal
  //                  string, never a case-normalised one.
  //   pickupLocation the AREA name from that zone's list — 'Phuket Town', 'Laguna', 'Patong'…
  //                  This is what resolves to one of the 37 ops pickup areas. Now a required
  //                  dropdown on B2C, so new rows always carry one; older rows may hold a typed
  //                  address, which simply won't match and leaves the area unassigned.
  //   pickupHotel    the hotel itself, free text, never linked to a hotels table.
  //
  // Feeding the hotel into findArea cannot work — 'Blu Monkey Hub Hotel Phuket' matches no area,
  // while 'Phuket Town' matches exactly. Match on the area, store the hotel.
  // hotelName/pickupZone/pickupSelf are B2C-owned (refreshed every sync); pickupAreaId is matched
  // best-effort against sb_pickup_areas and preserved on conflict (pickupareaid is NOT in B2C_OWN_BK).
  let det = h.details;
  if (typeof det === 'string') { try { det = JSON.parse(det); } catch (_) { det = null; } }
  det = det || {};
  const isCharter = h.type === 'private_own' || (h.type !== 'day_trip' && (isPrivateId(h.product_id) || isPrivateId(h.route_id)));
  const detailProgramId = String(det.programId || det.productId || det.routeId || '').trim();
  const routeLookupId = isCharter
    ? (isPrivateId(h.product_id) ? h.product_id : (isPrivateId(h.route_id) ? h.route_id : detailProgramId))
    : (isPowId(h.product_id) ? h.product_id : (isPowId(h.route_id) ? h.route_id : detailProgramId));
  const pickupArea  = String(det.pickupLocation || '').trim();   // area name  → matches sb_pickup_areas
  const pickupHotel = String(det.pickupHotel || '').trim();      // hotel      → hotelName
  // Rows predating the pickupHotel field carry only pickupLocation, so fall back to it rather than
  // showing ops an empty pickup.
  const pickupLoc  = pickupHotel || pickupArea;
  const noTransfer = det.noTransfer === true;
  const pickupZone = noTransfer ? 'NoTransfer' : String(det.pickupZone || '').trim();
  const areaHit = (typeof findArea === 'function') ? findArea(pickupArea, pickupZone) : null;
  const areaId  = areaHit ? areaHit.id : null;
  // The ops Zone column prints the area NAME (bk.pickupArea), so a B2C row that carried an area but
  // matched nothing showed a bare dash. Pass the name through either way: the ops area's own wording
  // when it matched, else B2C's raw text so staff at least see what the customer picked.
  const areaName = areaHit ? areaHit.name : pickupArea;
  const dropoffLoc = (det.dropoffSame === false) ? String(det.dropoffHotel || det.dropoffLocation || '').trim() : '';
  const trip = {
    id: 'b2c_' + h.booking_id + '_' + h.line_no + '_t0',
    routeId: B2C_ROUTE_MAP[routeLookupId] || null,
    date: date,
    bookingMode: isCharter ? 'charter' : 'seat',
    pax: {
      ad_fr: paxAllThai ? 0 : adFr,
      ad_th: paxAllThai ? (Number(h.pax_adult) || 0) : adTh,
      chd_fr: paxAllThai ? 0 : chd,
      chd_th: paxAllThai ? chd : 0,
      inf_fr: paxAllThai ? 0 : inf,
      inf_th: paxAllThai ? inf : 0,
      foc: Number(h.pax_foc) || 0,
      // B2C has no nationality split for FOC, but these columns must not be NULL: the seat-count
      // queries add the pax columns together, and one NULL makes the whole booking count as zero.
      foc_fr: 0,
      foc_th: 0,
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
    leadPax: leadName,
    leadNationality: leadNat,
    leadPhone: h.customer_phone || '',
    leadEmail: h.customer_email || h.booked_by_email || '',
    status: mapB2CStatus(h.bk_status),
    bookingDate: td(h.bk_created_at) || date,
    hotelName: pickupLoc,
    pickupZone: pickupZone,
    pickupSelf: noTransfer,
    pickupAreaId: areaId,
    pickupArea: areaName,
    dropoffHotelName: dropoffLoc,
    note: ['B2C', h.channel_name, String(h.booking_id), B2C_PRODUCT_NAME[h.product_id] || B2C_PRODUCT_NAME[h.route_id] || h.product_id,
           // Show ops the AREA that failed to match, not the hotel — the area is what they need to
           // pick by hand, and naming it makes a missing sb_pickup_areas entry obvious.
           (!areaId && !noTransfer && (pickupArea || pickupLoc))
             ? `Pickup: ${pickupArea || pickupLoc}${pickupZone ? ' (' + pickupZone + ')' : ''} — area unassigned` : null].filter(Boolean).join(' · '),
    trips: [trip],
    passengers: isFirstLine ? b2cPassengerList(paxRows) : [],
    addOns: b2cMapAddOns(det, addOn),
    // Display rows for the Total panel. bkV2 stores adjustments as positive values with a kind, and
    // acctBookingTotal never re-applies them (the total already accounts for them) — so these are
    // presentational only and cannot double-count.
    adjustments: [
      ...(discAmt  ? [{ kind: 'discount', mode: 'amount', value: discAmt,  label: String(h.bk_discount_label  || 'Discount'),  note: '' }] : []),
      ...(extraAmt ? [{ kind: 'extra',    mode: 'amount', value: extraAmt, label: String(h.bk_surcharge_label || 'Surcharge'), note: '' }] : []),
    ],
    total: lineTotal,
    priceBreakdown: {
      seat: seat,
      addOn: addOn,
      focDiscount: 0,
      discount: -discAmt,      // negative, matching bkV2CommitBooking's own priceBreakdown
      extra: extraAmt,
      total: lineTotal,
    },
    paymentSnapshot: {
      deposit: isFirstLine ? (Number(h.bk_deposit) || 0) : 0,
      balance: isFirstLine ? (Number(h.bk_balance) || 0) : 0,
      method: payType,
      paid: isFirstLine ? paidAmt : 0,
      paidStatus: paidStatus,
    },
    ops: {},
    history: [],
  };
}

// booking_items JOIN query — drives everything from items, bookings table is optional enrichment only.
// Some B2C writes keep the line items only in bookings.items[] (JSON) and never fan them out to the
// booking_items table. The importer needs one row per item either way, so this source prefers the
// normalized table and falls back to bookings.items[] for orders with no normalized rows.
const B2C_ITEM_SOURCE = `(
  SELECT bi.booking_id::text AS booking_id, COALESCE(bi.line_no,0)::int AS line_no,
         bi.type::text AS type, bi.travel_date::text AS travel_date,
         bi.product_id::text AS product_id, bi.route_id::text AS route_id,
         COALESCE(bi.pax_adult,0)::numeric AS pax_adult,
         COALESCE(bi.pax_child,0)::numeric AS pax_child,
         COALESCE(bi.pax_infant,0)::numeric AS pax_infant,
         COALESCE(bi.pax_foc,0)::numeric AS pax_foc,
         COALESCE(bi.pax_thai,0)::numeric AS pax_thai,
         COALESCE(bi.pax_foreign,0)::numeric AS pax_foreign,
         COALESCE(bi.subtotal,0)::numeric AS subtotal,
         to_jsonb(bi.details) AS details,
         'booking_items'::text AS _sync_source
  FROM ${b2cT('booking_items')} bi
  UNION ALL
  SELECT b.id::text AS booking_id, (it.ord - 1)::int AS line_no,
         (it.obj->>'type')::text AS type,
         COALESCE(it.obj->>'travelDate', b.travel_date::text) AS travel_date,
         COALESCE(it.obj->>'programId', it.obj->>'productId') AS product_id,
         (it.obj->>'routeId')::text AS route_id,
         CASE WHEN COALESCE(it.obj->>'paxAdult','0')  ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (it.obj->>'paxAdult')::numeric  ELSE 0 END AS pax_adult,
         CASE WHEN COALESCE(it.obj->>'paxChild','0')  ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (it.obj->>'paxChild')::numeric  ELSE 0 END AS pax_child,
         CASE WHEN COALESCE(it.obj->>'paxInfant','0') ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (it.obj->>'paxInfant')::numeric ELSE 0 END AS pax_infant,
         CASE WHEN COALESCE(it.obj->>'paxFoc','0')    ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (it.obj->>'paxFoc')::numeric    ELSE 0 END AS pax_foc,
         CASE WHEN COALESCE(it.obj->>'paxThai','0')   ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (it.obj->>'paxThai')::numeric   ELSE 0 END AS pax_thai,
         CASE WHEN COALESCE(it.obj->>'paxForeign','0')~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (it.obj->>'paxForeign')::numeric ELSE 0 END AS pax_foreign,
         CASE WHEN COALESCE(it.obj->>'subtotal','0')  ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (it.obj->>'subtotal')::numeric  ELSE 0 END AS subtotal,
         it.obj AS details,
         'bookings.items'::text AS _sync_source
  FROM ${b2cT('bookings')} b
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(to_jsonb(b)->'items') = 'array' THEN to_jsonb(b)->'items' ELSE '[]'::jsonb END
  ) WITH ORDINALITY AS it(obj, ord)
  WHERE NOT EXISTS (SELECT 1 FROM ${b2cT('booking_items')} x WHERE x.booking_id = b.id)
) bi`;
const B2C_ITEM_JOIN = `
  SELECT bi.*,
         b.status        AS bk_status,
         b.travel_date   AS bk_travel_date,
         b.passengers    AS bk_passengers,
         b.booked_by_name, b.booked_by_email,
         b.subtotal      AS bk_subtotal,
         CASE WHEN COALESCE(to_jsonb(b)->>'discount_amount',  to_jsonb(b)->'discount'->>'amount',  '0') ~ '^-?[0-9]+(\\.[0-9]+)?$'
              THEN COALESCE(to_jsonb(b)->>'discount_amount',  to_jsonb(b)->'discount'->>'amount',  '0')::numeric ELSE 0 END AS bk_discount,
         CASE WHEN COALESCE(to_jsonb(b)->>'surcharge_amount', to_jsonb(b)->'surcharge'->>'amount', '0') ~ '^-?[0-9]+(\\.[0-9]+)?$'
              THEN COALESCE(to_jsonb(b)->>'surcharge_amount', to_jsonb(b)->'surcharge'->>'amount', '0')::numeric ELSE 0 END AS bk_surcharge,
         -- Labels for the two adjustment rows ops sees. Same defensive read as the customer block:
         -- flat column or nested object, absent shape degrades to NULL instead of erroring.
         COALESCE(to_jsonb(b)->>'discount_name',  to_jsonb(b)->'discount'->>'name',
                  to_jsonb(b)->>'discount_reason', to_jsonb(b)->'discount'->>'reason')   AS bk_discount_label,
         COALESCE(to_jsonb(b)->>'surcharge_name', to_jsonb(b)->'surcharge'->>'name',
                  to_jsonb(b)->>'surcharge_reason', to_jsonb(b)->'surcharge'->>'reason') AS bk_surcharge_label,
         b.total         AS bk_total,
         b.deposit       AS bk_deposit,
         b.balance       AS bk_balance,
         COALESCE(to_jsonb(b)->>'payment_method_id', to_jsonb(b)->>'paymentMethod') AS payment_method_id,
         COALESCE(to_jsonb(b)->>'payment_type', to_jsonb(b)->>'paymentType') AS bk_payment_type,
         COALESCE(to_jsonb(b)->>'payment_method_name', to_jsonb(b)->>'paymentMethodName') AS bk_payment_method_name,
         b.created_at    AS bk_created_at,
         ch.name         AS channel_name,
         -- The booking's OWN customer block is the lead. Read through to_jsonb so this works whether
         -- B2C keeps it as flat columns or as a customer jsonb, and so a shape that isn't there
         -- degrades to NULL instead of erroring the whole sync query (same trick as pay below).
         COALESCE(to_jsonb(b)->>'customer_name', to_jsonb(b)->'customer'->>'name')               AS bk_customer_name,
         COALESCE(to_jsonb(b)->>'customer_nationality', to_jsonb(b)->'customer'->>'nationality') AS bk_customer_nat,
         to_jsonb(c)->>'nationality' AS crm_nationality,
         c.name          AS customer_name,
         c.phone         AS customer_phone,
         c.email         AS customer_email,
         COALESCE(pay.paid, 0) AS bk_paid
  FROM ${B2C_ITEM_SOURCE}
  LEFT JOIN ${b2cT('bookings')} b       ON b.id  = bi.booking_id
  LEFT JOIN ${b2cT('b2c_channels')} ch  ON ch.id = b.channel_id
  LEFT JOIN ${b2cT('customers')} c      ON c.id  = b.customer_id
  -- How much of the order has actually been settled. B2C's payment_type is a BILLING TERM
  -- (proforma/invoice/bt/cot), never a paid state — the only way to know a booking is paid is
  -- total vs Σpayments + Σcredits_applied. Both are jsonb arrays of {amount,...} on bookings.
  -- Read through to_jsonb(b) rather than b.payments so a column that does not exist yet on the
  -- B2C side degrades to 0 instead of erroring the whole sync query; jsonb_typeof guards a
  -- null/object value the same way.
  LEFT JOIN LATERAL (
    SELECT COALESCE((SELECT SUM((pmt->>'amount')::numeric) FROM jsonb_array_elements(
             CASE WHEN jsonb_typeof(to_jsonb(b)->'payments') = 'array'
                  THEN to_jsonb(b)->'payments' ELSE '[]'::jsonb END) pmt), 0)
         + COALESCE((SELECT SUM((crd->>'amount')::numeric) FROM jsonb_array_elements(
             CASE WHEN jsonb_typeof(to_jsonb(b)->'credits_applied') = 'array'
                  THEN to_jsonb(b)->'credits_applied' ELSE '[]'::jsonb END) crd), 0) AS paid
  ) pay ON TRUE
  WHERE bi.type IN ('day_trip','private_own')`;

// ── B2C traveller list ──────────────────────────────────────────────────────────────────────────
// bookings.passengers is a BOOKING-level jsonb array, one object per traveller:
//   [{name, passport, dob, nationality, phone, remark}]
// Read it through the B2C-side view v_booking_passengers (jsonb_array_elements WITH ORDINALITY —
// the ordinal is the only stable identity, the objects carry no id) rather than off the column
// here, so the B2C side can change how it stores the list without breaking this sync.
// DDL for the view + its GIN index: database_migration/b2c_v_booking_passengers.sql.
//
// Only name + nationality are imported. sb_bookings__passengers holds {name, nationality, type,
// foc} and nothing more; passport / dob / phone / remark are left in B2C on purpose — that is
// passport-level PII, no ops screen reads it today, and copying it here would spread the exposure
// into a second database. Adding it later = 4 columns + a migration + a deliberate PII decision.
//
// NOT a headcount. The list is optional and may be filled in any time before travel, so a booking
// with pax_adult = 4 can legitimately have 0 rows here. Seat counts stay on booking_items.pax_*.
// Full-sync scope. Ops works in a window — upcoming trips plus a tail of recent ones for
// reconciliation — so the sync does not have to carry the entire B2C history on every poll.
// Bookings that fall out of the window keep the rows they already have in ops; they simply stop
// being refreshed. A targeted webhook re-sync (relSyncB2C(id)) ignores the window entirely.
const B2C_SYNC_DAYS_BACK = Number(process.env.B2C_SYNC_DAYS_BACK) || 90;
const B2C_SYNC_MAX_ROWS  = Number(process.env.B2C_SYNC_MAX_ROWS)  || 20000;
const B2C_SYNC_FROM = () => new Date(Date.now() - B2C_SYNC_DAYS_BACK * 86400000).toISOString().slice(0, 10);

const B2C_PAX_VIEW = 'v_booking_passengers';
let _b2cPaxViewMissingAt = 0;
const B2C_PAX_VIEW_RETRY_MS = 10 * 60 * 1000;   // re-probe, so creating the view needs no restart

// B2C nationality is free text off a datalist — 'Thailand', 'Thai' and 'TH' all occur. Ops stores an
// alpha-2 CODE (the client's mdValidNat accepts /^[A-Z]{2}$/ or a custom code). Map what we can and
// drop the rest: an unmatched value would land in the column as a code nothing can read, and the
// client already falls back to guessing the nationality from the name when the field is empty.
const B2C_NAT_ALIAS = {
  thai:'TH', thailand:'TH', british:'GB', english:'GB', uk:'GB', 'united kingdom':'GB',
  'great britain':'GB', american:'US', usa:'US', us:'US', 'united states':'US',
  chinese:'CN', china:'CN', korean:'KR', 'south korea':'KR', korea:'KR', japanese:'JP', japan:'JP',
  russian:'RU', russia:'RU', german:'DE', germany:'DE', french:'FR', france:'FR',
  italian:'IT', italy:'IT', spanish:'ES', spain:'ES', dutch:'NL', netherlands:'NL', holland:'NL',
  australian:'AU', australia:'AU', 'new zealand':'NZ', indian:'IN', india:'IN',
  malaysian:'MY', malaysia:'MY', singaporean:'SG', singapore:'SG', taiwanese:'TW', taiwan:'TW',
  'hong kong':'HK', israeli:'IL', israel:'IL', swedish:'SE', sweden:'SE', swiss:'CH',
  switzerland:'CH', canadian:'CA', canada:'CA', kazakh:'KZ', kazakhstan:'KZ',
  burmese:'MM', myanmar:'MM', vietnamese:'VN', vietnam:'VN', indonesian:'ID', indonesia:'ID',
  filipino:'PH', philippines:'PH', polish:'PL', poland:'PL', czech:'CZ', danish:'DK', denmark:'DK',
  norwegian:'NO', norway:'NO', finnish:'FI', finland:'FI', belgian:'BE', belgium:'BE',
  austrian:'AT', austria:'AT', portuguese:'PT', portugal:'PT', turkish:'TR', turkey:'TR',
  ukrainian:'UA', ukraine:'UA', emirati:'AE', uae:'AE', 'united arab emirates':'AE',
  saudi:'SA', 'saudi arabia':'SA', irish:'IE', ireland:'IE', greek:'GR', greece:'GR',
  brazilian:'BR', brazil:'BR', mexican:'MX', mexico:'MX', 'south african':'ZA', 'south africa':'ZA',
  lao:'LA', laos:'LA', cambodian:'KH', cambodia:'KH',
};
let _b2cNatByName = null;
function b2cNatCode(txt) {
  const s = String(txt || '').trim();
  if (!s) return '';
  if (/^[A-Za-z]{2}$/.test(s)) return s.toUpperCase();
  const k = s.toLowerCase();
  if (B2C_NAT_ALIAS[k]) return B2C_NAT_ALIAS[k];
  if (!_b2cNatByName) {
    // Formal country names ('United Kingdom', 'Viet Nam') straight from ICU; the alias table above
    // covers the demonyms and short forms ICU does not know. No full-icu build → aliases only.
    _b2cNatByName = {};
    try {
      const dn = new Intl.DisplayNames(['en'], { type: 'region' });
      for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
        const cc = String.fromCharCode(a, b);
        let nm = ''; try { nm = dn.of(cc) || ''; } catch (_) {}
        if (nm && nm !== cc) _b2cNatByName[nm.toLowerCase()] = cc;
      }
    } catch (_) {}
  }
  return _b2cNatByName[k] || '';
}

// booking_id → [{paxNo, name, nationality}] for a batch of B2C orders. A missing view or a failed
// read must never kill the sync: bookings then import exactly as before, with counts and no names.
async function b2cPassengerRows(ids) {
  const map = new Map();
  if (!b2cPool || !ids.length) return map;
  if (_b2cPaxViewMissingAt && Date.now() - _b2cPaxViewMissingAt < B2C_PAX_VIEW_RETRY_MS) return map;
  try {
    const { rows } = await b2cPool.query(
      `SELECT booking_id, pax_no, name, nationality FROM ${b2cT(B2C_PAX_VIEW)}
        WHERE booking_id::text = ANY($1) ORDER BY booking_id, pax_no`, [ids.map(String)]);
    _b2cPaxViewMissingAt = 0;
    for (const r of rows) {
      const k = String(r.booking_id);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push({
        paxNo: Number(r.pax_no) || 0,
        name: String(r.name || '').trim(),        // the view already nullifs blank-but-present ''
        nationality: b2cNatCode(r.nationality),
      });
    }
  } catch (e) {
    if (e && e.code === '42P01') {               // undefined_table — view not created yet
      _b2cPaxViewMissingAt = Date.now();
      console.warn(`[b2c-sync] ${B2C_SCHEMA}.${B2C_PAX_VIEW} not found — importing pax counts only, no traveller names. Create it with database_migration/b2c_v_booking_passengers.sql`);
    } else {
      console.warn('[b2c-sync] traveller list read failed — counts only this run:', e.message);
    }
  }
  return map;
}

// Fallback for bookings the view did not supply — because it does not exist yet, or because the
// read failed. bookings.passengers is already selected by the JOIN as bk_passengers, so the same
// travellers can be had without any DDL; this mirrors the view's own normalisation (btrim, blanks
// to empty, ordinal from array position). The view stays the primary path: it is the contract, and
// it keeps working if B2C ever moves the list off the column.
function b2cPassengersFromJson(itemRows) {
  const map = new Map();
  for (const r of itemRows) {
    const k = String(r.booking_id);
    if (map.has(k)) continue;                    // booking-level — the first line of an order has it
    let ps = r.bk_passengers;
    if (typeof ps === 'string') { try { ps = JSON.parse(ps); } catch (_) { ps = null; } }
    if (!Array.isArray(ps)) continue;            // absent / not an array → nothing to import
    map.set(k, ps.map((p, i) => ({
      paxNo: i + 1,
      name: String((p && p.name) || '').trim(),
      nationality: b2cNatCode(p && p.nationality),
    })));
  }
  return map;
}

// The list is booking-level with no link back to a booking_item, so it cannot be split per trip.
// Attach it to line 0 only — the same rule the order-level payment follows — instead of repeating
// every traveller on each line of a multi-item order.
//
// Maps 1:1, no row dropped as "the lead": B2C's passengers[] already EXCLUDES the lead (that is
// bookings.customer), so a 2-adult booking is customer + one passenger row. This mirrors B2C's own
// webhook mapper — erp/src/mapExternalBooking.js maps ext.passengers straight through as AD — and
// matches ops semantics, where passengers[] is the guests after the lead (rendered from #2).
function b2cPassengerList(rows) {
  if (!Array.isArray(rows) || !rows.length) return [];
  const out = [];
  for (const r of rows) {
    if (!r.name && !r.nationality) continue;     // fully blank row — nothing for ops to show
    out.push({ name: r.name, nationality: r.nationality, type: 'AD', foc: false });
  }
  return out;
}

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
        _b2cHealthOk();
        return;
      }
    } else {
      // The cap orders by booking_id, which is a RANDOM id (LOV-9930593), not a date — so once the
      // source passed the old 2000-row cap, every item sorting after the cut became permanently
      // invisible, newest bookings included, with nothing logged. Two changes: only sync the window
      // ops actually works in (recent + all future travel dates), and never truncate silently.
      // Compared as text so it holds whether travel_date is a date, timestamp or ISO string.
      ({ rows: itemRows } = await b2cPool.query(
        B2C_ITEM_JOIN + ` AND COALESCE(bi.travel_date::text, b.travel_date::text) >= $1
                          ORDER BY bi.booking_id, bi.line_no LIMIT $2`,
        [B2C_SYNC_FROM(), B2C_SYNC_MAX_ROWS + 1]
      ));
      if (!itemRows.length) { _b2cHealthOk(); return; }
      if (itemRows.length > B2C_SYNC_MAX_ROWS) {
        // Drop the last order whole: a cut mid-order would leave lines behind, and step 4 cancels
        // any line of a present order that this run did not upsert.
        const lastId = String(itemRows[itemRows.length - 1].booking_id);
        itemRows = itemRows.filter(r => String(r.booking_id) !== lastId);
        console.warn(`[b2c-sync] row cap hit — synced ${itemRows.length} of >${B2C_SYNC_MAX_ROWS} items from ${B2C_SYNC_FROM()}; bookings sorting after "${lastId}" were NOT imported. Raise B2C_SYNC_MAX_ROWS or shorten B2C_SYNC_DAYS_BACK.`);
      }
    }

    // Paid-amount sanity: the payments/credits sum is read defensively (to_jsonb + jsonb_typeof), so a
    // missing column or a text-typed json value degrades to 0 instead of erroring — which would make
    // every B2C booking read "Unpaid" with nothing to show it was a read failure. Say so in the log.
    if (itemRows.length && itemRows.every(r => !(Number(r.bk_paid) > 0)) && itemRows.some(r => Number(r.bk_total) > 0)) {
      console.warn('[b2c-sync] paid amount is 0 on every row — check bookings.payments / credits_applied exist and are json/jsonb; all B2C bookings will show Unpaid');
    }

    // Change detection (full runs only): hash the raw source rows and compare with the last synced
    // hash. Unchanged → skip the whole upsert (fast path — this runs on EVERY /api/load). Changed →
    // upsert, then bump app_state version + SSE so clients actually reload the new data. Without the
    // bump, /api/load saw "version unchanged" and served the pre-sync cached blob — new B2C bookings
    // sat in the tables but never reached the app until an unrelated save bumped the version.
    // Traveller names live on bookings.passengers, not on booking_items, and are typically filled in
    // AFTER the order is placed — so they must feed the change hash as well. Hashing the item rows
    // alone meant a list typed in later never synced: booking_items was untouched, so the fast path
    // below skipped the whole upsert.
    const paxByBooking = await b2cPassengerRows([...new Set(itemRows.map(r => String(r.booking_id)))]);
    // Whatever the view did not answer for, read off the column instead — so traveller names import
    // with or without the DDL. Merged per booking, never overwriting a view answer.
    if (paxByBooking.size < new Set(itemRows.map(r => String(r.booking_id))).size) {
      let filled = 0;
      for (const [k, v] of b2cPassengersFromJson(itemRows)) {
        if (!paxByBooking.has(k)) { paxByBooking.set(k, v); if (v.length) filled++; }
      }
      if (filled) console.log(`[b2c-sync] traveller list read off bookings.passengers for ${filled} booking(s) the view did not cover`);
    }

    let srcHash = null;
    if (!singleExtId) {
      srcHash = crypto.createHash('sha1')
        .update('v' + B2C_MAP_VER + '|' + JSON.stringify(itemRows) + '|' + JSON.stringify([...paxByBooking]))
        .digest('hex');
      try {
        const hr = await pool.query('SELECT data FROM app_state WHERE id=$1', ['b2c_sync_hash']);
        if (hr.rows[0] && hr.rows[0].data === srcHash) { _b2cHealthOk(); return; }   // B2C unchanged since last sync
      } catch (_) {}
    }

    // Pickup-area matcher: B2C sends a free-text pickupLocation; resolve it to an ops pickup area
    // only when the match is unambiguous (exact name, else a single substring hit, zone-compatible).
    // No match → area stays unassigned for ops staff (flagged in the booking note).
    let areaRows = [];
    try { ({ rows: areaRows } = await pool.query(`SELECT id, name, zone FROM ${fqt('sb_pickup_areas')}`)); }
    catch (e) { console.warn('[b2c-sync] pickup areas unavailable — skipping area match:', e.message); }
    const _norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
    // Returns the matched area ROW (id + name), not just the id — the mapper needs the name for the
    // ops Zone column as well.
    const findArea = (loc, zone) => {
      const L = _norm(loc);
      if (!L) return null;
      const cand = areaRows.filter(a => !zone || !a.zone || a.zone === zone);
      let hit = cand.filter(a => _norm(a.name) === L);
      if (!hit.length) hit = cand.filter(a => { const N = _norm(a.name); return N.includes(L) || L.includes(N); });
      return hit.length === 1 ? hit[0] : null;
    };

    // Flatten: one allotment booking per line item. Group only to flag the first line of each
    // B2C order (order-level payment attaches to that line — see mapB2CItemBooking).
    const byId = {};
    for (const item of itemRows) { (byId[item.booking_id] = byId[item.booking_id] || []).push(item); }
    const b2cBks = [];
    for (const items of Object.values(byId)) {
      items.sort((a, b) => Number(a.line_no) - Number(b.line_no));
      items.forEach((it, i) => b2cBks.push(mapB2CItemBooking(it, i === 0, findArea, paxByBooking.get(String(it.booking_id)))));
    }
    const tables  = osRepo.decomposeBlob({ sb_bookings: b2cBks });
    const b2cIds  = b2cBks.map(b => b.id);

    const BK_COLS   = OS_COLS['sb_bookings'];
    const TRIP_COLS = OS_COLS['sb_bookings__trips'];
    const PAX_COLS  = OS_COLS['sb_bookings__passengers'];
    const ADN_COLS  = OS_COLS['sb_bookings__addons'];
    // §b2cOwn · ทับได้เฉพาะที่ B2C เป็นเจ้าของ · ที่เหลือทั้งหมดเป็นของ ops และต้องรอดทุกรอบ sync
    const BK_UPDATE = BK_COLS.filter(c => c !== 'id' && B2C_OWN_BK.has(c));
    // ops ของ trip: เก็บทุกคอลัมน์ที่ขึ้นต้น ops_ แบบไดนามิก → ฟิลด์ ops ใหม่รอดเองโดยไม่ต้องมาแก้ที่นี่อีก
    const TRIP_OPS  = TRIP_COLS.filter(c => c.indexOf('ops_') === 0);

    const bkColSql  = BK_COLS.map(qic).join(', ');
    const bkPh      = BK_COLS.map((_, i) => '$' + (i + 1)).join(', ');
    // Sticky cancel: an ops-side cancellation must survive B2C re-sync. B2C can still MOVE a booking INTO
    // a cancelled state (existing not-cancelled → takes EXCLUDED), but can never resurrect one ops cancelled.
    // §opsApproved · เพิ่มชั้นที่สาม: ใบที่ ops กด "อนุมัติ" ไปแล้วต้องเหนียวเท่ากับใบที่ ops ยกเลิก
    //   ลำดับสำคัญ — ยกเลิกฝั่งเรา > ยกเลิกฝั่ง B2C (ลูกค้ายกเลิกจริง ต้องทะลุเข้ามาได้) > อนุมัติแล้ว > ค่าจากต้นทาง
    // §b2cOwn · คอลัมน์ที่ ops ประกาศเป็นเจ้าของ (อยู่ใน b2coverride) ให้คงค่าของเราไว้
    //   §keep · เงินห้าม override เด็ดขาด · ต้องตรงกับที่ลูกค้าจ่ายที่ B2C เสมอ
    const B2C_NO_OVERRIDE = new Set(['status','total','pricebreakdown_seat','pricebreakdown_addon',
      'pricebreakdown_focdiscount','pricebreakdown_discount','pricebreakdown_extra','pricebreakdown_total',
      'paymentsnapshot_method','paymentsnapshot_netdays','paymentsnapshot_source',
      'paymentsnapshot_contractversion','paymentsnapshot_paid','paymentsnapshot_paidstatus']);
    //   เก็บเป็น json_text ของอาร์เรย์ชื่อคอลัมน์ → หาแบบ substring กับรูปแบบที่ใส่เครื่องหมายคำพูดครบ
    //   ('"note"' จึงไม่ไปแมตช์ '"noteX"') · ไม่ต้องมีตารางเพิ่ม ไม่ต้อง join
    const ovrKeep = c => `position('"${c}"' in coalesce(${qic('sb_bookings')}.${qic('b2coverride')}, '')) > 0`;
    const bkSet     = BK_UPDATE.map(c => c === 'status'
      ? `${qic(c)} = CASE`
        + ` WHEN ${qic('sb_bookings')}.${qic(c)} IN ('cancelled','cancelled_weather','rejected') THEN ${qic('sb_bookings')}.${qic(c)}`
        + ` WHEN EXCLUDED.${qic(c)} IN ('cancelled','cancelled_weather','rejected') THEN EXCLUDED.${qic(c)}`
        + ` WHEN ${qic('sb_bookings')}.${qic('approval_status')} = 'approved' THEN ${qic('sb_bookings')}.${qic(c)}`
        + ` ELSE EXCLUDED.${qic(c)} END`
      : B2C_NO_OVERRIDE.has(c)
      ? `${qic(c)} = EXCLUDED.${qic(c)}`
      : `${qic(c)} = CASE WHEN ${ovrKeep(c)} THEN ${qic('sb_bookings')}.${qic(c)} ELSE EXCLUDED.${qic(c)} END`
      ).join(', ');
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

      // 0. Snapshot which of these ids already existed BEFORE this run. The closed-day net (step 5b)
      //    needs to tell a brand-new sale apart from a booking we have merely re-synced, so that an
      //    ad-hoc day closure (weather) does not flip a whole day of already-confirmed bookings.
      _phase = 'snapshot existing ids';
      const preExisting = new Set(
        (await client.query(`SELECT id FROM ${fqt('sb_bookings')} WHERE id = ANY($1)`, [b2cIds])).rows.map(r => r.id)
      );

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
        `SELECT sb_bookings_id, idx, ${TRIP_OPS.map(qic).join(', ')}
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
          // เดิมเช็คแค่ boat/van · trip ที่มีแต่ผลเช็คอิน (ยังไม่จัดเรือ/รถ) เลยไม่ถูกคืนค่า
          if (TRIP_OPS.every(c => ops[c] == null)) continue;
          await client.query(
            `UPDATE ${fqt('sb_bookings__trips')} SET ${TRIP_OPS.map((c, i) => `${qic(c)}=$${i + 1}`).join(', ')}
             WHERE sb_bookings_id=$${TRIP_OPS.length + 1} AND idx=$${TRIP_OPS.length + 2}`,
            [...TRIP_OPS.map(c => ops[c]), bkId, Number(idx)]
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
      //    The id pattern was '^b2c_[0-9]+...', which stopped matching when B2C ids became
      //    LOV-prefixed — so this step quietly did nothing and removed lines stayed confirmed.
      _phase = 'cancel removed lines';
      const presentOrderIds = [...new Set(itemRows.map(i => String(i.booking_id)))];
      await client.query(
        `UPDATE ${fqt('sb_bookings')} SET status='cancelled'
         WHERE id LIKE 'b2c\\_%'
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
          // Same COALESCE requirement as the availability query — without it a B2C row's pax came back
          // NULL, `cum + null > fillLine` was never true, and the oversell net silently never fired.
          `SELECT t.routeid, t.date, b.id, b.status, b.approval_status,
                  (COALESCE(t.pax_ad_fr,0)+COALESCE(t.pax_chd_fr,0)+COALESCE(t.pax_inf_fr,0)+COALESCE(t.pax_foc_fr,0)
                    +COALESCE(t.pax_ad_th,0)+COALESCE(t.pax_chd_th,0)+COALESCE(t.pax_inf_th,0)+COALESCE(t.pax_foc_th,0)
                    +COALESCE(t.pax_ad,0)+COALESCE(t.pax_foc,0))::int AS pax
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
            // §opsApproved · ใบที่ ผจก. อนุมัติแล้วไม่ตีกลับ · แต่ที่นั่งยังนับว่าถูกใช้ไปแล้ว
            //   ใบที่ B2C ขายเกินเข้ามาทีหลังจึงยังโดนตีตราตามปกติ
            if (cum + r.pax > fillLine && /^b2c_/.test(r.id) && r.status === 'confirmed'
                && r.approval_status !== 'approved') toFlag.push(r.id);
            cum += r.pax;
          }
        }
        if (toFlag.length) {
          const fr = await client.query(
            `UPDATE ${fqt('sb_bookings')} SET status='pending_approval'
             WHERE id = ANY($1) AND status='confirmed' AND approval_status IS DISTINCT FROM 'approved'`, [toFlag]);
          console.log(`[b2c-sync] oversell — flagged ${fr.rowCount} B2C booking(s) pending_approval across ${affPairs.length} route/date(s)`);
        }
        // 5b. §closedDay safety net (2026-07-29). The "route does not run that day" guard lives ONLY in the
        //     client wizard (bkV2CommitBooking → missHard). B2C writes straight to Postgres and never sees it,
        //     so a Similan seat was sold for 30 Jul 2026 — inside the 16 May–14 Oct monsoon closure — and
        //     surfaced in By-trip as a normal open trip. /api/b2c/availability cannot help either: it reports
        //     capacity only, and capacity is 0 on nearly every future date because boats are deployed a few
        //     days ahead, so B2C must be ignoring seatsAvailable entirely.
        //     Same treatment as oversell: hold at pending_approval, never delete — B2C may already have taken
        //     the customer's money, and a vanished record is the worse problem.
        //     Reads the very same source of truth as the client: routes__seasons + routes__overrides.
        const affRoutes = [...new Set(affPairs.map(p => p.split(NUL)[0]))];
        const seasonBy = {}, ovrBy = {};
        for (const r of (await client.query(
          `SELECT routes_id, ${qic('type')} AS ty, ${qic('from')} AS f, ${qic('to')} AS t
           FROM ${fqt('routes__seasons')} WHERE routes_id = ANY($1)`, [affRoutes])).rows)
          (seasonBy[r.routes_id] = seasonBy[r.routes_id] || []).push(r);
        for (const r of (await client.query(
          `SELECT routes_id, ${qic('key')} AS k, ${qic('value')} AS v
           FROM ${fqt('routes__overrides')} WHERE routes_id = ANY($1)`, [affRoutes])).rows)
          (ovrBy[r.routes_id] = ovrBy[r.routes_id] || {})[r.k] = String(r.v == null ? '' : r.v).replace(/^"|"$/g, '');
        // Mirrors the client getDayStatus() exactly (allotment_v2.html · §getDayStatus) — including the
        // "outside every declared open season = closed" rule, which is how an expired season list reads.
        const dayStatus = (rid, dk) => {
          const ov = (ovrBy[rid] || {})[dk];
          if (ov) return { type: ov, source: 'override' };
          const ss = seasonBy[rid] || [];
          if (!ss.length) return null;
          const hit = ss.find(x => x.f <= dk && x.t >= dk);
          if (hit) return { type: hit.ty, source: 'season' };
          if (ss.some(x => x.ty === 'open')) return { type: 'closed', source: 'outside-season' };
          return null;
        };
        const closedFlag = [], closedWhy = [];
        for (const pair of affPairs) {
          const [rid, dk] = pair.split(NUL);
          const st = dayStatus(rid, dk);
          if (!st || st.type === 'open') continue;
          for (const r of (bkByKey[pair] || [])) {
            if (!/^b2c_/.test(r.id) || r.status !== 'confirmed') continue;
            if (r.approval_status === 'approved') continue;   // §opsApproved · ops ตัดสินใจแล้วว่าวันนั้นเรือออก
            // A season closure is published months ahead, so a sale inside one is wrong no matter when we
            // notice it → flag every sync (idempotent). A per-day override normally appears AFTER the
            // bookings do (weather call on the morning), so only a sale created in THIS run is flagged.
            if (st.source === 'override' && preExisting.has(r.id)) continue;
            closedFlag.push(r.id);
            closedWhy.push(`${r.id} ${rid}/${dk} (${st.source})`);
          }
        }
        if (closedFlag.length) {
          const cf = await client.query(
            `UPDATE ${fqt('sb_bookings')} SET status='pending_approval'
             WHERE id = ANY($1) AND status='confirmed' AND approval_status IS DISTINCT FROM 'approved'`, [closedFlag]);
          console.log(`[b2c-sync] closed-day — flagged ${cf.rowCount} B2C booking(s) pending_approval: ${closedWhy.join(', ')}`);
        }
      }

      // NOTE: history, upgrades, feeitems, partialcancels, adjustments, over are allotment-owned — never touched here.

      await client.query('COMMIT');
      _b2cHealthOk();
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
    _b2cHealthFail(e);
    console.error(`[b2c-sync] failed at "${e._phase || 'fetch'}" — ${e.message} (consecutive: ${B2C_HEALTH.consecutive})`);
    // Non-fatal: relLoad proceeds even if sync fails — but the app is now told, via /api/version.
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
      // §เก็บเงินหน้าท่า (2026-08-02): bk.pierPayments[] และฟิลด์การรับเงินของ sb_extras
      //   อาการที่เจอ — บันทึกแล้วหน้าจอเปลี่ยน แต่พอ refresh กลับมาเหมือนเดิม
      //   สาเหตุเดียวกับ check-in เมื่อ 25 ก.ค. เป๊ะ: ฟิลด์ใหม่ไม่มีคอลัมน์ → decompose ทิ้ง แล้ว assemble
      //   ก็ไม่มีอะไรจะคืนมา ข้อมูลเลยหายเงียบทุกครั้งที่โหลดจาก cloud
      //   pierPayments เป็น array ที่มี slips[] ซ้อนข้างใน → json_text ทั้งก้อน ไม่ต้องแตกตารางลูก
      await sq('sb_bookings.pierpayments col',
        `ALTER TABLE ${OS_SCHEMA}."sb_bookings" ADD COLUMN IF NOT EXISTS "pierpayments" text`);
      for(const [c,t] of [['feepct','double precision'],['fee','bigint'],['customerpaid','bigint'],['slips','text']]){
        await sq(`sb_extras.${c} col`, `ALTER TABLE ${OS_SCHEMA}."sb_extras" ADD COLUMN IF NOT EXISTS "${c}" ${t}`);
      }
      // §Check-in หน้างาน (2026-07-25): ops.vanCheckin / ops.pierCheckin เก็บผลเช็คอินขึ้นรถ-ขึ้นเรือ
      // (actualPax / noShow / at / by / reasonCode / reasonNote / reasonAt) เป็น json_text เหมือน ops.vanSplits.
      // ไม่มีคอลัมน์ = ข้อมูลเช็คอินหายทุกครั้งที่ refresh จาก cloud และเครื่องอื่นมองไม่เห็น.
      for(const _t of ['sb_bookings','sb_bookings__trips']){
        for(const _c of ['ops_vancheckin','ops_piercheckin']){
          await sq(`${_t}.${_c} col`, `ALTER TABLE ${OS_SCHEMA}."${_t}" ADD COLUMN IF NOT EXISTS "${_c}" text`);
        }
      }
      // §boatSplit (2026-08-02): ops.boatSplits[] — หนึ่งบุคกิ้งลงได้หลายลำ (กรุ๊ปใหญ่ที่ลำเดียวไม่พอ
      // เช่นเหมาลำ 120 คน แต่เรือใหญ่สุดจุ 65) · โครงเดียวกับ ops.vanSplits เป๊ะ → json_text ทั้งก้อน
      // ต้องมาคู่กับ field_mapping.json + operation_schemas_model.json เสมอ — ขาดที่ใดที่หนึ่ง = ข้อมูลหายเงียบ
      for(const _tb of ['sb_bookings','sb_bookings__trips']){
        await sq(`${_tb}.ops_boatsplits col`, `ALTER TABLE ${OS_SCHEMA}."${_tb}" ADD COLUMN IF NOT EXISTS "ops_boatsplits" text`);
      }
      // §pierNote (2026-08-05): ops.pierNote = {t,at,by} — เรื่องที่ลูกค้าแจ้งที่ท่า (ขอนั่งหัวเรือ · เมาเรือ ฯลฯ)
      // อาการเดิมซ้ำรอบที่สาม: บันทึกแล้ว refresh หาย เพราะไม่มีคอลัมน์ → decompose ทิ้ง
      // เก็บเป็นก้อนเดียว json_text จะได้เพิ่มฟิลด์ในโน้ตทีหลังโดยไม่ต้องแตะ backend อีก
      for(const _tb of ['sb_bookings','sb_bookings__trips']){
        await sq(`${_tb}.ops_piernote col`, `ALTER TABLE ${OS_SCHEMA}."${_tb}" ADD COLUMN IF NOT EXISTS "ops_piernote" text`);
      }
      // §Boat capacity override รายวัน (2026-07-25): BOAT_CAP_OVR['YYYY-MM-DD::boatId'] = {cap,reason,by,at}
      // keyed map เหมือน vanjob_driver → 1 ตาราง รองรับทุกลำทุกวัน ไม่ต้องเพิ่มคอลัมน์ตอนมีเรือลำใหม่
      await sq('boat_capovr table', `CREATE TABLE IF NOT EXISTS ${OS_SCHEMA}."boat_capovr" (id text PRIMARY KEY, key text, cap bigint, reason text, "by" text, at text)`);
      // §Travel Summary (2026-07-26): TRAVEL_SUM['YYYY-MM-DD::bookingId'] = {decision,amount,note,by,at}
      await sq('travel_sum table', `CREATE TABLE IF NOT EXISTS ${OS_SCHEMA}."travel_sum" (id text PRIMARY KEY, key text, decision text, amount bigint, note text, "by" text, at text)`);
      // §tsCot · คำตัดสินเงิน COT · เดิมไม่มีตาราง → decompose ทิ้งทุกครั้ง คนอื่นจึงไม่เคยเห็นว่ามีการตัดสินแล้ว
      await sq('ts_cot table', `CREATE TABLE IF NOT EXISTS ${OS_SCHEMA}."ts_cot" (id text PRIMARY KEY, key text, mode text, deduct bigint, payout bigint, ref text, "by" text, at text)`);
      // §trips: ตารางนี้ map แบบระบุชื่อเรือตายตัว (b1_route, b2_route, …) และตกหล่น b8/b14/b15 ไปตั้งแต่ต้น
      // → ถ้าจัด Tadeo / Juliet / Rolanda ลงเส้นทาง การจัดนั้นจะหายตอน sync. เติมคอลัมน์ให้ครบ.
      // ⚠ โครงนี้ยังเปราะ — เรือลำใหม่หลังจากนี้ก็ต้องมาเติมมืออีก (ดู BACKLOG)
      for(const _b of ['b8','b14','b15']){
        for(const [_c,_t] of [['route','text'],['type','text'],['booked','bigint'],['charterbookingid','text']]){
          await sq(`trips.${_b}_${_c} col`, `ALTER TABLE ${OS_SCHEMA}."trips" ADD COLUMN IF NOT EXISTS "${_b}_${_c}" ${_t}`);
        }
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
      // §Boat charter/retired flags (2026-07-24): boats table had no ownership/retired columns, so
      // ownership='charter' (rented boats) and retired were dropped on sync → charter boats reverted to
      // company/Tub Lamu after a refresh. Add the columns so the flags persist through the round-trip.
      await sq('boats.ownership col', `ALTER TABLE ${OS_SCHEMA}."boats" ADD COLUMN IF NOT EXISTS "ownership" text`);
      await sq('boats.retired col', `ALTER TABLE ${OS_SCHEMA}."boats" ADD COLUMN IF NOT EXISTS "retired" boolean`);
      // §Rate/Contract model (2026-07-23 · Phase 1): multiple contracts per agent (main + time-boxed promo
      // overlays). No auto-create for osModel entity tables → create explicitly here. Client store = SB_CONTRACTS.
      await sq('sb_contracts table', `CREATE TABLE IF NOT EXISTS ${OS_SCHEMA}."sb_contracts" (id text PRIMARY KEY, agentid text, kind text, ratetypeid text, activefrom text, activeto text, priority bigint, version text, status text, createddate text, createdby text, note text, docid text)`);
      await sq('sb_contracts__programperiods table', `CREATE TABLE IF NOT EXISTS ${OS_SCHEMA}."sb_contracts__programperiods" (sb_contracts_id text, idx bigint, row_pk text PRIMARY KEY, routeid text, bookfrom text, bookto text, travelfrom text, travelto text, note text)`);
      await sq('sb_contracts__programperiods index', `CREATE INDEX IF NOT EXISTS idx_sbcontracts_pp ON ${OS_SCHEMA}."sb_contracts__programperiods"(sb_contracts_id)`);
      // §fractional memo-item quantities (2026-07-24): qty can be liters/kg (e.g. oil "3.6") and per-item
      // discountpct can be "10.5" — these were bigint → "invalid input syntax for type bigint: 3.6" 500'd the
      // WHOLE sync batch, wedging a user's save. Widen to double precision so the fraction is kept as-is.
      for(const col of ['qty','discountpct','inventorysnapshot_qtyatselection']){
        await sq(`fleet_memos__items.${col} -> double`, `ALTER TABLE ${OS_SCHEMA}."fleet_memos__items" ALTER COLUMN "${col}" TYPE double precision USING "${col}"::double precision`);
      }
      await sq('sb_vehicles.color col', `ALTER TABLE ${OS_SCHEMA}."sb_vehicles" ADD COLUMN IF NOT EXISTS "color" text`);
      // §b2cOwn · รายชื่อคอลัมน์ที่ ops ประกาศเป็นเจ้าของบน booking ของ B2C · sync จะข้ามคอลัมน์เหล่านั้น
      await sq('sb_bookings.b2coverride col', `ALTER TABLE ${OS_SCHEMA}."sb_bookings" ADD COLUMN IF NOT EXISTS "b2coverride" text`);
      await sq('boats.color col', `ALTER TABLE ${OS_SCHEMA}."boats" ADD COLUMN IF NOT EXISTS "color" text`);
      // §B2C paid state (2026-07-30, from lk-inbox): B2C's payment_type is a BILLING TERM
      // (proforma/invoice/bt/cot) and says nothing about whether money arrived — paid state must be
      // derived from total vs Σpayments + Σcredits_applied (done in B2C_ITEM_JOIN, see B2C_MAP_VER 6).
      // paymentSnapshot.deposit/.balance were already being mapped with no column to land in, so they
      // were silently dropped by decomposeBlob and the ERP had no paid figure for B2C at all.
      // These two columns must exist BEFORE the app boots with them in the mapping: OS_COLS drives the
      // INSERT column list for every save, so this DDL runs in the same boot path that adds them.
      await sq('sb_bookings.paymentsnapshot_paid col', `ALTER TABLE ${OS_SCHEMA}."sb_bookings" ADD COLUMN IF NOT EXISTS "paymentsnapshot_paid" bigint`);
      await sq('sb_bookings.paymentsnapshot_paidstatus col', `ALTER TABLE ${OS_SCHEMA}."sb_bookings" ADD COLUMN IF NOT EXISTS "paymentsnapshot_paidstatus" text`);
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
  // §2026-07-25: same trap again — 'vancheckin' (added 07-21), 'piercheckin' (added today) and
  // 'b2b-dash' (added 07-20) existed in the client's LA_NAV but not here, so cleanPerms() silently
  // dropped those ticks on save and the boxes came back empty. Keep this Set in step with LA_NAV.
  // §2026-08-04: ครั้งที่สาม — 'dailyreport' (เพิ่ม 08-02) อยู่ใน LA_NAV แต่ไม่อยู่ใน Set นี้
  // admin ติ๊ก "Daily Report" แล้วกดบันทึก cleanPerms() กรองทิ้งเงียบ ๆ ติ๊กเลยหลุดทุกครั้ง
  'dashboard','calendar','daily','booking','reconfirm','bookingflow','doccheck','operation','insurance','vehicles','vanjobs','vancheckin','piercheckin','travelsum','dailyreport','pickup-setup',
  'agents','sales-board','b2b-dash','rate-types','contract-tmpl','b2c','staff','marketdata','focdetail','pickupmap','dailypfm',
  'fl-dashboard','fl-boatstatus','fl-dailyreport','fl-incident','fl-projects','fl-maintenance','fl-inventory','fl-consumables','fl-cost','fl-insights','fl-fuel','fl-asset',
  'settings','teammkt','addonsvc']);   // 'accounting' already present as a group key
function cleanPerms(a){
  if(!Array.isArray(a)) return null;
  // ดักกับดักเดิม · คีย์ที่ถูกกรองทิ้งให้ log ไว้ ครั้งหน้าจะได้เห็นทันทีว่าลืมเพิ่มใน PERM_KEYS
  const dropped=a.filter(x=>!PERM_KEYS.has(x));
  if(dropped.length) console.warn('[perms] dropped unknown keys (add them to PERM_KEYS):', dropped.join(','));
  return a.filter(x=>PERM_KEYS.has(x));
}
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
const _gzCache = new Map();   // fp -> { etag, br?, gzip? }  (one buffer per encoding)
// §brotli (2026-07-27): measured on the 4.89MB app HTML —
//   gzip -6 1.18MB (87ms) · gzip -9 1.17MB (124ms) · brotli q5 0.98MB (97ms) · brotli q11 0.83MB (7153ms)
// Raising the GZIP level is pointless (0.5% for 40% more CPU); brotli is the real win. Quality is picked
// per call site by HOW LONG THE BUFFER STAYS CACHED, not by payload size:
//   static assets → q11. Cache key is the file etag, so this is paid once per DEPLOY, and the startup
//                   pre-warm below pays it before any user connects. 1.18MB → 0.83MB (-30%).
//   /api/load     → q5.  Cache key is app_state.version, which ANY write bumps — during working hours
//                   this recompresses constantly, so q11 would burn 7s of CPU over and over. q5 costs
//                   about what gzip -6 did and still beats it on size.
const BR_STATIC = 11, BR_DYNAMIC = 5;
// NB: a `br;q=0` / `gzip;q=0` explicit refusal is not parsed — no browser sends it, and the pre-brotli
// code had the same simplification. Everything falls back to plain bytes when neither token is present.
function _accepts(req, enc){ return new RegExp('\\b'+enc+'\\b').test(req.headers['accept-encoding']||''); }
function pickEncoding(req){ return _accepts(req,'br') ? 'br' : _accepts(req,'gzip') ? 'gzip' : null; }
function compress(enc, data, quality, cb){
  if(enc !== 'br') return zlib.gzip(data, cb);
  return zlib.brotliCompress(data, { params: {
    [zlib.constants.BROTLI_PARAM_QUALITY]:  quality,
    [zlib.constants.BROTLI_PARAM_MODE]:     zlib.constants.BROTLI_MODE_TEXT,
    [zlib.constants.BROTLI_PARAM_SIZE_HINT]: Buffer.byteLength(data)
  }}, cb);
}
// §/api/load cache (perf): assembling the ~6MB blob from 103 tables + stringify + gzip on EVERY login was the
// bottleneck (morning stampede: all users re-login at 03:00 reset → server rebuilds the same payload N times).
// Cache the built payload (plain string + gzipped buffer) keyed by app_state.version. A cheap version query gates
// each request; any write bumps version → next load rebuilds. Cache hit = serve the prebuilt buffer instantly.
let _loadCache = null;   // { version, str, br?, gzip? }  (compressed buffers filled in lazily per encoding)
function readBody(req, cb){ let ch=[], n=0; req.on('data',c=>{ n+=c.length; if(n>20*1024*1024){req.destroy();return;} ch.push(c); }); req.on('end',()=>cb(Buffer.concat(ch).toString('utf8'))); }
function J(res, code, obj, extra){ const h=Object.assign({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}, extra||{}); res.writeHead(code,h); res.end(JSON.stringify(obj)); }
// JSON headers · Vary matters as soon as more than one encoding is on offer: without it a proxy can
// hand a brotli body to a client that only asked for gzip.
function _jsonHead(enc){ const h={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Accept-Encoding'};
  if(enc) h['Content-Encoding']=enc; return h; }
// Compressed variant for large payloads — falls back to plain when the client accepts neither encoding
function JZ(req, res, code, obj){
  const body = JSON.stringify(obj);
  const enc = body.length > 50*1024 ? pickEncoding(req) : null;
  if(!enc){ res.writeHead(code,_jsonHead(null)); return res.end(body); }
  compress(enc, body, BR_DYNAMIC, (err, buf)=>{
    if(err){ res.writeHead(code,_jsonHead(null)); return res.end(body); }
    res.writeHead(code,_jsonHead(enc)); res.end(buf);
  });
}
// Send a cached /api/load payload · compress on first send, then reuse the buffer, one per encoding
// (so a version's payload is compressed at most once per encoding, not once per request).
function sendLoadPayload(req, res, cache){
  const enc = pickEncoding(req);
  if(!enc){ res.writeHead(200,_jsonHead(null)); return res.end(cache.str); }
  if(cache[enc]){ res.writeHead(200,_jsonHead(enc)); return res.end(cache[enc]); }
  compress(enc, cache.str, BR_DYNAMIC, (err,buf)=>{
    if(err){ res.writeHead(200,_jsonHead(null)); return res.end(cache.str); }
    cache[enc] = buf;   // remember it → every later hit on this version is instant
    res.writeHead(200,_jsonHead(enc)); res.end(buf);
  });
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
          _loadCache = { version, str };
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
  // Read-only B2C source inspector · GET /api/b2c/raw?id=LOV-1234567
  // Returns the source rows for one B2C booking exactly as the sync sees them (full rows, not the
  // JOIN's projection) alongside what mapB2CItemBooking produces from them. Diagnostic only — used
  // to trace "synced details don't match" reports without guessing at the source schema.
  if(u === '/api/b2c/raw' && req.method === 'GET'){
    const s=session(req); if(!s) return J(res,401,{error:'login required'});
    if(!b2cPool) return J(res,400,{error:'B2C sync not configured'});
    const id = ((q.match(/id=([^&]*)/)||[])[1]) ? decodeURIComponent((q.match(/id=([^&]*)/)||[])[1]) : '';
    if(!id) return J(res,400,{error:'id required'});
    (async () => {
      const out = { id };
      const it = await b2cPool.query(`SELECT row_to_json(bi) AS r FROM ${B2C_ITEM_SOURCE} WHERE bi.booking_id = $1 ORDER BY bi.line_no`, [id]);
      out.booking_items = it.rows.map(x => x.r);
      const bk = await b2cPool.query(`SELECT row_to_json(b) AS r FROM ${b2cT('bookings')} b WHERE b.id = $1`, [id]);
      out.booking = bk.rows[0] ? bk.rows[0].r : null;
      if (out.booking && out.booking.customer_id != null) {
        const c = await b2cPool.query(`SELECT row_to_json(c) AS r FROM ${b2cT('customers')} c WHERE c.id = $1`, [out.booking.customer_id]);
        out.customer = c.rows[0] ? c.rows[0].r : null;
      }
      const paxMap = await b2cPassengerRows([id]);
      out.paxSource = paxMap.has(String(id)) ? B2C_PAX_VIEW : 'bookings.passengers (view unavailable)';
      const j = await b2cPool.query(B2C_ITEM_JOIN + ` AND bi.booking_id = $1 ORDER BY bi.line_no`, [id]);
      if (!paxMap.has(String(id))) {
        for (const [k, v] of b2cPassengersFromJson(j.rows)) if (!paxMap.has(k)) paxMap.set(k, v);
      }
      out.passengers = paxMap.get(String(id)) || [];     // normalised rows, before mapping
      out.mapped = j.rows.map((r, i) => mapB2CItemBooking(r, i === 0, null, paxMap.get(String(id))));
      J(res,200,out);
    })().catch(e => J(res,500,{error:e.message}));
    return;
  }
  if(u === '/api/version'){
    const s=session(req); if(!s) return J(res,401,{error:'login required'}); if(!pool) return J(res,503,{error:'no database'});
    // b2c rides along here rather than on its own endpoint or on SSE: the client already polls this
    // every 10s, and — the reason it must NOT be SSE — a broken B2C sync bumps no version, so an
    // event-driven channel is silent during exactly the outage we need to report.
    pool.query('SELECT version,updated_by,updated_at FROM app_state WHERE id=$1',[STATE_KEY])
      .then(r=>J(res,200, Object.assign(
        r.rows[0]?{version:r.rows[0].version,updated_by:r.rows[0].updated_by,updated_at:r.rows[0].updated_at}:{version:0},
        { b2c: b2cHealthReport() })))
      .catch(e=>J(res,500,{error:e.message}));
    return;
  }
  // Same payload on its own, for uptime checks / curl. 200 when healthy, 503 when not, so an external
  // monitor can watch it without parsing anything. Open to unauthenticated callers — that's the point
  // of a health endpoint — but the raw error text is withheld unless you're logged in: a pg failure
  // message can name internal hosts ("getaddrinfo ENOTFOUND ...railway.internal").
  if(u === '/api/b2c/health'){
    const h = b2cHealthReport();
    if(!session(req)){ delete h.message; delete h.phase; }
    return J(res, h.ok ? 200 : 503, h);
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

  // ───── MAIL IMAGES (Daily Report charts · public read so the recipient's mail client can load them) ─────
  //   เก็บในตาราง attachments เดิม ใช้ booking_id = '__mailimg__' เป็นตัวคั่น ไม่ต้อง migrate
  //   อ่านได้โดยไม่ต้อง login เพราะโปรแกรมเมลของผู้รับไม่มี session — id เป็น token สุ่ม 10 ไบต์ เดาไม่ได้
  //   และเสิร์ฟเฉพาะแถวที่ booking_id ตรงกับตัวคั่นนี้เท่านั้น เอกสารของ booking จริงจึงรั่วทางนี้ไม่ได้
  if(u === '/api/mailimg' && req.method === 'POST'){
    const s=session(req); if(!s) return J(res,401,{error:'login required'});
    if(!pool) return J(res,503,{error:'no database'});
    readBody(req, body=>{
      let b={}; try{ b=JSON.parse(body); }catch(e){ return J(res,400,{error:'invalid JSON'}); }
      let buf=null; try{ buf=Buffer.from(String(b.dataB64||''),'base64'); }catch(e){ buf=null; }
      if(!buf || !buf.length) return J(res,400,{error:'no image data'});
      if(buf.length > 3*1024*1024) return J(res,413,{error:'รูปใหญ่เกิน 3MB'});
      const id = 'mi_'+Date.now().toString(36)+'_'+crypto.randomBytes(10).toString('hex');
      const fn = String(b.filename||'chart.png').slice(0,120);
      pool.query("INSERT INTO attachments(id,booking_id,filename,mime,size,data,uploaded_by) VALUES($1,'__mailimg__',$2,'image/png',$3,$4,$5)",[id,fn,buf.length,buf,s.username])
        .then(()=>{
          // เก็บย้อนหลัง 120 วันพอ · จดหมายเก่ากว่านั้นไม่มีใครเปิดแล้ว
          pool.query("DELETE FROM attachments WHERE booking_id='__mailimg__' AND created_at < now() - interval '120 days'").catch(()=>{});
          J(res,200,{id:id, url:'/m/'+id+'.png'});
        }).catch(e=>J(res,500,{error:e.message}));
    }); return;
  }
  if(u.startsWith('/m/') && req.method === 'GET'){
    const id=decodeURIComponent(u.slice(3)).replace(/\.png$/i,'');
    if(!/^mi_[a-z0-9_]+$/i.test(id)){ res.writeHead(404); return res.end('not found'); }
    if(!pool){ res.writeHead(503); return res.end('no db'); }
    pool.query("SELECT data FROM attachments WHERE id=$1 AND booking_id='__mailimg__'",[id]).then(r=>{
      const row=r.rows[0]; if(!row){ res.writeHead(404); return res.end('not found'); }
      const buf = Buffer.isBuffer(row.data)?row.data:Buffer.from(row.data||'');
      res.writeHead(200,{'Content-Type':'image/png','Content-Length':buf.length,'Cache-Control':'public, max-age=31536000, immutable'});
      res.end(buf);
    }).catch(e=>{ res.writeHead(500); res.end(e.message); }); return;
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
  //
  // ── SELLABILITY CONTRACT (read this before computing anything caller-side) ──────────────────────
  // `seatsAvailable` IS the answer. It is the number of seats a caller with no locks and no approval
  // rights — i.e. the webshop — may sell right now. Do NOT re-derive it from capacity/booked: it
  // already accounts for all of the following, and each one is a rule that has drifted before when
  // re-implemented elsewhere.
  //   · per-day cap overrides set by ops, clamped to the boat's registered seats (§capOverride below)
  //   · chartered boats — removed whole from the pool, they carry no sellable seat
  //   · seat locks held by agents — subtracted; the webshop may never eat a locked seat
  //   · pending_approval bookings — counted as consuming (only cancelled/rejected are excluded)
  //   · closed days (season + override calendar) — forced to 0 regardless of deployed boats
  // `status` says WHY it is 0, so a caller never has to guess: 'open' · 'sold_out' (boats out, full)
  // · 'not_deployed' (ops has not assigned a boat yet) · 'closed' (route does not run).
  // Sell when `status === 'open' && seatsAvailable >= paxNeeded`. Nothing else needs computing.
  //
  // What this endpoint deliberately does NOT expose: the two higher tiers the in-app booking engine
  // can reach — drawing an agent's locked seats, and over-cap-but-within-license sales that a manager
  // approves (bkV2CommitBooking · allotment_v2.html). Those are staff actions with a human in the
  // loop; a webshop must not reach them, which is why seatsAvailable stops at the sellable tier.
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
      // booked seats per date (seat-mode trips only, non-cancelled bookings).
      // Every term MUST be COALESCE'd: in Postgres a + b is NULL if either side is NULL, and SUM()
      // skips NULLs — so a single unset pax column silently reported booked = 0 for the whole day.
      // pax_foc_fr/pax_foc_th are never written (client and B2C mapper both store a flat pax.foc), so
      // they were NULL on every trip row and zeroed the count — every B2C booking went invisible here
      // and the endpoint reported seats that were in fact already sold.
      // Column set + double-count semantics mirror the client's getTripPaxTotal (allotment_v2.html:9843):
      // flat pax_ad/pax_foc are legacy shapes, mutually exclusive with the _fr/_th split.
      // (Fixed twice independently — local 5fbfa57 and remote bd0e1b5; same 10 columns, merged here.)
      pool.query(
        `SELECT t.date,
                COALESCE(SUM(COALESCE(t.pax_ad,0)     + COALESCE(t.pax_ad_fr,0)  + COALESCE(t.pax_ad_th,0)
                           + COALESCE(t.pax_chd_fr,0) + COALESCE(t.pax_chd_th,0)
                           + COALESCE(t.pax_inf_fr,0) + COALESCE(t.pax_inf_th,0)
                           + COALESCE(t.pax_foc,0)    + COALESCE(t.pax_foc_fr,0) + COALESCE(t.pax_foc_th,0)), 0)::int AS booked
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
      // licensepax rides along for the cap-override clamp below.
      pool.query(`SELECT id, cap, licensepax FROM ${fqt('boats')}`),
      pool.query(`SELECT * FROM ${fqt('trips')} WHERE ${qic('key')} >= $1 AND ${qic('key')} <= $2`, [dateFrom, dateTo]),
      // §closedDay (2026-07-29) · the open/closed calendar. Until now this endpoint answered with capacity
      // ONLY, and capacity is 0 on almost every future date (boats get deployed a few days ahead), so a
      // caller cannot tell "not deployed yet" from "route does not run at all" — which is how a Similan seat
      // was sold for 30 Jul 2026, right inside the 16 May–14 Oct monsoon closure.
      pool.query(`SELECT routes_id, ${qic('type')} AS ty, ${qic('from')} AS f, ${qic('to')} AS t
                  FROM ${fqt('routes__seasons')} WHERE routes_id = $1`, [routeId]),
      pool.query(`SELECT ${qic('key')} AS k, ${qic('value')} AS v
                  FROM ${fqt('routes__overrides')} WHERE routes_id = $1`, [routeId]),
      // §capOverride (2026-08-04) · ops' per-day seat override · BOAT_CAP_OVR['YYYY-MM-DD::boatId'].
      // Without this the endpoint answers from boats.cap alone, so a boat ops opened up for one day still
      // reports "fully booked" (Aluminous2, 4 Aug 2026: cap 44 raised to 46, B2C refused at 44/44).
      // left(key,10): the key is '<date>::<boatId>', so a plain key<=dateTo drops same-day ranges
      // ('2026-08-04::b10' > '2026-08-04').
      pool.query(`SELECT ${qic('key')} AS k, cap FROM ${fqt('boat_capovr')}
                  WHERE left(${qic('key')},10) >= $1 AND left(${qic('key')},10) <= $2`, [dateFrom, dateTo]),
    ]).then(([bkRes, lockRes, rtRes, boatRes, tripRes, seasonRes, ovrRes, capOvrRes]) => {
      const bookedMap = {}, lockedMap = {};
      for (const r of bkRes.rows)   bookedMap[r.date]  = r.booked;
      for (const r of lockRes.rows) lockedMap[r.date]  = r.locked;
      const boatCap = {}, boatLic = {}, boatIds = [];
      for (const b of boatRes.rows) { boatCap[b.id] = Number(b.cap) || 0; boatLic[b.id] = Number(b.licensepax) || 0; boatIds.push(b.id); }
      const capOvr = {};
      for (const r of capOvrRes.rows) { if (r.cap != null && !isNaN(Number(r.cap))) capOvr[r.k] = Number(r.cap); }
      // Mirrors the client boatCapInfo() (allotment_v2.html · §Boat capacity override) 1:1, INCLUDING the
      // clamp to registered seats (licensePax, falling back to cap when unset). Without the clamp this API
      // could advertise a seat bkV2CommitBooking then hard-blocks — a sale the customer completes on the
      // webshop and ops cannot honour.
      const capFor = (bid, dk) => {
        const base = boatCap[bid] || 0;
        const o = capOvr[dk + '::' + bid];
        if (o == null) return base;
        let c = Math.max(0, Math.round(o));
        const lic = boatLic[bid] || base;
        if (lic > 0) c = Math.min(c, lic);
        return c;
      };
      const tripsByDate = {};
      for (const r of tripRes.rows) tripsByDate[r.key] = r;
      // Mirrors the client getDayStatus() (allotment_v2.html · §getDayStatus) 1:1, including the
      // "outside every declared open season = closed" rule — that is how an expired season list reads,
      // and it is what makes a route whose seasons stop at 31 Dec look shut for the whole following year.
      const _seasons = seasonRes.rows, _ovr = {};
      for (const r of ovrRes.rows) _ovr[r.k] = String(r.v == null ? '' : r.v).replace(/^"|"$/g, '');
      const dayStatus = dk => {
        if (_ovr[dk]) return { type: _ovr[dk], source: 'override' };
        if (!_seasons.length) return null;
        const hit = _seasons.find(x => x.f <= dk && x.t >= dk);
        if (hit) return { type: hit.ty, source: 'season' };
        if (_seasons.some(x => x.ty === 'open')) return { type: 'closed', source: 'outside-season' };
        return null;
      };
      // build all dates in range
      const dates = [];
      for (let d = new Date(dateFrom + 'T00:00:00Z'); d.toISOString().slice(0,10) <= dateTo; d.setUTCDate(d.getUTCDate()+1)) {
        const dk = d.toISOString().slice(0, 10);
        const booked = bookedMap[dk] || 0, locked = lockedMap[dk] || 0;
        const trow = tripsByDate[dk] || {};
        let capacity = 0, deployed = 0, capOverridden = false;
        for (const bid of boatIds) {
          if (trow[bid + '_route'] === routeId && trow[bid + '_type'] !== 'charter') {
            const c = capFor(bid, dk);
            if (c !== (boatCap[bid] || 0)) capOverridden = true;
            capacity += c; deployed++;
          }
        }
        const st = dayStatus(dk);
        const closed = !!(st && st.type !== 'open');
        // A closed day has no sellable seat by definition — report 0 even if boats happen to be deployed,
        // so a caller that only reads seatsAvailable is still protected.
        const seatsAvailable = closed ? 0 : Math.max(0, capacity - booked - locked);
        // §sellability (2026-08-04) · why seatsAvailable is 0. A caller cannot tell "sold out" from "route
        // does not run" from "ops hasn't deployed a boat yet" out of a bare 0, and those need three
        // different messages to the customer. Derived here so no caller re-implements the rule.
        const status = closed ? 'closed' : (!deployed ? 'not_deployed' : (seatsAvailable > 0 ? 'open' : 'sold_out'));
        dates.push({ date: dk, capacity, bookedSeats: booked, lockedSeats: locked, totalConsumed: booked + locked, seatsAvailable,
                     closed, closedReason: closed ? st.source : null,
                     // additive · sellability contract · see the endpoint header comment
                     status, boatsDeployed: deployed, capacityOverridden: capOverridden });
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
    const head=(enc)=>{ const h={'Content-Type':ctype,'ETag':etag,'Cache-Control':'no-cache','Vary':'Accept-Encoding'};
      if(enc) h['Content-Encoding']=enc; return h; };
    const enc = (GZIP_EXT.has(ext) && data.length > 1024) ? pickEncoding(req) : null;
    if(enc){
      // Cache entry holds one buffer per encoding, both keyed on the same etag — a br client and a
      // gzip client hitting the same file must not evict each other's buffer.
      const hit=_gzCache.get(fp), fresh = hit && hit.etag===etag;
      if(fresh && hit[enc]){ res.writeHead(200,head(enc)); return res.end(hit[enc]); }
      return compress(enc, data, BR_STATIC, (cErr,buf)=>{
        if(cErr){ res.writeHead(200,head(null)); return res.end(data); }
        const slot = fresh ? hit : {etag};
        slot[enc]=buf; _gzCache.set(fp,slot);
        res.writeHead(200,head(enc)); res.end(buf); });
    }
    res.writeHead(200,head(null)); res.end(data); });
});
// Pre-warm the app HTML's brotli buffer at startup. q11 takes ~7s on the 4.9MB file — cheap once per
// deploy, but only if nobody is waiting on it, so pay it here rather than on the first user's request.
// Same fp/etag derivation as the static handler above, or the cache would not be hit.
function prewarmStatic(){
  const fp = path.normalize(path.join(ROOT,'/allotment_v2/allotment_v2.html'));
  fs.readFile(fp,(err,data)=>{ if(err||!data) return;
    const etag='"'+crypto.createHash('sha1').update(data).digest('hex').slice(0,20)+'"';
    const t0=Date.now();
    compress('br', data, BR_STATIC, (cErr,buf)=>{ if(cErr) return;
      const hit=_gzCache.get(fp), slot=(hit&&hit.etag===etag)?hit:{etag};
      slot.br=buf; _gzCache.set(fp,slot);
      console.log('[prewarm] app html br: '+(data.length/1048576).toFixed(2)+'MB -> '
        +(buf.length/1048576).toFixed(2)+'MB in '+(Date.now()-t0)+'ms'); });
  });
}
server.listen(PORT, ()=>{ console.log('LOVE Andaman on '+PORT+(pool?' · db on':' · db off')); prewarmStatic(); });

// §B2C background poller (2026-07-24): relSyncB2C only ran on /api/load, so a new B2C booking sat in
// the source pool until someone manually refreshed. Poll it on a timer so new bookings are pulled in,
// which bumps app_state.version + SSE (updated_by:'B2C') → connected clients auto-refresh + alert.
// Guarded so a slow run never overlaps itself; skipped entirely when the B2C source DB isn't configured.
let _b2cPolling = false;
const B2C_POLL_MS = Number(process.env.B2C_POLL_MS) || 45000;
if (pool && b2cPool) {
  setInterval(async () => {
    if (_b2cPolling) return;
    _b2cPolling = true;
    try { await relSyncB2C(); }
    catch (e) { try { console.warn('[b2c-poll] sync failed:', e.message); } catch(_){} }
    finally { _b2cPolling = false; }
  }, B2C_POLL_MS);
  console.log('[b2c-poll] background B2C sync every ' + Math.round(B2C_POLL_MS/1000) + 's');
}
