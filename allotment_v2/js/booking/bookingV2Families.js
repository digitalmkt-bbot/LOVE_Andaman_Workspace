// All families that have ≥1 active route in the visible month
// Looks at ALL ROUTES (not just rate-type ones) · so ops sees every variant
function bookingV2Families(){
  if(typeof ROUTES === 'undefined') return window._BKV2_FAMILIES || [];
  return (window._BKV2_FAMILIES || []).filter(fam =>
    ROUTES.some(r => bookingV2RouteFamily(r.id)?.id === fam.id && bookingV2RouteActiveInMonth(r.id, _bkV2.cursor))
  );
}
