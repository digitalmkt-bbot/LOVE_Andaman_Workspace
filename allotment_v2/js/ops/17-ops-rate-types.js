/* ══════════════════════════════════════════════════════════════════════════
   §opsRateTypes · operation-backend rate types
   ──────────────────────────────────────────────────────────────────────────
   The Rate Type page still speaks the legacy camelCase shape because booking
   quote functions consume it directly.  This adapter is the only translation
   boundary: operation-backend owns the rows, while the browser receives a
   booking-compatible projection.

   Ops mode is deliberately server-first.  The legacy functions remain intact
   for a real server.js session; this file only replaces their entry points
   when LA_LEGACY_UNAVAILABLE and an authenticated ops client are active.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps;
  if(!O) return;

  var state = { loaded:false, failed:false, loading:null };
  var originals = {};
  var LEGACY_PAX = {
    ad_fr:'adult-fr', chd_fr:'child-fr', inf_fr:'infant-fr',
    ad_th:'adult-thai', chd_th:'child-thai', inf_th:'infant-thai'
  };
  var SERVER_PAX = {
    'adult-fr':'ad_fr', 'child-fr':'chd_fr', 'infant-fr':'inf_fr',
    'adult-thai':'ad_th', 'child-thai':'chd_th', 'infant-thai':'inf_th'
  };

  function clone(value){ return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function finiteNumber(value){
    if(value === '' || value === null || value === undefined) return null;
    var n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  function put(obj, key, value){ if(value !== undefined && value !== null) obj[key] = value; }
  function routeValidity(rt, id){ return (rt.routeValidity && rt.routeValidity[id]) || {}; }

  /* operation-backend RateType → legacy shape used by booking quote code */
  function fromServer(s){
    s = s || {};
    var out = {
      id:s.id, code:s.code || '', name:s.name || '', note:s.note || '', color:s.color || '#185FA5',
      createdDate:s.created_on || (s.created_at ? String(s.created_at).slice(0,10) : ''),
      validFrom:s.valid_from || '', validTo:s.valid_to || '', active:s.active !== false,
      owner:s.owner || '', nationalityScope:s.nationality_scope || 'both',
      transferUnit:s.transfer_unit || '', routes:[], seatRates:{}, priceTiers:{}, routeValidity:{},
      routeBundles:{}, charterRates:{}, addOns:{}
    };
    var longtailApplies = [];
    var longtailByRoute = {};
    (Array.isArray(s.routes) ? s.routes : []).forEach(function(r){
      if(!r || !r.route_id) return;
      var id = r.route_id;
      out.routes.push(id);
      out.seatRates[id] = {};
      var validity = {};
      if(r.travel_from) validity.from = r.travel_from;
      if(r.travel_to) validity.to = r.travel_to;
      if(Object.keys(validity).length) out.routeValidity[id] = validity;

      Object.keys(r.zones || {}).forEach(function(zone){
        var tiers = r.zones[zone] || {};
        var net = tiers.net || {};
        var legacyNet = {};
        Object.keys(net).forEach(function(key){
          if(LEGACY_PAX[key] && finiteNumber(net[key]) !== null) legacyNet[LEGACY_PAX[key]] = Number(net[key]);
        });
        /* A route with a sell/min-sell-only row is still represented in the
           editor, but only net is chargeable by the booking engine. */
        out.seatRates[id][zone] = legacyNet;
        ['sell','min_sell'].forEach(function(tier){
          var grid = tiers[tier]; if(!grid) return;
          Object.keys(grid).forEach(function(key){
            var legacy = LEGACY_PAX[key], n = finiteNumber(grid[key]);
            if(!legacy || n === null) return;
            if(!out.priceTiers[id]) out.priceTiers[id] = {};
            if(!out.priceTiers[id][zone]) out.priceTiers[id][zone] = {};
            if(!out.priceTiers[id][zone][legacy]) out.priceTiers[id][zone][legacy] = {};
            out.priceTiers[id][zone][legacy][tier === 'min_sell' ? 'minSell' : 'sell'] = Number(n);
          });
        });
      });

      if(r.longtail_bundle){
        var b = r.longtail_bundle;
        out.routeBundles[id] = { longtail:{ mode:b.mode, adult:Number(b.adult || 0), child:Number(b.child || 0), applyTo:b.applies_to || 'seat' } };
      }
      if(r.charter && Object.keys(r.charter).length){
        out.charterRates[id] = {};
        Object.keys(r.charter).forEach(function(type){
          var c = r.charter[type] || {};
          out.charterRates[id][type] = {
            starterPrice: Number(c.starter_price || 0), starterIncludes:Number(c.starter_includes || 0),
            extraPerPax:Number(c.extra_per_pax || 0)
          };
        });
      }
      if(r.longtail){
        longtailApplies.push(id);
        longtailByRoute[id] = {
          join:{ adult:Number(r.longtail.join_adult || 0), child:Number(r.longtail.join_child || 0) },
          charter:{ price:Number(r.longtail.charter_price || 0), capacity:Number(r.longtail.charter_capacity || 0) }
        };
      }
      if(r.transfer && Object.keys(r.transfer).length){
        if(!out.addOns.privateTransfer) out.addOns.privateTransfer = { unit:out.transferUnit || 'per trip' };
        out.addOns.privateTransfer[id] = {};
        Object.keys(r.transfer).forEach(function(zone){
          var vehicles = r.transfer[zone] || {}, row = {};
          ['sedan','van'].forEach(function(vehicle){
            var n = finiteNumber(vehicles[vehicle]); if(n !== null) row[vehicle] = Number(n);
          });
          if(Object.keys(row).length) out.addOns.privateTransfer[id][zone] = row;
        });
        if(!Object.keys(out.addOns.privateTransfer[id]).length) delete out.addOns.privateTransfer[id];
      }
    });
    if(longtailApplies.length){
      out.addOns.longtail = { applies:longtailApplies, byRoute:longtailByRoute, unit:'per pax' };
    }
    return out;
  }

  function setGrid(grid, legacyKey, value){
    var key = SERVER_PAX[legacyKey], n = finiteNumber(value);
    if(key && n !== null) grid[key] = Number(n);
  }
  function blockFor(d, routeId){
    var rv = routeValidity(d, routeId), zones = {}, seat = (d.seatRates && d.seatRates[routeId]) || {};
    var tiers = (d.priceTiers && d.priceTiers[routeId]) || {};
    Object.keys(seat).forEach(function(zone){
      if(seat[zone] === null) return; // API has no row for an explicit no-offer zone.
      var z = {}, net = {};
      Object.keys(seat[zone] || {}).forEach(function(key){ setGrid(net, key, seat[zone][key]); });
      if(Object.keys(net).length) z.net = net;
      ['sell','minSell'].forEach(function(legacyTier){
        var grid = {}, source = (tiers[zone] || {});
        Object.keys(source).forEach(function(key){ setGrid(grid, key, source[key] && source[key][legacyTier]); });
        if(Object.keys(grid).length) z[legacyTier === 'minSell' ? 'min_sell' : legacyTier] = grid;
      });
      if(Object.keys(z).length) zones[zone] = z;
    });
    /* Keep tier-only zones.  The UI permits entering Selling before Net. */
    Object.keys(tiers).forEach(function(zone){
      if(zones[zone]) return;
      var z = {};
      ['sell','minSell'].forEach(function(legacyTier){
        var grid = {};
        Object.keys(tiers[zone] || {}).forEach(function(key){ setGrid(grid, key, tiers[zone][key] && tiers[zone][key][legacyTier]); });
        if(Object.keys(grid).length) z[legacyTier === 'minSell' ? 'min_sell' : legacyTier] = grid;
      });
      if(Object.keys(z).length) zones[zone] = z;
    });

    var block = { travel_from:rv.from || null, travel_to:rv.to || null, zones:zones, charter:{}, longtail:null, transfer:{} };
    var bundle = d.routeBundles && d.routeBundles[routeId] && d.routeBundles[routeId].longtail;
    if(bundle){
      block.longtail_bundle = { mode:bundle.mode || 'free', adult:Number(bundle.adult || 0), child:Number(bundle.child || 0), applies_to:bundle.applyTo || 'seat' };
    } else block.longtail_bundle = null;
    var charter = d.charterRates && d.charterRates[routeId];
    Object.keys(charter || {}).forEach(function(type){
      var c = charter[type] || {};
      block.charter[type] = { starter_price:finiteNumber(c.starterPrice), starter_includes:finiteNumber(c.starterIncludes), extra_per_pax:finiteNumber(c.extraPerPax) };
    });
    var lt = d.addOns && d.addOns.longtail, normalized = null;
    if(lt){
      normalized = (typeof _rtNormalizeLongtail === 'function') ? _rtNormalizeLongtail(lt) : lt;
      var applies = Array.isArray(normalized.applies) ? normalized.applies : [];
      if(applies.includes(routeId) || (!applies.length && normalized.byRoute && normalized.byRoute[routeId])){
        var lr = (normalized.byRoute && normalized.byRoute[routeId]) || normalized;
        block.longtail = {
          join_adult:finiteNumber(lr.join && lr.join.adult), join_child:finiteNumber(lr.join && lr.join.child),
          charter_price:finiteNumber(lr.charter && lr.charter.price), charter_capacity:finiteNumber(lr.charter && lr.charter.capacity)
        };
      }
    }
    var pt = d.addOns && d.addOns.privateTransfer && d.addOns.privateTransfer[routeId];
    Object.keys(pt || {}).forEach(function(zone){
      if(zone === 'unit') return;
      var values = {}, row = pt[zone] || {};
      ['sedan','van'].forEach(function(vehicle){ var n = finiteNumber(row[vehicle]); if(n !== null) values[vehicle] = Number(n); });
      if(Object.keys(values).length) block.transfer[zone] = values;
    });
    return block;
  }

  /* legacy shape → operation-backend create body */
  function toCreateBody(d){
    var body = {
      name:String(d.name || '').trim(), note:d.note || null, color:d.color || null, owner:d.owner || null,
      valid_from:d.validFrom || null, valid_to:d.validTo || null, active:d.active !== false,
      nationality_scope:d.nationalityScope || null, transfer_unit:d.transferUnit || null,
      routes:[]
    };
    (d.routes || []).forEach(function(routeId){ body.routes.push({ route_id:routeId, ...blockFor(d, routeId) }); });
    if(d.id) body.id = d.id;
    if(d.code) body.code = d.code;
    return body;
  }
  function toPatch(d){
    return { name:String(d.name || '').trim(), note:d.note || null, color:d.color || null, owner:d.owner || null,
      valid_from:d.validFrom || null, valid_to:d.validTo || null, active:d.active !== false,
      nationality_scope:d.nationalityScope || null, transfer_unit:d.transferUnit || null };
  }
  function unsupportedAddOns(d){
    return Object.keys(d.addOns || {}).filter(function(key){ return key !== 'longtail' && key !== 'privateTransfer' && d.addOns[key]; });
  }

  function replaceRate(server){
    var mapped = fromServer(server);
    if(typeof SB_RATE_TYPES === 'undefined') return mapped;
    var index = SB_RATE_TYPES.findIndex(function(x){ return x && x.id === mapped.id; });
    if(index < 0) SB_RATE_TYPES.push(mapped); else SB_RATE_TYPES[index] = mapped;
    return mapped;
  }
  function replaceAll(serverRows){
    var mapped = (serverRows || []).map(fromServer);
    if(typeof SB_RATE_TYPES !== 'undefined'){
      SB_RATE_TYPES.length = 0;
      Array.prototype.push.apply(SB_RATE_TYPES, mapped);
    }
    try{ if(typeof rtRebuildAddonDefs === 'function') rtRebuildAddonDefs(); }catch(_){ }
    return mapped;
  }
  function redraw(){
    if(O.busy && O.busy()) return;
    try{
      var active = document.querySelector('.nav-item.active[data-view]');
      if(active && active.dataset.view === 'rate-types' && typeof window.renderRateTypes === 'function') window.renderRateTypes();
    }catch(_){ }
  }
  function load(){
    if(!O.enabled()) return Promise.resolve(false);
    if(state.loading) return state.loading;
    state.loading = O.get('/v1/rate-types', { active:'all' }).then(function(result){
      var summaries = (result && result.rate_types) || [];
      return Promise.all(summaries.map(function(summary){ return O.get('/v1/rate-types/' + encodeURIComponent(summary.id)); }));
    }).then(function(rows){
      replaceAll(rows); state.loaded = true; state.failed = false; redraw(); return true;
    }).catch(function(error){
      state.loaded = false; state.failed = true;
      if(typeof SB_RATE_TYPES !== 'undefined') SB_RATE_TYPES.length = 0;
      O.fail('Could not load rate types', error);
      redraw(); return false;
    }).finally(function(){ state.loading = null; });
    return state.loading;
  }
  function refreshOne(id){
    return O.get('/v1/rate-types/' + encodeURIComponent(id)).then(function(row){ return replaceRate(row); });
  }
  function ready(){ return state.loaded ? Promise.resolve(true) : load(); }
  function canWrite(){ return O.enabled() && state.loaded; }
  function failNotReady(){ O.fail('Rate types are not ready', new Error(state.failed ? 'The server rate-type load failed; reload before editing' : 'Rate types are still loading')); }

  /* Testable mapping contract; also useful in the console when checking a live payload. */
  window.__laOpsRateTypeCompat = { fromServer:fromServer, toCreateBody:toCreateBody, toPatch:toPatch, blockFor:blockFor };
  O.rateTypes = { load:load, refresh:refreshOne, ready:ready, state:state, fromServer:fromServer, toCreateBody:toCreateBody };

  ['renderRateTypes','rtOpenEdit','rtOpenNew','rtSaveDraft','rtPersist','rtAddonTypesOpen','rtDeleteRT'].forEach(function(name){
    originals[name] = window[name];
  });

  /* Never let a local seed render as if it were server data in ops mode. */
  if(O.enabled() && typeof SB_RATE_TYPES !== 'undefined') SB_RATE_TYPES.length = 0;

  if(typeof originals.renderRateTypes === 'function'){
    window.renderRateTypes = function(){
      if(!O.enabled()) return originals.renderRateTypes.apply(this, arguments);
      return originals.renderRateTypes.apply(this, arguments);
    };
  }
  if(typeof originals.rtOpenNew === 'function'){
    window.rtOpenNew = function(){
      if(!O.enabled()) return originals.rtOpenNew.apply(this, arguments);
      if(!canWrite()){ failNotReady(); return; }
      return originals.rtOpenNew.apply(this, arguments);
    };
  }
  if(typeof originals.rtOpenEdit === 'function'){
    window.rtOpenEdit = function(id){
      if(!O.enabled()) return originals.rtOpenEdit.apply(this, arguments);
      if(!state.loaded){ failNotReady(); return; }
      return O.queue(function(){ return refreshOne(id); }).then(function(){ return originals.rtOpenEdit.call(this, id); }.bind(this)).catch(function(error){ O.fail('Could not open rate type', error); });
    };
  }
  if(typeof originals.rtAddonTypesOpen === 'function'){
    window.rtAddonTypesOpen = function(){
      if(!O.enabled()) return originals.rtAddonTypesOpen.apply(this, arguments);
      O.fail('Custom add-on types are not available', new Error('S2 only supports operation-backend longtail and private-transfer pricing')); return;
    };
  }
  if(typeof originals.rtPersist === 'function'){
    window.rtPersist = function(){
      if(!O.enabled()) return originals.rtPersist.apply(this, arguments);
      /* All durable rate-type writes use the API adapter. */
      return false;
    };
  }
  if(typeof originals.rtDeleteRT === 'function'){
    window.rtDeleteRT = function(id){
      if(!O.enabled()) return originals.rtDeleteRT.apply(this, arguments);
      if(!canWrite()){ failNotReady(); return; }
      if(!confirm('Delete this rate type? The server will refuse if it is in use.')) return;
      return O.queue(function(){ return O.del('/v1/rate-types/' + encodeURIComponent(id)); }).then(function(){
        if(typeof SB_RATE_TYPES !== 'undefined') SB_RATE_TYPES = SB_RATE_TYPES.filter(function(x){ return x.id !== id; });
        if(typeof rtModalClose === 'function') rtModalClose();
        try{ _rtSelected = null; }catch(_){ }
        try{ if(typeof rtRenderCards === 'function') rtRenderCards(); if(typeof rtRenderDetail === 'function') rtRenderDetail(null); }catch(_){ }
        O.wrote('rate-type-delete');
      }).catch(function(error){ O.fail('Could not delete rate type', error); });
    };
  }
  if(typeof originals.rtSaveDraft === 'function'){
    window.rtSaveDraft = function(){
      if(!O.enabled()) return originals.rtSaveDraft.apply(this, arguments);
      if(!canWrite()){ failNotReady(); return; }
      var draft = (typeof _rtDraft !== 'undefined' && _rtDraft) ? clone(_rtDraft) : null;
      if(!draft) return;
      if(!draft.name || !String(draft.name).trim()){ alert('Please enter a Name'); return; }
      if(draft.validFrom && draft.validTo && draft.validFrom > draft.validTo){ alert('Valid from must be earlier than Valid to'); return; }
      var unsupported = unsupportedAddOns(draft);
      if(unsupported.length){ O.fail('Cannot save rate type', new Error('Custom add-on pricing is not supported by operation-backend yet: ' + unsupported.join(', '))); return; }
      draft.routes = Array.isArray(draft.routes) ? draft.routes.slice() : [];
      Object.keys(draft.seatRates || {}).forEach(function(id){ if(!draft.routes.includes(id)) delete draft.seatRates[id]; });
      Object.keys(draft.charterRates || {}).forEach(function(id){ if(!draft.routes.includes(id)) delete draft.charterRates[id]; });
      var isNew = !!(typeof _rtDraftIsNew !== 'undefined' && _rtDraftIsNew), id = draft.id;
      return O.queue(function(){
        if(isNew){
          return O.post('/v1/rate-types', toCreateBody(draft));
        }
        if(!id) throw new Error('Rate type id is missing');
        return O.get('/v1/rate-types/' + encodeURIComponent(id)).then(function(current){
          var currentIds = (current.routes || []).map(function(r){ return r.route_id; });
          return O.patch('/v1/rate-types/' + encodeURIComponent(id), toPatch(draft)).then(function(){
            return draft.routes.reduce(function(p, routeId){ return p.then(function(){ return O.call('PUT', '/v1/rate-types/' + encodeURIComponent(id) + '/routes/' + encodeURIComponent(routeId), blockFor(draft, routeId)); }); }, Promise.resolve()).then(function(){
              return currentIds.filter(function(routeId){ return !draft.routes.includes(routeId); }).reduce(function(p, routeId){ return p.then(function(){ return O.del('/v1/rate-types/' + encodeURIComponent(id) + '/routes/' + encodeURIComponent(routeId)); }); }, Promise.resolve());
            });
          });
        }).then(function(){ return O.get('/v1/rate-types/' + encodeURIComponent(id)); });
      }).then(function(server){
        var mapped = replaceRate(server);
        /* Feed the already-successful server result through the legacy renderer
           only now. rtPersist is wrapped above and cannot write the blob. */
        _rtDraft = mapped;
        _rtDraftIsNew = false;
        originals.rtSaveDraft.call(this);
        O.wrote('rate-type-save');
      }.bind(this)).catch(function(error){
        O.fail('Could not save rate type', error);
        if(id){ refreshOne(id).catch(function(refreshError){ O.fail('Could not refresh rate type', refreshError); }); }
      });
    };
  }

  /* rtToggleActive (the Active switch on a rate card): legacy flipped rt.active and called rtPersist, a no-op here,
     so the rate stayed active on the server. Now PATCH /v1/rate-types/{id} {active}; the card is redrawn from the
     server's row. Server first: nothing changes on screen if the server refuses. */
  if(typeof window.rtToggleActive === 'function'){
    var legacyToggle = window.rtToggleActive;
    window.rtToggleActive = function(rtId, ev){
      if(!O.enabled()) return legacyToggle.apply(this, arguments);
      if(ev && ev.stopPropagation) ev.stopPropagation();
      if(!canWrite()){ failNotReady(); return; }
      var rt = (typeof getRateType === 'function') ? getRateType(rtId) : null;
      if(!rt) return;
      var next = !(rt.active !== false);
      return O.queue(function(){
        return O.patch('/v1/rate-types/' + encodeURIComponent(rtId), { active:next }).then(function(){ return refreshOne(rtId); });
      }).then(function(){
        try{ if(typeof rtRenderCards === 'function') rtRenderCards(); }catch(_){ }
        try{ if(typeof _rtSelected !== 'undefined' && _rtSelected === rtId && typeof rtRenderDetail === 'function') rtRenderDetail(rtId); }catch(_){ }
        O.wrote('rate-type-save');
      }).catch(function(error){ O.fail('Could not ' + (next ? 'activate' : 'deactivate') + ' rate type', error); });
    };
  }

  /* _rtBackfillOwners: legacy's one-time seed of rate-type owners from a map of production ids, set in memory only (rtPersist is a
     no-op here). The server stores each rate type's owner and checks it itself, and fromServer sets owner ('' = shared), so a local
     guess would only make the screen disagree with the server. Does nothing in ops mode. */
  if(typeof window._rtBackfillOwners === 'function'){
    var legacyBackfill = window._rtBackfillOwners;
    window._rtBackfillOwners = function(){
      if(!O.enabled()) return legacyBackfill.apply(this, arguments);
    };
  }

  /* Load before the ops boot redraws the active view. */
  if(O.enabled()) load();
})();
