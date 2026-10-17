/* ════════════════════════════════════════════════════════════════════════
   §opsNationalities (2026-10-12) · custom nationality list + cleanup on operation-backend
   ────────────────────────────────────────────────────────────────────────
   GET  /v1/nationalities           → the custom rows replace SB_CUSTOM_NATIONALITIES in memory
   POST /v1/nationalities/cleanup   → legacy's "Clean up the nationality list?" button
     · a dry run first, so the confirm shows the real counts
     · the server folds each copy of a built-in and rewrites the bookings
     · local bookings and the list change only from the folds the server answered with
     · no legacy blob write (sbNationalitiesPersist) in ops mode
   PATCH /v1/bookings/:id {lead_nationality} → mdBackfillNat (name-guess backfill), one queued, versioned
     write per booking; a booking the server refuses keeps its old value and is counted in the summary.
   Legacy mode: mdCleanupNats and mdBackfillNat are untouched and delegate when !enabled().
   Classic script · loads after 08-app.js, before 90-ops-boot.js.
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var legacyCleanup = window.mdCleanupNats;
  var legacyBackfill = window.mdBackfillNat;
  var backfilling = false;

  function customRows(j){
    return ((j && j.nationalities) || []).filter(function(n){ return n && n.custom; })
      .map(function(n){ return { code: n.code, name: n.name, custom: true, version: n.version }; });
  }
  function setList(rows){
    if(typeof SB_CUSTOM_NATIONALITIES === 'undefined' || !Array.isArray(SB_CUSTOM_NATIONALITIES)) return;
    SB_CUSTOM_NATIONALITIES.length = 0;
    rows.forEach(function(r){ SB_CUSTOM_NATIONALITIES.push(r); });
  }
  function load(){
    return O.get('/v1/nationalities').then(function(j){ setList(customRows(j)); return j; });
  }

  // The server's folds, applied to the in-memory bookings and list. Mirrors the server's rewrite.
  function applyFolds(folds){
    var map = {};
    folds.forEach(function(f){ if(f && f.from) map[f.from] = f.into; });
    (typeof SB_BOOKINGS !== 'undefined' ? SB_BOOKINGS : []).forEach(function(b){
      if(!b) return;
      if(b.leadNationality && map[b.leadNationality]) b.leadNationality = map[b.leadNationality];
      if(Array.isArray(b.passengers)) b.passengers.forEach(function(p){
        if(p && p.nationality && map[p.nationality]) p.nationality = map[p.nationality];
      });
    });
    if(typeof SB_CUSTOM_NATIONALITIES !== 'undefined' && Array.isArray(SB_CUSTOM_NATIONALITIES)){
      setList(SB_CUSTOM_NATIONALITIES.filter(function(n){ return !map[n.code]; }));
    }
  }

  function summary(r){
    return 'Removed/merged: ' + r.removed + '\nKept (custom): ' + r.kept + '\nBookings re-pointed: ' + r.bookings_rewritten;
  }

  window.mdCleanupNats = function(){
    if(!O.enabled()) return legacyCleanup ? legacyCleanup.apply(this, arguments) : undefined;
    return O.post('/v1/nationalities/cleanup?dry_run=true', {}).then(function(preview){
      if(!confirm('Clean up the nationality list?\n\n' + summary(preview) + '\n\nFolds custom copies of built-in nationalities into them. Continue?')) return null;
      return O.queue(function(){ return O.post('/v1/nationalities/cleanup', {}); }).then(function(r){
        applyFolds(r.folds || []);
        O.wrote('nationalities');
        try{ alert('Nationality list cleaned\n\n' + summary(r)); }catch(_){}
        if(typeof renderMarketData === 'function') renderMarketData();
        return r;
      });
    }).catch(function(e){
      O.fail('Nationality cleanup refused · nothing changed', e);
      return null;
    });
  };

  /* §opsNatBackfill · same guesses as the legacy button, but each one is written to the server first.
     The local booking changes only from the server's answer; a refused write leaves it blank. */
  function natGuess(b){
    var valid = typeof mdValidNat === 'function' ? mdValidNat : function(x){ return x || ''; };
    var guess = typeof bookingV2GuessNationality === 'function' ? bookingV2GuessNationality : function(){ return ''; };
    var g = valid(guess(b.leadPax || b.customerName || ''));
    if(!g && Array.isArray(b.passengers)){
      for(var i = 0; i < b.passengers.length; i++){
        var p = b.passengers[i];
        var pc = valid(p.nationality); if(pc){ g = pc; break; }
        var pg = valid(guess(p.name || '')); if(pg){ g = pg; break; }
      }
    }
    return g;
  }
  function backfill(){
    if(!O.enabled()) return legacyBackfill ? legacyBackfill.apply(this, arguments) : undefined;
    if(backfilling) return Promise.resolve(null);
    if(!confirm('Auto-fill Nationality on existing bookings by guessing from the customer name?\n\n· Existing nationalities are kept\n· Only fills blanks the guesser is confident about\n· Each guess is saved to the server; refused ones stay blank')) return Promise.resolve(null);
    var CXL = ['cancelled', 'rejected', 'cancelled_weather'];
    var valid = typeof mdValidNat === 'function' ? mdValidNat : function(x){ return x || ''; };
    var had = 0, filled = 0, blank = 0, total = 0, failed = [], todo = [];
    (typeof SB_BOOKINGS !== 'undefined' ? SB_BOOKINGS : []).forEach(function(b){
      if(!b || CXL.indexOf(b.status) >= 0) return; total++;
      if(valid(b.leadNationality)){ had++; return; }
      var g = natGuess(b);
      if(g) todo.push({ b: b, g: g }); else blank++;
    });
    backfilling = true;
    O.toast({ kind: 'neutral', title: 'Nationality backfill', status: 'SAVING', sub: todo.length + ' bookings', dur: 4000 });
    var chain = Promise.resolve();
    todo.forEach(function(it){
      chain = chain.then(function(){
        var b = it.b;
        if(!b.opsId){ failed.push((b.voucherRef || b.id) + ': not saved to the server yet'); return; }
        return O.queue(function(){
          return O.bookingWrite('PATCH', '/v1/bookings/' + encodeURIComponent(b.opsId), b, { lead_nationality: it.g });
        }).then(function(j){
          b.leadNationality = (j && j.lead_nationality) ? j.lead_nationality : it.g;
          if(typeof bookingV2AddHistory === 'function') bookingV2AddHistory(b, 'edit', 'Nationality auto-filled: ' + it.g, 'Edited');
          filled++;
        }, function(e){
          failed.push((b.voucherRef || b.id) + ': ' + ((e && e.message) || 'refused'));
        });
      });
    });
    return chain.then(function(){
      backfilling = false;
      var msg = 'Nationality backfill\n\nAlready had: ' + had + '\nFilled by guess: ' + filled + '\nStill blank (need manual): ' + blank + '\nTotal active bookings: ' + total;
      if(failed.length) msg += '\nRefused by server (left blank): ' + failed.length + '\n' + failed.slice(0, 8).join('\n') + (failed.length > 8 ? ' (+' + (failed.length - 8) + ' more)' : '');
      try{ alert(msg); }catch(_){}
      if(typeof renderMarketData === 'function') renderMarketData();
      return { filled: filled, failed: failed.length, blank: blank, had: had, total: total };
    });
  }
  window.mdBackfillNat = backfill;

  /* ── nationality_effective · the server's reading of each passenger (own, else the lead's), never guessed from a name ──
     Market Data's per-booking code (mdBkCode) and mix (mdBkMix) guessed from names (bookingV2GuessNationality) for a blank
     passenger. A booking from the server carries p.nationalityEffective (40-ops-bookings.js), so both read that instead. A booking
     without it (not from the server) keeps legacy's function. */
  function vn(c){ return typeof mdValidNat === 'function' ? mdValidNat(c) : ''; }
  function fromServerPax(b){
    var ps = b && b.passengers;
    return Array.isArray(ps) && ps.length > 0 && ps.every(function(p){ return p && 'nationalityEffective' in p; });
  }
  var legacyBkCode = window.mdBkCode, legacyBkMix = window.mdBkMix;
  if(typeof legacyBkCode === 'function' && !legacyBkCode.__ops){
    var wc = function(b){
      if(!O.enabled() || !fromServerPax(b)) return legacyBkCode.apply(this, arguments);
      var c = vn(b.leadNationality); if(c) return c;
      for(var i = 0; i < b.passengers.length; i++){ c = vn(b.passengers[i].nationalityEffective); if(c) return c; }
      return '';
    };
    wc.__ops = true; window.mdBkCode = wc;
  }
  if(typeof legacyBkMix === 'function' && !legacyBkMix.__ops){
    var wm = function(b){
      if(!O.enabled() || !fromServerPax(b)) return legacyBkMix.apply(this, arguments);
      var mix = {}, counted = 0;
      function add(code, n){ var c = vn(code); if(!c || n <= 0) return; mix[c] = (mix[c] || 0) + n; }
      var tot = (b.trips || []).reduce(function(s, t){ return s + ((typeof bookingV2PaxAllTot === 'function') ? bookingV2PaxAllTot(t.pax || {}) : 0); }, 0);
      var lead = vn(b.leadNationality);
      b.passengers.forEach(function(p){ var pc = vn(p.nationalityEffective); if(pc){ add(pc, 1); counted++; } });
      if(lead){ add(lead, 1); counted++; }
      var rem = tot - counted;
      if(rem > 0){ var fb = lead || (Object.keys(mix).sort(function(x, y){ return mix[y] - mix[x]; })[0] || ''); add(fb, rem); }
      return mix;
    };
    wm.__ops = true; window.mdBkMix = wm;
  }

  O.nationalities = { load: load, applyFolds: applyFolds };
})();
