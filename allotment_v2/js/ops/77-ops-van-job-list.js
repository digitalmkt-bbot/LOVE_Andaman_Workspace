/* ════════════════════════════════════════════════════════════════════════
   §opsVanJobList (2026-10-18) · ใบงานรถ (Van Job Orders) LIST band drawn from the server's day read · Q41, wave 4 F5
   ────────────────────────────────────────────────────────────────────────
   Reads:  GET /operations/van-jobs?date=   (the day read 35-ops-van-jobs.js keeps: jobs, unassigned, return_unarranged,
           self_arrive, struck)
           GET /operations/van-jobs/{date}/{key}  (a sheet, only for the expanded edit panel and the return badge,
           through ops/35-ops-van-job-sheet.js)
   Writes: none.

   renderVanJobs (08-app.js) stays legacy's markup. In ops mode three of its numbers no longer come from a walk over the
   bookings in the browser: it asks window.opsVanJobsList(date) (the small marked edit in 08-app.js) and takes
     agg / aggRet   the jobs: van, programme, pax, bookings, zones, pickups, round, struck count   <- jobs[]
     unTot, unByRoute  the red hero number and its programme line                                  <- unassigned
     unRet, unRetList  the amber hero number and the names                                         <- return_unarranged
     selfWarn          the purple self-arrive warning                                              <- self_arrive
     sxTot             "ค้างจัดการ N"                                                              <- struck
   and the server's job order (no client sort). With no day read yet (first paint) or offline the hook answers null and
   legacy's own walk draws, as before; the day read then redraws the screen.

   Wrapped: vanJobsBookingsFor   the bookings of the expanded edit panel (special request per booking): the sheet's rows
                                 when the sheet is in hand, else legacy's walk until it lands.
   Legacy mode (!O.enabled()): the hook answers null, the wrapper delegates.
   Classic script · loads after 35-ops-van-job-sheet.js.
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O || !O.vanJobs || !O.vanJobs.dayRead) return;
  var V = O.vanJobs;

  function str(x){ return x == null ? '' : String(x); }
  function keyOf(job){
    var base = job.van_id + '~' + (job.route_id || '');
    return (job.round && job.round.of > 1) ? base + '~' + job.group_number : base;
  }
  function sheetOf(date, job){
    var c = V.sheet && V.sheet.cache && V.sheet.cache[date + '::' + job.key];
    return (c && c.s) || null;
  }

  window.opsVanJobsList = function(date){
    if(!O.enabled()) return null;
    var day = V.dayRead(date); if(!day || !Array.isArray(day.jobs)) return null;
    var agg = {}, aggRet = {};
    day.jobs.forEach(function(job){
      var k = keyOf(job);
      var zones = {}; (job.zones || []).forEach(function(z){ zones[z] = 1; });
      var routes = {}; if(job.route_id) routes[job.route_id] = 1;
      var pickups = {}; (job.pickups || []).forEach(function(p){ if(p && p.name) pickups[p.name] = 1; });
      var rnd = job.round ? { no: job.round.no, tot: job.round.of, tm: job.round.time || '' } : null;
      var base = function(pax, bk, sx){
        return { vid: job.van_id, routeId: job.route_id || '', pax: pax, bk: bk, zones: zones, routes: routes, pickups: pickups,
                 gno: +job.group_number || 0, seq: 1e9, sx: sx, grp: (rnd ? (+job.group_number || 0) : 0), rnd: rnd };
      };
      if(job.has_out || !job.has_ret){
        agg[k] = base(job.out_pax || 0, job.bookings || 0, job.struck || 0);
        /* the "↩ ขากลับ N" badge counts people who go back on this van but went out on another: the server's job has no
           count for them (MISSING-SERVER-FIELD ret_extra_*), so it is read off the sheet when the sheet is in hand */
        var S = sheetOf(date, job), rows = S && S.ret && S.ret.rows;
        if(rows){
          var ex = rows.filter(function(r){ return r.kind === 'booking' && r.extra && !r.struck; });
          if(ex.length) aggRet[k] = base(ex.reduce(function(s, r){ return s + (r.pax || 0); }, 0), ex.length, 0);
        }
      } else {
        aggRet[k] = base(job.ret_pax || 0, job.bookings || 0, job.struck || 0);
      }
    });
    var un = day.unassigned || {}, unByRoute = {};
    (un.by_route || []).forEach(function(r){ unByRoute[r.route_id || '_'] = r.pax || 0; });
    var unRetList = [], unRet = 0;
    (day.return_unarranged || []).forEach(function(r){
      unRet += (r.pax || 1);
      unRetList.push({ name: r.lead_pax || '-', drop: r.drop || '?', route: r.route_id || '' });
    });
    var selfWarn = (day.self_arrive || []).map(function(r){
      return { vc: r.voucher || r.booking_id || '-', name: r.lead_pax || '-', hotel: r.hotel || '', hasVan: !!r.has_van };
    });
    return { agg: agg, aggRet: aggRet, unTot: un.pax || 0, unByRoute: unByRoute, unRet: unRet, unRetList: unRetList,
             selfWarn: selfWarn, sxTot: day.struck || 0 };
  };

  /* ════ the expanded edit panel: bookings of this job, from the sheet's rows ════ */
  var orig = typeof window.vanJobsBookingsFor === 'function' ? window.vanJobsBookingsFor : null;
  var asked = {};   // 'date::key' -> time of the last ask
  window.vanJobsBookingsFor = function(date, vid, routeId, leg, grp){
    var args = arguments;
    if(!O.enabled() || !routeId){ return orig ? orig.apply(this, args) : []; }
    var sk = V.jobKey(date, vid + '~' + routeId + (+grp ? '~' + (+grp) : ''));
    var c = sk && V.sheet && V.sheet.cache && V.sheet.cache[date + '::' + sk];
    var S = c && c.s;
    if(!S){
      var ak = date + '::' + (sk || vid + '~' + routeId);
      if(sk && V.sheet && (!asked[ak] || Date.now() - asked[ak] > 5000)){
        asked[ak] = Date.now();
        V.sheet.ensure(date, vid, routeId, grp).then(function(){ V.redraw(); }, function(){});
      }
      return orig ? orig.apply(this, args) : [];
    }
    var sec = leg === 'ret' ? S.ret : S.out, seen = {}, out = [];
    ((sec && sec.rows) || []).forEach(function(r){
      if(r.kind !== 'booking' || r.struck || seen[r.booking_id]) return;
      if(leg === 'ret' && !r.extra) return;   // legacy: the people who return on this van but went out on another
      seen[r.booking_id] = 1;
      var local = (typeof SB_BOOKINGS !== 'undefined' ? SB_BOOKINGS : []).find(function(b){ return b && (b.opsId === r.booking_id || b.id === r.booking_id); });
      out.push(local || { id: r.booking_id, leadPax: str(r.lead_pax), voucherRef: str(r.voucher), notes: str(r.special_request) });
    });
    return out;
  };
})();
