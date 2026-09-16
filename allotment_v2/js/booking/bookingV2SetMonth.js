// §bkMonthPage · pick a travel month (or 'all'). Also clears an active search, otherwise the search would
// keep overriding the month you just clicked and the click would look dead.
function bookingV2SetMonth(m){
  _bkV2.month = m;
  _bkV2.page = 1;
  if(_bkV2.search) _bkV2.search = '';
  bookingV2Render();
  const strip = document.getElementById('bkv2-monthstrip');
  const on = strip && strip.querySelector(`[data-mon="${m}"]`);
  if(on && on.scrollIntoView) on.scrollIntoView({block:'nearest', inline:'center'});
}
