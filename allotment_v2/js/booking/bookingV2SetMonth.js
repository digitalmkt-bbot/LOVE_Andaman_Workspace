// §bkMonthPage · pick a travel month (or 'all'). Also clears an active search, otherwise the search would
// keep overriding the month you just clicked and the click would look dead.
function bookingV2SetMonth(m){
  _bkV2.month = m;
  _bkV2.page = 1;
  if(_bkV2.search) _bkV2.search = '';
  // When 'All time' is selected in operation-backend mode, load aggregate
  // stats for the KPI header instead of downloading all booking records.
  if(m==='all' && window.laOps && window.laOps.get && window.laOps.enabled && window.laOps.enabled()){
    window.laOps.get('/v1/bookings/stats').then(function(j){ if(j) window.laOpsStats=j; if(j && _bkV2.month==='all') bookingV2Render(); }).catch(function(e){ try{ console.warn('[ops] booking stats failed: '+(e&&e.message)); }catch(_){} });
  }
  bookingV2Render();
  const strip = document.getElementById('bkv2-monthstrip');
  const on = strip && strip.querySelector(`[data-mon="${m}"]`);
  if(on && on.scrollIntoView) on.scrollIntoView({block:'nearest', inline:'center'});
}
