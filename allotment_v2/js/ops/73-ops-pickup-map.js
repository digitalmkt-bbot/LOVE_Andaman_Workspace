/* ══════════════════════════════════════════════════════════════════════════
   §opsPickupMapSrv (w4-f1, 2026-10-18) · Pickup Map ⇄ GET /v1/reports/pickup-map
   ──────────────────────────────────────────────────────────────────────────
   Server: operation-backend todo/b2-reports-model.md. Legacy walked every booking in the browser at each click, and
   56-ops-rep-pickupmap.js loaded both periods' bookings first (and in year mode could only say "showing loaded bookings").
   The server answers for the screen's period (week / month / year of the anchor day), the period before, the agent filter
   and the market filter, in pax and in value:

     pmapAgg          the map's state (_PM): areas with pins {key, pax, val, mk{market:{pax,val}}}, market totals, the total, the
                      "other" bucket (areas the map has no pin for, and bookings with no pickup area), the previous period per
                      area, the airport arrivals      ← areas[], markets[], totals, no_area, previous_totals, airport_arrivals
                      (asked with the agent filter only: the market chips switch the dots on the map, they do not remove areas)
     pmapMoM          the ▲▼ % against the period before ← areas[].change_pct
     pmapAreaDetail   the panel of one area: top 5 hotels and agents, bookings ← areas[].top_hotels / top_agents / bookings
     pmapAgHotels     the chosen agent's hotels           ← agent_hotels[]
     pmapAgentZone    the agent x zone card               ← agent_matrix
     renderPickupMap, pmapRefresh   keep 56's booking loads from starting once the answer is here or on its way
   The pins, colours and the dots are display (legacy's): the server serves every area, the client places the ones it has a pin for.
   Until the first answer (and if it fails) legacy's sums run. Classic script, after 56-ops-rep-pickupmap.js.
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
    if(O.activeView() === 'pickupmap' && !O.busy() && typeof window.pmapRefresh === 'function') window.pmapRefresh();
  }
  /* variant A: the map (agent filter only) · variant B: the panels (agent and market filters) */
  function read(withMarket){
    if(typeof _pmapMode === 'undefined' || !_pmapAnchor) return null;
    var q = { period: _pmapMode, anchor: _pmapAnchor, metric: _pmapMetric };
    if(typeof _pmapAgFilter !== 'undefined' && _pmapAgFilter) q.agent = _pmapAgFilter;
    if(withMarket && _pmapMkFilter) q.market = _pmapMkFilter;
    var key = 'pmap|' + [q.period, q.anchor, q.metric, q.agent || '', q.market || ''].join('|');
    var j = O.srv.read(key, '/v1/reports/pickup-map', q, repaint);
    return { j: j, key: key };
  }
  function A(){ var r = read(false); return r && r.j; }
  function B(){ var r = read(true); return r && r.j; }

  wrap('pmapAgg', function(orig){
    var j = A(); if(!j) return orig.apply(this, [].slice.call(arguments, 1));
    var areas = [], other = { pax: 0, val: 0 }, otherAreas = {}, prev = {}, mkTot = {};
    var mk = function(m){ var o = {}; Object.keys(m || {}).forEach(function(k){ o[k] = { pax: n(m[k].pax), val: n(m[k].value) }; }); return o; };
    (j.areas || []).forEach(function(a){
      if(typeof PHUKET_LL !== 'undefined' && PHUKET_LL[a.area]){
        areas.push({ key: a.area, pax: n(a.pax), val: n(a.value), mk: mk(a.markets), __srv: a });
        if(a.previous) prev[a.area] = { pax: n(a.previous.pax), val: n(a.previous.value) };
      } else {
        other.pax += n(a.pax); other.val += n(a.value); otherAreas[a.area || 'ไม่ระบุ'] = (otherAreas[a.area || 'ไม่ระบุ'] || 0) + n(a.pax);
      }
    });
    if(j.no_area && n(j.no_area.pax) > 0){ other.pax += n(j.no_area.pax); other.val += n(j.no_area.value); otherAreas['ไม่ระบุ'] = (otherAreas['ไม่ระบุ'] || 0) + n(j.no_area.pax); }
    (j.markets || []).forEach(function(m){ mkTot[m.market_id] = { pax: n(m.pax), val: n(m.value) }; });
    _PM.areas = areas; _PM.mkTot = mkTot; _PM.tot = { pax: n(j.totals.pax), val: n(j.totals.value) }; _PM.other = other; _PM.otherAreas = otherAreas;
    _PM.prev = prev; _PM.unit = n(j.totals.pax) > 0 ? n(j.totals.value) / n(j.totals.pax) : 1;
    var arr = j.airport_arrivals; _PM.arr = (arr && typeof arr === 'object') ? (arr.arrivals != null ? n(arr.arrivals) : (arr.total != null ? n(arr.total) : null)) : (typeof arr === 'number' ? arr : null);
  });

  wrap('pmapMoM', function(orig, key){
    var j = A(), a = j && (j.areas || []).filter(function(x){ return x.area === key; })[0];
    if(!a) return orig.apply(this, [].slice.call(arguments, 1));
    var v = a.change_pct && a.change_pct[_pmapMetric === 'value' ? 'value' : 'pax'];
    return v == null ? null : v;
  });

  wrap('pmapAreaDetail', function(orig, key){
    var j = B(), a = j && (j.areas || []).filter(function(x){ return x.area === key; })[0];
    if(!j) return orig.apply(this, [].slice.call(arguments, 1));
    if(!a) return { hotels: [], agents: [], bk: 0 };
    var w = function(x){ return _pmapMetric === 'value' ? n(x.value) : n(x.pax); };
    return { hotels: (a.top_hotels || []).map(function(x){ return [x.name, w(x)]; }), agents: (a.top_agents || []).map(function(x){ return [x.name, w(x)]; }), bk: n(a.bookings) };
  });

  wrap('pmapAgHotels', function(orig){
    if(typeof _pmapAgFilter === 'undefined' || !_pmapAgFilter) return [];
    var j = B(); if(!j || !Array.isArray(j.agent_hotels)) return orig.apply(this, [].slice.call(arguments, 1));
    return j.agent_hotels.map(function(h){ return { name: h.name, zone: h.region || '', area: h.area || '', w: n(h.weight), n: n(h.bookings), nArea: n(h.areas) }; });
  });

  wrap('pmapAgentZone', function(orig){
    var j = B(), m = j && j.agent_matrix; if(!m) return orig.apply(this, [].slice.call(arguments, 1));
    var AG = {}, AO = [], ZT = {}, ZO = [];
    (m.regions || []).forEach(function(r){ ZT[r.region] = n(r.total); ZO.push(r.region); });
    (m.agents || []).forEach(function(a){
      var z = {}, zo = Object.keys(a.regions || {});
      zo.forEach(function(k){ z[k] = n(a.regions[k]); });
      AG[a.agent] = { key: a.agent, name: a.name, mk: a.market_id, w: zo.reduce(function(s, k){ return s + z[k]; }, 0), n: n(a.bookings), pax: n(a.pax), z: z, zo: zo };
      AO.push(a.agent);
    });
    return { AG: AG, AO: AO, ZT: ZT, ZO: ZO, tot: n(m.total) };
  });

  /* 56's ensurePmap() loads both periods' bookings after every draw: not needed when the server answers */
  function withoutLoads(orig, args, self){
    var ens = window.bookingV2EnsureOpsRange;
    window.bookingV2EnsureOpsRange = function(){ return null; };
    var r;
    try{ r = orig.apply(self, args); } finally { window.bookingV2EnsureOpsRange = ens; }
    var el = document.getElementById('pmap-ops-period'); if(el) el.remove();
    return r;
  }
  ['renderPickupMap', 'pmapRefresh'].forEach(function(name){
    wrap(name, function(orig){
      if(typeof _pmapAnchor !== 'undefined' && !_pmapAnchor && typeof _pmYmd === 'function') _pmapAnchor = _pmYmd(new Date());   // as renderPickupMap does, so the first draw can ask
      var args = [].slice.call(arguments, 1), r = read(false);
      if(!r || O.srv.status(r.key) === 'failed') return orig.apply(this, args);
      return withoutLoads(orig, args, this);
    });
  });
})();
