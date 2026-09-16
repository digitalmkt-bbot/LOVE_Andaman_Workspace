function bookingV2HotelKey(s){
  var x=String(s||'').toLowerCase()
    .replace(/[()\[\]{}]/g,' ')
    .replace(/[-_/\\,.'"`|+*:;!?#@~^]/g,' ')
    .replace(/&/g,' ')
    .replace(/\s+/g,' ').trim();
  var t=x.split(' ').filter(function(w){ return w && !_HOTEL_STOP[w]; });
  if(!t.length) t=x.split(' ').filter(Boolean);
  return t.sort().join(' ');
}
