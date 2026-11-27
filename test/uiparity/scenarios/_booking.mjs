// shared bits of the booking scenarios: pick a case from legacy's data, read a booking from both databases
export async function pickAgentRoute(legacy, date) {
  // the agent with the most recent non-B2C bookings on the busiest sea route of `date`, and that route
  const [r] = await legacy(`SELECT t.routeid AS route FROM operation_schemas.sb_bookings__trips t JOIN operation_schemas.sb_bookings b ON b.id = t.sb_bookings_id
    WHERE t.date = $1 AND b.status NOT IN ('cancelled','cancelled_weather','rejected') GROUP BY 1 ORDER BY count(*) DESC, 1 LIMIT 1`, [date]);
  const [a] = await legacy(`SELECT b.agentid AS agent, a.name, max(rt.name) AS rate FROM operation_schemas.sb_bookings b
      JOIN operation_schemas.sb_bookings__trips t ON t.sb_bookings_id = b.id
      JOIN operation_schemas.sb_agents a ON a.id = b.agentid
      LEFT JOIN operation_schemas.sb_rate_types rt ON rt.id = b.ratetyperef
    WHERE t.routeid = $1 AND b.agentid <> 'a_b2c' AND b.id NOT LIKE 'b2c_%' AND b.status = 'confirmed' AND t.date >= to_char(now() - interval '120 days', 'YYYY-MM-DD')
      AND (SELECT count(*) FROM operation_schemas.sb_agents x WHERE lower(x.name) = lower(a.name)) = 1
    GROUP BY 1, 2 ORDER BY count(*) DESC LIMIT 1`, [r.route]);
  const [rn] = await legacy('SELECT name FROM operation_schemas.routes WHERE id = $1', [r.route]);
  return { route: r.route, routeName: rn.name, agent: a.agent, agentName: a.name };
}

const PAX = ['ad_fr', 'ad_th', 'chd_fr', 'chd_th', 'inf_fr', 'inf_th', 'foc_fr', 'foc_th'];
const n = (x) => (x == null ? null : Number(x));
// one booking as comparable content (no ids, no timestamps)
export async function bookingsByLead(legacy, ops, lead) {
  const L = await legacy(`SELECT b.*, (SELECT json_agg(t ORDER BY t.idx) FROM operation_schemas.sb_bookings__trips t WHERE t.sb_bookings_id = b.id) AS trips,
      (SELECT json_agg(p ORDER BY p.idx) FROM operation_schemas.sb_bookings__partialcancels p WHERE p.sb_bookings_id = b.id) AS partials
    FROM operation_schemas.sb_bookings b WHERE b.leadpax = $1`, [lead]);
  const N = await ops(`SELECT b.*, (SELECT json_agg(json_build_object('route', t.route_id, 'date', t.service_date::text, 'mode', t.booking_mode,
        'pax', (SELECT json_object_agg(p.category || '_' || p.residency, p.count) FROM booking_trip_pax p WHERE p.booking_trip_id = t.id AND p.count > 0)) ORDER BY t.seq) FROM booking_trips t WHERE t.booking_id = b.id) AS trips,
      (SELECT json_agg(p ORDER BY p.at) FROM booking_partial_cancels p WHERE p.booking_id = b.id) AS partials
    FROM bookings b WHERE b.lead_pax = $1`, [lead]);
  const legacyRec = (b) => ({
    agent: b.agentid, status: b.status, total: n(b.total), priceMode: b.pricemode, leadPax: b.leadpax, pickupSelf: !!b.pickupself,
    trips: (b.trips || []).map((t) => ({ route: t.routeid, date: t.date, mode: t.bookingmode || 'seat',
      pax: Object.fromEntries(PAX.map((k) => [k, n(t['pax_' + k])]).filter(([, v]) => v > 0)) })),
    partials: (b.partials || []).map((p) => ({ count: n(p.count), category: p.category, charged: [n(p.charged_count), n(p.charged_amount)], waived: [n(p.waived_count), n(p.waived_amount)] })),
    cancel: b.status === 'cancelled' ? { category: b.cancellation_category || '', chargeType: b.cancellation_chargetype || 'none', charge: n(b.cancellation_chargeamount) || 0 } : null,
  });
  const ourPax = (p) => Object.fromEntries(Object.entries(p || {}).map(([k, v]) => [k.replace(/^adult_/, 'ad_').replace(/^child_/, 'chd_').replace(/^infant_/, 'inf_').replace(/_foreign$/, '_fr').replace(/_thai$/, '_th'), n(v)]));
  const opsRec = (b) => ({
    agent: b.agent_id, status: b.status, total: n(b.total), priceMode: b.price_mode, leadPax: b.lead_pax, pickupSelf: !!b.pickup_self,
    trips: (b.trips || []).map((t) => ({ route: t.route, date: t.date, mode: t.mode || 'seat', pax: ourPax(t.pax) })),
    partials: (b.partials || []).map((p) => ({ count: n(p.count), category: p.category, charged: [n(p.charged_count), n(p.charged_amount)], waived: [n(p.waived_count), n(p.waived_amount)] })),
    cancel: b.status === 'cancelled' ? { category: (b.booking_data && b.booking_data.cancellation && b.booking_data.cancellation.category) || '', chargeType: null, charge: null } : null,
  });
  return { legacy: L.map(legacyRec), new: N.map(opsRec), raw: { legacy: L, new: N } };
}
