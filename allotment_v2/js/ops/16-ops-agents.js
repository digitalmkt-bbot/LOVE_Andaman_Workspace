/* ══════════════════════════════════════════════════════════════════════════
   §opsAgents · Agent List ⇄ operation-backend
   ──────────────────────────────────────────────────────────────────────────
   Agents are server-first in operation mode. The legacy functions are kept
   intact for lk-inbox; this adapter is loaded before the catalogue adapter so
   its editable entry points are not replaced by the legacy read-only guard.

   GET    /v1/agents?active=all
   GET    /v1/agents/:id
   GET    /v1/agents/:id/activity
   POST   /v1/agents
   PATCH  /v1/agents/:id
   PUT    /v1/agents/:id/programs
   PUT    /v1/agents/:id/rate-type
   POST   /v1/agents/:id/activate|deactivate|renew
   POST   /v1/agents/:id/resync-contract   (agent page "Sync to bound rate")
   DELETE /v1/agents/:id
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O=window.laOps; if(!O) return;
  var legacyDetail=window.agRenderDetail;
  var legacyEditOpen=window.agEditOpen;
  var legacyNew=window.agNew;
  var legacyImportPick=window.agImportPick;
  var legacyImportApply=window.agImportApply;
  var legacyEditSave=window.agEditSave;
  var legacyCreateSubmit=window.agCreateSubmit;
  var legacyDelete=window.agDelete;
  var legacyTblCommit=window.agTblCommit;
  var legacyTblProgramsOpen=window.agTblProgramsOpen;
  var legacyBulkApply=window.agBulkApply;
  var legacyFillDown=window.agFillDown;
  var legacyTblDeleteSelected=window.agTblDeleteSelected;
  var legacyPersist=window.sbAgentsPersist;
  var legacyPickerApply=window.rtAgentPickerApply;
  var legacyRtmSave=window.rtmSave;
  var legacyExpBulkApply=window.rtExpBulkApply;
  var legacyProgBulkApply=window.agProgBulkApply;
  var legacySyncRate=window.agAlertSyncRate;

  function enabled(){ return O.enabled(); }
  function text(v){ return v==null ? '' : String(v).trim(); }
  function nullable(v){ var s=text(v); return s ? s : null; }
  function numberOrNull(v){ return text(v)==='' ? null : Number(v); }
  function payOut(v){ return v==='bank' ? 'bt' : (nullable(v)); }
  function payIn(v){ return v==='bt' ? 'bank' : v; }
  function enc(v){ return encodeURIComponent(v); }
  function list(){ return (typeof SB_AGENTS!=='undefined' && Array.isArray(SB_AGENTS)) ? SB_AGENTS : []; }
  function current(id){ return list().find(function(a){ return a && a.id===id; }); }
  function clone(v){ return O.clone ? O.clone(v) : (v==null ? v : JSON.parse(JSON.stringify(v))); }
  /* Rate seasons: the server's {rate_type_id, from, to:null|date} <-> legacy's {rt, from, to:''}.  laSeasonsOf() keeps
     only rows with an `rt`, so the server's own spelling was invisible to every season screen. */
  function seasonsIn(list){ return (list||[]).map(function(x){ return {rt:x.rate_type_id||x.rt, from:x.from, to:x.to||''}; }); }
  function seasonsOut(list){ return (list||[]).filter(function(x){ return x && x.rt && x.from; })
    .map(function(x){ return {rate_type_id:x.rt, from:x.from, to:x.to||null}; }); }

  /* The list response is deliberately smaller than the detail response. Keep
     only UI caches that have no server equivalent; all agent facts come from
     the returned server record, including explicit nulls. */
  function mapAgent(s, old){
    s=s||{}; old=old||{};
    var c=s.company||{}, sg=s.signatory||{}, bc=s.booking_channel||{};
    var programs=Array.isArray(s.programs) ? s.programs : [];
    var o=Object.assign({}, old, {
      id:s.id, code:s.code==null ? null : s.code, name:s.name||'', active:s.active!==false, house:!!s.house,
      market:s.market_id==null ? null : s.market_id, sub:s.sub_market==null ? null : s.sub_market,
      sales:s.sales_id==null ? null : s.sales_id, color:s.color==null ? null : s.color,
      payType:payIn(s.pay_type), vatMode:s.vat_mode||'', creditDays:s.credit_days==null ? null : s.credit_days,
      creditLimit:s.credit_limit==null ? null : s.credit_limit, contact:s.contact==null ? null : s.contact,
      email:s.email==null ? null : s.email, phone:s.phone==null ? null : s.phone, note:s.note==null ? null : s.note,
      rateTypeId:s.rate_type_id==null ? null : s.rate_type_id, contractTemplateId:s.contract_template_id==null ? null : s.contract_template_id,
      contractStatus:s.contract_status==null ? null : s.contract_status, contractVersion:s.contract_version==null ? null : s.contract_version,
      contractStart:s.contract_start==null ? null : s.contract_start, contractEnd:s.contract_end==null ? null : s.contract_end,
      companyInfo:{ legalName:c.legal_name||'', taxId:c.tax_id||'', tatLicense:c.tat_license||'', address:c.address||'', tel:c.tel||'', hotline:c.hotline||'', fax:c.fax||'', website:c.website||'' },
      agentSignatory:{ name:sg.name||'', designation:sg.designation||'', tel:sg.tel||'', signedDate:sg.signed_date||'' },
      bookingChannel:{ method:bc.method||'', cutoff:bc.cutoff||'', cancelPolicy:bc.cancel_policy||'', email:bc.email||'', phone:bc.phone||'' },
      programs:programs.map(function(p){ return typeof p==='string' ? p : p.route_id; }),
      programPeriods:programs.map(function(p){ return { routeId:p.route_id, bookFrom:p.book_from||'', bookTo:p.book_to||'', note:p.note||'' }; })
    });
    if('contract_days_left' in s){ o.contractDaysLeft=s.contract_days_left; o.contractExpiring=!!s.contract_expiring; o.contractExpired=!!s.contract_expired; }   // F4: the server's contract clock
    if(Array.isArray(s.rate_seasons)) o.rateSeasons=seasonsIn(s.rate_seasons);
    if('contract_template_effective_id' in s) o.contractTemplateEffectiveId=s.contract_template_effective_id;   // w5-e: ctTmplForAgent
    if(Array.isArray(s.incomplete)) o.incomplete=s.incomplete.slice();   // the server's own gap list (agIncompleteFields below)
    if(Array.isArray(s.alerts)) o.serverAlerts=s.alerts;                 // the server's pricing alerts (agAlerts / agHdIssues below)
    if(Array.isArray(s.gaps)) o.gaps=s.gaps.slice();                     // w6-d: the list chips (programs / rate / vat / docs), 94-ops-agents-w6.js
    if(s.credit_balance && typeof s.credit_balance.available==='number') o.creditBalance=s.credit_balance.available;
    if(s.credit && typeof s.credit.limit==='number') o.serverCredit=Object.assign({ at:Date.now() }, s.credit);   // worked out by the server (agCreditState below)
    return o;
  }

  function putProjection(s, old){
    var mapped=mapAgent(s,old), rows=list(), i=rows.findIndex(function(a){ return a&&a.id===mapped.id; });
    if(i<0) rows.unshift(mapped); else rows[i]=mapped;
    return mapped;
  }
  function removeProjection(id){
    var rows=list(), i=rows.findIndex(function(a){ return a&&a.id===id; });
    if(i>=0) rows.splice(i,1);
  }
  function redraw(id){
    try{ if(typeof agRenderList==='function') agRenderList(); }catch(_){}
    try{ if(typeof renderAgKPI==='function') renderAgKPI(); }catch(_){}
    try{ if(typeof _agView!=='undefined' && _agView==='table' && typeof agRenderTable==='function') agRenderTable(); }catch(_){}
    try{ if(id && typeof _agSelected!=='undefined' && _agSelected===id && typeof legacyDetail==='function') legacyDetail(id); }catch(_){}
  }
  function fail(title,e){ O.fail(title,e); return null; }
  function write(method,path,body){
    return O.queue(function(){ return O.call(method,path,body); });
  }
  function fetchAgent(id){
    return Promise.all([O.get('/v1/agents/'+enc(id)), O.get('/v1/agents/'+enc(id)+'/activity',{limit:200})]).then(function(r){
      var old=current(id), mapped=putProjection(r[0],old);
      mapped.activity=((r[1]&&r[1].activity)||[]).slice().reverse();
      return mapped;
    });
  }
  window.laOpsAgentFetch=fetchAgent;      // w5-e: ops/84 reloads the agents a server command changed
  function applyResponse(id, response){
    var old=current(id), mapped=putProjection(response,old);
    if(response && response.id===id) return mapped;
    return mapped;
  }

  function companyBody(d){ return {
    legal_name:nullable(d.legalName), tax_id:nullable(d.taxId), tat_license:nullable(d.tatLicense), address:nullable(d.address),
    tel:nullable(d.tel), hotline:nullable(d.hotline), fax:nullable(d.fax), website:nullable(d.website)
  }; }
  function signatoryBody(d){ return { name:nullable(d.name), designation:nullable(d.designation), tel:nullable(d.tel), signed_date:nullable(d.signedDate) }; }
  function channelBody(d){ return { method:nullable(d.method), cutoff:nullable(d.cutoff), cancel_policy:nullable(d.cancelPolicy), email:nullable(d.email), phone:nullable(d.phone) }; }
  function programsBody(periods){
    return (periods||[]).map(function(p){ return { route_id:p.routeId||p.route_id, book_from:nullable(p.bookFrom==null?p.book_from:p.bookFrom), book_to:nullable(p.bookTo==null?p.book_to:p.bookTo), note:nullable(p.note) }; });
  }
  function hasValue(o){ return Object.keys(o).some(function(k){ return text(o[k])!==''; }); }
  function createBody(d, anyway){
    var sign=signatoryBody({name:d.sigName,designation:d.sigDesignation,tel:d.sigTel,signedDate:d.sigSignedDate});
    var channel=channelBody({method:d.bookingMethod,cutoff:d.bookingCutoff,cancelPolicy:d.bookingCancelPolicy,email:d.bookingEmail,phone:d.bookingPhone});
    var body={ name:text(d.name), code:nullable(d.code), market_id:nullable(d.market), sub_market:nullable(d.sub), sales_id:nullable(d.sales),
      pay_type:payOut(d.payType), vat_mode:text(d.vatMode)||'none', credit_days:numberOrNull(d.creditDays), credit_limit:numberOrNull(d.creditLimit),
      contact:nullable(d.contact), email:nullable(d.email), phone:nullable(d.phone), note:nullable(d.note), rate_type_id:nullable(d.rateTypeId),
      company:companyBody(d), create_anyway:!!anyway };
    if(hasValue(sign)) body.signatory=sign;
    if(hasValue(channel)) body.booking_channel=channel;
    if(!body.code) delete body.code;
    if(d.color) body.color=d.color;
    if(d.contractTemplateId) body.contract_template_id=d.contractTemplateId;
    return body;
  }
  function patchBody(section,d){
    if(section==='sales') return {sales_id:nullable(d.sales)};
    if(section==='profile') return {pay_type:payOut(d.payType), vat_mode:text(d.vatMode)||'none', credit_days:numberOrNull(d.creditDays), credit_limit:numberOrNull(d.creditLimit)};
    if(section==='company') return {name:text(d.name), market_id:nullable(d.market), sub_market:nullable(d.sub), email:nullable(d.email), color:nullable(d.color), company:companyBody(d)};
    if(section==='signatory') return {signatory:signatoryBody(d)};
    if(section==='booking') return {booking_channel:channelBody(d)};
    if(section==='notes') return {note:nullable(d.note)};
    if(section==='contracttmpl') return {contract_template_id:nullable(d.contractTemplateId)};
    return null;
  }
  function refreshAfter(id,response){
    var a=applyResponse(id,response); redraw(a.id); if(O.wrote) O.wrote('agents'); return a;
  }

  function saveEdit(){
    if(!enabled()) return legacyEditSave.apply(this,arguments);
    if(_agEditSection==='new') return createAgent();
    var id=_agEditAgentId, a=current(id), section=_agEditSection, d=_agEditDraft;
    if(!a || !d) return;
    var method='PATCH', path='/v1/agents/'+enc(id), body=patchBody(section,d);
    if(section==='programs'){ method='PUT'; path+='/programs'; body={programs:programsBody(d.programPeriods)}; }
    if(section==='ratetype'){ method='PUT'; path+='/rate-type'; body={rate_type_id:nullable(d.rateTypeId)}; }
    if(!body) return;
    return write(method,path,body).catch(function(e){
      /* legacy keeps the programmes the new rate does not price (booking them stays blocked until it does); removing them is the
         choice. So Cancel is "keep them", not "abandon the change": the rate type is changed either way. */
      if(section==='ratetype' && e.code==='unpriced_programs'){
        var drop=confirm('This rate has no price for some of the agent\'s existing programs.\n\nOK = remove those programs.\nCancel = keep them (they cannot be booked until the rate prices them).');
        return write('PUT',path,{rate_type_id:nullable(d.rateTypeId),drop_unpriced:drop});
      }
      throw e;
    }).then(function(row){ refreshAfter(id,row); if(typeof agEditClose==='function') agEditClose(); },function(e){ return fail('Could not save agent',e); });
  }

  /* w5-e: legacy's own Thai confirm (agCreateSubmit), filled from the server's 409 message ('An agent with a similar name exists: NAME (CODE). Send create_anyway…') */
  function dupAsk(e){
    var m=/similar name exists: (.*?)(?: \(([^()]*)\))?\. Send create_anyway/.exec((e&&e.message)||'');
    var nm=m?m[1]:'', cd=m&&m[2]?m[2]:'';
    return 'มีเอเยนต์ที่ชื่อ/โค้ดใกล้เคียงกันอยู่แล้ว:\n\n  “'+nm+'”'+(cd?(' ('+cd+')'):'')+'\n\nยืนยันสร้างเป็นเอเยนต์ใหม่แยกอีกตัว?';
  }
  function createAgent(){
    if(!enabled()) return legacyCreateSubmit.apply(this,arguments);
    var d=_agNewDraft; if(!d) return;
    var required=[['name','Agent name'],['legalName','Company legal name'],['address','Company address'],['market','Market'],['rateTypeId','Rate type'],['payType','Payment type'],['vatMode','VAT mode']];
    var missing=required.filter(function(x){ return !text(d[x[0]]); });
    if(missing.length){ if(typeof _agNewReqShow!=='undefined') _agNewReqShow=true; if(typeof agNewRender==='function') agNewRender(); alert('Required fields: '+missing.map(function(x){return x[1];}).join(', ')); return; }
    var body=createBody(d,false);
    function send(payload){ return write('POST','/v1/agents',payload); }
    return send(body).catch(function(e){
      if(e.code==='possible_duplicate' && confirm(dupAsk(e))) return send(createBody(d,true));
      throw e;
    }).then(function(row){
      var a=refreshAfter(row.id,row); if(typeof agEditClose==='function') agEditClose(); redraw(a.id);
    },function(e){ return fail('Could not create agent',e); });
  }

  function deleteAgent(id){
    if(!enabled()) return legacyDelete.apply(this,arguments);
    if(!(typeof window.laIsAdmin==='function' && window.laIsAdmin())){ alert('Only an admin can delete an agent profile.'); return; }
    var a=current(id); if(!a || !confirm('Delete agent "'+a.name+'"?\n\nThe server will refuse this if it is still in use.')) return;
    return write('DELETE','/v1/agents/'+enc(id)).then(function(){ removeProjection(id); redraw(); if(O.wrote) O.wrote('agents'); },function(e){ return fail('Could not delete agent',e); });
  }

  function fieldRequest(a,k,v){
    if(k==='programs') return {method:'PUT',path:'/v1/agents/'+enc(a.id)+'/programs',body:{programs:(v||[]).map(function(x){return typeof x==='string'?x:x.route_id||x.routeId;})}};
    if(k==='rateTypeId') return {method:'PUT',path:'/v1/agents/'+enc(a.id)+'/rate-type',body:{rate_type_id:nullable(v)}};
    var body={};
    if(k==='market') body.market_id=nullable(v); else if(k==='sub') body.sub_market=nullable(v); else if(k==='sales') body.sales_id=nullable(v);
    else if(k==='payType') body.pay_type=payOut(v); else if(k==='vatMode') body.vat_mode=text(v)||'none';
    else if(k==='creditDays') body.credit_days=numberOrNull(v); else if(k==='creditLimit') body.credit_limit=numberOrNull(v);
    else if(k==='contractTemplateId') body.contract_template_id=nullable(v);
    else if(k.indexOf('companyInfo.')===0){ var c={}; c[k.slice(12).replace(/[A-Z]/g,function(x){return '_'+x.toLowerCase();})]=nullable(v); body.company=c; }
    else if(k.indexOf('agentSignatory.')===0){ var s={}; var sk=k.slice(15); sk=sk==='signedDate'?'signed_date':sk; s[sk]=nullable(v); body.signatory=s; }
    else body[k]=nullable(v);
    return {method:'PATCH',path:'/v1/agents/'+enc(a.id),body:body};
  }
  function tableCommit(save){
    if(!enabled()) return legacyTblCommit.apply(this,arguments);
    var cell=_agCell, input=document.querySelector('#ag-tbody .agtbl-in');
    if(!cell){ return; }
    if(!save){ _agCell=null; return; }
    var a=current(cell.id), col=(typeof AG_COLS!=='undefined' ? AG_COLS.find(function(c){return c.k===cell.k;}) : null);
    if(!a || !col || !input){ _agCell=null; return; }
    var v=input.value;
    if(col.type==='num') v=text(v)==='' ? null : Number(String(v).replace(/[^\d.-]/g,'')); else v=text(v);
    var old=typeof agGet==='function' ? agGet(a,col.k) : a[col.k];
    _agCell=null;
    if(JSON.stringify(old)===JSON.stringify(v)){ if(typeof agRenderTable==='function') agRenderTable(); return; }
    var req=fieldRequest(a,col.k,v);
    return write(req.method,req.path,req.body).then(function(row){ refreshAfter(a.id,row); },function(e){ fail('Could not save agent cell',e); try{ if(typeof agRenderTable==='function') agRenderTable(); }catch(_){} });
  }
  function tablePrograms(id){
    if(!enabled()) return legacyTblProgramsOpen.apply(this,arguments);
    var a=current(id); if(!a) return;
    return agProgPicker(a.programs||[],function(sel){
      var req=fieldRequest(a,'programs',sel);
      write(req.method,req.path,req.body).then(function(row){ refreshAfter(a.id,row); },function(e){ fail('Could not save agent programs',e); });
    },'Programs · '+a.name,a.rateTypeId||null);
  }
  function bulkApply(){
    if(!enabled()) return legacyBulkApply.apply(this,arguments);
    if(typeof window.laGuardEdit==='function' && !window.laGuardEdit('sales')) return;
    var ids=[..._agSel]; if(!ids.length) return;
    var g=function(id){return document.getElementById(id);}, sets=[];
    var add=function(id,k,convert){ var e=g(id), x=e&&e.value; if(x) sets.push([k,convert?convert(x):x]); };
    add('agb-rate','rateTypeId'); add('agb-sales','sales'); add('agb-market','market'); add('agb-pay','payType'); add('agb-vat','vatMode');
    var sub=(g('agb-sub')&&g('agb-sub').value||'').trim(); if(sub) sets.push(['sub',sub]);
    var lim=g('agb-limit')&&g('agb-limit').value; if(text(lim)!=='') sets.push(['creditLimit',Number(String(lim).replace(/[^\d.-]/g,''))]);
    var days=g('agb-days')&&g('agb-days').value; if(text(days)!=='') sets.push(['creditDays',Number(String(days).replace(/[^\d.-]/g,''))]);
    if(window.__agBulkPrograms) sets.push(['programs',window.__agBulkPrograms.slice()]);
    if(!sets.length){ alert('No values selected.'); return; }
    if(!confirm('Apply '+sets.length+' field(s) to '+ids.length+' agent(s)?')) return;
    var chain=Promise.resolve(), count=0;
    ids.forEach(function(id){ sets.forEach(function(pair){ chain=chain.then(function(){ var a=current(id); if(!a) return; var req=fieldRequest(a,pair[0],pair[1]); return write(req.method,req.path,req.body).then(function(row){ refreshAfter(id,row); count++; }); }); }); });
    return chain.then(function(){ window.__agBulkPrograms=null; _agSel.clear(); redraw(); },function(e){ return fail('Could not apply agent changes',e); });
  }
  function fillDown(){
    if(!enabled()) return legacyFillDown.apply(this,arguments);
    var src=window.__agFillSrc; if(!src){ alert('Select a source cell first.'); return; }
    var ids=[..._agSel]; if(!ids.length){ alert('Select destination rows first.'); return; }
    var source=current(src.id); if(!source) return;
    var value=typeof agGet==='function' ? agGet(source,src.k) : source[src.k];
    if(!confirm('Copy this value to '+ids.length+' selected agent(s)?')) return;
    var chain=Promise.resolve(); ids.forEach(function(id){ chain=chain.then(function(){ var a=current(id); if(!a) return; var req=fieldRequest(a,src.k,clone(value)); return write(req.method,req.path,req.body).then(function(row){refreshAfter(id,row);}); }); });
    return chain.then(function(){ redraw(); },function(e){return fail('Could not fill agent values',e);});
  }
  /* Rate Types screen · bulk "assign agents to this rate type" picker (rtAgentPickerApply).
     Legacy set a.rateTypeId locally and called rtPersist, a deliberate no-op in ops mode, so the
     assignment vanished on reload. Here: one queued PUT /v1/agents/:id/rate-type per agent whose
     binding really changes (bind = {rate_type_id:id}, unbind = {rate_type_id:null}); local state
     changes only from the row the server answered with. Refusals (rate_type_inactive,
     unpriced_programs, forbidden, ...) are collected into ONE summary; the other agents proceed.
     drop_unpriced is never sent here: removing programmes needs the per-agent confirm in agEditSave. */
  function pickerApply(){
    var rtId=(typeof _rtAgentPickerRtId!=='undefined') ? _rtAgentPickerRtId : null; if(!rtId) return;
    var sel=(typeof _rtAgentPickerSelected!=='undefined') ? _rtAgentPickerSelected : null;
    var changes=[];
    list().forEach(function(a){
      if(!a) return;
      if(typeof laAgentInScope==='function' && !laAgentInScope(a)) return;
      var want=!!(sel && sel.has(a.id)), here=a.rateTypeId===rtId;
      if(want && !here) changes.push({id:a.id,name:a.name||a.code||a.id,to:rtId});
      else if(!want && here) changes.push({id:a.id,name:a.name||a.code||a.id,to:null});
    });
    if(!changes.length){ if(typeof rtAgentPickerClose==='function') rtAgentPickerClose(); return; }
    var bound=0, unbound=0, refused=[], chain=Promise.resolve();
    changes.forEach(function(c){
      chain=chain.then(function(){
        return write('PUT','/v1/agents/'+enc(c.id)+'/rate-type',{rate_type_id:c.to}).then(function(row){
          if(row && row.id===c.id) putProjection(row,current(c.id));
          else { var a=current(c.id); if(a) a.rateTypeId=c.to; }
          if(c.to) bound++; else unbound++;
        },function(e){
          refused.push(c.name+': '+((e&&e.message)||'refused')+(e&&e.code?' ['+e.code+']':''));
        });
      });
    });
    return chain.then(function(){
      var done=bound+unbound;
      if(done){
        if(O.wrote) O.wrote('agents');
        if(typeof rtAgentPickerClose==='function') rtAgentPickerClose();
        if(typeof rtRenderCards==='function') rtRenderCards();
        if(typeof rtRenderDetail==='function') rtRenderDetail(rtId);
        try{ if(typeof _rtViewMode!=='undefined' && _rtViewMode==='agents' && typeof rtRenderAgentColumn==='function') rtRenderAgentColumn(rtId); }catch(_){}
        redraw();
      }
      if(refused.length) fail(done ? 'Rate type assigned to '+done+' agent(s) · '+refused.length+' refused' : 'Rate type assignment refused · nothing changed', new Error(refused.join('\n')));
      console.log('[Rate Type] Bulk assign:', {bound:bound, unbound:unbound, refused:refused.length});
    });
  }
  if(typeof legacyPickerApply==='function'){ var pa=function(){ return enabled()?pickerApply.apply(this,arguments):legacyPickerApply.apply(this,arguments); }; pa.__ops=true; pa.__opsAgents=true; window.rtAgentPickerApply=pa; }

  /* Rate Types screen · the X that unbinds one agent from a rate type (rtUnbindAgent).
     Legacy set a.rateTypeId=null and called rtPersist, a no-op in ops mode, so the agent was bound again on reload.
     Here: same confirm, then PUT /v1/agents/:id/rate-type {rate_type_id:null}; the agent changes only from the row
     the server answered with, and a refusal is shown as the server worded it. */
  var legacyUnbind=window.rtUnbindAgent;
  if(typeof legacyUnbind==='function'){
    window.rtUnbindAgent=function(agentId,rtId,ev){
      if(!enabled()) return legacyUnbind.apply(this,arguments);
      if(ev && ev.stopPropagation) ev.stopPropagation();
      var a=current(agentId); if(!a) return;
      if(!confirm('ปลด '+(a.name||a.code)+' ออกจาก rate type นี้?')) return;
      return write('PUT','/v1/agents/'+enc(agentId)+'/rate-type',{rate_type_id:null}).then(function(row){
        if(row && row.id===agentId) putProjection(row,a); else a.rateTypeId=null;
        if(O.wrote) O.wrote('agents');
        if(typeof rtRenderCards==='function') rtRenderCards();
        if(typeof rtRenderDetail==='function') rtRenderDetail(rtId);
        try{ if(typeof _rtViewMode!=='undefined' && _rtViewMode==='agents' && typeof rtRenderAgentColumn==='function') rtRenderAgentColumn(rtId); }catch(_){}
        try{ if(typeof agRenderDetail==='function' && typeof _agSelected!=='undefined' && _agSelected===agentId) agRenderDetail(agentId); }catch(_){}
        redraw();
      },function(e){ return fail('Could not unbind agent',e); });
    };
  }

  function deleteSelected(){
    if(!enabled()) return legacyTblDeleteSelected.apply(this,arguments);
    if(!(typeof window.laIsAdmin==='function' && window.laIsAdmin())){ alert('Only an admin can delete agent profiles.'); return; }
    var ids=[..._agSel]; if(!ids.length || !confirm('Delete '+ids.length+' selected agent profile(s)?')) return;
    var chain=Promise.resolve(); ids.forEach(function(id){ chain=chain.then(function(){ return write('DELETE','/v1/agents/'+enc(id)).then(function(){removeProjection(id);}); }); });
    return chain.then(function(){_agSel.clear();redraw();},function(e){return fail('Could not delete selected agents',e);});
  }

  function lifecycle(id,action,body){
    if(!enabled()) return Promise.reject(new Error('Operation-backend is not active'));
    var path='/v1/agents/'+enc(id)+'/'+action;
    return write('POST',path,body||{}).then(function(row){ refreshAfter(id,row); return row; },function(e){ fail('Could not '+action+' agent',e); throw e; });
  }
  window.laOpsAgentLifecycle=lifecycle;
  /* §ctplSample · GET /v1/agents/:id -> the legacy agent shape, for screens that need one agent's
     full record without opening the Agent page (Contract Templates preview, 18-ops-contracts.js). */
  window.laOpsAgentMap=function(s){ return mapAgent(s,null); };
  window.agActivate=function(id){ return lifecycle(id,'activate'); };
  window.agDeactivate=function(id){ return lifecycle(id,'deactivate'); };
  window.agRenew=function(id,body){ return lifecycle(id,'renew',body); };

  /* legacy bookingV2AgentColorSet and bookingV2AgentColorEdit's Alt-click reset (booking/*.js): the colour is a
     client fact, sent with PATCH /v1/agents/{id}. The popover closes once the server has saved it. */
  function setColour(id, colour){
    return write('PATCH','/v1/agents/'+enc(id),{color:colour||null}).then(function(r){
      refreshAfter(id,r);
      var p=document.getElementById('bkv2-agcol-pop'); if(p) p.remove();
      if(typeof window.bookingV2Render==='function') window.bookingV2Render();
      return r;
    },function(e){ return fail('Could not save agent colour',e); });
  }
  if(typeof window.bookingV2AgentColorSet==='function'){
    var legacyColourSet=window.bookingV2AgentColorSet;
    var acs=function(agentId,c){ if(!enabled()) return legacyColourSet.apply(this,arguments); if(!current(agentId)) return; return setColour(agentId,c); };
    acs.__opsAgents=true; window.bookingV2AgentColorSet=acs;
  }
  if(typeof window.bookingV2AgentColorEdit==='function'){
    var legacyColourEdit=window.bookingV2AgentColorEdit;
    var ace=function(agentId,ev){
      if(!enabled() || !(ev && ev.altKey)) return legacyColourEdit.apply(this,arguments);
      if(!current(agentId)) return;
      return setColour(agentId,null);
    };
    ace.__opsAgents=true; window.bookingV2AgentColorEdit=ace;
  }

  /* Agent page "Sync to bound rate" (legacy agAlertSyncRate): the server moves the agent's active
     MAIN contracts onto the rate the agent is bound to. Server first: nothing local changes until
     the 2xx. 409 no_rate_type = the agent has no bound rate; the server's message is shown. */
  function syncRate(agentId){
    var a=current(agentId); if(!a) return;
    return write('POST','/v1/agents/'+enc(agentId)+'/resync-contract',{}).then(function(r){
      if(r && r.agent) applyResponse(agentId,r.agent);
      var changed=(r&&+r.changed)||0, unchanged=(r&&+r.unchanged)||0;
      var contracts=(window.laOpsContracts&&typeof window.laOpsContracts.load==='function') ? window.laOpsContracts.load() : Promise.resolve(false);
      /* contracts view + the activity log both changed on the server: re-read them, then redraw once */
      return Promise.all([
        Promise.resolve(contracts).catch(function(){ return false; }),
        fetchAgent(agentId).catch(function(){ return null; })
      ]).then(function(){
        if(O.wrote) O.wrote('agents');
        redraw(agentId);
        alert(changed>0
          ? ('Synced '+changed+' main contract(s) to the bound rate. '+unchanged+' already matched or not eligible.')
          : ('Nothing to sync. '+unchanged+' contract(s) already matched or not eligible.'));
      });
    },function(e){ fail('Could not sync contracts to the bound rate',e); });
  }
  if(typeof legacySyncRate==='function'){ var sr=function(){ return enabled()?syncRate.apply(this,arguments):legacySyncRate.apply(this,arguments); }; sr.__ops=true; sr.__opsAgents=true; window.agAlertSyncRate=sr; }

  /* Detail reads are authoritative too. This is installed before 10-ops-catalogue.js,
     which detects __ops and does not add its former read-only/detail wrapper. */
  if(typeof legacyDetail==='function'){
    var detail=function(id){
      if(!enabled() || id==null || id==='') return legacyDetail.apply(this,arguments);   // no agent picked: nothing to fetch
      return fetchAgent(id).then(function(){ legacyDetail.call(this,id); }.bind(this),function(e){ fail('Could not load agent',e); });
    };
    detail.__ops=true; detail.__opsAgents=true; window.agRenderDetail=detail;
  }
  function passthrough(name,fn){ if(typeof fn!=='function') return; var w=function(){ return fn.apply(this,arguments); }; w.__ops=true; w.__opsAgents=true; window[name]=w; }
  passthrough('agEditOpen',legacyEditOpen);
  passthrough('agNew',legacyNew);
  passthrough('agImportPick',legacyImportPick);

  if(typeof legacyEditSave==='function'){ var es=function(){ return enabled()?saveEdit.apply(this,arguments):legacyEditSave.apply(this,arguments); }; es.__ops=true; es.__opsAgents=true; window.agEditSave=es; }
  if(typeof legacyCreateSubmit==='function'){ var cs=function(){ return enabled()?createAgent.apply(this,arguments):legacyCreateSubmit.apply(this,arguments); }; cs.__ops=true; cs.__opsAgents=true; window.agCreateSubmit=cs; }
  if(typeof legacyDelete==='function'){ var dl=function(){ return enabled()?deleteAgent.apply(this,arguments):legacyDelete.apply(this,arguments); }; dl.__ops=true; dl.__opsAgents=true; window.agDelete=dl; }
  if(typeof legacyTblCommit==='function'){ var tc=function(){ return enabled()?tableCommit.apply(this,arguments):legacyTblCommit.apply(this,arguments); }; tc.__ops=true; tc.__opsAgents=true; window.agTblCommit=tc; }
  if(typeof legacyTblProgramsOpen==='function'){ var tp=function(){ return enabled()?tablePrograms.apply(this,arguments):legacyTblProgramsOpen.apply(this,arguments); }; tp.__ops=true; tp.__opsAgents=true; window.agTblProgramsOpen=tp; }
  if(typeof legacyBulkApply==='function'){ var ba=function(){ return enabled()?bulkApply.apply(this,arguments):legacyBulkApply.apply(this,arguments); }; ba.__ops=true; ba.__opsAgents=true; window.agBulkApply=ba; }
  if(typeof legacyFillDown==='function'){ var fd=function(){ return enabled()?fillDown.apply(this,arguments):legacyFillDown.apply(this,arguments); }; fd.__ops=true; fd.__opsAgents=true; window.agFillDown=fd; }
  if(typeof legacyTblDeleteSelected==='function'){ var td=function(){ return enabled()?deleteSelected.apply(this,arguments):legacyTblDeleteSelected.apply(this,arguments); }; td.__ops=true; td.__opsAgents=true; window.agTblDeleteSelected=td; }
  /* Agent Excel import (legacy agImportFile ... agImportApply). The sheet is still parsed in the browser (SheetJS, the
     legacy _agImpRow), and the preview modal is legacy's own. What changes is who decides: the sheet's rows go to
     POST /v1/agents/import {rows, overwrite, dry_run, select}. A dry run (saves nothing) fills the preview, so which agent
     a row matches, the action (create / update / nothing), the fields it would write, the owner conflict and the rate note
     are the server's. The Import button sends the same rows with dry_run:false and `select` = the ticked sheet lines.
     Rows are sent as the sheet has them (headers with a trailing '*' lose it), blank lines included, so the server's row
     number (first data row = 2) is the preview's row number (r.n). Until the dry run lands the preview shows legacy's own
     local match. A server `error` row is shown unticked with the server's message; the others in the file still import. */
  var legacyImpRow=window._agImpRow, legacyImpFile=window.agImportFile, legacyImpCompute=window.agImportComputeWrites, legacyImpRender=window.agImportRender;
  var impSeq=0;
  function rawKeys(o){ var out={}; Object.keys(o||{}).forEach(function(k){ out[String(k).replace(/\*$/,'').trim()]=o[k]; }); return out; }
  function impRows(){
    var R=_agImp.rows, last=0, out=[];
    R.forEach(function(r){ if(r.n>last) last=r.n; });
    for(var n=2;n<=last;n++) out.push({});
    R.forEach(function(r){ var raw=r.src && r.src.__raw; if(raw) out[r.n-2]=rawKeys(raw); });
    return out;
  }
  if(typeof legacyImpRow==='function'){
    var ir=function(o,note){
      var src=legacyImpRow.apply(this,arguments);
      if(enabled() && src && typeof src==='object') Object.defineProperty(src,'__raw',{value:o,enumerable:false});
      return src;
    };
    ir.__ops=true; ir.__opsAgents=true; window._agImpRow=ir;
  }
  function impDryRun(){
    var imp=_agImp, seq=++impSeq;
    return write('POST','/v1/agents/import',{rows:impRows(), overwrite:!!imp.overwrite, dry_run:true}).then(function(j){
      if(_agImp!==imp || seq!==impSeq) return;
      var by={}; ((j&&j.rows)||[]).forEach(function(x){ by[x.row]=x; });
      imp.rows.forEach(function(r){
        var s=by[r.n]; if(!s) return;
        r.serverError=s.action==='error' ? (s.error||'This row was refused') : '';
        r.serverRateNote=s.rate_note||'';
        r.action=s.action==='create' ? 'create' : 'update';
        r.writes=s.action==='create' ? Object.keys(r.src) : (s.action==='update' ? (s.writes||[]).slice() : []);
        if(s.action==='create' && (s.writes||[]).length) r.writes=s.writes.slice();
        r.match=s.matched_agent_id ? {id:s.matched_agent_id, name:s.matched_agent_name||s.matched_agent_id, market:(current(s.matched_agent_id)||{}).market||''} : null;
        r.ownerConflict=!!s.owner_conflict; r.ownerSalesId=s.owner_sales_id||'';
        r.rateAmb=null;
        if(s.action==='error') r.checked=false;
      });
      window.agImportRender();   // the wrapped render (irn), so the refused row's message and the rate note are drawn
    },function(e){ fail('Could not check the agent import',e); });
  }
  if(typeof legacyImpFile==='function'){
    var iff=function(){ return legacyImpFile.apply(this,arguments); };
    iff.__ops=true; iff.__opsAgents=true; window.agImportFile=iff;
  }
  if(typeof legacyImpCompute==='function'){
    var ic=function(){
      var r=legacyImpCompute.apply(this,arguments);
      if(enabled() && _agImp && _agImp.rows && _agImp.rows.length) impDryRun();
      return r;
    };
    ic.__ops=true; ic.__opsAgents=true; window.agImportComputeWrites=ic;
  }
  /* after the legacy modal is drawn, add what it has no place for: a refused row's message and the server's rate note */
  if(typeof legacyImpRender==='function'){
    var irn=function(){
      var r=legacyImpRender.apply(this,arguments);
      if(!enabled() || !_agImp) return r;
      var trs=document.querySelectorAll('#agimp-modal tbody tr');
      _agImp.rows.forEach(function(row,i){
        var td=trs[i] && trs[i].children[2]; if(!td) return;
        function note(txt,fg,bg){
          var d=document.createElement('div');
          d.style.cssText='font-size:10px;font-weight:700;color:'+fg+';background:'+bg+';border-radius:6px;padding:2px 8px;margin-top:3px;display:block';
          d.textContent=txt; td.appendChild(d);
        }
        /* §impRefusedBadge (Q28) · a refused row has no verdict from legacy's own rule: its "มีแล้ว · ไม่มีอะไรเปลี่ยน" badge would
           say the row is fine, so the badge cell is emptied and only the server's red message is left */
        if(row.serverError && trs[i].children[3]) trs[i].children[3].textContent='';
        if(row.serverError) note(row.serverError,'#A32D2D','#FCEBEB');
        if(row.serverRateNote) note(row.serverRateNote,'#8A5410','#FDF3E4');
      });
      return r;
    };
    irn.__ops=true; irn.__opsAgents=true; window.agImportRender=irn;
  }
  if(typeof legacyImportApply==='function'){
    var ia=function(){
      if(!enabled()) return legacyImportApply.apply(this,arguments);
      var imp=_agImp; if(!imp) return;
      var pick=imp.rows.filter(function(r){ return r.checked && !r.serverError && (r.action==='create' || (r.writes||[]).length); });
      if(!pick.length) return;
      return write('POST','/v1/agents/import',{rows:impRows(), overwrite:!!imp.overwrite, dry_run:false, select:pick.map(function(r){ return r.n; })}).then(function(j){
        var ap=(j&&j.applied)||{created:0,updated:0,fields:0,agent_ids:[]};
        return Promise.all((ap.agent_ids||[]).map(function(id){ return fetchAgent(id).catch(function(){ return null; }); })).then(function(){
          if(typeof agImportClose==='function') agImportClose();
          redraw();
          if(O.wrote) O.wrote('agents');
          if(typeof renderAgents==='function') renderAgents();
          if(typeof laSaveToast==='function')
            laSaveToast({kind:'success', title:'นำเข้า Agent สำเร็จ', status:((+ap.created||0)+(+ap.updated||0))+' รายการ',
              sub:'สร้างใหม่ '+(ap.created||0)+' · อัปเดต '+(ap.updated||0)+' · เขียนข้อมูล '+(ap.fields||0)+' ช่อง', dur:5200});
          else alert('นำเข้าสำเร็จ · สร้าง '+(ap.created||0)+' · อัปเดต '+(ap.updated||0));
        });
      },function(e){ return fail('Agent import refused',e); });
    };
    ia.__ops=true; ia.__opsAgents=true; window.agImportApply=ia;
  }
  /* Rate seasons (PUT /v1/agents/:id/rate-seasons replaces the agent's whole table and writes the activity line).
     Both legacy savers set a.rateSeasons and called sbAgentsPersist, a no-op in ops mode: the table vanished on reload.
     · rtmSave  (the agent's own season tab)   one PUT; the screen is redrawn from the server's table.
     · rtExpBulkApply (set the whole group)    the list response carries no seasons, so each candidate's table is READ first
       (legacy leaves an agent that already has one alone, and a PUT would replace it), then the legacy apply runs
       as the snapshot step and every agent whose table changed is PUT, one queued write each; a refused agent goes back to
       its snapshot and the refusals come out in ONE red toast while the others proceed. */
  function saveSeasons(){
    if(!enabled()) return legacyRtmSave.apply(this,arguments);
    if(typeof laGuardEdit==='function' && !laGuardEdit('sales')) return;
    var a=current(window._rtmAgent); if(!a) return;
    var clean=(window._rtmDraft||[]).filter(function(x){ return x && x.rt && x.from; })
      .map(function(x){ return {rt:x.rt, from:x.from, to:x.to||''}; })
      .sort(function(x,y){ return String(x.from).localeCompare(String(y.from)); });
    return write('PUT','/v1/agents/'+enc(a.id)+'/rate-seasons',{seasons:seasonsOut(clean)}).then(function(){
      return fetchAgent(a.id);
    }).then(function(){
      if(typeof rtmInit==='function') rtmInit(a.id);
      if(typeof rtmRedraw==='function') rtmRedraw();
      if(O.wrote) O.wrote('agents');
      if(typeof flShowToast==='function') flShowToast('บันทึกตารางฤดูกาลแล้ว');
    },function(e){ return fail('Could not save rate seasons',e); });
  }
  function bulkSeasons(){
    if(!enabled()) return legacyExpBulkApply.apply(this,arguments);
    var self=this, args=arguments;
    var P=(typeof rtExpBulkPlan==='function') ? rtExpBulkPlan(window._rtExpBulkRt) : null;
    if(!P || !P.total) return;
    var ags=[]; P.groups.forEach(function(g){ g.ags.forEach(function(a){ if(ags.indexOf(a)<0) ags.push(a); }); });
    return Promise.all(ags.map(function(a){
      return O.get('/v1/agents/'+enc(a.id)+'/rate-seasons').then(function(r){ a.rateSeasons=seasonsIn(r && r.seasons); });
    })).then(function(){
      var before={}; ags.forEach(function(a){ before[a.id]={seasons:clone(a.rateSeasons||[]), activity:clone(a.activity||[])}; });
      legacyExpBulkApply.apply(self,args);
      var changed=ags.filter(function(a){ return JSON.stringify(a.rateSeasons||[])!==JSON.stringify(before[a.id].seasons); });
      var refused=[], chain=Promise.resolve();
      changed.forEach(function(a){
        chain=chain.then(function(){
          return write('PUT','/v1/agents/'+enc(a.id)+'/rate-seasons',{seasons:seasonsOut(a.rateSeasons)}).then(function(){ return fetchAgent(a.id); },function(e){
            a.rateSeasons=before[a.id].seasons; a.activity=before[a.id].activity;
            refused.push((a.code||a.name||a.id)+': '+((e&&e.message)||'refused')+(e&&e.code?' ['+e.code+']':''));
          });
        });
      });
      return chain.then(function(){
        if(O.wrote) O.wrote('agents');
        if(typeof rtExpRender==='function') rtExpRender();
        redraw();
        if(refused.length) fail('Rate seasons refused for '+refused.length+' of '+changed.length+' agent(s)',new Error(refused.join('\n')));
      });
    },function(e){ return fail('Could not read the agents\' rate seasons',e); });
  }
  if(typeof legacyRtmSave==='function'){ saveSeasons.__ops=true; saveSeasons.__opsAgents=true; window.rtmSave=saveSeasons; }
  if(typeof legacyExpBulkApply==='function'){ bulkSeasons.__ops=true; bulkSeasons.__opsAgents=true; window.rtExpBulkApply=bulkSeasons; }

  /* "Fill programmes to the rate" for many agents (agProgBulkApply).  Legacy added a.programPeriods rows and called
     sbAgentsPersist (a no-op here).  PUT /v1/agents/:id/programs REPLACES the agent's programme list, and the list
     response carries route ids only (no periods or notes), so each candidate is read in full first; then the legacy
     apply runs as the snapshot step, every agent whose periods changed is PUT (one queued write each), a refused agent
     goes back to its snapshot and the refusals come out in ONE red toast. */
  function bulkPrograms(){
    if(!enabled()) return legacyProgBulkApply.apply(this,arguments);
    var self=this, args=arguments;
    var P=(typeof agProgBulkPlan==='function') ? agProgBulkPlan() : null; if(!P) return;
    var list=(window._agProgBulkScope==='partial') ? P.partial : P.empty; if(!list || !list.length) return;
    var ids=list.map(function(f){ return f.a.id; });
    return Promise.all(ids.map(function(id){ return fetchAgent(id); })).then(function(){
      var before={}; ids.forEach(function(id){ var a=current(id); if(a) before[id]={periods:clone(a.programPeriods||[]), programs:clone(a.programs||[]), activity:clone(a.activity||[])}; });
      legacyProgBulkApply.apply(self,args);
      var changed=ids.map(current).filter(function(a){ return a && before[a.id] && JSON.stringify(a.programPeriods||[])!==JSON.stringify(before[a.id].periods); });
      var refused=[], chain=Promise.resolve();
      changed.forEach(function(a){
        chain=chain.then(function(){
          return write('PUT','/v1/agents/'+enc(a.id)+'/programs',{programs:programsBody(a.programPeriods)}).then(function(){ return fetchAgent(a.id); },function(e){
            var b=before[a.id]; a.programPeriods=b.periods; a.programs=b.programs; a.activity=b.activity;
            refused.push((a.code||a.name||a.id)+': '+((e&&e.message)||'refused')+(e&&e.code?' ['+e.code+']':''));
          });
        });
      });
      return chain.then(function(){
        if(O.wrote) O.wrote('agents');
        redraw();
        if(refused.length) fail('Programmes refused for '+refused.length+' of '+changed.length+' agent(s)',new Error(refused.join('\n')));
      });
    },function(e){ return fail('Could not read the agents\' programmes',e); });
  }
  if(typeof legacyProgBulkApply==='function'){ bulkPrograms.__ops=true; bulkPrograms.__opsAgents=true; window.agProgBulkApply=bulkPrograms; }

  /* agIncompleteFields (the "incomplete data" warning on the list and the agent page): the server works the gaps out
     (GET /v1/agents[/id] `incomplete`: market, sales, pay_type, rate_type, programs, contact; same rule and order as
     legacy) and the browser used to recompute them from list rows that carry no contact. Same labels as legacy. An
     agent row that did not come from the server (no `incomplete` array) still uses the legacy function. */
  var legacyIncomplete=window.agIncompleteFields;
  if(typeof legacyIncomplete==='function'){
    var INC_LABEL={market:'Market',sales:'Sales owner',pay_type:'Payment',rate_type:'Rate Type',programs:'Programs',contact:'Contact'};
    var inc=function(a){
      if(!enabled() || !a || !Array.isArray(a.incomplete)) return legacyIncomplete.apply(this,arguments);
      return a.incomplete.map(function(k){ return INC_LABEL[k]||k; });
    };
    inc.__ops=true; inc.__opsAgents=true; window.agIncompleteFields=inc;
  }

  /* agAlerts / agHdIssues (the agent page's "Needs action" rows and the list's KPI counts): the server works out the three
     pricing alerts (GET /v1/agents[/id] `alerts`: no_rate_bound, route_no_price, contract_rate_differs; same rules as
     legacy). The browser used to judge them from the rate and contract rows it happened to hold. Same titles, buttons and
     order as legacy; the row text is the server's message as sent. The other alerts (credit, contract expiry, rate expiry,
     rate not started, incomplete profile) stay local: the server has no list for them. An agent row that did not come from
     the server (no `serverAlerts` array) still uses the legacy function. */
  var legacyAlerts=window.agAlerts, legacyHdIssues=window.agHdIssues;
  var AL_BY_CODE={
    no_rate_bound:{rank:3, t:'No rate bound', go:'Pick a rate', tip:'ไม่มีเรท = ไม่มีราคาให้คิด จองไม่ได้ทุกเส้น',
      on:function(id){ return "agEditOpen('ratetype','"+id+"')"; }},
    route_no_price:{rank:4, t:'Route with no price', go:'Open Pricing Matrix', tip:'เรทที่ผูกอยู่ไม่มีราคาของเส้นเหล่านี้ · ปุ่มบันทึกในหน้าจองถูกล็อก (noRate)',
      on:function(id){ return "agSwitchTab('prices','"+id+"')"; }},
    contract_rate_differs:{rank:7, t:'Contract ≠ bound rate', go:'Sync to bound rate', tip:'เอกสารสัญญาจะพิมพ์ราคาชุดที่ระบุในสัญญา ไม่ใช่ชุดที่ระบบคิดจริง',
      on:function(id){ return "agAlertSyncRate('"+id+"')"; }},
    /* w6-d · "Rate not started" (the bound rate's valid-from is still ahead): the server's alert, with its own message and day count */
    rate_not_started:{rank:6, t:'Rate not started', go:'Set season schedule', tip:'วันเดินทางก่อนหน้านั้นไม่มีฤดูคุม · ระบบคิดราคาชุดนี้ให้อยู่ดี',
      on:function(id){ return "agSwitchTab('ratemgmt','"+id+"')"; }}
  };
  var AL_LEGACY_RANK={'Credit over limit':1,'Credit near limit':1,'Contract expired':2,'Contract expiring':2,'Rate expired':5,'Rate expiring':5,'Rate not started':6,'Incomplete profile':8};
  function escText(v){ return String(v==null?'':v).replace(/[&<>"]/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  if(typeof legacyAlerts==='function'){
    var al=function(a){
      var out=legacyAlerts.apply(this,arguments);
      if(!enabled() || !a || !Array.isArray(a.serverAlerts)) return out;
      var kept=out.filter(function(x){ return !Object.keys(AL_BY_CODE).some(function(k){ return AL_BY_CODE[k].t===x.t; }); })
        .map(function(x){ return {rank:AL_LEGACY_RANK[x.t]||8, item:x}; });
      a.serverAlerts.forEach(function(s){
        var m=AL_BY_CODE[s.code]; if(!m) return;
        var item={tone:s.tone, t:m.t, d:escText(s.message), go:m.go, on:m.on(a.id)};
        if(s.code==='rate_not_started' && s.days!=null) item.day='in '+s.days+' days';
        if(s.severity==='blocked') item.sev='Blocked';
        if(m.tip) item.tip=m.tip;
        kept.push({rank:m.rank, item:item});
      });
      /* stable by rank: the sort key is (rank, position) so equal ranks keep their legacy order */
      return kept.map(function(x,i){ return {rank:x.rank,i:i,item:x.item}; })
        .sort(function(x,y){ return x.rank-y.rank || x.i-y.i; }).map(function(x){ return x.item; });
    };
    al.__ops=true; al.__opsAgents=true; window.agAlerts=al;
  }
  if(typeof legacyHdIssues==='function'){
    var hi=function(a){
      var out=legacyHdIssues.apply(this,arguments);
      if(!enabled() || !a || !Array.isArray(a.serverAlerts) || !(a.programs||[]).length) return out;
      delete out.norate; delete out.orph; delete out.drift;
      a.serverAlerts.forEach(function(s){
        if(s.code==='no_rate_bound') out.norate=1;
        else if(s.code==='route_no_price') out.orph=1;
        else if(s.code==='contract_rate_differs') out.drift=1;
      });
      return out;
    };
    hi.__ops=true; hi.__opsAgents=true; window.agHdIssues=hi;
  }

  if(typeof legacyPersist==='function'){
    window.sbAgentsPersist=function(){ if(enabled()) return; return legacyPersist.apply(this,arguments); };
  }
  if(typeof window.agTblPersist==='function'){
    var oldTblPersist=window.agTblPersist;
    window.agTblPersist=function(){ if(enabled()) return; return oldTblPersist.apply(this,arguments); };
  }
  /* §agHist · Recent Bookings tab (agTabHist -> agSumBlock month x route table, plus the paged list).
     Both read SB_BOOKINGS filtered to the agent, which in operation mode holds only the date ranges
     other screens happened to load. On first draw per agent, load THAT agent's bookings through the
     shared booking loader (GET /v1/bookings?agent_id=, limit 500, cursor-paged, every status so the
     cancelled column is real) and redraw the tab once. Scope = all of the agent's bookings, the same
     as legacy (it summed everything it held); capped at 40 pages (20,000 bookings) with a console warning if hit. The first draw is the legacy render over what is loaded;
     a failed load keeps it (never blank) and is not retried until a write or reopening the app. A
     laOps write drops the per-agent state, and the next open reloads with refresh. */
  var legacyHist=window.agTabHist;
  if(typeof legacyHist==='function'){
    var histState=Object.create(null), histEver=Object.create(null), histEpoch=0;
    O.onWrite(function(kind){ if(/^remote:/.test(String(kind||'')) && kind!=='remote:booking') return; histEpoch++; histState=Object.create(null); });
    var histOnScreen=function(id){
      var t=document.querySelector('#ag-main .sb-tab.on[data-tab="hist"]');
      return !!(t && String(t.getAttribute('onclick')||'').indexOf("'"+id+"'")>=0 && document.getElementById('ag-tabbody'));
    };
    var hist=function(a){
      if(enabled() && a && a.id && !histState[a.id] && typeof window.bookingV2EnsureOpsRange==='function'){
        var id=a.id, epoch=histEpoch;
        var load=window.bookingV2EnsureOpsRange({agentId:id,limit:500,maxPages:40,refresh:!!histEver[id],delta:true});
        if(!load) histState[id]='done';
        else{
          histState[id]='loading';
          load.then(function(r){ return r; },function(){ return null; }).then(function(r){
            if(epoch!==histEpoch) return;
            histEver[id]=true; histState[id]=r?'done':'failed';
            if(!r){ console.warn('[ops] agent history: could not load bookings for '+id+'; showing the bookings already loaded'); return; }
            if(histOnScreen(id)){
              var body=document.getElementById('ag-tabbody'), ag=(typeof sbGetAgent==='function')?sbGetAgent(id):a;
              if(body && ag) body.innerHTML=window.agTabHist(ag);
            }
          });
        }
      }
      return legacyHist.apply(this,arguments);
    };
    hist.__ops=true; hist.__opsAgents=true; window.agTabHist=hist;
  }

  /* ════ The agent's credit (legacy agCreditState) · GET /v1/agents/{id} `credit`, worked out by the server ════
     The list does not carry it, the detail does. agCreditState is synchronous, so it answers from the server's
     credit when this agent's is in hand and fresh (any write drops it), and asks for it in the background
     otherwise; until it lands the legacy sum answers. */
  var CREDIT_TTL=60000, creditAsk=Object.create(null), creditAll=null;
  function dropCredit(){ list().forEach(function(a){ if(a) delete a.serverCredit; }); creditAsk=Object.create(null); creditAll=null; }
  O.onWrite(dropCredit);
  if(typeof agCreditState==='function'){
    var legacyCredit=agCreditState;
    var credit=function(agentId){
      if(!enabled()) return legacyCredit.apply(this,arguments);
      var a=current(agentId), c=a && a.serverCredit;
      if(c && Date.now()-c.at<CREDIT_TTL) return { limit:c.limit, used:c.used, available:c.available, pct:c.pct, mode:a.payType||null, over:c.over };
      if(a && !creditAsk[agentId]){
        creditAsk[agentId]=true;
        // one read for every agent (GET /v1/agents/credit): the Accounting screen asks this for ~450 agents at once, which was ~450 detail requests
        if(!creditAll){
          creditAll=O.get('/v1/agents/credit').then(function(r){
            ((r&&r.credits)||[]).forEach(function(c){ var m=current(c.agent_id); if(m) m.serverCredit={ at:Date.now(), limit:c.limit, used:c.used, available:c.available, pct:c.pct, over:c.over }; });
            return true;
          },function(){ return false; }).then(function(ok){
            setTimeout(function(){ creditAll=null; creditAsk=Object.create(null); }, CREDIT_TTL);
            if(ok && typeof window.renderAccounting==='function' && O.activeView && O.activeView()==='accounting' && !(O.busy&&O.busy())) try{ window.renderAccounting(); }catch(_){}
            return ok;
          });
        }
      }
      return legacyCredit.apply(this,arguments);
    };
    credit.__ops=true; credit.__opsAgents=true; window.agCreditState=credit;
  }
})();
