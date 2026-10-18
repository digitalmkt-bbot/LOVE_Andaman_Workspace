/* ════════════════════════════════════════════════════════════════════════
   §opsRateExpiry (w5-e, 2026-10-18) · rate expiry panel, per-agent expiry line, season suggestion, group season table
   ────────────────────────────────────────────────────────────────────────
   Server: operation-backend README "Rate expiry" (src/domain/rate-expiry.ts). Legacy worked every figure out in the browser
   (08-app.js rtExpScan / rtExpRowFor / rtExpForAgent / rtExpBulkPlan / rtExpBulkApply / rtmSuggest) from the rate types, the
   agents and the main contracts it happened to hold. The server counts once, from the same rows, with Bangkok's today.
   Reads:  GET /v1/rate-types/expiring?within=      rtExpScan, rtExpRowFor, the "exp" count of agHdIssues (so agHdScan, the KPI pop-up)
           GET /v1/agents/{id}/rate-expiry          rtExpForAgent (Pricing Matrix hint, agent alerts "Rate expiring")
           GET /v1/agents/{id}/rate-seasons/suggestion   rtmSuggest, rtmFillFromContract
           GET /v1/rate-types/{id}/expiry-plan      rtExpBulkPlan (read fresh each time the dialog opens)
   Writes: POST /v1/rate-types/{id}/expiry-plan/apply {}   rtExpBulkApply (one command; the browser no longer PUTs each agent)
   Never sent: seasons, split dates, counts. The browser sends nothing but the rate type id.
   Legacy answers until the server's first answer lands (and offline); the panels are redrawn when it does.
   Same Thai texts and markup as legacy: only the rows come from the server.
   Classic script · loads after ops/16-ops-agents.js and ops/73-ops-srv-reads.js.
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O || !O.srv) return;
  function on(){ return !!(O.enabled && O.enabled()); }
  function enc(v){ return encodeURIComponent(v); }
  function rtOf(id){ return (typeof getRateType === 'function') ? getRateType(id) : null; }
  function agOf(id){ return (typeof sbGetAgent === 'function') ? sbGetAgent(id) : null; }
  var WINDOW = 60;
  function scanKey(w){ return 'rtexp|' + (w == null ? WINDOW : w); }

  /* ── redraw what shows the expiry rows ── */
  function redrawPanels(){
    try{
      if(O.busy && O.busy()) return;
      if(typeof window.rtExpBanner === 'function') window.rtExpBanner();
      if(typeof window.rtExpRender === 'function'){ window.rtExpRender('rt-expiry'); window.rtExpRender('rta-exp'); }
      if(typeof window.renderAgKPI === 'function') window.renderAgKPI();
      var a = document.activeElement;
      var typing = a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && document.getElementById('view-agents') && document.getElementById('view-agents').contains(a);
      if(!typing && O.activeView() === 'agents' && typeof _agSelected !== 'undefined' && _agSelected && typeof window.agRenderDetail === 'function'
         && document.getElementById('ag-tabbody')) window.agRenderDetail(_agSelected);
    }catch(_){}
  }

  /* ── server row -> legacy row {rt, to, days, agents[], blocked{}, next{}} ── */
  function toRow(r){
    return { rt: rtOf(r.rate_type_id) || { id: r.rate_type_id, name: r.name, validTo: r.valid_to }, to: r.valid_to, days: r.days,
      agents: (r.agents || []).map(function(x){ return agOf(x.id) || { id: x.id, name: x.name }; }),
      blocked: r.blocked || {}, next: r.next || {} };
  }
  function scan(within){ return O.srv.read(scanKey(within), '/v1/rate-types/expiring', { within: within == null ? WINDOW : within }, redrawPanels); }

  var legacyScan = window.rtExpScan;
  if(typeof legacyScan === 'function' && !legacyScan.__w5e){
    var wScan = function(within){
      if(!on()) return legacyScan.apply(this, arguments);
      var j = scan(within);
      if(!j) return legacyScan.apply(this, arguments);
      return (j.rows || []).map(toRow);
    };
    wScan.__w5e = true; wScan.__orig = legacyScan; window.rtExpScan = wScan;
  }
  var legacyRow = window.rtExpRowFor;
  if(typeof legacyRow === 'function' && !legacyRow.__w5e){
    var wRow = function(rt, within){
      if(!on() || !rt) return legacyRow.apply(this, arguments);
      var j = scan(within);
      if(!j) return legacyRow.apply(this, arguments);
      var hit = (j.rows || []).find(function(r){ return r.rate_type_id === rt.id; });
      return hit ? toRow(hit) : null;
    };
    wRow.__w5e = true; wRow.__orig = legacyRow; window.rtExpRowFor = wRow;
  }

  /* ── one agent's line · ask the server (one GET per agent, dropped by any write); the list's scan says "no" for free ── */
  var legacyFor = window.rtExpForAgent;
  if(typeof legacyFor === 'function' && !legacyFor.__w5e){
    var wFor = function(a){
      if(!on() || !a || !a.id || !a.rateTypeId) return legacyFor.apply(this, arguments);
      var sj = O.srv.peek(scanKey(WINDOW));
      if(sj && O.srv.fresh(scanKey(WINDOW))){
        var inScan = (sj.rows || []).some(function(r){ return (r.agents || []).some(function(x){ return x.id === a.id; }); });
        if(!inScan) return null;
      }
      var key = 'rtexp1|' + a.id;
      var j = O.srv.read(key, '/v1/agents/' + enc(a.id) + '/rate-expiry', null, redrawPanels);
      if(!j) return legacyFor.apply(this, arguments);
      var x = j.expiry; if(!x) return null;
      return { rt: rtOf(x.rate_type_id) || { id: x.rate_type_id, name: x.name, validTo: x.valid_to }, to: x.valid_to, days: x.days,
        blocked: x.blocked || [], next: x.next || '' };
    };
    wFor.__w5e = true; window.rtExpForAgent = wFor;
  }

  /* ── the agents-list count "Rate expiring" (agHdIssues.exp), so agHdScan and the KPI pop-up count the server's ── */
  var prevHd = window.agHdIssues;
  if(typeof prevHd === 'function' && !prevHd.__w5e){
    var wHd = function(a){
      var out = prevHd.apply(this, arguments);
      if(!on() || !a || !(a.programs || []).length || out.norate) return out;
      var j = scan(WINDOW); if(!j) return out;
      var set = j.__agents || (j.__agents = (function(){ var m = {}; (j.rows || []).forEach(function(r){ (r.agents || []).forEach(function(x){ m[x.id] = 1; }); }); return m; })());
      if(set[a.id]) out.exp = 1; else delete out.exp;
      return out;
    };
    wHd.__w5e = true; Object.keys(prevHd).forEach(function(k){ wHd[k] = prevHd[k]; }); window.agHdIssues = wHd;
  }

  /* ── season suggestion (rtmSuggest / rtmFillFromContract) ── */
  var sug = Object.create(null);          // agent id -> { at, s }  (s = server suggestion or null)
  function sugToLegacy(s){
    if(!s) return null;
    return { seasons: (s.seasons || []).map(function(x){ return { rt: x.rate_type_id, from: x.from, to: x.to || '' }; }),
      next: rtOf(s.next_rate_type_id) || { id: s.next_rate_type_id }, split: s.split };
  }
  O.onWrite(function(){ sug = Object.create(null); });
  var legacySuggest = window.rtmSuggest;
  if(typeof legacySuggest === 'function' && !legacySuggest.__w5e){
    var wSug = function(a){
      if(!on() || !a || !a.id) return legacySuggest.apply(this, arguments);
      var hit = sug[a.id];
      if(hit) return sugToLegacy(hit.s);
      if(!hit && !sug['~' + a.id]){
        sug['~' + a.id] = 1;
        O.get('/v1/agents/' + enc(a.id) + '/rate-seasons/suggestion').then(function(r){
          sug[a.id] = { at: Date.now(), s: (r && r.suggestion) || null };
          if(window._rtmAgent === a.id && typeof window.rtmRedraw === 'function' && document.getElementById('ag-tabbody')) window.rtmRedraw();
        }, function(){});
      }
      return legacySuggest.apply(this, arguments);
    };
    wSug.__w5e = true; window.rtmSuggest = wSug;
  }
  var legacyFill = window.rtmFillFromContract;
  if(typeof legacyFill === 'function' && !legacyFill.__w5e){
    var wFill = function(){
      var self = this, args = arguments;
      if(!on() || !window._rtmAgent) return legacyFill.apply(self, args);
      var id = window._rtmAgent;
      return O.get('/v1/agents/' + enc(id) + '/rate-seasons/suggestion').then(function(r){
        sug[id] = { at: Date.now(), s: (r && r.suggestion) || null };
        return legacyFill.apply(self, args);       // takes the primed answer through rtmSuggest
      }, function(e){ O.fail('Could not read the season suggestion', e); });
    };
    wFill.__w5e = true; window.rtmFillFromContract = wFill;
  }

  /* ── group season table: the plan is read fresh each time the dialog opens; "apply" is one command ── */
  var plans = Object.create(null);        // rate type id -> server plan
  function planToLegacy(rtId, p){
    var rt = rtOf(rtId); if(!rt || !p) return null;
    var groups = (p.groups || []).map(function(g){
      return { next: g.next_rate_type_id, nextRt: rtOf(g.next_rate_type_id) || { id: g.next_rate_type_id }, split: g.split,
        ags: (g.agent_ids || []).map(function(id){ return agOf(id) || { id: id }; }) };
    });
    var sk = p.skipped || {};
    return { rt: rt, groups: groups, skipHas: sk.has_seasons || 0, skipNo: sk.no_next || 0, skipOff: sk.next_inactive || 0,
      skipPast: sk.split_in_past || 0, total: p.total != null ? p.total : groups.reduce(function(n, g){ return n + g.ags.length; }, 0) };
  }
  var legacyPlan = window.rtExpBulkPlan;
  if(typeof legacyPlan === 'function' && !legacyPlan.__w5e){
    var wPlan = function(rtId){
      if(!on() || !plans[rtId]) return legacyPlan.apply(this, arguments);
      return planToLegacy(rtId, plans[rtId]) || legacyPlan.apply(this, arguments);
    };
    wPlan.__w5e = true; wPlan.__orig = legacyPlan; window.rtExpBulkPlan = wPlan;
  }
  var legacyOpen = window.rtExpBulkOpen;
  if(typeof legacyOpen === 'function' && !legacyOpen.__w5e){
    var wOpen = function(rtId){
      var self = this, args = arguments;
      if(!on()) return legacyOpen.apply(self, args);
      delete plans[rtId];
      return O.get('/v1/rate-types/' + enc(rtId) + '/expiry-plan').then(function(p){ plans[rtId] = p; }, function(){ /* legacy's own plan */ })
        .then(function(){ return legacyOpen.apply(self, args); });
    };
    wOpen.__w5e = true; window.rtExpBulkOpen = wOpen;
  }
  var legacyApply = window.rtExpBulkApply;
  if(typeof legacyApply === 'function' && !legacyApply.__w5e){
    var wApply = function(){
      if(!on()) return legacyApply.apply(this, arguments);
      if(typeof window.laGuardEdit === 'function' && !window.laGuardEdit('sales')) return;
      var rtId = window._rtExpBulkRt, P = window.rtExpBulkPlan(rtId);
      if(!P || !P.total) return;
      return O.queue(function(){ return O.call('POST', '/v1/rate-types/' + enc(rtId) + '/expiry-plan/apply', {}); }).then(function(r){
        var ids = (r && r.agent_ids) || [];
        delete plans[rtId];
        var fetch = window.laOpsAgentFetch;
        return Promise.all(ids.map(function(id){ return fetch ? fetch(id).catch(function(){ return null; }) : null; })).then(function(){
          if(typeof window.acctModalClose === 'function') window.acctModalClose();
          if(O.wrote) O.wrote('agents');
          if(typeof window.rtExpRender === 'function') window.rtExpRender();
          redrawPanels();
          var n = (r && r.applied) || 0;
          if(typeof window.flShowToast === 'function') window.flShowToast('ตั้งตารางฤดูกาลให้ ' + n + ' เอเย่นต์แล้ว');
        });
      }, function(e){ O.fail('Could not set the season tables', e); });
    };
    wApply.__w5e = true; window.rtExpBulkApply = wApply;
  }

  O.rateExpiry = { scanKey: scanKey, plans: plans };
})();
