/* ══════════════════════════════════════════════════════════════════════════
   §opsCatalogue (2026-10-05) · routes · route calendar · boats · markets ·
   sales · agents  ←  operation-backend
   ──────────────────────────────────────────────────────────────────────────
   GET /v1/routes?from=&to=   → ROUTES (merged by id) + OPS_ROUTE_DAYS calendar
   GET /v1/boats              → BOATS  (capacity→cap, license_pax→licensePax)
   GET /v1/markets            → SB_MARKETS
   GET /v1/sales              → SB_SALES (full_name→fullName)
   GET /v1/agents?active=all  → SB_AGENTS (summary fields)
   GET /v1/agents/{id}        → on opening an agent: company/signatory/channel/programs
   GET /v1/agents/{id}/activity → that agent's Activity tab

   Merge, don't replace: the server returns fewer fields than the screens use
   (route colours/kind/dailyCap, boat registry and status log, agent rate
   seasons…). A record the server has keeps the local extras for the same id;
   a local record the server doesn't have is dropped, because the server is
   the system of record and ids elsewhere (bookings, deployments) refer to it.

   Agents are read-only on the server (user's call, 2026-10-05): the entry
   points that create/edit/delete/import agents say so instead of making a
   change that would vanish on reload.

   Route calendar: getDayStatus() answers from the server's resolved
   calendar for the dates it covers. Season/override edits in Config are
   still local only · operation-backend has no route write endpoint yet.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  var CAL_BACK = 30, CAL_AHEAD = 365;           // server caps a calendar sweep at 400 days
  window.OPS_ROUTE_DAYS = {};                   // routeId → { date: {open, source} }

  function put(target, key, v){ if(v !== undefined && v !== null) target[key] = v; }

  /* replace an array's records with the server's, keeping local extras for matching ids ·
     only for CONFIG seeds (DEFAULT_ROUTES/DEFAULT_BOATS are real: colours, times, registry) */
  function mergeInto(arr, serverRows, map){
    if(!Array.isArray(arr)) return;
    var byId = {}; arr.forEach(function(x){ if(x && x.id != null) byId[x.id] = x; });
    var next = serverRows.map(function(s){ return Object.assign({}, byId[s.id] || {}, map(s, byId[s.id] || null)); });
    arr.length = 0; Array.prototype.push.apply(arr, next);
  }
  /* business data (agents/markets/sales): the local seed is DEMO data · never blend it into a real
     record · start from empty defaults so screens that expect the containers still work */
  function replaceWith(arr, serverRows, map, defaults){
    if(!Array.isArray(arr)) return;
    var next = serverRows.map(function(s){ return Object.assign(defaults ? defaults() : {}, map(s, null)); });
    arr.length = 0; Array.prototype.push.apply(arr, next);
  }
  function agentDefaults(){
    return { activity: [], programs: [], programPeriods: [], companyInfo: {}, agentSignatory: {}, bookingChannel: {},
             contractHistory: [], addonServices: [], rateSeasons: [], creditBalance: 0 };
  }

  function mapRoute(s, local){
    var o = { id: s.id, name: s.name };
    put(o, 'pier', s.pier); put(o, 'familyId', s.family_id); put(o, 'color', s.color);
    put(o, 'islands', s.islands); put(o, 'sort', s.sort);
    if(Array.isArray(s.times)) o.times = s.times.slice();
    if(!local){ o.seasons = []; o.overrides = {}; if(!o.times) o.times = []; if(!o.color) o.color = '#1683C7'; }
    return o;
  }
  function mapBoat(s, local){
    var o = { id: s.id, name: s.name, cap: s.capacity };
    put(o, 'type', s.type); put(o, 'pier', s.pier); put(o, 'crew', s.crew);
    // null = no licence on file · keep it absent rather than 0 (a missing licence is not zero seats)
    if(s.license_pax != null) o.licensePax = s.license_pax; else if(local) delete local.licensePax;
    o.charterCeiling = s.charter_ceiling;
    if(!local){ o.log = [{ s: 'available', from: O.today(), to: null }]; o.docs = []; }
    return o;
  }
  function mapMarket(s){ var o = { id: s.id, name: s.name, subs: (s.subs || []).slice() }; put(o, 'color', s.color); put(o, 'sort', s.sort); return o; }
  function mapSales(s){
    var o = { id: s.id, name: s.name, active: s.active !== false };
    put(o, 'code', s.code); put(o, 'fullName', s.full_name); put(o, 'designation', s.designation);
    put(o, 'email', s.email); put(o, 'tel', s.tel); put(o, 'color', s.color);
    return o;
  }
  // legacy's edit form wrote 'bank'; the import maps it to 'bt' · the screens still say bank
  function payTypeIn(v){ return v === 'bt' ? 'bank' : v; }
  function mapAgentSummary(s){
    var o = { id: s.id, name: s.name, active: s.active !== false, house: !!s.house,
              vatMode: s.vat_mode || 'none', incomplete: (s.incomplete || []).slice() };
    put(o, 'code', s.code); put(o, 'market', s.market_id); put(o, 'sub', s.sub_market); put(o, 'sales', s.sales_id);
    put(o, 'color', s.color); put(o, 'payType', payTypeIn(s.pay_type)); put(o, 'creditLimit', s.credit_limit);
    put(o, 'rateTypeId', s.rate_type_id); put(o, 'contractStatus', s.contract_status); put(o, 'contractEnd', s.contract_end);
    if(Array.isArray(s.program_route_ids)) o.programs = s.program_route_ids.slice();
    return o;
  }
  function mapAgentDetail(s, local){
    var o = mapAgentSummary(s);
    put(o, 'creditDays', s.credit_days); put(o, 'contact', s.contact); put(o, 'email', s.email); put(o, 'phone', s.phone);
    put(o, 'note', s.note); put(o, 'contractTemplateId', s.contract_template_id); put(o, 'contractVersion', s.contract_version);
    put(o, 'contractStart', s.contract_start);
    var c = s.company || {}, sg = s.signatory || {}, bc = s.booking_channel || {};
    o.companyInfo = Object.assign({}, (local && local.companyInfo) || {}, { legalName: c.legal_name || '', taxId: c.tax_id || '', tatLicense: c.tat_license || '',
      address: c.address || '', tel: c.tel || '', hotline: c.hotline || '', fax: c.fax || '', website: c.website || '' });
    o.agentSignatory = Object.assign({}, (local && local.agentSignatory) || {}, { name: sg.name || '', designation: sg.designation || '', tel: sg.tel || '', signedDate: sg.signed_date || '' });
    o.bookingChannel = Object.assign({}, (local && local.bookingChannel) || {}, { method: bc.method || '', cutoff: bc.cutoff || '', cancelPolicy: bc.cancel_policy || '', email: bc.email || '', phone: bc.phone || '' });
    if(Array.isArray(s.programs)){
      var prev = (local && local.programPeriods) || [];
      // travel dates come from the rate type, which the server doesn't serve yet · keep the local ones
      o.programPeriods = s.programs.map(function(p){
        var old = prev.find(function(x){ return x && x.routeId === p.route_id; }) || {};
        return Object.assign({}, old, { routeId: p.route_id, bookFrom: p.book_from || '', bookTo: p.book_to || '', note: p.note || '' });
      });
      o.programs = s.programs.map(function(p){ return p.route_id; });
    }
    return o;
  }

  /* ── getDayStatus · server calendar first ── */
  function wrapDayStatus(){
    if(typeof window.getDayStatus !== 'function' || window.getDayStatus.__ops) return;
    var orig = window.getDayStatus;
    var w = function(r, dateStr){
      try{
        var days = r && window.OPS_ROUTE_DAYS[r.id];
        var d = days && days[dateStr];
        if(d) return { type: d.open ? 'open' : 'closed', source: d.source === 'no-seasons' ? 'season' : d.source };
      }catch(_){}
      return orig.apply(this, arguments);
    };
    w.__ops = true; window.getDayStatus = w;
  }

  /* ── agents are read-only on the server ── */
  var RO_AGENT_FNS = ['agNew', 'agCreateSubmit', 'agEditOpen', 'agEditSave', 'agDelete', 'agImportPick', 'agImportApply'];
  function lockAgentEdits(){
    RO_AGENT_FNS.forEach(function(name){
      var orig = window[name];
      if(typeof orig !== 'function' || orig.__ops) return;
      var w = function(){
        if(!O.enabled()) return orig.apply(this, arguments);
        O.toast({ kind: 'neutral', title: 'Agents are read-only', status: 'OPERATION-BACKEND',
          sub: 'Agent create/edit is not on operation-backend yet · changes here would vanish on reload', dur: 6000 });
      };
      w.__ops = true; window[name] = w;
    });
  }

  /* ── agent detail · fetch the full record + activity when one is opened ── */
  var agentFetched = {};
  function wrapAgentDetail(){
    if(typeof window.agRenderDetail !== 'function' || window.agRenderDetail.__ops) return;
    var orig = window.agRenderDetail;
    var w = function(aId){
      var ret = orig.apply(this, arguments);
      if(O.enabled() && aId && (!agentFetched[aId] || Date.now() - agentFetched[aId] > 60000)){
        agentFetched[aId] = Date.now();
        Promise.all([ O.get('/v1/agents/' + encodeURIComponent(aId)), O.get('/v1/agents/' + encodeURIComponent(aId) + '/activity', { limit: 200 }) ])
          .then(function(res){
            var list = (typeof SB_AGENTS !== 'undefined') ? SB_AGENTS : null; if(!list) return;
            var a = list.find(function(x){ return x && x.id === aId; }); if(!a) return;
            Object.assign(a, mapAgentDetail(res[0], a));
            a.activity = ((res[1] && res[1].activity) || []).slice().reverse();   // server: newest first · client keeps oldest first
            var sel = null; try{ sel = _agSelected; }catch(_){}
            if(sel === aId && !O.busy()) orig.call(this, aId);
          }.bind(this))
          .catch(function(e){ agentFetched[aId] = 0; O.fail('Could not load agent ' + aId, e); });
      }
      return ret;
    };
    w.__ops = true; window.agRenderDetail = w;
  }

  function load(){
    var from = O.shift(O.today(), -CAL_BACK), to = O.shift(O.today(), CAL_AHEAD);
    return Promise.all([
      O.get('/v1/routes', { from: from, to: to }),
      O.get('/v1/boats'),
      O.get('/v1/markets'),
      O.get('/v1/sales'),
      O.get('/v1/agents', { active: 'all' })
    ]).then(function(r){
      var routes = (r[0] && r[0].routes) || [];
      window.OPS_ROUTE_DAYS = {};
      routes.forEach(function(x){ if(x.days) window.OPS_ROUTE_DAYS[x.id] = x.days; });
      if(routes.length && typeof ROUTES !== 'undefined') mergeInto(ROUTES, routes, mapRoute);
      var boats = (r[1] && r[1].boats) || [];
      if(boats.length && typeof BOATS !== 'undefined') mergeInto(BOATS, boats, mapBoat);
      if(typeof SB_MARKETS !== 'undefined') replaceWith(SB_MARKETS, (r[2] && r[2].markets) || [], mapMarket);
      if(typeof SB_SALES !== 'undefined') replaceWith(SB_SALES, (r[3] && r[3].sales) || [], mapSales);
      if(typeof SB_AGENTS !== 'undefined') replaceWith(SB_AGENTS, (r[4] && r[4].agents) || [], mapAgentSummary, agentDefaults);
      try{ console.log('[ops] catalogue · ' + routes.length + ' routes · ' + boats.length + ' boats · ' + ((r[4] && r[4].agents) || []).length + ' agents'); }catch(_){}
    });
  }

  wrapDayStatus();
  lockAgentEdits();
  wrapAgentDetail();
  O.catalogue = { load: load, mapAgentDetail: mapAgentDetail };
})();
