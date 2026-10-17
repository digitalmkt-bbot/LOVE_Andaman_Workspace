/* ═════════════════════════════════════════════════════════════════
   §opsRowFlags (2026-10-17) · booking row flags ⇄ GET /v1/bookings, /{id}, /recent

   Dashboard and reports used to work out, in the browser, whether a booking is B2C, internal,
   company, free, what it owes and which B2C channel it came from. The server now answers all six
   on every booking read (operation-backend todo/booking-row-flags-model.md); 40-ops-bookings.js
   keeps them on the booking as bk.srvFlags = {isB2C, isInternal, isCompany, internalFree, owed, b2cChannel}.

   Each legacy rule function is wrapped: a booking that carries srvFlags answers from them; any other
   booking (a draft not yet saved, a copy whose flags were dropped by a PATCH answer) and non-ops mode
   run the legacy rule untouched. Everything that adds these up (laInternalRows, _ddRows, _ddSum, _ddAgg,
   _dashLiveFeedHtml, the sales reports) calls these functions, so it reads the server's flags without edits.

   Server field -> function:  is_b2c_legacy -> laIsB2C   is_internal -> laIsInternalBk   is_company -> laIsCompanyBk
                              internal_free -> laIsInternalFree   owed -> laBkMoney   b2c_channel -> laB2CChannel
   Load order: after 40-ops-bookings.js. Classic script.
   ═════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  function wrap(name, pick){
    var orig = window[name]; if(typeof orig !== 'function' || orig.__opsFlags) return;
    var w = function(b){
      var f = (b && b.srvFlags && O.enabled()) ? b.srvFlags : null;
      return f ? pick(f, b) : orig.apply(this, arguments);
    };
    w.__opsFlags = true; window[name] = w;
  }
  wrap('laIsB2C',          function(f){ return f.isB2C; });
  wrap('laIsInternalBk',   function(f){ return f.isInternal; });
  wrap('laIsCompanyBk',    function(f){ return f.isCompany; });
  wrap('laIsInternalFree', function(f){ return f.internalFree; });
  wrap('laBkMoney',        function(f){ return f.owed; });
  wrap('laB2CChannel',     function(f){ return f.b2cChannel; });
})();
