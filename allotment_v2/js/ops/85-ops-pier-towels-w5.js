/* ══════════════════════════════════════════════════════════════════════════
   §opsPierTowelsW5 (w5-f, 2026-10-18) · towel batches and the overdue limits are the server's
   ──────────────────────────────────────────────────────────────────────────
   Server: operation-backend README "Pier stock", GET /v1/pier-office/{pier}/stock:
     towels { on_boat[], dirty[], laundry[] ({ date, qty, days, over }), laundry_open[] ({ qty, since, days }),
              limits { dirty_days, laundry_days }, dirty_over, laundry_over }   all the pier's towel items
     items[].queue                                                              the same, for one towel item
   Legacy walked the browser's moves first in first out. Now:

     poTowelQ(pier, only)   the batches { onboat, dirty, laundry }, each { date, q } oldest first (the server's order)
     poLaundryOpen(pier)    the lots at the laundry { qty, since, days }
     PO_DIRTY_DUE / PO_LAUNDRY_DUE   the server's limits (limits.dirty_days / laundry_days)
     poTodayYMD             the server's "today" of the stock read, so poDaysAgo (and every "N days" and "overdue" mark of
                            poLaundryBlock, poQAge) counts from the same day as the server's flags
     poQAge(item, bucket)   the oldest batch's age and its overdue colour: the server's `days` and `over`
   poLaundryBlock (the card), poQAge's callers and the send/receive dialogs are unchanged: they read these.
   48-ops-pier-office.js keeps the stock read (P.stockTowels): it is current only until the next pier write, then
   legacy's own queue shows until the read comes back. Legacy mode: the originals answer. Classic script · after 48.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O || !O.pier) return;
  var P = O.pier;
  function on(){ return P.enabled() && P.loaded && typeof P.stockTowels === 'function'; }
  function wrap(name, fn){
    var orig = window[name];
    if(typeof orig !== 'function' || orig.__w5f) return;
    var w = function(){
      var args = [].slice.call(arguments);
      if(!on()) return orig.apply(this, args);
      return fn.apply(this, [orig].concat(args));
    };
    w.__w5f = true; w.__orig = orig; window[name] = w;
  }
  function q(list){ return (list || []).map(function(b){ return { date: b.date || '', q: +b.qty || 0, days: b.days, over: !!b.over }; }); }
  function towelsOf(pier, only){
    var t = P.stockTowels(pier); if(!t) return null;
    var src = only ? t.queue[only] : t.towels;
    return src ? { t: t, src: src } : null;
  }
  function apply(pier){
    var t = P.stockTowels(pier); if(!t) return;
    var lim = t.towels.limits || {};
    if(+lim.dirty_days >= 0) window.PO_DIRTY_DUE = +lim.dirty_days;
    if(+lim.laundry_days >= 0) window.PO_LAUNDRY_DUE = +lim.laundry_days;
  }

  wrap('poTowelQ', function(orig, pier, only){
    var h = towelsOf(pier, only); if(!h) return orig.apply(this, [].slice.call(arguments, 1));
    apply(pier);
    return { onboat: q(h.src.on_boat), dirty: q(h.src.dirty), laundry: q(h.src.laundry) };
  });
  wrap('poLaundryOpen', function(orig, pier){
    var h = towelsOf(pier); if(!h) return orig.apply(this, [].slice.call(arguments, 1));
    return (h.src.laundry_open || []).map(function(b){ return { qty: +b.qty || 0, since: b.since, days: +b.days || 0 }; });
  });
  // "today" of the screens that count days is the day of the stock read (the server's), while that read is current
  wrap('poTodayYMD', function(orig){
    var t = P.stockTowels(window._poPier);
    return t && t.today ? t.today : orig.apply(this, [].slice.call(arguments, 1));
  });
  wrap('poQAge', function(orig, itemId, bucket){
    var h = towelsOf(window._poPier, itemId); if(!h) return orig.apply(this, [].slice.call(arguments, 1));
    apply(window._poPier);
    var a = q(h.src[bucket === 'laundry' ? 'laundry' : 'dirty']);
    if(!a.length || !a[0].date) return '';
    var b = a[0], d = +b.days || 0, over = !!b.over;
    return ' · <span style="color:' + (over ? '#B4560A' : '#7C8091') + ';font-weight:' + (over ? '700' : '500') + '">'
      + 'เก่าสุด ' + window.poE(window.poDShort(b.date)) + ' (' + d + ' วัน)</span>';
  });
  // the limits are set as soon as the stock read lands, not only when a batch list is asked for
  var render0 = window.renderPierOffice;
  if(typeof render0 === 'function' && !render0.__w5f){
    var w = function(){
      try{ if(on() && window._poPier) apply(window._poPier); }catch(_){}
      return render0.apply(this, arguments);
    };
    w.__w5f = true; window.renderPierOffice = w;
  }
})();
