// B2C → ops booking mapper · lifted verbatim out of server.js (2026-10-03, §b2cMapMod) so the
// import can be tested. Pure functions only: no DB, no pool, no env. relSyncB2C in server.js still
// does all the I/O and calls in here. Bump B2C_MAP_VER (server.js) whenever the OUTPUT changes.
// Every past import bug is pinned by a fixture in test/unit/b2c-map.test.mjs — add one with each fix.
// ── Program → ops route (2026-08-31) ───────────────────────────────────────────────────────────
// DAY TRIPS no longer live here. B2C owns the answer already — programs_own.ops_route_id, filled
// for every program — and this table was a second copy of it that could only ever fall behind.
// It did: B2C added POW-006 (Nyaung Oo Phee) and POW-007 (Phang-nga bay + Hong Krabi Early bird),
// both correctly mapped on the B2C side, while this constant still stopped at POW-005. Four
// bookings imported with routeId null and rendered a bare "—" where the route name goes.
// Day trips now resolve through b2cProgramRouteCatalog() — see there for the fallback order.
//
// PRIVATE ROUTES stay, because there is nothing to read: private_routes has (id, name, duration,
// description) and no ops_route_id column, and private_own items carry no details.opsRouteId
// either — verified on prod, all 8 rows null. PR-* → route is only known here. Retiring these four
// means adding ops_route_id to private_routes on the B2C side first; until then, this is the map.
const B2C_ROUTE_MAP = {
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

// B2C bookings.payment_type — mirrors SB_PAYMENT_TYPES ids in the app. Whitelisted so an unexpected
// value can't leak into the Pay column (bkV2PayLabel falls through to the raw string).
const B2C_PAY_TYPES = new Set(['proforma', 'invoice', 'bt', 'cot']);

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

// §b2cDiscShare (2026-09-07) · The order-level discount / surcharge belongs to the WHOLE order, so it
// has to be split across the order's lines by value — not handed whole to the first line.
//
// The old rule (all of it on line 0) survived only because every order carrying a discount so far was
// single-line or all-tour. LOV-3488828 broke it: a 21,198 order = a 15,800 HOTEL line + a 5,398 boat
// line, with a 17,796 discount (credit carried over from voucher VC.22903). This sync imports tour
// lines only (B2C_ITEM_JOIN's `type IN ('day_trip','private_own')`), so the hotel line never arrives —
// and the whole 17,796 landed on the 5,398 boat line: 3,598 + 1,800 − 17,796 = −12,398, which
// Math.max(0, …) then flattened into a ฿0 booking that looked deliberate.
//
// Denominator = the ORDER subtotal (bk_subtotal — every line, INCLUDING the ones filtered out), which
// is what the discount was actually given against. Numerator = each synced line's own subtotal. When a
// non-tour line was filtered out, Σ(imported lines) is deliberately LESS than the order total: the rest
// of the discount belongs to the line that isn't in ops. When every line came through, the rounding
// remainder goes to the last line so Σ lines still equals the order total exactly.
//
// seat + addOn === round(item.subtotal) for every line (see b2cLineMoney), so pro-rating on subtotal is
// the same basis the ops-side money is built from.
function _shareLabel(label, share, orderAmt) {
  const full = Math.max(0, Math.round(Number(orderAmt) || 0));
  return (full && share !== full)
    ? String(label) + ' · เฉพาะส่วนของรายการนี้ (ทั้งบิล ' + full.toLocaleString('en-US') + ')'
    : String(label);
}

function b2cAllocAdjust(items) {
  const h0 = items[0] || {};
  const lineSum  = items.reduce((s, it) => s + Math.round(Number(it.subtotal) || 0), 0);
  const orderSum = Math.round(Number(h0.bk_subtotal) || 0);
  // Trust whichever basis is larger: a missing/stale bk_subtotal must never let the shares add up to
  // more than 100% of the discount.
  const denom = Math.max(orderSum, lineSum);
  const whole = denom > 0 && denom === lineSum;   // nothing was filtered out → the shares must sum exactly
  const split = (amt) => {
    if (!amt) return items.map(() => 0);
    if (denom <= 0) return items.map((_, i) => (i === 0 ? amt : 0));   // no basis to split on → old behaviour
    const out = items.map(it => Math.round(amt * (Math.round(Number(it.subtotal) || 0) / denom)));
    if (whole) out[out.length - 1] += amt - out.reduce((s, x) => s + x, 0);
    return out;
  };
  const disc  = split(Math.max(0, Math.round(Number(h0.bk_discount)  || 0)));
  const extra = split(Math.max(0, Math.round(Number(h0.bk_surcharge) || 0)));
  return items.map((_, i) => ({ disc: disc[i], extra: extra[i] }));
}

// details.addonsSelected → ops addOns[{type,label,amount,qty,note}].
// Ops identifies an add-on by the literal `type` string — bkV2AddOnFlags matches 'longtail-join',
// 'longtail-charter' and a 'transfer-' prefix, and ops has no id registry of its own to look
// anything up in (sb_addon_types is empty). B2C's `code` uses the same slugs, so it maps 1:1.
// NB 'join-transfer-phuket' is the shared van to the pier, NOT a private transfer — it does not
// carry the 'transfer-' prefix on purpose, or ops would advertise a private car nobody bought.
// B2C started sending code/qtyAdult/qtyChild on 2026-08-06; older entries carry only {qty, addonId}.
// For those the name and the slug are recovered from the program's add-on catalog, keyed on the
// (program, addon_id) PAIR — see b2cAddonCatalog for why the id alone is not an identity. An entry
// the catalog cannot answer for still gets a namespaced type ('b2c-ad-001') that deliberately
// matches none of the ops patterns above: importing it as a generic line is honest, whereas
// guessing "longtail" from an unknown code would put phantom boats on the pier.
//
// The label is the NAME ONLY. Every renderer that shows an add-on appends the quantity itself, so
// baking "× 4" into the label printed it twice ("Join Transfer ( Phuket ) × 4 ×4").
function b2cMapAddOns(det, addOnTotal, programId, addonCat) {
  const arr = (det && Array.isArray(det.addonsSelected)) ? det.addonsSelected : [];
  if (!arr.length) return [];
  const rows = arr.map(a => {
    const id   = String((a && a.addonId) || '').trim();
    const cat  = (addonCat && id) ? addonCat.get(b2cAddonKey(programId, id)) : null;
    const code = String((a && a.code) || (cat && cat.code) || '').trim().toLowerCase();
    const type = code || (id ? 'b2c-' + id.toLowerCase() : 'b2c-addon');
    const qty  = Math.round(Number(a && a.qty) || 0) || 1;
    const ad = Number(a && a.qtyAdult), ch = Number(a && a.qtyChild);
    const name = String((a && a.name) || (cat && cat.name) || '').trim() || `B2C add-on ${id || '?'}`;
    // Mirror the B2B label shape ("Longtail Join (2A + 0C)") when B2C sent the adult/child split.
    const label = (Number.isFinite(ad) && Number.isFinite(ch)) ? `${name} (${ad}A + ${ch}C)` : name;
    // Per-entry money, best source first. The order is correctness, not preference:
    //   1. a.amount / a.unitPrice — what B2C actually charged, promos and overrides already applied.
    //      Authoritative. B2C started sending these on 2026-08-06.
    //   2. cat.price — the catalog LIST price, and only a fallback for the older entries that carry
    //      nothing but {qty, addonId}. It is today's price, not the price this booking paid: AD-002
    //      is 500 in the catalog and was charged at 400 on the 2026-07 orders. So it is verified
    //      against the real total below and dropped when it disagrees.
    // Before 2026-08-14 every entry was hardcoded to 0 and all of this was discarded.
    const fromB2C = Math.round(Number(a && a.amount) || 0)
                 || Math.round((Number(a && a.unitPrice) || 0) * qty);
    const fromCat = Math.round((cat && Number(cat.price) || 0) * qty);
    return { type, label, amount: Math.max(0, fromB2C || fromCat), qty, note: '', _listPriced: !fromB2C && fromCat > 0 };
  });
  const total = Math.max(0, Math.round(addOnTotal) || 0);
  // subtotal − seat is what the customer was charged, so it is the arbiter. If the lines do not add
  // up to it, a list price we guessed with is wrong for this booking — drop those back to 0 rather
  // than print a confident figure against a named product. Lines B2C priced itself are kept either
  // way: they are the charge, and any residual difference belongs to the seat/add-on split, not here.
  if (rows.some(r => r._listPriced) && rows.reduce((n, r) => n + r.amount, 0) !== total) {
    for (const r of rows) if (r._listPriced) r.amount = 0;
  }
  // With a single entry the combined figure IS that entry's amount — arithmetic, not a guess. With
  // several it cannot be split, so they stay 0 and priceBreakdown.addOn carries the money.
  if (rows.length === 1 && !rows[0].amount) rows[0].amount = total;
  for (const r of rows) delete r._listPriced;
  return rows;
}

// One allotment booking PER B2C booking_item — items sit at booking level, not nested as trips.
// id = b2c_<booking_id>_<line_no>; voucher = the B2C booking_id verbatim (no added prefix —
// new B2C ids already carry their own LOV- prefix); each carries a single trip.
// isFirstLine: order-level payment (deposit/balance) attaches only to the first line of the order,
// so a multi-item order's payment isn't multiplied across its item-bookings.
// adjust: this line's {disc, extra} share of the order-level discount / surcharge — see b2cAllocAdjust.
function mapB2CItemBooking(item, isFirstLine, findArea, paxRows, addonCat, progCat, adjust, trfCat, extCat) {
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
  // §b2cTransfer · a genuine open-date transfer (is_open_date true) has nothing to dispatch until
  // Sales activates a date, so it is not a booking ops can act on yet. Note this is NOT the same as
  // the pre-fix rows that lost their travel_date: those carry is_open_date false and still import,
  // arriving with a null date so they surface as something to fix rather than disappearing.
  const isOpenDate = String(h.is_open_date || '').toLowerCase() === 'true' || h.is_open_date === true;
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
  // §b2cDiscShare · this line's PRO-RATA share, not the whole order-level figure. `adjust` is absent
  // only if a caller was missed; fall back to the pre-2026-09-07 all-on-line-0 rule rather than dropping
  // the discount entirely, which would over-report the sale.
  const discAmt  = adjust ? Math.max(0, Math.round(Number(adjust.disc)  || 0))
                          : (isFirstLine ? Math.max(0, Math.round(Number(h.bk_discount)  || 0)) : 0);
  const extraAmt = adjust ? Math.max(0, Math.round(Number(adjust.extra) || 0))
                          : (isFirstLine ? Math.max(0, Math.round(Number(h.bk_surcharge) || 0)) : 0);
  // Σ lines = the order total. The add-on has to be in here: it is inside bi.subtotal and inside
  // bookings.total, so leaving it out made an add-on line import 1,000 short of what the guest paid
  // (LOV-4190737: total 7,000 against paid 8,000) and read as overpaid in accounting.
  const lineTotal = Math.max(0, seat + addOn - discAmt + extraAmt);
  // A share still bigger than the line it sits on means the split has no honest basis (a discount that
  // exceeds the order subtotal, or a bk_subtotal that does not match its own lines). The clamp keeps the
  // booking importable, but it is silently wrong money — say so, or it reads as a deliberate ฿0 sale.
  if (discAmt > seat + addOn + extraAmt) {
    console.warn('[b2c] discount share exceeds line value · ' + h.booking_id + ' line ' + h.line_no
      + ' · seat ' + seat + ' + addOn ' + addOn + ' - disc ' + discAmt + ' -> clamped to 0');
  }
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
  // §b2cBy · คนที่คีย์ใบนี้ฝั่ง B2C. bookings.booked_by_name/_email เป็นพนักงาน LOVE Andaman
  // (bd@ / rung@ / noon@ …) ไม่ใช่ลูกค้า — 157/157 ใบมีค่าเสมอ. ลงช่อง createdBy เพราะทุกจอฝั่ง ops
  // ("ผู้บันทึก" ในใบเช็คอิน · "Submitted by" ในหน้ารายละเอียด · voucher) อ่านช่องนี้อยู่แล้ว
  // ค่าเดิมคือสตริงตายตัว 'b2c_sync' ซึ่งไม่บอกอะไรกับสตาฟฟ์เลย.
  const bookedBy = String(h.booked_by_name || '').trim()
                || String(h.booked_by_email || '').trim().split('@')[0]
                || '';
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
  //   pickupHotel    the hotel itself, free text, never linked to a hotels table. §b2cNoHotel
  //                  (2026-09-14): ops does not want it, so it is never read below at all.
  //
  // Feeding the hotel into findArea cannot work — 'Blu Monkey Hub Hotel Phuket' matches no area,
  // while 'Phuket Town' matches exactly. Match on the area, store the area (never the hotel).
  // hotelName/pickupZone/pickupSelf are B2C-owned (refreshed every sync); pickupAreaId is matched
  // best-effort against sb_pickup_areas and preserved on conflict (pickupareaid is NOT in B2C_OWN_BK).
  let det = h.details;
  if (typeof det === 'string') { try { det = JSON.parse(det); } catch (_) { det = null; } }
  det = det || {};
  // §b2cTransfer · a transfer is its own kind of line and must be tested BEFORE isCharter: its
  // product ids are TR-xxx, which isPrivateId does not claim, but the `h.type !== 'day_trip'` half
  // of that condition would otherwise sweep it up the moment an id shape changed.
  const isTransfer = h.type === 'transfer';
  if (isTransfer && isOpenDate) return null;   // §b2cTransfer · no date = nothing to dispatch yet
  const isCharter = !isTransfer && (h.type === 'private_own' || (h.type !== 'day_trip' && (isPrivateId(h.product_id) || isPrivateId(h.route_id))));
  const detailProgramId = String(det.programId || det.productId || det.routeId || '').trim();
  const routeLookupId = isCharter
    ? (isPrivateId(h.product_id) ? h.product_id : (isPrivateId(h.route_id) ? h.route_id : detailProgramId))
    : (isPowId(h.product_id) ? h.product_id : (isPowId(h.route_id) ? h.route_id : detailProgramId));
  // routeLookupId stays the B2C PROGRAM id — b2cMapAddOns keys the add-on catalog on it, and that
  // key must never become an ops route id. The ops route is resolved separately, below.
  //
  // Order matters, and it is not "newest field first":
  //   1. programs_own.ops_route_id — B2C's catalog. Covers every row ever imported, including the
  //      60 older day trips written before details.opsRouteId existed (added ~2026-08).
  //   2. details.opsRouteId — what the order itself was booked against. Second, not first, so a
  //      program later re-pointed at a different ops route re-syncs to the new one; also the only
  //      source if the catalog read failed or the program was deleted from it.
  //   3. B2C_ROUTE_MAP — private charters only now; day trips can no longer reach it.
  //   4. §b2cTransfer · transfer_services.ops_route_id, for transfer lines only. Its own table and
  //      its own id namespace (TR-003), so it is consulted first for those and never for the rest.
  //      details.transferId is the fallback for rows written before product_id was persisted — four
  //      exist on prod and two of them are live bookings.
  const transferKey = isTransfer
    ? String(h.product_id || det.transferId || det.transferld || '').trim().toUpperCase()
    : '';
  //   5. §b2cTransfer · routes.extid — our own record of which B2C product a route was made for.
  //      Last of the id-based sources on purpose: B2C's catalog states current intent, this states
  //      origin, and a product re-pointed at another route must follow the catalog.
  /* §b2cVariant · a B2C product with variants maps to ONE OPS ROUTE PER VARIANT — that is what a
     route already is here (r7/r8/r9/r10 are four variants of the same Phi Phi trip, each with its
     own departure and its own seat prices). TR-003 sells a 6-hour and an 8-hour city tour at
     different rates, and ops needs to read which one it is off the voucher and the job sheet.

     transfer_services.ops_route_id is per SERVICE and cannot carry two answers, so the per-variant
     mapping lives on OUR side instead: routes.extid = 'TR-003:v2'. Nothing changes on the B2C
     side. Falls back to the product-level key, so a service with no per-variant routes keeps
     resolving exactly as before. */
  const variantId = String(h.variant_id || det.variantId || '').trim();
  const extKeyBase = isTransfer ? transferKey : String(routeLookupId || h.product_id || '').trim().toUpperCase();
  const extKeyVar = (extKeyBase && variantId) ? (extKeyBase + ':' + variantId.toUpperCase()) : '';
  const extKey = extKeyBase;
  /* §b2cVariant · the per-variant route comes FIRST, ahead of every product-level source.
     It is strictly the more specific answer: TR-003 resolves one route for the whole city-tour
     service, TR-003:V2 resolves the 8-hour one. If somebody has gone to the trouble of creating a
     route for a single variant, that is the intent, and letting the service-level mapping answer
     first would mean it could never win. Absent a per-variant route this term is simply empty and
     the order below is unchanged. */
  const opsRouteId = (extCat && extKeyVar && extCat.get(extKeyVar))
    || (isTransfer ? (trfCat && trfCat.get(transferKey)) : null)
    || (progCat && progCat.get(String(routeLookupId || '').trim().toUpperCase()))
    || String(det.opsRouteId || '').trim()
    || (extCat && extKey && extCat.get(extKey))
    || B2C_ROUTE_MAP[routeLookupId]
    || null;
  // §b2cTransfer · what dispatch actually needs off a transfer line. qty is VEHICLES — confirmed
  // against the B2C write path (subtotal = rate(vehicleType) × max(1, qty)), so it never means pax.
  // NULL on the four pre-fix rows; those are one vehicle.
  const vehQty  = isTransfer ? Math.max(1, Math.round(Number(h.qty) || 0) || 1) : 0;
  const vehType = isTransfer ? String(det.vehicleType || '').trim().toLowerCase() : '';
  const vehDir  = isTransfer ? String(det.direction || '').trim() : '';
  const pickupArea  = String(det.pickupLocation || '').trim();   // area name  → matches sb_pickup_areas
  // §b2cHotelAppend (2026-09-21): reverses the pickup half of §b2cNoHotel — ops wants the guest's
  // hotel back, but APPENDED to the area rather than replacing it: "Layan · Blu Monkey Hub". The area
  // leads because that is what dispatch groups and sorts by (vanJobsOrderInner, the check-in Pickup
  // column, ckPickShort's truncation all read the head of this string); the hotel follows as the
  // actual address the driver needs. Empty either side and the separator does not appear.
  //
  // This string is NEVER fed to findArea — see the areaHit line below. That was the v4→v5 bug:
  // matching 'Layan · Blu Monkey Hub' against the 37 ops areas resolves to nothing, so every booking
  // carrying a hotel arrived with no pickupAreaId at all. Match on the area alone, always.
  const pickupHotel = String(det.pickupHotel || '').trim();      // hotel → free text, no hotels table
  const pickupLoc  = [pickupArea, pickupHotel].filter(Boolean).join(' · ');
  const noTransfer = det.noTransfer === true;
  const pickupZone = noTransfer ? 'NoTransfer' : String(det.pickupZone || '').trim();
  const areaHit = (typeof findArea === 'function') ? findArea(pickupArea, pickupZone) : null;
  const areaId  = areaHit ? areaHit.id : null;
  // The ops Zone column prints the area NAME (bk.pickupArea), so a B2C row that carried an area but
  // matched nothing showed a bare dash. Pass the name through either way: the ops area's own wording
  // when it matched, else B2C's raw text so staff at least see what the customer picked.
  const areaName = areaHit ? areaHit.name : pickupArea;
  // Drop-off. Until §b2cDrop the mapper read det.dropoffSame only as a gate and returned nothing but
  // dropoffHotelName, so sb_bookings.dropoffsame stayed NULL on all 215 B2C rows. Every ops consumer
  // tests it strictly (bkV2RetInfo · bkDropOf · vanJobsOrderInner · the booking card and detail row all
  // do `dropoffSame === false`), and NULL is not false — so a separate drop-off was stored and then
  // hidden everywhere, and the return van grouped under the PICKUP area. LOV-5003086 (pickup Panwa,
  // drop-off KIRI Restaurant Naithon Beach) is the case that surfaced it.
  //
  // B2C's own flag cannot be piped through verbatim: 24 of the 28 items carrying dropoffSame:false are
  // NoTransfer self-arrive orders whose dropoffLocation just repeats the pickup pier ("Visit Panwa
  // Pier" → "Visit Panwa Pier"). Trusting those would raise 24 false "returns elsewhere, no return van
  // arranged" alerts. Require a genuinely different place before telling ops the return leg differs.
  const _dnorm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  // §b2cNoHotel (2026-09-14): the DROP-OFF half stands — det.dropoffHotel is still never read.
  // §b2cHotelAppend only reversed the pickup side; B2C's drop-off box is a place, not a hotel.
  const dropoffRaw = String(det.dropoffLocation || '').trim();
  // §b2cHotelAppend · "is this drop-off really the pickup point again?" now has THREE ways to be true,
  // because pickupLoc is a composite. Comparing against the composite alone would mean a drop-off that
  // repeats just the hotel ('Blu Monkey Hub' vs 'Layan · Blu Monkey Hub') no longer matches, and ops
  // gets a false "returns elsewhere, no return van arranged" alert on a booking that returns to the
  // same door. Test the area, the hotel and the combined string.
  const _samePick = s => {
    const n = _dnorm(s);
    return n === _dnorm(pickupArea) || n === _dnorm(pickupLoc)
        || (!!pickupHotel && n === _dnorm(pickupHotel));
  };
  const dropoffSep = det.dropoffSame === false && !noTransfer && !!dropoffRaw && !_samePick(dropoffRaw);
  const dropoffLoc = dropoffSep ? dropoffRaw : '';
  // B2C has no dropoffArea field at all — only the one free-text dropoffLocation ("KIRI Restaurant,
  // Naithon Beach"), unlike pickup where pickupLocation is already a clean area name. findArea's
  // substring pass handles it (L.includes(N) → 'naithon'), and it returns null unless the hit is
  // unique, so an ambiguous string leaves the area unassigned rather than guessing. Try the pickup
  // zone first, then zone-free: a drop-off can legitimately be in another zone, and B2C sends none.
  const dropAreaHit = (dropoffSep && typeof findArea === 'function')
    ? (findArea(dropoffLoc, pickupZone) || findArea(dropoffLoc, '')) : null;
  const dropAreaId = dropAreaHit ? dropAreaHit.id : null;
  // Unlike pickupArea this does NOT fall back to the raw text: dropoffLoc is free-text place text, not
  // a matched area, and it would print raw customer text in the ops Zone column. dropoffHotelName
  // already carries it (§b2cNoHotel: that raw text is never the guest's hotel now, just the location).
  const dropAreaName = dropAreaHit ? dropAreaHit.name : '';
  const trip = {
    id: 'b2c_' + h.booking_id + '_' + h.line_no + '_t0',
    routeId: opsRouteId,
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
  // §b2cNat · real Thai head-count for the park fee, kept apart from the PRICE fields above.
  // pax.ad_th/_fr picks the seat rate (B2C sells the whole party at the Thai price when the lead
  // is Thai — paxAllThai), but the park counter charges by passport. trip.nat is the ops field
  // for exactly that (§pkNat, js/08-app.js bkNatTH). B2C knows every traveller's nationality —
  // customer = lead, bookings.passengers = everyone else — so when that list accounts for every
  // head on the line, count it. LOV-7485231: lead TH + TH + US, priced 3 ad_th, park page read 3
  // Thai instead of 2 Thai 1 foreign. Anything short of a full, fully-labelled list → no nat at
  // all, and the park page falls back to the price fields as before. Kids in a MIXED party are
  // also left alone: passengers carry no age type, so which head is the child is unknowable.
  {
    const P = trip.pax;
    const heads = P.ad_fr + P.ad_th + P.chd_fr + P.chd_th + P.inf_fr + P.inf_th + P.foc;
    const nats = [leadNat].concat((Array.isArray(paxRows) ? paxRows : [])
      .filter(r => r && (r.name || r.nationality)).map(r => r.nationality || ''));
    if (heads > 0 && nats.length === heads && nats.every(Boolean)) {
      const th = nats.filter(n => n === 'TH').length;
      const kids = P.chd_fr + P.chd_th + P.inf_fr + P.inf_th + P.foc;
      if (th === heads) trip.nat = { ad: P.ad_fr + P.ad_th, chd: P.chd_fr + P.chd_th, inf: P.inf_fr + P.inf_th, foc: P.foc };
      else if (th === 0 || !kids) trip.nat = { ad: th, chd: 0, inf: 0, foc: 0 };
    }
  }
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
    createdBy: bookedBy || 'b2c_sync',   // §b2cBy
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
    // §b2cDrop · dropoffSame is the gate every ops consumer reads; true = same as pickup, matching the
    // in-app default (bkV2 seeds dropoffSame:true). dropoffAreaId/dropoffArea are best-effort and stay
    // OUT of B2C_OWN_BK, exactly like pickupAreaId — ops fixes the match by hand and B2C must not
    // stomp it (that hand-assigned 'Naithon' on LOV-5003086 is the reason the rule exists).
    dropoffSame: !dropoffSep,
    dropoffHotelName: dropoffLoc,
    dropoffAreaId: dropAreaId,
    dropoffArea: dropAreaName,
    // §b2cSreq (2026-09-02): the two free-text boxes B2C sales fills in on the item — "Special request
    // (sent to ops team)" and "Internal remark". Neither used to cross over at all, so a private
    // charter booked with the boat name typed into the special request arrived here blank.
    //
    // They land in `notes`, NOT in `note` below: `notes` is the field ops actually reads — it prints as
    // the Special request on van job orders (vanJobsSreqAuto), as Request on the boat job sheet, and as
    // "Notes / special request" on the booking detail. `note` is the B2C breadcrumb line and shows only
    // inside the booking card. One field for both, because ops has nowhere else to put the remark; the
    // "Remark:" prefix keeps the two readable apart.
    //
    // B2C sales very often paste the same text into both boxes (14 of the 14 remarks on file at the
    // time of writing repeat their special request verbatim). Appending blindly printed it twice on
    // the boat job sheet, so an identical remark is dropped rather than echoed.
    notes: (() => {
      const sreq = String(h.special_request || '').trim();
      const rem  = String(h.remark || '').trim();
      // §b2cTransfer · a transfer's dispatch facts have no column of their own on a trip, and the one
      // thing ops must not have to guess is how many cars and what size. `notes` is where that belongs:
      // it is what vanJobsSreqAuto prints as the Special request on the van job order, so the driver
      // sheet carries it with no schema change. Leading line, before the customer's own text, because
      // it is the instruction rather than the request.
      const veh = isTransfer ? (() => {
        const size = vehType === 'sedan' ? 'Sedan' : vehType === 'van' ? 'Van' : (vehType || 'Vehicle');
        const route = [String(det.pickupLocation || '').trim(), String(det.dropoffLocation || '').trim()]
          .filter(Boolean).join(' → ');
        return [size + ' × ' + vehQty, vehDir ? '(' + vehDir.replace(/_/g, ' ') + ')' : '', route]
          .filter(Boolean).join(' · ');
      })() : '';
      return [veh, sreq, (rem && rem !== sreq) ? 'Remark: ' + rem : ''].filter(Boolean).join('\n');
    })(),
    note: ['B2C', h.channel_name, String(h.booking_id), B2C_PRODUCT_NAME[h.product_id] || B2C_PRODUCT_NAME[h.route_id] || h.product_id,
           // Show ops the AREA that failed to match, not the hotel — the area is what they need to
           // pick by hand, and naming it makes a missing sb_pickup_areas entry obvious.
           (!areaId && !noTransfer && (pickupArea || pickupLoc))
             ? `Pickup: ${pickupArea || pickupLoc}${pickupZone ? ' (' + pickupZone + ')' : ''} — area unassigned` : null,
           // Same flag for the return leg: a separate drop-off whose free text matched no area needs a
           // hand-assigned dropoffAreaId or vanJobsOrderInner groups the return van under the pickup area.
           (dropoffSep && !dropAreaId)
             ? `Drop-off: ${dropoffLoc} — area unassigned` : null].filter(Boolean).join(' · '),
    trips: [trip],
    passengers: isFirstLine ? b2cPassengerList(paxRows) : [],
    addOns: b2cMapAddOns(det, addOn, routeLookupId, addonCat),
    // Display rows for the Total panel. bkV2 stores adjustments as positive values with a kind, and
    // acctBookingTotal never re-applies them (the total already accounts for them) — so these are
    // presentational only and cannot double-count.
    // §b2cDiscShare · when this line carries only PART of an order-level discount, say so on the row.
    // The B2C label is written about the whole bill ("ยกยอดทั้งหมดมาจาก VC.22903 จำนวน 17,596 บาท"), so
    // printing it beside a smaller pro-rata number reads as an error unless the split is spelled out.
    adjustments: [
      ...(discAmt  ? [{ kind: 'discount', mode: 'amount', value: discAmt,  label: _shareLabel(h.bk_discount_label  || 'Discount',  discAmt,  h.bk_discount),  note: '' }] : []),
      ...(extraAmt ? [{ kind: 'extra',    mode: 'amount', value: extraAmt, label: _shareLabel(h.bk_surcharge_label || 'Surcharge', extraAmt, h.bk_surcharge), note: '' }] : []),
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
      // Math.round for the same reason paidAmt has it (~441): these columns are bigint, and B2C
      // stores money as numeric WITH satang — a deposit of 5831.78 went in raw and Postgres rejected
      // the whole statement, which failed the entire sync rather than just this field. Every other
      // money column here is already whole baht, so rounding keeps them consistent.
      deposit: isFirstLine ? Math.round(Number(h.bk_deposit) || 0) : 0,
      balance: isFirstLine ? Math.round(Number(h.bk_balance) || 0) : 0,
      method: payType,
      paid: isFirstLine ? paidAmt : 0,
      paidStatus: paidStatus,
    },
    ops: {},
    history: [],
  };
}

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
  lao:'LA', laos:'LA', laotian:'LA', cambodian:'KH', cambodia:'KH',
};
// ICU answers for withdrawn ISO-3166-3 codes too, and 15 country names therefore resolve to TWO
// codes. Whichever the scan hit last used to win, which is how 'Serbia' became YU (Yugoslavia),
// 'Russia' SU (Soviet Union), 'France' FX and 'Timor-Leste' TP. Skipping the withdrawn codes leaves
// exactly one live code per name — verified against the full A–Z sweep, all 15 collisions resolved.
// The tail is ICU's non-country aggregates: ZZ in particular is 'Unknown Region', so a guest whose
// nationality reads "Unknown" was about to be stamped with a country code.
const B2C_NAT_SKIP = new Set([
  'AN','BU','CS','DD','DY','FX','HV','NH','RH','SU','TP','UK','VD','YD','YU','ZR',   // withdrawn
  'EU','EZ','QO','UN','XA','XB','ZZ',                                                // not countries
]);
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
        if (B2C_NAT_SKIP.has(cc)) continue;
        let nm = ''; try { nm = dn.of(cc) || ''; } catch (_) {}
        if (nm && nm !== cc) _b2cNatByName[nm.toLowerCase()] = cc;
      }
    } catch (_) {}
  }
  if (_b2cNatByName[k]) return _b2cNatByName[k];
  return b2cNatFromDemonym(k);
}

// Last resort for a demonym the alias table happens not to carry. The table is hand-maintained, so
// every market nobody thought of lands in ops with a BLANK nationality and no warning — 'Slovak'
// (LOV-9260122) and 'Qatari' were both sitting like that, while ICU knows 'Slovakia' and 'Qatar'
// perfectly well. This bridges the two.
//
// It only ever answers when a transform lands on a REAL ICU country name, and the prefix rule only
// when exactly ONE country matches — so 'Congo' (two) and 'Ind' (India + Indonesia) are refused
// rather than guessed. Anything it cannot place returns '' exactly as before, which the client
// already handles by guessing from the name.
//   'Qatari' → Qatar · 'Indian' → India · 'Egyptian' → Egypt · 'Romanian' → Romania
//   'Slovak' → Slovakia (prefix)
function b2cNatFromDemonym(k) {
  if (!_b2cNatByName || k.length < 4) return '';
  for (const c of [k.replace(/i$/, ''), k.replace(/n$/, ''), k.replace(/ian$/, ''),
                   k.replace(/ese$/, ''), k.replace(/ish$/, '')]) {
    if (c.length >= 4 && c !== k && _b2cNatByName[c]) return _b2cNatByName[c];
  }
  const hits = [...new Set(Object.keys(_b2cNatByName)
    .filter(n => n.startsWith(k)).map(n => _b2cNatByName[n]))];
  return hits.length === 1 ? hits[0] : '';
}

const b2cAddonKey = (programId, addonId) =>
  String(programId || '').trim().toUpperCase() + '::' + String(addonId || '').trim().toUpperCase();


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

// Pickup-area matcher: B2C sends a free-text pickupLocation; resolve it to an ops pickup area
// only when the match is unambiguous (exact name, else a single substring hit, zone-compatible).
// No match → area stays unassigned for ops staff (flagged in the booking note).
// Returns the matched area ROW (id + name), not just the id — the mapper needs the name for the
// ops Zone column as well.
function b2cFindArea(areaRows) {
  const _norm = s => String(s || '').toLowerCase().replace(/s+/g, ' ').trim();
  return (loc, zone) => {
    const L = _norm(loc);
    if (!L) return null;
    const cand = areaRows.filter(a => !zone || !a.zone || a.zone === zone);
    let hit = cand.filter(a => _norm(a.name) === L);
    if (!hit.length) hit = cand.filter(a => { const N = _norm(a.name); return N.includes(L) || L.includes(N); });
    return hit.length === 1 ? hit[0] : null;
  };
}

// Flatten: one allotment booking per line item. Group to flag the first line of each B2C order
// (order-level payment attaches to that line) and to split the order-level discount / surcharge
// across the lines by value — see mapB2CItemBooking and b2cAllocAdjust.
function mapB2COrders(itemRows, { findArea, paxByBooking, addonCat, progCat, trfCat, extCat }) {
  const byId = {};
  for (const item of itemRows) { (byId[item.booking_id] = byId[item.booking_id] || []).push(item); }
  const b2cBks = [];
  for (const items of Object.values(byId)) {
    items.sort((a, b) => Number(a.line_no) - Number(b.line_no));
    const adj = b2cAllocAdjust(items);   // §b2cDiscShare · order-level discount/surcharge split by line value
    // §b2cTransfer · the mapper returns null for a line ops cannot act on (an open-date transfer).
    // Filtered here rather than before mapping so adj[i] keeps its index alignment with items.
    items.forEach((it, i) => {
      const rec = mapB2CItemBooking(it, i === 0, findArea, paxByBooking.get(String(it.booking_id)), addonCat, progCat, adj[i], trfCat, extCat);
      if (rec) b2cBks.push(rec);
    });
  }
  return b2cBks;
}

// ── §b2cCheck · post-import checks ───────────────────────────────────────────────────────────────
// Every B2C import bug so far had the same shape: the mapper could not work something out, fell back
// to null / 0 / a default without a word, and the booking looked fine until someone on the floor
// noticed a wrong number (B2C_MAP_VER v4–v31 is that list). These checks run on the mapper's OUTPUT
// next to the source rows and name each booking that came through wrong or half-known, so it shows
// up the minute it imports instead of at the pier. They only REPORT — nothing here changes a booking.
//
// sev 'warn' = the data ops sees is wrong or missing and someone has to act.
// sev 'info' = known gap the mapper deliberately left for ops (e.g. no pickup-area match).
const B2C_THAI_NAT = 'TH';
function _b2cRawNat(p) { return String((p && p.nationality) || '').trim(); }
// opsNat (optional) = Set of booking-line ids that already carry a hand-entered trip.nat in ops —
// the sync restores those after the re-insert, so a mixed party ops already counted is not flagged.
const B2C_DEAD = new Set(['cancelled', 'cancelled_weather', 'rejected']);
function b2cCheckOrders(itemRows, b2cBks, paxByBooking, opsNat) {
  const issues = [];
  const byOrder = new Map();
  for (const it of itemRows) {
    const k = String(it.booking_id);
    if (!byOrder.has(k)) byOrder.set(k, []);
    byOrder.get(k).push(it);
  }
  const bkByLine = new Map(b2cBks.map(b => [b.id, b]));
  for (const [ref, items] of byOrder) {
    const add = (bk, sev, code, msg) => issues.push({ id: bk ? bk.id : 'b2c_' + ref, ref, sev, code, msg });
    const lines = items.map(it => bkByLine.get('b2c_' + it.booking_id + '_' + it.line_no) || null);
    const h0 = items[0];
    // A cancelled order needs nothing from anyone — never nag about it.
    if (!lines.some(b => b && !B2C_DEAD.has(b.status))) continue;

    // Nationality text B2C had that b2cNatCode could not read — lands blank and the park fee
    // falls back to the price fields (v19 'Slovak' / 'Qatari').
    const leadRaw = String(h0.bk_customer_nat || h0.crm_nationality || '').trim();
    const firstBk = lines.find(Boolean);
    if (leadRaw && firstBk && !firstBk.leadNationality)
      add(firstBk, 'warn', 'nat_unread', 'อ่านสัญชาติผู้จองไม่ออก: "' + leadRaw + '" · ต้องเพิ่มคำนี้ใน B2C_NAT_ALIAS');
    let rawPax = h0.bk_passengers;
    if (typeof rawPax === 'string') { try { rawPax = JSON.parse(rawPax); } catch (_) { rawPax = null; } }
    if (Array.isArray(rawPax)) {
      const bad = [...new Set(rawPax.map(_b2cRawNat).filter(t => t && !b2cNatCode(t)))];
      if (bad.length && firstBk)
        add(firstBk, 'warn', 'nat_unread', 'อ่านสัญชาติผู้โดยสารไม่ออก: ' + bad.map(t => '"' + t + '"').join(', ') + ' · ต้องเพิ่มใน B2C_NAT_ALIAS');
    }
    const travellers = [firstBk ? firstBk.leadNationality : ''].concat(
      ((paxByBooking && paxByBooking.get(ref)) || []).filter(r => r && (r.name || r.nationality)).map(r => r.nationality || ''));

    items.forEach((it, i) => {
      const bk = lines[i];
      if (bk && B2C_DEAD.has(bk.status)) return;
      if (!bk) { add(null, 'info', 'not_imported', 'บรรทัด ' + it.line_no + ' (' + (it.type || '?') + ') ไม่ได้นำเข้า · เช่น รถรับส่งที่ยังไม่ระบุวัน'); return; }
      const t = (bk.trips && bk.trips[0]) || {};
      const P = t.pax || {};
      const isTransfer = String(it.type || '') === 'transfer';
      const heads = (+P.ad_fr || 0) + (+P.ad_th || 0) + (+P.chd_fr || 0) + (+P.chd_th || 0)
                  + (+P.inf_fr || 0) + (+P.inf_th || 0) + (+P.foc || 0);
      if (!t.routeId) add(bk, 'warn', 'route', 'หาเส้นทางไม่เจอ (' + (it.product_id || '?') + ') · ไม่ขึ้นในเรือ/ใบงานจนกว่าจะเลือกเส้นทางเอง');
      if (!t.date) add(bk, 'warn', 'date', 'ไม่มีวันเดินทาง');
      if (!isTransfer && heads <= 0) add(bk, 'warn', 'pax0', 'จำนวนคนเป็น 0 · ไม่กินที่นั่งและไม่ขึ้นในใบงาน');

      // Park fee: the whole party was priced Thai off the LEAD alone (B2C sent no split of its own —
      // paxAllThai), nobody has a real-nationality count, yet a traveller we know of is not Thai.
      // The park page will buy Thai tickets for a foreigner. When B2C DID send pax_thai/pax_foreign
      // the price fields already are the nationality, so there is nothing to flag.
      const thPriced = (+P.ad_th || 0) + (+P.chd_th || 0) + (+P.inf_th || 0);
      const leadOnly = !((+it.pax_thai || 0) > 0 || (+it.pax_foreign || 0) > 0);
      if (!isTransfer && leadOnly && thPriced > 0 && !t.nat && !(opsNat && opsNat.has(bk.id))
          && travellers.some(n => n && n !== B2C_THAI_NAT)) {
        const known = travellers.filter(Boolean).length;
        const why = known >= heads
          ? 'มีเด็กในกลุ่มที่ปนสัญชาติ ระบบไม่รู้ว่าเด็กคือใคร'
          : 'รู้สัญชาติแค่ ' + known + ' จาก ' + heads + ' คน';
        add(bk, 'warn', 'nat_mix', 'ขายราคาคนไทยทั้ง ' + thPriced + ' ที่ แต่ในใบมีต่างชาติ (' + why + ')'
          + ' · หน้าค่าอุทยานจะนับเป็นคนไทยหมด · กรอกสัญชาติจริงในใบ');
      }

      // Money: the breakdown must add up to the line total ops bills from.
      const pb = bk.priceBreakdown || {};
      const sum = (+pb.seat || 0) + (+pb.addOn || 0) + (+pb.focDiscount || 0) + (+pb.discount || 0) + (+pb.extra || 0);
      if (Math.abs(sum - (+pb.total || 0)) > 1)
        add(bk, 'warn', 'money_parts', 'ยอดแยกรวมไม่เท่ายอดบรรทัด (' + sum + ' ≠ ' + (+pb.total || 0) + ')');
      if (Math.abs((+bk.total || 0) - (+pb.total || 0)) > 1)
        add(bk, 'warn', 'money_total', 'total ≠ priceBreakdown.total (' + (+bk.total || 0) + ' ≠ ' + (+pb.total || 0) + ')');

      if (!isTransfer && !bk.pickupSelf && !bk.pickupAreaId && (bk.hotelName || bk.pickupArea))
        add(bk, 'info', 'pickup_area', 'จับคู่จุดรับไม่ได้: "' + (bk.pickupArea || bk.hotelName) + '" · ต้องเลือกพื้นที่รับเอง');
    });

    // The order total B2C charged must cover what we imported. Less is normal (hotel / third-party
    // lines are not ops lines); MORE means a discount or credit got lost on the way (v10, v25).
    const imported = lines.filter(Boolean).reduce((a, b) => a + (+b.total || 0), 0);
    const charged = Number(h0.bk_total);
    if (Number.isFinite(charged) && charged > 0 && imported > charged + 1)
      add(firstBk, 'warn', 'money_order', 'ยอดที่นำเข้า ' + imported + ' มากกว่าที่ลูกค้าจ่ายจริง ' + charged);
  }
  return issues;
}

module.exports = {
  b2cCheckOrders,
  b2cFindArea,
  mapB2COrders,
  B2C_ROUTE_MAP,
  B2C_PRODUCT_NAME,
  B2C_PAY_TYPES,
  mapB2CStatus,
  b2cPayCode,
  b2cLineMoney,
  b2cLineSeat,
  b2cAllocAdjust,
  b2cMapAddOns,
  mapB2CItemBooking,
  B2C_NAT_ALIAS,
  B2C_NAT_SKIP,
  b2cNatCode,
  b2cNatFromDemonym,
  b2cAddonKey,
  b2cPassengersFromJson,
  b2cPassengerList,
};
