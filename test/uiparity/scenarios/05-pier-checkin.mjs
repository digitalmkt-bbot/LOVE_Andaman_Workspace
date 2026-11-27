// Scenario 5 · check-in: at the pier, one booking checks in with one adult a no-show, another checks in whole
// Legacy flow (08-app.js): Pier check-in page (renderPierCheckin) › the search box (pckSetQ) › the row's
// "No-show" (ckEventOpen(bk, date, 'pier', 'no_show')) › a reason (ckEvPick) › +1 adult (_ckEvBumpK('ad', 1)) ›
// save (ckEvSave: actualPax −1, an event) › the row's check-in tick (ckTap → ckToggle) · then the second booking's tick.
const day = (s) => s;
export default {
  name: 'pier-checkin',
  title: 'pier check-in, one adult a no-show',
  async prepare({ legacy, ops, today }) {
    // today's confirmed agent bookings on one seat trip, 2+ foreign adults only, not yet seen at the pier or by the van,
    // nothing to collect at the pier (pckPayGuard), on the pier with the most of them
    const rows = await legacy(`SELECT b.id, b.leadpax AS lead, r.pier, t.pax_ad_fr AS ad FROM operation_schemas.sb_bookings b
        JOIN operation_schemas.sb_bookings__trips t ON t.sb_bookings_id = b.id JOIN operation_schemas.routes r ON r.id = t.routeid
      WHERE t.date = $1 AND b.status = 'confirmed' AND b.agentid <> 'a_b2c' AND b.id NOT LIKE 'b2c_%'
        AND (SELECT count(*) FROM operation_schemas.sb_bookings__trips x WHERE x.sb_bookings_id = b.id) = 1
        AND coalesce(t.bookingmode, 'seat') = 'seat' AND t.pax_ad_fr >= 2
        AND coalesce(t.pax_chd_fr,0) + coalesce(t.pax_inf_fr,0) + coalesce(t.pax_foc_fr,0) + coalesce(t.pax_ad_th,0) + coalesce(t.pax_chd_th,0) = 0
        AND b.ops_piercheckin IS NULL AND b.ops_vancheckin IS NULL AND b.cashontour_amount IS NULL AND b.pierpayments IS NULL
        AND length(coalesce(b.leadpax, '')) >= 5
        AND (SELECT count(*) FROM operation_schemas.sb_bookings z WHERE z.leadpax = b.leadpax) = 1
      ORDER BY b.id`, [day(today)]);
    const byPier = {};
    for (const r of rows) (byPier[r.pier] = byPier[r.pier] || []).push(r);
    const pier = Object.keys(byPier).sort((a, b) => byPier[b].length - byPier[a].length)[0];
    const pick = [];
    for (const r of byPier[pier] || []) { const [o] = await ops('SELECT id FROM bookings WHERE external_id = $1', [r.id]); if (o) pick.push(r); if (pick.length === 2) break; }
    if (pick.length < 2) throw new Error('no two suitable bookings at the pier today');
    return { date: today, pier, a: pick[0].id, aLead: pick[0].lead, b: pick[1].id, bLead: pick[1].lead };
  },
  steps: (v) => [
    { nav: 'piercheckin' },
    { label: 'pier ' + v.pier, clickSel: `[onclick*="pckSetPier('${v.pier}'"]` },
    { label: 'search booking A', fill: 'input[oninput*="pckSetQ"]', value: v.aLead },
    { label: 'A: No-show', clickSel: `[onclick*="ckEventOpen('${v.a}'"][onclick*="no_show"]` },
    { label: 'reason: first in the list', clickSel: '[onclick*="ckEvPick("]' },
    { label: '+1 adult', clickSel: `[onclick*="_ckEvBumpK('ad',1)"]` },
    { label: 'save the no-show', clickFn: 'ckEvSave' },
    { label: 'A: check in', clickSel: `[onclick*="ckTap('${v.a}'"]` },
    { label: 'search booking B', fill: 'input[oninput*="pckSetQ"]', value: v.bLead },
    { label: 'B: check in', clickSel: `[onclick*="ckTap('${v.b}'"]` },
  ],
  async data({ legacy, ops, vars }) {
    // legacy keeps the pier check-in on the booking (sb_bookings.ops_piercheckin), one trip here
    const L = await legacy(`SELECT b.id, b.ops_piercheckin AS ck FROM operation_schemas.sb_bookings b WHERE b.id = ANY($1) ORDER BY b.id`, [[vars.a, vars.b]]);
    const N = await ops(`SELECT b.external_id AS id, c.expected, c.actual_pax, c.checked_in_at IS NOT NULL AS checked, c.reason_code,
        (SELECT json_agg(json_build_object('type', e.type, 'pax', e.pax, 'ad', e.ad, 'reason', e.reason_code) ORDER BY e.seq) FROM booking_trip_checkin_events e
          WHERE e.booking_trip_id = c.booking_trip_id AND e.kind = c.kind AND e.slot = c.slot AND e.undone_at IS NULL) AS events
      FROM booking_trips t JOIN bookings b ON b.id = t.booking_id JOIN booking_trip_checkins c ON c.booking_trip_id = t.id AND c.kind = 'pier' WHERE b.external_id = ANY($1) ORDER BY 1`, [[vars.a, vars.b]]);
    const legacyRec = (r) => { const c = typeof r.ck === 'string' ? JSON.parse(r.ck) : r.ck; return c ? { id: r.id, expected: c.expected, actual: c.actualPax, checked: !!c.at, reason: c.reasonCode || '', events: (c.events || []).map((e) => ({ type: e.type, pax: e.pax, ad: (e.paxBreak || {}).ad ?? null, reason: e.reasonCode })) } : { id: r.id, none: true }; };
    const opsRec = (r) => ({ id: r.id, expected: r.expected, actual: r.actual_pax, checked: r.checked, reason: r.reason_code || '', events: (r.events || []).map((e) => ({ type: e.type, pax: e.pax, ad: e.ad, reason: e.reason })) });
    const ids = [vars.a, vars.b];
    return { legacy: L.map(legacyRec), new: ids.map((id) => N.find((r) => r.id === id)).map((r, i) => (r ? opsRec(r) : { id: ids[i], none: true })) };
  },
};
