/* ══════════════════════════════════════════════════════════════════════════
   §opsParkMonth (w6-a, 2026-10-18) · park tickets "ภาพรวมเดือน" ⇄ GET /v1/pier-office/{pier}/park-tickets/month?month=YYYY-MM
   ──────────────────────────────────────────────────────────────────────────
   pk2Month (08-app.js) read pkTkData(day) for every day of the month, which only holds the day the page loaded, and added the boats up. The
   server's month read carries every day and boat: counts (should be issued, by base type), tickets (the sheet's, by type), ticket_total, miss_total,
   nationality {ad_th..foc_fr, tot} (the heads by nationality and category, pcPax) per boat, per day and in total, gaps, total{by_type, tickets,
   nationality} and routes[]. Here pk2Month is answered from it in the shape the screen already draws (rows, days, routes, T).
   The server's figures used as they are: each boat's nationality / tickets / counts / miss, each day's and the month's nationality and tickets,
   the month's tickets by type, the routes. Added here from the boats of the SAME answer: a day's and the month's per-type "should be issued"
   (pc) and a day's per-type tickets, which the read does not total (display sums, nothing is decided).
   No answer yet (or offline, or a failed read): legacy's own function runs. The answer is cached per pier and month, marked stale by any write,
   and the screen is drawn again when it lands. Classic script, after 32-ops-park.js.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var orig = window.pk2Month;
  if(typeof orig !== 'function' || orig.__w6a) return;
  var cache = {}, loading = {}, failed = {}, stale = {};
  var GOK = ['ad_th', 'chd_th', 'inf_th', 'foc_th', 'ad_fr', 'chd_fr', 'inf_fr', 'foc_fr'];
  var WD = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
  function n(v){ return Number.isFinite(+v) ? +v : 0; }
  function redraw(){
    var pier = typeof _poPier !== 'undefined' ? _poPier : '';
    if(typeof window.renderPierPark !== 'function' || !pier || !document.getElementById('pk-host-' + pier)) return;
    if(O.busy()) return;
    try{ window.renderPierPark(); }catch(_){}
  }
  O.onWrite(function(){ Object.keys(cache).forEach(function(k){ stale[k] = true; }); failed = {}; });
  function ask(m, pier){
    var k = pier + '|' + m;
    if((!cache[k] || stale[k]) && !loading[k] && !failed[k]){
      loading[k] = O.get('/v1/pier-office/' + encodeURIComponent(pier) + '/park-tickets/month', { month: m }).then(function(j){
        if(!j || !Array.isArray(j.days)) throw new Error('invalid park month response');
        cache[k] = j; delete stale[k];
      }).catch(function(e){ failed[k] = true; O.fail('Park month did not load', e);
      }).then(function(){ delete loading[k]; redraw(); });
    }
    return cache[k] || null;
  }

  var w = function(m, pier){
    if(!O.enabled()) return orig.apply(this, arguments);
    var J = ask(m, pier);
    if(!J) return orig.apply(this, arguments);
    var y = +m.slice(0, 4), mo = +m.slice(5, 7), last = new Date(y, mo, 0).getDate();
    var TY = window.pkTypes();
    var z = function(){ var s = { go: {}, ty: {}, pc: {}, th: 0, fr: 0, foc: 0, goT: 0, tyT: 0 }; GOK.forEach(function(k){ s.go[k] = 0; }); TY.forEach(function(T){ s.ty[T.k] = 0; s.pc[T.k] = 0; }); return s; };
    var fromGo = function(s){ s.th = s.go.ad_th + s.go.chd_th + s.go.inf_th; s.fr = s.go.ad_fr + s.go.chd_fr + s.go.inf_fr; s.foc = s.go.foc_th + s.go.foc_fr; };
    var setNat = function(s, nat){ GOK.forEach(function(k){ s.go[k] = n(nat && nat[k]); }); s.goT = n(nat && nat.tot); fromGo(s); };
    var addPcTy = function(a, b, withTy){ TY.forEach(function(T){ a.pc[T.k] += b.pc[T.k]; if(withTy) a.ty[T.k] += b.ty[T.k]; }); };
    var byDate = {}; J.days.forEach(function(d){ byDate[d.date] = d; });
    var gapAt = {}; (J.gaps || []).forEach(function(g){ gapAt[g.from] = g; });
    var T = { s: z(), day: 0, boat: 0 }, rows = [], days = [];
    for(var i = 1; i <= last; i++){
      var ds = y + '-' + String(mo).padStart(2, '0') + '-' + String(i).padStart(2, '0'), D = byDate[ds];
      if(!D || !(D.boats || []).length){
        if(gapAt[i]){ var g = gapAt[i]; rows.push({ gap: true, label: g.from === g.to ? String(g.from) : (g.from + '–' + g.to) }); }
        days.push({ ds: ds, d: i, boats: 0, tot: 0, miss: 0 });
        continue;
      }
      var dd = new Date(y, mo - 1, i), ds_ = z(), boats = [], routes = {};
      D.boats.forEach(function(B){
        var s = z();
        setNat(s, B.nationality);
        TY.forEach(function(Ty){ s.ty[Ty.k] = n((B.tickets || {})[Ty.k]); s.pc[Ty.k] = n(((B.pc || B.counts) || {})[Ty.k]); });   /* §w7c · pc = the server's per-boat should-be-issued */
        s.tyT = n(B.ticket_total);
        var rt = (typeof window.getRoute === 'function' && window.getRoute(B.route_id)) || {};
        boats.push({ s: s, rc: rt.color || '#94A3B8', rn: B.route_name || rt.name || B.route_id, bn: B.boat_name || B.boat_id, dep: B.departure || '', cx: (O.parkCx && O.parkCx(B.cx)) || undefined });   /* §pkCx · the heads taken off (server cx) for the family / all chips */
        routes[B.route_id] = 1;
        if(!D.by_type || !D.pc) addPcTy(ds_, s, true);   /* §w7c · only an older server without the day's by_type / pc is added up here */
      });
      setNat(ds_, D.nationality); ds_.tyT = n(D.tickets);
      if(D.by_type && D.pc) TY.forEach(function(Ty){ ds_.ty[Ty.k] = n(D.by_type[Ty.k]); ds_.pc[Ty.k] = n(D.pc[Ty.k]); });   /* §w7c */
      days.push({ ds: ds, d: i, boats: boats.length, tot: ds_.tyT, miss: n(D.miss) });
      if(!(J.total && J.total.pc)) addPcTy(T.s, ds_, false);   /* §w7c */
      T.day++; T.boat += boats.length;
      rows.push({ ds: ds, d: i, wd: WD[dd.getDay()], sun: dd.getDay() === 0, boats: boats, nRoute: Object.keys(routes).length, s: ds_, miss: n(D.miss) });
    }
    var tot = J.total || {};
    setNat(T.s, tot.nationality); T.s.tyT = n(tot.tickets);
    TY.forEach(function(Ty){ T.s.ty[Ty.k] = n((tot.by_type || {})[Ty.k]); if(tot.pc) T.s.pc[Ty.k] = n(tot.pc[Ty.k]); });   /* §w7c */
    var rts = (J.routes || []).map(function(r){
      var rt = (typeof window.getRoute === 'function' && window.getRoute(r.route_id)) || {};
      return { rn: r.route_name || rt.name || r.route_id, rc: rt.color || '#94A3B8', trips: n(r.trips), days: n(r.days), tot: n(r.tickets) };
    });
    return { m: m, y: y, mo: mo, last: last, TY: TY, T: T, rows: rows, days: days, routes: rts };
  };
  w.__w6a = true; w.__orig = orig; window.pk2Month = w;
})();
