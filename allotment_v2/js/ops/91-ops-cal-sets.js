/* ══════════════════════════════════════════════════════════════════════════
   §opsCalSets (w6-a, 2026-10-18) · Calendar "Save route set" dialog ⇄ PUT /v1/config/cal_route_sets
   ──────────────────────────────────────────────────────────────────────────
   Legacy's dialog (calSetSaveCommit, 04-data-core.js) closed itself and saved afterwards, so a refusal could only come as a toast
   after the dialog was gone. The server now judges the list: a name that is already in it (case-insensitive) is 409 with
   "A set with this name already exists (…). Saving will replace it.", a name over its limit is 400. Here the save goes first and
   the dialog closes only when the server accepted: a refusal is written in the dialog's hint line, as the server worded it, and the
   saved list on screen stays the server's. The "replace" flow is unchanged (the browser sends the list with the old set changed).
   Nothing is computed here: the name is cut at the box's 40 characters as before, ids and routes are the user's choices.
   Classic script, after 61-ops-config-store.js.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O || !O.configStore) return;
  var CS = O.configStore, orig = window.calSetSaveCommit;
  if(typeof orig !== 'function' || orig.__w6a) return;
  var w = function(){
    var inp = document.getElementById('calset-name'), hint = document.getElementById('calset-hint'), ok = document.getElementById('calset-ok');
    var ids = window._calSetPending, name = inp ? String(inp.value || '').trim().slice(0, 40) : '';
    if(!CS.active() || !inp || !Array.isArray(ids) || !ids.length || !name || typeof CAL_ROUTE_SETS === 'undefined' || !CS.loaded())
      return orig.apply(this, arguments);                       // offline, or legacy's own "enter a name" flow
    var list = O.clone(CAL_ROUTE_SETS), key = name.toLowerCase();
    var st = list.filter(function(x){ return String(x.name || '').trim().toLowerCase() === key; })[0];
    if(st){ st.routes = ids.slice(); st.name = name; }
    else { st = { id: 'cs' + Date.now().toString(36), name: name, routes: ids.slice() }; list.push(st); }
    if(ok) ok.disabled = true;
    return CS.save('cal_route_sets', list).then(function(err){
      var saved = CS.ents.cal_route_sets && CS.ents.cal_route_sets.value;     // the server's list (the last saved one when it refused), in the array the screens hold
      if(Array.isArray(saved)){ CAL_ROUTE_SETS.length = 0; Array.prototype.push.apply(CAL_ROUTE_SETS, O.clone(saved)); }
      if(err){
        if(ok) ok.disabled = false;
        inp.style.borderColor = '#B3261E';
        if(hint){ hint.style.color = '#B3261E'; hint.textContent = err.message || String(err); }
        return;
      }
      var now = CAL_ROUTE_SETS.filter(function(x){ return String(x.name || '').trim().toLowerCase() === key; })[0] || st;
      window.calSetModalClose();
      window.calSetApply(now.id);
    });
  };
  w.__w6a = true; w.__orig = orig; window.calSetSaveCommit = w;
})();
