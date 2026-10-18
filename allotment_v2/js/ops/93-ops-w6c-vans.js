/* ═════════════════════════════════════════════════════════════════════════
   §opsW6cVans (2026-10-18, wave 6 group c) · van stop seats and the Van Check-in pills, the server's answer
   ─────────────────────────────────────────────────────────────────────────
   Backend guides: operation-backend README "Van stops" (stop `seats`, group `stop_seats` / `stop_seats_return`) and "The Van
   Check-in numbers" (GET /v1/van-checkin programmes[]). todo/w5-c-model.md asks 8 and 10. docs/walk/w6-c.md has the per-function
   table. Classic script, after 82-ops-w5c-vans.js / 82-ops-w5c-pier.js / 74-ops-van-checkin.js, before 90-ops-boot.js. Legacy mode,
   and until an answer is here, every wrapper delegates.

     vsSeats(stop)                  the stop's `seats` (a staff stop = its pax, cargo = 0; kept on the stop as srvSeats by
                                    35-ops-van-jobs.js). A stop not saved to the server yet: legacy's rule.
     vsSeatsOfVan(.., grp, isRet)   the return leg too: the group's stop_seats_return (82-ops-w5c-vans.js answers the outbound leg)
     laOpsVanProg(date, fam, rst)   the pills of the Van Check-in page (hook in ckRoutePills, kind 'van'): heads per programme, the
                                    PK / KL / OWN boxes (done, total, booked before any loss) from GET /v1/van-checkin programmes[]
   ═════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  function on(){ return !!(O.enabled && O.enabled()); }
  function wrap(name, fn){
    var orig = window[name];
    if(typeof orig !== 'function' || orig.__opsW6c) return;
    var w = function(){
      if(!on()) return orig.apply(this, arguments);
      var r = fn.apply(this, [orig, this].concat([].slice.call(arguments)));
      return r === undefined ? orig.apply(this, arguments) : r;
    };
    w.__opsW6c = true; w.__orig = orig; window[name] = w;
  }

  /* ── stop seats ── */
  wrap('vsSeats', function(orig, self, s){
    if(!s || !s._opsId || s.srvSeats == null) return undefined;
    return +s.srvSeats || 0;
  });
  wrap('vsSeatsOfVan', function(orig, self, date, routeId, vanId, grp, isRet){
    if(!isRet || !grp || !O.vans || !O.vans.serverIdOf || !O.vans.groupInfo) return undefined;
    var sid = O.vans.serverIdOf(date, routeId, +grp); if(!sid) return undefined;
    var gi = O.vans.groupInfo(sid);
    if(!gi || gi.stopSeatsRet == null || (vanId && gi.vanId && gi.vanId !== vanId)) return undefined;
    return gi.stopSeatsRet;
  });

  /* ── the pills of the Van Check-in page ── */
  var VP = {};                      // date -> { stamp, programmes, busy, failedAt }
  function stampNow(){ return typeof O.w5cPierStamp === 'function' ? O.w5cPierStamp() : 0; }
  function sigOf(fam, rst){
    var o = {};
    Object.keys(fam).forEach(function(k){ var a = fam[k]; o['f' + k] = [a.pax, a.booked].join(','); });
    Object.keys(rst).forEach(function(k){ var R = rst[k]; o['r' + k] = ['PK', 'KL', 'OWN'].map(function(z){ return R[z].tot + '/' + R[z].done + '/' + R[z].bk; }).join(','); });
    return JSON.stringify(o);
  }
  function applyTo(programmes, fam, rst){
    programmes.forEach(function(p){
      var a = fam[p.family_id]; if(!a) return;
      a.pax = +p.pax || 0; a.booked = +p.booked || 0;
      (p.variants || []).forEach(function(v){
        var R = rst[v.route_id]; if(!R || !v.zones) return;
        ['PK', 'KL', 'OWN'].forEach(function(z){
          var Z = v.zones[z]; if(!Z) return;
          R[z].tot = +Z.total || 0; R[z].done = +Z.done || 0; R[z].bk = +Z.booked || 0;
        });
      });
    });
  }
  function ask(date, fam, rst){
    var e = VP[date];
    if(e && e.busy) return;
    if(e && e.failedAt && Date.now() - e.failedAt < 5000) return;
    var at = stampNow(), drawn = sigOf(fam, rst), clone = null;
    try{ clone = { fam: JSON.parse(JSON.stringify(fam)), rst: JSON.parse(JSON.stringify(rst)) }; }catch(_){}
    VP[date] = { stamp: -1, programmes: null, busy: true };
    O.get('/v1/van-checkin', { date: date, programmes: 1 }).then(function(j){
      var progs = (j && j.programmes) || [];
      VP[date] = { stamp: at, programmes: progs, busy: false };
      var differs = true;
      if(clone){ applyTo(progs, clone.fam, clone.rst); differs = sigOf(clone.fam, clone.rst) !== drawn; }
      try{
        if(differs && O.activeView && O.activeView() === 'vancheckin' && !(O.busy && O.busy()) && typeof window.renderVanCheckin === 'function') window.renderVanCheckin();
      }catch(_){}
    }, function(err){ VP[date] = { stamp: -1, programmes: null, busy: false, failedAt: Date.now() }; try{ console.warn('[ops] van check-in pills: the server did not answer, the walk figures stay · ' + (err && err.message)); }catch(_){} });
  }
  window.laOpsVanProg = function(date, fam, rst){
    if(!on() || !date) return;
    var e = VP[date];
    if(!e || e.stamp !== stampNow() || !e.programmes){ ask(date, fam, rst); return; }
    applyTo(e.programmes, fam, rst);
  };
})();
