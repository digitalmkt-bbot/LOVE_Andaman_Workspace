/* ════════════════════════════════════════════════════════════════════════
   §opsHotelNames (2026-10-15) · hotel-name suggestions + bulk rename on operation-backend
   ────────────────────────────────────────────────────────────────────────
   GET  /v1/hotel-names?q=        → {names:[{name,count}]} over EVERY live booking (cap 200)
   POST /v1/hotels/merge          → {from_names, to_name} → {changed}
   Suggestions: the unfiltered name list (typeahead "other" tier, bookingV2CanonicalHotel snap,
     bookingV2HotelNear) reads the server's names, so a partly loaded SB_BOOKINGS no longer hides
     hotels. The zone/area-filtered tiers stay on the local derivation (the server list carries no
     zone/area). The union-find "similar names" grouping (bookingV2HotelSim) stays client-side.
   Merge (psuHotelMerge): server first. A refusal = red toast, nothing local changes. On success the
     local bookings that carried a merged name are RE-FETCHED through laOps.bookings.reload (the server
     bumped their versions and wrote history), never hand-edited.
   Legacy mode: both functions delegate to the originals when !enabled().
   Classic script · loads after 08-app.js and js/booking/*, before 90-ops-boot.js.
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var legacyList = window.bookingV2HotelNameList;
  var legacyRender = window.bookingV2HotelDDRender;
  var legacyMerge = window.psuHotelMerge;

  var cache = {};          // q → names[]
  var inflight = {};       // q → promise
  var stamp = 0;           // when the cache was last emptied
  var TTL = 60000;
  function tidy(s){ return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function norm(s){ return tidy(s).toLowerCase().replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function reset(){ cache = {}; stamp = Date.now(); }

  function fetchNames(q){
    q = tidy(q);
    if(cache[q] && Date.now() - stamp < TTL) return Promise.resolve(cache[q]);
    if(inflight[q]) return inflight[q];
    var p = O.get('/v1/hotel-names', q ? { q: q } : undefined).then(function(j){
      var names = ((j && j.names) || []).map(function(n){ return n && n.name; }).filter(Boolean);
      if(!Object.keys(cache).length) stamp = Date.now();
      cache[q] = names; return names;
    }).catch(function(e){
      try{ console.warn('[ops] hotel-names ' + (e && e.message)); }catch(_){}
      return null;
    }).then(function(r){ delete inflight[q]; return r; });
    inflight[q] = p; return p;
  }

  // Unfiltered list = the server's names for every prefix fetched so far; filtered tiers stay local.
  window.bookingV2HotelNameList = function(zoneFilter, areaFilter){
    var qs = Object.keys(cache);
    if(!O.enabled() || zoneFilter || areaFilter || !qs.length || Date.now() - stamp >= TTL){
      return legacyList ? legacyList.apply(this, arguments) : [];
    }
    var seen = {}, out = [];
    qs.forEach(function(q){ cache[q].forEach(function(nm){
      var k = norm(nm); if(!k || seen[k]) return; seen[k] = 1; out.push(nm);
    }); });
    out.sort(function(a, b){ return a.localeCompare(b); });
    return out;
  };

  // The typeahead asks the server for what is typed; when the answer lands the open dropdown redraws.
  window.bookingV2HotelDDRender = function(val){
    var ret = legacyRender ? legacyRender.apply(this, arguments) : undefined;
    if(!O.enabled()) return ret;
    var typed = tidy(val);
    var fresh = !(cache[typed] && Date.now() - stamp < TTL);
    if(fresh) fetchNames(typed).then(function(names){
      if(!names) return;
      var inp = (typeof document !== 'undefined') ? document.getElementById('bkv2-hotel-input') : null;
      if(inp && document.activeElement === inp && tidy(inp.value) === typed && legacyRender) legacyRender(inp.value);
    });
    return ret;
  };

  // ── psuHotelMerge ──
  function reloadAffected(keys){
    var B = O.bookings; if(!B || !B.reload) return Promise.resolve(0);
    var hit = (typeof SB_BOOKINGS !== 'undefined' ? SB_BOOKINGS : []).filter(function(b){
      if(!b || !b.opsId) return false;
      if(['cancelled', 'cancelled_weather', 'rejected'].indexOf(b.status) >= 0) return false;
      return ['hotelName', 'pickup', 'dropoffHotelName'].some(function(f){ return keys[tidy(b[f]).toLowerCase()]; });
    });
    var i = 0;
    function worker(){
      if(i >= hit.length) return Promise.resolve();
      var b = hit[i++];
      return Promise.resolve(B.reload(b.id)).then(worker, worker);
    }
    var workers = []; for(var w = 0; w < 4; w++) workers.push(worker());
    return Promise.all(workers).then(function(){ return hit.length; });
  }

  window.psuHotelMerge = function(gid){
    if(!O.enabled()) return legacyMerge ? legacyMerge.apply(this, arguments) : undefined;
    if(typeof window.laGuardEdit === 'function' && !window.laGuardEdit('operations')) return;
    var G = psuHotelGroups().filter(function(x){ return x.id === gid; })[0]; if(!G) return;
    var keep = _psuHotelPick[gid] || G.keep;
    var drop = G.items.map(function(x){ return x.name; }).filter(function(x){ return x !== keep; });
    if(!drop.length){ alert('This group already has one name'); return; }
    if(!confirm('Merge ' + drop.length + ' names into "' + keep + '"\n\n'
      + drop.map(function(x){ return '  - ' + x; }).join('\n')
      + '\n\nRewrites the hotel name on every live booking that uses them. Cannot be undone.')) return;
    return O.queue(function(){ return O.post('/v1/hotels/merge', { from_names: drop, to_name: keep }); }).then(function(r){
      var keys = {}; drop.forEach(function(x){ keys[tidy(x).toLowerCase()] = 1; });
      reset();
      O.wrote('hotels');
      return reloadAffected(keys).then(function(){
        delete _psuHotelPick[gid];
        O.toast({ kind: 'neutral', title: 'Hotel merge · ' + ((r && r.changed) || 0) + ' booking(s) renamed', status: 'OK', sub: 'Now "' + keep + '"', dur: 6000 });
        if(typeof renderPickupSetup === 'function') renderPickupSetup();
        return r;
      });
    }).catch(function(e){
      O.fail('Hotel merge refused · nothing changed', e);
      return null;
    });
  };

  O.hotelNames = { fetch: fetchNames, reset: reset };
})();
