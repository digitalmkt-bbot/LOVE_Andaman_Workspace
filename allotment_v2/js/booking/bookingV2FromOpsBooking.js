// §opsSync · on boot, when server.js's blob is unavailable, SB_BOOKINGS starts empty (nothing loaded
//   it) — this repopulates it from operation-backend's GET /v1/bookings so a refresh doesn't look like
//   data loss. Only runs when window.LA_LEGACY_UNAVAILABLE is set (01-auth-sync.js, on /api/load 401);
//   a normal server.js-backed session is untouched.
function bookingV2FromOpsBooking(ob){
  var g=function(camel,snake){ return ob[camel]!==undefined ? ob[camel] : ob[snake]; };
  return {
    id: g('externalId','external_id') || ob.id,
    opsId: ob.id,
    agentId: g('agentId','agent_id') || null,
    leadPax: g('leadPax','lead_pax') || '',
    leadNationality: g('leadNationality','lead_nationality') || '',
    leadPhone: g('leadPhone','lead_phone') || '',
    leadEmail: g('leadEmail','lead_email') || '',
    hotelName: g('hotelName','hotel_name') || '',
    pickupAreaId: g('pickupAreaId','pickup_area_id') || null,
    status: ob.status || 'confirmed',
    bookingDate: g('bookingDate','booking_date') || '',
    voucherRef: g('voucherRef','voucher_ref') || '',
    trips: (ob.trips||[]).map(function(t){
      var tg=function(camel,snake){ return t[camel]!==undefined ? t[camel] : t[snake]; };
      return { routeId: tg('routeId','route_id'), date: t.date, bookingMode: tg('bookingMode','booking_mode')||'seat', pax: t.pax||{}, charterBoatId: tg('charterBoatId','charter_boat_id')||null };
    }),
    passengers: ob.passengers||[], addOns: [], adjustments: [], history: [], ops: {}, priceBreakdown: {}, total: 0,
    _fromOpsBackend: true
  };
}
