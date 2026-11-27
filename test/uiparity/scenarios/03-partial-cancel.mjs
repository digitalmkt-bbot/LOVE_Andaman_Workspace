// Scenario 3 · booking: partial cancel with a fee (2 adults off, 1 of them charged)
// Legacy flow (08-app.js): Booking › the booking's detail (bkV2OpenDetail, what its row click calls) ›
// "Reduce pax" (bkV2DetailPartial → bkV2PartialModal) › remove 2 adults (#bkp-rm-ad_fr, bkV2PartialRecalc) ›
// reason (#bkp-cat) › charge 1 (#bkp-chg-cnt; the amounts are suggested from the per-pax price) ›
// "Confirm reduce" (bkV2PartialConfirm → bkV2PartialCancel).
const n = (x) => (x == null ? null : Number(x));
export default {
  name: 'partial-cancel',
  title: 'partial cancel: 2 adults off, 1 charged',
  async prepare({ legacy, ops, addDays, today }) {
    // a confirmed agent booking, one seat trip at least 3 days ahead, 4+ foreign adults, priced, never reduced
    const rows = await legacy(`SELECT b.id, b.leadpax AS lead FROM operation_schemas.sb_bookings b
        JOIN operation_schemas.sb_bookings__trips t ON t.sb_bookings_id = b.id
      WHERE b.status = 'confirmed' AND b.agentid <> 'a_b2c' AND b.id NOT LIKE 'b2c_%' AND b.total > 0
        AND (SELECT count(*) FROM operation_schemas.sb_bookings__trips x WHERE x.sb_bookings_id = b.id) = 1
        AND NOT EXISTS (SELECT 1 FROM operation_schemas.sb_bookings__partialcancels p WHERE p.sb_bookings_id = b.id)
        AND coalesce(t.bookingmode, 'seat') = 'seat' AND t.date >= $1 AND t.pax_ad_fr >= 4
        AND coalesce(t.pax_chd_fr,0) + coalesce(t.pax_inf_fr,0) + coalesce(t.pax_foc_fr,0) + coalesce(t.pax_ad_th,0) = 0
      ORDER BY t.date, b.id LIMIT 20`, [addDays(today, 3)]);
    for (const r of rows) { const [o] = await ops('SELECT id FROM bookings WHERE external_id = $1', [r.id]); if (o) return { id: r.id, lead: r.lead }; }
    throw new Error('no suitable booking for partial-cancel');
  },
  steps: (v) => [
    { nav: 'booking' },
    { label: 'open the booking (its row click: bkV2OpenDetail)', call: 'bkV2OpenDetail', args: [v.id] },
    { label: 'Reduce pax (partial cancel)', clickFn: 'bkV2DetailPartial' },
    { label: 'remove 2 adults', fill: '#bkp-rm-ad_fr', value: 2 },
    { label: 'reason: customer cancelled', choose: '#bkp-cat', value: 'customer_cancel' },
    { label: 'charge 1 of them', fill: '#bkp-chg-cnt', value: 1 },
    { label: 'Confirm reduce', clickFn: 'bkV2PartialConfirm' },
  ],
  async data({ legacy, ops, vars }) {
    const [L] = await legacy(`SELECT b.status, b.total, b.pricebreakdown_total AS bd, t.pax_ad_fr AS ad,
        (SELECT json_agg(p ORDER BY p.idx) FROM operation_schemas.sb_bookings__partialcancels p WHERE p.sb_bookings_id = b.id) AS partials
      FROM operation_schemas.sb_bookings b JOIN operation_schemas.sb_bookings__trips t ON t.sb_bookings_id = b.id WHERE b.id = $1`, [vars.id]);
    const [N] = await ops(`SELECT b.status, b.total, (SELECT p.count FROM booking_trips t JOIN booking_trip_pax p ON p.booking_trip_id = t.id
          WHERE t.booking_id = b.id AND p.category = 'ad' AND p.residency = 'foreign') AS ad,
        (SELECT json_agg(p ORDER BY p.at) FROM booking_partial_cancels p WHERE p.booking_id = b.id) AS partials
      FROM bookings b WHERE b.external_id = $1`, [vars.id]);
    const part = (p) => ({ count: n(p.count), category: p.category, charged: [n(p.charged_count), n(p.charged_amount)], waived: [n(p.waived_count), n(p.waived_amount)] });
    return {
      legacy: L ? [{ status: L.status, total: n(L.total), adults: n(L.ad), partials: (L.partials || []).map(part) }] : [],
      new: N ? [{ status: N.status, total: n(N.total), adults: n(N.ad), partials: (N.partials || []).map(part) }] : [],
    };
  },
};
