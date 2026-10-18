/* ════════════════════════════════════════════════════════════════════════
   §opsAgentRules (w5-e, 2026-10-18) · small agent / rate / contract rules the browser still decided
   ────────────────────────────────────────────────────────────────────────
   Server: operation-backend README "Agents", "Rate types" (Scope, priced_routes), "Contracts".
   · agRtRoutes(rt)            "which routes does this rate price"      <- rate type `priced_routes` (a zone with a net adult price above 0)
                               agProgPlan / agProgFill / agProgSyncOnRate / agProgBulkPlan and agEditPPAddMissing all ask it, so one
                               wrapper moves them. Legacy counted every route row of the rate, priced or not.
   · agEditPPAddMissing        adds the routes the rate prices, booking window = the agent's contract window (the server does the same
                               on PUT /v1/agents/{id}/rate-type); legacy added every declared route with a fixed 2025-10-01..2026-09-30 window.
   · rtScopeList(list, keepId) the server already lists only the rates this login may see (GET /v1/rate-types scope); the browser
                               no longer filters again. A bound rate missing from the list is read with GET /v1/rate-types/{id} (keep_id).
   · ctTmplForAgent(a)         <- GET /v1/agents/{id} contract_template_effective_id (bound and active, else the default)
   · _ctSyncMainRate           the server moves the agent's main contracts on PUT rate-type / renew / resync-contract; the browser
                               no longer edits SB_CONTRACTS itself, it reads them again after the agent write.
   · agClearExecute            one DELETE /v1/agents/{id} per ticked agent; the server refuses an agent in use (409 in_use) and its
                               message is shown; nothing is removed from the browser except what the server removed.
   · agGapCounts               "no programmes" and "no rate" counts <- the list rows' server `incomplete` (market, sales, pay_type,
                               rate_type, programs, contact); VAT and documents are not in the server's list and stay local.
   Classic script · loads after ops/16, 17, 18.
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  function on(){ return !!(O.enabled && O.enabled()); }
  function enc(v){ return encodeURIComponent(v); }
  function rateOf(id){ return (typeof getRateType === 'function') ? getRateType(id) : null; }

  /* ── priced routes ── */
  var legacyRoutes = window.agRtRoutes;
  if(typeof legacyRoutes === 'function' && !legacyRoutes.__w5e){
    var wRoutes = function(rt){
      if(on() && rt && Array.isArray(rt.pricedRoutes)) return rt.pricedRoutes.slice();
      return legacyRoutes.apply(this, arguments);
    };
    wRoutes.__w5e = true; window.agRtRoutes = wRoutes;
  }
  var legacyAddMissing = window.agEditPPAddMissing;
  if(typeof legacyAddMissing === 'function' && !legacyAddMissing.__w5e){
    var wAdd = function(){
      if(!on()) return legacyAddMissing.apply(this, arguments);
      if(typeof _agEditDraft === 'undefined' || !_agEditDraft) return;
      if(!_agEditDraft.programPeriods) _agEditDraft.programPeriods = [];
      var a = _agEditAgentId ? sbGetAgent(_agEditAgentId) : null;
      var rt = (a && a.rateTypeId) ? rateOf(a.rateTypeId) : null;
      if(!rt) return;
      var used = _agEditDraft.programPeriods.map(function(p){ return p.routeId; });
      var missing = window.agRtRoutes(rt).filter(function(r){ return used.indexOf(r) < 0; });
      if(!missing.length) return;
      missing.forEach(function(r){
        var rv = (rt.routeValidity && rt.routeValidity[r]) || {};
        _agEditDraft.programPeriods.push({ routeId: r, bookFrom: (a && a.contractStart) || '', bookTo: (a && a.contractEnd) || '',
          travelFrom: rv.from || '', travelTo: rv.to || '', note: '' });
      });
      if(typeof window.agEditRender === 'function') window.agEditRender();
    };
    wAdd.__w5e = true; window.agEditPPAddMissing = wAdd;
  }

  /* ── rate scope: the list is the server's ── */
  var legacyScope = window.rtScopeList, askedKeep = Object.create(null);
  if(typeof legacyScope === 'function' && !legacyScope.__w5e){
    var wScope = function(list, keepId){
      if(!on()) return legacyScope.apply(this, arguments);
      if(keepId && !askedKeep[keepId] && O.rateTypes && O.rateTypes.state && O.rateTypes.state.loaded
         && typeof SB_RATE_TYPES !== 'undefined' && !SB_RATE_TYPES.some(function(r){ return r && r.id === keepId; })){
        askedKeep[keepId] = true;
        O.rateTypes.refresh(keepId).then(function(){
          if(typeof window.agEditRender === 'function' && _agEditDraft) window.agEditRender();
        }, function(){ /* 403/404: the server will not show it either */ });
      }
      return list || [];
    };
    wScope.__w5e = true; window.rtScopeList = wScope;
  }

  /* ── contract template of an agent ── */
  var legacyTmpl = window.ctTmplForAgent;
  if(typeof legacyTmpl === 'function' && !legacyTmpl.__w5e){
    var wTmpl = function(a){
      if(on() && a && a.contractTemplateEffectiveId && typeof window.ctTmplGet === 'function'){
        var t = window.ctTmplGet(a.contractTemplateEffectiveId);
        if(t) return t;
      }
      return legacyTmpl.apply(this, arguments);
    };
    wTmpl.__w5e = true; window.ctTmplForAgent = wTmpl;
  }

  /* ── main contract follows the rate: the server did it; read the contracts again ── */
  var legacySync = window._ctSyncMainRate;
  if(typeof legacySync === 'function' && !legacySync.__w5e){
    var wSync = function(){ if(!on()) return legacySync.apply(this, arguments); return 0; };
    wSync.__w5e = true; window._ctSyncMainRate = wSync;
  }
  var reloadTimer = null;
  O.onWrite(function(kind){
    if(!on() || String(kind || '') !== 'agents') return;
    if(reloadTimer) clearTimeout(reloadTimer);
    reloadTimer = setTimeout(function(){
      reloadTimer = null;
      try{ if(window.laOpsContracts && window.laOpsContracts.load) window.laOpsContracts.load(); }catch(_){}
    }, 350);
  });

  /* ── clear agents: the server decides what may go ── */
  var legacyClear = window.agClearExecute;
  if(typeof legacyClear === 'function' && !legacyClear.__w5e){
    var wClear = function(){
      if(!on()) return legacyClear.apply(this, arguments);
      var sel = (typeof _agClearSel !== 'undefined') ? _agClearSel : null, ids = sel ? Array.from(sel) : [];
      var word = String((typeof _agClearConfirm !== 'undefined') ? _agClearConfirm : '').trim();
      if(!ids.length || !(word === 'ลบ' || word.toUpperCase() === 'DELETE')) return;
      if(!(typeof window.laIsAdmin === 'function' && window.laIsAdmin())){ alert('Only an admin can delete an agent profile.'); return; }
      var gone = [], refused = [], chain = Promise.resolve();
      ids.forEach(function(id){
        chain = chain.then(function(){
          return O.queue(function(){ return O.call('DELETE', '/v1/agents/' + enc(id)); }).then(function(){ gone.push(id); }, function(e){
            var a = (typeof sbGetAgent === 'function') ? sbGetAgent(id) : null;
            refused.push(((a && (a.code || a.name)) || id) + ': ' + ((e && e.message) || 'refused'));
          });
        });
      });
      return chain.then(function(){
        gone.forEach(function(id){ var i = SB_AGENTS.findIndex(function(a){ return a && a.id === id; }); if(i >= 0) SB_AGENTS.splice(i, 1); });
        if(O.wrote) O.wrote('agents');
        if(typeof window.agClearClose === 'function') window.agClearClose();
        if(typeof window.renderAgents === 'function') window.renderAgents();
        var main = document.getElementById('ag-main');
        if(main && gone.length) main.innerHTML = '<div class="sb-empty">' + (typeof laT === 'function' ? laT('เลือก Agent จากเมนูด้านซ้ายเพื่อดูรายละเอียด') : '') + '</div>';
        try{ alert('Cleared ' + gone.length + ' agent(s).' + (refused.length ? '\n\nThe server kept ' + refused.length + ':\n' + refused.join('\n') : '')); }catch(_){}
      });
    };
    wClear.__w5e = true; window.agClearExecute = wClear;
  }

  /* ── gap counts for the list chips ── */
  var legacyGap = window.agGapCounts;
  if(typeof legacyGap === 'function' && !legacyGap.__w5e){
    var wGap = function(){
      var out = legacyGap.apply(this, arguments);
      if(!on()) return out;
      var A = (typeof SB_AGENTS !== 'undefined' && Array.isArray(SB_AGENTS)) ? SB_AGENTS : [];
      if(!A.length || !A.every(function(a){ return a && Array.isArray(a.incomplete); })) return out;
      out.programs = A.filter(function(a){ return a.incomplete.indexOf('programs') >= 0; }).length;
      out.rate = A.filter(function(a){ return a.incomplete.indexOf('rate_type') >= 0; }).length;
      return out;
    };
    wGap.__w5e = true; window.agGapCounts = wGap;
  }
})();
