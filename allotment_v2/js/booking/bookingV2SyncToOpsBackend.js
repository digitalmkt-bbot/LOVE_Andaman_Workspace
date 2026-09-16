// §opsSync (2026-09-16) · best-effort mirror of a committed booking onto operation-backend — creates
//   it if it has no opsId yet, PATCHes it if it does (opsId is carried over across edits, see the
//   edit-preserve block above). Fire-and-forget: a slow/unreachable operation-backend must never
//   block the booking form, so a failure only warns to console. This is what lets a booking survive
//   a page refresh when server.js's blob sync is unavailable (window.LA_LEGACY_UNAVAILABLE) — the
//   read side that repopulates SB_BOOKINGS from operation-backend on boot is bookingV2LoadFromOpsBackend.
function bookingV2SyncToOpsBackend(bk){
  if(typeof window.laOpsFetch!=='function' || !bk) return;
  var payload = {
    trips: (bk.trips||[]).map(function(t){
      var o = { routeId:t.routeId, date:t.date, pax:t.pax||{} };
      if(t.bookingMode==='charter'){ o.bookingMode='charter'; if(t.charterBoatId) o.charterBoatId=t.charterBoatId; }
      return o;
    }),
    externalId: bk.id, status: bk.status
  };
  ['agentId','leadPax','leadNationality','leadPhone','leadEmail','hotelName','pickupAreaId','voucherRef','bookingDate'].forEach(function(k){
    if(bk[k]!=null && bk[k]!=='') payload[k]=bk[k];
  });
  var method = bk.opsId ? 'PATCH' : 'POST';
  var path = bk.opsId ? ('/v1/bookings/'+encodeURIComponent(bk.opsId)) : '/v1/bookings';
  window.laOpsFetch(path, { method:method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) })
    .then(function(r){ return r.json().then(function(j){ if(!r.ok) throw new Error((j&&j.message)||('HTTP '+r.status)); return j; }); })
    .then(function(j){
      if(!bk.opsId && j && j.id){ bk.opsId=j.id; try{ bookingV2PersistBookings(); }catch(e){} }
      try{ console.log('[opsSync] booking '+bk.id+' synced to operation-backend as '+(bk.opsId||'?')); }catch(e){}
    })
    .catch(function(e){ try{ console.warn('[opsSync] booking '+bk.id+' failed to sync to operation-backend: '+((e&&e.message)||e)); }catch(_){} });
}
