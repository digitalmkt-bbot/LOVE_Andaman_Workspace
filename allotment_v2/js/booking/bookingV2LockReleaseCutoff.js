// ── Rolling per-trip release (HH:MM · N days before travel) ──
// A month lock holds seats across a range; its seats for a SPECIFIC trip date auto-release
// when now passes (tripDate − releaseDaysBefore days) at releaseTime — the seats free up for
// THAT departure while the lock stays active for later dates. No single global expiry.
function bookingV2LockReleaseCutoff(l, tripDate){
  if(!l || !tripDate) return null;
  const hasRule = (l.releaseDaysBefore!=null && l.releaseDaysBefore!=='') || l.releaseTime;
  if(!hasRule) return null;
  const days = Math.max(0, parseInt(l.releaseDaysBefore,10)||0);
  const tm = String(l.releaseTime||'00:00');
  const hh = parseInt(tm.slice(0,2),10)||0, mm = parseInt(tm.slice(3,5),10)||0;
  const d = new Date(String(tripDate)+'T00:00:00');
  if(isNaN(d.getTime())) return null;
  d.setDate(d.getDate() - days); d.setHours(hh, mm, 0, 0);
  return d;
}
