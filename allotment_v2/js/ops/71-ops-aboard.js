/* ═════════════════════════════════════════════════════════════════
   §opsAboard (2026-10-18) · check-in figures ⇄ trips[].aboard on every booking read (decision Q35)

   Legacy works the check-in figures out in the browser, function by function, from bk.ops.vanCheckin /
   pierCheckin. The server now computes them and puts one block on every trip it sends:
   trip.aboard = { booked, lost, left, on_board, expected, void, self_pier_note, self_add, reinstated,
                   van_ns_pax, tally, summary, has_arrange }  (operation-backend README "The aboard block",
   todo/w2-checkin-money-model.md). 40-ops-bookings.js keeps it on the trip as trip.aboard (tripFrom, and
   records() for the answers of the booking commands), 36-ops-day-actions.js refreshes it from the check-in
   answer; trip.aboardDate is the service day it was read for.

   Each legacy function below is wrapped: a trip that carries aboard (for that very day) answers from it;
   a trip without it (a draft, a copy, a booking an answer did not send it for, a trip moved to another day
   and not yet re-read) and non-ops mode run the legacy browser rule untouched. Everything that adds these
   up (pckTripStats, goCounts, pckVoidOf, pckFlagTags, the Travel Summary rows ...) calls these functions,
   so it reads the server's figures without edits.

   Server field -> function
     lost                 ckLostByType        (self_pier -> selfPier)
     left[k]              ckPaxLeft           (only when the caller's `booked` is the trip's own; goCounts, pckTripStats call it)
     void                 pckVoidInfo         (pckVoidOf calls it)
     self_pier_note       pckSelfPierNote
     on_board             pckOnBoard          (only when the caller's `booked` is the trip's own)
     expected             pckExpected         (same)
     has_arrange          ckHasArrange        (true from the server, else legacy's local answer: w4-f5)
     self_add             ckSelfOf            (ckSelfK, ckSelfUnalloc call it; at/by/note stay from the local record)
     reinstated           ckReinstateOf       (at/by stay from the local record)
     van_ns_pax           ckVanNsPax
     summary              ckSummary           (van / pier stay the local records)
   Not wrapped: ckPaxBreak and ckEventTally (they take a bare pax map / a bare record, no booking and day),
   ckReasonLabel / ckExpectAtPier (label constants), ckAddonList / bkLt* (no aboard field).
   Load order: after 40-ops-bookings.js and 36-ops-day-actions.js. Classic script.
   ═════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var K = ['ad', 'chd', 'inf', 'foc'];

  /* the server's block for this booking's trip on that day, or null (legacy rule runs) */
  function blockOf(b, date){
    if(!b || !O.enabled()) return null;
    var t = (typeof window.ckTripOn === 'function') ? window.ckTripOn(b, date) : null;
    if(!t || !t.aboard) return null;
    if(t.aboardDate && t.aboardDate !== (t.date || '')) return null;      // the trip moved since it was read
    return t.aboard;
  }
  function paxTotal(pax){ var p = window.ckPaxBreak(pax || {}); return p.ad + p.chd + p.inf + p.foc; }
  /* the caller asks about the trip's own heads (or about no heads at all) */
  function sameBooked(ab, booked){ return booked == null || +booked === +ab.booked.total; }
  function num(v){ return +v || 0; }

  function wrap(name, pick){
    var orig = window[name]; if(typeof orig !== 'function' || orig.__opsAboard) return;
    var w = function(b, date){
      var ab = blockOf(b, date);
      if(ab){
        var r = pick(ab, arguments, orig, this);
        if(r !== undefined) return r;
      }
      return orig.apply(this, arguments);
    };
    w.__opsAboard = true; window[name] = w;
  }

  /* ckLostByType(b, date) -> {ad chd inf foc total unalloc ns cxl selfPier} */
  wrap('ckLostByType', function(ab){
    var l = ab.lost || {};
    return { ad: num(l.ad), chd: num(l.chd), inf: num(l.inf), foc: num(l.foc), total: num(l.total), unalloc: num(l.unalloc),
             ns: num(l.ns), cxl: num(l.cxl), selfPier: num(l.self_pier) };
  });

  /* ckPaxLeft(b, date, k, booked) -> heads of category k still travelling.  The server's `left` is worked out from
     the trip's own heads; a caller that passes other heads (a part of a split row) gets the legacy rule. */
  wrap('ckPaxLeft', function(ab, a){
    var k = a[2], booked = a[3];
    if(K.indexOf(k) < 0 || booked == null || +booked !== num(ab.booked[k])) return undefined;
    return num(ab.left[k]);
  });

  /* pckVoidInfo(b, date, t) -> {pax cxl ns kind at by reason note} or null */
  wrap('pckVoidInfo', function(ab, a){
    var t = a[2]; if(!t) return undefined;
    if(paxTotal(t.pax) !== num(ab.booked.total)) return undefined;
    var v = ab.void; if(!v) return null;
    return { pax: num(v.pax), cxl: num(v.cxl), ns: num(v.ns), kind: v.kind, at: v.at || '', by: v.by || '', reason: v.reason || '', note: v.note || '' };
  });

  /* pckSelfPierNote(b, date) -> {pax at label} or null */
  wrap('pckSelfPierNote', function(ab){
    var n = ab.self_pier_note; if(!n) return null;
    return { pax: num(n.pax), at: n.at || '', label: n.label || '' };
  });

  /* pckOnBoard(b, date, booked) and pckExpected(b, date, booked) */
  wrap('pckOnBoard', function(ab, a){ return sameBooked(ab, a[2]) ? num(ab.on_board) : undefined; });
  wrap('pckExpected', function(ab, a){ return sameBooked(ab, a[2]) ? num(ab.expected) : undefined; });

  /* ckHasArrange(b, date) */
  /* w4-f5 (decision): the server's yes is final; its no is not, because a van or boat assigned in the browser after the block was
     read shows in has_arrange only after the next read. So: aboard.has_arrange || legacy's local answer. */
  wrap('ckHasArrange', function(ab){ return ab.has_arrange ? true : undefined; });

  /* ckSelfOf(b, date) -> the pier's self-add {ad chd inf foc pax at by note} or null.  The server sends who came, not
     who confirmed it: at/by/note are the local record's (the check-in answer rewrites it). ckSelfK / ckSelfUnalloc call this. */
  wrap('ckSelfOf', function(ab, a, orig, self){
    var s = ab.self_add; if(!s) return null;
    var local = orig.apply(self, a) || {};
    return Object.assign({}, local, { ad: num(s.ad), chd: num(s.chd), inf: num(s.inf), foc: num(s.foc), pax: num(s.pax) });
  });

  /* ckReinstateOf(b, date) -> {at by ts} or null */
  wrap('ckReinstateOf', function(ab, a, orig, self){
    if(!ab.reinstated) return null;
    return orig.apply(self, a) || { at: '', by: '', ts: '' };
  });

  /* ckVanNsPax(b, date) */
  wrap('ckVanNsPax', function(ab){ return num(ab.van_ns_pax); });

  /* ckSummary(b, date) -> {booked van pier vanNoShow pierNoShow noShow at reasonText stage}.  van / pier are the records the
     screens open (the trip carries them), the figures are the server's. */
  wrap('ckSummary', function(ab, a){
    var b = a[0], date = a[1], s = ab.summary; if(!s) return undefined;
    var read = function(kind){ return (typeof window.ckRead === 'function') ? window.ckRead(b, date, kind) : null; };
    return { booked: num(s.booked), van: read('van'), pier: read('pier'), vanNoShow: num(s.van_no_show), pierNoShow: num(s.pier_no_show),
             noShow: num(s.no_show), at: s.at || '', reasonText: s.reason_text || '', stage: s.stage || '' };
  });

  O.aboard = { blockOf: blockOf };
})();
