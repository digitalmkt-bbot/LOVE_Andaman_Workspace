/* ════════════════════════════════════════════════════════════════════════
   §opsAddonTypes (2026-10-12) · custom add-on types on operation-backend
   ────────────────────────────────────────────────────────────────────────
   Legacy's "Manage add-on types" (rtAddonTypesOpen, the Rate Types page). Names and
   models only; prices stay on the rate types.
   GET    /v1/addon-types            → SB_ADDON_TYPES (in memory)
   POST   /v1/addon-types            → create · the server makes the key
   DELETE /v1/addon-types/{key}      → 409 in_use while a booking carries that add-on
     · server-first: the list changes only after the server says yes
     · no legacy blob write (sbAddonTypesPersist) in ops mode
   Legacy mode: rtAddonTypeCreate / rtAddonTypeDelete delegate exactly when !enabled().
   Classic script · loads after 08-app.js, before 90-ops-boot.js.
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var legacyCreate = window.rtAddonTypeCreate;
  var legacyDelete = window.rtAddonTypeDelete;

  function fromServer(t){
    return { key: t.key, label: { en: t.name, th: t.name_th || t.name }, model: t.model,
      unit: t.unit || (t.model === 'flat' ? 'per trip' : 'per pax'), builtin: false };
  }
  function setList(rows){
    if(typeof SB_ADDON_TYPES === 'undefined') return;
    SB_ADDON_TYPES = rows;
    if(typeof rtRebuildAddonDefs === 'function') rtRebuildAddonDefs();
  }
  function load(){
    return O.get('/v1/addon-types').then(function(j){
      setList(((j && j.addon_types) || []).map(fromServer));
      return j;
    });
  }

  window.rtAddonTypeCreate = function(){
    if(!O.enabled()) return legacyCreate ? legacyCreate.apply(this, arguments) : undefined;
    var en = (document.getElementById('rtat-en').value || '').trim();
    var th = (document.getElementById('rtat-th').value || '').trim();
    var model = document.getElementById('rtat-model').value;
    var unit = (document.getElementById('rtat-unit').value || '').trim() || (model === 'flat' ? 'per trip' : 'per pax');
    if(!en){ alert('Please enter the English name'); return; }
    var body = { name: en, name_th: th || en, model: model, unit: unit };
    return O.queue(function(){ return O.post('/v1/addon-types', body); }).then(function(t){
      var rows = (typeof SB_ADDON_TYPES !== 'undefined' ? SB_ADDON_TYPES : []).slice();
      rows.push(fromServer(t));
      setList(rows);
      O.wrote('addon-types');
      if(typeof rtAddonTypesRenderBody === 'function') rtAddonTypesRenderBody();
      return t;
    }, function(e){
      O.fail('Add-on type not created · nothing changed', e);
      return null;
    });
  };

  window.rtAddonTypeDelete = function(key){
    if(!O.enabled()) return legacyDelete ? legacyDelete.apply(this, arguments) : undefined;
    /* Q29 · legacy kept a deleted type's prices "hidden"; the server refuses the delete while a rate type uses it (409 in_use) */
    if(!confirm('Delete this add-on type? It cannot be deleted while a rate type uses it.')) return null;
    return O.queue(function(){ return O.del('/v1/addon-types/' + encodeURIComponent(key)); }).then(function(){
      setList((typeof SB_ADDON_TYPES !== 'undefined' ? SB_ADDON_TYPES : []).filter(function(c){ return c.key !== key; }));
      O.wrote('addon-types');
      if(typeof rtAddonTypesRenderBody === 'function') rtAddonTypesRenderBody();
      return true;
    }, function(e){
      O.fail('Add-on type not deleted · nothing changed', e);
      return null;
    });
  };

  O.addonTypes = { load: load };
})();
