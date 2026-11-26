/* ════════════════════════════════════════════════════════════════════════
   §opsVanJobList (2026-10-18) · ใบงานรถ (Van Job Orders) LIST band drawn from the server's day read · Q41, wave 4 F5
   ────────────────────────────────────────────────────────────────────────
   Reads:  GET /operations/van-jobs?date=   (the day read 35-ops-van-jobs.js keeps: jobs, unassigned, return_unarranged,
           self_arrive, struck)
           GET /operations/van-jobs/{date}/{key}  (a sheet, only for the expanded edit panel,
           through ops/35-ops-van-job-sheet.js)
   Writes: none.

   renderVanJobs (08-app.js) stays legacy's markup. In ops mode three of its numbers no longer come from a walk over the
   bookings in the browser: it asks window.opsVanJobsList(date) (the small marked edit in 08-app.js) and takes
     agg / aggRet   the jobs: van, programme, pax, bookings, zones, pickups, round, struck count,
                    the "↩ ขากลับ N" badge (ret_extra_pax / ret_extra_bookings)                <- jobs[]
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

  window.opsVanJobsList = function(date){
    if(!O.enabled()) return null;
    var day = V.dayRead(date); if(!day || !Array.isArray(day.jobs)) return null;
    /* parity M2 (2026-11-27) · legacy renderVanJobs keeps one fleet side (§rnVan2 laFleetRouteOk: Phuket · Khao Lak, or Ranong) for
       every booking it walks; the server's day read holds both sides, so the Ranong programmes (Day Trip - Se La Va 57 pax) were
       counted on the Phuket side. Every list below keeps the side's programmes only. */
    var sideOk = function(rid){ return typeof window.laFleetRouteOk !== 'function' || window.laFleetRouteOk(rid || ''); };
    var agg = {}, aggRet = {};
    day.jobs.forEach(function(job){
      if(!sideOk(job.route_id)) return;
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
        /* job.pax = the outbound customers (legacy vanJobs _E.pax; a guide riding along is not counted here, the server's over_capacity still adds their seats) */
        agg[k] = base(job.pax != null ? job.pax : (job.out_pax || 0), job.bookings || 0, job.struck || 0);
        /* the "↩ ขากลับ N" badge (legacy aggRet): the people who go back on this van but went out on another. The server
           counts them on the job: ret_extra_pax heads in ret_extra_bookings bookings (struck rows left out) */
        if(+job.ret_extra_pax > 0) aggRet[k] = base(+job.ret_extra_pax, +job.ret_extra_bookings || 0, 0);
      } else {
        aggRet[k] = base(job.ret_pax || 0, job.bookings || 0, job.struck || 0);
      }
    });
    var un = day.unassigned || {}, unByRoute = {}, unTot = 0;
    (un.by_route || []).forEach(function(r){ if(!sideOk(r.route_id)) return; unByRoute[r.route_id || '_'] = r.pax || 0; unTot += (r.pax || 0); });
    var unRetList = [], unRet = 0;
    (day.return_unarranged || []).forEach(function(r){
      if(!sideOk(r.route_id)) return;
      unRet += (r.pax || 1);
      unRetList.push({ name: r.lead_pax || '-', drop: r.drop || '?', route: r.route_id || '' });
    });
    var selfWarn = (day.self_arrive || []).filter(function(r){ return r.route_id === undefined || sideOk(r.route_id); }).map(function(r){
      return { vc: r.voucher || r.booking_id || '-', name: r.lead_pax || '-', hotel: r.hotel || '', hasVan: !!r.has_van };
    });
    return { agg: agg, aggRet: aggRet, unTot: unTot, unByRoute: unByRoute, unRet: unRet, unRetList: unRetList,
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
