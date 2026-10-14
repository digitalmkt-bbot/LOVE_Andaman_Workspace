/* ══════════════════════════════════════════════════════════════════════════
   §opsTravelRows · Travel Summary scope chips ⇄ operation-backend rows
   ──────────────────────────────────────────────────────────────────────────
   The server's GET /v1/reports/travel-summary answers one set of day totals plus
   money rows (collect_rows). Legacy also let staff scope the sheet by pier and route
   and gave it a document number. Those scopes are rebuilt here from server rows:

     GET /v1/bookings?service_date=D&limit=5000   the day's roster (route, agent, documents per booking)
     GET /v1/bookings/:id/pier-money?date=D       a booking's pier payments and on-tour sales, with their slips
     GET /v1/attachments/:id                      one file (opened on click; all of a pack in the print window)

   Chips reuse the legacy handlers (tsPickPier / tsPickRoute) and globals (_tsPier,
   _tsRoute), which re-enter renderTravelSum (wrapped by 33-ops-money-reports.js). This
   file owns no screen: 33 calls laOps.travelRows.view(summary) while it renders.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var DEAD = ['cancelled','cancelled_weather','rejected'];
  var cache = {}, loading = {}, slipCache = {}, slipBusy = {};

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
    return 'TS-' + text(date).replace(/-/g, '') + (st.route ? '-' + st.route.toUpperCase() : st.pier ? '-' + st.pier.toUpperCase() : '-ALL')
      + (st.vat ? (st.vat === 'vat' ? '-VAT' : '-NOVAT') : '');
  }

  /* ── VAT: the agent's own vatMode (include | exclude | none). No agent (walk-in) = no VAT. ── */
  function agentOf(id){ var f = g('sbGetAgent'); return id && f ? f(id) : null; }
  function vatMode(r){
    var a = r && r.agentId ? agentOf(r.agentId) : null;
    var m = a && a.vatMode;
    return m === 'include' || m === 'exclude' ? m : 'none';
  }
  function hasVat(r){ return vatMode(r) !== 'none'; }
  function vatKeep(st, r){ return !st.vat || (st.vat === 'vat' ? hasVat(r) : !hasVat(r)); }
  /* Agents with no VAT mode set fall into "no VAT" silently; name them so the totals are not trusted blindly. */
  function vatGap(rows){
    var seen = {}, out = [];
    rows.forEach(function(r){
      if(!r.agentId || seen[r.agentId]) return; seen[r.agentId] = 1;
      var a = agentOf(r.agentId); if(a && !a.vatMode) out.push(a.name || a.code || r.agentId);
    });
    return out;
  }

  var CHIP = 'border:0.5px solid var(--fd-line-soft);border-radius:999px;padding:4px 11px;font-size:11px;cursor:pointer;background:#fff;color:var(--fd-ink)';
  var CHIP_ON = 'border:0.5px solid #1683C7;border-radius:999px;padding:4px 11px;font-size:11px;cursor:pointer;background:#1683C7;color:#fff';
  function chip(label, count, on, handler){
    return '<button type="button" style="' + (on ? CHIP_ON : CHIP) + '" onclick="' + handler + '">' + esc(label) + ' <b>' + count + '</b></button>';
  }

  /* The pier and route chips + the document number, from the whole day's roster. */
  function scopeChips(roster, st, date, inScope){
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
    var nVat = 0, nNo = 0;
    inScope.forEach(function(r){ if(hasVat(r)) nVat++; else nNo++; });
    var gap = vatGap(inScope);
    var vatHtml = '<div data-ops-ts-vat="1" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:8px"><span style="font-size:10.5px;color:var(--fd-ink-soft);text-transform:uppercase;letter-spacing:.05em;font-weight:600">VAT</span>'
      + chip('With VAT', nVat, st.vat === 'vat', "tsPickVat('vat')") + chip('No VAT', nNo, st.vat === 'novat', "tsPickVat('novat')") + '</div>'
      + (gap.length ? '<div data-ops-ts-vatgap="1" style="margin-top:6px;font-size:10.5px;color:#8a6d1a">No VAT mode set for ' + esc(gap.join(', ')) + ': counted as No VAT.</div>' : '');
    return '<div data-ops-ts-scope="1" style="margin-bottom:16px;background:#fff;border:0.5px solid var(--fd-line-soft);border-radius:12px;padding:12px 15px">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px"><div style="font-size:10.5px;color:var(--fd-ink-soft);text-transform:uppercase;letter-spacing:.05em;font-weight:600">Scope · pier › route</div>'
      + '<div data-ops-ts-docno="1" style="font-family:\'DM Mono\',monospace;font-size:11.5px;color:var(--fd-ink)">Doc no. ' + esc(docNo(date, st)) + '</div></div>'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:' + (routeHtml ? '8' : '0') + 'px">' + pierHtml + '</div>'
      + (routeHtml ? '<div style="display:flex;gap:6px;flex-wrap:wrap">' + routeHtml + '</div>' : '') + vatHtml + '</div>';
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
    var label = (st.route ? routeName(st.route) : st.pier ? pierName(st.pier) : 'All') + (st.vat ? (st.vat === 'vat' ? ' · With VAT' : ' · No VAT') : '');
    function c(t, v){ return '<div style="flex:1;min-width:120px"><div style="font-size:10px;color:var(--fd-ink-soft);text-transform:uppercase;letter-spacing:.05em">' + esc(t) + '</div><div style="font-size:17px;font-weight:700;font-variant-numeric:tabular-nums">' + v + '</div></div>'; }
    return '<div data-ops-ts-subtotal="1" style="margin-bottom:16px;background:#f4f9fd;border:0.5px solid #cfe3f3;border-radius:12px;padding:12px 15px">'
      + '<div style="font-size:11.5px;font-weight:600;margin-bottom:8px">Money in this selection · ' + esc(label) + ' · ' + s.n + ' booking' + (s.n === 1 ? '' : 's') + '</div>'
      + '<div style="display:flex;gap:12px;flex-wrap:wrap">' + c('To collect', money(s.target)) + c('Paid', money(s.paid)) + c('Due', money(s.due)) + c('Cash on tour', money(s.cot)) + '</div>'
      + '<div style="margin-top:8px;font-size:10.5px;color:var(--fd-ink-soft)">The cards at the top are the whole day: the server returns head counts for the day only.</div></div>';
  }

  /* ── Reference pack and slip pack: the files behind the day's sheet, in the chosen selection ── */
  function agentName(r){ var a = agentOf(r.agentId); return (a && (a.name || a.code)) || (r.agentId ? r.agentId : 'Walk-in'); }
  function sortAZ(a, b){ return text(a).localeCompare(text(b), 'en', { numeric: true, sensitivity: 'base' }); }
  function byRouteAgentVoucher(x, y){ return sortAZ(routeName(x.routeId), routeName(y.routeId)) || sortAZ(agentName(x), agentName(y)) || sortAZ(x.voucher, y.voucher); }
  /* Legacy tsRefPackList: a booking with documents, or any agent booking. */
  function refPack(rows){
    return rows.filter(function(r){ return (r.b.attachments || []).length > 0 || !!r.agentId; }).sort(byRouteAgentVoucher);
  }
  var METHOD = { cash: 'Cash', transfer: 'Transfer', card: 'Card', cot: 'Cash on tour' };
  function fileOf(f){ return typeof f === 'string' ? { id: f, name: f } : f; }
  /* Legacy tsSlipPackList: slips of pier payments, on-tour sales, upgrades and the booking itself. */
  function slipPack(rows, date){
    var out = [];
    rows.forEach(function(r){
      var det = slipCache[date + '|' + r.id], files = [];
      function add(list, cap){ (list || []).map(fileOf).forEach(function(f){ if(f && f.id) files.push({ id: f.id, name: f.name || f.id, mime: f.mime || '', cap: cap }); }); }
      if(det){
        (det.payments || []).forEach(function(p){ add(p.slips, (METHOD[p.method] || p.method) + ' ' + money(p.amount) + (n(p.fee) > 0 ? ' · fee ' + money(p.fee) : '') + ' · pier payment'); });
        (det.tour_sales || []).forEach(function(s){ add(s.slips, (METHOD[s.method] || s.method) + ' ' + money(s.total) + (n(s.fee) > 0 ? ' · fee ' + money(s.fee) : '') + ' · ' + text(s.service)); });
      }
      (r.b.upgrades || []).forEach(function(u){ add(u.slips, 'Upgrade ' + text(u.label || u.name || '')); });
      add((r.b.slips || []).map(function(s){ return { id: s.attachment_id, name: s.attachment_id }; }), 'Booking slip');
      if(files.length) out.push({ r: r, files: files });
    });
    return out;
  }
  /* The money rows whose slips are not read yet: paid at the pier, or sold on tour. */
  function needsSlipRead(collect, keep){
    return collect.filter(function(c){ return keep[c.booking_id] && (n(c.paid) > 0 || (c.sales && n(c.sales.count) > 0)); });
  }
  function loadSlips(date, ids){
    var todo = ids.filter(function(id){ return !slipCache[date + '|' + id]; }), i = 0;
    function worker(){
      if(i >= todo.length) return Promise.resolve();
      var id = todo[i++];
      return O.get('/v1/bookings/' + encodeURIComponent(id) + '/pier-money', { date: date }).then(function(res){ slipCache[date + '|' + id] = res || {}; }).then(worker);
    }
    return Promise.all([worker(), worker(), worker(), worker()]);
  }
  function rerender(){ if(typeof window.renderTravelSum === 'function') window.renderTravelSum(); }
  var lastView = null;
  /* The Load button: read the slips of the money rows in the current selection, then redraw. */
  function slipsLoad(){
    var cur = lastView; if(!cur) return Promise.resolve();
    var key = cur.date; if(slipBusy[key]) return slipBusy[key];
    slipBusy[key] = loadSlips(cur.date, cur.slipIds).then(function(){ delete slipBusy[key]; rerender(); }, function(e){ delete slipBusy[key]; O.fail('Slip pack did not load', e); });
    return slipBusy[key];
  }

  function fileLink(f){
    return '<a href="#" data-ops-ts-file="' + esc(f.id) + '" style="color:#1683C7" onclick="laOps.travelRows.openFile(\'' + esc(f.id).replace(/'/g, '') + '\');return false">' + esc(f.name) + '</a>';
  }
  function packsHtml(ref, slips, pending, noSlipRows){
    var BOX = 'flex:1;min-width:300px;background:#fff;border:0.5px solid var(--fd-line-soft);border-radius:12px;padding:12px 15px';
    var HD = 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;font-size:11.5px;font-weight:600';
    var BTN = 'border:0.5px solid var(--fd-line-soft);border-radius:8px;background:#fff;padding:3px 9px;font-size:10.5px;cursor:pointer';
    var TD = 'padding:5px 6px;font-size:11px';
    var nRef = ref.reduce(function(s, r){ return s + (r.b.attachments || []).length; }, 0);
    var refList = ref.map(function(r){
      return '<tr style="border-top:0.5px solid var(--fd-line-soft)"><td style="' + TD + '">' + esc(r.voucher) + '</td><td style="' + TD + '">' + esc(agentName(r)) + '</td><td style="' + TD + '">'
        + ((r.b.attachments || []).map(fileLink).join(' · ') || '<span style="color:var(--fd-ink-soft)">no file</span>') + '</td></tr>';
    }).join('');
    var nSlip = slips.reduce(function(s, x){ return s + x.files.length; }, 0);
    var slipList = slips.map(function(x){
      return '<tr style="border-top:0.5px solid var(--fd-line-soft)"><td style="' + TD + '">' + esc(x.r.voucher) + '</td><td style="' + TD + '">'
        + x.files.map(function(f){ return fileLink(f) + ' <span style="color:var(--fd-ink-soft)">' + esc(f.cap) + '</span>'; }).join('<br>') + '</td></tr>';
    }).join('');
    var slipBody = (pending ? '<button type="button" style="' + BTN + ';margin-bottom:8px" onclick="laOps.travelRows.slipsLoad()">Load slips for ' + pending + ' booking' + (pending === 1 ? '' : 's') + '</button>' : '')
      + (slipList ? '<table style="width:100%;border-collapse:collapse"><tbody>' + slipList + '</tbody></table>' : (pending ? '' : '<div style="font-size:11px;color:var(--fd-ink-soft)">No slip files on these bookings.</div>'));
    return '<div data-ops-ts-packs="1" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">'
      + '<div data-ops-ts-refpack="1" style="' + BOX + '"><div style="' + HD + '"><span>Reference pack · ' + ref.length + ' booking' + (ref.length === 1 ? '' : 's') + ' · ' + nRef + ' file' + (nRef === 1 ? '' : 's') + '</span>'
      + (nRef ? '<button type="button" style="' + BTN + '" onclick="laOps.travelRows.printPack(\'ref\')">Print pack</button>' : '') + '</div>'
      + (refList ? '<table style="width:100%;border-collapse:collapse"><tbody>' + refList + '</tbody></table>' : '<div style="font-size:11px;color:var(--fd-ink-soft)">No documents on these bookings.</div>') + '</div>'
      + '<div data-ops-ts-slippack="1" style="' + BOX + '"><div style="' + HD + '"><span>Slip pack · ' + nSlip + ' file' + (nSlip === 1 ? '' : 's')
      + (noSlipRows ? ' · <span style="color:#A32D2D">' + noSlipRows + ' booking' + (noSlipRows === 1 ? '' : 's') + ' paid without a slip</span>' : '') + '</span>'
      + (nSlip ? '<button type="button" style="' + BTN + '" onclick="laOps.travelRows.printPack(\'slip\')">Print pack</button>' : '') + '</div>' + slipBody + '</div></div>';
  }

  /* Open one file: fetched with the login (a plain link cannot carry the token). */
  function fetchBlob(id){
    return window.laOpsFetch('/v1/attachments/' + encodeURIComponent(id)).then(function(r){ if(!r.ok) throw new Error('HTTP ' + r.status); return r.blob(); });
  }
  function openFile(id){
    var w = window.open ? window.open('', '_blank') : null;
    return fetchBlob(id).then(function(b){ var u = URL.createObjectURL(b); if(w) w.location.href = u; else window.open(u, '_blank'); },
      function(e){ if(w) w.close(); O.fail('File did not open', e); });
  }
  /* Print pack: every file of the pack on one printable page, images inline, other types as a note. */
  function printPack(kind){
    var cur = lastView; if(!cur) return Promise.resolve();
    var items = [];
    if(kind === 'ref') cur.ref.forEach(function(r){ (r.b.attachments || []).forEach(function(f){ items.push({ id: f.id, mime: f.mime, cap: r.voucher + ' · ' + agentName(r) + ' · ' + f.name }); }); });
    else cur.slips.forEach(function(x){ x.files.forEach(function(f){ items.push({ id: f.id, mime: f.mime, cap: x.r.voucher + ' · ' + f.cap }); }); });
    if(!items.length) return Promise.resolve();
    var w = window.open ? window.open('', '_blank') : null;
    return Promise.all(items.map(function(it){ return fetchBlob(it.id).then(function(b){ it.url = URL.createObjectURL(b); it.type = b.type || it.mime; }, function(){ it.url = ''; }); })).then(function(){
      var title = (kind === 'ref' ? 'Reference pack ' : 'Slip pack ') + cur.docNo;
      var body = items.map(function(it){
        var img = it.url && /^image\//.test(it.type || '');
        return '<figure style="break-inside:avoid;margin:0 0 18px"><figcaption style="font:12px sans-serif;margin-bottom:4px">' + esc(it.cap) + '</figcaption>'
          + (img ? '<img src="' + it.url + '" style="max-width:100%">' : '<div style="font:12px sans-serif;color:#555">' + (it.url ? 'Not an image: open it from the sheet.' : 'File could not be loaded.') + '</div>') + '</figure>';
      }).join('');
      var html = '<!doctype html><meta charset="utf-8"><title>' + esc(title) + '</title><body style="margin:18px"><h3 style="font:600 15px sans-serif">' + esc(title) + '</h3>' + body;
      if(w){ w.document.open(); w.document.write(html); w.document.close(); setTimeout(function(){ try{ w.print(); }catch(_){} }, 400); }
    }, function(e){ if(w) w.close(); O.fail('Pack did not load', e); });
  }

  /* What 33 renders: the money rows to show, plus the blocks around them. null = no roster, show the day. */
  function view(d){
    var roster = d && d._roster; if(!roster) return null;
    var date = d.date, st = state();
    if(st.route && !roster.rows.some(function(r){ return r.routeId === st.route; })){ st.route = ''; window._tsRoute = ''; }
    if(st.route){ st.pier = pierOf(st.route); window._tsPier = st.pier; }
    if(st.pier && !roster.rows.some(function(r){ return pierOf(r.routeId) === st.pier; })){ st.pier = ''; window._tsPier = ''; }
    // Chip counts for VAT follow the pier/route scope; the rows follow both.
    var inScope = roster.rows.filter(function(r){ return scopeKeep(st, r.routeId); });
    var keep = {};
    inScope.forEach(function(r){ if(vatKeep(st, r)) keep[r.id] = true; });
    var scoped = !!(st.pier || st.route || st.vat);
    var rows = (d.collect_rows || []).filter(function(r){ return !scoped || keep[r.booking_id]; });
    var kept = inScope.filter(function(r){ return keep[r.id]; });
    var ref = refPack(kept), pendingRows = needsSlipRead(d.collect_rows || [], keep);
    var pendingIds = pendingRows.filter(function(c){ return !slipCache[date + '|' + c.booking_id]; }).map(function(c){ return c.booking_id; });
    var slips = slipPack(kept, date);
    var noSlipRows = (d.collect_rows || []).filter(function(c){ return keep[c.booking_id] && n(c.no_slip) > 0; }).length;
    var html = scopeChips(roster, st, date, inScope) + (scoped ? subtotalHtml(rows, st, date) : '') + packsHtml(ref, slips, pendingIds.length, noSlipRows);
    lastView = { date: date, docNo: docNo(date, st), ref: ref, slips: slips, slipIds: pendingIds };
    return { rows: rows, html: html, state: st, docNo: docNo(date, st) };
  }

  O.onWrite(function(){ cache = {}; slipCache = {}; });
  window.laOps.travelRows = { load: load, view: view, rosterOf: rosterOf, docNo: docNo, slipsLoad: slipsLoad, openFile: openFile, printPack: printPack, clear: function(){ cache = {}; loading = {}; slipCache = {}; slipBusy = {}; } };
})();
