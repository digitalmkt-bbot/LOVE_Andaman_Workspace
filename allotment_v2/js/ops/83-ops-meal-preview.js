/* ═════════════════════════════════════════════════════════════════
   §opsMealPreview (w5-d, 2026-10-18) · the kitchen band, the overnight-return meal rows and the lunch slip rows from the server

   Legacy counts, in the browser, what the restaurant needs for a boat: heads that will sit down (adults / children / infants),
   veg / vegan / halal / allergy counts, the named allergy list, the lunch slip's line per booking (with the merged special request in
   Thai) and the overnight returns that still need an "รวม / ไม่รวม" decision. The server answers all of it, per boat and day:

     GET /v1/trip-actuals/{date}/{boat_id}  -> meal_preview { venue, adults, children, infants, amount, undecided_overnight[], booked,
                                               veg, vegan, halal, allergy, allergies[{name,qty}], requests[...], overnight[...] }
     (README "Trip actuals"; src/domain/trip-pl.ts mealPreview)

   Wrapped here:
     pckMealCount(rows)         the kitchen card's counts            <- adults, children, infants, booked, veg, vegan, halal, allergy
     pckAllergyList(rows)       the named allergy list               <- allergies
     mvLunchRows(date, bid)     the lunch slip's lines               <- requests
     pckMealOvnRows(date, bid)  the overnight returns of the boat    <- overnight (the booking / trip objects are the local ones)
     pckMealOvnNeed(date, bid)  the ones still to decide             <- undecided_overnight
     mvCost(venue, ad, chd)     the amount of a card                  <- amount (when the heads are the preview's)
   pckMealCount and pckAllergyList take a list of rows, not a boat: the boat is read from the rows, and only while the sheet has no
   filter on (a filtered sheet counts what it shows, as legacy does). The answer is read per boat and day when first needed; a write
   makes it stale and legacy's counting answers until the fresh one lands (the open sheet draws again then).
   pckMealStep (the +/- stopping at the booking's heads) stays a hint: PUT /v1/bookings/{id}/meals refuses more than the heads and its
   message shows (36-ops-day-actions.js).

   Load order: after 65-ops-meals.js and 74-ops-pier-service.js. Classic script.
   ═════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var originals = {}, store = {}, epoch = 0, timer = null;
  var IGNORE = /^(weather|market|devlog|daily-report|fleet|costing|trip-pl|config|addon-types|park|pier-cash|pier-office)/i;

  function enabled(){ return !!(O.enabled && O.enabled()); }
  function g(name){ try{ return window[name]; }catch(_){ return undefined; } }
  function enc(x){ return encodeURIComponent(x == null ? '' : String(x)); }
  function pckDate(){ try{ return typeof _pckDate !== 'undefined' ? _pckDate : ''; }catch(_){ return ''; } }
  function noFilter(){
    try{ return !(_pckBoat || _pckVan || _pckArr || _pckStat || _pckQ || _pckFam || _pckRoute || _pckPier); }catch(_){ return false; }
  }
  function localBooking(id){
    var l = typeof SB_BOOKINGS !== 'undefined' && Array.isArray(SB_BOOKINGS) ? SB_BOOKINGS : [];
    for(var i = 0; i < l.length; i++) if(l[i] && (l[i].opsId === id || l[i].id === id)) return l[i];
    return null;
  }

  function redraw(){
    if(timer) return;
    timer = setTimeout(function(){
      timer = null;
      if(!enabled() || (O.busy && O.busy())) return;
      try{ if(O.activeView && O.activeView() === 'piercheckin' && typeof g('renderPierCheckin') === 'function') window.renderPierCheckin(); }catch(_){}
    }, 150);
  }
  /* the preview of a boat and day, or null (and a read is on its way) */
  function previewOf(date, bid){
    if(!enabled() || !date || !bid) return null;
    var k = date + '|' + bid, c = store[k];
    if(c && c.data && c.epoch === epoch) return c.data;
    if(c && c.loading && c.epoch === epoch) return null;
    c = store[k] = { data: c ? c.data : null, sig: c ? c.sig : '', epoch: epoch, loading: true };
    var ep = epoch;
    O.get('/v1/trip-actuals/' + enc(date) + '/' + enc(bid)).then(function(res){
      var p = (res && res.meal_preview) || null, sig = JSON.stringify(p);
      var cur = store[k]; if(!cur || cur.epoch !== ep) { if(cur && cur.epoch !== ep) previewOf(date, bid); return; }
      cur.loading = false; cur.data = p; var changed = sig !== cur.sig; cur.sig = sig;
      if(changed || cur.fresh !== true){ cur.fresh = true; redraw(); }
    }, function(){ var cur = store[k]; if(cur && cur.epoch === ep){ cur.loading = false; cur.data = null; } });
    return null;
  }

  function wrap(name, fn){
    var orig = window[name]; if(typeof orig !== 'function' || orig.__opsMealPreview) return;
    originals[name] = orig;
    var w = function(){
      if(!enabled()) return orig.apply(this, arguments);
      var r;
      try{ r = fn.call(this, orig, arguments); }catch(e){ if(window.console) console.warn('[ops] meal preview · ' + name + ' · ' + (e && e.message)); r = undefined; }
      return r === undefined ? orig.apply(this, arguments) : r;
    };
    w.__opsMealPreview = true; window[name] = w;
  }
  function boatOfRows(rows){
    for(var i = 0; i < rows.length; i++){
      var r = rows[i]; if(!r) continue;
      var b = r.bid || (r.O && r.O.boatId) || (r.t && r.t.charterBoatId) || '';
      if(b) return b;
    }
    return '';
  }

  wrap('pckMealCount', function(orig, a){
    var rows = a[0]; if(!Array.isArray(rows) || !rows.length || !noFilter()) return undefined;
    var P = previewOf(pckDate(), boatOfRows(rows)); if(!P) return undefined;
    var ad = +P.adults || 0, chd = +P.children || 0, inf = +P.infants || 0;
    return { ad: ad, chd: chd, inf: inf, tot: ad + chd + inf, book: +P.booked || 0, veg: +P.veg || 0, vegan: +P.vegan || 0, halal: +P.halal || 0, allergy: +P.allergy || 0 };
  });
  wrap('pckAllergyList', function(orig, a){
    var rows = a[0]; if(!Array.isArray(rows) || !rows.length || !noFilter()) return undefined;
    var P = previewOf(pckDate(), boatOfRows(rows)); if(!P || !Array.isArray(P.allergies)) return undefined;
    return P.allergies.map(function(x){ return { name: x.name, qty: +x.qty || 0 }; });
  });
  wrap('mvLunchRows', function(orig, a){
    var date = a[0], bid = a[1], P = previewOf(date, bid); if(!P || !Array.isArray(P.requests)) return undefined;
    return P.requests.map(function(r){
      var b = localBooking(r.booking_id), t = b && typeof g('ckTripOn') === 'function' ? window.ckTripOn(b, date) : null;
      return { lead: String(r.lead || '—'), ad: +r.adults || 0, chd: +r.children || 0, inf: +r.infants || 0, foc: +r.foc || 0, sr: String(r.request || ''),
        ovn: !!r.overnight, inc: r.overnight ? (r.include === 'in' || r.include === 'out' ? r.include : '') : 'in', bkId: b ? b.id : r.booking_id,
        outDate: (r.overnight && b && t && typeof g('_ovnOutDate') === 'function') ? window._ovnOutDate(b, t) : '' };
    });
  });
  wrap('pckMealOvnRows', function(orig, a){
    var date = a[0], bid = a[1], P = previewOf(date, bid); if(!P || !Array.isArray(P.overnight)) return undefined;
    var out = [];
    for(var i = 0; i < P.overnight.length; i++){
      var o = P.overnight[i], b = localBooking(o.booking_id); if(!b) return undefined;
      var t = typeof g('ckTripOn') === 'function' ? window.ckTripOn(b, date) : null; if(!t) return undefined;
      var Op = typeof g('bkOpsRead') === 'function' ? window.bkOpsRead(b, date) : (b.ops || {});
      var booked = typeof g('ckBookedPax') === 'function' ? window.ckBookedPax(t) : 0;
      var exp = typeof g('pckExpected') === 'function' ? window.pckExpected(b, date, booked) : booked;
      out.push({ b: b, t: t, O: Op, booked: booked, expect: exp, ck: Op.pierCheckin || null, _vd: null, pax: +o.pax || 0,
        inc: (o.include === 'in' || o.include === 'out') ? o.include : '', outDate: typeof g('_ovnOutDate') === 'function' ? window._ovnOutDate(b, t) : '' });
    }
    out.sort(function(x, y){ return String(x.b.leadPax || '').localeCompare(String(y.b.leadPax || ''), 'th'); });
    return out;
  });
  wrap('pckMealOvnNeed', function(orig, a){
    var date = a[0], bid = a[1], P = previewOf(date, bid); if(!P || !Array.isArray(P.undecided_overnight)) return undefined;
    var ids = {}; P.undecided_overnight.forEach(function(x){ ids[x.booking_id] = 1; });
    var rows = window.pckMealOvnRows(date, bid) || [];
    return rows.filter(function(x){ return ids[x.b.opsId] || ids[x.b.id]; });
  });

  /* mvCost(venue, adults, children) · the amount of a card: the preview that was counted for these heads at this venue says it (amount) */
  wrap('mvCost', function(orig, a){
    var V = a[0], ad = +a[1] || 0, chd = +a[2] || 0; if(!V || !V.id) return undefined;
    var ks = Object.keys(store);
    for(var i = 0; i < ks.length; i++){
      var c = store[ks[i]], P = c && c.data && c.epoch === epoch ? c.data : null;
      if(P && P.venue && P.venue.id === V.id && +P.adults === ad && +P.children === chd && P.amount != null) return +P.amount;
    }
    return undefined;
  });

  O.onWrite(function(kind){
    if(IGNORE.test(String(kind || ''))) return;
    epoch++;
    if(O.activeView && O.activeView() === 'piercheckin') redraw();
  });
  O.mealPreview = { of: previewOf, clear: function(){ store = {}; epoch++; } };
})();
