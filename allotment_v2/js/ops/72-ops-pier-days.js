/* ════════════════════════════════════════════════════════════════════════
   §opsPierDays (2026-10-18) · "already on another boat" badges (Q50) and licence "covers" chips (Q54) ⇄ operation-backend
   ────────────────────────────────────────────────────────────────────────
   Q50  GET /v1/pier-office/{pier}/days/{date}/crew-flags      → assigned{<staff id | name:text>: {name, boats[]}}, doubled[]
        GET …/boats/{boat}/job  `busy_flags`                    (read by 47-ops-pier-job.js; kept in O.pierJob.state.views)
        pjCrewBusyAll(date)        → id → [{bid, name, pier}] from `assigned` (a typed name is keyed by its text, as legacy's slot is)
        pjCrewElsewhere(date,bid,id) → the card's own busy_flags first, else the same map
        pjGdBusy(date, notBid)     → legacy's answer (the guide orders, 62-ops-guide-orders.js) plus the guides the job's busy_flags name
        pjSlotRow (badge), pjOpts (the "⚠ อยู่ …" in the pick list) and the header's "คนซ้ำลำ" call those, so they need no change.
        A warning, never a refusal: the island-list 409 guide_double_booked stays as 47-ops-pier-job.js handles it.
        Until the answer is here, and while a change is waiting to be saved, legacy's own computation answers.
   Q54  GET /v1/pier-office/{pier}/licences?boats=pier          → licences[].covers {boat_id: bool}   (a licence holder's own pier)
        GET /v1/pier-office/staff/{id}/licences?boat_id=         → licences[].covers_boat              (a boat of another pier)
        plCovers(l, boat) reads it; plChip and plChips call plCovers. Without an answer, legacy's class table lookup answers.
   Outside ops mode nothing here runs. Classic script · loads after 47-ops-pier-job.js, 48-ops-pier-office.js and 62-ops-guide-orders.js.
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O || !O.pier) return;
  var P = O.pier, enc = encodeURIComponent;

  function ready(){ return !!(O.enabled && O.enabled() && P.loaded); }
  function wrap(name, fn){
    var orig = window[name];
    if(typeof orig !== 'function' || orig.__opsPierDays) return;
    var w = function(){
      if(!ready()) return orig.apply(this, arguments);
      return fn.apply(this, [orig, this].concat([].slice.call(arguments)));
    };
    w.__opsPierDays = true;
    window[name] = w;
  }
  var epoch = 0;
  O.onWrite(function(){ epoch++; });
  O.onChange(function(){ epoch++; });
  function redraw(){ if(!P.busy()) { try{ P.redraw(); }catch(_){} } }

  /* ══ Q50 · crew flags ══ */
  var flags = {}, asked = {};          // 'pier|date' → { epoch, data } · the key asked at an epoch
  function fkey(pier, date){ return pier + '|' + date; }
  function freshFlags(date){
    var pier = window._poPier; if(!pier || !date || P.busy()) return null;
    var e = flags[fkey(pier, date)];
    return e && e.epoch === epoch ? e.data : null;
  }
  function askFlags(date){
    var pier = window._poPier; if(!pier || !date) return;
    var k = fkey(pier, date);
    if(asked[k] === epoch) return;
    asked[k] = epoch;
    var ep = epoch;
    O.queue(function(){ return O.get('/v1/pier-office/' + enc(pier) + '/days/' + enc(date) + '/crew-flags'); }).then(function(j){
      if(ep !== epoch) return;
      flags[k] = { epoch: ep, data: j || {} };
      redraw();
    }, function(e){ try{ console.warn('[ops] crew flags ' + k + ' · ' + (e && e.message)); }catch(_){} });
  }
  function whereOf(b){ return { bid: b.boat_id, name: b.boat_name || b.boat_id, pier: b.pier || '' }; }

  wrap('pjCrewBusyAll', function(orig, self, date){
    var d = freshFlags(date);
    if(!d){ askFlags(date); return orig.call(self, date); }
    var m = {};
    var a = d.assigned || {};
    Object.keys(a).forEach(function(k){
      var id = k.indexOf('name:') === 0 ? (a[k].name || k.slice(5)) : k;
      m[id] = (a[k].boats || []).map(whereOf);
    });
    return m;
  });

  function jobView(date, bid){
    var s = O.pierJob && O.pierJob.state;
    return s && s.views ? s.views[date + '::' + bid] : null;
  }
  wrap('pjCrewElsewhere', function(orig, self, date, bid, id){
    if(id && !P.busy()){
      var v = jobView(date, bid), hit = [];
      ((v && v.busy_flags) || []).forEach(function(f){
        if(f.position === 'guide') return;
        if(f.staff_id === id || (!f.staff_id && f.name === id)) (f.elsewhere || []).forEach(function(w){
          if(!hit.some(function(x){ return x.bid === w.boat_id; })) hit.push(whereOf(w));
        });
      });
      if(hit.length) return hit;
    }
    return orig.call(self, date, bid, id);
  });
  wrap('pjGdBusy', function(orig, self, date, notBid){
    var out = orig.call(self, date, notBid);
    var v = notBid && !P.busy() ? jobView(date, notBid) : null;
    ((v && v.busy_flags) || []).forEach(function(f){
      if(f.position !== 'guide' || !f.staff_id || out[f.staff_id]) return;
      var w = (f.elsewhere || [])[0]; if(w) out[f.staff_id] = w.boat_name || w.boat_id;
    });
    return out;
  });

  /* ══ Q54 · licence covers ══ */
  var cov = {}, covAsked = {};        // licence id → { boat id → bool } · the key asked at an epoch
  var covEpoch = 0;
  O.onWrite(function(){ covEpoch++; });
  function covOf(lic, boat){
    var e = cov[lic.id]; return e && e.epoch === covEpoch && e.by[boat.id] !== undefined ? e.by[boat.id] : null;
  }
  function put(licId, boatId, v){
    var e = cov[licId]; if(!e || e.epoch !== covEpoch) e = cov[licId] = { epoch: covEpoch, by: {} };
    e.by[boatId] = !!v;
  }
  function staffOf(id){ return (Array.isArray(window.PIER_STAFF) ? window.PIER_STAFF : []).filter(function(s){ return s && s.id === id; })[0] || null; }
  function askOne(lic, boat, ep){                              // one person and one boat (a boat of another pier)
    var k2 = lic.staffId + '|' + boat.id;
    if(!lic.staffId || covAsked[k2] === ep) return;
    covAsked[k2] = ep;
    O.queue(function(){ return O.get('/v1/pier-office/staff/' + enc(lic.staffId) + '/licences', { boat_id: boat.id }); }).then(function(j){
      if(ep !== covEpoch) return;
      ((j && j.licences) || []).forEach(function(l){ put(l.id, boat.id, l.covers_boat); });
      redraw();
    }, function(e){ try{ console.warn('[ops] licence covers ' + k2 + ' · ' + (e && e.message)); }catch(_){} });
  }
  function askCovers(lic, boat){
    var st = staffOf(lic.staffId), ep = covEpoch;
    if(!st || !st.pier) return askOne(lic, boat, ep);
    var k = 'pier|' + st.pier;                                  // the holder's own pier: one read for all its boats
    if(covAsked[k] === ep) return askOne(lic, boat, ep);       // already read and this boat was not in it: ask for it alone
    covAsked[k] = ep;
    O.queue(function(){ return O.get('/v1/pier-office/' + enc(st.pier) + '/licences', { boats: 'pier' }); }).then(function(j){
      if(ep !== covEpoch) return;
      ((j && j.licences) || []).forEach(function(l){ Object.keys(l.covers || {}).forEach(function(b){ put(l.id, b, l.covers[b]); }); });
      if(covOf(lic, boat) === null) askOne(lic, boat, ep);
      redraw();
    }, function(e){ try{ console.warn('[ops] licence covers ' + st.pier + ' · ' + (e && e.message)); }catch(_){} });
  }
  wrap('plCovers', function(orig, self, l, boat){
    if(!l || !l.id || !boat || !boat.id || P.busy()) return orig.call(self, l, boat);   // a change not saved yet: legacy's table answers
    var v = covOf(l, boat);
    if(v === null){ askCovers(l, boat); return orig.call(self, l, boat); }
    return v;
  });

  O.pierDays = { flags: function(date){ return freshFlags(date); }, covers: function(l, b){ return covOf(l, b); } };
})();
