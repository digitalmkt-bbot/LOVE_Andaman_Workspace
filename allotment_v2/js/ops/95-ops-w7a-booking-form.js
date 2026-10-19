/* ══════════════════════════════════════════════════════════════════════════
   §opsW7aForm (w7-a, 2026-10-19) · booking form: the park-fee warning and the rate / promotion are the server's
   ──────────────────────────────────────────────────────────────────────────
   Backend: operation-backend README "Quote" (warnings[] nat_mix; trips[].rate_type_id / promo_id / rate_source),
   "Agents" (GET /v1/agents/{id}/rate-type?date=), todo/quote-nat-mix-model.md.
   Loads after 51-ops-quote.js, 84-ops-booking-calc.js and 94-ops-booking-w6.js. Classic script.
   Idiom: a held answer first, legacy until it lands; we send only what the person typed (51 now also sends the lead's and the
   passengers' nationalities, client facts); nothing computed is sent.

   1 · bookingV2NatWarn(t)          <- the quote's warnings[] code nat_mix of THIS trip (trip = index in the request). The sentence
                                       drawn is the server's `message` (bookingV2RenderTripsSection.js, marked §w7a). When the quote
                                       has answered and has no nat_mix for the trip, the red "bad" case is gone (legacy's green
                                       note, which is not a decision, stays). Until the answer: legacy's test.
                                       A quote answer that adds / removes a nat_mix draws the form again (never under typing).
   2 · bookingV2GetRTForTrip(t)     <- the quote's trips[i].rate_type_id / promo_id for the trip (the rate AND the promotion the
                                       server priced it with); the browser's promo pick (laPromoRateFor) is not asked then.
   3 · laMainRtIdFor (agent, date)  <- GET /v1/agents/{id}/rate-type?date= while the booking form's own readers run
                                       (bookingV2GetRTForTrip, bookingV2AddOnRT, bookingV2RtKeepPair): the rate season is the server's
                                       call; the scoped swap leaves every other screen's laMainRtFor on its own rule.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  function on(){ return !!(O.enabled && O.enabled()); }
  function enc(v){ return encodeURIComponent(v == null ? '' : String(v)); }
  function draft(){ return (window._bkV2 && window._bkV2.newBooking) || null; }
  function typing(){ var a = document.activeElement; return !!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)); }
  function redrawForm(d){
    try{
      if(draft() !== d || typing()) return;
      if(typeof window.bookingV2Render === 'function') window.bookingV2Render();
    }catch(e){ console.warn('[ops] w7a form redraw failed', e); }
  }
  function wrap(name, fn){
    var orig = window[name];
    if(typeof orig !== 'function' || orig.__opsW7a) return;
    var w = function(){
      if(!on()) return orig.apply(this, arguments);
      var r;
      try{ r = fn.call(this, orig, arguments); }catch(e){ if(window.console) console.warn('[ops] w7a · ' + name + ' · ' + (e && e.message)); r = undefined; }
      return r === undefined ? orig.apply(this, arguments) : r;
    };
    w.__opsW7a = true; w.__orig = orig; window[name] = w;
  }
  var Q = function(){ return window.laOpsQuote || null; };

  /* the cached quote answer for the draft on screen and the request index of one of its trips: { quote, ri } or null */
  function quoteOf(trip){
    var q = Q(), d = draft(); if(!q || !q.answered || !d || !Array.isArray(d.trips)) return null;
    var a = q.answered(); if(!a || !a.req || !a.req.map) return null;
    var i = d.trips.indexOf(trip); if(i < 0) return null;
    var ri = a.req.map.indexOf(i); if(ri < 0) return null;
    return { quote: a.quote, ri: ri };
  }

  /* ── 1 · nat_mix ─────────────────────────────────────────────────────────── */
  function natOf(quote, ri){
    return ((quote && quote.warnings) || []).filter(function(w){ return w && w.code === 'nat_mix' && w.trip === ri; })[0] || null;
  }
  wrap('bookingV2NatWarn', function(orig, a){
    var t = a[0], hit = quoteOf(t); if(!hit) return undefined;
    var w = natOf(hit.quote, hit.ri), legacy = orig.apply(this, a);
    if(w){
      var foreign = Math.max(0, +w.foreigners || 0), heads = Math.max(0, +w.heads || 0);
      return { th: Math.max(0, heads - foreign), fr: foreign, thPrice: +w.thai_priced || 0, bad: true, message: String(w.message || ''), server: true };
    }
    if(legacy && legacy.bad) return Object.assign({}, legacy, { bad: false, server: true });      // the server finds no mix: not a warning
    return legacy;
  });
  /* a new answer that adds or drops a nat_mix draws the form (the trips section is not part of the quote's own redraw) */
  var natSeen = '';
  function natSig(quote, req){
    return ((quote && quote.warnings) || []).filter(function(w){ return w && w.code === 'nat_mix'; })
      .map(function(w){ return w.trip + ':' + w.thai_priced + ':' + w.foreigners; }).join('|');
  }
  if(Q() && Q().onAnswer){
    Q().onAnswer(function(key, req, quote){
      try{
        var d = draft(); if(!d || !on()) return;
        var cur = Q().answered(); if(!cur || cur.key !== key) return;
        var sig = natSig(quote, req);
        if(sig !== natSeen){ natSeen = sig; redrawForm(d); }
      }catch(_){}
    });
  }

  /* ── 3 · the rate season of an agent on a date: the server's ─────────────── */
  var TTL_MS = 60000, FAIL_MS = 15000;
  var seasons = Object.create(null);          // 'agent|date' -> { id, at } | { failedAt }
  var asking = Object.create(null);
  function legacyId(agentId, date){
    var f = window.laMainRtIdFor && (window.laMainRtIdFor.__w7aOrig || window.laMainRtIdFor);
    return f ? f(agentId, date) : '';
  }
  function known(id){ return !!(id && typeof window.getRateType === 'function' && window.getRateType(id)); }
  function askSeason(agentId, date, d){
    var k = agentId + '|' + date; if(asking[k]) return;
    asking[k] = true;
    var was = legacyId(agentId, date);
    O.get('/v1/agents/' + enc(agentId) + '/rate-type', { date: date }).then(function(r){
      delete asking[k];
      var id = r && r.rate_type_id ? String(r.rate_type_id) : '';
      seasons[k] = { id: id, at: Date.now() };
      if(id && id !== was && known(id)) redrawForm(d || draft());      // the server picks another rate than the browser would: draw again
    }, function(){ delete asking[k]; seasons[k] = { failedAt: Date.now() }; });
  }
  /* the server's rate type id for the agent and date, or undefined (legacy answers) until it has said */
  function seasonId(agentId, date){
    if(!agentId || !/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return undefined;
    var k = agentId + '|' + date, e = seasons[k];
    if(e && e.failedAt && Date.now() - e.failedAt < FAIL_MS) return undefined;
    if(!e || (e.at && Date.now() - e.at > TTL_MS)) askSeason(agentId, date, draft());
    return (e && e.id && known(e.id)) ? e.id : undefined;
  }
  O.onWrite(function(kind){ if(String(kind || '') === 'agents' || String(kind || '') === 'rates') { Object.keys(seasons).forEach(function(k){ if(seasons[k].at) seasons[k].at = 1; }); } });
  /* run fn with laMainRtIdFor answering from the server's season; always put the browser's own back */
  function withServerSeason(fn, self, args){
    var orig = window.laMainRtIdFor;
    if(typeof orig !== 'function' || !on()) return fn.apply(self, args);
    var swap = function(agentId, date){
      var s = seasonId(agentId, date);
      return s !== undefined ? s : orig.apply(this, arguments);
    };
    swap.__w7aOrig = orig;
    window.laMainRtIdFor = swap;
    try{ return fn.apply(self, args); } finally { window.laMainRtIdFor = orig; }
  }
  ['bookingV2AddOnRT', 'bookingV2RtKeepPair'].forEach(function(name){
    var orig = window[name]; if(typeof orig !== 'function' || orig.__opsW7a) return;
    var w = function(){ return withServerSeason(orig, this, arguments); };
    w.__opsW7a = true; w.__orig = orig; window[name] = w;
  });

  /* ── 2 · the rate and promotion of a trip: what the quote priced it with ── */
  (function(){
    var orig = window.bookingV2GetRTForTrip; if(typeof orig !== 'function' || orig.__opsW7a) return;
    var w = function(trip){
      var self = this, args = arguments;
      if(!on()) return orig.apply(self, args);
      var hit = null, rt = null;
      try{ hit = quoteOf(trip); }catch(_){}
      var st = hit && hit.quote.trips && hit.quote.trips[hit.ri];
      if(st && st.rate_type_id && known(st.rate_type_id)){
        rt = window.getRateType(st.rate_type_id);
        return st.promo_id ? Object.assign({}, rt, { __promoId: String(st.promo_id) }) : rt;
      }
      return withServerSeason(orig, self, args);          // no quote yet: legacy's pick, on the server's season
    };
    w.__opsW7a = true; w.__orig = orig; window.bookingV2GetRTForTrip = w;
  })();

  window.laOpsW7aForm = { seasonId: seasonId, _seasons: seasons };
})();
