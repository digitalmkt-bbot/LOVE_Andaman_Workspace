/* ══════════════════════════════════════════════════════════════════════════
   §opsReconfirm · ops-board re-confirmation ⇄ operation-backend
   ──────────────────────────────────────────────────────────────────────────
   Wired (ops mode only; legacy mode calls the original functions untouched):
   - bookingV2Reconfirm(bkId, via)        → PUT    /v1/bookings/:id/reconfirm
       body { status: 'done', via: 'list' | 'phone' }
   - bookingV2ReconfirmClear(bkId)        → DELETE /v1/bookings/:id/reconfirm?all=true
       (legacy drops the whole record, so `all=true`)
   - bookingV2ReconfirmAll(date, rid, via) → one PUT per un-confirmed, live
       booking of that route/day, run one at a time through laOps.queue.
   Route/body source: operation-backend src/routes/operations.ts (reconfirm
   handlers) and src/domain/reconfirm.ts (parseReconfirmStatus, withStatus,
   withoutStatus). Reconfirm is a day-of write: it is NOT versioned, so it goes
   through laOps.call, never laOps.bookingWrite.

   Not wired here (route is confirmed, but the UI path is not in this packet):
   the Re-confirm page status picker (rcSetStatus), agent send/unsend
   (rcSendAgent / rcUnsendAgent → POST /v1/reconfirm/sent), rcToggleBooking.

   Projection: the server's `reconfirm` object becomes legacy `bk.ops.reconfirm`
   `{status, via, at, by, sent, sentAt, sentBy}` (null when the server has none).
   Server first: no local state changes before the server answers.
   Load order: after 36-ops-day-actions.js, before 90-ops-boot.js. Classic script.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  var originals = {};

  function enabled(){ return !!(O.enabled && O.enabled()); }
  function enc(v){ return encodeURIComponent(v == null ? '' : String(v)); }
  function text(v){ return v == null ? '' : String(v).trim(); }

  function listBookings(){ return typeof SB_BOOKINGS !== 'undefined' && Array.isArray(SB_BOOKINGS) ? SB_BOOKINGS : []; }
  function findBooking(id){
    var s = text(id);
    if(!s) return null;
    return listBookings().find(function(b){ return b && (b.id === s || b.opsId === s); }) || null;
  }
  function toServerBookingId(id){
    var bk = findBooking(id);
    return (bk && bk.opsId) ? bk.opsId : text(id);
  }

  // Server reconfirm → legacy bk.ops.reconfirm shape (the one the Re-confirm page reads).
  function reconfirmFromServer(r){
    if(!r) return null;
    return {
      status: r.status || '',
      via: r.via || 'reconfirm',
      at: r.at || '',
      by: r.by || '',
      sent: !!r.sent,
      sentAt: r.sent_at || '',
      sentBy: r.sent_by || ''
    };
  }

  // Put the returned booking into the projection, then pin the reconfirm field explicitly
  // (the booking mapper may or may not run for an unchanged copy).
  function applyBookingResponse(ob){
    if(!ob || !ob.id) return null;
    if(O.bookings && typeof O.bookings.upsert === 'function') O.bookings.upsert(ob);
    var bk = findBooking(ob.external_id || ob.id) || findBooking(ob.id);
    if(bk){
      bk.ops = bk.ops || {};
      bk.ops.reconfirm = reconfirmFromServer(ob.reconfirm);
      bk.reconfirm = ob.reconfirm ? { sentAt: ob.reconfirm.sent_at || '', sentBy: ob.reconfirm.sent_by || '' } : null;
    }
    return bk;
  }

  function redraw(){
    if(typeof window.bookingV2Render === 'function') window.bookingV2Render();
  }

  // ── PUT /v1/bookings/:id/reconfirm ──
  function setReconfirmServer(bkId, via){
    var sid = toServerBookingId(bkId);
    var v = via === 'phone' ? 'phone' : 'list';
    var body = { status: 'done', via: v };
    return O.queue(function(){
      return O.call('PUT', '/v1/bookings/' + enc(sid) + '/reconfirm', body);
    }).then(function(ob){
      applyBookingResponse(ob);
      O.wrote('booking-reconfirm');
      redraw();
      return ob;
    }, function(e){
      O.fail('Could not save re-confirm', e);
      throw e;
    });
  }

  // ── DELETE /v1/bookings/:id/reconfirm?all=true ──
  function clearReconfirmServer(bkId){
    var sid = toServerBookingId(bkId);
    return O.queue(function(){
      return O.call('DELETE', '/v1/bookings/' + enc(sid) + '/reconfirm?all=true');
    }).then(function(ob){
      applyBookingResponse(ob);
      O.wrote('booking-reconfirm-clear');
      redraw();
      return ob;
    }, function(e){
      O.fail('Could not clear re-confirm', e);
      throw e;
    });
  }

  // Legacy bulk filter, kept identical: live bookings on that route/day that are not yet 'done'.
  var DEAD = ['cancelled', 'rejected', 'cancelled_weather'];
  function bulkTargets(date, rid){
    return listBookings().filter(function(b){
      if(!b || DEAD.indexOf(b.status) >= 0) return false;
      if(b.ops && b.ops.reconfirm && b.ops.reconfirm.status === 'done') return false;
      return (b.trips || []).some(function(t){ return (t.date || '') === date && t.routeId === rid; });
    });
  }

  // ── Bulk: one PUT per booking, in order, each applied only after its own success ──
  function setReconfirmAllServer(date, rid, via){
    var v = via === 'phone' ? 'phone' : 'list';
    var ids = bulkTargets(date, rid).map(function(b){ return b.id; });
    var done = 0;
    var chain = Promise.resolve();
    ids.forEach(function(localId){
      chain = chain.then(function(){
        var sid = toServerBookingId(localId);
        return O.queue(function(){
          return O.call('PUT', '/v1/bookings/' + enc(sid) + '/reconfirm', { status: 'done', via: v });
        }).then(function(ob){
          applyBookingResponse(ob);
          done++;
        });
      });
    });
    return chain.then(function(){
      O.wrote('booking-reconfirm-all');
      redraw();
      return done;
    }, function(e){
      // bookings before the failure are already applied and stay; the rest are not touched
      if(done) O.wrote('booking-reconfirm-all');
      redraw();
      O.fail('Could not re-confirm every booking (' + done + ' of ' + ids.length + ' saved)', e);
      throw e;
    });
  }

  function wrap(name, fn){
    var orig = window[name];
    originals[name] = orig;
    var w = function(){
      if(!enabled()) return typeof orig === 'function' ? orig.apply(this, arguments) : undefined;
      return fn.apply(this, [orig].concat([].slice.call(arguments)));
    };
    w.__opsReconfirm = true;
    window[name] = w;
  }

  wrap('bookingV2Reconfirm', function(orig, bkId, via){
    return setReconfirmServer(bkId, via).catch(function(){ return null; });
  });

  wrap('bookingV2ReconfirmClear', function(orig, bkId){
    return clearReconfirmServer(bkId).catch(function(){ return null; });
  });

  wrap('bookingV2ReconfirmAll', function(orig, date, rid, via){
    if(!window.confirm('Mark ALL un-confirmed bookings on this trip as re-confirmed (' + (via === 'phone' ? 'phone' : 'list') + ')?')) return null;
    return setReconfirmAllServer(date, rid, via).catch(function(){ return null; });
  });

  var api = {
    setReconfirm: setReconfirmServer,
    clearReconfirm: clearReconfirmServer,
    setReconfirmAll: setReconfirmAllServer,
    reconfirmFromServer: reconfirmFromServer
  };
  O.reconfirm = api;
  window.laOpsReconfirm = api;
  window.__laOpsReconfirmCompat = { reconfirmFromServer: reconfirmFromServer, bulkTargets: bulkTargets };
})();
