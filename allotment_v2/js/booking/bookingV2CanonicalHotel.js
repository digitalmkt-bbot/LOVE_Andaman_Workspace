// Snap a typed hotel name to an EXISTING canonical spelling (match ignoring case/parens/spaces).
// Prevents new duplicate variants on save · returns a whitespace-tidied version if genuinely new.
function bookingV2CanonicalHotel(name){
  var s=(name||'').replace(/\s+/g,' ').trim();
  if(!s) return s;
  var norm=function(x){ return x.toLowerCase().replace(/[()]/g,' ').replace(/\s+/g,' ').trim(); };
  var k=norm(s); if(!k) return s;
  var existing=bookingV2HotelNameList();
  for(var i=0;i<existing.length;i++){ if(norm(existing[i])===k) return existing[i]; }
  return s;   // no match → genuinely new hotel, keep tidied spelling
}
