/* ════════════════════════════════════════════════════════════════════════
   §opsPierLists (2026-10-13) · the pier office lists on operation-backend
   ────────────────────────────────────────────────────────────────────────
   GET    /v1/pier-office                       → every list, filled into the legacy globals
   POST   /v1/pier-office/{list}                → a new row (the server gives it its id)
   PATCH  /v1/pier-office/{list}/{id}           → the client facts that changed
   DELETE /v1/pier-office/{list}/{id}           → kinds, roster codes, groups
   POST   /v1/pier-office/{list}/order          → the order shown (kinds, codes, groups, staff)

     legacy global    list              server row
     PIER_KINDS       item-kinds        {id,name,name_en,unit,color,sort,active}
     PIER_ITEMS       items             {id,pier,kind_id,label,total,active,note}
     PIER_CODES       attendance-codes  {id,code,label,color,bg,kind,sort,active}
     PIER_SECT        sections          {id,pier,name,sort}
     PIER_STAFF       staff             {id,pier,nick,name,role,phone,active,default_code,section_id,note,sort}

   The screens keep calling poPersist() after they change a global; 42-ops-pier-core.js sends what
   changed, and puts everything back if the server says no (409 code_taken, code_in_use,
   kind_in_use, section_in_use, 400 …). A code's background (bg) is the server's: it follows color.
   Licence types and classes are in 44-ops-pier-licence.js.
   Classic script · loads after 42-ops-pier-core.js.
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O || !O.pier) return;
  var P = O.pier, text = P.text, nul = P.nul;

  // Each create-time rename of an id must reach the rows that point at it.
  function itemsKind(old, nw){ (window.PIER_ITEMS || []).forEach(function(i){ if(i.kind === old) i.kind = nw; }); }
  function staffSect(old, nw){ (window.PIER_STAFF || []).forEach(function(s){ if(s.sect === old) s.sect = nw; }); }

  P.listSpec({
    name: 'kinds', order: 10, list: 'item-kinds', key: 'item_kinds', global: 'PIER_KINDS', remove: 'delete',
    canCreate: function(){ return true; },
    refs: [itemsKind],
    after: function(){ if(typeof window.poKindSync === 'function') window.poKindSync(); },
    fromServer: function(k){ return { id: k.id, name: k.name || '', name_en: k.name_en || '', unit: k.unit || '', color: k.color, ord: k.sort, active: k.active !== false }; },
    toServer: function(r){ return { name: text(r.name), name_en: nul(r.name_en), unit: text(r.unit), color: r.color || '#5F6C7B', active: r.active !== false }; },
    orderBy: function(){ return 'all'; }
  });

  P.listSpec({
    name: 'sections', order: 20, list: 'sections', key: 'sections', global: 'PIER_SECT', remove: 'delete',
    canCreate: function(){ return true; },
    refs: [staffSect],
    fromServer: function(s){ return { id: s.id, pier: s.pier, name: s.name || '', ord: s.sort }; },
    toServer: function(r){ return { pier: r.pier, name: text(r.name) }; },
    orderBy: function(r){ return r.pier; }, orderPier: true
  });
  P.listSpec({
    name: 'codes', order: 30, list: 'attendance-codes', key: 'attendance_codes', global: 'PIER_CODES', remove: 'delete',
    canCreate: function(){ return true; },
    fromServer: function(c){ return { id: c.id, code: c.code, label: c.label || '', color: c.color, bg: c.bg, kind: c.kind, ord: c.sort, active: c.active !== false }; },
    toServer: function(r){ return { code: text(r.code), label: nul(r.label), color: r.color, kind: r.kind || 'none', active: r.active !== false }; },
    orderBy: function(){ return 'all'; }
  });

  P.listSpec({
    name: 'items', order: 40, list: 'items', key: 'items', global: 'PIER_ITEMS', remove: 'none',
    canCreate: function(){ return true; },
    fromServer: function(i){ return { id: i.id, pier: i.pier, kind: i.kind_id, label: i.label, total: i.total, active: i.active !== false, note: i.note || '' }; },
    toServer: function(r){ return { pier: r.pier, kind_id: r.kind, label: text(r.label), total: Math.max(0, Math.round(+r.total || 0)), active: r.active !== false, note: nul(r.note) }; }
  });

  P.listSpec({
    name: 'staff', order: 50, list: 'staff', key: 'staff', global: 'PIER_STAFF', remove: 'none',
    canCreate: function(){ return true; },
    fromServer: function(s){
      return { id: s.id, pier: s.pier, nick: s.nick || '', name: s.name || '', role: s.role || '', phone: s.phone || '', active: s.active !== false,
               defCode: s.default_code || '', sect: s.section_id || '', note: s.note || '', ord: s.sort };
    },
    toServer: function(r){
      return { pier: r.pier, nick: nul(r.nick) || nul(r.name) || '', name: nul(r.name) || nul(r.nick) || '', role: nul(r.role), phone: nul(r.phone), active: r.active !== false,
               default_code: nul(r.defCode), section_id: nul(r.sect), note: nul(r.note) };
    },
    orderBy: function(r){ return r.pier; }, orderPier: true
  });

})();
