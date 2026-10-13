// §famField · one-time backfill · writes the guess into routes that have never carried the field.
//   Idempotent and targeted by design: it only touches routes where familyId is undefined/null, and
//   only ever writes the value bookingV2RouteFamily already returns at runtime — so it materialises
//   today's behaviour and changes nothing on screen. A route the user deliberately cleared ('') is
//   left alone. Returns how many were filled so the caller can decide whether to persist.
function bookingV2BackfillRouteFamilies(){
  if(typeof ROUTES === 'undefined' || !Array.isArray(ROUTES)) return 0;
  let n = 0;
  ROUTES.forEach(r => {
    if(!r || r.familyId != null) return;
    const f = bookingV2RouteFamilyGuess(r);
    r.familyId = f ? f.id : '';
    n++;
  });
  return n;
}
