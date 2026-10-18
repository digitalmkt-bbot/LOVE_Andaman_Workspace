/* ═════════════════════════════════════════════════════════════════════════
   §opsW5cPier (2026-10-18, wave 5 group c) · pier page pills and petty cash figures from the server
   ─────────────────────────────────────────────────────────────────────────
   Backend guides: operation-backend README "The Pier Check-in sheet" (programmes), "Pier office: petty cash" (ledger order, balance,
   closing, the park sheet's check, used_boats). docs/walk/w5-c.md has the per-function table. Classic script, loads after
   46-ops-pier-cash.js and 74-ops-pier-service.js, before 90-ops-boot.js. Legacy mode (!O.enabled()): every wrapper delegates.

     ckRoutePills (08-app.js, §w5cPills hook)   laOpsPierProg(date, fam, rst): the programme pills of the pier page. Heads that
                                                arrived / cleared / boarded, the PK / KL / OWN boxes (done of total), the money still
                                                to collect: GET /v1/pier-checkin programmes[]. Land page and Van Check-in: unchanged.
     pcLedgerSort(rows, pier, ds)               the order the server sent the day's ledger in (time, in before out, park lines by park
                                                then boat); the park-line colours still come from legacy's helper
     pcClosing(pier, ds)                        the day's `closing` (month table, day read)
     pc2Main / pcPrintLedger running balance    each row's `balance` (srvBal, 46-ops-pier-cash.js legacyRow)
     pcLtUsed(C).tot                            the cell's used_boats (join + charter, the server's)
     pcPkDiff(pier, ds, bid, legacy)            the park cell's check.diff
     pcSheetTot(kind, pier, ds)                 the longtail / park sheet's keyed sums of a day (or the month): the sheet's `totals`
   ═════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  function enabled(){ return !!(O.enabled && O.enabled()); }
  function wrapGlobal(name, fn){
    var orig = window[name];
    if(typeof orig !== 'function' || orig.__opsW5c) return;
    var w = function(){
      if(!enabled()) return orig.apply(this, arguments);
      var r = fn.apply(this, [orig, this].concat([].slice.call(arguments)));
      return r === undefined ? orig.apply(this, arguments) : r;
    };
    w.__opsW5c = true; w.__orig = orig; window[name] = w;
  }

  /* ── the write counter of the pier page: any write (a check-in tap too) makes the programmes old ── */
  var stamp = 0;
  var base = window.laOpsFetch;
  if(typeof base === 'function' && !base.__opsW5cPier){
    var f = function(path, opts){
      var p = base.apply(this, arguments);
      var m = String((opts && opts.method) || 'GET').toUpperCase(), s = String(path || '');
      if(m !== 'GET' && /\/operations\/(trip-ops|van-|vans|deployments)|\/v1\/(bookings|pier-checkin|invoices|pier-cash)/.test(s)){
        var bump = function(){ stamp++; };
        p.then(bump, bump);
      }
      return p;
    };
    f.__opsW5cPier = true; f.__opsW5c = base.__opsW5c; window.laOpsFetch = f;
  }
  O.onWrite(function(){ stamp++; });
  O.onChange(function(){ stamp++; });

  /* ── programmes of a day ── */
  var PG = {};                      // date -> { stamp, at, programmes, busy }
  function sigOf(fam, rst){
    var o = {};
    Object.keys(fam).forEach(function(k){ var a = fam[k]; o['f' + k] = [a.pax, a.booked, a.rows, a.rowsP, a.arrP, a.clrP, a.onP, a.due].join(','); });
    Object.keys(rst).forEach(function(k){ var R = rst[k]; o['r' + k] = ['PK', 'KL', 'OWN'].map(function(z){ return R[z].tot + '/' + R[z].done; }).join(','); });
    return JSON.stringify(o);
  }
  function applyTo(programmes, fam, rst){
    programmes.forEach(function(p){
      var a = fam[p.family_id]; if(!a) return;
      var rowsP = 0;
      (p.variants || []).forEach(function(v){
        var R = rst[v.route_id]; if(!R || !v.zones) return;
        R.PK.tot = +v.zones.PK.total || 0; R.PK.done = +v.zones.PK.done || 0;
        R.KL.tot = +v.zones.KL.total || 0; R.KL.done = +v.zones.KL.done || 0;
        R.OWN.tot = +v.zones.OWN.total || 0;
        rowsP += R.PK.tot + R.KL.tot + R.OWN.tot;
      });
      a.pax = +p.pax || 0; a.booked = +p.booked || 0; a.rows = +p.rows || 0; a.rowsP = rowsP;
      a.arrP = +p.arr || 0; a.clrP = +p.clr || 0; a.onP = +p.brd || 0; a.due = +p.due || 0;
    });
  }
  function ask(date, fam, rst){
    var e = PG[date];
    if(e && e.busy) return;
    if(e && e.failedAt && Date.now() - e.failedAt < 5000) return;
    var at = stamp, drawn = sigOf(fam, rst), clone = null;
    try{ clone = { fam: JSON.parse(JSON.stringify(fam)), rst: JSON.parse(JSON.stringify(rst)) }; }catch(_){}
    PG[date] = { stamp: -1, programmes: null, busy: true };
    O.get('/v1/pier-checkin', { date: date, programmes: 1 })   /* the marker is ignored by the server; it tells this read from the Service column's (74-ops-pier-service.js) */.then(function(j){
      var progs = (j && j.programmes) || [];
      PG[date] = { stamp: at, programmes: progs, busy: false };
      // draw the page again only if the server's figures are not the ones it was drawn with
      var differs = true;
      if(clone){ applyTo(progs, clone.fam, clone.rst); differs = sigOf(clone.fam, clone.rst) !== drawn; }
      try{
        if(differs && O.activeView && O.activeView() === 'piercheckin' && !(O.busy && O.busy()) && typeof window.renderPierCheckin === 'function') window.renderPierCheckin();
      }catch(_){}
    }, function(err){ PG[date] = { stamp: -1, programmes: null, busy: false, failedAt: Date.now() }; try{ console.warn('[ops] pier programmes: the server did not answer, the walk figures stay · ' + (err && err.message)); }catch(_){} });
  }
  window.laOpsPierProg = function(date, fam, rst){
    if(!enabled() || !date) return;
    var e = PG[date];
    if(!e || e.stamp !== stamp || !e.programmes){ ask(date, fam, rst); return; }
    applyTo(e.programmes, fam, rst);
  };

  /* ── petty cash ── */
  function PC(){ return O.pierCash && O.pierCash.cache ? O.pierCash.cache : null; }
  wrapGlobal('pcLedgerSort', function(orig, self, rows, pier, ds){
    var c = PC(), day = c && c.day[pier + '|' + ds]; if(!day || !Array.isArray(day.rows) || !rows) return undefined;
    var order = {}; day.rows.forEach(function(r, i){ order[String(r.id)] = i; });
    var out = orig.call(self, rows, pier, ds);                 // legacy annotates the rows (_pk: park line colours) and sorts
    if(!out.every(function(r){ return r && r.x && order[String(r.x.id)] != null; })) return out;
    return out.slice().sort(function(a, b){ return order[String(a.x.id)] - order[String(b.x.id)]; });
  });
  wrapGlobal('pcClosing', function(orig, self, pier, ds){
    var c = PC(); if(!c || !pier || !ds) return undefined;
    var m = c.month[pier + '|' + String(ds).slice(0, 7)], x = m && (m.days || []).filter(function(v){ return v.date === ds; })[0];
    if(x && x.closing != null) return +x.closing;
    var q = c.day[pier + '|' + ds];
    if(q && q.closing != null) return +q.closing;
    return undefined;
  });
  wrapGlobal('pcLtUsed', function(orig, self, C){
    var r = orig.call(self, C);
    if(C && C.n != null && (C.nj != null || C.nc != null) && r) r.tot = +C.n || 0;     // the server's used_boats (46-ops-pier-cash.js applySheet)
    return r;
  });
  function parkBoat(p, ds, bid){
    var c = PC(); if(!c) return null;
    var ks = Object.keys(c.sheet);
    for(var i = 0; i < ks.length; i++){
      var j = c.sheet[ks[i]]; if(ks[i].indexOf('park|' + p + '|') !== 0 || !j || j === true || j.month !== String(ds).slice(0, 7)) continue;
      var days = j.days || [];
      for(var a = 0; a < days.length; a++){ if(days[a].date !== ds) continue;
        var bs = days[a].boats || []; for(var b = 0; b < bs.length; b++) if(bs[b].boat_id === bid) return bs[b]; }
    }
    return null;
  }
  /* what the pier keyed, added up by the server: a day's `totals`, or the month's when ds is null (the sheet read without ?date=) */
  wrapGlobal('pcSheetTot', function(orig, self, kind, pier, ds){
    var c = PC(); if(!c || !pier) return undefined;
    var ks = Object.keys(c.sheet), ym = ds ? String(ds).slice(0, 7) : (typeof _pcYM !== 'undefined' ? _pcYM : '');
    for(var i = 0; i < ks.length; i++){
      var j = c.sheet[ks[i]]; if(ks[i].indexOf(kind + '|' + pier + '|') !== 0 || !j || j === true || j.month !== ym) continue;
      if(ds){
        var d = (j.days || []).filter(function(x){ return x.date === ds; })[0];
        if(d && d.totals) return d.totals;
      } else if(!j.date && j.totals) return j.totals;           // the month's sheet
    }
    return undefined;
  });
  wrapGlobal('pcPkDiff', function(orig, self, pier, ds, bid){
    var b = parkBoat(pier, ds, bid);
    if(!b || !b.check) return undefined;
    return b.check.diff == null ? null : +b.check.diff;
  });
})();
