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
      payType:payIn(s.pay_type), vatMode:s.vat_mode||'none', creditDays:s.credit_days==null ? null : s.credit_days,
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
    if(Array.isArray(s.rate_seasons)) o.rateSeasons=clone(s.rate_seasons);
    if(s.credit_balance && typeof s.credit_balance.available==='number') o.creditBalance=s.credit_balance.available;
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
      if(section==='ratetype' && e.code==='unpriced_programs' && confirm('This rate has no price for existing programs. Remove those programs and continue?'))
        return write('PUT',path,{rate_type_id:nullable(d.rateTypeId),drop_unpriced:true});
      throw e;
    }).then(function(row){ refreshAfter(id,row); if(typeof agEditClose==='function') agEditClose(); },function(e){ return fail('Could not save agent',e); });
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
      if(e.code==='possible_duplicate' && confirm('A similar agent exists. Create a separate agent anyway?')) return send(createBody(d,true));
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
  window.agActivate=function(id){ return lifecycle(id,'activate'); };
  window.agDeactivate=function(id){ return lifecycle(id,'deactivate'); };
  window.agRenew=function(id,body){ return lifecycle(id,'renew',body); };

  /* Detail reads are authoritative too. This is installed before 10-ops-catalogue.js,
     which detects __ops and does not add its former read-only/detail wrapper. */
  if(typeof legacyDetail==='function'){
    var detail=function(id){
      if(!enabled()) return legacyDetail.apply(this,arguments);
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
  if(typeof legacyImportApply==='function'){
    var ia=function(){ if(!enabled()) return legacyImportApply.apply(this,arguments); return fail('Agent import unavailable',{message:'Use single-agent create or edit in operation-backend mode.'}); };
    ia.__ops=true; ia.__opsAgents=true; window.agImportApply=ia;
  }
  if(typeof legacyPersist==='function'){
    window.sbAgentsPersist=function(){ if(enabled()) return; return legacyPersist.apply(this,arguments); };
  }
  if(typeof window.agTblPersist==='function'){
    var oldTblPersist=window.agTblPersist;
    window.agTblPersist=function(){ if(enabled()) return; return oldTblPersist.apply(this,arguments); };
  }
})();
