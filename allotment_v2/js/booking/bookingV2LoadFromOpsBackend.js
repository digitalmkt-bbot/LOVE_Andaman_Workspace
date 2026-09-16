function bookingV2LoadFromOpsBackend(){
  if(!window.LA_LEGACY_UNAVAILABLE || typeof window.laOpsFetch!=='function') return;
  window.laOpsFetch('/v1/bookings').then(function(r){ return r.ok ? r.json() : null; })
    .then(function(j){
      if(!j || !Array.isArray(j.bookings)) return;
      var mapped = j.bookings.map(bookingV2FromOpsBooking);
      SB_BOOKINGS.length = 0;
      Array.prototype.push.apply(SB_BOOKINGS, mapped);
      try{ console.log('[opsSync] loaded '+mapped.length+' booking(s) from operation-backend'); }catch(e){}
      try{ if(typeof bookingV2Render==='function') bookingV2Render(); }catch(e){}
    })
    .catch(function(e){ try{ console.warn('[opsSync] failed to load bookings from operation-backend: '+((e&&e.message)||e)); }catch(_){} });
}
