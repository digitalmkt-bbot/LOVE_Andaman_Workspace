/* ═════════════════════════════════════════════════════════════════════════
   §opsNotYet (2026-10-28) · lk-inbox features that arrived with the 10-27 sync (#31) but that
   operation-backend does not save yet. Each one writes the legacy blob, which is local-only here, so
   staff would see a save that is gone on the next reload. In ops mode they are refused with a plain
   message instead (or, for a banner that only leads to one, not drawn). Remove a block when its
   adapter or endpoint lands.
     · §poXfer     Pier Office: transfer equipment to another pier, receive it, cancel it
     · §ovnBoatBack charter OVN "boat returns to the pier the same day" (trips have no field for it)
     · §flnWd      Fleet Work › Add work: withdraw parts from stock while creating the job
   (§cxWhy, the reason of a booking cancelled without one, saves since 2026-10-28: ops/41-ops-cancel-reason.js →
    POST /v1/bookings/{id}/cancel-reason)
   (§tcxPartner, Send to partner, saves since 2026-10-28: ops/27-ops-weather.js → POST /v1/weather-closures/{id}/send-to-partner)
   Loaded after every other ops adapter (just before 90-ops-boot.js), so these wrappers run first.
   ═════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps;
  if(!O) return;

  function refuse(what){
    alert(what + ' is not available yet: operation-backend does not save it, so it would be lost on reload.');
    return false;
  }
  function wrap(name, fn){
    var orig = window[name]; if(typeof orig !== 'function' || orig.__opsNotYet) return;
    var w = function(){ if(!O.enabled()) return orig.apply(this, arguments); return fn.apply(this, [orig].concat([].slice.call(arguments))); };
    w.__opsNotYet = true; window[name] = w;
  }
  function block(names, what){ names.forEach(function(n){ wrap(n, function(){ return refuse(what); }); }); }

  /* §poXfer */
  block(['poXferOpen', 'poXferSave', 'poXferRecvOpen', 'poXferRecvSave', 'poXferCancel'], 'Transferring equipment to another pier');

  /* §ovnBoatBack · the box is unticked again; every other trip field saves as before */
  wrap('bookingV2SetTripField', function(orig, idx, key, val){
    if(key === 'ovnBoatBack' && val){
      try{ var box = document.getElementById('bkv2-ovnbb-' + idx); if(box) box.checked = false; }catch(_){}
      return refuse('"Boat returns to the pier the same day"');
    }
    return orig.apply(this, [].slice.call(arguments, 1));
  });

  /* §flnWd · the job itself is still created; parts are withdrawn from the job page afterwards */
  block(['flnWdAdd'], 'Withdrawing parts while adding work (create the job, then withdraw from its page)');
})();
