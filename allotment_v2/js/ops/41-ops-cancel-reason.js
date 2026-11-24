/* ═════════════════════════════════════════════════════════════════════════
   §cxWhy (lk-inbox 31a227c2) · a booking cancelled without a reason (almost all Love Kingdom's: the B2C sync
   cancels when the customer does, and nobody picks a reason) is given one from the Booking screen's red bar
   or its detail card. Legacy's cxwSave wrote it into the blob; here
     POST /v1/bookings/{id}/cancel-reason  { category, note? }   (If-Match, laOps.bookingWrite)
   sets only the reason (operation-backend's planCancelReason: no charge, invoice, seat or lock moves), and its
   answer replaces the booking, so cxwNeed is false and the bar and the card go by themselves.

   The list (legacy cxwList: every booking, last trip at most 60 days ago) is the server's:
     GET /v1/bookings/cancelled-without-reason[?pier=]   (operation-backend's cancelled-no-reason.ts)
   Legacy counted SB_BOOKINGS, which on main is only what this browser loaded (9 of 54 locally). The bar, the
   tab badge and the dialog (cxwBanner, cxwTabBadge, cxwRender) stay legacy's markup; cxwList answers from the
   server's rows, shaped as the booking objects they read (id, voucherRef, leadPax, trips[0].routeId, the last
   trip date, pax, cancelledAt). Until the first answer the list is empty; the answer redraws the screen.
   §pierScope: a pier login sends its pier (laMyPier), as legacy's laBkOk filtered.
   ═════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps;
  if(!O) return;
  var enc = encodeURIComponent;
  var TTL = 60000;
  var list = { rows: null, at: 0, loading: null, sig: '' };

  function myPier(){ try{ return typeof window.laMyPier === 'function' ? (window.laMyPier() || '') : ''; }catch(_){ return ''; } }
  /* a server row → the booking object legacy's cxw* helpers read */
  function shaped(r){
    return { id: r.external_id || r.id, opsId: r.id, opsVersion: r.version, status: 'cancelled',
      code: r.code || '', voucherRef: r.voucher_ref || '', leadPax: r.lead_pax || '', agentId: r.agent_id || '',
      cancelledAt: r.cancelled_at || '', cxwB2C: !!r.b2c, cxwServer: true,
      trips: [{ routeId: r.route_id || '', date: r.last_date || '', pax: { ad: +r.pax || 0 } }] };
  }
  function sigOf(rows){ return rows.map(function(b){ return b.opsId + ':' + b.opsVersion; }).join('|'); }
  function modalShowsList(){
    var ov = document.getElementById('acct-modal');
    return !!(ov && !window._cxwOnly && String(ov.innerHTML || '').indexOf('ระบุเหตุผลการยกเลิก') >= 0);
  }
  function redraw(){
    try{ if(typeof window.cxwRender === 'function') window.cxwRender(); }catch(_){}
    try{ if(typeof window.bookingV2Render === 'function') window.bookingV2Render(); }catch(_){}
  }
  function load(force){
    if(list.loading) return list.loading;
    if(!force && list.rows && (Date.now() - list.at) < TTL) return Promise.resolve(list.rows);
    var q = {}; var p = myPier(); if(p) q.pier = p;
    list.loading = O.get('/v1/bookings/cancelled-without-reason', q).then(function(res){
      var rows = ((res && res.bookings) || []).map(shaped), sig = sigOf(rows), changed = sig !== list.sig || !list.rows;
      list.rows = rows; list.sig = sig; list.at = Date.now(); list.loading = null;
      if(changed){
        try{ if(typeof window.bookingV2Render === 'function') window.bookingV2Render(); }catch(_){}
        try{ if(modalShowsList() && typeof window.cxwRender === 'function') window.cxwRender(); }catch(_){}
      }
      return rows;
    }, function(e){
      list.at = Date.now(); list.loading = null;   // no retry storm: the next try is after the TTL
      if(!list.rows) list.rows = [];
      try{ console.warn('cancelled-without-reason not loaded', e); }catch(_){}
      return list.rows;
    });
    return list.loading;
  }
  O.onWrite(function(){ list.at = 0; });   // a cancel, restore or reason anywhere: ask again on the next draw
  window.laOpsCxw = { load: load, rows: function(){ return list.rows; } };

  var origList = window.cxwList;
  if(typeof origList === 'function') window.cxwList = function(){
    if(!O.enabled()) return origList.apply(this, arguments);
    if(!list.rows || (Date.now() - list.at) >= TTL) load();
    return (list.rows || []).slice();
  };
  var origB2C = window.cxwIsB2C;
  if(typeof origB2C === 'function') window.cxwIsB2C = function(b){
    if(b && b.cxwServer) return b.cxwB2C;   // the server's: a b2c_ key or agent a_b2c
    return origB2C.apply(this, arguments);
  };

  var orig = window.cxwSave;
  if(typeof orig !== 'function') return;
  function findBooking(id){
    var b = (typeof SB_BOOKINGS !== 'undefined' ? SB_BOOKINGS : []).find(function(x){ return x && x.id === id; });
    return b || (list.rows || []).find(function(x){ return x.id === id; }) || null;
  }
  window.cxwSave = function(id, i){
    if(!O.enabled()) return orig.apply(this, arguments);
    if(typeof window.cxwCanEdit === 'function' && !window.cxwCanEdit()) return false;
    var b = findBooking(id);
    if(!b || (typeof window.cxwNeed === 'function' && !window.cxwNeed(b))){ redraw(); return false; }
    var cat = (document.getElementById('cxw-c-' + i) || {}).value || '', note = String((document.getElementById('cxw-n-' + i) || {}).value || '').trim();
    if(!cat){ alert('Please choose a cancellation reason.'); return false; }
    if(cat === 'other' && !note){ alert('Please add a note for "Other".'); return false; }
    var body = { category: cat };
    if(note) body.note = note;
    return O.queue(function(){ return O.bookingWrite('POST', '/v1/bookings/' + enc(b.opsId || b.id) + '/cancel-reason', b, body); }).then(function(ob){
      if(ob && O.bookings && typeof O.bookings.upsert === 'function') O.bookings.upsert(ob);
      if(list.rows){ list.rows = list.rows.filter(function(x){ return x.opsId !== (ob && ob.id) && x.id !== id; }); list.sig = sigOf(list.rows); }
      O.wrote('booking-cancel-reason');
      list.at = Date.now();   // the row is gone here already; the next read after the TTL confirms it
      redraw();
      return true;
    }, function(e){ O.fail('The cancellation reason was not saved', e); redraw(); return false; });
  };
})();
