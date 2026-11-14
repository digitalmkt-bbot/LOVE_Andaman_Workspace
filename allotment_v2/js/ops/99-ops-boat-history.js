/* ══════════════════════════════════════════════════════════════════════════
   §opsBoatHist (sync 11-13 · lk-inbox §boatHist / §bhProj, fbb9de5b + 3ccb883b, 2026-11-12) · a boat's history & costs
   ──────────────────────────────────────────────────────────────────────────
   Legacy's panel (js/16-boat-history.js) sums a boat's trips over a month / season / year / custom range: bhCompute walks
   TRIPS[d][boat] and asks pxTrip(d, boat) for each day's P&L. In ops mode TRIPS holds 30 days back (ops/20) and pxTrip only
   knows the days the Trip P&L page already read (ops/44), so a season showed missing trips and ฿0 P&L. Here the server answers
   the whole range in one read:

   GET /v1/reports/trip-pl/boat/{id}?from=&to=   → every day the boat was deployed, its trip as GET /v1/reports/trip-pl has it

   bhLoad reads the range first (legacy's own "กำลังคำนวณ…" shows meanwhile), then runs legacy's bhLoad. While bhCompute runs,
   TRIPS and pxTrip answer from that read (the deployment cell, rescue / swap included; the trip through ops/44's legacyTrip),
   and go back right after. Maintenance, projects and status rows are legacy's, from the fleet data ops/24–26 already load;
   the cost report for "all" (ops/68) is asked for too, so the panel draws again once it lands. Legacy's texts are its own.
   Off unless laOps.enabled(). Load order: after ops/44 (legacyTrip) and ops/68. Classic script.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  function on(){ try{ return !!(O.enabled && O.enabled()); }catch(_){ return false; } }
  function enc(v){ return encodeURIComponent(v == null ? '' : String(v)); }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  var got = {}, inflight = {};
  function key(id, from, to){ return id + '|' + from + '|' + to; }
  function conv(t){
    var C = window.__laOpsCostingCompat;
    return C && typeof C.legacyTrip === 'function' ? C.legacyTrip(t) : null;
  }
  /* The deployment cell bhCompute reads: TRIPS[d][boat] (route; a rescue boat's {type:'rescue', rescueFor}; the broken boat's swap). */
  function cellOf(t){
    var c = { route: t.route_id || '', type: 'normal', booked: 0 };
    if(t.rescue && t.rescue.for){ c.type = 'rescue'; c.rescueFor = t.rescue.for; }
    if(t.swap && t.swap.to) c.swap = { to: t.swap.to, cause: t.swap.cause || '', place: t.swap.place || '', pax: t.swap.pax || 0, by: t.swap.by || '' };
    return c;
  }
  function fetchRange(id, from, to){
    var k = key(id, from, to);
    if(got[k]) return Promise.resolve(got[k]);
    if(inflight[k]) return inflight[k];
    inflight[k] = O.get('/v1/reports/trip-pl/boat/' + enc(id), { from: from, to: to }).then(function(r){
      if(!r || !Array.isArray(r.trips)) throw new Error('invalid boat Trip P&L response');
      got[k] = r.trips; return r.trips;
    }).then(function(v){ delete inflight[k]; return v; }, function(e){ delete inflight[k]; throw e; });
    return inflight[k];
  }

  var origLoad = window.bhLoad;
  if(typeof origLoad === 'function') window.bhLoad = function(){
    if(!on() || typeof _bh === 'undefined' || !_bh.id || typeof window.bhRange !== 'function') return origLoad.apply(this, arguments);
    var r = window.bhRange(), id = _bh.id, self = this;
    if(got[key(id, r[0], r[1])]) return origLoad.apply(self, arguments);
    var ov = document.getElementById('bh-ov');
    if(ov){
      var b = (typeof getBoat === 'function' && getBoat(id)) || {};
      ov.innerHTML = '<div class="bh"><div class="bh-h"><div><h2>' + esc(b.name || id) + '</h2><p>ประวัติ &amp; ค่าใช้จ่าย</p></div><button class="bh-x" onclick="bhClose()">&#10005;</button></div><div class="bh-load">กำลังคำนวณ…</div></div>';
    }
    // The cost report for every period: bhCompute's maintenance part reads costAggregate() with _costTimeFilter = 'all'.
    try{ if(O.fleetViews && typeof O.fleetViews.read === 'function') O.fleetViews.read('/v1/fleet/reports/cost', { period: 'all' }, function(){ if(document.getElementById('bh-ov') && _bh.id === id) origLoad.call(self); }); }catch(_){}
    return fetchRange(id, r[0], r[1]).then(function(){
      if(_bh.id === id && document.getElementById('bh-ov')) origLoad.call(self);
    }, function(e){
      O.fail('Boat history did not load from operation-backend', e);
      var o2 = document.getElementById('bh-ov');
      if(o2) o2.innerHTML = '<div class="bh"><div class="bh-h"><div><h2>ประวัติ &amp; ค่าใช้จ่าย</h2></div><button class="bh-x" onclick="bhClose()">&#10005;</button></div><div class="bh-load">คำนวณไม่สำเร็จ · ลองปิดแล้วเปิดใหม่</div></div>';
    });
  };

  var origCompute = window.bhCompute;
  if(typeof origCompute === 'function') window.bhCompute = function(id, from, to){
    var trips = on() ? got[key(id, from, to)] : null;
    if(!trips) return origCompute.apply(this, arguments);
    var T = {}, P = {};
    trips.forEach(function(t){ if(!t || !t.date) return; (T[t.date] = {})[id] = cellOf(t); P[t.date] = t; });
    var keepTrips = TRIPS, keepPx = window.pxTrip;
    try{
      TRIPS = T;
      window.pxTrip = function(d, bid){ return (bid === id && P[d]) ? conv(P[d]) : (typeof keepPx === 'function' ? keepPx.apply(this, arguments) : null); };
      return origCompute.apply(this, arguments);
    } finally {
      TRIPS = keepTrips; window.pxTrip = keepPx;
    }
  };
  /* A write can change a trip's P&L (actuals, bookings, deployments): read the range again next time. */
  if(typeof O.onWrite === 'function') O.onWrite(function(){ got = {}; });

  window.__laOpsBoatHist = { fetchRange: fetchRange, cellOf: cellOf, cache: function(){ return got; } };
})();
