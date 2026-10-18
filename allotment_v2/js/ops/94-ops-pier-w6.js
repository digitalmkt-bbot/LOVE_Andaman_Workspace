/* ═════════════════════════════════════════════════════════════════
   §opsPierW6 (w6-d, 2026-10-18) · the pier / guide / travel rules the server now answers (docs/walk/w5-d.md items 1 to 5)

   The backend built the fields that were MISSING-SERVER-FIELD in the w5-d walk (README "Fields the new frontend asked for"):

     POST /v1/bookings/{id}/pier-payments/preview     pckLineFee      the card fee of each line the cashier typed (no write)
     GET  /v1/pier-checkin  groups {boat, van, zone}  pckTripStats    the heads, languages, meals and longtails of a boat band / van group / zone
     rows[].return {kind, van_id, drop_off}           ckRetVan, pckJobDrop, tsSendBack      (pier sheet, van check-in, travel summary rows)
     rows[].service.lines                             pckJobService   the Service column of the job card
     GET  /v1/config/guides  value[].licensed         goIsGuide       outside a guide sheet (the register's own list)

   Every function answers from what the server last said and returns `undefined` (legacy's own arithmetic answers) before the first
   answer, while a write has made the held answer stale, offline, and for any set of rows the server did not group (a filtered band).
   The cashier's choices (method, amount, fee % or baht) are all that is sent; the fee is the server's.

   Load order: after 83-ops-pier-day.js, 74-ops-van-checkin.js, 74-ops-travel-server.js, 83-ops-guide-papers.js. Classic script.
   ═════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  function enabled(){ return !!(O.enabled && O.enabled()); }
  function num(v){ return +v || 0; }
  function g(name){ try{ return window[name]; }catch(_){ return undefined; } }
  function enc(v){ return encodeURIComponent(v == null ? '' : String(v)); }
  function list(){ return typeof SB_BOOKINGS !== 'undefined' && Array.isArray(SB_BOOKINGS) ? SB_BOOKINGS : []; }
  function find(id){ return list().filter(function(b){ return b && (b.id === id || b.opsId === id); })[0] || null; }
  function isLand(){ try{ return !!(typeof _pckLand !== 'undefined' && _pckLand); }catch(_){ return false; } }
  function pckDate(){ try{ return typeof _pckDate !== 'undefined' ? _pckDate : ''; }catch(_){ return ''; } }
  function PS(){ return O.pierService || null; }

  function wrap(name, fn){
    var orig = window[name]; if(typeof orig !== 'function' || orig.__opsPierW6) return;
    var w = function(){
      if(!enabled()) return orig.apply(this, arguments);
      var r;
      try{ r = fn.call(this, orig, arguments); }catch(e){ if(window.console) console.warn('[ops] pier w6 · ' + name + ' · ' + (e && e.message)); r = undefined; }
      return r === undefined ? orig.apply(this, arguments) : r;
    };
    w.__opsPierW6 = true; w.__orig = orig; window[name] = w;
  }

  /* ── 1 · pckLineFee: the card fee of a line, from POST /v1/bookings/{id}/pier-payments/preview ── */
  var feeHeld = {}, feeKeys = [], feeAsking = {};
  function payOf(L){
    var P = typeof _pckPay !== 'undefined' ? _pckPay : null;
    if(!P || !Array.isArray(P.lines)) return null;
    var i = P.lines.indexOf(L); if(i < 0) return null;
    var b = find(P.bkId); if(!b || !b.opsId) return null;
    return { P: P, i: i, b: b };
  }
  /* the lines that go in the question (an amount of 0 is not a payment) and where each one sits in the dialog */
  function feeQuestion(P){
    var lines = [], at = [];
    P.lines.forEach(function(L, i){
      if(!L || num(L.amt) <= 0) return;
      var line = { method: L.m, amount: num(L.amt) };
      if(L.m === 'card'){ if(L.feeMode === 'pct') line.fee_pct = num(L.feePct); else line.fee = num(L.fee); }
      lines.push(line); at.push(i);
    });
    return { lines: lines, at: at };
  }
  function legacyFee(L){ var f = window.pckLineFee && window.pckLineFee.__legacy; return f ? f(L) : 0; }
  function askFee(key, b, q){
    if(feeAsking[key]) return; feeAsking[key] = true;
    O.post('/v1/bookings/' + enc(b.opsId) + '/pier-payments/preview', { lines: q.lines }).then(function(res){
      delete feeAsking[key];
      feeHeld[key] = { at: q.at, lines: (res && res.lines) || [] }; feeKeys.push(key);
      if(feeKeys.length > 60) delete feeHeld[feeKeys.shift()];
      var P = typeof _pckPay !== 'undefined' ? _pckPay : null;
      if(!P || !document.getElementById('acct-modal')) return;
      var cur = feeQuestion(P);
      if(b.opsId + '|' + JSON.stringify(cur.lines) !== key) return;     // the cashier typed on: the next answer draws
      var differs = q.at.some(function(i, k){ var L = P.lines[i], s = feeHeld[key].lines[k]; return L && s && Math.abs(num(s.fee) - legacyFee(L)) > 0.004; });
      if(differs && typeof window.pckPayRender === 'function'){ try{ window.pckPayRender(); }catch(_){} }
    }, function(){ delete feeAsking[key]; });
  }
  (function(){
    var orig = window.pckLineFee; if(typeof orig !== 'function' || orig.__opsPierW6) return;
    var w = function(L){
      if(!enabled() || !L || L.m !== 'card') return orig.apply(this, arguments);
      var c = payOf(L); if(!c) return orig.apply(this, arguments);
      var q = feeQuestion(c.P), k = q.at.indexOf(c.i);
      if(k < 0) return orig.apply(this, arguments);                    // an empty line: the amount is 0, legacy's reading stands
      var key = c.b.opsId + '|' + JSON.stringify(q.lines), hit = feeHeld[key];
      if(hit && hit.lines[k] && hit.lines[k].fee != null) return num(hit.lines[k].fee);
      if(!hit) askFee(key, c.b, q);
      return orig.apply(this, arguments);
    };
    w.__opsPierW6 = true; w.__legacy = orig; window.pckLineFee = w;
  })();

  /* ── 2 · pckTripStats: the group's figures from GET /v1/pier-checkin groups ── */
  function dayAns(date){ var p = PS(); return p && date ? p.day(date) : null; }
  function live(r){ return r && !r.strand && r.stage !== 'vd'; }
  /* the server rows of the sheet rows given, or null when one of them is not on the answer */
  function serverRowsOf(rows, date){
    var PD = O.pierDay; if(!PD || !PD.rowOf) return null;
    var out = [];
    for(var i = 0; i < rows.length; i++){
      var r = rows[i]; if(!r || r.strand || r._vd) continue;
      var s = PD.rowOf(r, date); if(!s) return null;
      out.push(s);
    }
    return out;
  }
  function groupOf(rows, date){
    var ans = dayAns(date); if(!ans || !ans.groups || !Array.isArray(rows)) return null;
    var srv = serverRowsOf(rows, date); if(!srv || !srv.length) return null;
    var all = (ans.rows || []).filter(live);
    function same(field, key){
      var id = srv[0][field]; if(!id) return null;
      for(var i = 1; i < srv.length; i++) if(srv[i][field] !== id) return null;
      var G = ans.groups[key] && ans.groups[key][id]; if(!G) return null;
      var whole = all.filter(function(r){ return r[field] === id; }).length;
      return (whole === srv.length && num(G.n) === srv.length) ? G : null;     // the whole group, not a filtered part of it
    }
    var G = same('boat_id', 'boat') || same('van_id', 'van') || same('arrival', 'zone');
    return G;
  }
  wrap('pckTripStats', function(orig, a){
    if(isLand()) return undefined;
    var rows = a[0], date = a[1]; if(!rows || !rows.length || !date) return undefined;
    var G = groupOf(rows, date); if(!G) return undefined;
    var R = G.real || {};
    var real = { ad: num(R.ad), chd: num(R.chd), inf: num(R.inf), foc: num(R.foc) };
    real.all = real.ad + real.chd + real.inf + real.foc;
    var lang = {}; Object.keys(G.languages || {}).forEach(function(c){ if(num(G.languages[c])) lang[c] = num(G.languages[c]); });
    var M = G.meals || {};
    return { real: real, book: num(G.booked), lost: num(G.lost), lang: lang,
             meal: { veg: num(M.veg), vegan: num(M.vegan), halal: num(M.halal), allergy: num(M.allergy) },
             ltJoin: num(G.lt_join), ltChtr: num(G.lt_charter) };
  });

  /* ── 3 · the way back: rows[].return of the pier sheet, the van check-in and the travel summary ── */
  function returnOf(b, date){
    if(!b || !date) return null;
    var TS = O.travelServer, r = TS && TS.rowFor ? TS.rowFor(b, date) : null;
    if(r && r.return) return r.return;
    var PD = O.pierDay, rows = PD && PD.rowsOf ? PD.rowsOf(b, null, date) : null;
    if(rows && rows[0] && rows[0].return) return rows[0].return;
    var VC = O.vanCheckin, cur = VC && typeof VC.current === 'function' ? VC.current() : null;
    if(cur && cur.data && Array.isArray(cur.data.rows)){
      var ids = {}; (b.trips || []).forEach(function(t){ if(t && (t.date || '') === date && t.opsTripId) ids[t.opsTripId] = 1; });
      var hit = cur.data.rows.filter(function(x){ return ids[x.trip_id] && x.return; })[0];
      if(hit) return hit.return;
    }
    return null;
  }
  function vanName(id){ var v = typeof g('vehGet') === 'function' ? window.vehGet(id) : null; return (v && v.name) || id; }
  function retVanOf(rt){
    if(!rt || !rt.kind) return null;
    if(rt.kind === 'self') return { t: 'กลับเอง', kind: 'self' };
    if(rt.kind === 'van') return { t: vanName(rt.van_id), kind: 'van' };
    if(rt.kind === 'same') return { t: 'กลับคันเดิม', kind: 'same' };
    if(rt.kind === 'pending') return { t: 'ยังไม่จัดรถกลับ', kind: 'pending' };
    return null;
  }
  wrap('ckRetVan', function(orig, a){
    var rt = returnOf(a[0], a[1]); if(!rt) return undefined;
    return retVanOf(rt);
  });
  wrap('pckJobDrop', function(orig, a){
    var rt = returnOf(a[0], a[1]); if(!rt) return undefined;
    var rv = retVanOf(rt);
    if(rt.kind === 'self') return { t: 'กลับเอง', self: true, van: null };
    if(rt.drop_off) return { t: rt.drop_off, self: false, van: (rv && rv.kind !== 'self') ? rv : null };
    if(rv) return { t: '', self: false, van: rv };
    return null;
  });
  wrap('tsSendBack', function(orig, a){
    var rt = returnOf(a[0], a[1]); if(!rt) return undefined;
    var drop = rt.drop_off || '';
    if(rt.kind === 'self') return { t: String(drop).replace(/\s*\(self-?arrive\)/i, '').trim() || '—', tag: 'กลับเอง', cls: 'n' };
    if(!drop && rt.kind !== 'pending') return undefined;       // "same drop-off as the pickup" and "a separate drop with no name" look alike here: legacy tells them apart
    if(rt.kind === 'van') return { t: drop || '—', tag: '↩ ' + vanName(rt.van_id), cls: 'g' };
    if(rt.kind === 'same') return { t: drop || '—', tag: '↩ กลับคันเดิม', cls: 'e' };
    if(rt.kind === 'pending') return { t: drop || '—', tag: '⚠ ยังไม่จัดรถกลับ', cls: 'r' };
    return null;
  });

  /* ── 4 · pckJobService: the Service column's lines from rows[].service.lines ── */
  wrap('pckJobService', function(orig, a){
    var r = a[0], date = a[1]; if(!r || !date || isLand()) return undefined;
    var PD = O.pierDay, s = PD && PD.rowOf ? PD.rowOf(r, date) : null;
    if(!s || !s.service || !Array.isArray(s.service.lines)) return undefined;
    var CL = typeof g('pckSvcColors') === 'function' ? window.pckSvcColors() : {};
    var rule = typeof g('pckSvcRuleColor') === 'function' ? window.pckSvcRuleColor : function(){ return undefined; };
    var sv = s.service, out = [];
    s.service.lines.forEach(function(x){
      var label = String(x.label || '');
      if(x.kind === 'longtail'){
        if(sv.kind === 'charter') out.push({ c: CL.chtr, t: label + (num(sv.upgrades) > 0 ? (' ⬆' + (num(sv.upgrade_due) > 0 ? ' *' : '')) : '') });
        else out.push({ c: CL.join, t: label + (num(x.qty) > 0 ? (' +' + num(x.qty)) : '') });
      }
      else if(x.kind === 'addon') out.push({ c: rule(label), t: label });
      else if(x.kind === 'ex') out.push({ c: rule(label), t: '+ ' + label + (num(x.qty) > 1 ? (' ×' + num(x.qty)) : '') });
      else if(x.kind === 'upg') out.push({ c: rule(label), t: '⬆ ' + label + (x.done ? '' : ' *') });
    });
    return out;
  });

  /* ── 5 · goIsGuide outside a sheet: the register entry's own `licensed` (role guide or trainee) ── */
  wrap('goIsGuide', function(orig, a){
    var e = a[0];
    if(e && typeof e.licensed === 'boolean') return e.licensed;
    return undefined;
  });

  /* ── 6 · tsInvSlips(b): the slips of the money that came through the booking's invoice, from slip_pack of the day's travel summary ── */
  var LAB = { cash: 'เงินสด', transfer: 'โอนเงิน', card: 'บัตรเครดิต' };
  function thDate(v){ var d = String(v || '').slice(0, 10).split('-'); return d.length === 3 ? (d[2] + '/' + d[1] + '/' + d[0]) : ''; }
  function nf(v){ return typeof g('pckNum') === 'function' ? window.pckNum(v) : String(num(v)); }
  wrap('tsInvSlips', function(orig, a){
    var b = a[0], TS = O.travelServer; if(!b || !TS || !TS.get || !TS.date) return undefined;
    var data = TS.get(TS.date(), {}); if(!data || !Array.isArray(data.slip_pack)) return undefined;
    var ids = PS() ? PS().idsOf(b) : [b.opsId, b.id];
    var row = data.slip_pack.filter(function(x){ return ids.indexOf(x.booking_id) >= 0; })[0];
    var out = { list: [], paid: 0, no: '' };
    var inRows = (data.rows || []).some(function(r){ return ids.indexOf(r.booking_id) >= 0; });
    if(!row){ return inRows ? out : undefined; }                           // the booking is on the sheet and has no slip: the server says so
    out.paid = num(row.invoice_paid); out.no = row.invoice_number || '';
    (row.slips || []).forEach(function(s){
      if(s.source === 'invoice') out.list.push({ f: { id: s.attachment_id, name: s.attachment_id }, cap: 'จ่ายผ่านบิล ' + (s.invoice_number || '') + ' · ' + (LAB[s.method] || s.method || '—') + ' ฿' + nf(s.amount) + (thDate(s.paid_on) ? (' · ' + thDate(s.paid_on)) : '') });
      else if(s.source === 'booking') out.list.push({ f: { id: s.attachment_id, name: s.attachment_id }, cap: 'สลิปที่แนบกับใบจอง' + (s.invoice_number ? (' · บิล ' + s.invoice_number) : '') + (s.by ? (' · ' + s.by) : '') });
    });
    return out;
  });

  O.pierW6 = { returnOf: returnOf, groupOf: groupOf, feeHeld: function(){ return feeHeld; } };
})();
