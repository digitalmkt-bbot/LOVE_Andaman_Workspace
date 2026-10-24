/* ══════════════════════════════════════════════════════════════════════════
   §opsDayBookings (2026-10-15) · day screens that sum SB_BOOKINGS for ONE date
   ──────────────────────────────────────────────────────────────────────────
   Booking records are page-owned (90-ops-boot.js): nothing preloads them, and each screen must ask
   for the window it shows. Four screens read the day's bookings and asked for nothing, so they drew
   from whatever another view happened to have loaded (usually nothing, or part of a month):

     Pier Check-in (renderPierCheckin, _pckDate)  expected/lost, split rows, add-ons, boat stats,
                                                  guide job order, allergy list, travel register
     Boat job sheet (renderPierJob, _poDate)      pjPax / pjPrep boat counts
     Transfer Fleet (renderVehicles)              per-van jobs + the day summary (vehJobsFor)
     Seat lock page (bookingV2LockManageOpen)     the lock audit + "bookings on this trip" coverage

   Same model as 56-ops-rep-pickupmap.js: run the legacy render at once, load the date, run it once
   more when the load lands. bookingV2OpsEnsureDay answers null for a date already cached, so the
   second render asks for nothing and the chain stops.  Transfer Fleet also needs the van groups on
   the bookings (bkOpsRead(b, d).vanId), which O.vanJobs.loadDay brings with the day's bookings; its
   own 5 s throttle (kickedAt) keeps a re-render from re-asking.
   Legacy mode (!O.enabled()): every wrapper is the original, zero requests.
   Load order: after js/booking/*.js, 30-ops-locks.js, 35-ops-vehicles.js and 47-ops-pier-job.js. Classic script.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  var kickedAt = {};
  function enabled(){ return !!(O.enabled && O.enabled()); }
  function ymd(d){ return (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) ? d : ''; }
  function uniq(list){ var out = []; list.forEach(function(d){ d = ymd(d); if(d && out.indexOf(d) < 0) out.push(d); }); return out; }
  function view(){ return O.activeView ? O.activeView() : ''; }

  /* the originals are the functions as they were when this file loaded */
  function wrap(name, fn){
    var orig = window[name];
    if(typeof orig !== 'function') return;
    var w = function(){
      if(!enabled()) return orig.apply(this, arguments);
      return fn.apply(this, [orig].concat([].slice.call(arguments)));
    };
    w.__opsDayBookings = true;
    window[name] = w;
  }

  /* run the original now, ask for the dates, run it again if anything was fetched */
  function afterDays(orig, self, args, dates, still){
    var r = orig.apply(self, args);
    var loads = [];
    if(typeof window.bookingV2OpsEnsureDay === 'function'){
      dates.forEach(function(d){ var p = window.bookingV2OpsEnsureDay(d); if(p) loads.push(p); });
    }
    if(loads.length){
      Promise.all(loads).then(function(rs){
        if(rs.every(Boolean) && still()) orig.apply(self, args);
      }).catch(function(){});
    }
    return r;
  }

  /* top-level `let` globals of 08-app.js (_vehDate, _bkV2LockManageId) are not window properties: read them by bare name */
  function pckDate(){ try{ return _pckDate; }catch(_){ return ''; } }
  function poDate(){ try{ return _poDate; }catch(_){ return ''; } }
  function vehDate(){ try{ return _vehDate; }catch(_){ return ''; } }
  function lockOpen(){ try{ return _bkV2LockManageId; }catch(_){ return null; } }

  /* Pier Check-in · the date is _pckDate (a top-level var of 08-app.js) */
  wrap('renderPierCheckin', function(orig){
    var d = ymd(pckDate()), args = [].slice.call(arguments, 1);
    return afterDays(orig, this, args, uniq([d]), function(){ return ymd(pckDate()) === d && !!document.getElementById('piercheckin-host'); });
  });

  /* Re-confirm (renderReconfirm, _rcDate), Doc check (renderDocCheck, _docCheck.date), Insurance
     (renderInsurance, _insDate) · 2026-10-20. Each lists the day's bookings from SB_BOOKINGS and loaded nothing.
     Decision: Re-confirm also loads bookings (not GET /v1/reconfirm?date=): the legacy page builds its rows
     (_rcRowData, the agent/route grouping, picks, sent state) from the booking objects, so loading the day keeps
     the screen identical and the 39-ops-reconfirm.js writes keep updating the same objects. */
  function rcDate(){ try{ return _rcDate || O.today(); }catch(_){ return ''; } }
  function docDate(){ try{ return _docCheck.date; }catch(_){ return ''; } }
  function insDate(){ try{ return _insDate; }catch(_){ return ''; } }

  wrap('renderReconfirm', function(orig){
    var d = ymd(rcDate()), args = [].slice.call(arguments, 1);
    return afterDays(orig, this, args, uniq([d]), function(){ return ymd(rcDate()) === d && !!document.getElementById('reconfirm-host'); });
  });
  wrap('renderDocCheck', function(orig){
    var d = ymd(docDate()), args = [].slice.call(arguments, 1);
    return afterDays(orig, this, args, uniq([d]), function(){ return ymd(docDate()) === d && !!document.getElementById('doccheck-host'); });
  });
  wrap('renderInsurance', function(orig){
    var d = ymd(insDate()), args = [].slice.call(arguments, 1);
    return afterDays(orig, this, args, uniq([d]), function(){ return ymd(insDate()) === d && !!document.getElementById('insurance-host'); });
  });

  /* Boat job sheet · _poDate */
  wrap('renderPierJob', function(orig){
    var d = ymd(poDate()), args = [].slice.call(arguments, 1);
    return afterDays(orig, this, args, uniq([d]), function(){ return ymd(poDate()) === d; });
  });

  /* Park tickets (renderPierPark, _poDate) · its boats and the people on them come from the day's bookings: with none loaded it said
     "no boats today" (Panwa) or listed one boat of five (Tub Lamu) while lk showed them all */
  wrap('renderPierPark', function(orig){
    var d = ymd(poDate()), args = [].slice.call(arguments, 1);
    return afterDays(orig, this, args, uniq([d]), function(){ return ymd(poDate()) === d; });
  });

  /* Seat lock page · a lock's audit reads the bookings that name it; a day lock names one date */
  wrap('bookingV2LockManageOpen', function(orig, id){
    var args = [].slice.call(arguments, 1), L = null;
    try{ L = (typeof SB_SEAT_LOCKS !== 'undefined' ? SB_SEAT_LOCKS : []).find(function(x){ return x && x.id === id; }); }catch(_){}
    var spans = L && typeof window.bookingV2LockSpansDays === 'function' && window.bookingV2LockSpansDays(L);
    var d = ymd(L && !spans && L.date);
    var r = orig.apply(this, args);
    var p = (d && typeof window.bookingV2OpsEnsureDay === 'function') ? window.bookingV2OpsEnsureDay(d) : null;
    if(p) p.then(function(res){
      if(res && lockOpen() === id && typeof window.bookingV2Render === 'function') window.bookingV2Render();
    }).catch(function(){});
    return r;
  });

  /* Transfer Fleet · today (status tab), the matrix day and the summary day; the van assignment lives in the
     van groups, which the van adapter loads together with the day's bookings */
  wrap('renderVehicles', function(orig){
    var args = [].slice.call(arguments, 1), self = this;
    var r = orig.apply(self, args);
    var V = O.vanJobs;
    if(!V || typeof V.loadDay !== 'function') return r;
    var today = O.today ? O.today() : '';
    var dates = uniq([today, vehDate(), window._vehSumDay]);
    var sig = 'veh|' + dates.join(','), now = Date.now();
    if(kickedAt[sig] && now - kickedAt[sig] < 5000) return r;
    kickedAt[sig] = now;
    Promise.all(dates.map(function(d){ return V.loadDay(d); })).then(function(){
      if(view() === 'vehicles' && !(O.busy && O.busy())) orig.apply(self, args);
    }).catch(function(){});
    return r;
  });

  if(O.onWrite) O.onWrite(function(){ kickedAt = {}; });
})();
