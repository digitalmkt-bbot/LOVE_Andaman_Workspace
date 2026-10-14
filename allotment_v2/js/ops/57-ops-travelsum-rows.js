/* ══════════════════════════════════════════════════════════════════════════
   §opsTravelRows · Travel Summary scope chips ⇄ operation-backend rows
   ──────────────────────────────────────────────────────────────────────────
   The server's GET /v1/reports/travel-summary answers one set of day totals plus
   money rows (collect_rows). Legacy also let staff scope the sheet by pier and route
   and gave it a document number. Those scopes are rebuilt here from server rows:

     GET /v1/bookings?service_date=D&limit=5000   the day's roster (route, agent per booking)

   Chips reuse the legacy handlers (tsPickPier / tsPickRoute) and globals (_tsPier,
   _tsRoute), which re-enter renderTravelSum (wrapped by 33-ops-money-reports.js). This
   file owns no screen: 33 calls laOps.travelRows.view(summary) while it renders.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var DEAD = ['cancelled','cancelled_weather','rejected'];
  var cache = {}, loading = {};

  function text(v){ return v == null ? '' : String(v); }
  function esc(v){ return text(v).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function n(v){ return Number.isFinite(+v) ? +v : 0; }
  function money(v){ return '฿' + Math.round(n(v)).toLocaleString('en-US'); }
  function g(name){ return typeof window[name] === 'function' ? window[name] : null; }

  /* ── The day's roster, from the server's booking list ── */
  function rosterOf(date, bookings){
    var out = [];
    (bookings || []).forEach(function(b){
      if(!b || DEAD.indexOf(b.status) >= 0) return;
      var t = (b.trips || []).filter(function(x){ return x && x.service_date === date; })[0];
      if(!t) return;
      out.push({ id: b.id, voucher: b.voucher_ref || b.code || b.id, agentId: b.agent_id || '', routeId: t.route_id || '', b: b, t: t });
    });
    return out;
  }
  function fetchAll(date){
    var all = [];
    function page(cursor){
      var q = { service_date: date, limit: 5000 }; if(cursor) q.cursor = cursor;
      return O.get('/v1/bookings', q).then(function(res){
        res = res || {};
        all = all.concat(Array.isArray(res.bookings) ? res.bookings : []);
        return res.next_cursor ? page(res.next_cursor) : all;
      });
    }
    return page(null);
  }
  function load(date){
    if(cache[date]) return Promise.resolve(cache[date]);
    if(loading[date]) return loading[date];
    var p = fetchAll(date).then(function(list){
      var r = { date: date, rows: rosterOf(date, list) };
      cache[date] = r; delete loading[date]; return r;
    }, function(e){ delete loading[date]; throw e; });
    loading[date] = p; return p;
  }

  /* ── Scope state: the legacy globals, so the legacy chip handlers keep working ── */
  function state(){
    return { pier: text(window._tsPier), route: text(window._tsRoute), vat: text(window._tsVatF) };
  }
  function pierOf(routeId){ var f = g('tsPierOf'); return f ? f(routeId) : 'other'; }
  function pierName(p){ var f = g('tsPierName'); return f ? f(p) : (p || 'Other'); }
  function routeName(id){ var f = g('tsRouteName'); return f ? f(id) : (id || '—'); }
  function scopeKeep(st, routeId){
    if(st.route) return routeId === st.route;
    if(st.pier) return pierOf(routeId) === st.pier;
    return true;
  }
  function docNo(date, st){
    return 'TS-' + text(date).replace(/-/g, '') + (st.route ? '-' + st.route.toUpperCase() : st.pier ? '-' + st.pier.toUpperCase() : '-ALL');
  }

  var CHIP = 'border:0.5px solid var(--fd-line-soft);border-radius:999px;padding:4px 11px;font-size:11px;cursor:pointer;background:#fff;color:var(--fd-ink)';
  var CHIP_ON = 'border:0.5px solid #1683C7;border-radius:999px;padding:4px 11px;font-size:11px;cursor:pointer;background:#1683C7;color:#fff';
  function chip(label, count, on, handler){
    return '<button type="button" style="' + (on ? CHIP_ON : CHIP) + '" onclick="' + handler + '">' + esc(label) + ' <b>' + count + '</b></button>';
  }

  /* The pier and route chips + the document number, from the whole day's roster. */
  function scopeChips(roster, st, date){
    var pMap = {}, pOrder = [], rMap = {}, rOrder = [];
    roster.rows.forEach(function(r){
      var k = r.routeId, pk = pierOf(k);
      if(!rMap[k]){ rMap[k] = 0; rOrder.push(k); }
      if(!pMap[pk]){ pMap[pk] = 0; pOrder.push(pk); }
      rMap[k]++; pMap[pk]++;
    });
    var ORDER = ['panwa','tublamu','ranong'];
    pOrder.sort(function(a, b){ var i = ORDER.indexOf(a), j = ORDER.indexOf(b); return (i < 0 ? (a === 'other' ? 9 : 8) : i) - (j < 0 ? (b === 'other' ? 9 : 8) : j); });
    var pierHtml = pOrder.map(function(p){ return chip(pierName(p), pMap[p], st.pier === p, "tsPickPier('" + esc(p) + "')"); }).join(' ');
    var inPier = rOrder.filter(function(k){ return !st.pier || pierOf(k) === st.pier; });
    var routeHtml = inPier.map(function(k){ return chip(routeName(k), rMap[k], st.route === k, "tsPickRoute('" + esc(k) + "')"); }).join(' ');
    return '<div data-ops-ts-scope="1" style="margin-bottom:16px;background:#fff;border:0.5px solid var(--fd-line-soft);border-radius:12px;padding:12px 15px">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px"><div style="font-size:10.5px;color:var(--fd-ink-soft);text-transform:uppercase;letter-spacing:.05em;font-weight:600">Scope · pier › route</div>'
      + '<div data-ops-ts-docno="1" style="font-family:\'DM Mono\',monospace;font-size:11.5px;color:var(--fd-ink)">Doc no. ' + esc(docNo(date, st)) + '</div></div>'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:' + (routeHtml ? '8' : '0') + 'px">' + pierHtml + '</div>'
      + (routeHtml ? '<div style="display:flex;gap:6px;flex-wrap:wrap">' + routeHtml + '</div>' : '') + '</div>';
  }

  /* The money rows of the chosen scope, summed the way the server sums its own totals:
     a row not counted (cancelled or no-show on the day) adds no target or due. */
  function subtotal(rows){
    var s = { n: 0, target: 0, paid: 0, due: 0, cot: 0 };
    rows.forEach(function(r){
      s.n++; s.paid += n(r.paid); s.cot += n(r.cot);
      if(!r.not_counted){ s.target += n(r.target); s.due += n(r.due); }
    });
    return s;
  }
  function subtotalHtml(rows, st, date){
    var s = subtotal(rows);
    var label = st.route ? routeName(st.route) : st.pier ? pierName(st.pier) : 'All';
    function c(t, v){ return '<div style="flex:1;min-width:120px"><div style="font-size:10px;color:var(--fd-ink-soft);text-transform:uppercase;letter-spacing:.05em">' + esc(t) + '</div><div style="font-size:17px;font-weight:700;font-variant-numeric:tabular-nums">' + v + '</div></div>'; }
    return '<div data-ops-ts-subtotal="1" style="margin-bottom:16px;background:#f4f9fd;border:0.5px solid #cfe3f3;border-radius:12px;padding:12px 15px">'
      + '<div style="font-size:11.5px;font-weight:600;margin-bottom:8px">Money in this selection · ' + esc(label) + ' · ' + s.n + ' booking' + (s.n === 1 ? '' : 's') + '</div>'
      + '<div style="display:flex;gap:12px;flex-wrap:wrap">' + c('To collect', money(s.target)) + c('Paid', money(s.paid)) + c('Due', money(s.due)) + c('Cash on tour', money(s.cot)) + '</div>'
      + '<div style="margin-top:8px;font-size:10.5px;color:var(--fd-ink-soft)">The cards at the top are the whole day: the server returns head counts for the day only.</div></div>';
  }

  /* What 33 renders: the money rows to show, plus the blocks around them. null = no roster, show the day. */
  function view(d){
    var roster = d && d._roster; if(!roster) return null;
    var date = d.date, st = state();
    if(st.route && !roster.rows.some(function(r){ return r.routeId === st.route; })){ st.route = ''; window._tsRoute = ''; }
    if(st.route){ st.pier = pierOf(st.route); window._tsPier = st.pier; }
    if(st.pier && !roster.rows.some(function(r){ return pierOf(r.routeId) === st.pier; })){ st.pier = ''; window._tsPier = ''; }
    var keep = {};
    roster.rows.forEach(function(r){ if(scopeKeep(st, r.routeId)) keep[r.id] = true; });
    var scoped = !!(st.pier || st.route);
    var rows = (d.collect_rows || []).filter(function(r){ return !scoped || keep[r.booking_id]; });
    var html = scopeChips(roster, st, date) + (scoped ? subtotalHtml(rows, st, date) : '');
    return { rows: rows, html: html, state: st, docNo: docNo(date, st) };
  }

  O.onWrite(function(){ cache = {}; });
  window.laOps.travelRows = { load: load, view: view, rosterOf: rosterOf, docNo: docNo, clear: function(){ cache = {}; loading = {}; } };
})();
