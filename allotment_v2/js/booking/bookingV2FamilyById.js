// Map a route to its family · §famField (2026-09-10)
//   route.familyId is the source of truth. The name-pattern guess below is the FALLBACK, kept only
//   for routes saved before this field existed, and for the one-time backfill that fills them in.
//   Order matters in the guess (Whale before Phi Phi — "Whale Shark Phi Phi Maiton" contains both).
//   familyId === '' means "deliberately no family" and is respected · undefined/null = never set.
function bookingV2FamilyById(fid){
  if(!fid) return null;
  return _BKV2_FAMILIES.find(f => f.id === fid) || null;
}
