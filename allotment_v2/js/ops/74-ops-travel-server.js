/* ═════════════════════════════════════════════════════════════════
   §opsTravelServer (w4-f2, 2026-10-18) · Travel Summary figures the server now decides

   GET /v1/reports/travel-summary?date=&pier=&route_id=&vat= answers, besides the day totals, what legacy's Travel
   Summary worked out in the browser, function by function (README "Travel Summary", src/domain/travel-rows.ts,
   travel-lines.ts, contract-net.ts):

     checks[] / blocking / can_close   tsV6Checks   the six lines above the sheet, and whether the day can close
     rows[].net, net_text, net_zone,
            net_promo_id               tsNetOf      what the rate type says the trip should cost, beside trip_amount
     rows[].zone_group                 tsManZoneKey OWN / PK / KL / the raw zone
     rows[].add_on_lines               tsAddonList  booked ahead, sold on tour, upgrades, special meals (one list)
     cancelled_rows                    tsCxlRows    cancelled bookings with a trip that day
     rows[].travelled, issue, flags    tsRows       who travelled, who needs a decision, what is still owed
     counts, vat_gap                   tsVatGap     the VAT chips

   This file keeps the answers (one read per day and scope, kept until a write), wraps the legacy functions so every
   screen that calls them (the manifest, the daily report, By trip's zone sort, Agent fair price) reads the answer,
   and gives 57-ops-travelsum-rows.js / 59-ops-travelsum-view.js the server's rows and scoped totals so they stop adding
   rows up in the browser. A day that was not read, an offline server and non-ops mode run legacy's own functions.

   Writes drop every answer; the open Travel Summary reads again (59 draws from what is held, then from the new answer).
   Load order: after 57-ops-travelsum-rows.js and 59-ops-travelsum-view.js, before 90-ops-boot.js. Classic script.
   ═════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  var cache = {};        // key -> { data, idx }
  var loading = {};      // key -> promise
  var gen = 0;

  function enabled(){ return !!(O.enabled && O.enabled()); }
  function text(v){ return v == null ? '' : String(v); }
  function num(v){ return Number.isFinite(+v) ? +v : 0; }
  function g(name){ return typeof window[name] === 'function' ? window[name] : null; }
  function bookings(){ return typeof SB_BOOKINGS !== 'undefined' && Array.isArray(SB_BOOKINGS) ? SB_BOOKINGS : []; }

  /* ── scope: the legacy globals the chips write (59 / 57 keep them normalised) ── */
  function curState(){
    var s = { pier: '', route: '', vat: '' };
    try{ s.pier = text(typeof _tsPier !== 'undefined' ? _tsPier : ''); s.route = text(typeof _tsRoute !== 'undefined' ? _tsRoute : ''); s.vat = text(typeof _tsVatF !== 'undefined' ? _tsVatF : ''); }catch(_){}
    return s;
  }
  function curDate(){ var d = ''; try{ d = text(typeof _tsDate !== 'undefined' ? _tsDate : ''); }catch(_){} return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : O.today(); }
  function norm(st){ st = st || {}; var route = text(st.route); return { pier: route ? '' : text(st.pier), route: route, vat: text(st.vat) }; }
  function keyOf(date, st){ st = norm(st); return date + '|' + st.pier + '|' + st.route + '|' + st.vat; }
  function query(date, st){
    st = norm(st); var q = { date: date };
    if(st.route) q.route_id = st.route; else if(st.pier) q.pier = st.pier;
    if(st.vat) q.vat = st.vat;
    return q;
  }

  function index(data){
    var rows = {}, cxl = {};
    (data.rows || []).forEach(function(r){ if(r && r.booking_id) rows[r.booking_id] = r; });
    (data.cancelled_rows || []).forEach(function(r){ if(r && r.booking_id) cxl[r.booking_id] = r; });
    return { rows: rows, cxl: cxl };
  }
  function store(key, data){ cache[key] = { data: data, idx: index(data) }; return cache[key]; }

  /* ── reads ── */
  function get(date, st){ var c = cache[keyOf(date, st)]; return c ? c.data : null; }
  function load(date, st){
    if(!enabled()) return Promise.resolve(null);
    var key = keyOf(date, st);
    if(cache[key]) return Promise.resolve(cache[key].data);
    if(loading[key]) return loading[key];
    var mine = gen;
    var p = O.get('/v1/reports/travel-summary', query(date, st)).then(function(d){
      delete loading[key];
      if(mine !== gen) return null;                  // a write dropped the answers while this was out: the next draw asks again
      if(!d || d.date !== date) throw new Error('invalid travel summary response');
      store(key, d);
      var v = O.activeView ? O.activeView() : '';
      if(v === 'travelsum' && curDate() === date && typeof window.renderTravelSum === 'function'){
        var tv = O.travelView; if(tv && tv.refresh) tv.refresh(); else window.renderTravelSum();
      }
      return d;
    }, function(e){ delete loading[key]; throw e; });
    loading[key] = p;
    return p;
  }
  /* the whole-day answer 59 already read: keep it as the unscoped one */
  function seed(date, d){ if(d && d.date === date) store(keyOf(date, {}), d); }

  /* the answer for the screen's date and chips, or null */
  function current(){ return get(curDate(), curState()); }
  function dayCache(date){
    // the unscoped answer first (it has every booking), else any answer of that day
    var c = cache[keyOf(date, {})]; if(c) return c;
    var k = Object.keys(cache).filter(function(x){ return x.indexOf(date + '|') === 0; })[0];
    return k ? cache[k] : null;
  }
  function idsOf(b){
    var out = [];
    if(!b) return out;
    [b.opsId, b.id].forEach(function(x){ if(x && out.indexOf(String(x)) < 0) out.push(String(x)); });
    var hit = b.id ? bookings().filter(function(x){ return x && x.id === b.id; })[0] : null;
    if(hit && hit.opsId && out.indexOf(String(hit.opsId)) < 0) out.push(String(hit.opsId));
    return out;
  }
  function dateOfTrip(t){ return text(t && (t.date || t.service_date)); }
  function rowFor(b, date){
    var c = dayCache(date); if(!c) return null;
    var ids = idsOf(b);
    for(var i = 0; i < ids.length; i++){ if(c.idx.rows[ids[i]]) return c.idx.rows[ids[i]]; }
    return null;
  }
  function cxlFor(b, date){
    var c = dayCache(date); if(!c) return null;
    var ids = idsOf(b);
    for(var i = 0; i < ids.length; i++){ if(c.idx.cxl[ids[i]]) return c.idx.cxl[ids[i]]; }
    return null;
  }

  /* ── wrappers over the legacy functions ── */
  function wrap(name, fn){
    var orig = window[name]; if(typeof orig !== 'function' || orig.__opsTravelServer) return;
    var w = function(){
      if(!enabled()) return orig.apply(this, arguments);
      var r = fn.call(this, orig, arguments);
      return r === undefined ? orig.apply(this, arguments) : r;
    };
    w.__opsTravelServer = true; window[name] = w;
  }

  /* tsManZoneKey(b, t) -> 'OWN' | 'PK' | 'KL' | the raw zone */
  wrap('tsManZoneKey', function(orig, a){
    var b = a[0], t = a[1]; if(!b || !t) return undefined;
    var d = dateOfTrip(t), r = d ? (rowFor(b, d) || cxlFor(b, d)) : null;
    return r && r.zone_group ? r.zone_group : undefined;
  });

  /* tsNetOf({b, t}) -> {tot, txt, zone, promo, promoSold, rt} | null.  The server says "null" when the rate cannot say. */
  wrap('tsNetOf', function(orig, a){
    var r0 = a[0]; if(!r0 || !r0.b || !r0.t) return undefined;
    var d = dateOfTrip(r0.t), r = d ? rowFor(r0.b, d) : null;
    if(!r || !('net' in r)) return undefined;
    if(r.net == null) return null;
    var promoId = r.net_promo_id || '', promo = '';
    if(promoId){ var pc = g('laPromoById') ? window.laPromoById(promoId) : null; promo = pc && g('laPromoLabel') ? window.laPromoLabel(pc) : promoId; }
    var rtId = r0.b.rateTypeRef || (r0.b.agentId && g('sbGetAgent') ? ((window.sbGetAgent(r0.b.agentId) || {}).rateTypeId) : null);
    var rt = rtId && g('getRateType') ? window.getRateType(rtId) : null;
    return { tot: num(r.net), txt: text(r.net_text), zone: text(r.net_zone), promo: promo, promoSold: !!(promoId && r0.t.promoId && r0.t.promoId === promoId), rt: rt ? (rt.name || rt.code || '') : '' };
  });

  /* tsAddonList(r, date) -> [{src, t, note, qty?, amt?, done?, kind?, meal?}] */
  wrap('tsAddonList', function(orig, a){
    var r0 = a[0], date = a[1]; if(!r0 || !r0.b || !date) return undefined;
    var r = rowFor(r0.b, date); if(!r || !Array.isArray(r.add_on_lines)) return undefined;
    return r.add_on_lines.map(function(x){
      if(x.src === 'ex') return { src: 'ex', t: text(x.label), qty: num(x.qty) || 1, amt: num(x.amount), done: !!x.done, note: text(x.note) };
      if(x.src === 'up') return { src: 'up', t: text(x.label), amt: num(x.amount), done: !!x.done, note: text(x.note) };
      if(x.src === 'meal') return { src: x.kind === 'pier' ? 'pier' : 'bk', meal: true, t: text(x.label), note: text(x.note) };
      return { src: 'bk', kind: x.kind, t: text(x.label), note: text(x.note) };
    });
  });

  /* tsV6Checks(H, money) -> [{k, w, block?, h}] : the six lines of the headline card, worded as legacy words them, from the server's figures */
  wrap('tsV6Checks', function(orig, a){
    var S = current(); if(!S || !Array.isArray(S.checks) || !S.checks.length) return undefined;
    var H = a[0], money = a[1]; if(typeof money !== 'function') return undefined;
    var by = {}; S.checks.forEach(function(c){ by[c.key] = c; });
    var need = ['bk', 'ns', 'pend', 'due', 'cot', 'doc'];
    if(need.some(function(k){ return !by[k]; })) return undefined;
    var v = function(k){ return by[k].values || {}; };
    var out = [];
    var bk = v('bk');
    out.push({ k: 'bk', w: !!by.bk.warn, h: 'Booking <b>' + num(bk.bookings) + '</b> ใบ &middot; จอง <b>' + num(bk.booked) + '</b> &rarr; เดินทางจริง <b>' + num(bk.travelled) + '</b> <b>(' + num(bk.percent) + '%)</b>' });
    var ns = v('ns');
    out.push({ k: 'ns', w: !!by.ns.warn, h: 'No-show <b>' + num(ns.no_show) + '</b> คน &middot; ยกเลิกหน้างาน <b>' + num(ns.cxl) + '</b> คน' });
    var pe = v('pend');
    out.push({ k: 'pend', w: !!by.pend.warn, block: !!by.pend.blocks, h: 'รอตัดสิน <b>' + num(pe.pending) + '</b> เคส &middot; เก็บค่าปรับได้ <b>' + money(num(pe.charged)) + '</b>' });
    var du = v('due');
    out.push({ k: 'due', w: !!by.due.warn, block: !!by.due.blocks, h: num(du.bookings)
      ? ('เงินที่ต้องเก็บหน้าท่า <b>' + money(num(du.target)) + '</b> จาก <b>' + num(du.bookings) + '</b> ใบ &middot; ' + (num(du.due) > 0 ? ('ยังค้าง <b>' + money(num(du.due)) + '</b>') : 'เก็บครบแล้ว')
          + (num(du.not_collected_bookings) ? (' &middot; เก็บไม่ได้ <b>' + money(num(du.not_collected)) + '</b> ' + num(du.not_collected_bookings) + ' ใบ ปิดพร้อมเหตุผลแล้ว') : ''))
      : 'ไม่มียอดต้องเก็บหน้าท่า' });
    var co = v('cot');
    out.push({ k: 'cot', w: !!by.cot.warn, block: !!by.cot.blocks, h: num(co.total) > 0
      ? ('COT <b>' + money(num(co.total)) + '</b> &middot; ' + (num(co.undecided_bookings) > 0 ? ('ยังไม่ตัดสิน <b>' + num(co.undecided_bookings) + '</b> ใบ') : 'ตัดสินครบ'))
      : 'ไม่มี COT ในชุดนี้' });
    var D = v('doc'), bits = [];
    if(D.verified) bits.push('ตรวจแล้ว <b>' + D.verified + '</b>');
    if(D.issue)    bits.push('มีปัญหา <b>' + D.issue + '</b>');
    if(D.pending)  bits.push('รอตรวจ <b>' + D.pending + '</b>');
    if(D.nofiles)  bits.push('ยังไม่แนบ <b>' + D.nofiles + '</b>');
    var dBad = num(D.issue) + num(D.pending) + num(D.nofiles);
    out.push({ k: 'doc', w: !!by.doc.warn, h: 'เอกสารแนบ &middot; ' + (bits.length ? (bits.join(' &middot; ') + (dBad ? '' : ' &middot; ครบ')) : 'ไม่มีใบในชุดนี้') });
    return out;
  });

  /* tsCxlRows(date) -> the cancelled bookings of the day, in legacy's row shape (only when every one is a booking this browser holds) */
  wrap('tsCxlRows', function(orig, a){
    var date = a[0], c = date ? dayCache(date) : null; if(!c) return undefined;
    var list = c.data.cancelled_rows; if(!Array.isArray(list)) return undefined;
    var out = [];
    for(var i = 0; i < list.length; i++){
      var x = list[i];
      var b = bookings().filter(function(y){ return y && (y.opsId === x.booking_id || y.id === x.booking_id); })[0];
      var t = b ? ((b.trips || []).filter(function(tt){ return tt && (tt.date || '') === date; })[0]) : null;
      if(!b || !t) return undefined;                   // a booking this browser does not hold: legacy lists what it can
      out.push({ b: b, t: t, O: (typeof bkOpsRead === 'function') ? bkOpsRead(b, date) : (b.ops || {}), routeId: x.route_id || t.routeId || '', cxlRow: true,
        ovnBack: !!x.ovn_back, ovnOut: x.ovn_out || '', booked: num(x.booked), travelled: 0,
        ns: 0, cxl: 0, events: [], van: '', vanCk: null, vanDone: false, vanActual: null,
        boat: '', pierCk: null, pierDone: false, pierActual: null, pierExp: null,
        issue: false, amount: num(x.trip_amount), policy: '', dec: null });
    }
    return out;
  });

  /* what 57's model keeps for a scope: the server's own membership, VAT counts and cancelled list (null until it has answered for that scope) */
  function scopeFor(roster, st, date){
    var SC = get(date, st); if(!SC || !Array.isArray(SC.rows)) return null;
    var ids = {}, order = {};
    SC.rows.forEach(function(r, i){ ids[r.booking_id] = true; order[r.booking_id] = i; });
    var kept = roster.rows.filter(function(r){ return ids[r.id]; }).sort(function(x, y){ return order[x.id] - order[y.id]; });
    var out = { SC: SC, keep: ids, kept: kept, nVat: SC.counts ? num(SC.counts.vat) : 0, nNoVat: SC.counts ? num(SC.counts.no_vat) : 0,
                nAll: SC.counts ? num(SC.counts.all) : null, vatGap: Array.isArray(SC.vat_gap) ? SC.vat_gap.slice() : null, cancelled: null };
    if(Array.isArray(SC.cancelled_rows)){
      var cx = {}; SC.cancelled_rows.forEach(function(x){ cx[x.booking_id] = true; });
      out.cancelled = (roster.cancelled || []).filter(function(r){ return cx[r.id]; });
    }
    return out;
  }

  O.onWrite(function(){ gen++; cache = {}; loading = {}; });
  O.travelServer = {
    get: get, load: load, seed: seed, current: current, rowFor: rowFor, cxlFor: cxlFor, scopeFor: scopeFor,
    key: keyOf, state: curState, date: curDate, clear: function(){ gen++; cache = {}; loading = {}; }
  };
})();
