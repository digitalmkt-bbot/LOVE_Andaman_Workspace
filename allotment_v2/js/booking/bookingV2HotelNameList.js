// ── Hotel / Pickup name autocomplete (custom styled dropdown · mirrors Pickup Area) ──
// Distinct, sorted list of previously-used hotel / pickup names from all bookings.
function bookingV2HotelNameList(zoneFilter, areaFilter){
  // Dedupe by a NORMALIZED key (lowercase · parentheses→space · collapse spaces) so spelling
  // variants of the same place — e.g. "Katathani … Buri Lobby" vs "Katathani … ( Buri Lobby )" —
  // collapse into ONE suggestion. On collision keep the cleaner spelling (no parens, then shorter).
  // Each entry tracks WHICH zones (PK/KL) AND which pickup AREAS it appeared in across past bookings → zone/area-aware suggestions.
  var byKey={};   // key → {name, zones:{PK:1,...}, areas:{areaId:1,...}}
  var norm=function(s){ return s.toLowerCase().replace(/[()]/g,' ').replace(/\s+/g,' ').trim(); };
  var cleaner=function(a,b){ var pa=/[()]/.test(a), pb=/[()]/.test(b); if(pa!==pb) return pa?b:a; return a.length<=b.length?a:b; };
  (typeof SB_BOOKINGS!=='undefined'?SB_BOOKINGS:[]).forEach(function(b){
    if(!b) return;
    // Resolve the booking's pickup zone (area → b.pickupZone → first trip zone)
    var area=(typeof bookingV2GetArea==='function' && b.pickupAreaId)?bookingV2GetArea(b.pickupAreaId):null;
    var z=(area&&area.zone)||b.pickupZone||((b.trips&&b.trips[0])?b.trips[0].zone:'')||'';
    var aid=b.pickupAreaId||'';
    // Skip No-Transfer bookings: there the hotel field is a self-arrival NOTE, not a real hotel name.
    if(z==='NoTransfer'||z==='NT') return;
    [b.hotelName, b.pickup].forEach(function(v){
      var s=(v||'').trim(); if(!s) return;
      var k=norm(s); if(!k) return;
      var e=byKey[k]||(byKey[k]={name:s,zones:{},areas:{}});
      e.name=cleaner(e.name,s);
      if(z) e.zones[z]=1;
      if(aid) e.areas[aid]=1;
    });
  });
  var keys=Object.keys(byKey);
  if(areaFilter) keys=keys.filter(function(k){return byKey[k].areas[areaFilter];});        // only hotels seen in THIS pickup area before
  else if(zoneFilter) keys=keys.filter(function(k){return byKey[k].zones[zoneFilter];});   // else only hotels seen in this zone before
  var list=keys.map(function(k){return byKey[k].name;});
  list.sort(function(a,b){return a.localeCompare(b);});
  return list;
}
