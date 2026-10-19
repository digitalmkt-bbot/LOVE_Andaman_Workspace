/* ═════════════════════════════════════════════════════════════════════════
   §w8 (2026-10-19) · booking form: the add-ons the draft is offered are the server's
   ─────────────────────────────────────────────────────────────────────────
   Backend: POST /v1/quote -> add_on_offers[] (README "Server fields added 2026-10-19"):
     { type, kind: 'join' | 'charter' | 'private-van', label, amount, locked, locked_by[], routes[] | route_id, zone, vehicle, price }
   Legacy decided this in the browser from the rate type (`bookingV2RenderAddOnsSection`: which longtail routes apply, whether a bundle
   locks the join, which private vans a route prices). Now:

     laOpsAddOnOffers()   the offers of the quote that has answered for the draft on screen, in the shape the section's `opts` has
                          ({ type, label, sub, amount, locked? }), or null while no answer is held (or in legacy mode): legacy's own list then stands.

   `bookingV2RenderAddOnsSection` (booking/bookingV2RenderAddOnsSection.js, marked §w8) takes this list when it is not null. What the
   person ticks, the join head counts, the quantity and the note stay the form's. The sub-lines are drawn here from the server's figures.
   A new answer that changes the offers draws the form again (not while a field has the cursor). Classic script, after 95-ops-w7a-*.js,
   before 90-ops-boot.js.
   ═════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  function on(){ return !!(O.enabled && O.enabled()); }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function routeName(id){
    var rs = (typeof ROUTES !== 'undefined' && ROUTES) || [];
    var r = rs.filter(function(x){ return x && x.id === id; })[0];
    return (r && r.name) || id;
  }
  function uniq(list){ return list.filter(function(v, i){ return list.indexOf(v) === i; }); }

  /* one server offer -> the section's option */
  function toOpt(o){
    if(o.kind === 'join'){
      var prices = uniq((o.routes || []).map(function(r){ return (r.adult || 0) + '/' + (r.child || 0); }));
      var first = (o.routes || [])[0] || {};
      var sub = o.locked
        ? 'Locked &middot; bundled in ' + (o.locked_by || []).map(function(id){ return esc(routeName(id)); }).join(' &middot; ')
        : (prices.length === 1 ? '฿' + (first.adult || 0) + '/A · ฿' + (first.child || 0) + '/C' : 'ราคาตามเส้นทาง');
      return { type: o.type, label: o.label, sub: sub, amount: o.amount, locked: !!o.locked };
    }
    if(o.kind === 'charter'){
      var caps = uniq((o.routes || []).map(function(r){ return r.price + '/' + (r.capacity || 6); }));
      var c0 = (o.routes || [])[0] || {};
      return { type: o.type, label: o.label, sub: caps.length === 1 ? '฿' + c0.price + '/boat · max ' + (c0.capacity || 6) + ' pax' : 'ราคาตามเส้นทาง · per boat', amount: o.amount };
    }
    var zone = o.zone === 'PK' ? 'Phuket' : o.zone === 'KL' ? 'Khao Lak' : o.zone;
    return { type: o.type, label: o.label, sub: 'เหมารถรับ ' + esc(zone) + ' · ' + esc(routeName(o.route_id)) + ' · ฿' + o.price + '/คัน · dedicated (ไม่แชร์)', amount: o.amount };
  }

  function offersNow(){
    var q = window.laOpsQuote, a = q && q.answered && q.answered();
    var offers = a && a.quote && a.quote.add_on_offers;
    return Array.isArray(offers) ? offers : null;
  }

  window.laOpsAddOnOffers = function(){
    if(!on()) return null;
    var offers = offersNow();
    return offers ? offers.map(toOpt) : null;
  };

  /* a new answer that changes what is offered draws the form (the add-ons section is not part of the quote's own redraw) */
  var seen = '';
  function typing(){ var a = document.activeElement; return !!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)); }
  var Q = window.laOpsQuote;
  if(Q && Q.onAnswer){
    Q.onAnswer(function(key, req, quote){
      try{
        if(!on() || !window._bkV2 || !window._bkV2.newBooking) return;
        var cur = Q.answered(); if(!cur || cur.key !== key) return;
        var sig = JSON.stringify((quote && quote.add_on_offers) || []);
        if(sig === seen) return;
        seen = sig;
        if(!typing() && typeof window.bookingV2Render === 'function') window.bookingV2Render();
      }catch(e){ console.warn('[ops] w8 add-on offers redraw failed', e); }
    });
  }
})();
