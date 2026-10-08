/* ══════════════════════════════════════════════════════════════════════════
   §opsAvail (2026-10-05) · seat numbers from the server
   ──────────────────────────────────────────────────────────────────────────
   GET /v1/availability?from=&to=              every route, ≤62 days per call
   GET /operations/allotment?route_id=&service_date=&exclude_booking_id=
                                               one route-day while a booking is
                                               being edited (its own seats don't
                                               count against it)

   getAllotment() is what ~27 screens read (booking form, calendar, By-trip,
   Boat Op, action board). It keeps computing locally; when the server's
   numbers for that route-day are in hand, the seat fields are replaced by
   the server's: booked, locked and available seats. The server sees every
   booking, including other users' and ones outside the loaded window; the
   local count only sees what this browser loaded.

   Missing numbers are fetched in the background and the screen is redrawn
   when they land (not while someone is typing). Every accepted write
   empties the cache, so the next read fetches fresh numbers.

   §opsUnlimited (2026-10-08) · two kinds of day sell with no seat check on
   the server, as legacy's hasAllotment:false does: a land route (City tour
   etc. · unlimited, available_seats null) and a marine day no boat is
   deployed on yet (available_seats 0 · unplaced_pax waits for a boat).
   Neither is ever full. getAllotment.__orig is the local count.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  var AV = {};            // 'route|date' → capacity numbers
  var AL = {};            // 'route|date|opsBookingId' → capacity numbers with that booking excluded
  var windows = {};       // window start → 'loading' | time loaded
  var allotBusy = {};
  var SPAN = 62;

  function put(route, date, cap){ if(route && date && cap) AV[route + '|' + date] = { d: cap, at: Date.now() }; }
  function clear(){ AV = {}; AL = {}; windows = {}; }

  var redrawT = null;
  function redraw(){
    clearTimeout(redrawT);
    redrawT = setTimeout(function(){
      if(O.busy()) return;
      var v = O.activeView();
      try{
        if(v === 'booking' && typeof bookingV2RenderKeep === 'function') bookingV2RenderKeep();
        else if(v === 'calendar' && typeof renderCal === 'function') renderCal();
        else if(v === 'operation' && typeof renderOp === 'function') renderOp();
        else if(v === 'dashboard' && typeof renderDash === 'function') renderDash();
        else if(v === 'actionboard' && typeof abRender === 'function') abRender();
      }catch(_){}
    }, 120);
  }

  function windowStart(date){ return date.slice(0, 8) + '01'; }
  function ensure(date){
    var w = windowStart(date);
    if(windows[w]) return;
    windows[w] = 'loading';
    var to = O.shift(w, SPAN - 1);
    O.get('/v1/availability', { from: w, to: to }).then(function(j){
      ((j && j.days) || []).forEach(function(d){ put(d.route_id, d.service_date, d); });
      windows[w] = Date.now();
      redraw();
    }).catch(function(e){
      // leave the window un-marked after a short pause, so it is retried · local numbers meanwhile
      setTimeout(function(){ if(windows[w] === 'loading') delete windows[w]; }, 30000);
      try{ console.warn('[ops] availability ' + w + ' · ' + e.message); }catch(_){}
    });
  }
  function ensureAllot(route, date, opsId){
    var k = route + '|' + date + '|' + opsId;
    if(AL[k] || allotBusy[k]) return;
    allotBusy[k] = 1;
    O.get('/operations/allotment', { route_id: route, service_date: date, exclude_booking_id: opsId }).then(function(j){
      AL[k] = { d: j, at: Date.now() }; redraw();
    }).catch(function(e){ try{ console.warn('[ops] allotment ' + k + ' · ' + e.message); }catch(_){} })
      .then(function(){ allotBusy[k] = 0; });
  }

  function noBoat(s){ return Array.isArray(s.deployments) ? !s.deployments.length : !(+s.deployed_capacity > 0); }
  /* legacy's "no limit" shape · the counts stay, for screens that show them */
  function noLimit(r, s){
    r.hasAllotment = false; r.isFull = false; r.state = 'no-allotment';
    r.totalCapacity = 0; r.availableCapacity = 0; r.seatsAvailable = 0; r.fillPct = 0;
    if(s){
      r.seatsConsumed = +s.booked_pax || 0; r.lockedSeats = +s.locked_pax || 0; r.charterPax = +s.charter_pax || 0;
      r.unplacedPax = +s.unplaced_pax || 0; r.unlimited = !!s.unlimited; r.serverAvailable = s.available_seats; r.fromServer = true;
    }
    return r;
  }
  function apply(r, s){
    if(s.unlimited || noBoat(s)) return noLimit(r, s);
    r.seatsConsumed = +s.booked_pax || 0;
    r.lockedSeats = +s.locked_pax || 0;
    r.seatsAvailable = Math.max(0, +s.available_seats || 0);
    r.serverAvailable = +s.available_seats || 0;        // can be negative on an oversold day · kept for whoever wants to show it
    r.charterPax = +s.charter_pax || 0;
    r.fillPct = r.availableCapacity > 0 ? Math.round((r.seatsConsumed + r.lockedSeats) / r.availableCapacity * 100) : 0;
    r.isFull = r.seatsAvailable <= 0;
    if(r.state !== 'all-chartered' && r.hasAllotment) r.state = r.isFull ? 'full' : (r.fillPct >= 80 ? 'tight' : 'open');
    r.fromServer = true;
    return r;
  }

  (function(){
    var orig = window.getAllotment;
    if(typeof orig !== 'function' || orig.__ops) return;
    var w = function(routeId, dateStr, excludeBkId){
      var r = orig.apply(this, arguments);
      try{
        if(!O.enabled() || !O.state.loaded || !r || !routeId || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr || '')) return r;
        // a land route has no seat pool on the server · legacy's dailyCap quota no longer limits it
        if(typeof laIsLandRoute === 'function' && laIsLandRoute(routeId)){
          var ls = AV[routeId + '|' + dateStr];
          if(!ls) ensure(dateStr);
          return noLimit(r, ls ? ls.d : null);
        }
        if(excludeBkId){
          var bk = (typeof SB_BOOKINGS !== 'undefined' ? SB_BOOKINGS : []).find(function(b){ return b && b.id === excludeBkId; });
          if(!bk || !bk.opsId) return r;                   // a booking the server never saw · nothing to exclude there
          var a = AL[routeId + '|' + dateStr + '|' + bk.opsId];
          if(!a){ ensureAllot(routeId, dateStr, bk.opsId); return r; }
          return apply(r, a.d);
        }
        var s = AV[routeId + '|' + dateStr];
        if(!s){ ensure(dateStr); return r; }
        return apply(r, s.d);
      }catch(_){ return r; }
    };
    w.__ops = true; w.__orig = orig; window.getAllotment = w;
  })();

  var refreshT = null;
  O.onWrite(function(){
    clear();
    clearTimeout(refreshT);
    refreshT = setTimeout(redraw, 300);       // the redraw asks again for what it shows
  });
  /* other users' writes · refetch what's cached, redraw only if a number moved (a redraw for
     nothing can still cost someone their scroll position on the heavier screens) */
  function refreshQuiet(){
    var starts = Object.keys(windows).filter(function(w){ return typeof windows[w] === 'number'; });
    AL = {};
    starts.forEach(function(w){
      O.get('/v1/availability', { from: w, to: O.shift(w, SPAN - 1) }).then(function(j){
        var moved = false;
        ((j && j.days) || []).forEach(function(d){
          var k = d.route_id + '|' + d.service_date, old = AV[k];
          if(!old || old.d.available_seats !== d.available_seats || old.d.booked_pax !== d.booked_pax || old.d.locked_pax !== d.locked_pax) moved = true;
          put(d.route_id, d.service_date, d);
        });
        windows[w] = Date.now();
        if(moved) redraw();
      }).catch(function(){});
    });
  }
  setInterval(function(){ if(O.enabled() && O.state.loaded && !document.hidden) refreshQuiet(); }, 120000);

  O.availability = { ensure: ensure, put: put, clear: clear, preload: function(){ var t = O.today(); ensure(t); ensure(O.shift(windowStart(t), SPAN)); } };
})();
