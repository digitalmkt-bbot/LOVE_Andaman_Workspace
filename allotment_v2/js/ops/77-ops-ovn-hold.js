/* ════════════════════════════════════════════════════════════════════════
   §opsOvnHold (2026-10-18) · เหมาลำค้างเกาะ (overnight charter hold) from the server on every screen · Q39, wave 4 F5
   ────────────────────────────────────────────────────────────────────────
   Reads:  GET /v1/fleet/availability?from=&to=   row.ovn_hold {booking_id, from, to, route_id}
           (read through ops/71-ops-boat-operation.js, which keeps the answers per date and drops them at every write)
   Writes: none.

   Legacy worked the hold out in the browser (bkOvnHoldMap: walk every booking for a charter that left and has not come
   back). The server owns the rule now (src/domain/ovn-hold.ts: ovnHoldsOn). One wrapper is enough, because the other two
   helpers sit on it:
     bkOvnHoldMap(date)          → a Map boatId → {bkId, from, to, routeId}, from the server's rows
     bkOvnHoldOn(boatId, date)   (calls bkOvnHoldMapMemo → bkOvnHoldMap)
     baCharterBoatMap(date)      (calls bkOvnHoldMap for the held nights)
   Every screen that asks (the Boats line of By trip, the pier job card, getAllotment's local fallback, the boat pickers)
   therefore reads the server's hold. Until the date's answer is here, and when the server cannot be reached, legacy's own
   walk answers; the screen is drawn again only when the server's answer differs from what legacy gave.
   Legacy mode (!O.enabled()): delegates. Classic script · loads after ops/71-ops-boat-operation.js.
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O || !O.boatOperation || !O.boatOperation.rows) return;
  var orig = window.bkOvnHoldMap; if(typeof orig !== 'function' || orig.__opsOvn) return;
  var B = O.boatOperation;

  function clientId(id){
    if(!id) return id;
    var list = (typeof SB_BOOKINGS !== 'undefined' && Array.isArray(SB_BOOKINGS)) ? SB_BOOKINGS : [];
    var b = list.find(function(x){ return x && x.opsId === id; });
    return b ? b.id : id;
  }
  /* the server's holds of one date, or null while its answer is not here */
  function fromServer(date){
    var rows = B.rows(date); if(!rows) return null;
    var m = new Map();
    Object.keys(rows).forEach(function(boatId){
      var h = rows[boatId] && rows[boatId].ovn_hold;
      if(h) m.set(boatId, { bkId: clientId(h.booking_id), from: h.from, to: h.to, routeId: h.route_id || '' });
    });
    return m;
  }
  function differs(a, b){
    if(a.size !== b.size) return true;
    var d = false;
    a.forEach(function(h, id){ var g = b.get(id); if(!g || g.from !== h.from || g.to !== h.to || (g.routeId || '') !== (h.routeId || '')) d = true; });
    return d;
  }
  function redraw(){
    try{
      if(O.busy && O.busy()) return;
      if(typeof window.bkOvnHoldMemoClear === 'function') window.bkOvnHoldMemoClear();
      var view = O.activeView ? O.activeView() : '';
      if(view === 'operation' && typeof window.renderOp === 'function') window.renderOp();
      else if(O.vanJobs && O.vanJobs.redraw) O.vanJobs.redraw();
    }catch(_){}
  }

  var w = function(date){
    if(!O.enabled() || !date) return orig.apply(this, arguments);
    var s = fromServer(date);
    if(s) return s;
    var legacy = orig.apply(this, arguments);
    B.ensure([date], function(){ var n = fromServer(date); if(n && differs(n, legacy)) redraw(); });
    return legacy;
  };
  w.__opsOvn = true; w.__orig = orig;
  window.bkOvnHoldMap = w;
  O.ovnHold = { map: function(date){ return fromServer(date); } };
})();
