/* ══════════════════════════════════════════════════════════════════════════
   §opsPierMoney · money collected at the pier ⇄ operation-backend
   ──────────────────────────────────────────────────────────────────────────
   The amount a booking still owes at the pier (legacy pckMoney) is computed by the
   server. The browser keeps only the display shape: pckMoney() is wrapped so the numbers
   come from the day's server rows and nothing is added up in the browser.

   GET    /v1/pier-money?date=                         every booking of the day
   GET    /v1/bookings/:id/pier-money?date=            one booking, with its payments
   POST   /v1/bookings/:id/pier-payments               409 overpayment -> overpay_anyway
   POST   /v1/bookings/:id/pier-payments/:pid/slips
   DELETE /v1/bookings/:id/pier-payments/:pid

   Load order: after 42/43/47 pier files, before 90-ops-boot.js. Classic script.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  var days = {};            // date -> { at, rows:{bookingId:row}, loading }
  var TTL = 15000;
  var originals = {};

  function enabled(){ return !!(O.enabled && O.enabled()); }
  function enc(v){ return encodeURIComponent(v == null ? '' : String(v)); }
  function n(v){ var x = Number(v); return Number.isFinite(x) ? x : 0; }
  function list(){ return typeof SB_BOOKINGS !== 'undefined' && Array.isArray(SB_BOOKINGS) ? SB_BOOKINGS : []; }
  function find(id){ return list().filter(function(b){ return b && (b.id === id || b.opsId === id); })[0] || null; }
  function sid(b){ return b && b.opsId ? b.opsId : ''; }
  function curDate(){ try{ return typeof _pckDate !== 'undefined' ? _pckDate : ''; }catch(_){ return ''; } }

  /* ── the day's rows ── */
  function loadDay(date, force){
    var d = days[date] || (days[date] = { at: 0, rows: {}, loading: null, sig: '' });
    if(d.loading) return d.loading;
    if(!force && d.at && Date.now() - d.at < TTL) return Promise.resolve(d);
    d.loading = O.get('/v1/pier-money', { date: date }).then(function(res){
      var rows = {};
      ((res && res.rows) || []).forEach(function(r){ rows[r.booking_id] = r; });
      var sig = JSON.stringify(res && res.rows || []);
      var changed = sig !== d.sig;
      d.rows = rows; d.sig = sig; d.at = Date.now(); d.loading = null;
      return changed;
    }, function(e){
      d.at = Date.now(); d.loading = null;          // do not hammer a failing server
      O.fail('Pier money could not load', e);
      return false;
    });
    return d.loading.then(function(changed){
      if(changed === true && curDate() === date && typeof window.renderPierCheckin === 'function') window.renderPierCheckin();
      return d;
    });
  }
  function rowFor(b, date){
    var d = days[date]; if(!d || !b) return null;
    return d.rows[sid(b)] || null;
  }
  function putRow(date, row){
    var d = days[date] || (days[date] = { at: 0, rows: {}, loading: null, sig: '' });
    d.rows[row.booking_id] = row; d.at = Date.now(); d.sig = '';
  }

  /* server payments -> the legacy b.pierPayments entries for that day */
  function mirror(b, date, row){
    if(!b || !row) return;
    var keep = (Array.isArray(b.pierPayments) ? b.pierPayments : []).filter(function(p){ return p && p.date !== date; });
    (row.payments || []).filter(function(p){ return !p.deleted_at; }).forEach(function(p){
      keep.push({ id: p.id, date: p.service_date, amount: n(p.amount), method: p.method, fee: n(p.fee),
        feePct: p.fee_pct == null ? null : n(p.fee_pct), note: p.note || '',
        slips: (p.slips || []).map(function(s){ return { id: s.id, name: s.name, mime: s.mime, size: s.size }; }),
        by: p.by || '', at: p.at });
    });
    b.pierPayments = keep;
    if(row.version != null) b.opsVersion = +row.version;
  }
  function loadOne(b, date){
    return O.get('/v1/bookings/' + enc(sid(b)) + '/pier-money', { date: date }).then(function(row){
      putRow(date, row); mirror(b, date, row); return row;
    });
  }

  /* ── wrappers ── */
  function wrap(name, fn){
    var orig = window[name];
    originals[name] = orig;
    var w = function(){
      if(!enabled()) return typeof orig === 'function' ? orig.apply(this, arguments) : undefined;
      return fn.apply(this, [orig].concat([].slice.call(arguments)));
    };
    w.__opsPierMoney = true;
    window[name] = w;
  }

  // the sheet repaints from the server's rows; fetch them once per few seconds
  wrap('renderPierCheckin', function(orig){
    var out = orig.apply(this, [].slice.call(arguments, 1));
    var date = curDate();
    if(date) loadDay(date, false);
    return out;
  });

  // legacy pckMoney's shape, filled from the server row (no money added up here)
  wrap('pckMoney', function(orig, b, date){
    var m = orig(b, date);
    var r = rowFor(b, date);
    if(!r || !m) return m;
    var exCov = n(m.exCov);
    m.cot = n(r.cot); m.cur = r.cot_currency || m.cur; m.handling = r.cot_handling || ''; m.note = r.cot_note || '';
    m.upDue = n(r.upgrades_due); m.upGot = n(r.upgrades_got); m.balance = n(r.b2c_balance);
    m.exDue = n(r.tour_sales_due); m.exGot = n(r.tour_sales_got); m.extrasTot = m.exGot + m.exDue + exCov;
    m.gross = n(r.gross); m.pierPaid = n(r.paid); m.pierFee = n(r.fees); m.due = n(r.due); m.got = n(r.got);
    m.noSlip = n(r.no_slip);
    // payment terms and the B2C paid state as the server states them (feeds pckCotUnset and the pay chips)
    if(r.term != null) m.term = String(r.term);
    m.paidState = r.paid_status ? String(r.paid_status) : '';
    m.ovnSettled = !!r.overnight_return;
    return m;
  });

  // paid / fees / no_slip of the day: the server row's (live pier payments), not b.pierPayments, which is only
  // filled for bookings whose pay box was opened. Without a date or a row the legacy sum stays.
  [['pckPaidSum', 'paid'], ['pckFeeSum', 'fees'], ['pckNoSlip', 'no_slip']].forEach(function(p){
    wrap(p[0], function(orig, b, date){
      var r = date ? rowFor(b, date) : null;
      return r && r[p[1]] != null ? n(r[p[1]]) : orig.apply(this, [].slice.call(arguments, 1));
    });
  });

  wrap('pckPayOpen', function(orig, bkId, thenCk){
    var b = find(bkId), date = curDate();
    var args = [].slice.call(arguments, 1);
    if(!b || !sid(b)) return orig.apply(this, args);
    var self = this;
    return loadOne(b, date).then(function(){ return orig.apply(self, args); }, function(e){ O.fail('Pier money could not load', e); });
  });

  wrap('pckPaySave', function(orig){
    var P = typeof _pckPay !== 'undefined' ? _pckPay : null; if(!P) return;
    var b = find(P.bkId); if(!b) return;
    var use = P.lines.filter(function(L){ return n(L.amt) > 0; });
    if(!use.length){ alert('Enter an amount first'); return; }
    if(!sid(b)){ alert('This booking is not on the server yet'); return; }
    var date = P.date, thenCk = !!P.thenCk, bkId = P.bkId;
    var lines = use.map(function(L){
      var line = { method: L.m, amount: n(L.amt), note: String(L.note || ''),
        slip_ids: (L.slips || []).map(function(s){ return s && s.id ? s.id : s; }) };
      if(L.m === 'card'){
        if(L.feeMode === 'pct') line.fee_pct = n(L.feePct); else line.fee = n(L.fee);
      }
      return line;
    });
    return O.queue(function(){
      return O.anyway(function(extra){
        return O.bookingWrite('POST', '/v1/bookings/' + enc(sid(b)) + '/pier-payments', b,
          Object.assign({ service_date: date, lines: lines }, extra));
      }, { overpayment: { flag: 'overpay_anyway' } });
    }).then(function(row){
      putRow(date, row); mirror(b, date, row);
      var M = window.pckMoney(b, date);
      var Q = typeof _pckPay !== 'undefined' ? _pckPay : null;
      if(Q){
        if(M.due > 0){ Q.lines = [window.pckLineNew(M.due)]; window.pckPayRender();
          if(typeof window.renderPierCheckin === 'function') window.renderPierCheckin(); return; }
      }
      if(typeof acctModalClose === 'function') acctModalClose();
      var ck = (typeof ckRead === 'function') ? (ckRead(b, date, 'pier') || {}) : {};
      if(thenCk && !ck.at && typeof ckToggle === 'function'){
        try{ _pckPaySkip[date + '::' + bkId] = 1; }catch(_){}
        ckToggle(bkId, date, 'pier'); return;
      }
      if(typeof window.renderPierCheckin === 'function') window.renderPierCheckin();
    }, function(e){
      if(!e.declined) O.fail('Pier payment was refused', e);
    });
  });

  wrap('pckPayDel', function(orig, payId){
    var P = typeof _pckPay !== 'undefined' ? _pckPay : null; if(!P) return;
    var b = find(P.bkId); if(!b) return;
    if(!confirm('Delete this payment?')) return;
    var date = P.date;
    return O.queue(function(){
      return O.bookingWrite('DELETE', '/v1/bookings/' + enc(sid(b)) + '/pier-payments/' + enc(payId), b);
    }).then(function(row){
      putRow(date, row); mirror(b, date, row);
      if(typeof window.pckPayRender === 'function') window.pckPayRender();
      if(typeof window.renderPierCheckin === 'function') window.renderPierCheckin();
    }, function(e){ O.fail('Pier payment was not deleted', e); });
  });

  wrap('pckPayAddSlip', function(orig, payId, inp){
    var P = typeof _pckPay !== 'undefined' ? _pckPay : null; if(!P) return;
    var f = (inp && inp.files && inp.files[0]) || null; if(inp) inp.value = '';
    if(!f) return;
    var b = find(P.bkId); if(!b || !sid(b)) return;
    var date = P.date;
    window.pckSlipUpload(f, b.id, function(meta){
      O.queue(function(){
        return O.bookingWrite('POST', '/v1/bookings/' + enc(sid(b)) + '/pier-payments/' + enc(payId) + '/slips', b, { slip_ids: [meta.id] });
      }).then(function(row){
        putRow(date, row); mirror(b, date, row);
        if(typeof window.pckPayRender === 'function') window.pckPayRender();
        if(typeof window.renderPierCheckin === 'function') window.renderPierCheckin();
      }, function(e){ O.fail('Slip was not attached', e); });
    });
  });

  // other people's writes: drop the cache so the next repaint asks again
  O.onChange(function(){ Object.keys(days).forEach(function(k){ days[k].at = 0; }); });

  window.laOpsPierMoney = { loadDay: loadDay, rowFor: rowFor, originals: originals };
})();
