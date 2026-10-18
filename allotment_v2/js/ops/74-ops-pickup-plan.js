/* ═════════════════════════════════════════════════════════════════
   §opsPickupPlan (w4-f2, 2026-10-18) · the "Pickup zone" dialog: the preview and the save are the server's

   Legacy: _bkV2ZonePickPlan(bk, areaId) works out, in the browser, which trips' pickup times would follow the new pickup
   area (a trip whose time was typed by hand is skipped: the browser flag pickupTimeEdited) and whether the area is in another
   price zone than the trips. bookingV2ZonePickSel draws that in the dialog; bookingV2ZonePickConfirm then changes the area
   and, if the box is ticked, the times, in the browser.

   The server (README "Bookings", src/domain/pickup-refresh.ts):
     GET   /v1/bookings/{id}/pickup-area-plan?pickup_area_id=     writes nothing:
             { changes: [{ trip_id, service_date, route_id, from, to }], kept: [{ ..., why: "hand_edited" }],
               price_zones, area_zone, zone_differs, warning?, same }
     PATCH /v1/bookings/{id} { pickup_area_id, refresh_pickup_times: true|false }    only the area and the pickup times of the trips
             that change are written (no re-price), one history line; the answer has warnings [zone_differs] and pickup_refresh.
   "Typed by hand" is worked out by the server (a time that is not the booking's current area's own time for that route and day),
   so no browser flag decides.

   This file:
     _bkV2ZonePickPlan   answers {area, times, priceZones, zoneDiff} from the server's plan (cached per booking, version and area; the
                         dialog draws again when the answer arrives). Until then, and offline, legacy's own plan.
     bookingV2ZonePickConfirm   sends only { pickup_area_id, refresh_pickup_times } (the box), draws the booking from the answer, and
                         shows the server's refusal as it words it. Nothing is changed in the browser first.
   Legacy's texts, checkbox and warning panel are unchanged. Load order: after 40-ops-bookings.js. Classic script.
   ═════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  var plans = {};      // 'opsId|version|areaId' -> { data, loading }
  var gen = 0;

  function enabled(){ return !!(O.enabled && O.enabled()); }
  function enc(v){ return encodeURIComponent(v == null ? '' : String(v)); }
  function find(id){ return (typeof SB_BOOKINGS !== 'undefined' && Array.isArray(SB_BOOKINGS) ? SB_BOOKINGS : []).filter(function(b){ return b && b.id === id; })[0] || null; }
  function keyOf(bk, areaId){ return bk.opsId + '|' + (bk.opsVersion == null ? '' : bk.opsVersion) + '|' + areaId; }

  var origPlan = window._bkV2ZonePickPlan;
  if(typeof origPlan === 'function'){
    window._bkV2ZonePickPlan = function(bk, areaId){
      var local = origPlan.apply(this, arguments);
      if(!enabled() || !bk || !bk.opsId || !areaId || !local || !local.area) return local;
      var key = keyOf(bk, areaId), c = plans[key];
      if(!c){
        c = plans[key] = { data: null, loading: true };
        var mine = gen;
        O.get('/v1/bookings/' + enc(bk.opsId) + '/pickup-area-plan', { pickup_area_id: areaId }).then(function(res){
          if(mine !== gen){ delete plans[key]; return; }
          c.data = res; c.loading = false;
          var st = window._bkV2ZonePick;                                // the dialog is still on this booking and area: draw it again
          if(st && st.bkId === bk.id && st.sel === areaId && typeof window.bookingV2ZonePickSel === 'function' && document.getElementById('bkv2-zonepick')) window.bookingV2ZonePickSel(areaId);
        }, function(){ c.loading = false; c.failed = true; });          // a refusal leaves legacy's plan on screen; Confirm will say what the server thinks
      }
      if(!c.data) return local;
      var d = c.data;
      var times = (d.changes || []).map(function(ch){
        var t = (bk.trips || []).filter(function(x){ return x && x.opsTripId === ch.trip_id; })[0] || { date: ch.service_date || '' };
        return { t: t, from: ch.from || '', to: ch.to || '' };
      });
      return { area: local.area, times: times, priceZones: Array.isArray(d.price_zones) ? d.price_zones.slice() : [], zoneDiff: !!d.zone_differs, kept: d.kept || [], serverPlan: d };
    };
    window._bkV2ZonePickPlan.__opsPickupPlan = true;
  }

  var prevConfirm = window.bookingV2ZonePickConfirm;
  if(typeof prevConfirm === 'function'){
    window.bookingV2ZonePickConfirm = function(){
      if(!enabled()) return prevConfirm.apply(this, arguments);
      var st = window._bkV2ZonePick; if(!st || !st.sel) return undefined;
      var bk = find(st.bkId);
      if(!bk || !bk.opsId) return prevConfirm.apply(this, arguments);               // a booking not saved yet is legacy's, in the browser
      if(typeof window.acctCanEditBookings === 'function' && !window.acctCanEditBookings()){ alert('View only - you cannot edit bookings.'); return undefined; }
      var close = function(){ var ov = document.getElementById('bkv2-zonepick'); if(ov) ov.remove(); };
      if(st.sel === (bk.pickupAreaId || '')){ close(); return undefined; }
      var box = document.getElementById('bkv2-zonepick-time');
      var body = { pickup_area_id: st.sel };
      if(box) body.refresh_pickup_times = !!box.checked;                             // the box exists only when some trip's time would follow the area
      var sel = st.sel;
      return O.queue(function(){ return O.bookingWrite('PATCH', '/v1/bookings/' + enc(bk.opsId), bk, body); }).then(function(j){
        if(j && j.id && O.bookings && O.bookings.mergeInto) O.bookings.mergeInto(bk, j);
        if(j && j.pickup_refresh && Array.isArray(j.pickup_refresh.changes)){ /* the answer's trips carry the new times: merged above */ }
        O.wrote('booking');
        close();
        if(typeof window.bookingV2RenderKeep === 'function') window.bookingV2RenderKeep();
        return j;
      }, function(e){ O.fail('Pickup zone not saved · nothing changed', e); return null; });
    };
    window.bookingV2ZonePickConfirm.__opsPickupPlan = true;
  }

  O.onWrite(function(){ gen++; plans = {}; });
  O.pickupPlan = { clear: function(){ gen++; plans = {}; }, held: function(){ return Object.keys(plans).filter(function(k){ return plans[k].data; }).length; } };
})();
