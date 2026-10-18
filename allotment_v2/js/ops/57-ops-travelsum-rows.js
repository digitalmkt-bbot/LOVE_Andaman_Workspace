/* ══════════════════════════════════════════════════════════════════════════
   §opsTravelRows · Travel Summary data ⇄ operation-backend rows
   ──────────────────────────────────────────────────────────────────────────
   The server's GET /v1/reports/travel-summary answers one set of day totals plus
   money rows (collect_rows). The screen (59-ops-travelsum-view.js) also needs the
   day's bookings, the decisions after the trip, the scope (pier › route › VAT),
   the document packs and the writes. They live here:

     GET    /v1/bookings?service_date=D&limit=5000     the day's roster (live + cancelled bookings)
     GET    /v1/after-trip?date=D                      per booking: version, trip price, COT decision, no-show decision
     GET    /v1/bookings/:id/pier-money?date=D         a booking's pier payments and on-tour sales, with their slips
     PUT    /v1/bookings/:id/cot-decisions/:date       one COT decision (full | part | none | payout | nocol + ref)
     DELETE /v1/bookings/:id/cot-decisions/:date
     PUT    /v1/bookings/:id/noshow-charges/:date      one no-show decision (full | partial | none | postpone)
     DELETE /v1/bookings/:id/noshow-charges/:date
     GET    /v1/attachments/:id                        one file (opened on click; all of a pack in the print window)

   Scope state stays in the legacy globals (_tsPier, _tsRoute, _tsVatF) so the legacy
   chip handlers (tsPickPier / tsPickRoute / tsPickVat) keep working. Writes are server
   first: the screen is drawn again from what the server answers, never from a local guess.
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
  function tripOn(b, date){ return (b && b.trips || []).filter(function(x){ return x && x.service_date === date; })[0] || null; }
  function rowOf(b, t){ return { id: b.id, voucher: b.voucher_ref || b.code || b.id, agentId: b.agent_id || '', routeId: t.route_id || '', b: b, t: t }; }
  function rosterOf(date, bookings){
    var out = [], seen = {};
    (bookings || []).forEach(function(b){
      if(!b || seen[b.id] || DEAD.indexOf(b.status) >= 0) return;
      var t = tripOn(b, date); if(!t) return;
      seen[b.id] = 1; out.push(rowOf(b, t));
    });
    return out;
  }
  /* Legacy tsCxlRows (the server's cancelledOnDay): cancelled or weather-cancelled with a trip that day. */
  function cancelledOf(date, bookings){
    var out = [], seen = {};
    (bookings || []).forEach(function(b){
      if(!b || seen[b.id] || (b.status !== 'cancelled' && b.status !== 'cancelled_weather')) return;
      var t = tripOn(b, date); if(!t) return;
      seen[b.id] = 1; out.push(rowOf(b, t));
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
  /* Legacy tsCotGet reads TS_COT, which nothing filled here, so the booking page's COT figure (bookingV2CotOf)
     ignored decisions saved from this screen. Put the server's decisions for the day into TS_COT in memory
     (never saved: tsCotPersist is not called) so tsCotGet answers with what the server holds. */
  function mirrorCot(date, after, bookings){
    if(!after || typeof TS_COT === 'undefined' || typeof _tsKey !== 'function') return;
    // The pages key a booking by its client id (the external_id a new booking was saved with), the server by its own
    // id: put each decision and trip amount under both, or a booking made in the new frontend is never found.
    var clientId = {};
    (bookings || []).forEach(function(b){ if(b && b.id && b.external_id) clientId[b.id] = b.external_id; });
    Object.keys(after).forEach(function(id){
      var dec = after[id] && after[id].cot && after[id].cot.decision;
      [id, clientId[id]].forEach(function(bid){
        if(!bid) return;
        var k = _tsKey(bid, date);
        if(dec) TS_COT[k] = dec; else delete TS_COT[k];
        if(after[id] && after[id].trip_amount != null) tripAmt[k] = n(after[id].trip_amount);
      });
    });
  }
  /* Legacy tsTripAmount (booking, by-trip and pier-stats screens) priced the trip in the browser. Once the
     server has answered trip_amount for that booking and day (GET /v1/after-trip), show its number. */
  var tripAmt = {};
  /* §tripAmountOwn (Q34d, decided) · the booking, by-trip and pier-stats screens do not wait for Travel Summary: the
     first time one of them asks for a day's amount, this fetches GET /v1/after-trip?date= itself (one read per day,
     kept in dayAmt as {server booking id: trip_amount}) and draws the screen again when it arrives. Until then, and when the
     read fails, the browser formula (the original tsTripAmount) answers. A write drops dayAmt, so the next draw reads again. */
  var dayAmt = {};     // date -> { loaded:true, by:{ bookingId: amount } } | { loading:true } | { failed:true }
  function fetchDayAmounts(date){
    if(dayAmt[date]) return;
    var mine = dayAmt[date] = { loading: true };
    O.get('/v1/after-trip', { date: date }).then(function(res){
      if(dayAmt[date] !== mine) return;             // a write dropped it while the read was out: the next draw asks again
      var by = {}; ((res && res.rows) || []).forEach(function(x){ if(x && x.booking_id && x.trip_amount != null) by[x.booking_id] = n(x.trip_amount); });
      dayAmt[date] = { loaded: true, by: by };
      var v = O.activeView ? O.activeView() : '';
      if(v !== 'travelsum' && !(O.busy && O.busy()) && typeof window._laRerender === 'function') window._laRerender();
    }, function(){ if(dayAmt[date] === mine) dayAmt[date] = { failed: true }; });
  }
  var origTripAmount = window.tsTripAmount;
  if(typeof origTripAmount === 'function'){
    window.tsTripAmount = function(b, t){
      if(O.enabled && O.enabled() && b && t && t.date && typeof _tsKey === 'function'){
        var k = _tsKey(b.id, t.date);
        if(Object.prototype.hasOwnProperty.call(tripAmt, k)) return tripAmt[k];
        var d = dayAmt[t.date];
        if(!d) fetchDayAmounts(t.date);
        else if(d.by){ var sid = b.opsId || b.id; if(Object.prototype.hasOwnProperty.call(d.by, sid)) return d.by[sid]; }
      }
      return origTripAmount.apply(this, arguments);
    };
    window.tsTripAmount.__ownRead = true;
  }
  function load(date){
    if(cache[date]) return Promise.resolve(cache[date]);
    if(loading[date]) return loading[date];
    // The decisions after the trip are an extra read; without them the scope and packs still work.
    var decisions = O.get('/v1/after-trip', { date: date }).then(function(res){
      var m = {}; ((res && res.rows) || []).forEach(function(x){ m[x.booking_id] = x; }); return m;
    }, function(){ return null; });
    // Van names for the manifest (the app's van list is only filled by the van screens); optional too.
    var vans = O.get('/operations/vans').then(function(res){
      var m = {}; ((res && res.vans) || []).forEach(function(v){ if(v && v.id) m[v.id] = v.name || v.plate || v.id; }); return m;
    }, function(){ return {}; });
    var p = Promise.all([fetchAll(date), decisions, vans]).then(function(x){
      mirrorCot(date, x[1], x[0]);
      var r = { date: date, rows: rosterOf(date, x[0]), cancelled: cancelledOf(date, x[0]), after: x[1], vans: x[2] || {} };
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
  /* Read the slips of the money rows in the current selection, then redraw. */
  function slipsLoad(){
    var cur = lastView; if(!cur) return Promise.resolve();
    var key = cur.date; if(slipBusy[key]) return slipBusy[key];
    slipBusy[key] = loadSlips(cur.date, cur.slipIds).then(function(){ delete slipBusy[key]; rerender(); }, function(e){ delete slipBusy[key]; O.fail('Slip pack did not load', e); });
    return slipBusy[key];
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

  /* Legacy tsCotWhySug: what the people at the van and pier already recorded for this booking and day,
     read from the structured check-in events (never from free-text notes), so staff do not retype it. */
  function whySuggestion(r){
    var ck = (r && r.t && r.t.operations && r.t.operations.checkins) || {}, bits = [], any = false, zero = false;
    ['van', 'pier'].forEach(function(k){
      (ck[k] || []).forEach(function(c){
        any = true; if(c && c.actual_pax === 0) zero = true;
        (c && c.events || []).forEach(function(x){
          if(!x || x.undone || !(n(x.pax) > 0)) return;
          var lb = g('ckReasonLabel') ? window.ckReasonLabel(x.reason_code) : text(x.reason_code);
          var one = (x.type === 'cxl' ? 'Cancelled on site' : 'No-show') + ' ' + n(x.pax) + ' pax' + (lb ? ' · ' + lb : '') + (text(x.note).trim() ? ' · ' + text(x.note).trim() : '');
          if(bits.indexOf(one) < 0) bits.push(one);
        });
      });
    });
    if(!bits.length && any && zero) bits.push('Customer did not travel');
    return bits.join(' · ');
  }

  /* ── Writes after the trip: one booking at a time, with its version; the answer redraws the screen ── */
  function afterRow(date, bookingId){ var roster = cache[date]; return roster && roster.after && roster.after[bookingId] || null; }
  function guard(){ return !(g('laGuardEdit') && !window.laGuardEdit('operations')); }
  function afterWrite(title, kind, bookingId, method, path, body){
    var date = lastView && lastView.date; if(!date) return Promise.resolve();
    // Any write (ours or, through the change feed, someone else's) empties the roster cache while the screen stays
    // open. The decision needs the booking's version, so read the day again first instead of sending it without one
    // (428 version_required).
    var ready = cache[date] ? Promise.resolve() : load(date);
    return ready.then(function(){
      var row = afterRow(date, bookingId);
      var bk = { id: bookingId, opsId: bookingId, opsVersion: row && row.version != null ? row.version : null };
      return O.queue(function(){ return O.bookingWrite(method, path, bk, body); });
    }).then(function(){ O.wrote(kind); rerender(); }, function(e){
        O.fail(title, e);
        // A stale version stays cached otherwise and every later save resends it: drop the roster and the
        // summary so the next render reads /v1/after-trip again and gets the booking's fresh version.
        if(e && e.code === 'stale_version'){
          delete cache[date];
          var MR = window.laOps && window.laOps.moneyReports; if(MR && MR.clear) MR.clear();
          var TV = window.laOps && window.laOps.travelView; if(TV && TV.clear) TV.clear();
          O.wrote(kind + '-stale'); rerender();
        }
      });
  }
  function cotPath(bookingId){ return '/v1/bookings/' + encodeURIComponent(bookingId) + '/cot-decisions/' + encodeURIComponent(lastView ? lastView.date : ''); }
  function nsPath(bookingId){ return '/v1/bookings/' + encodeURIComponent(bookingId) + '/noshow-charges/' + encodeURIComponent(lastView ? lastView.date : ''); }
  function inputVal(id){ var el = document.getElementById(id); return el ? text(el.value).trim() : ''; }
  /* COT decision. 'part' starts from deduct-all on the server (legacy) and its amounts are set with cotAmt. */
  function cotPick(bookingId, mode){
    if(!guard()) return Promise.resolve();
    var date = lastView && lastView.date; if(!date) return Promise.resolve();
    var row = afterRow(date, bookingId);
    var body = { mode: mode };
    // Legacy asked before a button replaced a part decision (its split is lost).
    if(mode !== 'part' && row && row.cot && row.cot.decision && row.cot.decision.mode === 'part' && typeof window.confirm === 'function' && !window.confirm('This booking has a part-kept / part-paid-out decision. Replace it?')) return Promise.resolve();
    if(mode === 'nocol'){
      // The reason box shows when the server suggests "not collected" or one was saved; otherwise ask for it.
      var box = document.getElementById('ts-cotr-' + bookingId), why = box ? text(box.value).trim() : '';
      if(!box && typeof window.prompt === 'function'){
        var r0 = cache[date] ? cache[date].rows.filter(function(x){ return x.id === bookingId; })[0] : null;
        var asked = window.prompt('เก็บไม่ได้เพราะอะไร', r0 ? whySuggestion(r0) : '');
        if(asked == null) return Promise.resolve();
        why = text(asked).trim();
      }
      if(!why){ O.fail('Cash on tour not saved', new Error('Write why it was not collected')); return Promise.resolve(); }
      body.ref = why;
    }
    return afterWrite('Cash on tour not saved', 'cot-decision', bookingId, 'PUT', cotPath(bookingId), body);
  }
  /* The split of a 'part' decision (legacy tsCotAmt): whole baht read from the two inputs. */
  function cotAmt(bookingId){
    if(!guard()) return Promise.resolve();
    var num = function(id){ return Math.max(0, Math.round(parseFloat(inputVal(id).replace(/[^0-9.]/g, '')) || 0)); };
    return afterWrite('Cash on tour not saved', 'cot-decision', bookingId, 'PUT', cotPath(bookingId), { mode: 'part', deduct: num('ts-cotd-' + bookingId), payout: num('ts-cotp-' + bookingId) });
  }
  /* The reference / reason of the current decision (legacy tsCotRefSave): same mode, new ref. */
  function cotRef(bookingId){
    if(!guard()) return Promise.resolve();
    var date = lastView && lastView.date, row = date && afterRow(date, bookingId), dec = row && row.cot && row.cot.decision;
    if(!dec) return Promise.resolve();
    var body = { mode: dec.mode, ref: inputVal('ts-cotr-' + bookingId) };
    if(dec.mode === 'part'){ body.deduct = dec.deduct; body.payout = dec.payout; }
    return afterWrite('Cash on tour not saved', 'cot-decision', bookingId, 'PUT', cotPath(bookingId), body);
  }
  function cotClear(bookingId){
    if(!guard()) return Promise.resolve();
    return afterWrite('Cash on tour not cleared', 'cot-decision', bookingId, 'DELETE', cotPath(bookingId));
  }
  /* No-show decision (legacy tsPick / tsCustom / tsPostpone): the note comes from the row's input. */
  function nsPick(bookingId, decision, amount){
    if(!guard()) return Promise.resolve();
    var body = { decision: decision, note: inputVal('ts-note-' + bookingId) || null };
    if(decision === 'partial') body.amount = Math.max(0, Math.round(n(amount)));
    return afterWrite('No-show decision not saved', 'noshow-decision', bookingId, 'PUT', nsPath(bookingId), body);
  }
  function nsClear(bookingId){
    if(!guard()) return Promise.resolve();
    return afterWrite('No-show decision not cleared', 'noshow-decision', bookingId, 'DELETE', nsPath(bookingId));
  }

  /* What the screen draws from: the scope state (normalised), the rows in it and the packs. */
  function model(d){
    var roster = d && d._roster; if(!roster) return null;
    var date = d.date, st = state();
    if(st.route && !roster.rows.some(function(r){ return r.routeId === st.route; })){ st.route = ''; window._tsRoute = ''; }
    if(st.route){ st.pier = pierOf(st.route); window._tsPier = st.pier; }
    if(st.pier && !roster.rows.some(function(r){ return pierOf(r.routeId) === st.pier; })){ st.pier = ''; window._tsPier = ''; }
    // Chip counts for VAT follow the pier/route scope; the rows follow both.
    var inScope = roster.rows.filter(function(r){ return scopeKeep(st, r.routeId); });
    var keep = {};
    inScope.forEach(function(r){ if(vatKeep(st, r)) keep[r.id] = true; });
    var kept = inScope.filter(function(r){ return keep[r.id]; });
    var nVat = 0; inScope.forEach(function(r){ if(hasVat(r)) nVat++; });
    /* w4-f2 · a pier / route / VAT choice is the server's to judge (GET /v1/reports/travel-summary with the scope): once it has answered,
       its rows are the selection, its counts the VAT chips and its cancelled list the cancelled rows. Until then (and when it fails)
       the browser's own cut above stays, so the screen is never empty while waiting. */
    var TSV = O.travelServer, sv = null;
    if(TSV && (st.pier || st.route || st.vat)){
      if(!TSV.get(date, st)) TSV.load(date, st).catch(function(){});
      sv = TSV.scopeFor(roster, st, date);
      if(sv){ keep = sv.keep; kept = sv.kept; nVat = sv.nVat; }
    }
    var collect = d.collect_rows || [];
    var ref = refPack(kept), pendingRows = needsSlipRead(collect, keep);
    var pendingIds = pendingRows.filter(function(c){ return !slipCache[date + '|' + c.booking_id]; }).map(function(c){ return c.booking_id; });
    var slips = slipPack(kept, date);
    var noSlipRows = collect.filter(function(c){ return keep[c.booking_id] && n(c.no_slip) > 0; }).length;
    var no = docNo(date, st);
    lastView = { date: date, docNo: no, ref: ref, slips: slips, slipIds: pendingIds };
    return {
      state: st, scoped: !!(st.pier || st.route || st.vat), docNo: no, keep: keep, inScope: inScope, kept: kept, serverScope: sv ? sv.SC : null, nAllServer: sv ? sv.nAll : null,
      cancelled: sv && sv.cancelled ? sv.cancelled : (roster.cancelled || []).filter(function(r){ return scopeKeep(st, r.routeId) && vatKeep(st, r); }),
      // Bookings moved off the day (server moved_rows, legacy tsMvRows): the same pier/route/VAT scope.
      moved: (d.moved_rows || []).filter(function(m){ return scopeKeep(st, text(m.route_id)) && vatKeep(st, { agentId: m.agent_id || '' }); }),
      movedListed: Array.isArray(d.moved_rows),
      nVat: nVat, nNoVat: sv ? sv.nNoVat : inScope.length - nVat, vatGap: sv && sv.vatGap ? sv.vatGap : vatGap(inScope), after: roster.after || null, vans: roster.vans || {},
      ref: ref, nRefFiles: ref.reduce(function(s, r){ return s + (r.b.attachments || []).length; }, 0),
      slips: slips, nSlipFiles: slips.reduce(function(s, x){ return s + x.files.length; }, 0), slipPending: pendingIds.length, noSlipRows: noSlipRows
    };
  }

  O.onWrite(function(){ cache = {}; slipCache = {}; tripAmt = {}; dayAmt = {}; });
  window.laOps.travelRows = {
    load: load, model: model, rosterOf: rosterOf, cancelledOf: cancelledOf, docNo: docNo, hasVat: hasVat, pierOf: pierOf, scopeKeep: scopeKeep,
    whySuggestion: whySuggestion, slipsLoad: slipsLoad, openFile: openFile, printPack: printPack,
    cotPick: cotPick, cotAmt: cotAmt, cotRef: cotRef, cotClear: cotClear, nsPick: nsPick, nsClear: nsClear,
    clear: function(){ cache = {}; loading = {}; slipCache = {}; slipBusy = {}; }
  };
})();
