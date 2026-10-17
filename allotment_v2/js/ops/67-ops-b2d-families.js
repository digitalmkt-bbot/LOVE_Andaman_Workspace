/* ═════════════════════════════════════════════════════════════════
   §opsB2dFamilies (Q13, 2026-10-17) · B2B Sales Dashboard groups ⇄ GET /v1/route-families

   The B2B Sales Dashboard (08-app.js, b2dLines) groups sales into five fixed groups (B2D_FAM_ORDER: Phi Phi,
   Similan, Surin, Krabi, Other). Legacy keyed each route id to a group by hand (B2D_FAM). The server keeps ten
   route families and every route names its own (route.familyId, mapped in 10-ops-catalogue.js). In ops mode each
   route's group now comes from its family through the table below; a route with no family, or a family that is
   not in the table, falls to 'Other'.

   ADDING A ROUTE FAMILY LATER = ONE LINE in B2D_GROUP_OF_FAMILY (key = the server's family id, value = one of the
   five group names). The five groups themselves are fixed by the screen's layout (B2D_FAM_ORDER).
   Load order: after 10-ops-catalogue.js and 08-app.js. Classic script.
   ═════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var B2D_GROUP_OF_FAMILY = {
    similan:    'Similan',      // Similan Islands
    surin:      'Surin',        // Surin Islands
    phiphi:     'Phi Phi',      // Phi Phi Bamboo
    whaleshark: 'Phi Phi',      // Whale Shark Phi Phi Maiton (legacy r12 was Phi Phi)
    krabi:      'Krabi',        // Krabi + Phang Nga
    selava:     'Other',        // Day Trip - Se La Va
    nyaung:     'Other',        // Day Trip - Nyaung Oo Phee Island
    transfer:   'Other',
    citytour:   'Other',
    activity:   'Other'
  };
  var orig = window.b2dLines;
  if(typeof orig !== 'function' || orig.__opsFam) return;
  var w = function(){
    if(O.enabled() && typeof ROUTES !== 'undefined' && typeof B2D_FAM !== 'undefined'){
      ROUTES.forEach(function(r){
        if(r && r.id) B2D_FAM[r.id] = B2D_GROUP_OF_FAMILY[r.familyId] || 'Other';
      });
    }
    return orig.apply(this, arguments);
  };
  w.__opsFam = true; window.b2dLines = w;
  window.laOpsB2dGroupOfFamily = B2D_GROUP_OF_FAMILY;
})();
