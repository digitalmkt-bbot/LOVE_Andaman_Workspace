/* ══════════════════════════════════════════════════════════════════════════
   §opsVanStrands (Q33) · moved-away rows come from the server, not the browser blob
   ──────────────────────────────────────────────────────────────────────────
   A booking moved off a day it had arranged (van, boat or check-in) leaves a struck row on the old
   day's Van Check-in, Van Jobs and Pier Check-in. Legacy kept the snapshot in this browser
   (blob key `ops_stranded`), so a second machine never saw it. Now the server takes the snapshot
   when the trip moves, and every machine reads it:

     GET    /operations/van-strands?date=            the day's rows (read here, per date)
     DELETE /operations/van-strands/{booking}/{date} the clear button (ckStrandClear, 36-ops-day-actions.js)

   Legacy functions, in ops mode:
     ckStrandMovedRows(date)   rows from the cache of that date, in legacy's row shape
     ckStrandStore()           the cached rows as legacy's { "<booking>|<day>": {…} } map (read only)
     ckStrandStoreSave(o)      nothing: the blob is not written any more
     ckStrandSnap(...)         nothing is stored by the browser; the server snapshots the move.
                               The day's cache is marked stale so the next draw asks again.
     ckStrandMvDrop(key)       drops the row from the cache (the DELETE already succeeded) and asks again
   The screens draw synchronously, so each render asks for its day (at most once per 4 s, at once
   after a booking write) and draws again when the answer differs from what was drawn.
   A moved booking that is not in the browser yet (a fresh machine) is fetched by id first.

   Legacy mode (!O.enabled()): every wrapped function runs the original.
   Classic script · loads after 36-ops-day-actions.js.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  function enabled(){ return !!(O.enabled && O.enabled()); }
  function enc(v){ return encodeURIComponent(v == null ? '' : String(v)); }
  function listBookings(){ return typeof SB_BOOKINGS !== 'undefined' && Array.isArray(SB_BOOKINGS) ? SB_BOOKINGS : []; }
  function findBooking(id){ return listBookings().find(function(b){ return b && (b.id === id || b.opsId === id); }) || null; }

  var originals = {};
  function wrap(name, fn){
    var orig = window[name];
    originals[name] = orig;
    window[name] = function(){
      if(!enabled()) return typeof orig === 'function' ? orig.apply(this, arguments) : undefined;
      return fn.apply(this, [orig].concat([].slice.call(arguments)));
    };
  }

  var days = {};          // date -> { rows: [server rows], at: ms, sig: text, loading: Promise|null, stale: bool }
  var SPAN = 4000;

  function pax(p){
    p = p || {};
    return { ad: +p.ad || 0, chd: +p.chd || 0, inf: +p.inf || 0, foc: +p.foc || 0 };
  }

  /* legacy's ckStrandMovedRows row, from one server row (numbers are zero: a moved row counts nowhere) */
  function legacyRow(r, date){
    var b = findBooking(r.booking_id); if(!b) return null;      // not on this machine (yet): legacy skipped it too
    var vid = r.van_id || '';
    return {
      b: b,
      t: { routeId: r.route_id || '', date: date, zone: r.zone || '', pax: pax(r.pax), pickupTime: r.pickup_time || '' },
      O: { vanId: vid, vanReturnId: r.return_van_id || '', vanGroup: +r.group_number || 0, vanSeq: +r.sequence || 0,
           boatId: r.boat_id || '', pickupTimeFinal: r.pickup_time || '' },
      booked: 0, expect: 0, ck: null, van: null, _vd: null,
      vanId: vid, vanIds: vid ? [vid] : [], bid: r.boat_id || '',
      strand: 'mv', strandWhy: r.why_text || '', mvTo: r.to_date || '', _mvKey: b.id + '|' + date
    };
  }
  function rowsOf(date){
    var d = days[date]; if(!d) return [];
    return d.rows.map(function(r){ return legacyRow(r, date); }).filter(Boolean);
  }

  /* fetch the moved bookings this machine does not hold, so the row has its booking and the clear button works */
  function fetchMissing(rows){
    var seen = {}, need = rows.filter(function(r){ if(findBooking(r.booking_id) || seen[r.booking_id]) return false; seen[r.booking_id] = 1; return true; });
    return Promise.all(need.map(function(r){
      return O.get('/v1/bookings/' + enc(r.booking_id)).then(function(ob){
        if(O.bookings && O.bookings.upsert) O.bookings.upsert(ob);
      }).catch(function(e){ try{ console.warn('[ops] moved booking ' + r.booking_id + ' did not load · ' + (e && e.message)); }catch(_){} });
    }));
  }

  /* the screens' date variables: `var` in 08-app.js for most, but `let` (not on window) for _vanJobsDate */
  function dateOf(name){
    try{
      switch(name){
        case '_vanCkDate': return typeof _vanCkDate !== 'undefined' ? _vanCkDate : '';
        case '_vanJobsDate': return typeof _vanJobsDate !== 'undefined' ? _vanJobsDate : '';
        case '_pckDate': return typeof _pckDate !== 'undefined' ? _pckDate : '';
        case '_tsDate': return typeof _tsDate !== 'undefined' ? _tsDate : '';
      }
    }catch(_){}
    return '';
  }

  /* draw the screen of that day again, keeping the scroll, unless someone is typing in it */
  function redraw(date){
    try{
      if(O.busy && O.busy()) return;
      var sy = window.scrollY || window.pageYOffset || 0, did = false;
      [['vancheckin-host', 'renderVanCheckin', '_vanCkDate'], ['piercheckin-host', 'renderPierCheckin', '_pckDate'],
       ['landcheckin-host', 'renderLandCheckin', '_pckDate'], ['vanjobs-host', 'renderVanJobs', '_vanJobsDate']].forEach(function(h){
        var el = document.getElementById(h[0]); if(!el || !el.offsetParent) return;
        var cur = dateOf(h[2]);
        if(cur && cur !== date) return;
        if(typeof window[h[1]] === 'function'){ did = true; window[h[1]](); }
      });
      var ts = document.getElementById('view-travelsum');
      if(ts && ts.offsetParent && dateOf('_tsDate') === date && typeof window.renderTravelSum === 'function'){ did = true; window.renderTravelSum(); }
      if(did) try{ window.scrollTo(0, sy); }catch(_){}
    }catch(_){}
  }

  function load(date, force){
    if(!enabled() || !date) return Promise.resolve(null);
    var d = days[date] || (days[date] = { rows: [], at: 0, sig: null, loading: null, stale: true, ver: 0 });
    if(d.loading) return d.loading;
    if(!force && !d.stale && Date.now() - d.at < SPAN) return Promise.resolve(d.rows);
    var ver = d.ver;
    d.loading = O.get('/operations/van-strands', { date: date }).then(function(j){
      var rows = (j && Array.isArray(j.rows)) ? j.rows : [];
      return fetchMissing(rows).then(function(){ return rows; });
    }).then(function(rows){
      var sig = JSON.stringify(rows);
      var changed = d.sig !== sig;
      d.rows = rows; d.sig = sig; d.at = Date.now(); d.stale = (d.ver !== ver); d.loading = null;   // a write that landed meanwhile keeps it stale
      if(changed) redraw(date);
      return rows;
    }, function(e){
      d.loading = null; d.at = Date.now();     // do not hammer a server that said no; the next draw after SPAN asks again
      try{ console.warn('[ops] moved-away rows did not load · ' + (e && e.message)); }catch(_){}
      return null;
    });
    return d.loading;
  }
  function stale(date){ (date ? [date] : Object.keys(days)).forEach(function(k){ if(days[k]){ days[k].stale = true; days[k].ver++; } }); }

  wrap('ckStrandMovedRows', function(orig, date){ return rowsOf(date); });

  wrap('ckStrandStore', function(){
    var S = {};
    Object.keys(days).forEach(function(date){
      rowsOf(date).forEach(function(r){ S[r._mvKey] = { to: r.mvTo, why: 'moved', vanId: r.vanId, routeId: r.t.routeId }; });
    });
    return S;
  });
  wrap('ckStrandStoreSave', function(){ return undefined; });

  // The browser takes no snapshot: the server did when the trip moved. Ask again for the old day.
  wrap('ckStrandSnap', function(orig, b, date){
    stale(date);
    O.queue(function(){ return null; }).then(function(){ return load(date, true); });
    return true;
  });

  // The clear button's DELETE has answered (ckStrandClear, 36-ops-day-actions.js): drop the row, then read again.
  wrap('ckStrandMvDrop', function(orig, key){
    var i = String(key).lastIndexOf('|'); if(i < 0) return false;
    var id = key.slice(0, i), date = key.slice(i + 1), d = days[date], hit = false;
    var b = findBooking(id);
    if(d){
      d.rows = d.rows.filter(function(r){ var same = (b ? (r.booking_id === b.opsId || r.booking_id === b.id) : r.booking_id === id); if(same) hit = true; return !same; });
      d.sig = JSON.stringify(d.rows); d.stale = true; d.ver++;
    }
    load(date, true);
    return hit;
  });

  // Every draw of the three screens asks for its day.
  [['renderVanCheckin', '_vanCkDate'], ['renderVanJobs', '_vanJobsDate'], ['renderPierCheckin', '_pckDate'], ['renderTravelSum', '_tsDate']].forEach(function(p){
    wrap(p[0], function(orig){
      var r = typeof orig === 'function' ? orig.apply(this, [].slice.call(arguments, 1)) : undefined;
      try{ var date = dateOf(p[1]); if(date) load(date); }catch(_){}
      return r;
    });
  });

  // A booking write (a reschedule, a cancel) may have moved a trip: the next draw asks again.
  O.onWrite(function(kind){ if(/^booking/.test(String(kind || ''))) stale(); });

  O.vanStrands = { load: load, stale: stale, rows: rowsOf };
})();
