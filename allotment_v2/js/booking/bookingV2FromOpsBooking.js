// §opsSync · an operation-backend booking → the client's booking shape. The full mapping (header,
//   trips with lock draws and overnight fields, passengers, add-ons, cancel/reschedule/partial-cancel
//   records, fee items) lives in js/ops/40-ops-bookings.js beside its reverse, so the two can't drift.
function bookingV2FromOpsBooking(ob){
  if(typeof window.laOpsFromServer === 'function') return window.laOpsFromServer(ob);
  return { id: ob.external_id || ob.id, opsId: ob.id, schemaVer: 2, status: ob.status || 'confirmed', trips: [], passengers: [], addOns: [], history: [], ops: {}, _fromOpsBackend: true };
}
