/* ════════════════════════════════════════════════════════════════════════
   §opsMeals (2026-10-17) · meal venues, the day's meal order, meal notes and overnight meals ⇄ operation-backend
   ────────────────────────────────────────────────────────────────────────
   Meal venues (legacy MEAL_VENUES, mvAdd / mvSet / mvToggle / mvRouteSet):
     GET   /v1/meal-venues                       → MEAL_VENUES, and each route's mealVenueId
     POST  /v1/meal-venues                       → mvAdd (the server's defaults, its id)
     PATCH /v1/meal-venues/{id}                  → mvSet (one field) and mvToggle (active)
     PUT   /v1/routes/{id}/meal-venue            → mvRouteSet { meal_venue_id | null }

   Trip actuals (legacy TRIP_ACT, one entry per boat and day, key date::boat):
     GET  /v1/trip-actuals?from=&to=             → the mapped fields of every row in the window
     PUT  /v1/trip-actuals/{date}/{boat}/meal-overnight/{booking}   → pckMealOvnSet { include }
     PUT  /v1/trip-actuals/{date}/{boat}/meal-note                  → pckMealNoteSave { text }
     POST /v1/trip-actuals/{date}/{boat}/meal-order                 → pckMealSend (the server counts and prices)
   Every write answers the day's actual; that answer is copied into TRIP_ACT, so the screen reads what the
   server saved. Legacy names kept: mealOvn, mealNote, meal { venueId, name, ad, chd, priceAd, priceCh, amount, at, by }.

   Typing in a venue's text or price fields saves 600 ms after the last key (the field shows what was typed).
   Classic script. Loads after 08-app.js, before 90-ops-boot.js (boot calls load()).
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  var DEBOUNCE_MS = 600;
  var TRIP_BACK_DAYS = 730, TRIP_AHEAD_DAYS = 90;
  var timers = {};

  function enabled(){ return !!(O.enabled && O.enabled()); }
  function enc(v){ return encodeURIComponent(v == null ? '' : String(v)); }
  function venues(){ return (typeof MEAL_VENUES !== 'undefined' && Array.isArray(MEAL_VENUES)) ? MEAL_VENUES : null; }
  function routes(){ return (typeof ROUTES !== 'undefined' && Array.isArray(ROUTES)) ? ROUTES : []; }
  function findVenue(id){ var list = venues() || []; return list.filter(function(v){ return v && v.id === id; })[0] || null; }
  function redrawCt(){ try{ if(typeof window.ctRender === 'function') window.ctRender(); }catch(_){} }
  function redrawPier(){ try{ if(typeof window.renderPierCheckin === 'function') window.renderPierCheckin(); }catch(_){} }
  function wrap(name, fn){
    var orig = window[name]; if(typeof orig !== 'function') return;
    window[name] = function(){
      if(!enabled()) return orig.apply(this, arguments);
      return fn.apply(this, [orig].concat([].slice.call(arguments)));
    };
    window[name].__opsMeals = true;
  }

  /* ── meal venues ── */
  function venueIn(s){
    s = s || {};
    return { id: s.id, name: s.name || '', place: s.place || '', priceAd: +s.price_adult || 0, priceCh: +s.price_child || 0,
             phone: s.phone || '', eta: s.eta || '', note: s.note || '', active: s.active !== false };
  }
  function applyVenues(j){
    var list = venues(); if(!list || !j) return;
    list.length = 0;
    (j.venues || []).forEach(function(v){ list.push(venueIn(v)); });
    var map = j.routes || {};
    routes().forEach(function(r){ if(r) r.mealVenueId = map[r.id] || ''; });
  }
  function loadVenues(){
    return O.get('/v1/meal-venues').then(function(j){ applyVenues(j); return true; });
  }
  function reloadVenuesThenDraw(){ loadVenues().then(redrawCt, function(){ redrawCt(); }); }

  /* legacy field → server field; the price fields are numbers, the text ones cut to 80 characters */
  var VENUE_FIELD = { name: 'name', place: 'place', phone: 'phone', eta: 'eta', note: 'note', priceAd: 'price_adult', priceCh: 'price_child' };
  function venueValue(f, v){ return (f === 'priceAd' || f === 'priceCh') ? (+v || 0) : String(v == null ? '' : v).slice(0, 80); }

  function patchVenue(id, body){
    return O.queue(function(){
      return O.call('PATCH', '/v1/meal-venues/' + enc(id), body);
    });
  }

  wrap('mvAdd', function(orig){
    return O.queue(function(){
      return O.post('/v1/meal-venues', {});
    }).then(function(s){
      var list = venues(); if(list) list.push(venueIn(s));
      O.wrote('meal-venue');
      redrawCt();
      return s;
    }).catch(function(e){ O.fail('Could not add the restaurant', e); return null; });
  });

  var pendingSet = {};
  wrap('mvSet', function(orig, id, f, v){
    var x = findVenue(id); if(!x || !VENUE_FIELD[f]) return undefined;
    var val = venueValue(f, v);
    x[f] = val;
    var key = id + '|' + f;
    clearTimeout(pendingSet[key]);
    pendingSet[key] = setTimeout(function(){
      delete pendingSet[key];
      var body = {}; body[VENUE_FIELD[f]] = val;
      patchVenue(id, body).then(function(s){
        var cur = findVenue(id); if(cur) cur[f] = venueIn(s)[f];
        O.wrote('meal-venue');
        redrawCt();
      }, function(e){
        O.fail('Could not save the restaurant', e);
        reloadVenuesThenDraw();
      });
    }, DEBOUNCE_MS);
    if(f !== 'name' && f !== 'place' && f !== 'phone' && f !== 'eta') redrawCt();   // as legacy: typing is not redrawn
    return undefined;
  });

  wrap('mvToggle', function(orig, id){
    var x = findVenue(id); if(!x) return undefined;
    var next = (x.active === false);
    return patchVenue(id, { active: next }).then(function(s){
      var cur = findVenue(id); if(cur) cur.active = s.active !== false;
      O.wrote('meal-venue');
      redrawCt();
      return s;
    }).catch(function(e){ O.fail('Could not change the restaurant', e); reloadVenuesThenDraw(); return null; });
  });

  wrap('mvRouteSet', function(orig, rid, vid){
    var r = typeof window.getRoute === 'function' ? window.getRoute(rid) : null; if(!r) return undefined;
    var venueId = vid || null;
    return O.queue(function(){
      return O.call('PUT', '/v1/routes/' + enc(rid) + '/meal-venue', { meal_venue_id: venueId });
    }).then(function(){
      r.mealVenueId = vid || '';
      O.wrote('route');
      redrawCt();
      return null;
    }).catch(function(e){ O.fail('Could not set the restaurant of this route', e); redrawCt(); return null; });
  });

  /* ── trip actuals: the server's row → the legacy TRIP_ACT fields ── */
  function legacyOf(row){
    var out = {};
    if(row && row.meal_overnight && Object.keys(row.meal_overnight).length) out.mealOvn = Object.assign({}, row.meal_overnight);
    if(row && row.meal_note && row.meal_note.text) out.mealNote = { t: row.meal_note.text, at: row.meal_note.at || '', by: row.meal_note.by || '' };
    if(row && row.meal) out.meal = { venueId: row.meal.venue_id, name: row.meal.venue_name || '', ad: row.meal.adults || 0, chd: row.meal.children || 0,
                                     priceAd: row.meal.price_adult || 0, priceCh: row.meal.price_child || 0, amount: row.meal.amount || 0,
                                     at: row.meal.at || '', by: row.meal.by || '' };
    return out;
  }
  function trips(){ return (typeof TRIP_ACT !== 'undefined' && TRIP_ACT && typeof TRIP_ACT === 'object') ? TRIP_ACT : null; }
  function dropMapped(cur){ delete cur.mealOvn; delete cur.mealNote; delete cur.meal; return cur; }
  function applyActual(date, bid, row){
    var T = trips(); if(!T) return;
    var k = String(date || '') + '::' + String(bid || '');
    var cur = dropMapped(T[k] || {});
    Object.assign(cur, legacyOf(row));
    if(Object.keys(cur).length) T[k] = cur; else delete T[k];
  }
  function clearMapped(){
    var T = trips(); if(!T) return;
    Object.keys(T).forEach(function(k){
      var cur = dropMapped(T[k] || {});
      if(Object.keys(cur).length) T[k] = cur; else delete T[k];
    });
  }
  function loadTrips(){
    var from = O.shift(O.today(), -TRIP_BACK_DAYS), to = O.shift(O.today(), TRIP_AHEAD_DAYS);
    return O.get('/v1/trip-actuals', { from: from, to: to }).then(function(j){
      clearMapped();
      ((j && j.trip_actuals) || []).forEach(function(row){ applyActual(row.service_date, row.boat_id, row); });
      return true;
    });
  }

  function actualWrite(date, bid, method, path, body){
    return O.queue(function(){
      return O.call(method, '/v1/trip-actuals/' + enc(date) + '/' + enc(bid) + path, body);
    });
  }

  wrap('pckMealOvnSet', function(orig, date, bid, bkId, v){
    if(typeof window.laGuardEdit === 'function' && !window.laGuardEdit('operations')) return undefined;
    var include = (v === 'in' || v === 'out') ? v : null;
    return actualWrite(date, bid, 'PUT', '/meal-overnight/' + enc(bkId), { include: include }).then(function(j){
      applyActual(date, bid, j);
      O.wrote('trip-actual');
      redrawPier();
      return j;
    }).catch(function(e){ O.fail('Could not save the overnight meal choice', e); redrawPier(); return null; });
  });

  wrap('pckMealNoteSave', function(orig, clear){
    var bid = (typeof _pckMealNoteBid !== 'undefined') ? _pckMealNoteBid : null;
    var date = (typeof _pckDate !== 'undefined') ? _pckDate : null;
    if(!bid) return undefined;
    var t = document.getElementById('pck-mnote-tx');
    var txt = clear ? '' : String((t && t.value) || '').trim();
    return actualWrite(date, bid, 'PUT', '/meal-note', { text: txt }).then(function(j){
      applyActual(date, bid, j);
      O.wrote('trip-actual');
      if(typeof window.acctModalClose === 'function') window.acctModalClose();
      redrawPier();
      return j;
    }).catch(function(e){ O.fail('Could not save the restaurant note', e); return null; });
  });

  /* legacy pckMealSend's route lookup, as it reads it (the trip's route, else the first booking's route) */
  function routeOfTrip(date, bid){
    var rid = '';
    try{
      var T = (typeof TRIPS !== 'undefined') ? TRIPS : null; var op = (T && T[date]) ? T[date][bid] : null;
      rid = (op && op.route) || '';
    }catch(_){}
    if(!rid){ try{ ((typeof SB_BOOKINGS !== 'undefined' && SB_BOOKINGS) || []).some(function(b){
      var t = window.ckTripOn(b, date); if(!t) return false;
      var O2 = window.bkOpsRead(b, date); if((O2.boatId || t.charterBoatId) !== bid) return false;
      rid = t.routeId; return true; }); }catch(_){} }
    return rid;
  }
  /* after the order is saved, the legacy order slip (Visit Panwa only), as pckMealSend opened it */
  function openSlip(date, bid, j){
    var m = j && j.meal; if(!m) return;
    var rid = routeOfTrip(date, bid);
    var lunchOk = (typeof window.mvLunchOk === 'function') && window.mvLunchOk(rid);
    if(lunchOk && typeof window.mvOrderSlip === 'function'){
      try{ window.mvOrderSlip(date, bid, findVenue(m.venue_id), rid); }catch(e){ console.warn('[meal] slip failed', e); }
    } else {
      alert('บันทึกยอดอาหารของทริปนี้แล้ว\n\nใบสั่งอาหารตอนนี้ทำเฉพาะฝั่ง Visit Panwa · '
        + 'ท่านี้ใช้ใบคนละแบบ ยังไม่ได้ทำ');
    }
  }

  wrap('pckMealSend', function(orig, bid){
    if(typeof window.laGuardEdit === 'function' && !window.laGuardEdit('operations')) return undefined;
    var date = (typeof _pckDate !== 'undefined') ? _pckDate : null;
    return O.queue(function(){
      return O.post('/v1/trip-actuals/' + enc(date) + '/' + enc(bid) + '/meal-order', {});
    }).then(function(j){
      applyActual(date, bid, j);
      O.wrote('trip-actual');
      openSlip(date, bid, j);
      redrawPier();
      return j;
    }).catch(function(e){ O.fail('Could not send the meal order', e); return null; });
  });

  O.meals = {
    load: function(){ return Promise.all([loadVenues(), loadTrips()]); },
    loadVenues: loadVenues,
    loadTrips: loadTrips
  };
})();
