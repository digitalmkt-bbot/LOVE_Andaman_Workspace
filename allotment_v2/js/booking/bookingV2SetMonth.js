// §bkMonthPage · pick a travel month (or 'all'). Also clears an active search, otherwise the search would
// keep overriding the month you just clicked and the click would look dead.
function bookingV2SetMonth(m){
  _bkV2.month = m;
  _bkV2.page = 1;
  if(_bkV2.search) _bkV2.search = '';
  if(m !== 'all' && typeof bookingV2OpsEnsureMonth === 'function'){
    var p = bookingV2OpsEnsureMonth(m);
    if(p) p.then(function(j){ if(j && _bkV2.month === m && !_bkV2.newBooking) bookingV2Render(); });
  } else if(m === 'all' && typeof bookingV2OpsEnsureAll === 'function'){
    var p2 = bookingV2OpsEnsureAll();
    if(p2) p2.then(function(j){ if(j && _bkV2.month === 'all' && !_bkV2.newBooking) bookingV2Render(); }).catch(function(e){ try{ console.warn('[ops] all-time load failed: '+(e&&e.message)); }catch(_){} });
  }
  bookingV2Render();
  const strip = document.getElementById('bkv2-monthstrip');
  const on = strip && strip.querySelector(`[data-mon="${m}"]`);
  if(on && on.scrollIntoView) on.scrollIntoView({block:'nearest', inline:'center'});
}
