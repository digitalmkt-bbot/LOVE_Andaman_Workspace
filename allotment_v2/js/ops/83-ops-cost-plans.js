/* ═════════════════════════════════════════════════════════════════
   §opsCostPlans (w5-d, 2026-10-18) · a new cost plan is made by the server

   Legacy built a plan in the browser (ctBlankPlan: 3 engines, 1 boat, 65 seats, 20 pax, 2,500 baht, 45 baht/L), pushed it on the list and the
   whole plan went to the server with the next save (44-ops-costing-pl.js writePlans: POST of every field). The server has the same
   defaults (src/domain/costing.ts blankPlan) and makes the plan itself:

     POST /v1/costing/plans  {}                              a blank plan (name "แผนใหม่" unless one is sent)
     POST /v1/costing/plans  { name }                        ctAddPlan: "เส้นทางที่ N"
     POST /v1/costing/plans  { copy_of: <plan id> }          ctDupPlan: a copy named "<name> (คัดลอก)"
     POST /v1/costing/plans  { name, route_key }             ctFamNewPlan: a plan for a route or a family (the key is freed from other plans)

   The request carries the name, the route key or the plan to copy, and nothing else; the screen adopts the server's plan (its id, its
   defaults, the copy's fields) and opens it, as legacy did. A refusal shows as the server words it. Without ops mode legacy's own code runs.

   Load order: after 44-ops-costing-pl.js. Classic script.
   ═════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O || !O.costingPL) return;
  var C = O.costingPL;
  function enabled(){ return !!(O.enabled && O.enabled()); }
  function ready(){ return enabled() && C.adoptPlan; }
  function guard(){ return !(typeof window.laGuardEdit === 'function' && !window.laGuardEdit('accounting')); }

  function create(body, after){
    return O.queue(function(){ return O.post('/v1/costing/plans', body); }).then(function(res){
      var p = C.adoptPlan(res); if(!p) return null;
      O.wrote('costing');
      if(window._ct){ window._ct.pid = p.id; if(after) after(p); }
      if(typeof window.ctRender === 'function') window.ctRender();
      return p;
    }, function(e){
      O.fail('Cost plan was not created', e);
      return C.loadCosting(true).then(function(){ if(typeof window.ctRender === 'function') window.ctRender(); }, function(){});
    });
  }

  var addPlan = window.ctAddPlan, dupPlan = window.ctDupPlan, famNew = window.ctFamNewPlan;
  if(typeof addPlan === 'function') window.ctAddPlan = function(){
    if(!ready()) return addPlan.apply(this, arguments);
    var n = typeof window.ctPlans === 'function' ? window.ctPlans().length : 0;
    return create({ name: 'เส้นทางที่ ' + (n + 1) });
  };
  if(typeof dupPlan === 'function') window.ctDupPlan = function(){
    if(!ready()) return dupPlan.apply(this, arguments);
    var src = typeof window.ctPlan === 'function' && window._ct ? window.ctPlan(window._ct.pid) : null; if(!src) return;
    return create({ copy_of: C.realPlanId(src.id) });
  };
  if(typeof famNew === 'function') window.ctFamNewPlan = function(fid){
    if(!ready()) return famNew.apply(this, arguments);
    if(!guard()) return;
    var R0 = typeof window.getRoute === 'function' ? window.getRoute(fid) : null;
    var F = typeof window.ctMatchFams === 'function' ? window.ctMatchFams().filter(function(f){ return f.id === fid; })[0] : null;
    return create({ name: R0 ? (R0.name || fid) : (F ? F.name : fid), route_key: fid }, function(){ window._ct.tab = 'ovr'; });
  };
})();
