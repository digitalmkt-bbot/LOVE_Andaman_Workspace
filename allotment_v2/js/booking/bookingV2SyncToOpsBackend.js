// §opsSync · save one committed booking to operation-backend: POST when it has no opsId yet, PATCH when
//   it does. Returns the promise · bookingV2CommitBooking hands it to its wrapper (js/ops/40-ops-bookings.js),
//   which puts the bookings, locks and TRIPS back and reopens the form if the server refuses ("server
//   first", 2026-10-05). The payload mapping is laOpsToServer in the same file.
function bookingV2SyncToOpsBackend(bk){
  if(!bk || !window.laOps || !window.laOps.enabled() || !window.laOps.bookings) return null;
  return window.laOps.bookings.save(bk);
}
