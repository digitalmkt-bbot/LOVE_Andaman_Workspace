/* ══════════════════════════════════════════════════════════════════════════
   §opsDailyReport · Daily Report · สรุปก่อนวันเดินทาง ⇄ operation-backend
   ──────────────────────────────────────────────────────────────────────────
   The page is lk-inbox's own (renderDailyReport in 08-app.js): the same five tabs, the
   same markup and CSS (drCSS) and the same legacy drawing helpers (drK cards, drBar,
   drTile, drSq, drDonut, drChart, drPierTxt). Only the numbers change hands: every
   figure is read from the server, nothing is counted from SB_BOOKINGS here.

     GET /v1/reports/daily?date=D            pax, revenue, routes, markets, pay channels, agents
                                             (+ their documents), pier money, van cost, longtail,
                                             known cost, settings  (via laOps.dailyTrend.day)
     GET /v1/pier-office/:pier/days/D/boats  each boat's passengers that day (booked.on_board)
     GET /operations/deployments?from=D&to=D each boat's capacity on its route that day
     GET /operations/van-board?date=D        each route's departure time that day
     GET /operations/van-jobs?date=D         vans used (driver, plate, pax, bookings), returns
                                             still to arrange
     GET /v1/bookings?service_date=D         the passenger list (ผู้โดยสาร tab only), row by row
     GET /v1/bookings/daily-counts           booking-date trend (58)

   What no server response carries yet (nationality split, meals, guide languages, boats or vans
   still to assign, self-arrive, pickup zones, return legs other than "to arrange", bookings per
   boat, van first pickup / boats per van) is drawn as "—" (data-ops-dr-na) and listed for the
   server in HANDOFF-BACKEND B16. The e-mail form stays visible but does not open: the server has
   no Daily Report send endpoint.

   Load order: after 33-ops-money-reports.js and 58-ops-daily-trend.js (wraps their wrapper of
   renderDailyReport; with laOps disabled every call goes to the legacy page). Classic script.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var DEAD = ['cancelled', 'cancelled_weather', 'rejected'];
  var PIERS = ['tublamu', 'panwa', 'ranong'];
  var NA_TIP = 'operation-backend does not report this yet';
  var cache = {}, gen = 0;

  function enabled(){ return !!(O.enabled && O.enabled()); }
  function text(v){ return v == null ? '' : String(v); }
  function n(v){ return Number.isFinite(+v) ? +v : 0; }
  function g(name){ return typeof window[name] === 'function' ? window[name] : null; }
  function esc(v){ return text(v).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function na(){ return '<span data-ops-dr-na="1" title="' + NA_TIP + '">—</span>'; }
  function has(v){ return v !== null && v !== undefined; }
  function ymd(d){
    if(typeof window.bookingV2LocalYMD === 'function') return window.bookingV2LocalYMD(d);
    var p = function(x){ return (x < 10 ? '0' : '') + x; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function shift(date, by){ var d = new Date(date + 'T12:00:00'); d.setDate(d.getDate() + by); return ymd(d); }
  function dateOf(v){ return /^\d{4}-\d{2}-\d{2}$/.test(text(v)) ? text(v) : O.today(); }
  /* legacy number formats (drB / drK2 / drPct in 08-app.js) */
  function B(v){ var f = g('drB'); return f ? f(v) : '฿' + Math.round(n(v)).toLocaleString('en-US'); }
  function K2(v){ var f = g('drK2'); return f ? f(v) : (n(v) >= 1000 ? '฿' + (Math.round(n(v) / 100) / 10) + 'k' : B(v)); }
  function pct(a, b){ return b > 0 ? Math.round(a / b * 1000) / 10 : 0; }
  function palette(){ return (window.DR_PALETTE && window.DR_PALETTE.length) ? window.DR_PALETTE : ['#2563eb','#14b8a6','#a855f7','#f59e0b','#10b981','#ec4899','#64748b']; }
  function route(id){ var f = g('getRoute'); return (f && f(id)) || {}; }
  function boat(id){ var f = g('getBoat'); return (f && f(id)) || {}; }
  function agentColor(id){ var f = g('bookingV2AgentColor'); return (id && f) ? f(id) : '#64748b'; }
  function zoneLabel(z){ var f = g('bookingV2ZoneLabel'); return f ? f(z) : z; }

  /* ── reads, each once per date ── */
  function once(key, fn){ if(!cache[key]) cache[key] = fn().catch(function(e){ delete cache[key]; throw e; }); return cache[key]; }
  function day(date){
    var T = O.dailyTrend;
    return once('day|' + date, function(){
      return (T && T.day ? T.day(date) : O.get('/v1/reports/daily', { date: date })).then(function(d){
        if(!d || d.date !== date) throw new Error('invalid daily report response');
        return d;
      });
    });
  }
  function piers(){
    var out = PIERS.slice();
    try{ (window.ROUTES || []).forEach(function(r){ if(r && r.pier && out.indexOf(r.pier) < 0) out.push(r.pier); }); }catch(_){}
    return out;
  }
  function boatsRaw(date){
    return once('boats|' + date, function(){
      return Promise.all([
        Promise.all(piers().map(function(p){ return O.get('/v1/pier-office/' + encodeURIComponent(p) + '/days/' + date + '/boats').then(function(r){ return { pier: p, boats: (r && r.boats) || [] }; }); })),
        O.get('/operations/deployments', { from: date, to: date }),
        O.get('/operations/van-board', { date: date })
      ]).then(function(x){ return { piers: x[0], dep: (x[1] && x[1].deployments) || [], board: x[2] || {} }; });
    });
  }
  function vanList(){ return once('vans', function(){ return O.get('/operations/vans').then(function(r){ var m = {}; ((r && r.vans) || r || []).forEach(function(v){ if(v && v.id) m[v.id] = v; }); return m; }); }); }
  function vanJobs(date){ return once('vj|' + date, function(){ return O.get('/operations/van-jobs', { date: date }); }); }
  function roster(date){
    return once('roster|' + date, function(){
      return O.get('/v1/bookings', { service_date: date, limit: 5000 }).then(function(r){ return (r && r.bookings) || []; });
    });
  }
  function trend(date, mode){
    var T = O.dailyTrend; if(!T) return Promise.resolve({ pts: [], keys: [], mkt: {} });
    return once('trend|' + mode + '|' + date, function(){ return mode === 'booked' ? T.bookedSeries(date) : T.travelSeries(date); });
  }

  /* ── server rows → the legacy page's figures (display joins and sums only) ── */
  function boatsOf(raw){
    var cap = {}, dep = {}, boats = {}, order = [];
    (raw.dep || []).forEach(function(d){ cap[d.boat_id + '|' + d.route_id] = n(d.capacity); });
    ((raw.board && raw.board.routes) || []).forEach(function(r){ if(r && r.route_id) dep[r.route_id] = r.departs || ''; });
    (raw.piers || []).forEach(function(P){
      P.boats.forEach(function(row){
        var pax = n(row.booked && row.booked.on_board); if(!pax) return;   // legacy lists the boats that carry someone
        var id = row.boat_id, rid = row.route_id, M = boat(id);
        if(!boats[id]){ boats[id] = { id: id, name: row.boat_name || M.name || id, type: M.type || '', homePier: M.pier || '', piers: {}, cap: 0, pax: 0, routes: {}, dep: '' }; order.push(id); }
        var b = boats[id];
        b.pax += pax; b.routes[rid] = (b.routes[rid] || 0) + pax; b.piers[P.pier] = (b.piers[P.pier] || 0) + pax;
        b.cap = Math.max(b.cap, n(cap[id + '|' + rid]));
        if(!b.dep && dep[rid]) b.dep = dep[rid];
      });
    });
    order.forEach(function(id){
      var b = boats[id], ks = Object.keys(b.piers).sort(function(x, y){ return b.piers[y] - b.piers[x]; });
      b.pier = ks[0] || b.homePier || ''; b.pierAll = ks; b.moved = !!(b.pier && b.homePier && b.pier !== b.homePier);
    });
    return finish(boats, order);
  }
  /* B16: the server's own boat rows (booked pax, bookings, piers, departure) */
  function boatsFromOps(list){
    var boats = {}, order = [];
    (list || []).forEach(function(r){
      var id = r.boat_id; if(!id || boats[id]) return;
      boats[id] = { id: id, name: r.name || boat(id).name || id, type: r.type || '', homePier: r.home_pier || '', pier: r.pier || '',
        pierAll: r.piers || (r.pier ? [r.pier] : []), moved: !!r.moved, cap: n(r.cap), pax: n(r.pax), bookings: has(r.bookings) ? n(r.bookings) : null,
        routes: r.routes || {}, dep: r.dep || '' };
      order.push(id);
    });
    return finish(boats, order);
  }
  function finish(boats, order){
    order.sort(function(a, c){ return pct(boats[c].pax, boats[c].cap) - pct(boats[a].pax, boats[a].cap); });
    var seat = 0, capTot = 0, over = 0;
    order.forEach(function(id){ var b = boats[id]; seat += b.pax; capTot += b.cap; if(b.cap > 0 && b.pax > b.cap) over++; });
    return { boats: boats, order: order, seatTot: seat, capTot: capTot, over: over };
  }
  function vansOf(vj, daily){
    var vans = {}, order = [], ops = (daily && daily.ops) || null;
    if(ops && ops.vans) return vansFromOps(ops, vj, daily);
    ((vj && vj.jobs) || []).forEach(function(j){
      if(!j.van_id) return;
      var V = j.van || {}, D = j.driver || {};
      if(!vans[j.van_id]){ vans[j.van_id] = { id: j.van_id, name: V.name || j.van_id, plate: D.plate || V.plate || '', driver: D.name || '', phone: D.phone || '',
        own: V.ownership || '', cap: n(V.capacity || j.capacity), zones: [], n: 0, pax: 0 }; order.push(j.van_id); }
      var v = vans[j.van_id];
      v.n += n(j.bookings); v.pax += n(j.pax);
      (j.zones || []).forEach(function(z){ if(v.zones.indexOf(z) < 0) v.zones.push(z); });
    });
    var ret = (vj && vj.return_unarranged) || [];
    var vc = (daily && daily.van_cost) || {};
    return { vans: vans, order: order, pax: order.reduce(function(a, id){ return a + vans[id].pax; }, 0),
      retTodo: ret.length, retTodoPax: ret.reduce(function(a, r){ return a + n(r.pax); }, 0),
      byVan: vc.by_van || {} };
  }
  /* B16: the server's van rows in legacy order (first pickup, zone, boats); the day's driver from van-jobs */
  function vansFromOps(ops, vj, daily){
    var drv = {}, vans = {}, order = [], vc = daily.van_cost || {}, def = {};
    ((vj && vj.jobs) || []).forEach(function(j){ if(j.van_id && j.driver && !drv[j.van_id]) drv[j.van_id] = j.driver; });
    (vc.default_rate_by_van || []).forEach(function(id){ def[id] = 1; });
    ops.vans.forEach(function(r){
      var D = drv[r.van_id] || {};
      vans[r.van_id] = { id: r.van_id, name: r.name || r.van_id, plate: D.plate || r.plate || '', driver: D.name || '', phone: D.phone || '',
        own: '', cap: n(r.capacity), zones: r.zone ? [r.zone] : [], n: n(r.n), pax: n(r.pax), first: r.first_pickup || '', boats: r.boats || [], noRate: !!def[r.van_id] };
      order.push(r.van_id);
    });
    var ret = ops.ret || {};
    return { vans: vans, order: order, pax: order.reduce(function(a, id){ return a + vans[id].pax; }, 0),
      retTodo: n(ret.todo), retTodoPax: n(ret.todoPax), byVan: vc.by_van || {}, fromOps: true };
  }
  function model(date, x){
    var d = x.daily || {}, p = d.pax || {}, s = d.settings || {}, vc = d.van_cost || {}, lt = d.longtail || {}, ops = d.ops || null;
    var M = { date: date, d: d, ops: ops,
      pax: { ad: n(p.ad), chd: n(p.chd), inf: n(p.inf), foc: n(p.foc), tot: n(p.total),
             th: has(p.th) ? n(p.th) : null, fr: has(p.fr) ? n(p.fr) : null, un: has(p.un) ? n(p.un) : null },
      bookings: n(d.bookings), rev: n(d.revenue), perPax: n(d.revenue_per_pax), paxPay: n(d.paying_pax),
      ovnPax: Math.max(0, n(p.total) - n(d.paying_pax)),
      pay: d.by_channel || {}, due: n(d.due), got: n(d.got), noSlip: n(d.no_slip), extras: n(d.extras),
      up: n(d.upgrades && d.upgrades.due) + n(d.upgrades && d.upgrades.collected),
      cfg: { vanCost: n(s.van_cost), vanQuota: n(s.van_quota), targetPerPax: n(s.target_per_pax) },
      vanCost: n(vc.total), vanEst: !!vc.estimated, vanNoRate: n(vc.default_rate_vans), nVan: n(vc.vans),
      ltChtr: n(lt.charter_boats), ltJoin: n(lt.join_pax), ltCost: n(lt.cost), known: n(d.known_cost), net: n(d.net_before_boat_costs),
      routes: (d.by_route || []).map(function(r){ var R = route(r.route_id); return { id: r.route_id, name: r.name || R.name || r.route_id, color: R.color || '#94a3b8',
        n: n(r.bookings), pax: n(r.pax), rev: n(r.revenue), per: n(r.per_pax), share: n(r.share_pct), seats: 0, cap: 0,
        split: has(r.ad) ? { ad: n(r.ad), chd: n(r.chd), inf: n(r.inf), foc: n(r.foc) } : null }; }),
      mkts: (d.by_market || []).map(function(m, i){ return { id: m.id, name: m.name || m.id, color: palette()[i % palette().length], pax: n(m.pax), n: n(m.bookings), rev: n(m.revenue) }; }),
      agents: d.by_agent || []
    };
    M.vanIn = Math.min(M.nVan, M.cfg.vanQuota); M.vanOut = Math.max(0, M.nVan - M.cfg.vanQuota);
    var docs = {}, docWarn = 0;
    M.agents.forEach(function(a){ Object.keys(a.docs || {}).forEach(function(k){ docs[k] = (docs[k] || 0) + n(a.docs[k]); if(a.agent_id && k !== 'verified') docWarn += n(a.docs[k]); }); });
    M.docs = docs; M.docWarn = docWarn;
    if((ops && ops.boats) || x.boats){
      M.bt = (ops && ops.boats) ? boatsFromOps(ops.boats) : boatsOf(x.boats);
      var byId = {}; M.routes.forEach(function(r){ byId[r.id] = r; });
      M.bt.order.forEach(function(id){ var b = M.bt.boats[id];
        Object.keys(b.routes).forEach(function(rid){ var r = byId[rid]; if(!r) return; var share = b.pax > 0 ? b.routes[rid] / b.pax : 0; r.seats += b.routes[rid]; r.cap += Math.round(b.cap * share); });
      });
    }
    if(x.vj || (ops && ops.vans)) M.vn = vansOf(x.vj, d);
    M.vanList = x.vanList || null;
    M.perVanPax = (M.vn && M.vn.pax > 0) ? M.vanCost / M.vn.pax : 0;
    return M;
  }

  /* ── legacy drawing helpers (08-app.js), called by name ── */
  function K(){ return window.drK.apply(null, arguments); }
  function bar(){ return window.drBar.apply(null, arguments); }
  function tile(){ return window.drTile.apply(null, arguments); }
  function sq(c, nm){ return window.drSq(c, nm); }
  function pierTxt(b){ var f = g('drPierTxt'); return f ? f(b) : (b.pier || ''); }
  function v(x, fmt){ return has(x) ? (fmt ? fmt(x) : x) : na(); }

  /* ══ ภาพรวม ══ */
  function paneOv(M, T, P7){
    var e = esc, bkMode = (window._drTrendMode === 'booked'), bt = M.bt, vn = M.vn;
    var top = bt && bt.order.length ? bt.boats[bt.order[0]] : null, low = bt && bt.order.length > 1 ? bt.boats[bt.order[bt.order.length - 1]] : null;
    var kp = ''
     + K('blue','&#128101;','ผู้โดยสารทั้งวัน', M.pax.tot, 'คน','g',
         'ผู้ใหญ่ '+M.pax.ad+' · เด็ก '+M.pax.chd+' · ทารก '+M.pax.inf+' · FOC '+M.pax.foc,'',
         '<span>ไทย <b>'+v(M.pax.th)+'</b></span><span class="sep">|</span><span>ต่างชาติ <b>'+v(M.pax.fr)+'</b></span>'
         +'<span class="sep">|</span><span>'+M.routes.length+' เส้นทาง</span>'
         +(M.ovnPax?('<span class="sep">|</span><span title="ค้างคืนบนเกาะ · วันนี้เรือไปรับกลับ · รายได้ลงไปแล้ววันขาไป">&#8617; รับกลับ <b>'+M.ovnPax+'</b></span>'):''))
     + K('em','&#128176;','รายได้ทั้งวัน', B(M.rev),'','',
         'เฉลี่ย '+B(M.perPax)+' / คน'+(M.ovnPax?(' (จาก '+M.paxPay+' คน · ไม่รวมรับกลับ)'):''),'ok',
         '<span>Invoice <b>'+K2(M.pay.invoice)+'</b></span><span class="sep">|</span>'
         +'<span>PFM <b>'+K2(M.pay.proforma)+'</b></span><span class="sep">|</span>'
         +'<span>COT <b>'+K2(M.pay.cot)+'</b></span>')
     + K('pu','&#128676;','ที่นั่งเรือที่ใช้', bt ? pct(bt.seatTot, bt.capTot)+'%' : na(),'เฉลี่ย','i',
         bt ? (bt.seatTot+' ที่นั่ง จากความจุ '+bt.capTot+' · '+bt.order.length+' ลำ') : na(),'',
         top ? ('<span>เต็มสุด <b style="color:#047857">'+e(top.name)+' '+pct(top.pax,top.cap)+'%</b></span>'
               +(low?('<span class="sep">|</span><span>ว่างสุด <b style="color:#4f46e5">'+e(low.name)+' '+pct(low.pax,low.cap)+'%</b></span>'):''))
             : '<span>ยังไม่จัดเรือ</span>')
     + K('or','&#128656;','ต้นทุนรถรับส่ง', B(M.perVanPax),'/ คน','g',
         M.vanIn+' คันในโควตา'+(M.vanOut?(' · นอกโควตา '+M.vanOut):'')+' · รับส่ง '+(vn?vn.pax:na())+' คน','',
         '<span>ค่ารถรวม <b>'+B(M.vanCost)+'</b></span>'
         +(M.vanOut?'<span style="color:#be123c;font-weight:600">เกินโควตา</span>':'<span style="color:#047857;font-weight:500">อยู่ในโควตา</span>'));

    var rts = M.routes.map(function(r){ var pc = pct(r.seats, r.cap);
      return '<div class="dr-rc"><div class="h"><i style="background:'+r.color+'"></i>'+e(r.name)+'</div>'
        +'<div class="m"><span>ผู้โดยสาร</span><b>'+r.pax+' คน</b></div>'
        +'<div class="m"><span>booking</span><b>'+r.n+' ใบ</b></div>'
        +'<div class="m"><span>รายได้</span><b>'+B(r.rev)+'</b></div>'
        +'<div class="m"><span>ที่นั่ง</span><b>'+(bt?(r.seats+' / '+(r.cap||'—')+(r.cap?(' · '+pc+'%'):'')):na())+'</b></div>'
        +'<div class="dr-trk"><i style="width:'+Math.min(100,pc)+'%;background:linear-gradient(90deg,'+r.color+'66,'+r.color+')"></i></div></div>'; }).join('');

    var items = M.mkts.slice(0, 7).map(function(m){ return { v: m.pax, c: m.color, n: m.name }; });
    var leg = items.map(function(it){ return '<div class="li"><span class="n"><i style="background:'+it.c+'"></i>'+e(it.n)+'</span>'
        +'<b>'+it.v+' คน ('+pct(it.v, M.pax.tot)+'%)</b></div>'; }).join('');

    /* สิ่งที่ต้องเคลียร์ · a figure the server does not give yet is still listed, as "—" */
    var ops = M.ops, nb = ops && ops.no_boat, nv = ops && ops.no_van, W = [];
    if(!nv) W.push(['warn','ยังไม่จัดรถ',na(),'n',na()]); else if(n(nv.n)) W.push(['warn','ยังไม่จัดรถ',nv.n+' booking · '+n(nv.pax)+' คน','r','&#9888; ต้องจัด']);
    if(!nb) W.push(['warn','ยังไม่จัดเรือ',na(),'n',na()]); else if(n(nb.n)) W.push(['warn','ยังไม่จัดเรือ',nb.n+' booking · '+n(nb.pax)+' คน','r','&#9888; ต้องจัด']);
    if(bt && bt.over) W.push(['warn','เรือเกินความจุ',bt.over+' ลำ','r','&#9888;']);
    if(vn && vn.retTodo) W.push(['warn','ส่งคนละที่ · ยังไม่จัดรถกลับ',vn.retTodo+' booking · '+vn.retTodoPax+' คน','r','&#9888;']);
    if(M.docWarn) W.push(['amber','เอกสารยังไม่ครบ',M.docWarn+' booking','a','รอตรวจ']);
    if(M.due > 0) W.push(['amber','ยอดที่ต้องเก็บหน้างาน',B(M.due),'a','ก่อนปิดวัน']);
    if(M.noSlip) W.push(['amber','ยังไม่มีสลิปโอนเงิน',M.noSlip+' รายการ','a','&#9888;']);
    if(!W.length) W.push(['gr','ไม่มีรายการค้าง','ทุกอย่างพร้อมเดินทาง','e','&#10003; เรียบร้อย']);
    var half = Math.ceil(W.length / 2);
    var wcol = function(a){ return a.map(function(w){ return tile(w[0], e(w[1]), w[2].indexOf('<span') === 0 ? w[2] : e(w[2]), '<span class="dr-chip '+w[3]+'">'+w[4]+'</span>'); }).join(''); };

    var m1 = M.mkts[0] || null;
    var nvN = nv ? n(nv.n) : 0, nbN = nb ? n(nb.n) : 0;
    var insight = '<h3>'+(top?(e(top.name)+' ขายไปแล้ว '+pct(top.pax,top.cap)+'%'
        +(top.cap>top.pax?(' · เหลืออีก '+(top.cap-top.pax)+' ที่นั่ง'):' · เต็มลำแล้ว')):'ยังไม่จัดเรือของวันนี้')+'</h3>'
      +'<p>'+(m1?('กลุ่ม <b>'+e(m1.name)+'</b> ครองสัดส่วนสูงสุด '+pct(m1.pax,M.pax.tot)+'% ของทั้งวัน '):'')
      +'รายได้รวม <b>'+B(M.rev)+'</b>'
      +((!nv || !nb) ? ''
        : ((nvN||nbN)?(' ยังมี <b>'+(nvN?(nvN+' ใบที่ยังไม่จัดรถ'):'')+((nvN&&nbN)?' และ ':'')+(nbN?(nbN+' ใบยังไม่จัดเรือ'):'')+'</b> ต้องเคลียร์ก่อนปิดวัน'):' ทุกอย่างจัดครบแล้ว'))+'</p>';

    var cmp = function(lb, now, was, fmt){
      if(!has(was) || !has(now)) return tile('', e(lb), has(now)?fmt(now):na(), '<div class="rr"><p class="t">สัปดาห์ก่อน '+(has(was)?fmt(was):na())+'</p><p class="b">—</p></div>');
      var d = (was > 0) ? Math.round((now - was) / was * 1000) / 10 : null, up = (d != null && d >= 0);
      return tile(d == null ? '' : (up ? 'gr' : ''), e(lb), fmt(now),
        '<div class="rr"><p class="t">สัปดาห์ก่อน '+fmt(was)+'</p><p class="b" style="color:'+(up?'#047857':'#be123c')+'">'
        +(d == null ? '—' : ((up?'+':'')+d+'%'))+'</p></div>');
    };
    var chart = (typeof window.drChart === 'function') ? window.drChart(T) : '';
    return '<div class="dr-kpis">'+kp+'</div>'
     +'<div class="dr-main"><div class="dr-col">'
       +'<div class="eg p6"><div class="dr-hd"><div>'
         +'<h2>'+(bkMode?'ยอดที่รับเข้ามา · ตามวันที่ลงบุคกิ้ง · 14 วันย้อนหลัง':'ผู้โดยสาร · ตามวันเดินทาง · 14 วัน')+'</h2>'
         +'<p>'+(bkMode
             ? 'นับจากวันที่ลงบุคกิ้งในระบบ (bookingDate) — ใช้ดูจังหวะการขายว่าแต่ละวันรับงานเข้ามาเท่าไหร่ · หนึ่งใบนับ pax ของทุกทริปในใบนั้น'
             : 'นับจากวันเดินทางของแต่ละใบ — ใช้วางแผนเรือ/รถล่วงหน้า · <b>ไม่ใช่</b>วันที่ลงบุคกิ้ง')
           +' · แยกชั้นสีตาม Market · ตัวเลขบนยอดคือรวมทั้งวัน · ชี้เมาส์ดูแยกทีละตลาด</p></div>'
         +'<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
           +'<div class="dr-seg dr-noprint">'
             +'<button class="'+(bkMode?'':'on')+'" onclick="drTrendMode(\'travel\')">วันเดินทาง</button>'
             +'<button class="'+(bkMode?'on':'')+'" onclick="drTrendMode(\'booked\')">วันที่ลงบุคกิ้ง</button>'
           +'</div>'
           +'<span class="dr-chip i">'+(bkMode?('รับเข้ามาวันนี้ '+((T.pts[T.pts.length-1]||{}).tot||0)+' คน'):('เดินทางวันนี้ '+M.pax.tot+' คน'))+'</span></div></div>'
         +'<div style="height:300px;padding:0 2px" data-ops-dr-chart="1">'+chart+'</div>'
         +'<div class="dr-legrow">'+T.keys.map(function(k){ var m = T.mkt[k] || {};
             return '<span><i style="background:'+(m.color||'#94a3b8')+'"></i>'+e(m.name||k)+'</span>'; }).join('')
           +'<span style="margin-left:auto">'+(bkMode?'รับเข้ามารวม 14 วัน':'เดินทางรวม 14 วัน')+' <b>'
             +T.pts.reduce(function(a, q){ return a + q.tot; }, 0)+' คน</b></span></div></div>'
       +'<div class="eg p6"><div class="dr-hd"><div><h2>แยกตามเส้นทาง</h2>'
         +'<p>คน · booking · รายได้ · ที่นั่งเรือของแต่ละโปรแกรม</p></div>'
         +'<span class="dr-chip n">'+M.routes.length+' เส้นทาง · '+M.bookings+' booking</span></div>'
         +(rts?('<div class="dr-rts">'+rts+'</div>'):'<div class="dr-empty">ไม่มี booking ในวันนี้</div>')+'</div>'
       +'<div class="eg p6"><div class="dr-hd"><div><h2>สิ่งที่ต้องเคลียร์ก่อนปิดวัน</h2>'
         +'<p>รายการที่ยังค้างอยู่ในวันนี้</p></div><span class="dr-chip '+(W[0][0]==='gr'?'e':'r')+'">'+W.length+' เรื่อง</span></div>'
         +'<div class="dr-duo" style="gap:14px"><div>'+wcol(W.slice(0,half))+'</div><div>'+wcol(W.slice(half))+'</div></div></div>'
     +'</div><div class="dr-col">'
       +'<div class="eg p6"><div class="dr-hd"><div><h2 class="sm">สัดส่วนลูกค้า</h2></div><span class="rt">แบ่งตาม Market</span></div>'
         +'<div class="dr-donut">'+window.drDonut(items, M.pax.tot, 'Total pax')+'</div>'
         +'<div class="dr-lg">'+(leg||'<div class="dr-empty">ไม่มีข้อมูล</div>')+'</div></div>'
       +'<div class="dr-ins"><div class="blob1"></div><div class="blob2"></div><div class="z">'
         +'<div class="tp"><span class="cp">&#128161; ข้อสังเกตของวัน</span></div>'+insight+'</div></div>'
       +'<div class="eg p6"><div class="dr-hd"><div><h2 class="sm">เทียบกับ 7 วันก่อน</h2></div><span class="rt">วันเดียวกันสัปดาห์ที่แล้ว</span></div>'
         +cmp('ผู้โดยสาร', M.pax.tot, P7 ? P7.pax.tot : null, function(x){ return x+' คน'; })
         +cmp('รายได้', M.rev, P7 ? P7.rev : null, function(x){ return B(x); })
         +cmp('ที่นั่งเรือที่ใช้', bt ? pct(bt.seatTot, bt.capTot) : null, (P7 && P7.bt) ? pct(P7.bt.seatTot, P7.bt.capTot) : null, function(x){ return x+'%'; })
       +'</div>'
     +'</div></div>';
  }

  /* ══ ผู้โดยสาร ══ */
  function gridOf(t){
    var p = (t && t.pax) || {}, o = { ad: 0, chd: 0, inf: 0, foc: 0 };
    Object.keys(o).forEach(function(k){ o[k] = n(p[k + '_th']) + n(p[k + '_fr']) + n(p[k]); });
    return o;
  }
  /* the pickup window as staff write it (legacy text): HH:MM · HH:MM-HH:MM · Before HH:MM at pier; the final time wins */
  function win(start, end, atPier){
    if(atPier && end) return 'Before ' + end + ' at pier';
    if(start && end) return start + '-' + end;
    return start || '';
  }
  function pickupText(t){
    var o = (t && t.operations) || {};
    if(o.pickup_time_final || (o.pickup_final_at_pier && o.pickup_time_final_end)) return win(o.pickup_time_final, o.pickup_time_final_end, o.pickup_final_at_pier);
    return win(t.pickup_time, t.pickup_time_end, t.pickup_at_pier);
  }
  function rowsOf(date, list, M){
    var agName = {}; M.agents.forEach(function(a){ if(a.agent_id) agName[a.agent_id] = a.name; });
    var rName = {}; M.routes.forEach(function(r){ rName[r.id] = r.name; });
    var out = [];
    (list || []).forEach(function(b){
      if(!b || DEAD.indexOf(b.status) >= 0) return;
      var t = (b.trips || []).filter(function(x){ return x && x.service_date === date; })[0]; if(!t) return;
      var ag = b.agent_id ? (agName[b.agent_id] || ((g('sbGetAgent') && g('sbGetAgent')(b.agent_id)) || {}).name || b.agent_id) : (b.source || 'walk-in');
      out.push({ b: b, t: t, route: rName[t.route_id] || route(t.route_id).name || t.route_id, agent: ag, voucher: b.voucher_ref || '' });
    });
    var az = function(a, c){ return String(a || '').localeCompare(String(c || ''), 'en', { numeric: true, sensitivity: 'base' }); };
    return out.sort(function(x, y){ return az(x.route, y.route) || az(x.agent, y.agent) || az(x.voucher, y.voucher); });
  }
  function panePx(M, rows){
    var e = esc, P = M.pax, ops = M.ops || {}, meals = ops.meals || null, langs = ops.langs || null;
    var mealTot = meals ? n(meals.veg) + n(meals.vegan) + n(meals.halal) : null, alg = meals ? n(meals.allergy) : null;
    var lk = langs ? Object.keys(langs).sort(function(a, c){ return langs[c] - langs[a]; }) : [];
    var lmax = lk.length ? langs[lk[0]] : 1, LC = { EN:'#c4b5fd', RU:'#8b5cf6', CN:'#a78bfa', TH:'#ddd6fe' };
    var big = rows ? rows.reduce(function(a, r){ return Math.max(a, n(r.t.pax_total)); }, 0) : null;
    var kp = ''
     + K('blue','&#128101;','ผู้โดยสารทั้งวัน', P.tot, 'คน','g',
         'จาก '+M.bookings+' booking · '+M.routes.length+' เส้นทาง','',
         '<span>เฉลี่ย <b>'+(M.bookings?(Math.round(P.tot/M.bookings*10)/10):0)+' คน/ใบ</b></span>'
         +'<span class="sep">|</span><span>ใบใหญ่สุด <b>'+v(big)+' คน</b></span>')
     + K('te','&#128106;','แยกตามประเภท', P.ad, 'ผู้ใหญ่','g',
         'เด็ก '+P.chd+' · ทารก '+P.inf+' · FOC '+P.foc,'',
         '<span>เด็ก <b>'+pct(P.chd,P.tot)+'%</b></span><span class="sep">|</span><span>FOC <b>'+pct(P.foc,P.tot)+'%</b></span>')
     + K('pu','&#127760;','สัญชาติ', v(P.fr), 'ต่างชาติ','g',
         'ไทย '+v(P.th)+' คน'+(P.un?(' · ยังไม่ระบุ '+P.un+' คน'):''),(P.un?'bad':''),
         '<span>ต่างชาติ <b>'+(has(P.fr)?pct(P.fr,P.tot)+'%':na())+'</b></span><span class="sep">|</span>'
         +'<span>ไทย <b>'+(has(P.th)?pct(P.th,P.tot)+'%':na())+'</b></span>'
         +(P.un?('<span class="sep">|</span><span style="color:#be123c">ไม่ระบุ <b>'+P.un+'</b></span>'):''))
     + K('ro','&#9888;','ต้องดูแลพิเศษ', meals ? (mealTot+alg) : na(), 'รายการ',(meals&&(mealTot+alg))?'r':'g',
         'อาหารพิเศษ '+v(mealTot)+' · แพ้อาหาร '+v(alg), (alg?'bad':''),
         lk.length ? lk.slice(0,3).map(function(k){ return '<span>'+e(k)+' <b>'+langs[k]+'</b></span>'; }).join('<span class="sep">|</span>')
                   : (langs ? '<span>ไม่มีภาษาที่ต้องจัดไกด์</span>' : '<span>'+na()+'</span>'));

    /* types per route: the server's by_route has the head count, not the split (B16 by_route[].ad/chd/inf/foc) */
    var bars = M.routes.map(function(r){
      var s = r.split || null, t = s ? (s.ad + s.chd + s.inf + s.foc) || 1 : 1;
      var segs = s ? [{w:s.ad/t*100,c:r.color},{w:s.chd/t*100,c:r.color+'99'},{w:s.inf/t*100,c:r.color+'66'},{w:s.foc/t*100,c:r.color+'33'}] : [];
      var det = []; if(s){ if(s.ad)det.push('ผู้ใหญ่ '+s.ad); if(s.chd)det.push('เด็ก '+s.chd); if(s.inf)det.push('ทารก '+s.inf); if(s.foc)det.push('FOC '+s.foc); }
      return bar(e(r.name), r.color, r.pax+' คน', segs, s ? det.join(' · ') : na(), r.n+' booking');
    }).join('');

    var body = (rows || []).map(function(r){
      var b = r.b, p = gridOf(r.t), agC = agentColor(b.agent_id);
      var ml = []; if(n(b.special_meals_veg)) ml.push('มังสวิรัติ '+n(b.special_meals_veg)); if(n(b.special_meals_vegan)) ml.push('วีแกน '+n(b.special_meals_vegan)); if(n(b.special_meals_halal)) ml.push('ฮาลาล '+n(b.special_meals_halal));
      var al = text(b.special_meals_allergies).trim();
      var lg = []; if(b.guide_english) lg.push('EN'); if(b.guide_russian) lg.push('RU'); if(b.guide_chinese) lg.push('CN'); var ol = text(b.guide_other_lang || b.guide_other).trim(); if(ol) lg.push(ol);
      var drop = (b.dropoff_same === false) ? (b.dropoff_hotel_name || b.dropoff_area || '—') : '';
      var tm = pickupText(r.t) || '—';
      var cell = function(x){ return x ? ('<td class="c" style="font-weight:700">'+x+'</td>') : '<td class="c dr-z0">0</td>'; };
      return '<tr><td class="dr-mono" style="font-weight:700">'+e(r.voucher||'—')+'</td>'
        +'<td>'+sq(agC, b.lead_pax||r.agent)+'<span><b>'+e(b.lead_pax||'—')+'</b><span>'+e(b.lead_phone||'')+'</span></span></span></td>'
        +'<td><span class="dr-tag" style="background:'+agC+'1f;color:'+agC+'">'+e(r.agent)+'</span></td>'
        +cell(p.ad)+cell(p.chd)+cell(p.inf)+cell(p.foc)
        +'<td>'+e(r.route||'—')+'</td>'
        +'<td>'+e(b.hotel_name||'—')+' · <b class="dr-mono">'+e(tm)+'</b></td>'
        +'<td>'+(drop?('<b>'+e(drop)+'</b>'):'<span class="dr-z0">จุดเดิม</span>')+'</td>'
        +'<td>'+(lg.length?lg.map(function(x){ return '<span class="dr-tag" style="background:#f5f3ff;color:#7c3aed">'+e(x)+'</span>'; }).join(' '):'<span class="dr-z0">—</span>')+'</td>'
        +'<td>'+(ml.length?('<span class="dr-tag" style="background:#d1fae5;color:#047857">'+e(ml.join(' · '))+'</span>'):'')
          +(al?('<span class="dr-tag" style="background:#ffe4e6;color:#be123c">&#9888; '+e(al)+'</span>'):'')
          +((!ml.length&&!al)?'<span class="dr-z0">—</span>':'')+'</td></tr>';
    }).join('');

    return '<div class="dr-kpis">'+kp+'</div>'
     +'<div class="dr-duo">'
       +'<div class="eg p6"><div class="dr-hd"><div><h2 class="sm">ประเภทผู้โดยสารรายเส้นทาง</h2>'
         +'<p>ผู้ใหญ่ · เด็ก · ทารก · FOC</p></div></div>'
         +(bars||'<div class="dr-empty">ไม่มีข้อมูล</div>')+'</div>'
       +'<div class="eg p6"><div class="dr-hd"><div><h2 class="sm">อาหารพิเศษ · ภาษาไกด์</h2>'
         +'<p>สิ่งที่ครัวและไกด์ต้องเตรียมล่วงหน้า</p></div>'
         +'<span class="dr-chip '+((meals&&(mealTot+alg))?'a':'n')+'">'+(meals?(mealTot+alg):na())+' รายการ</span></div>'
         +tile('','มังสวิรัติ / วีแกน',(meals?(n(meals.veg)+n(meals.vegan)):na())+' คน','<span class="dr-chip e">&#127807; แจ้งครัว</span>')
         +tile('','ฮาลาล',(meals?n(meals.halal):na())+' คน','<span class="dr-chip e">&#127807; แจ้งครัว</span>')
         +tile(alg?'warn':'','แพ้อาหาร',v(alg)+' รายการ',
            '<span class="dr-chip '+(alg?'r':'n')+'">'+(alg?'&#9888; ต้องยืนยัน':(meals?'ไม่มี':na()))+'</span>')
         +'<div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--dl)">'
         +'<div class="dr-hd" style="margin-bottom:12px"><div><h2 class="sm">ภาษาไกด์ที่ต้องใช้</h2></div></div>'
         +(lk.length?lk.map(function(k){ return bar(e(k), LC[k]||'#a78bfa', langs[k]+' คน', [{w:langs[k]/lmax*100,c:LC[k]||'#a78bfa'}], '', ''); }).join('')
           :'<div class="dr-empty">'+(langs?'ไม่มีภาษาที่ต้องจัดไกด์':na())+'</div>')+'</div></div>'
     +'</div>'
     +'<div class="eg p6"><div class="dr-hd"><div><h2>รายชื่อผู้โดยสารทั้งวัน</h2>'
       +'<p>เรียงตามเส้นทาง → Agency → Voucher · ข้อมูลที่ไกด์และคนขับต้องใช้</p></div>'
       +'<span class="dr-chip n">'+(rows?rows.length:na())+' booking · '+P.tot+' คน</span></div>'
       +'<div style="overflow-x:auto"><table class="dr-tbl"><thead><tr>'
       +'<th>Voucher</th><th>Customer (lead)</th><th>Agency</th><th class="c">AD</th><th class="c">CHD</th>'
       +'<th class="c">INF</th><th class="c">FOC</th><th>Route</th><th>Pickup · Time</th><th>Drop-off</th>'
       +'<th>ภาษา</th><th>อาหารพิเศษ</th></tr></thead><tbody>'
       +(body||'<tr><td colspan="12" class="dr-empty">ไม่มี booking ในวันนี้</td></tr>')+'</tbody></table></div>'
       +'<div class="dr-sum"><div class="l"><span>ผู้ใหญ่ <b>'+P.ad+'</b></span><span>เด็ก <b>'+P.chd+'</b></span>'
         +'<span>ทารก <b>'+P.inf+'</b></span><span>FOC <b>'+P.foc+'</b></span>'
         +'<span>ไทย <b>'+v(P.th)+'</b></span><span>ต่างชาติ <b>'+v(P.fr)+'</b></span>'
         +(P.un?('<span>ยังไม่ระบุสัญชาติ <b style="color:#be123c">'+P.un+'</b></span>'):'')+'</div>'
       +'<div class="r"><span>รวมผู้โดยสารทั้งวัน</span><b style="color:#111827">'+P.tot+' คน</b></div></div></div>';
  }

  /* ══ เรือ ══ */
  function paneBt(M){
    var e = esc, bt = M.bt || { boats: {}, order: [], seatTot: 0, capTot: 0, over: 0 }, nb = M.ops && M.ops.no_boat;
    var rn = function(b){ return Object.keys(b.routes).map(function(rid){ var r = M.routes.filter(function(x){ return x.id === rid; })[0]; return (r && r.name) || route(rid).name || rid; }).join(' · '); };
    var piersN = {}; bt.order.forEach(function(id){ piersN[bt.boats[id].pier || '—'] = 1; });
    var top = bt.order.length ? bt.boats[bt.order[0]] : null;
    var kp = ''
     + K('pu','&#128676;','เรือที่ออกวันนี้', bt.order.length, 'ลำ','g',
         Object.keys(piersN).length+' ท่า · '+bt.order.map(function(id){ return e(bt.boats[id].name); }).slice(0,3).join(' · '),'',
         '<span>booking <b>'+M.bookings+'</b></span><span class="sep">|</span><span>ผู้โดยสาร <b>'+bt.seatTot+'</b></span>')
     + K('em','&#128101;','ที่นั่งที่ขายไปแล้ว', bt.seatTot, '/ '+bt.capTot,'g',
         'เฉลี่ย '+pct(bt.seatTot,bt.capTot)+'% ของความจุรวม','',
         '<span>เหลือ <b>'+Math.max(0,bt.capTot-bt.seatTot)+' ที่นั่ง</b></span>'
         +(top?('<span class="sep">|</span><span>เต็มสุด <b>'+e(top.name)+' '+pct(top.pax,top.cap)+'%</b></span>'):''))
     + K('ro','&#9888;','ยังไม่จัดเรือ', nb ? n(nb.n) : na(), 'booking', (nb&&n(nb.n))?'r':'g',
         nb ? (n(nb.n)?('&#9888; '+n(nb.pax)+' คน ยังไม่มีลำรองรับ'):'จัดครบทุกใบแล้ว') : na(), (nb&&n(nb.n))?'bad':(nb?'ok':''),
         '<span>เกินความจุ <b style="color:'+(bt.over?'#be123c':'#047857')+'">'+bt.over+' ลำ</b></span>'
         +'<span class="sep">|</span><span>ต้องเคลียร์ก่อนปิดวัน</span>')
     + K('or','&#9973;','เรือหางยาว', M.ltChtr, 'ลำเหมา','g',
         'Join '+M.ltJoin+' คน · ต้นทุนเหมา '+B(M.ltCost),'',
         '<span>Join <b>'+M.ltJoin+' คน</b></span><span class="sep">|</span><span>เหมา <b>'+M.ltChtr+' ลำ</b></span>');

    var bars = bt.order.map(function(id){ var b = bt.boats[id], pc = pct(b.pax,b.cap), over = (b.cap>0&&b.pax>b.cap);
      var col = over?'#e11d48':(pc>=80?'#10b981':(pc>=50?'#14b8a6':'#4f46e5'));
      return bar(e(b.name)+(b.type?(' · '+e(b.type)):''), col, b.pax+' / '+(b.cap||'—')+' <span>('+pc+'%)</span>', [{w:Math.min(100,pc),c:col}],
        e(rn(b))+(b.pier?(' · '+e(pierTxt(b))):'')+(b.dep?(' · ออก '+e(b.dep)):''),
        over?('<b style="color:#be123c">&#9888; เกิน '+(b.pax-b.cap)+' ที่นั่ง</b>'):(b.cap>b.pax?('เหลือ '+(b.cap-b.pax)+' ที่นั่ง'):'เต็มลำ'));
    }).join('');
    var deps = bt.order.slice().sort(function(a, c){ return String(bt.boats[a].dep||'99').localeCompare(String(bt.boats[c].dep||'99')); })
      .map(function(id){ var b = bt.boats[id], over = (b.cap>0&&b.pax>b.cap);
        return tile(over?'warn':'', e(pierTxt(b)||'—')+' · '+e(b.dep||'—'), e(b.name)+' · '+e(rn(b)),
          '<div class="rr"><p class="t">'+(over?'เกินความจุ':'ผู้โดยสาร')+'</p><p class="b"'+(over?' style="color:#be123c"':'')+'>'+b.pax+(over?(' / '+b.cap):' คน')+'</p></div>'); }).join('');
    var body = bt.order.map(function(id){ var b = bt.boats[id], pc = pct(b.pax,b.cap), over = (b.cap>0&&b.pax>b.cap);
      var col = over?'#e11d48':(pc>=80?'#047857':'#4f46e5'), bn = b.bookings;
      return '<tr><td>'+sq(col,b.name)+'<span><b>'+e(b.name)+'</b><span>'+e(b.type||'')+'</span></span></span></td>'
        +'<td>'+e(b.type||'—')+'</td><td>'+e(pierTxt(b)||'—')+'</td>'
        +'<td class="c dr-mono">'+e(b.dep||'—')+'</td><td>'+e(rn(b))+'</td><td class="c">'+(has(bn)?bn:na())+'</td>'
        +'<td class="c dr-mono">'+(b.cap||'—')+'</td>'
        +'<td class="c dr-mono" style="font-weight:700'+(over?';color:#be123c':'')+'">'+b.pax+'</td>'
        +'<td class="c dr-mono"'+(over?' style="color:#be123c"':'')+'>'+(b.cap?(b.cap-b.pax):'—')+'</td>'
        +'<td class="c" style="font-weight:700;color:'+col+'">'+(b.cap?(pc+'%'):'—')+'</td>'
        +'<td class="c">'+(over?'<span class="dr-tag" style="background:#ffe4e6;color:#be123c">&#9888; เกินความจุ</span>'
          :(pc>=80?'<span class="dr-tag" style="background:#d1fae5;color:#047857">ใกล้เต็ม</span>':'<span class="dr-tag" style="background:#eff6ff;color:#2563eb">ยังรับได้</span>'))+'</td></tr>';
    }).join('');
    if(nb && n(nb.n)){
      body += '<tr style="opacity:.75"><td>'+sq('#9ca3af','—')+'<span><b>ยังไม่จัดเรือ</b><span>'+nb.n+' booking</span></span></span></td>'
        +'<td class="dr-z0">—</td><td class="dr-z0">—</td><td class="c dr-z0">—</td><td class="dr-z0">—</td>'
        +'<td class="c">'+nb.n+'</td><td class="c dr-z0">—</td>'
        +'<td class="c dr-mono" style="font-weight:700;color:#be123c">'+n(nb.pax)+'</td>'
        +'<td class="c dr-z0">—</td><td class="c dr-z0">—</td>'
        +'<td class="c"><span class="dr-tag" style="background:#ffe4e6;color:#be123c">&#9888; ต้องจัดเรือ</span></td></tr>';
    }
    return '<div class="dr-kpis">'+kp+'</div>'
     +'<div class="dr-duo">'
       +'<div class="eg p6"><div class="dr-hd"><div><h2 class="sm">ที่นั่งรายลำ</h2><p>เรียงจากเต็มที่สุด</p></div></div>'
         +(bars||'<div class="dr-empty">ยังไม่จัดเรือของวันนี้</div>')+'</div>'
       +'<div class="eg p6"><div class="dr-hd"><div><h2 class="sm">ท่าเรือ · เวลาออก</h2><p>ลำดับการออกเรือของวันนี้</p></div></div>'
         +(deps||'<div class="dr-empty">ไม่มีข้อมูล</div>')
         +(M.ltChtr?tile('amber','เรือหางยาวเหมา', M.ltChtr+' ลำ','<b style="font-size:13px;color:#78350f">-'+B(M.ltCost)+'</b>'):'')+'</div>'
     +'</div>'
     +'<div class="eg p6"><div class="dr-hd"><div><h2>ตารางเรือทั้งวัน</h2>'
       +'<p>ความจุ · ที่ขายแล้ว · ที่เหลือ · เส้นทาง · สถานะ</p></div>'
       +'<span class="dr-chip n">'+bt.order.length+' ลำ · '+bt.capTot+' ที่นั่ง</span></div>'
       +'<div style="overflow-x:auto"><table class="dr-tbl"><thead><tr>'
       +'<th>Boat</th><th>Type</th><th>Pier</th><th class="c">Depart</th><th>Route</th><th class="c">Booking</th>'
       +'<th class="c">Capacity</th><th class="c">Sold</th><th class="c">Left</th><th class="c">Load</th><th class="c">Status</th>'
       +'</tr></thead><tbody>'+(body||'<tr><td colspan="11" class="dr-empty">ไม่มีเรือของวันนี้</td></tr>')+'</tbody></table></div>'
       +'<div class="dr-sum"><div class="l"><span>ความจุรวม <b>'+bt.capTot+' ที่นั่ง</b></span>'
         +'<span>ขายแล้ว <b>'+bt.seatTot+'</b></span><span>เหลือ <b>'+Math.max(0,bt.capTot-bt.seatTot)+'</b></span>'
         +'<span>Load เฉลี่ย <b>'+pct(bt.seatTot,bt.capTot)+'%</b></span></div>'
       +'<div class="r"><span>booking ที่ยังไม่จัดเรือ</span><b style="color:'+((nb&&n(nb.n))?'#be123c':'#047857')+'">'
         +(nb?(n(nb.n)+' ใบ · '+n(nb.pax)+' คน'):na())+'</b></div></div></div>';
  }

  /* ══ รถรับส่ง ══ */
  function paneVn(M){
    var e = esc, C = M.cfg, vn = M.vn || { vans: {}, order: [], pax: 0, retTodo: 0, retTodoPax: 0, byVan: {} }, ops = M.ops || {};
    var nv = ops.no_van || null, self = ops.self_arrive || null, ret = ops.ret || null, zones = ops.zones || null;
    var ZC = ['#8b5cf6','#a78bfa','#c4b5fd','#ddd6fe','#ede9fe'];
    var vanCapTot = vn.order.reduce(function(a, id){ return a + vn.vans[id].cap; }, 0);
    var kp = ''
     + K('or','&#128656;','รถที่ใช้วันนี้', M.nVan, 'คัน','g',
         'ในโควตา '+M.vanIn+' · นอกโควตา '+M.vanOut, M.vanOut?'bad':'',
         '<span>ค่ารถรวม <b>'+B(M.vanCost)+'</b></span>'
         +(M.vanOut?'<span style="color:#be123c;font-weight:600">เกินโควตา</span>':'<span style="color:#047857;font-weight:500">อยู่ในโควตา</span>'))
     + K('blue','&#128101;','คนที่ใช้รถรับส่ง', vn.pax, '/ '+M.pax.tot+' คน','g',
         'มาเอง '+(self?(n(self.pax)+' คน ('+pct(n(self.pax),M.pax.tot)+'%)'):na()),'',
         '<span>เฉลี่ย <b>'+(M.nVan?(Math.round(vn.pax/M.nVan*10)/10):0)+' คน/คัน</b></span>'
         +'<span class="sep">|</span><span>ความจุรวม <b>'+vanCapTot+'</b></span>')
     + K('em','&#128176;','ต้นทุนต่อหัว', B(M.perVanPax), '/ คน','g',
         (M.perVanPax<=C.targetPerPax?'&#10003; ต่ำกว่าเป้า ':'&#9888; สูงกว่าเป้า ')+B(C.targetPerPax), (M.perVanPax<=C.targetPerPax?'ok':'bad'),
         '<span class="dr-cfg dr-noprint" title="ใช้เฉพาะคันที่ยังไม่ได้ตั้งเรตในหน้า ต้นทุน › ราคาจริง">'
           +(M.vanEst?'ค่ารถ/คัน ':'สำรอง ฿/คัน ')+'<input value="'+C.vanCost+'" onchange="drCfgSet(\'vanCost\',this.value)"></span>'
         +'<span class="dr-cfg dr-noprint">โควตา <input value="'+C.vanQuota+'" onchange="drCfgSet(\'vanQuota\',this.value)"></span>'
         +(M.vanEst
            ? '<span class="dr-cfg dr-noprint" style="color:#b45309">ยังไม่มีเรตจริง · ใช้เลขเฉลี่ย</span>'
            : ('<span class="dr-cfg dr-noprint" style="color:#047857">เรตจริงรายคัน · แหล่งเดียวกับ P&amp;L</span>'
               +(M.vanNoRate?('<span class="dr-cfg dr-noprint" style="color:#b45309">'+M.vanNoRate+' คันยังไม่ตั้งเรต</span>'):''))))
     + K('ro','&#9888;','ยังไม่จัดรถ', nv ? n(nv.n) : na(), 'booking', (nv&&n(nv.n))?'r':'g',
         nv ? (n(nv.n)?('&#9888; '+n(nv.pax)+' คน · ต้องจัดก่อนปิดวัน'):'จัดครบทุกใบแล้ว') : na(), (nv&&n(nv.n))?'bad':(nv?'ok':''),
         '<span>รถกลับยังไม่จัด <b style="color:'+(vn.retTodo?'#be123c':'#047857')+'">'+vn.retTodo+' ใบ</b></span>'
         +'<span class="sep">|</span><span>ส่งคนละที่ <b>'+(ret?(vn.retTodo+n(ret.arr)):na())+' ใบ</b></span>');

    var zk = zones ? Object.keys(zones).sort(function(a, c){ return n(zones[c].pax) - n(zones[a].pax); }) : [];
    var zmax = zk.length ? n(zones[zk[0]].pax) : 1;
    var zbars = zk.map(function(k, i){ var z = zones[k];
      return bar(e(z.name || zoneLabel(k)), ZC[i%ZC.length], n(z.pax)+' คน · '+n(z.vans)+' คัน', [{w:n(z.pax)/zmax*100,c:ZC[i%ZC.length]}],
        (z.first?('รับแรก '+e(z.first)+(z.last&&z.last!==z.first?(' · รับสุดท้าย '+e(z.last)):'')):''), n(z.n)+' booking'); }).join('');

    var body = vn.order.map(function(id){ var x = vn.vans[id], pc = pct(x.pax, x.cap);
      var col = (x.cap&&x.pax>x.cap)?'#be123c':(pc>=80?'#047857':'#4f46e5');
      var V = (M.vanList && M.vanList[id]) || {}, own = x.own || V.ownership || '';
      var bts = (x.boats || []).map(function(bid){ var bb = M.bt && M.bt.boats[bid]; return '<span class="dr-tag" style="background:#ecfdf5;color:#047857">'+e((bb && bb.name) || boat(bid).name || bid)+'</span>'; }).join(' ');
      var cost = has(vn.byVan[id]) ? vn.byVan[id] : C.vanCost;
      return '<tr><td>'+sq('#8b5cf6',x.name)+'<span><b>'+e(x.name)+'</b><span>'+e(V.type||'')+(own==='partner'?' · รถร่วม':'')+'</span></span></span></td>'
        +'<td class="dr-mono">'+e(x.plate||'—')+'</td>'
        +'<td>'+e(x.driver||'—')+(x.phone?('<div style="font-size:10px;color:#9ca3af" class="dr-mono">'+e(x.phone)+'</div>'):'')+'</td>'
        +'<td>'+e(x.zones.map(zoneLabel).join(' · ')||'—')+'</td><td class="c dr-mono">'+(vn.fromOps?e(x.first||'—'):na())+'</td><td class="c">'+x.n+'</td>'
        +'<td class="c dr-mono" style="font-weight:700">'+x.pax+'</td><td class="c dr-mono">'+(x.cap||'—')+'</td>'
        +'<td class="c" style="font-weight:700;color:'+col+'">'+(x.cap?(pc+'%'):'—')+'</td>'
        +'<td>'+(vn.fromOps?(bts||'<span class="dr-z0">—</span>'):na())+'</td>'
        +'<td class="r dr-mono" style="font-weight:700">'+B(cost)
          +(x.noRate?'<div style="font-size:9px;font-weight:600;color:#b45309">ยังไม่ตั้งเรต</div>':'')+'</td></tr>';
    }).join('');
    if(nv && n(nv.n)){
      body += '<tr style="opacity:.75"><td>'+sq('#9ca3af','—')+'<span><b>ยังไม่จัดรถ</b><span>'+nv.n+' booking</span></span></span></td>'
        +'<td class="dr-z0">—</td><td class="dr-z0">—</td><td class="dr-z0">—</td><td class="c dr-z0">—</td>'
        +'<td class="c">'+nv.n+'</td><td class="c dr-mono" style="font-weight:700;color:#be123c">'+n(nv.pax)+'</td>'
        +'<td class="c dr-z0">—</td><td class="c dr-z0">—</td><td class="dr-z0">—</td><td class="r dr-z0">—</td></tr>';
    }
    var rt = function(cls, t, k, kp2, chip){ return tile(cls, t, ret ? (n(ret[k])+' booking · '+n(ret[kp2])+' คน') : na(), chip); };
    return '<div class="dr-kpis">'+kp+'</div>'
     +'<div class="dr-duo">'
       +'<div class="eg p6"><div class="dr-hd"><div><h2 class="sm">แยกตามโซนรับ</h2>'
         +'<p>จำนวนคนที่ต้องรับในแต่ละโซนและเวลารับแรก</p></div></div>'
         +(zbars||'<div class="dr-empty">'+(zones?'ไม่มีใบที่ต้องรับส่ง':na())+'</div>')
         +tile('','มาเองที่ท่าเรือ · ไม่ใช้รถ', self?(n(self.pax)+' คน · '+n(self.n)+' booking'):na(),'<span class="dr-chip n">Self-arrive</span>')+'</div>'
       +'<div class="eg p6"><div class="dr-hd"><div><h2 class="sm">ขากลับ · จุดส่ง</h2>'
         +'<p>ใบที่ส่งคนละที่กับตอนรับ ต้องจัดรถกลับแยก</p></div>'
         +'<span class="dr-chip '+(vn.retTodo?'r':'n')+'">'+(ret?(vn.retTodo+n(ret.arr)):na())+' ใบ</span></div>'
         +rt('gr','ส่งจุดเดิม · ใช้รถคันเดิม','same','samePax','<span class="dr-chip e">&#10003; ไม่ต้องจัดเพิ่ม</span>')
         +rt('amber','ส่งคนละที่ · จัดรถกลับแล้ว','arr','arrPax','<span class="dr-chip a">จัดแล้ว</span>')
         +tile(vn.retTodo?'warn':'','ส่งคนละที่ · ยังไม่จัดรถกลับ', vn.retTodo+' booking · '+vn.retTodoPax+' คน',
            '<span class="dr-chip '+(vn.retTodo?'r':'n')+'">'+(vn.retTodo?'&#9888; ต้องจัด':'ไม่มี')+'</span>')
         +rt('','กลับเอง · ลงท่าเรือ','self','selfPax','<span class="dr-chip n">Self-return</span>')+'</div>'
     +'</div>'
     +'<div class="eg p6"><div class="dr-hd"><div><h2>ตารางรถรับส่ง</h2>'
       +'<p>คนขับ · ทะเบียน · โซน · เวลารับแรก · จำนวนคน · ส่งขึ้นเรือลำไหน · ต้นทุน</p></div>'
       +'<span class="dr-chip n">'+M.nVan+' คัน · '+vn.pax+' คน</span></div>'
       +'<div style="overflow-x:auto"><table class="dr-tbl"><thead><tr>'
       +'<th>Van</th><th>ทะเบียน</th><th>คนขับ</th><th>โซน</th><th class="c">รับแรก</th><th class="c">Booking</th>'
       +'<th class="c">Pax</th><th class="c">ความจุ</th><th class="c">Load</th><th>ส่งขึ้นเรือ</th><th class="r">ต้นทุน</th>'
       +'</tr></thead><tbody>'+(body||'<tr><td colspan="11" class="dr-empty">ไม่มีรถของวันนี้</td></tr>')+'</tbody></table></div>'
       +'<div class="dr-sum"><div class="l"><span>รถในโควตา <b>'+M.vanIn+' คัน</b></span>'
         +'<span>นอกโควตา <b'+(M.vanOut?' style="color:#be123c"':'')+'>'+M.vanOut+' คัน</b></span>'
         +'<span>คนที่ใช้รถ <b>'+vn.pax+' / '+M.pax.tot+'</b></span>'
         +'<span>เฉลี่ยต่อหัว <b>'+B(M.perVanPax)+'</b></span></div>'
       +'<div class="r"><span>ค่ารถรวมทั้งวัน</span><b>'+B(M.vanCost)+'</b></div></div></div>';
  }

  /* ══ การเงิน ══ */
  function paneFi(M){
    var e = esc, cost = M.known, up = M.extras + M.up;
    var kp = ''
     + K('em','&#128176;','รายได้ทั้งวัน', B(M.rev),'','',
         'เฉลี่ย '+B(M.perPax)+' / คน','ok',
         '<span>'+M.bookings+' booking</span><span class="sep">|</span><span>'+M.pax.tot+' คน</span>')
     + K('or','&#128179;','ต้องเก็บหน้างาน', B(M.due), M.due>0?'ค้าง':'','r',
         M.due>0?('เก็บไปแล้ว '+B(M.got)):'เก็บครบแล้ว', M.due>0?'bad':'ok',
         '<span>เก็บแล้ว <b>'+B(M.got)+'</b></span><span class="sep">|</span>'
         +'<span>รอสลิป <b'+(M.noSlip?' style="color:#be123c"':'')+'>'+M.noSlip+'</b></span>')
     + K('ro','&#128184;','ต้นทุนที่ทราบแล้ว', B(cost),'','',
         'ค่ารถ '+B(M.vanCost)+' · หางยาว '+B(M.ltCost),'',
         '<span>ต่อหัว <b>'+B(M.pax.tot?cost/M.pax.tot:0)+'</b></span>'
         +'<span class="sep">|</span><span>'+pct(cost,M.rev)+'% ของรายได้</span>')
     + K('pu','&#128717;','ขายเพิ่มหน้างาน', B(up), '&#9650; upsell','',
         'Add-on '+B(M.extras)+' · upgrade '+B(M.up),'',
         '<span>'+pct(up,M.rev)+'% ของรายได้</span><span class="sep">|</span>'
         +'<span>เฉลี่ย <b>'+B(M.pax.tot?up/M.pax.tot:0)+' / คน</b></span>');
    var CH = [['invoice','Invoice · เครดิต','#2563eb'],['proforma','Proforma · จ่ายล่วงหน้า','#8b5cf6'],
              ['cot','COT · เก็บหน้างาน','#f59e0b'],['transfer','โอนล่วงหน้า','#14b8a6'],['other','อื่น ๆ / ยังไม่ระบุ','#64748b']];
    var chOn = CH.filter(function(c){ return n(M.pay[c[0]]) > 0; });
    var chBars = chOn.map(function(c){ var x = n(M.pay[c[0]]), pc = pct(x, M.rev);
      return bar(e(c[1]), c[2], B(x)+' <span>('+pc+'%)</span>', [{w:pc,c:c[2]}], '',
        (c[0]==='cot'&&M.due>0)?('<b style="color:#be123c">&#9888; ยังเก็บไม่ครบ '+B(M.due)+'</b>'):''); }).join('');
    var rbody = M.routes.map(function(r){
      return '<tr><td><span style="display:inline-flex;align-items:center;gap:8px">'
        +'<i style="width:10px;height:10px;border-radius:50%;background:'+r.color+';font-style:normal"></i>'
        +'<b>'+e(r.name)+'</b></span></td><td class="c">'+r.n+'</td><td class="c">'+r.pax+'</td>'
        +'<td class="r dr-mono" style="font-weight:700">'+B(r.rev)+'</td>'
        +'<td class="r dr-mono">'+B(r.per)+'</td>'
        +'<td class="c" style="font-weight:700;color:'+r.color+'">'+r.share+'%</td></tr>'; }).join('');
    var mk = {}; M.mkts.forEach(function(m){ mk[m.id] = m; });
    var PT = { invoice:['Invoice','#2563eb'], credit:['Invoice','#2563eb'], proforma:['Proforma','#8b5cf6'],
               prepaid:['Proforma','#8b5cf6'], cot:['COT','#f59e0b'], bt:['โอนล่วงหน้า','#14b8a6'] };
    var abody = M.agents.map(function(a){
      var pt = PT[a.pay_type] || ['Walk-in','#64748b'], m = mk[a.market_id] || { name: a.market_id || '—', color: '#94a3b8' }, d = a.docs || {}, col = agentColor(a.agent_id);
      var dc = (n(d.issue)?['&#9888; มีปัญหา '+n(d.issue),'#be123c','#ffe4e6']
        :(n(d.pending)?['รอตรวจ '+n(d.pending),'#b45309','#fef3c7']
        :(n(d.nofiles)?['ยังไม่แนบ '+n(d.nofiles),'#4b5563','#e5e7eb']
        :['&#10003; ครบ','#047857','#d1fae5'])));
      var cell = function(x){ return n(x)?('<td class="c" style="font-weight:700">'+n(x)+'</td>'):'<td class="c dr-z0">0</td>'; };
      return '<tr><td>'+sq(col,a.name)+'<span><b>'+e(a.name)+'</b><span>'+n(a.bookings)+' booking</span></span></span></td>'
        +'<td><span class="dr-tag" style="background:'+m.color+'1f;color:'+m.color+'">'+e(m.name)+'</span></td>'
        +cell(a.ad)+cell(a.chd)+cell(a.inf)+cell(a.foc)
        +'<td class="c" style="font-weight:700">'+n(a.pax)+'</td>'
        +'<td><span class="dr-tag" style="background:'+pt[1]+'1f;color:'+pt[1]+'">'+e(pt[0])+'</span></td>'
        +'<td class="r dr-mono" style="font-weight:700">'+B(a.revenue)+'</td>'
        +'<td class="r dr-mono"'+(n(a.due)>0?' style="font-weight:700;color:#b45309"':' class="r dr-z0"')+'>'+(n(a.due)>0?B(a.due):'—')+'</td>'
        +'<td class="c"><span class="dr-tag" style="background:'+dc[2]+';color:'+dc[1]+'">'+dc[0]+'</span></td></tr>';
    }).join('');
    return '<div class="dr-kpis">'+kp+'</div>'
     +'<div class="dr-main"><div class="dr-col">'
       +'<div class="eg p6"><div class="dr-hd"><div><h2>รายได้แยกตามช่องทางชำระ</h2>'
         +'<p>สัดส่วนยอดเงินตามวิธีที่ agent ชำระ</p></div><span class="dr-chip e">'+B(M.rev)+'</span></div>'
         +(chBars||'<div class="dr-empty">ไม่มีรายได้ในวันนี้</div>')+'</div>'
       +'<div class="eg p6"><div class="dr-hd"><div><h2>รายได้แยกตามเส้นทาง</h2>'
         +'<p>ยอดเงินและรายได้เฉลี่ยต่อหัวของแต่ละโปรแกรม</p></div></div>'
         +'<div style="overflow-x:auto"><table class="dr-tbl"><thead><tr><th>Route</th><th class="c">Booking</th>'
         +'<th class="c">Pax</th><th class="r">รายได้</th><th class="r">เฉลี่ย/คน</th><th class="c">สัดส่วน</th></tr></thead>'
         +'<tbody>'+(rbody||'<tr><td colspan="6" class="dr-empty">ไม่มีข้อมูล</td></tr>')+'</tbody></table></div></div>'
     +'</div><div class="dr-col">'
       +'<div class="eg p6"><div class="dr-hd"><div><h2 class="sm">สรุปเงินเข้า-ออก</h2></div><span class="rt">ประมาณการวันนี้</span></div>'
         +tile('gr','รายได้รวม', B(M.rev),'<span class="dr-chip e">+ เข้า</span>')
         +tile('','ขายเพิ่มหน้างาน', B(M.extras),'<span class="dr-chip p">+ upsell</span>')
         +tile('warn','ค่ารถรับส่ง','-'+B(M.vanCost),'<span class="dr-chip r">- ออก</span>')
         +(M.ltCost?tile('warn','เรือหางยาวเหมา','-'+B(M.ltCost),'<span class="dr-chip r">- ออก</span>'):'')
         +tile('acc','คงเหลือก่อนต้นทุนเรือ/ครัว','<span style="font-size:17px">'+B(M.net)+'</span>','')
         +'<p style="font-size:10.5px;color:var(--df);margin:12px 0 0;line-height:1.6">'
         +'* ยังไม่รวมน้ำมัน · ค่าอุทยาน · อาหาร · ค่าไกด์/ลูกเรือ ซึ่งคิดจากสูตรต้นทุนของแต่ละเส้นทาง</p></div>'
       +'<div class="dr-ins g2"><div class="blob1"></div><div class="blob2"></div><div class="z">'
         +'<div class="tp"><span class="cp">&#128176; การเงินวันนี้</span></div>'
         +'<h3>'+(M.due>0?('ยังเก็บเงินหน้างานไม่ครบ '+B(M.due)):'เก็บเงินหน้างานครบแล้ว')+'</h3>'
         +'<p>'+(M.due>0?('มี booking ที่ต้องเก็บหน้าท่า เก็บไปแล้ว <b>'+B(M.got)+'</b> · เหลือ <b>'+B(M.due)+'</b>'):'ยอดที่ต้องเก็บหน้าท่าเคลียร์ครบ')
         +(M.noSlip?(' และมี <b>'+M.noSlip+' รายการยังไม่มีสลิป</b> ต้องตามให้ครบก่อนปิดวัน ไม่งั้นกระทบยอดกับ statement ไม่ได้'):'')+'</p></div></div>'
     +'</div></div>'
     +'<div class="eg p6"><div class="dr-hd"><div><h2>รายละเอียดตาม Agent</h2>'
       +'<p>Market · จำนวนคน · ช่องทางชำระ · ยอดเงิน · สถานะเอกสาร</p></div>'
       +'<span class="dr-chip n">'+M.agents.length+' agent · '+M.bookings+' booking</span></div>'
       +'<div style="overflow-x:auto"><table class="dr-tbl"><thead><tr>'
       +'<th>Agency / Source</th><th>Market</th><th class="c">AD</th><th class="c">CHD</th><th class="c">INF</th>'
       +'<th class="c">FOC</th><th class="c">Pax</th><th>Payment</th><th class="r">Amount</th><th class="r">ต้องเก็บ</th>'
       +'<th class="c">เอกสาร</th></tr></thead><tbody>'
       +(abody||'<tr><td colspan="11" class="dr-empty">ไม่มี booking ในวันนี้</td></tr>')+'</tbody></table></div>'
       +'<div class="dr-sum"><div class="l">'
         +chOn.map(function(c){ return '<span>'+e(c[1].split(' · ')[0])+' <b>'+B(M.pay[c[0]])+'</b></span>'; }).join('')
         +(M.due>0?('<span>ต้องเก็บหน้างาน <b style="color:#be123c">'+B(M.due)+'</b></span>'):'')+'</div>'
       +'<div class="r"><span>รายได้รวมทั้งวัน</span><b>'+B(M.rev)+'</b></div></div></div>';
  }

  /* ── the page frame: legacy renderDailyReport's own header ── */
  function frame(date, tab, pane){
    var e = esc, dNice = date;
    try{ dNice = new Date(date + 'T12:00:00').toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }catch(_){}
    var tabs = window.DR_TABS || [['ov','ภาพรวม'],['px','ผู้โดยสาร'],['bt','เรือ'],['vn','รถรับส่ง'],['fi','การเงิน']];
    return '<style id="dr-style">'+(typeof window.drCSS === 'function' ? window.drCSS() : '')+'</style><div class="dr-wrap" data-ops-dr="1">'
      +'<div class="dr-bar dr-noprint"><div style="display:flex;align-items:center;gap:22px;overflow:auto">'
        +'<div class="dr-brand"><div class="dr-logo">L</div><b>LOVE Andaman</b></div>'
        +'<div class="dr-pills">'+tabs.map(function(t){ return '<button class="dr-pill'+(t[0]===tab?' on':'')+'" onclick="drTab(\''+t[0]+'\')">'+e(t[1])+'</button>'; }).join('')
        +'</div></div></div>'
      +'<div class="dr-title"><div><h1>Daily Report</h1>'
        +'<p><span class="dr-live"></span>สรุปก่อนวันเดินทาง · '+e(dNice)+'</p></div>'
        +'<div class="dr-ctl dr-noprint">'
          +'<button class="dr-btn" onclick="drDateShift(-1)">&#8249; วันก่อน</button>'
          +'<button class="dr-btn" onclick="drToday()">วันนี้</button>'
          +'<button class="dr-btn" onclick="drDateShift(1)">วันถัดไป &#8250;</button>'
          +'<input type="date" class="dr-btn" value="'+e(date)+'" onchange="drPickDay(this.value)">'
          +'<button class="dr-btn" onclick="drPrint()">&#128424; พิมพ์ / PDF</button>'
          +'<button class="dr-btn pri" onclick="drMailShow()">&#9993; ส่งอีเมล</button>'
        +'</div></div>'
      +pane+'</div><div id="dr-mail-host"></div>';
  }
  function html(date, tab, x){
    var M = model(date, x);
    var P7 = x.p7 ? model(shift(date, -7), x.p7) : null;
    var pane = tab === 'px' ? panePx(M, x.roster ? rowsOf(date, x.roster, M) : null)
             : tab === 'bt' ? paneBt(M) : tab === 'vn' ? paneVn(M) : tab === 'fi' ? paneFi(M)
             : paneOv(M, x.trend || { pts: [], keys: [], mkt: {} }, P7);
    return frame(date, tab, pane);
  }

  /* What each tab reads. Only the overview reads 7 days back and the 14-day trend. */
  function load(date, tab){
    var mode = window._drTrendMode === 'booked' ? 'booked' : 'travel';
    var need = { daily: day(date) };
    /* the pier-office / deployments / van-board join only stands in while the report has no ops block (B16) */
    var hasOps = function(d, k){ return !!(d && d.ops && d.ops[k]); };
    var boatsFor = function(ds){ return day(ds).then(function(d){ return hasOps(d, 'boats') ? null : boatsRaw(ds); }); };
    if(tab === 'ov' || tab === 'bt') need.boats = boatsFor(date);
    if(tab === 'vn') need.vj = vanJobs(date);                 // the day's driver per van
    if(tab === 'ov') need.vj = day(date).then(function(d){ return hasOps(d, 'vans') ? null : vanJobs(date); });
    if(tab === 'px') need.roster = roster(date);
    if(tab === 'vn') need.vanList = vanList();
    if(tab === 'ov'){
      var d7 = shift(date, -7);
      need.trend = trend(date, mode);
      need.p7 = Promise.all([day(d7), boatsFor(d7)]).then(function(r){ return { daily: r[0], boats: r[1] }; });
    }
    var keys = Object.keys(need);
    return Promise.all(keys.map(function(k){ return need[k]; })).then(function(vals){
      var x = {}; keys.forEach(function(k, i){ x[k] = vals[i]; }); return x;
    });
  }

  function wrap(name, fn){
    var orig = window[name]; if(typeof orig !== 'function' || orig.__opsDailyReport) return;
    var w = function(){ return fn.apply(this, [orig].concat([].slice.call(arguments))); };
    w.__opsDailyReport = true; window[name] = w;
  }
  wrap('renderDailyReport', function(orig){
    if(!enabled()) return orig.apply(this, [].slice.call(arguments, 1));
    var host = document.getElementById('dailyreport-host'); if(!host) return;
    var date = dateOf(typeof _drDate !== 'undefined' ? _drDate : null);
    var tab = (typeof _drTab !== 'undefined' && /^(ov|px|bt|vn|fi)$/.test(_drTab)) ? _drTab : 'ov';
    var my = ++gen;
    var p = load(date, tab);
    var painted = false;
    var done = p.then(function(x){ if(my !== gen) return; painted = true; host.innerHTML = html(date, tab, x); },
      function(e){
        if(my !== gen) return;
        O.fail('Daily Report did not load', e);
        host.innerHTML = frame(date, tab, '<div class="dr-empty" data-ops-dr-error="1">Daily Report did not load from operation-backend.</div>');
      });
    if(!painted && !host.querySelector('[data-ops-dr]')) host.innerHTML = O.loadingHtml('Loading Daily Report…');
    return done;
  });
  /* No server endpoint sends or composes the Daily Report e-mail yet; the legacy form would fill
     itself from the browser's own booking list, so it does not open here. */
  wrap('drMailShow', function(orig){
    if(!enabled()) return orig.apply(this, [].slice.call(arguments, 1));
    O.toast({ kind: 'pending', title: 'Email not available yet', sub: 'operation-backend has no Daily Report send endpoint', dur: 7000 });
  });

  O.onWrite(function(){ cache = {}; });
  window.laOps.dailyReport = { model: model, html: html, load: load, rowsOf: rowsOf, boatsOf: boatsOf, vansOf: vansOf, clear: function(){ cache = {}; } };
})();
