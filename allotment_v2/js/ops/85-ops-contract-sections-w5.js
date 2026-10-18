/* ══════════════════════════════════════════════════════════════════════════
   §opsContractSectionsW5 (w5-f, 2026-10-18) · the twelve sections of a contract document come from the server
   ──────────────────────────────────────────────────────────────────────────
   GET /v1/contract-templates/sections → { sections: [{ id, name, required, default_on, num }] } (legacy CT_DOC_SECTIONS).
   CT_DOC_SECTIONS is a top-level const of 08-app.js (the wizard, the preview and the template editor read it by name), so its list is
   replaced in place with the server's: same objects shape { id, name, required, defaultOn, num }. Whether a section is always on
   (required) is the server's too: a template read carries sections_effective (18-ops-contracts.js puts it in the template's sections).
   Until the answer arrives (or if it fails) the constant of the file stays. Classic script · after 18-ops-contracts.js.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O || !O.enabled || !O.enabled()) return;
  if(typeof CT_DOC_SECTIONS === 'undefined' || !Array.isArray(CT_DOC_SECTIONS)) return;
  O.get('/v1/contract-templates/sections').then(function(j){
    var list = (j && j.sections) || [];
    if(!list.length) return;
    var rows = list.map(function(s){ return { id: s.id, name: s.name, required: !!s.required, defaultOn: !!s.default_on, num: s.num || '' }; });
    CT_DOC_SECTIONS.splice.apply(CT_DOC_SECTIONS, [0, CT_DOC_SECTIONS.length].concat(rows));
    O.contractSections = { loaded: true, count: rows.length };
  }, function(e){ try{ console.warn('[ops] contract sections not read · ' + (e && e.message)); }catch(_){} });
})();
