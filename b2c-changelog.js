// §b2cChg (2026-10-08) · write a history line when the B2C sync changes a booking
//
// The owner: "B2C bookings sync automatically. When B2C edits one, it changes silently on By trip
// date. How can we tell?" The sync overwrites B2C-owned columns and re-inserts trips, but it never
// wrote anything to the booking's history, so nobody could see what had moved.
//
// What this does, inside relSyncB2C's transaction:
//   1. snapshot()  reads the fields ops cares about for the bookings about to be upserted (before).
//   2. relSyncB2C runs its upsert and safety nets exactly as before.
//   3. snapshot()  again (after), diff() the two, and writeEntries() appends ONE row per changed
//      booking to sb_bookings__history (kind 'b2c', tag 'B2C', by 'B2C sync').
//      A booking seen for the first time gets kind 'b2c_new' instead.
// The client (§b2cChg in js/08-app.js) shows a line under that booking's row on By trip date until
// someone presses "Seen", which appends kind 'b2c_seen' through the normal booking save.
//
// No schema change: sb_bookings__history already has at/kind/text/tag/by. The diff is carried in
// `text` in a fixed, parseable shape, one segment per field joined by ' · ':
//      "Pax: 2 Ad → 3 Ad · Hotel: Patong Bay → Kata Beach"
// so the client can merge several unseen entries into one line (Pax 2 → 3 → 4).
// Values are scrubbed of ' → ' and ' · ' so the shape cannot be broken by data.
//
// Pure functions here; the only I/O is through the db handle the caller passes in.
'use strict';

const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const STATUS = { confirmed: 'Confirmed', pending_approval: 'Pending approval', cancelled: 'Cancelled',
  cancelled_weather: 'Cancelled (weather)', rejected: 'Rejected', pending: 'Pending' };
const PAID = { paid: 'Paid', unpaid: 'Unpaid', deposit: 'Deposit' };
// Booking columns compared (only those that exist in the live schema are read).
const BK_FIELDS = ['status','total','leadpax','leadphone','leademail','hotelname','dropoffhotelname',
  'pickupself','pickuparea','note','notes','paymentsnapshot_paidstatus'];
const PAX_GROUPS = { ad: ['pax_ad_fr','pax_ad_th','pax_ad'], chd: ['pax_chd_fr','pax_chd_th'],
  inf: ['pax_inf_fr','pax_inf_th'], foc: ['pax_foc_fr','pax_foc_th','pax_foc'] };

const clean = v => {
  if (v === null || v === undefined) return '';
  return String(v).replace(/\s+/g, ' ').replace(/ ?→ ?/g, ' -> ').replace(/ ?· ?/g, ', ').trim();
};
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
const show = (v, n) => { const s = cut(clean(v), n || 60); return s || '—'; };
const fmtDate = d => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || ''));
  return m ? (Number(m[3]) + ' ' + MON[Number(m[2]) - 1]) : show(d);
};
const fmtMoney = v => {
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  return isFinite(n) ? '฿' + Math.round(n).toLocaleString('en-US') : show(v);
};
const fmtPax = t => {
  const parts = [];
  if (t.ad) parts.push(t.ad + ' Ad');
  if (t.chd) parts.push(t.chd + ' Chd');
  if (t.inf) parts.push(t.inf + ' Inf');
  if (t.foc) parts.push(t.foc + ' FOC');
  return parts.join(' + ') || '0';
};
const yes = v => v === true || v === 'true' || v === 't' || v === 1 || v === '1';

// Read the comparable state of `ids`. Returns Map(id → {bk, trips[], named, addons}).
async function snapshot(db, ids, o) {
  const out = new Map();
  if (!ids || !ids.length) return out;
  const { fqt, qic } = o;
  const bkCols = BK_FIELDS.filter(c => o.bkCols.includes(c));
  const bkRows = (await db.query(
    `SELECT id${bkCols.map(c => ', ' + qic(c)).join('')} FROM ${fqt('sb_bookings')} WHERE id = ANY($1)`, [ids])).rows;
  for (const r of bkRows) out.set(r.id, { bk: r, trips: [], named: 0, addons: '' });

  const paxCols = [].concat(...Object.values(PAX_GROUPS)).filter(c => o.tripCols.includes(c));
  const tCols = ['idx', 'routeid', 'date', 'bookingmode'].filter(c => o.tripCols.includes(c)).concat(paxCols);
  for (const r of (await db.query(
    `SELECT sb_bookings_id${tCols.map(c => ', ' + qic(c)).join('')} FROM ${fqt('sb_bookings__trips')}
     WHERE sb_bookings_id = ANY($1) ORDER BY sb_bookings_id, idx`, [ids])).rows) {
    const s = out.get(r.sb_bookings_id); if (!s) continue;
    const pax = {};
    for (const [k, cs] of Object.entries(PAX_GROUPS)) pax[k] = cs.reduce((a, c) => a + (Number(r[c]) || 0), 0);
    s.trips.push({ idx: Number(r.idx) || 0, routeid: r.routeid || '', date: r.date || '', mode: r.bookingmode || '', pax });
  }
  if (o.paxCols && o.paxCols.includes('name')) {
    for (const r of (await db.query(
      `SELECT sb_bookings_id, count(*) FILTER (WHERE coalesce(btrim(${qic('name')}), '') <> '')::int AS n
       FROM ${fqt('sb_bookings__passengers')} WHERE sb_bookings_id = ANY($1) GROUP BY sb_bookings_id`, [ids])).rows) {
      const s = out.get(r.sb_bookings_id); if (s) s.named = Number(r.n) || 0;
    }
  }
  if (o.adnCols && o.adnCols.includes('label')) {
    const hasQty = o.adnCols.includes('qty');
    const byBk = {};
    for (const r of (await db.query(
      `SELECT sb_bookings_id, ${qic('label')} AS l${hasQty ? ', ' + qic('qty') + ' AS q' : ''}
       FROM ${fqt('sb_bookings__addons')} WHERE sb_bookings_id = ANY($1)`, [ids])).rows) {
      const l = clean(r.l); if (!l) continue;
      const q = hasQty ? Number(r.q) || 0 : 0;
      (byBk[r.sb_bookings_id] = byBk[r.sb_bookings_id] || []).push(q > 1 ? l + ' x' + q : l);
    }
    for (const [id, arr] of Object.entries(byBk)) { const s = out.get(id); if (s) s.addons = arr.sort().join(', '); }
  }
  return out;
}

// Compare two snapshots of one booking → array of "Label: old → new" segments ([] = no change).
function diff(a, b, ctx) {
  ctx = ctx || {};
  const rn = id => (ctx.routeName && ctx.routeName(id)) || id || '—';
  const segs = [];
  const add = (label, x, y) => { if (x !== y) segs.push(label + ': ' + x + ' → ' + y); };

  const multi = Math.max(a.trips.length, b.trips.length) > 1;
  const tl = (label, i) => multi ? label + ' (trip ' + (i + 1) + ')' : label;
  if (a.trips.length !== b.trips.length) add('Trips', String(a.trips.length), String(b.trips.length));
  const n = Math.min(a.trips.length, b.trips.length);
  for (let i = 0; i < n; i++) {
    const x = a.trips[i], y = b.trips[i];
    add(tl('Date', i), fmtDate(x.date), fmtDate(y.date));
    add(tl('Route', i), show(rn(x.routeid)), show(rn(y.routeid)));
    add(tl('Pax', i), fmtPax(x.pax), fmtPax(y.pax));
  }
  const A = a.bk || {}, B = b.bk || {};
  const st = v => STATUS[v] || show(v);
  add('Status', st(A.status), st(B.status));
  add('Lead', show(A.leadpax, 40), show(B.leadpax, 40));
  add('Phone', show(A.leadphone, 30), show(B.leadphone, 30));
  add('Email', show(A.leademail, 40), show(B.leademail, 40));
  add('Hotel', show(A.hotelname, 50), show(B.hotelname, 50));
  add('Drop-off', show(A.dropoffhotelname, 50), show(B.dropoffhotelname, 50));
  add('Pickup area', show(A.pickuparea, 40), show(B.pickuparea, 40));
  if ('pickupself' in A || 'pickupself' in B) add('Self-arrive', yes(A.pickupself) ? 'Yes' : 'No', yes(B.pickupself) ? 'Yes' : 'No');
  add('Total', fmtMoney(A.total), fmtMoney(B.total));
  const pd = v => PAID[v] || show(v);
  add('Paid', pd(A.paymentsnapshot_paidstatus), pd(B.paymentsnapshot_paidstatus));
  add('Note', show(A.note, 50), show(B.note, 50));
  add('Request', show(A.notes, 50), show(B.notes, 50));
  if (a.named !== b.named) add('Names', a.named + ' listed', b.named + ' listed');
  add('Add-ons', show(a.addons, 60), show(b.addons, 60));
  return segs;
}

// Build the history rows for one sync run.
//   before / after : Map from snapshot()
//   isNew(id)      : true when the booking did not exist before this run
function entries(before, after, ctx) {
  const out = [];
  for (const [id, b] of after) {
    const a = before.get(id);
    if (!a) {
      if (ctx && ctx.logNew === false) continue;
      const t = b.trips[0];
      const where = t ? (fmtDate(t.date) + ' · ' + show((ctx && ctx.routeName && ctx.routeName(t.routeid)) || t.routeid)
        + ' · ' + fmtPax(t.pax)) : '';
      out.push({ id, kind: 'b2c_new', tag: 'B2C', text: 'New booking from B2C' + (where ? ' · ' + where : '') });
      continue;
    }
    const segs = diff(a, b, ctx);
    if (segs.length) out.push({ id, kind: 'b2c', tag: 'B2C', text: segs.join(' · ') });
  }
  return out;
}

// Append rows to sb_bookings__history after each booking's current last idx.
async function writeEntries(db, list, o) {
  if (!list.length) return 0;
  const { fqt, qic } = o;
  const cols = o.histCols;
  const ids = [...new Set(list.map(e => e.id))];
  const next = {};
  for (const r of (await db.query(
    `SELECT sb_bookings_id, max(idx)::bigint AS m FROM ${fqt('sb_bookings__history')}
     WHERE sb_bookings_id = ANY($1) GROUP BY sb_bookings_id`, [ids])).rows) next[r.sb_bookings_id] = Number(r.m) + 1;
  const at = o.at || new Date().toISOString();
  let k = 0, n = 0;
  const stamp = Date.now().toString(36);
  for (const e of list) {
    const idx = next[e.id] || 0; next[e.id] = idx + 1;
    const row = { sb_bookings_id: e.id, idx, row_pk: 'sb_bookings__history:' + stamp + 'c' + (k++).toString(36),
      at, kind: e.kind, text: e.text, tag: e.tag, by: o.by || 'B2C sync' };
    const use = cols.filter(c => c in row);
    await db.query(
      `INSERT INTO ${fqt('sb_bookings__history')} (${use.map(qic).join(', ')}) VALUES (${use.map((_, i) => '$' + (i + 1)).join(', ')})`,
      use.map(c => row[c]));
    n++;
  }
  return n;
}

module.exports = { snapshot, diff, entries, writeEntries, _fmt: { fmtDate, fmtMoney, fmtPax, clean } };
