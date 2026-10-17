/* ════════════════════════════════════════════════════════════════════════
   §opsParkSets · Pier Park "Ticket Management" sets (legacy §pkSets) on operation-backend
   ────────────────────────────────────────────────────────────────────────
   GET    /v1/pier-office/{pier}/days/{date}/park-sets             → { types, sets, pool }
   POST   …/park-sets/draw      {boat_id, counts, picks, skip, set_id}   → picks (writes nothing)
   POST   …/park-sets           {boat_id, counts, picks, name}           → a new set
   PATCH  …/park-sets/{id}      {name, counts, picks}                    → edit an open set
   DELETE …/park-sets/{id}
   POST   …/park-sets/{id}/bought | /unbought                            (no body)

   Legacy kept the sets in PIER_CFG.parkSets (a blob on one device), drew the people at random in the
   browser and decided the amount from the typed price card. In ops mode:
     · the server draws (pkSetCnt / pkSetQuick / pkSetTog / pkSetShuffle ask POST …/draw and put the answer's
       `picks` in the draft) and enforces "one person in one set", the bought lock and the amount
     · pkSets(date) answers from the server's sets (converted to legacy's shape); pkSetsWrite is a no-op
     · pkSetFill is a no-op (the renderer calls it on every redraw and cannot wait for a request)
     · pkSetAmt reads the server's amount (the route's cost plan), not the typed price card
   Client alerts of pkSetSave (no tickets / not enough people) are kept so the screen answers at once.
   A refused write is shown with alert(message), as legacy's pkSetSave does, and the sets are re-read.
   Legacy mode: every wrapper delegates to the captured original when !enabled().
   Classic script · loads after 32-ops-park.js and 42-ops-pier-core.js, before 90-ops-boot.js.
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var enc = encodeURIComponent;
  var L = {};
  ['pkSets','pkSetsWrite','pkSetFill','pkSetCnt','pkSetQuick','pkSetTog','pkSetShuffle','pkSetSave','pkSetDel','pkSetBought','pkSetAmt','renderPierPark']
    .forEach(function(n){ L[n] = window[n]; });
  function enabled(){ return !!(O.enabled && O.enabled()); }

  var st = { data: {}, pending: {}, failed: {}, seq: {} };    // keyed by pier|date
  function curKey(){ return (window._poPier || '') + '|' + (window._poDate || ''); }
  function base(pier, date){ return '/v1/pier-office/' + enc(pier) + '/days/' + enc(date) + '/park-sets'; }
  function nat3(n){ try{ return typeof window.pckNat3 === 'function' ? window.pckNat3(n) : (n || ''); }catch(_){ return n || ''; } }
  function redraw(){ if(typeof window.renderPierPark === 'function') window.renderPierPark(); }

  /* one server set -> legacy's PIER_CFG.parkSets[date][i] shape; the server's own numbers ride along (_srv) */
  function convSet(s){
    var o = {
      id: s.id, name: s.name || '', bid: s.boat_id, rid: s.route_id, cnt: s.counts || {},
      people: (s.people || []).map(function(p){
        var q = { k: p.key, full: p.full || '', nat3: nat3(p.nationality), cat: p.cat, bkId: p.booking_id, vc: p.voucher || '', ph: !!p.waiting };
        if(p.from_boat_id) q.from = p.from_boat_id;
        return q;
      }),
      by: s.created_by || '', at: s.created_at || '', bought: !!s.bought
    };
    if(s.edited_by) o.editBy = s.edited_by;
    if(s.edited_at) o.editAt = s.edited_at;
    if(s.bought){ o.boughtAt = s.bought_at || ''; o.boughtBy = s.bought_by || ''; }
    o._srv = { amount: s.amount, miss: s.miss || [], missing_count: s.missing_count || 0 };
    return o;
  }

  /* ── reads ──────────────────────────────────────────────────────────── */
  function load(pier, date){
    pier = pier || window._poPier; date = date || window._poDate;
    if(!pier || !date) return Promise.resolve(null);
    var key = pier + '|' + date, my = (st.seq[key] = (st.seq[key] || 0) + 1);
    st.pending[key] = true;
    return O.get(base(pier, date)).then(function(j){
      if(my !== st.seq[key]) return j;
      st.pending[key] = false; st.failed[key] = false;
      st.data[key] = { sets: ((j && j.sets) || []).map(convSet), pool: (j && j.pool) || [] };
      return j;
    }, function(e){
      if(my === st.seq[key]){ st.pending[key] = false; st.failed[key] = true; }
      O.fail('Park ticket sets did not load', e);
      return null;
    });
  }
  function ensure(){
    var key = curKey();
    if(!window._poPier || !window._poDate || st.data[key] || st.pending[key] || st.failed[key]) return;
    load().then(function(j){ if(j) redraw(); });
  }
  window.renderPierPark = function(){
    var r = L.renderPierPark.apply(this, arguments);
    if(enabled()) ensure();
    return r;
  };

  window.pkSets = function(date){
    if(!enabled()) return L.pkSets.apply(this, arguments);
    var d = st.data[(window._poPier || '') + '|' + date];
    return d ? d.sets : [];
  };
  window.pkSetsWrite = function(){
    if(!enabled()) return L.pkSetsWrite.apply(this, arguments);
    /* the server keeps the sets; PIER_CFG.parkSets is never written in ops mode */
  };
  window.pkSetFill = function(D){
    if(!enabled()) return L.pkSetFill.apply(this, arguments);
    return D;
  };
  window.pkSetAmt = function(S){
    if(!enabled() || !S || !S._srv) return L.pkSetAmt.apply(this, arguments);
    var by = {}, miss = (S._srv.miss || []).slice();
    (S.people || []).forEach(function(q){ by[q.cat] = (by[q.cat] || 0) + 1; });
    if(S._srv.amount === null || S._srv.amount === undefined){ miss = Object.keys(by); return { amt: 0, by: by, miss: miss }; }   // no price on the route
    return { amt: +S._srv.amount || 0, by: by, miss: miss };
  };

  /* ── the draw ───────────────────────────────────────────────────────── */
  var drawSeq = 0;
  function counts(D){
    var c = {}; Object.keys(D.cnt || {}).forEach(function(k){ var n = parseInt(D.cnt[k], 10) || 0; c[k] = Math.max(0, Math.min(999, n)); });
    return c;
  }
  function drawBody(D, picks, skip){
    var b = { boat_id: D.bid, counts: counts(D), picks: picks, skip: skip };
    if(D.id) b.set_id = D.id;
    return b;
  }
  // ask the server for the picks; the answer replaces D.picks (D.fresh marks the people newly drawn)
  function draw(D, picks, skip){
    var my = ++drawSeq;
    var before = (D.picks || []).slice();
    return O.queue(function(){ return O.post(base(window._poPier, window._poDate) + '/draw', drawBody(D, picks, skip)); }).then(function(a){
      if(my !== drawSeq) return;                                       // a later draw won
      D.picks = ((a && a.picks) || []).slice();
      D.fresh = D.fresh || {};
      D.picks.forEach(function(k){ if(before.indexOf(k) < 0) D.fresh[k] = 1; });
    }, function(e){
      if(my === drawSeq) alert((e && e.message) || 'The draw was refused');
    });
  }
  function skipKeys(D){ return Object.keys(D.skip || {}).filter(function(k){ return D.skip[k]; }); }
  function open(){
    var D = typeof window.pkSetDraft === 'function' ? window.pkSetDraft() : null;
    return (D && !D.locked) ? D : null;
  }

  window.pkSetCnt = function(cat, v){
    if(!enabled()) return L.pkSetCnt.apply(this, arguments);
    var D = open(); if(!D) return;
    v = Math.max(0, parseInt(v, 10) || 0); D.cnt[cat] = v;
    return draw(D, D.picks || [], skipKeys(D)).then(function(){
      redraw();
      try{ var el = document.querySelector('#pk-host-' + window._poPier + ' .pk3-in[data-cat="' + cat + '"]'); if(el){ el.focus(); el.select(); } }catch(_){}
    });
  };
  window.pkSetQuick = function(mode){
    if(!enabled()) return L.pkSetQuick.apply(this, arguments);
    var D = open(); if(!D) return;
    var flat = window.pk3Flat(), x = window.pkSetBoatX(flat, D.bid); if(!x) return;
    var used = window.pkSetUsed(window._poDate, D.id), av = window.pkSetAvail(x.B, used), by = {};
    av.forEach(function(p){ if(mode === 'named' && p.ph && !p.typed) return; if(mode === 'fr' && !/FR$/.test(p.cat)) return; by[p.cat] = (by[p.cat] || 0) + 1; });
    D.cnt = {}; Object.keys(by).forEach(function(c){ D.cnt[c] = (mode === 'half') ? Math.ceil(by[c] / 2) : by[c]; });
    D.picks = []; D.skip = {}; D.fresh = {};
    return draw(D, [], []).then(redraw);
  };
  window.pkSetTog = function(k){
    if(!enabled()) return L.pkSetTog.apply(this, arguments);
    var D = open(); if(!D) return;
    if((D.picks || []).indexOf(k) < 0) return L.pkSetTog.apply(this, arguments);   // ticking back in: legacy's own "type is full" check, no call
    D.picks.splice(D.picks.indexOf(k), 1); D.skip = D.skip || {}; D.skip[k] = 1;
    return draw(D, D.picks, skipKeys(D)).then(redraw);
  };
  window.pkSetShuffle = function(){
    if(!enabled()) return L.pkSetShuffle.apply(this, arguments);
    var D = open(); if(!D) return;
    D.picks = []; D.skip = {}; D.fresh = {};
    return draw(D, [], []).then(redraw);
  };

  /* ── writes ─────────────────────────────────────────────────────────── */
  function write(fn){
    return O.queue(fn).then(function(r){
      O.wrote('park');
      return load().then(function(){ return r; });
    }, function(e){
      alert((e && e.message) || 'Not saved');
      return load().then(function(){ return null; });
    });
  }

  window.pkSetSave = function(){
    if(!enabled()) return L.pkSetSave.apply(this, arguments);
    if(typeof window.poGuard === 'function' && !window.poGuard()) return;
    var D = open(); if(!D) return;
    var PL = window.pkSetPool(window.pk3Flat(), D), x = PL.x; if(!x){ alert('Boat not found on this date.'); return; }
    var P = {}; Object.keys(PL.P).forEach(function(k){ P[k] = PL.P[k].p; });
    var tot = 0; Object.keys(D.cnt).forEach(function(c){ tot += (+D.cnt[c] || 0); });
    if(!tot){ alert('Enter how many tickets go in this set first.'); return; }
    var by = {}; D.picks.forEach(function(k){ var p = P[k]; if(p) by[p.cat] = (by[p.cat] || 0) + 1; });
    var short = Object.keys(D.cnt).filter(function(c){ return (+D.cnt[c] || 0) > (by[c] || 0); });
    if(short.length){ alert('Not enough people left on this route for: ' + short.map(function(c){ return c + (window.pkTkCat(c).code ? ('/' + window.pkTkCat(c).code) : '') + ' (need ' + D.cnt[c] + ', have ' + (by[c] || 0) + ')'; }).join(', ')); return; }
    var cnt = {}; Object.keys(D.cnt).forEach(function(c){ if(+D.cnt[c]) cnt[c] = +D.cnt[c]; });
    var picks = D.picks.slice(), name = D.name || '', id = D.id, bid = D.bid, path = base(window._poPier, window._poDate);
    return write(function(){
      if(id) return O.patch(path + '/' + enc(id), { name: name, counts: cnt, picks: picks });
      var body = { boat_id: bid, counts: cnt, picks: picks };
      if(name) body.name = name;
      return O.post(path, body);
    }).then(function(r){
      if(r){ window._pkSetD = null; }
      redraw();
    });
  };

  window.pkSetDel = function(id){
    if(!enabled()) return L.pkSetDel.apply(this, arguments);
    if(typeof window.poGuard === 'function' && !window.poGuard()) return;
    var S = window.pkSetById(id); if(!S) return;
    if(!confirm('Delete this set? (' + (S.people || []).length + ' tickets, id ' + String(S.id).slice(-4).toUpperCase() + ')')) return;
    var path = base(window._poPier, window._poDate) + '/' + enc(id);
    return write(function(){ return O.del(path); }).then(function(){
      if(window._pkSetD && window._pkSetD.id === id) window._pkSetD = null;
      redraw();
    });
  };

  window.pkSetBought = function(id, on){
    if(!enabled()) return L.pkSetBought.apply(this, arguments);
    if(typeof window.poGuard === 'function' && !window.poGuard()) return;
    var path = base(window._poPier, window._poDate) + '/' + enc(id) + (on ? '/bought' : '/unbought');
    /* 409 set_bought / not_bought: legacy re-stamped silently, so just re-read and redraw, no message */
    return O.queue(function(){ return O.post(path, undefined); }).then(function(){ O.wrote('park'); }, function(e){
      if(!(e && e.status === 409 && (e.code === 'set_bought' || e.code === 'not_bought'))) alert((e && e.message) || 'Not saved');
    }).then(function(){ return load(); }).then(function(){
      var S = window.pkSetById(id);
      if(window._pkSetD && window._pkSetD.id === id) window._pkSetD.locked = !!(S && S.bought);
      redraw();
    });
  };

  O.parkSets = { load: load, state: st };
})();
