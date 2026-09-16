// Pad / trim passengers[] · types: AD (excl. lead) → CHD → INF → FOC
function bookingV2SyncPassengers(){
  if(!_bkV2.newBooking) return;
  const d = _bkV2.newBooking;
  // Guests are ONE group that travels on each of the booking's trips (multi-day = same people),
  // so the names list is sized to the LARGEST single trip — NOT the sum of all trips
  // (summing double-counted multi-trip bookings · e.g. 25AD+2FOC + a 2-pax leg → asked for 29 instead of 27).
  let totAd = 0, totChd = 0, totInf = 0, totFoc = 0, _bestN = -1;
  (d.trips||[]).forEach(t => {
    const n = bookingV2PaxAllTot(t.pax||{});
    if(n > _bestN){
      _bestN = n;
      totAd  = bookingV2PaxTot(t.pax,'ad');
      totChd = bookingV2PaxTot(t.pax,'chd');
      totInf = bookingV2PaxTot(t.pax,'inf');
      totFoc = bookingV2PaxTot(t.pax,'foc');
    }
  });
  // Lead is passenger #1 and occupies ONE real seat. Default type = Adult if any adult,
  // else FOC (all-FOC group · e.g. staff/guide), else Child, else Infant.
  // The user can MANUALLY make the lead a FOC even in a mixed group (e.g. the free guide is the lead)
  // via d.leadFoc — the lead then occupies a FOC seat (no forced adult). Head count is unchanged.
  if(d.leadFoc && totFoc<=0) d.leadFoc = false;   // FOC removed → drop stale flag
  const leadType = d.leadFoc ? 'FOC'
                 : (totAd>0 ? 'AD' : (totFoc>0 ? 'FOC' : (totChd>0 ? 'CHD' : (totInf>0 ? 'INF' : 'AD'))));
  d.leadType = leadType;
  // Remaining seats (#2 onwards) = all heads minus the lead's own seat → names list == head count
  const exAd  = leadType==='AD'  ? Math.max(0, totAd-1)  : totAd;
  const exChd = leadType==='CHD' ? Math.max(0, totChd-1) : totChd;
  const exInf = leadType==='INF' ? Math.max(0, totInf-1) : totInf;
  const exFoc = leadType==='FOC' ? Math.max(0, totFoc-1) : totFoc;
  const expected = [];
  for(let i=0; i<exAd;  i++) expected.push('AD');
  for(let i=0; i<exChd; i++) expected.push('CHD');
  for(let i=0; i<exInf; i++) expected.push('INF');
  for(let i=0; i<exFoc; i++) expected.push('FOC');

  if(!Array.isArray(d.passengers)) d.passengers = [];
  while(d.passengers.length < expected.length){ d.passengers.push({ name:'', nationality:'', type: expected[d.passengers.length] }); }
  while(d.passengers.length > expected.length){ d.passengers.pop(); }
  // Assign type tags to #2+ rows · honor MANUAL FOC selection (p.foc) first, then fill the rest by position
  if(exFoc > 0){
    let keptFoc = 0;
    d.passengers.forEach(p => { if(p.foc){ if(keptFoc < exFoc) keptFoc++; else p.foc = false; } });
    const queue = [];
    for(let i=0; i<exAd;  i++) queue.push('AD');
    for(let i=0; i<exChd; i++) queue.push('CHD');
    for(let i=0; i<exInf; i++) queue.push('INF');
    for(let i=0; i<(exFoc - keptFoc); i++) queue.push('FOC');   // remaining FOC seats auto-fill (last positions)
    let qi = 0;
    d.passengers.forEach(p => { if(p.foc){ p.type = 'FOC'; } else { p.type = queue[qi++] || 'AD'; } });
  } else {
    d.passengers.forEach((p, i) => { p.foc = false; p.type = expected[i]; });
  }
}
