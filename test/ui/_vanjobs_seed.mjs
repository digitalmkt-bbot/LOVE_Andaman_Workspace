// _vanjobs_seed · the one day both vanjobs scripts (make_vanjobs_pdf.mjs, t_walk_vanjobs.mjs) put on the server.
//
// Two days on route r5 (a boat route), seeded through the API:
//   D  (Van Alpha runs it twice, Van Bravo once)
//      round 1 (07:00): WALK ONE (2 AD + 1 CHD, bags, a special request, comes back on Bravo)
//                       WALK TWO (3 AD, one of them is dropped somewhere else: two parts, one pick-up place = a MERGED row)
//                       WALK OVN (stays on the island, comes back on D2: the overnight tag)
//                       a guide riding along (a van stop)
//      round 2 (09:00): WALK THREE, WALK FOUR (cancelled after it was grouped: a STRUCK row)
//      Bravo:           WALK FIVE (comes back on Alpha: "from another van"); WALK SIX (checked in as a no-show: a LOSS tag)
//      no van yet:      WALK SEVEN (the unassigned-on-route banner)
//   D2 the overnight booking's return leg, brought back by Bravo (a return-only sheet, the overnight leg tag)
export const D = '2026-11-20';
export const D2 = '2026-11-22';
export const ROUTE = 'r5';

export async function seedVanJobs(send) {
  const need = (r, what) => { if (r.status >= 300) throw new Error(`seed ${what}: ${r.status} ${JSON.stringify(r.body).slice(0, 400)}`); return r.body; };
  for (const d of [D, D2]) need(await send('POST', '/operations/deployments', { boat_id: 'b6', route_id: ROUTE, service_date: d, capacity: 40 }), 'deployment');
  const vanAlpha = need(await send('POST', '/operations/vans', { name: 'Van Alpha', capacity: 13, plate: '31-1111', driver: 'Somchai', driver_phone: '081-111-1111' }), 'van');
  const vanBravo = need(await send('POST', '/operations/vans', { name: 'Van Bravo', capacity: 9, ownership: 'partner', partner_name: 'WalkPartner', plate: '32-2222', driver: 'Boon', driver_phone: '082-222-2222' }), 'van');
  for (const d of [D, D2]) for (const v of [vanAlpha, vanBravo]) need(await send('PUT', `/operations/van-days/${d}/${v.id}`, { route_ids: [ROUTE] }), 'van-day');
  await send('PUT', '/operations/pickup-names-th', { name: 'Walk Hotel Alpha', name_th: 'วอล์ค โฮเทล อัลฟา' });

  const mk = async (id, lead, date, pax, extra = {}, tripExtra = {}) => need(await send('POST', '/v1/bookings', {
    external_id: 'zz-vj-' + id, voucher_ref: 'VJ-' + id.toUpperCase(), intent: 'confirm', agentId: 'a01', leadPax: lead, leadNationality: 'RU', leadPhone: '+7 900 1',
    pickupSelf: false, guide_english: true, hotelName: 'Walk Hotel Alpha', pickupZone: 'PK', trips: [{ routeId: ROUTE, date, pax, zone: 'PK', ...tripExtra }], ...extra }), 'booking ' + id);
  const bk = {};
  bk.one = await mk('one', 'WALK ONE', D, { ad_fr: 2, chd_fr: 1 }, { roomNumber: '512', largeLuggage: 2, notes: 'Wait in the lobby', passengers: [{ name: 'Mrs One', nationality: 'RU' }, { name: 'Kid One', nationality: 'RU' }, { name: 'Mr Third', nationality: 'RU' }], guide_english: true });
  bk.two = await mk('two', 'WALK TWO', D, { ad_fr: 3 }, { hotelName: 'Walk Hotel Bravo', roomNumber: '210',
    alt_pickups: [{ who: 'Mr Drop', ad: 1, chd: 0, inf: 0, foc: 0, drop_same: false, drop_place: 'Kata Palm Resort', drop_area: 'Kata', drop_zone: 'PK' }] });
  bk.three = await mk('three', 'WALK THREE', D, { ad_fr: 2 }, { hotelName: 'Walk Hotel Charlie' });
  bk.four = await mk('four', 'WALK FOUR', D, { ad_fr: 1 }, { hotelName: 'Walk Hotel Delta' });
  bk.five = await mk('five', 'WALK FIVE', D, { ad_fr: 2 }, { hotelName: 'Walk Hotel Echo' });
  bk.six = await mk('six', 'WALK SIX', D, { ad_fr: 2 }, { hotelName: 'Walk Hotel Foxtrot' });
  bk.seven = await mk('seven', 'WALK SEVEN', D, { ad_fr: 2 }, { hotelName: 'Walk Hotel Golf' });
  // overnight: goes out on D, comes back on D2 (the leg is a trip of its own)
  bk.ovn = need(await send('POST', '/v1/bookings', {
    external_id: 'zz-vj-ovn', voucher_ref: 'VJ-OVN', intent: 'confirm', agentId: 'a01', leadPax: 'WALK OVN', leadNationality: 'RU', leadPhone: '+7 900 1', pickupSelf: false, guide_english: true,
    hotelName: 'Walk Hotel Hotel', pickupZone: 'PK',
    trips: [{ routeId: ROUTE, date: D, pax: { ad_fr: 2 }, zone: 'PK', ovn: 'return', ovnReturnDate: D2 }, { routeId: ROUTE, date: D2, pax: { ad_fr: 2 }, zone: 'PK', ovnLeg: true, ovnOf: 0 }] }), 'booking ovn');

  const group = async (date, members, van_id, extra = {}) => need(await send('POST', '/operations/van-groups', { service_date: date, route_id: ROUTE, zone: 'PK', members, van_id, ...extra }), 'group');
  const trip = (b, i = 0) => ({ trip_id: b.trips[i].id });
  const g1 = await group(D, [trip(bk.one), trip(bk.two), { trip_id: bk.two.trips[0].id, idx: 1 }, trip(bk.ovn)], vanAlpha.id);
  const g2 = await group(D, [trip(bk.three), trip(bk.four)], vanAlpha.id, { allow_second_round: true });
  const g3 = await group(D, [trip(bk.five), trip(bk.six)], vanBravo.id);
  // pick-up times decide the rounds
  need(await send('PATCH', `/operations/van-groups/${g1.id}`, { pickup_time: '07:00' }), 'time g1');
  need(await send('PATCH', `/operations/van-groups/${g2.id}`, { pickup_time: '09:00' }), 'time g2');
  need(await send('PATCH', `/operations/van-groups/${g3.id}`, { pickup_time: '07:30' }), 'time g3');
  // WALK ONE comes back on Bravo; WALK FIVE (out on Bravo) comes back on Alpha
  const returnOn = async (b, van) => {
    const cur = need(await send('GET', '/v1/bookings/' + b.id), 'read booking').trips[0].operations.van_parts;
    need(await send('PATCH', '/operations/trip-ops/' + b.trips[0].id, { van_parts: cur.map((p) => ({ idx: p.idx, ad: p.ad, chd: p.chd, inf: p.inf, foc: p.foc, group_id: p.group?.id ?? p.group_id, return_van_id: van.id })) }), 'return van');
  };
  await returnOn(bk.one, vanBravo);
  await returnOn(bk.five, vanAlpha);
  // a guide rides along on round 1
  need(await send('POST', '/operations/van-stops', { group_id: g1.id, kind: 'staff', label: 'Guide Nok', place: 'Walk Office', pax: 1, time: '06:30', area: 'Patong', leg: 'out' }), 'stop');
  // the overnight leg comes back on D2 with Bravo
  const g4 = await group(D2, [trip(bk.ovn, 1)], vanBravo.id);
  // WALK FOUR is cancelled after it was grouped: the sheet keeps it, struck through
  const fourNow = need(await send('GET', '/v1/bookings/' + bk.four.id), 'read four');
  need(await send('POST', `/v1/bookings/${bk.four.id}/cancel`, { version: fourNow.version, reason: 'Guest changed plans' }), 'cancel four');
  // WALK SIX did not come: the van check-in says so (the return sheet then tags it)
  need(await send('POST', `/operations/trip-ops/${bk.six.trips[0].id}/checkins/van/0/events`, { type: 'no_show', reason_code: 'not_down', ad: 2, chd: 0, inf: 0, foc: 0, note: 'lobby empty', at: '06:40' }), 'checkin six');   // w4-f5: the command (PUT of events is the server's now)
  return { vanAlpha, vanBravo, bk, g1, g2, g3, g4 };
}
