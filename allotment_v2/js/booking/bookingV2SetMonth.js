// §bkMonthPage · pick a travel month (or 'all'). Also clears an active search, otherwise the search would
// keep overriding the month you just clicked and the click would look dead.
function bookingV2SetMonth(m){
  // All-history was supplied by the old boot preload. In operation-backend
  // mode it would reintroduce that download, so keep this page month-scoped.
  if(m==='all' && window.laOps && window.laOps.enabled && window.laOps.enabled()){
    if(window.laOps.toast) window.laOps.toast({kind:'info',title:'Choose a travel month',status:'MONTH',sub:'All bookings loads one month at a time.',dur:4500});
    return;
  }
  _bkV2.month = m;
  _bkV2.page = 1;
  if(_bkV2.search) _bkV2.search = '';
  bookingV2Render();
  const strip = document.getElementById('bkv2-monthstrip');
  const on = strip && strip.querySelector(`[data-mon="${m}"]`);
  if(on && on.scrollIntoView) on.scrollIntoView({block:'nearest', inline:'center'});
}
