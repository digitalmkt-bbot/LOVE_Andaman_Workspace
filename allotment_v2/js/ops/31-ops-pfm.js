/* ══════════════════════════════════════════════════════════════════════════
   §opsPfm · Daily PFM ⇄ operation-backend
   ──────────────────────────────────────────────────────────────────────────
   Daily PFM loads its rows and totals from GET /v1/pfm?from=&to= and uses
   versioned booking commands for travel extension and hold, plus the bulk
   reminder command. Invoice creation, payment recording, payment corrections,
   and invoice voiding go through the M1 adapter (30-ops-money.js). No write
   to bk.ops.pfm or bk.paymentSlips[] is performed in operations mode.

   GET  /v1/pfm?from=YYYY-MM-DD&to=YYYY-MM-DD
   POST /v1/bookings/:id/pfm/approve-travel  { approver|extended_by|extendedBy }
   POST /v1/bookings/:id/pfm/hold            {}
   POST /v1/pfm/remind                       { from, to }
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  var state = {
    cache: {},
    loading: {},
    byClientId: {},
    byServerId: {},
    lastKey: ''
  };
  var originals = {};

  function enabled(){ return !!(O.enabled && O.enabled()); }
  function enc(v){ return encodeURIComponent(v == null ? '' : String(v)); }
  function text(v){ return v == null ? '' : String(v).trim(); }
  function num(v){ var n = Number(v); return Number.isFinite(n) ? n : 0; }

  function listBookings(){ return typeof SB_BOOKINGS !== 'undefined' && Array.isArray(SB_BOOKINGS) ? SB_BOOKINGS : []; }

  function findBooking(id){
    var s = text(id);
    if(!s) return null;
    return listBookings().find(function(b){ return b && (b.id === s || b.opsId === s); }) || null;
  }
  function toServerBookingId(id){
    var s = text(id);
    if(!s) return '';
    var row = state.byClientId[s] || state.byServerId[s];
    if(row && row.booking_id) return row.booking_id;
    var bk = findBooking(s);
    return (bk && bk.opsId) ? bk.opsId : s;
  }
  function toClientBookingId(id){
    var s = text(id);
    if(!s) return '';
    var bk = findBooking(s);
    return (bk && bk.id) ? bk.id : s;
  }

  function bookingVersionRef(bkId){
    var bk = findBooking(bkId);
    var row = state.byClientId[bkId] || state.byServerId[bkId];
    if(bk){
      if(row && row.version != null && bk.opsVersion == null) bk.opsVersion = +row.version;
      if(row && row.booking_id && !bk.opsId) bk.opsId = row.booking_id;
      return bk;
    }
    if(row){
      return { id: toClientBookingId(row.booking_id), opsId: row.booking_id, opsVersion: row.version != null ? +row.version : null };
    }
    return { id: bkId, opsId: bkId, opsVersion: null };
  }

  function mapRow(r){
    r = r || {};
    var cid = toClientBookingId(r.booking_id);
    var d = r.decision ? {
      decision: r.decision.decision,
      approver: r.decision.approver || null,
      extendedBy: r.decision.approver || r.decision.by || null,
      by: r.decision.by || null,
      at: r.decision.at || ''
    } : null;
    var mapped = {
      booking_id: r.booking_id,
      clientId: cid,
      version: r.version != null ? +r.version : null,
      voucher_ref: r.voucher_ref || null,
      agent_id: r.agent_id || null,
      agent_name: r.agent_name || null,
      sales_name: r.sales_name || null,
      kind: r.kind || 'proforma',
      travel_date: r.travel_date || '',
      route_id: r.route_id || '',
      pax: num(r.pax),
      cutoff_at: r.cutoff_at || '',
      past_cutoff: !!r.past_cutoff,
      total: num(r.total),
      paid: num(r.paid),
      balance: num(r.balance),
      invoice: r.invoice ? { id: r.invoice.id, number: r.invoice.number, status: r.invoice.status } : null,
      status: r.status || 'no_invoice',
      decision: d,
      reminded_at: r.reminded_at || null,
      cot_deduct: num(r.cot_deduct)
    };
    state.byClientId[cid] = mapped;
    state.byServerId[r.booking_id] = mapped;
    var bk = findBooking(cid);
    if(bk && mapped.version != null) bk.opsVersion = mapped.version;
    return mapped;
  }

  function applyGridResponse(key, data){
    data = data || {};
    var rows = (Array.isArray(data.rows) ? data.rows : []).map(mapRow);
    var entry = {
      from: data.from || '',
      to: data.to || '',
      rows: rows,
      totals: data.totals || { count: rows.length, total: 0, paid: 0, unpaid: 0, collected_pct: 0, alert: 0, by_status: {} }
    };
    state.cache[key] = entry;
    state.lastKey = key;
    return entry;
  }

  function currentRange(){
    var date = typeof _pfmDate !== 'undefined' && _pfmDate ? _pfmDate : O.today();
    var mode = typeof _pfmMode !== 'undefined' && _pfmMode ? _pfmMode : 'month';
    if(typeof window.pfmPeriodRange === 'function') return window.pfmPeriodRange(date, mode);
    return { from: date, to: date };
  }

  function loadRange(from, to, force){
    if(!enabled()) return Promise.resolve(null);
    var key = String(from) + '..' + String(to);
    if(!force && state.cache[key]) return Promise.resolve(state.cache[key]);
    if(state.loading[key]) return state.loading[key];
    var mLoad = (O.money && typeof O.money.ensureLoaded === 'function') ? O.money.ensureLoaded().catch(function(){}) : Promise.resolve();
    var p = mLoad.then(function(){
      return O.get('/v1/pfm', { from: from, to: to });
    }).then(function(res){
      return applyGridResponse(key, res);
    }).finally(function(){
      delete state.loading[key];
    });
    state.loading[key] = p;
    return p;
  }

  function refreshCurrent(){
    var r = currentRange();
    return loadRange(r.from, r.to, true).then(function(entry){
      if(typeof window.renderDailyPFM === 'function' && document.getElementById('dailypfm-host')){
        window.renderDailyPFM();
      }
      return entry;
    });
  }

  function toApproveBody(approver){
    return { approver: text(approver) };
  }
  function toRemindBody(from, to){
    return { from: text(from), to: text(to) };
  }

  function approveTravelServer(bkId, approver){
    var sid = toServerBookingId(bkId);
    var bkRef = bookingVersionRef(bkId);
    var body = toApproveBody(approver);
    return O.queue(function(){
      return O.bookingWrite('POST', '/v1/bookings/' + enc(sid) + '/pfm/approve-travel', bkRef, body);
    }).then(function(row){
      if(row && row.booking_id) mapRow(row);
      O.wrote('pfm-approve-travel');
      return refreshCurrent();
    }, function(e){
      O.fail('Could not approve travel', e);
      throw e;
    });
  }

  function holdServer(bkId){
    var sid = toServerBookingId(bkId);
    var bkRef = bookingVersionRef(bkId);
    return O.queue(function(){
      return O.bookingWrite('POST', '/v1/bookings/' + enc(sid) + '/pfm/hold', bkRef, {});
    }).then(function(row){
      if(row && row.booking_id) mapRow(row);
      O.wrote('pfm-hold');
      return refreshCurrent();
    }, function(e){
      O.fail('Could not put booking on hold', e);
      throw e;
    });
  }

  function remindServer(from, to){
    var body = toRemindBody(from, to);
    return O.queue(function(){
      return O.post('/v1/pfm/remind', body);
    }).then(function(res){
      O.wrote('pfm-remind');
      return refreshCurrent().then(function(){ return res; });
    }, function(e){
      O.fail('Could not send PFM reminders', e);
      throw e;
    });
  }

  function syntheticBookingForRow(r){
    var bk = findBooking(r.clientId || r.booking_id);
    var base = bk ? Object.assign({}, bk) : {
      id: r.clientId || r.booking_id,
      opsId: r.booking_id,
      opsVersion: r.version,
      voucherRef: r.voucher_ref || r.booking_id,
      code: r.voucher_ref || r.booking_id,
      agentId: r.agent_id,
      status: 'confirmed',
      total: r.total,
      trips: [{ routeId: r.route_id, date: r.travel_date, pax: { ad: r.pax } }]
    };
    base.ops = Object.assign({}, base.ops || {});
    if(r.decision){
      base.ops.pfm = {
        decision: r.decision.decision,
        extendedBy: r.decision.approver || r.decision.by || '',
        by: r.decision.by || '',
        at: r.decision.at || ''
      };
    } else if(r.reminded_at){
      base.ops.pfm = { remindedAt: r.reminded_at };
    } else {
      delete base.ops.pfm;
    }
    return base;
  }

  function wrap(name, fn){
    var orig = window[name];
    originals[name] = orig;
    var w = function(){
      if(!enabled()) return typeof orig === 'function' ? orig.apply(this, arguments) : undefined;
      return fn.apply(this, [orig].concat([].slice.call(arguments)));
    };
    w.__opsPfm = true;
    window[name] = w;
  }

  wrap('pfmBookingsForPeriod', function(orig, date, mode){
    var r = typeof window.pfmPeriodRange === 'function' ? window.pfmPeriodRange(date, mode || 'daily') : { from: date, to: date };
    var key = String(r.from) + '..' + String(r.to);
    var entry = state.cache[key];
    if(entry && Array.isArray(entry.rows)){
      return entry.rows.map(syntheticBookingForRow);
    }
    return orig.apply(this, [].slice.call(arguments, 1));
  });

  wrap('pfmIsProforma', function(orig, bk){
    var row = bk && (state.byClientId[bk.id] || state.byServerId[bk.opsId || bk.id]);
    if(row) return row.kind === 'proforma';
    return orig.apply(this, [].slice.call(arguments, 1));
  });

  wrap('pfmSalesName', function(orig, bk){
    var row = bk && (state.byClientId[bk.id] || state.byServerId[bk.opsId || bk.id]);
    if(row && row.sales_name) return row.sales_name;
    return orig.apply(this, [].slice.call(arguments, 1));
  });

  wrap('pfmCotWarn', function(orig, bk){
    var row = bk && (state.byClientId[bk.id] || state.byServerId[bk.opsId || bk.id]);
    if(row){
      return row.cot_deduct > 0 ? { deduct: row.cot_deduct } : null;
    }
    return orig.apply(this, [].slice.call(arguments, 1));
  });

  wrap('acctBookingTotal', function(orig, bk){
    var row = bk && (state.byClientId[bk.id] || state.byServerId[bk.opsId || bk.id]);
    if(row && typeof row.total === 'number') return row.total;
    return orig.apply(this, [].slice.call(arguments, 1));
  });

  wrap('renderDailyPFM', function(orig){
    var self = this, args = [].slice.call(arguments, 1);
    var r = currentRange();
    var key = String(r.from) + '..' + String(r.to);
    if(!state.cache[key]){
      var host = document.getElementById('dailypfm-host');
      if(host && !state.loading[key]){
        host.innerHTML = O.loadingHtml('Loading Daily PFM…');
      }
      return loadRange(r.from, r.to, false).then(function(){
        return orig.apply(self, args);
      }, function(e){
        O.fail('Daily PFM did not load', e);
        if(host) host.innerHTML = '<div style="padding:32px;text-align:center;color:#A32D2D">Daily PFM did not load from operation-backend.</div>';
      });
    }
    return orig.apply(self, args);
  });

  wrap('pfmApproveTravel', function(orig, bkId){
    var row = state.byClientId[bkId] || state.byServerId[bkId];
    var bk = findBooking(bkId);
    var def = (row && row.sales_name) || (bk && typeof window.pfmSalesName === 'function' ? window.pfmSalesName(bk) : '—');
    var who = prompt('EXTEND travel for an UNPAID proforma booking (past 18:00 cutoff).\nWho is approving this? (salesperson)', def !== '—' ? def : '');
    if(who === null) return null;
    var by = text(who) || (def !== '—' ? def : '');
    return approveTravelServer(bkId, by).catch(function(){ return null; });
  });

  wrap('pfmHold', function(orig, bkId){
    if(!confirm('Mark this booking ON HOLD (do not travel until paid)?')) return null;
    return holdServer(bkId).catch(function(){ return null; });
  });

  wrap('pfmRemindAll', function(){
    var r = currentRange();
    return remindServer(r.from, r.to).then(function(res){
      var n = (res && Array.isArray(res.reminded)) ? res.reminded.length : 0;
      if(!n) alert('No unpaid bookings to remind.');
      else alert('Logged a payment reminder on ' + n + ' unpaid booking(s).');
      return res;
    }).catch(function(){ return null; });
  });

  wrap('pfmIssueInvoice', function(orig, bkId){
    var row = state.byClientId[bkId] || state.byServerId[bkId];
    var bk = findBooking(bkId);
    var agentId = (row && row.agent_id) || (bk && bk.agentId);
    if(!agentId) return null;
    if(typeof window.acctBookingInvoice === 'function' && window.acctBookingInvoice(bkId)){
      alert('Invoice already exists for this booking');
      return null;
    }
    if(O.money && typeof O.money.createInvoice === 'function'){
      return O.money.createInvoice(agentId, [bkId], { kind: 'booking' }).then(function(inv){
        return refreshCurrent().then(function(){ return inv; });
      }).catch(function(){ return null; });
    }
    return null;
  });

  wrap('pfmIssueAll', function(){
    var r = currentRange();
    var key = String(r.from) + '..' + String(r.to);
    var entry = state.cache[key];
    var rows = (entry && entry.rows) || [];
    var todo = rows.filter(function(x){ return x.kind === 'proforma' && !x.invoice && !(typeof window.acctBookingInvoice === 'function' && window.acctBookingInvoice(x.clientId)); });
    if(!todo.length){ alert('All bookings already have a PFM invoice.'); return null; }
    if(!confirm('Issue PFM invoices for ' + todo.length + ' booking(s)?')) return null;
    var ops = todo.map(function(x){
      return function(){
        return O.money.createInvoice(x.agent_id, [x.clientId], { kind: 'booking' });
      };
    });
    return ops.reduce(function(p, fn){ return p.then(fn); }, Promise.resolve()).then(function(){
      return refreshCurrent();
    }).catch(function(){ return refreshCurrent(); });
  });

  /* The chart under the list (pfmChartBuckets): legacy sums the bookings this browser has loaded, so it could
     disagree with the list. Each bucket's total / paid / unpaid is the server's totals for its dates
     (GET /v1/pfm?from=&to=, the same rows as the list). The legacy sum shows until the answer is in; a changed
     bucket redraws the page once. Buckets are cached for 30 s and cleared when invoices or bookings change. */
  var chartCache = {};
  O.onWrite(function(kind){ if(kind && /^invoice|^deposit|^refund|^booking|^pfm/.test(kind)) chartCache = {}; });
  O.onChange(function(change){ if(change && ['booking', 'invoice', 'payment', 'pfm'].indexOf(change.entity_type) >= 0) chartCache = {}; });
  wrap('pfmChartBuckets', function(orig){
    var out = orig.apply(this, [].slice.call(arguments, 1));
    (out || []).forEach(function(b){
      var k = b.from + '..' + b.to, c = chartCache[k];
      if(c && c.totals){ b.tot = num(c.totals.total); b.paid = num(c.totals.paid); b.unpaid = num(c.totals.unpaid); }
      if(c && (c.loading || Date.now() - c.at < 30000)) return;
      var cell = chartCache[k] = { totals: c && c.totals, at: c ? c.at : 0, loading: true };
      O.get('/v1/pfm', { from: b.from, to: b.to }).then(function(j){
        var t = (j && j.totals) || {}, was = cell.totals;
        var changed = !was || num(was.total) !== num(t.total) || num(was.paid) !== num(t.paid) || num(was.unpaid) !== num(t.unpaid);
        chartCache[k] = { totals: t, at: Date.now(), loading: false };
        if(changed && typeof window.renderDailyPFM === 'function' && document.getElementById('dailypfm-host') && !(O.busy && O.busy())) window.renderDailyPFM();
      }, function(e){ chartCache[k] = { totals: cell.totals, at: Date.now(), loading: false }; try{ console.warn('[ops] PFM chart did not load · ' + (e && e.message)); }catch(_){} });
    });
    return out;
  });

  wrap('pfmRecSubmit', function(){
    var r = typeof _pfmRec !== 'undefined' ? _pfmRec : null;
    if(!r) return null;
    var amt = Math.max(0, num(r.amount));
    if(amt <= 0){ alert('ใส่จำนวนเงินก่อน'); return null; }
    var method = r.method || 'transfer';
    var slips = Array.isArray(r.slips) ? r.slips : [];
    var opt = { ref: r.ref, slips: slips };
    var p;
    if(r.prepay && !r.invId){
      var bk = findBooking(r.bkId);
      var row = state.byClientId[r.bkId] || state.byServerId[r.bkId];
      var agentId = (bk && bk.agentId) || (row && row.agent_id);
      if(!agentId){ _pfmRec = null; return null; }
      p = O.money.createInvoice(agentId, [r.bkId], { kind: 'prepay', note: 'prepay' }).then(function(inv){
        return O.money.recordPayment(inv.id, amt, method, opt);
      });
    } else {
      p = O.money.recordPayment(r.invId, amt, method, opt);
    }
    return p.then(function(){
      // Do NOT write bk.paymentSlips[] or call acctPersistBookings() in ops mode.
      _pfmRec = null;
      return refreshCurrent();
    }).catch(function(){ return null; });
  });

  O.onWrite(function(kind){
    if(kind && /^invoice|^deposit|^refund/.test(kind)){
      state.cache = {};
    }
  });
  O.onChange(function(change){
    if(!change) return;
    if(['booking', 'invoice', 'payment', 'pfm'].indexOf(change.entity_type) >= 0){
      state.cache = {};
    }
  });

  var api = {
    load: function(from, to){ return loadRange(from, to, true); },
    refresh: refreshCurrent,
    approveTravel: approveTravelServer,
    hold: holdServer,
    remind: remindServer,
    clear: function(){ state.cache = {}; state.byClientId = {}; state.byServerId = {}; }
  };

  O.pfm = api;
  window.laOpsPfm = api;
  window.__laOpsPfmCompat = {
    mapRow: mapRow,
    toApproveBody: toApproveBody,
    toRemindBody: toRemindBody
  };
})();
