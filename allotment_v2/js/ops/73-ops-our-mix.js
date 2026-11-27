/* ══════════════════════════════════════════════════════════════════════════
   §opsOurMix (w4-f1, 2026-10-18) · Market Data "our side" figures ⇄ GET /v1/market-stats/our-mix
   ──────────────────────────────────────────────────────────────────────────
   Server: operation-backend todo/b2-reports-model.md. Legacy added our bookings up in the browser to set them beside the
   airport arrivals (and 28-ops-nationalities.js taught it to read the server's per-passenger nationality). The server answers:

     mdOurMixByCode    our pax by nationality code            ← mix[]  {code, name, pax}
     mdOurNatCoverage  bookings with / without a nationality  ← coverage {with_nationality, total}
     mdMissingNat      the bookings still to fix              ← missing_nationality {count, bookings[]} (first 60)
     mdLeadByMarket    pax by how far ahead each market books ← lead_time {buckets, markets[]}
     mdOnTheBooks      future pax by week, next 8 weeks       ← on_the_books.weeks[]
     mdOpenBk          opens a missing-nationality booking: the booking is read from the server first
                       (the list holds the server's rows, not every booking)
     mdBkMix           one booking's mix: only the aggregate above used it; nothing calls it any more in operation mode
     mdZoneDemand      pax by pickup zone (Ops & Guides) ← pickup_zones[] {zone, pax} (§qsZone, 2026-11-27: the browser holds only some bookings)
     natLearnRecordMany the booking form's save also sends its names to POST /v1/bookings/nationality-votes (§qsNat): the server's
                       name guess (legacy bkV2GuessNationality, table nationality_learn) learns from them as legacy's nat_learn did
   The arrival side (mdArrivalsByCode, the airport files) is the Market Data store (64-ops-market-data.js). The capture rate and
   index are division of the two sets of figures on screen, kept. mdOurPaxByMarket has no caller and stays as it was.
   The server guesses a missing nationality from the name as legacy does (round 8, 2026-11-27); a period keeps only its trips.
   Until the first answer (and if it fails) legacy's sums over the loaded bookings stay. Classic script, after 64-ops-market-data.js.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O || !O.srv) return;
  function on(){ return !!(O.enabled && O.enabled()); }
  function n(v){ return Number.isFinite(+v) ? +v : 0; }
  function wrap(name, fn){
    var orig = window[name];
    if(typeof orig !== 'function' || orig.__w4f1) return;
    var w = function(){
      var args = [].slice.call(arguments);
      if(!on()) return orig.apply(this, args);
      return fn.apply(this, [orig].concat(args));
    };
    w.__w4f1 = true; w.__orig = orig; window[name] = w;
  }
  function repaint(){
    if(O.activeView() === 'marketdata' && !O.busy() && typeof window.renderMarketData === 'function') window.renderMarketData();
  }
  function mix(){ return O.srv.read('ourmix', '/v1/market-stats/our-mix', {}, repaint); }
  if(O.onWrite) O.onWrite(function(){ /* a booking write makes the answer stale (laOps.srv does that); nothing else to do */ });

  wrap('mdOurMixByCode', function(orig){
    var j = mix(); if(!j) return orig.apply(this, [].slice.call(arguments, 1));
    var out = {}; j.mix.forEach(function(x){ out[x.code] = n(x.pax); });
    return out;
  });
  wrap('mdOurNatCoverage', function(orig){
    var j = mix(); if(!j) return orig.apply(this, [].slice.call(arguments, 1));
    return { with: n(j.coverage.with_nationality), total: n(j.coverage.total) };
  });
  wrap('mdMissingNat', function(orig){
    var j = mix(); if(!j) return orig.apply(this, [].slice.call(arguments, 1));
    var m = j.missing_nationality, list = m.bookings.map(function(b){
      return { id: b.booking_id, opsId: b.booking_id, voucherRef: b.reference, agentId: b.agent_id, leadPax: b.lead_pax, trips: b.first_date ? [{ date: b.first_date }] : [] };
    });
    while(list.length < n(m.count)) list.push({ id: '', trips: [] });     // the card says "+N more" from the length
    return list;
  });
  wrap('mdLeadByMarket', function(orig){
    var j = mix(); if(!j) return orig.apply(this, [].slice.call(arguments, 1));
    var buckets = j.lead_time.buckets.slice(), out = {};
    j.lead_time.markets.forEach(function(m){ out[m.market_id || 'unassigned'] = buckets.map(function(b){ return n(m.buckets[b]); }); });
    return { buckets: buckets, out: out };
  });
  wrap('mdOnTheBooks', function(orig){
    var j = mix(); if(!j) return orig.apply(this, [].slice.call(arguments, 1));
    var weeks = {}, sum = 0; j.on_the_books.weeks.forEach(function(w){ if(n(w.pax)){ weeks[w.week] = n(w.pax); sum += n(w.pax); } });
    /* parity round 9 (2026-11-27): legacy's ninth bucket (day 56) is in the card's total, not drawn; the server's total_pax has it */
    var rest = n(j.on_the_books.total_pax) - sum; if(rest > 0) weeks[j.on_the_books.weeks.length] = rest;
    return weeks;
  });
  wrap('mdZoneDemand', function(orig){
    var j = mix(); if(!j || !Array.isArray(j.pickup_zones)) return orig.apply(this, [].slice.call(arguments, 1));
    var out = {}; j.pickup_zones.forEach(function(z){ out[z.zone] = n(z.pax); });
    return out;
  });
  /* the votes are sent as well as kept in the browser's own table (the form's GUESS helper still reads that one) */
  (function(){
    var orig = window.natLearnRecordMany;
    if(typeof orig !== 'function' || orig.__qsNat) return;
    var w = function(pairs){
      var r = orig.apply(this, arguments);
      if(on() && Array.isArray(pairs) && pairs.length){
        var people = pairs.filter(function(p){ return p && p[0] && p[1] && p[1] !== 'OTHER'; }).slice(0, 500).map(function(p){ return { name: String(p[0]), nationality: String(p[1]) }; });
        if(people.length) O.post('/v1/bookings/nationality-votes', { people: people }).catch(function(e){ console.warn('[ops] nationality votes not sent', e && e.message); });
      }
      return r;
    };
    w.__qsNat = true; w.__orig = orig; window.natLearnRecordMany = w;
  })();
  wrap('mdOpenBk', function(orig, id){
    var args = [].slice.call(arguments, 1), B = O.bookings;
    if(!id || !B || typeof B.upsert !== 'function') return orig.apply(this, args);
    return O.get('/v1/bookings/' + encodeURIComponent(id)).then(function(ob){
      B.upsert(ob);
      return orig.call(window, ob.external_id || ob.id);
    }, function(e){ O.fail('Could not open the booking', e); });
  });
})();
