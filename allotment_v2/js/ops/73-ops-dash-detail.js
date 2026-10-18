/* ══════════════════════════════════════════════════════════════════════════
   §opsDashDetail (w4-f1, 2026-10-18) · Dashboard "รายละเอียดทั้งวัน" popup + Live bookings header ⇄ the server
   ──────────────────────────────────────────────────────────────────────────
   Server: GET /v1/dashboard/day-detail?from=&to=  (operation-backend todo/b1-sales-dashboard-model.md)
           GET /v1/bookings/recent?created_from=&created_to=&source=   → summary (the feed header)

   Legacy added the popup up in the browser from the bookings it happened to hold (_ddRows → _ddSum / _ddAgg /
   _ddDaily / _ddHours / _ddExecData, with _ddMix and _ddBE for the break-even of every route-day). Now the server
   answers all of it for the picked range; the legacy functions keep drawing, they just take the figures from the
   answer (the same idea as 60-ops-dashboard.js):

     _ddSum         the six figures on each B2C / B2B card      ← b2c.summary / b2b.summary
     _ddSideBlock   route, agent/channel, travel month, nationality bars (_ddAgg) and the keyed-time bars
                    (_ddDaily / _ddHours) ← by_route, by_who, by_travel_month, by_nationality, by_created
     _ddHeadHtml    the three header chips                           ← the sums of by_route of both sides
     _ddExecData    the Executive Summary data (top agents/route, travel dates, 7-day grid, break-even)
                                                                     ← totals, top_agents, top_route, travel, executive
     _ddMix, _ddBE  not called any more in ops mode (the server works the break-even of every route-day out)
     _dashLiveFeedHtml  the header of the Live bookings card (count, pax, money, agents/average, not-counted)
                                                                     ← recent … summary
   The booking ROWS (the list under the bars, the 12 live cards) are still bookings read from the server; they are
   rows, not figures. Until the answer arrives (and when offline) legacy's own sums stay on screen.
   Differences from legacy are listed in docs/walk/w4-f1.md. Classic script, after 04-data-core.js and 73-ops-srv-reads.js.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O || !O.srv) return;
  function on(){ return !!(O.enabled && O.enabled()); }
  function n(v){ return Number.isFinite(+v) ? +v : 0; }

  function wrap(name, fn){
    var orig = window[name];
    if(typeof orig !== 'function' || orig.__w4f1) return;
    var w = function(){
      var args = [].slice.call(arguments);
      if(!on()) return orig.apply(this, args);
      return fn.apply(this, [orig].concat(args));
    };
    w.__w4f1 = true; w.__orig = orig; window[name] = w;
  }

  /* ── the answer for the range on screen ─────────────────────────────────── */
  function repaint(){
    if(document.getElementById('dv-ddbd') && typeof window._ddPaint === 'function') window._ddPaint();
  }
  function range(){ return (typeof window._ddRg === 'function') ? window._ddRg() : null; }
  function detail(){
    var rg = range(); if(!rg) return null;
    return O.srv.read('dd|' + rg.from + '|' + rg.to, '/v1/dashboard/day-detail', { from: rg.from, to: rg.to }, repaint);
  }
  /* the answer, only when it is for the range now on screen */
  function now(){ var j = detail(); var rg = range(); return (j && rg && j.from === rg.from && j.to === rg.to) ? j : null; }

  wrap('_ddPaint', function(orig){ detail(); return orig.apply(this, [].slice.call(arguments, 1)); });
  /* _ddPaint is assigned as window._ddPaint in 04-data-core.js (not a declaration); same thing for the wrap */

  /* ── the two cards ──────────────────────────────────────────────────────── */
  wrap('_ddSum', function(orig, rows, side){
    var j = now(), s = j && j[side] && j[side].summary;
    if(!s) return orig.apply(this, [].slice.call(arguments, 1));
    return { n: n(s.bookings), pax: n(s.pax), val: n(s.value), avg: n(s.average), free: n(s.internal_free), ag: n(s.agents), cxl: n(s.cancelled) };
  });

  /* ── the four bars of one side + the keyed-time bars ───────────────────── */
  var ctx = null;   // { side, j } while _ddSideBlock runs
  function dimOf(keyFn){
    /* _ddAgg is given a different key function for each bar; tell them apart with a row that has a distinct
       value in every field, so the code does not depend on the order legacy calls them in */
    try{
      var k = keyFn({ trips: [{ route: 'ROUTE', date: '2000-01-02' }], channel: 'CHAN', agent: 'AGENT', nat: 'NAT' });
      if(k === 'ROUTE') return 'by_route';
      if(k === '2000-01') return 'by_travel_month';
      if(k === 'CHAN' || k === 'AGENT') return 'by_who';
      if(k === 'NAT') return 'by_nationality';
    }catch(_){}
    return '';
  }
  wrap('_ddAgg', function(orig, rows, keyFn, colFn){
    var args = [].slice.call(arguments, 1);
    if(!ctx) return orig.apply(this, args);
    var dim = dimOf(keyFn), list = dim && ctx.j[ctx.side] && ctx.j[ctx.side][dim];
    if(!Array.isArray(list)) return orig.apply(this, args);
    return list.map(function(x){
      return { k: x.key, n: n(x.n), pax: n(x.pax), val: n(x.value),
               col: (x.color && typeof window._dvInk === 'function') ? window._dvInk(x.color) : '' };
    });
  });
  function bars(list, keys, label){
    var mx = 1; keys.forEach(function(k){ if((list[k] || 0) > mx) mx = list[k]; });
    var out = '', every = Math.max(1, Math.ceil(keys.length / 8));
    keys.forEach(function(k, i){
      var v = list[k] || 0;
      out += '<span class="dv-ddhb' + (v ? '' : ' z') + '" title="' + label(k) + ' · ' + laTp('{0} ใบ', v) + '">'
        + '<i style="height:' + (v ? Math.max(8, Math.round(v / mx * 100)) : 2) + '%"></i>'
        + '<u>' + (i % every === 0 ? k.slice(k.length === 2 ? 0 : 8) : '') + '</u></span>';
    });
    return '<div class="dv-ddhr">' + out + '</div>';
  }
  function created(){
    var m = {}; (ctx.j[ctx.side].by_created || []).forEach(function(x){ m[x.key] = n(x.n); });
    return m;
  }
  wrap('_ddDaily', function(orig, rows, rg){
    if(!ctx || !ctx.j[ctx.side] || !Array.isArray(ctx.j[ctx.side].by_created)) return orig.apply(this, [].slice.call(arguments, 1));
    var m = created(), ks = [], d = rg.from;
    while(d <= rg.to && ks.length < 400){ ks.push(d); d = window._ddAddDays(d, 1); }
    return bars(m, ks, function(k){ return k; });
  });
  wrap('_ddHours', function(orig, rows){
    if(!ctx || !ctx.j[ctx.side] || !Array.isArray(ctx.j[ctx.side].by_created)) return orig.apply(this, [].slice.call(arguments, 1));
    var m = created(), ks = [];
    for(var i = 6; i <= 23; i++) ks.push(('0' + i).slice(-2));
    var mx = 1; ks.forEach(function(k){ if((m[k] || 0) > mx) mx = m[k]; });
    var out = '';
    ks.forEach(function(k, ix){
      var v = m[k] || 0, h = 6 + ix;
      out += '<span class="dv-ddhb' + (v ? '' : ' z') + '" title="' + k + ':00 · ' + laTp('{0} ใบ', v) + '">'
        + '<i style="height:' + (v ? Math.max(8, Math.round(v / mx * 100)) : 2) + '%"></i>'
        + '<u>' + (h % 3 === 0 ? k : '') + '</u></span>';
    });
    return '<div class="dv-ddhr">' + out + '</div>';
  });
  wrap('_ddSideBlock', function(orig, rows, side){
    var j = now(), args = [].slice.call(arguments, 1);
    if(!j || !j[side]) return orig.apply(this, args);
    ctx = { side: side, j: j };
    try{ return orig.apply(this, args); } finally { ctx = null; }
  });

  /* ── header chips: the sums of the bars (they list the company-free bookings too, as legacy's rows did) ─────── */
  wrap('_ddHeadHtml', function(orig){
    var html = orig.apply(this, [].slice.call(arguments, 1)), j = now();
    if(!j || typeof html !== 'string') return html;
    var cnt = 0, pax = 0, val = 0;
    ['b2c', 'b2b'].forEach(function(s){ ((j[s] && j[s].by_route) || []).forEach(function(x){ cnt += n(x.n); pax += n(x.pax); val += n(x.value); }); });
    var cxl = n(j.totals && j.totals.cancelled), rg = range();
    var money = (typeof window._dashMoneyShort === 'function') ? window._dashMoneyShort(val) : String(Math.round(val));
    html = html.replace(/(<span class="dv-chip"><b>)\d+(<\/b> [^<]*<\/span>)/, '$1' + cnt + '$2');
    html = html.replace(/(<span class="dv-chip"><b>)\d+(<\/b> pax<\/span>)/, '$1' + pax + '$2');
    html = html.replace(/(<span class="dv-chip money"><b>)[^<]*(<\/b>)/, '$1' + money + '$2');
    var chip = '<span class="dv-chip warn"><b>' + cxl + '</b> ' + laT('ยกเลิก') + '</span>';
    if(/<span class="dv-chip warn">/.test(html)) html = cxl ? html.replace(/<span class="dv-chip warn">.*?<\/span>/, chip) : html.replace(/<span class="dv-chip warn">.*?<\/span>/, '');
    else if(cxl) html = html.replace('<button class="dv-ddx"', chip + '<button class="dv-ddx"');
    return html;
  });

  /* ── Executive Summary data ─────────────────────────────────────────────── */
  function cellOf(c){
    return { d: c.date, rid: c.route_id, cap: n(c.capacity), bk: n(c.booked), av: n(c.available), pct: n(c.fill_percent),
             be: c.break_even == null ? null : n(c.break_even), need: c.need == null ? null : n(c.need), boats: n(c.boats),
             plus: n(c.keyed), wx: c.state === 'wx', price: n(c.price), never: c.state === 'never', st: c.state };
  }
  function line(g){ return g.top_routes.map(function(x){ return x.route + ' ' + x.n; }); }
  wrap('_ddExecData', function(orig, rows, rg){
    var j = now(), ex = j && j.executive;
    if(!j || !ex) return orig.apply(this, [].slice.call(arguments, 1));
    var sum = function(side){ var s = j[side].summary; return { n: n(s.bookings), pax: n(s.pax), val: n(s.value), avg: n(s.average), free: n(s.internal_free), ag: n(s.agents), cxl: n(s.cancelled) }; };
    var S = { b2c: sum('b2c'), b2b: sum('b2b') };
    var agg = function(x){ return x ? { k: x.key, n: n(x.n), pax: n(x.pax), val: n(x.value), col: (x.color && window._dvInk) ? window._dvInk(x.color) : '' } : null; };
    var topAgs = (j.top_agents || []).map(agg);
    /* travel dates */
    var DL = window._ddDLbl, ML = window._ddMoLbl;
    var travel = [], travelM = [], monthOf = {};
    (j.travel.groups || []).forEach(function(g){
      var first = g.kind === 'by_end', soon = g.kind === 'day';
      var k = first ? ('<' + rg.to) : g.key;
      var lbl = first ? ('By ' + DL(rg.to, true)) : (soon ? DL(g.key, true) : ML(g.key));
      var sub = first ? 'travels today or earlier' : (soon ? (g.key === window._ddAddDays(rg.to, 1) ? 'tomorrow' : '') : '');
      travel.push({ k: k, lbl: lbl, sub: sub, soon: soon, n: n(g.n), pax: n(g.pax), b2b: n(g.b2b), b2c: n(g.b2c), rts: line(g) });
      /* the two-layer list: a month head with its days under it. The server serves the next 7 days one by one and
         later months as one total, so a later month has no day rows */
      var mk = first ? '<' : g.key.slice(0, 7);
      var M = monthOf[mk];
      if(!M){ M = monthOf[mk] = { k: mk, lbl: first ? ('By ' + DL(rg.to, true)) : ML(mk), n: 0, pax: 0, b2b: 0, b2c: 0, soon: false, days: [], rt: {} }; travelM.push(M); }
      M.n += n(g.n); M.pax += n(g.pax); M.b2b += n(g.b2b); M.b2c += n(g.b2c);
      g.top_routes.forEach(function(x){ M.rt[x.route] = (M.rt[x.route] || 0) + n(x.n); });
      if(soon) M.soon = true;
      if(first || soon) M.days.push({ k: k, lbl: first ? 'today or earlier' : DL(g.key, true), sub: sub, soon: soon, n: n(g.n), pax: n(g.pax), b2b: n(g.b2b), b2c: n(g.b2c), rts: line(g) });
    });
    travelM.forEach(function(M){
      M.rts = Object.keys(M.rt).sort(function(a, b){ return M.rt[b] - M.rt[a]; }).slice(0, 3).map(function(x){ return x + ' ' + M.rt[x]; });
      M.open = M.soon || M.k === '<';
    });
    var w7 = { n: n(j.travel.next7 && j.travel.next7.bookings), pax: n(j.travel.next7 && j.travel.next7.pax) };
    var peak = null; travel.forEach(function(t){ if(t.k === j.travel.peak) peak = t; });
    var later = { n: n(j.travel.later_bookings), months: travel.filter(function(t){ return !t.soon && t.k.charAt(0) !== '<'; }).map(function(t){ return t.lbl; }) };
    /* the 7-day grid */
    var cells = {}, all = (ex.cells || []).map(cellOf);
    all.forEach(function(c){ cells[c.d + '|' + c.rid] = c; });
    var pick = function(list){ return (list || []).map(cellOf); };
    var T = ex.totals || {};
    var tot = { cap: n(T.capacity), bk: n(T.booked), av: n(T.available), need: n(T.need), short: pick(T.short), full: pick(T.full), near: pick(T.near),
                idle: pick(T.idle), wx: pick(T.weather), never: pick(T.never), unk: pick(T.unknown) };
    var colTot = {};
    (ex.by_day || []).forEach(function(d){ colTot[d.date] = { cap: n(d.capacity), bk: n(d.booked), av: n(d.available), need: n(d.need), n: n(d.trips), unk: n(d.unknown), idle: n(d.idle), never: n(d.never) }; });
    var routes = (ex.routes || []).map(function(r){
      return { rid: r.route_id, name: r.name, color: r.color || '#7d7a74', pier: r.pier || '', never: !!r.never,
               pierNm: (typeof VB_PIER_TH !== 'undefined' && VB_PIER_TH[r.pier]) ? VB_PIER_TH[r.pier] : (r.pier || ''),
               be: r.break_even_avg == null ? null : n(r.break_even_avg) };
    });
    var goodIds = {}; (ex.good_routes || []).forEach(function(id){ goodIds[id] = 1; });
    var tt = j.totals || {};
    return { n: n(tt.bookings), pax: n(tt.pax), val: n(tt.value), S: S, topAg: topAgs[0] || null, topAgs: topAgs, topRt: agg(j.top_route),
             travel: travel, travelM: travelM, w7: w7, peak: peak, later: later, days: ex.days.slice(), cells: cells, routes: routes,
             colTot: colTot, tot: tot, good: routes.filter(function(r){ return goodIds[r.rid]; }) };
  });

  /* ── Live bookings card header (legacy _dashLiveFeedHtml) ─────────────────── */
  function feedDay(){ return window._dashDate || (typeof TODAY_STR === 'string' ? TODAY_STR : O.today()); }
  function feedRepaint(){
    if(O.activeView() === 'dashboard' && !O.busy() && typeof window.renderDash === 'function') window.renderDash();
  }
  wrap('_dashLiveFeedHtml', function(orig, dx, F, side){
    var html = orig.apply(this, [].slice.call(arguments, 1));
    var d = feedDay(), q = { created_from: d, created_to: d, limit: 1 };
    if(side === 'b2b' || side === 'b2c') q.source = side;
    var j = O.srv.read('feed|' + d + '|' + (side || ''), '/v1/bookings/recent', q, feedRepaint);
    var s = j && j.summary;
    if(!s || typeof html !== 'string') return html;
    var short = function(v){ v = +v || 0; return v >= 1000000 ? ('฿' + (v / 1000000).toFixed(1) + 'M') : (v >= 1000 ? ('฿' + Math.round(v / 1000) + 'k') : ('฿' + Math.round(v))); };
    var a = html.indexOf('<div class="dv-lvhd"'), b = html.indexOf('<div class="dv-lvlist">');
    if(a < 0 || b < 0 || b < a) return html;
    var head = html.slice(a, b);
    var cell = function(lbl, val){   // replace the number of the chip whose caption is lbl
      var re = new RegExp('(<b[^>]*>)[^<]*(</b><i>' + lbl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '</i>)');
      head = head.replace(re, '$1' + val + '$2');
    };
    cell(laT('ใบวันนี้'), n(s.bookings));
    cell('pax', n(s.pax));
    cell(laT('ยอดวันนี้'), short(s.value));
    if(side === 'b2c') cell(laT('เฉลี่ย / ใบ'), short(s.average)); else cell(laT('เอเย่นต์'), n(s.agents));
    /* the "not counted" chip: add it, change it or take it away to match the server's count */
    var free = n(s.internal_free), noteRe = new RegExp('<span class="s" title="[^"]*"><b class="dim">\\d+</b><i>' + laT('ไม่นับยอด').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '</i></span><span class="sep"></span>');
    if(noteRe.test(head)){
      head = free ? head.replace(/(<b class="dim">)\d+(<\/b><i>)/, '$1' + free + '$2') : head.replace(noteRe, '');
    } else if(free){
      var chip = '<span class="s" title="' + laT('ใบของบริษัทเองที่ไม่เก็บเงิน · ยังอยู่ในรายการและยังกินที่นั่ง แต่ไม่นับเป็นยอดขาย').replace(/"/g, '&quot;')
        + '"><b class="dim">' + free + '</b><i>' + laT('ไม่นับยอด') + '</i></span><span class="sep"></span>';
      var at = head.lastIndexOf('<span class="s"><b>');
      if(at > 0) head = head.slice(0, at) + chip + head.slice(at);
    }
    return html.slice(0, a) + head + html.slice(b);
  });
})();
