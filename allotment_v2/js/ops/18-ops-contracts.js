/* ══════════════════════════════════════════════════════════════════════════
   §opsContracts · promo contracts, templates and read-only documents
   ──────────────────────────────────────────────────────────────────────────
   operation-backend is authoritative in operations mode. The legacy camelCase
   contract projection remains available to the existing Agent UI, but no
   localStorage write is allowed through this adapter.

   Promo contracts: GET/POST/PATCH /v1/contracts and POST /:id/void
   Documents: GET /v1/agents/:id/documents and GET /v1/contract-documents/:id
   Templates: GET/POST /v1/contract-templates, GET/PATCH/DELETE /:id,
              POST /:id/default

   Artifact upload/metadata conversion is intentionally not implemented: the
   migration plan marks that legacy mapping BLOCKED. The document view below
   displays the confirmed server document shape only.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O=window.laOps; if(!O) return;
  var state={contracts:{loaded:false,failed:false,loading:null},templates:{loaded:false,failed:false,loading:null},documents:{}};
  var originals={};

  function enabled(){ return !!(O.enabled&&O.enabled()); }
  function enc(v){ return encodeURIComponent(v==null?'':String(v)); }
  function clone(v){ return O.clone?O.clone(v):(v==null?v:JSON.parse(JSON.stringify(v))); }
  function text(v){ return v==null?'':String(v).trim(); }
  function nullable(v){ var s=text(v); return s?s:null; }
  function listContracts(){ return typeof SB_CONTRACTS!=='undefined'&&Array.isArray(SB_CONTRACTS)?SB_CONTRACTS:[]; }
  function listTemplates(){
    if(typeof SB_CONTRACT_TEMPLATES==='undefined') return {};
    /* Do not call ctTmplLoad() here: its legacy seed writes localStorage. In
       operations mode the server response must create the in-memory store. */
    if(!SB_CONTRACT_TEMPLATES) SB_CONTRACT_TEMPLATES={};
    return SB_CONTRACT_TEMPLATES;
  }
  /* §ctplFit · paint Contract Templates only while it is on screen. _cttPreviewNow() scales the
     794px A4 stack to the preview box's width; painted while the view is display:none (the boot
     load lands before anyone opens the page) that width is 0, the scale drops to its 120px floor,
     and renderContractTemplates' unchanged-data check then keeps that thumbnail when nav() opens
     the page. Off screen, forget the painted signature instead so nav() paints it at its real width. */
  function redrawTemplates(){
    if(typeof renderContractTemplates!=='function') return;
    var w=document.getElementById('cttv-wrap');
    if(w&&w.offsetWidth>0){ renderContractTemplates(); return; }
    try{ _cttSig=null; }catch(_){ }
    try{ prepSample(); }catch(_){ }   /* §ctplSample · fetch the sample's record ahead, paint nothing */
  }
  function redraw(){
    try{ redrawTemplates(); }catch(_){ }
    try{ if(typeof agRenderDetail==='function'&&typeof _agSelected!=='undefined'&&_agSelected) agRenderDetail(_agSelected); }catch(_){ }
  }
  function replaceContract(row){
    var mapped=fromServerContract(row), rows=listContracts(), i=rows.findIndex(function(x){return x&&x.id===mapped.id;});
    if(i<0) rows.push(mapped); else rows[i]=mapped;
    return mapped;
  }
  function replaceContracts(rows){
    var out=(rows||[]).map(fromServerContract), target=listContracts();
    target.length=0; Array.prototype.push.apply(target,out); return out;
  }

  var PAX={
    'adult-thai':{category:'ad',residency:'thai'}, 'adult-fr':{category:'ad',residency:'foreign'},
    'child-thai':{category:'chd',residency:'thai'}, 'child-fr':{category:'chd',residency:'foreign'}
  };
  var LEGACY_PAX={ad_th:'adult-thai',ad_fr:'adult-fr',chd_th:'child-thai',chd_fr:'child-fr'};
  function fromServerContract(c){
    c=c||{}; var rates={};
    (Array.isArray(c.seat_prices)?c.seat_prices:[]).forEach(function(p){
      var k=p.category==='chd'?(p.residency==='thai'?'child-thai':'child-fr'):(p.residency==='thai'?'adult-thai':'adult-fr');
      rates[p.route_id]=rates[p.route_id]||{}; rates[p.route_id][p.zone]=rates[p.route_id][p.zone]||{};
      rates[p.route_id][p.zone][k]=Number(p.price)||0;
    });
    var periods=(Array.isArray(c.program_periods)?c.program_periods:[]).map(function(p){return {
      routeId:p.route_id, bookFrom:p.book_from||'', bookTo:p.book_to||'', travelFrom:p.travel_from||'', travelTo:p.travel_to||'', note:p.note||''
    };});
    return {
      id:c.id, agentId:c.agent_id, kind:c.kind, status:c.status, rateTypeId:c.rate_type_id||null,
      activeFrom:c.active_from||null, activeTo:c.active_to||null, priority:Number(c.priority)||0, version:c.version||'',
      priceMode:c.price_mode||'rate', rates:rates, discount:c.discount?clone(c.discount):null,
      bonus:c.bonus?{on:1,buy:Number(c.bonus.buy)||0,free:Number(c.bonus.free)||1,basis:c.bonus.basis||'adchd'}:null,
      bookWin:!!c.book_window, createdDate:c.created_date||null, createdBy:c.created_by||null, note:c.note||'',
      docId:c.doc_id||null, voidedAt:c.voided_at||null, voidedBy:c.voided_by||null, programPeriods:periods,
      serverState:c.state||null, bonusProgress:c.bonus_progress?clone(c.bonus_progress):null
    };
  }
  function seatPrices(rates){
    var out=[]; Object.keys(rates||{}).forEach(function(routeId){
      Object.keys(rates[routeId]||{}).forEach(function(zone){
        Object.keys(rates[routeId][zone]||{}).forEach(function(k){
          var p=PAX[k], n=Number(rates[routeId][zone][k]);
          if(!p||!Number.isFinite(n)||n<0) return;
          out.push({route_id:routeId,zone:zone,category:p.category,residency:p.residency,price:n});
        });
      });
    }); return out;
  }
  function toPromoBody(c, agentId){
    c=c||{}; var first=(c.programPeriods||[])[0]||{};
    var body={price_mode:c.priceMode||'rate',rate_type_id:(c.priceMode||'rate')==='rate'?(c.rateTypeId||null):null,
      seat_prices:(c.priceMode||'rate')==='own'?seatPrices(c.rates||{}):[],
      discount:(c.priceMode||'rate')==='discount'&&c.discount?clone(c.discount):null,
      bonus:c.bonus&&c.bonus.on?{buy:Number(c.bonus.buy)||0,free:1,basis:c.bonus.basis||'adchd'}:null,
      active_from:c.activeFrom||first.travelFrom,active_to:c.activeTo||first.travelTo,
      book_from:c.bookWin?(first.bookFrom||null):null,book_to:c.bookWin?(first.bookTo||null):null,
      route_ids:(c.programPeriods||[]).map(function(p){return p.routeId||p.route_id;}).filter(Boolean),
      priority:Number(c.priority)||10,note:nullable(c.note)};
    if(agentId) body.agent_id=agentId; return body;
  }
  function promoBodyFromDom(agentId,editId){
    var d=function(id){return document.getElementById(id);}, mode=((document.querySelector('input[name="ct-promo-mode"]:checked')||{}).value)||'rate';
    var from=d('ct-promo-from')&&d('ct-promo-from').value, to=d('ct-promo-to')&&d('ct-promo-to').value;
    var bfrom=d('ct-promo-bfrom')&&d('ct-promo-bfrom').value, bto=d('ct-promo-bto')&&d('ct-promo-bto').value;
    var routes=typeof ctPromoRoutesPicked==='function'?ctPromoRoutesPicked():[];
    var body={price_mode:mode,rate_type_id:mode==='rate'?nullable(d('ct-promo-rate')&&d('ct-promo-rate').value):null,seat_prices:[],discount:null,
      bonus:null,active_from:from||'',active_to:to||'',book_from:bfrom||null,book_to:bto||null,route_ids:routes,
      priority:parseInt(d('ct-promo-prio')&&d('ct-promo-prio').value,10)||10,note:nullable(d('ct-promo-note')&&d('ct-promo-note').value)};
    if(mode==='own') [].slice.call(document.querySelectorAll('#ct-promo-rates .ct-pr-in')).forEach(function(el){
      var p=PAX[el.getAttribute('data-k')], n=Number(String(el.value||'').trim());
      if(!p||!Number.isFinite(n)||n<0) return;
      body.seat_prices.push({route_id:el.getAttribute('data-r'),zone:el.getAttribute('data-z'),category:p.category,residency:p.residency,price:n});
    });
    if(mode==='discount') body.discount={mode:((document.querySelector('input[name="ct-promo-dmode"]:checked')||{}).value)||'pct',value:Number(d('ct-promo-dval')&&d('ct-promo-dval').value)||0};
    if(d('ct-promo-bon')&&d('ct-promo-bon').checked) body.bonus={buy:parseInt(d('ct-promo-bon-n')&&d('ct-promo-bon-n').value,10)||0,free:1,basis:(d('ct-promo-bon-basis')&&d('ct-promo-bon-basis').value)||'adchd'};
    if(!from||!to||to<from||!routes.length) throw new Error('Enter valid travel dates and select at least one route');
    if(bfrom&&bto&&bto<bfrom) throw new Error('The booking window runs backwards');
    if(editId) body.__editId=editId;
    body.agent_id=agentId; return body;
  }

  function loadContracts(){
    if(!enabled()) return Promise.resolve(false);
    if(state.contracts.loading) return state.contracts.loading;
    listContracts().length=0;
    state.contracts.loading=O.get('/v1/contracts').then(function(j){
      replaceContracts(j&&j.contracts||[]); state.contracts.loaded=true; state.contracts.failed=false; redraw(); return true;
    }).catch(function(e){state.contracts.failed=true;state.contracts.loaded=false;listContracts().length=0;O.fail('Could not load contracts',e);return false;})
      .finally(function(){state.contracts.loading=null;});
    return state.contracts.loading;
  }
  function refreshAgentContracts(agentId){
    if(!enabled()) return Promise.resolve([]);
    return O.get('/v1/contracts',{agent_id:agentId}).then(function(j){
      var rows=listContracts().filter(function(c){return c&&c.agentId!==agentId;}).concat((j&&j.contracts||[]).map(fromServerContract));
      rows.sort(function(a,b){return String(a.agentId).localeCompare(String(b.agentId))||String(a.id).localeCompare(String(b.id));});
      var target=listContracts();target.length=0;Array.prototype.push.apply(target,rows);return rows;
    });
  }
  function promoWriteBody(body,editId,flags){
    var send=Object.assign({},body,flags||{});
    /* agent_id belongs to POST only; PATCH keeps the promotion with its current agent. */
    if(editId) delete send.agent_id;
    return send;
  }
  function writePromo(agentId,editId,body,flags){
    flags=flags||{}; var send=promoWriteBody(body,editId,flags), path=editId?'/v1/contracts/'+enc(editId):'/v1/contracts', method=editId?'PATCH':'POST';
    return O.queue(function(){return O.call(method,path,send);}).catch(function(e){
      if((e.code==='routes_unpriced'||e.code==='promo_sold')&& !flags[(e.code==='routes_unpriced'?'unpriced_anyway':'sold_anyway')] && confirm((e.message||'The server requires confirmation')+'\n\nContinue?')){
        var f={};f[e.code==='routes_unpriced'?'unpriced_anyway':'sold_anyway']=true;return writePromo(agentId,editId,body,Object.assign({},flags,f));
      } throw e;
    }).then(function(row){replaceContract(row);return row;});
  }
  function savePromo(agentId,editId){
    if(!enabled()) return originals.ctSaveAddPromo.apply(this,arguments);
    var body; try{body=promoBodyFromDom(agentId,editId);}catch(e){alert(e.message);return;}
    delete body.__editId;
    return writePromo(agentId,editId,body).then(function(){
      if(typeof ctCloseAddPromo==='function') ctCloseAddPromo();
      if(typeof agSwitchTab==='function') agSwitchTab('prices',agentId); else redraw();
      if(O.wrote) O.wrote('contract-save');
    }).catch(function(e){O.fail('Could not save promotion',e);});
  }
  function voidPromo(id,agentId){
    if(!enabled()) return originals.ctVoidContract.apply(this,arguments);
    var c=listContracts().find(function(x){return x&&x.id===id;}); if(!c) return;
    if(!confirm('Void this promotion? Pricing will return to the main contract.')) return;
    return O.queue(function(){return O.post('/v1/contracts/'+enc(id)+'/void',{});}).then(function(row){
      replaceContract(row); if(typeof agSwitchTab==='function') agSwitchTab('prices',agentId); else redraw(); if(O.wrote) O.wrote('contract-void');
    }).catch(function(e){O.fail('Could not void promotion',e);});
  }

  function fromServerTemplate(t){ return {id:t.id,code:t.code||'',name:t.name||'',active:t.active!==false,isDefault:!!t.is_default,
    createdDate:t.created_date||'',note:t.note||'',form:t.form||'ocean',accent:t.accent||'navy',accentHex:t.accent_hex||'',font:t.font||'manrope',
    sections:clone(t.sections||{}),text:clone(t.text||{en:{},th:{}}),agents:Number(t.agents)||0,createdAt:t.created_at,updatedAt:t.updated_at}; }
  function templateBody(t){
    var body={name:t.name||'',note:nullable(t.note),active:t.active!==false,form:t.form||null,accent:t.accent||null,
      accent_hex:nullable(t.accentHex),font:t.font||null,sections:clone(t.sections||{}),text:clone(t.text||{en:{},th:{}})};
    /* POST may omit code so the server allocates the next CT-NN. PATCH sends
       the existing code, which the server validates for uniqueness. */
    if(text(t.code)) body.code=text(t.code);
    return body;
  }
  function replaceTemplate(row){var m=listTemplates(), x=fromServerTemplate(row);m[x.id]=x;return x;}
  function replaceTemplates(rows){var m=listTemplates();Object.keys(m).forEach(function(k){delete m[k];});(rows||[]).forEach(function(t){var x=fromServerTemplate(t);m[x.id]=x;});return m;}
  function loadTemplates(){
    if(!enabled()) return Promise.resolve(false); if(state.templates.loading) return state.templates.loading; listTemplates();
    state.templates.loading=O.get('/v1/contract-templates',{active:'all'}).then(function(j){return Promise.all((j&&j.contract_templates||[]).map(function(x){return O.get('/v1/contract-templates/'+enc(x.id));}));})
      .then(function(rows){replaceTemplates(rows);state.templates.loaded=true;state.templates.failed=false;redraw();return true;})
      .catch(function(e){state.templates.failed=true;state.templates.loaded=false;var m=listTemplates();Object.keys(m).forEach(function(k){delete m[k];});O.fail('Could not load contract templates',e);return false;})
      .finally(function(){state.templates.loading=null;}); return state.templates.loading;
  }
  function templateWrite(id,body){return O.queue(function(){return O.patch('/v1/contract-templates/'+enc(id),body);}).then(function(row){replaceTemplate(row);redraw();return row;});}
  function templateEdit(id,key,value){
    var t=listTemplates()[id];if(!t)return;var next=clone(t);next[key]=value;return templateWrite(id,templateBody(next)).catch(function(e){O.fail('Could not save contract template',e);});
  }
  function wrapTemplateWrites(){
    originals.ctTmplLoad=window.ctTmplLoad;originals.ctTmplPersist=window.ctTmplPersist;
    originals.cttNew=window.cttNew;originals.cttSetField=window.cttSetField;originals.cttSetText=window.cttSetText;originals.cttSetForm=window.cttSetForm;
    originals.cttSetAccent=window.cttSetAccent;originals.cttSetHex=window.cttSetHex;originals.cttSetFont=window.cttSetFont;originals.cttSetSection=window.cttSetSection;
    originals.cttSetDefault=window.cttSetDefault;originals.cttToggleActive=window.cttToggleActive;originals.cttDelete=window.cttDelete;originals.cttResetKey=window.cttResetKey;
    if(typeof originals.ctTmplLoad==='function') window.ctTmplLoad=function(){return enabled()?listTemplates():originals.ctTmplLoad.apply(this,arguments);};
    if(typeof originals.ctTmplPersist==='function') window.ctTmplPersist=function(){if(!enabled())return originals.ctTmplPersist.apply(this,arguments);};
    if(typeof originals.cttNew==='function') window.cttNew=function(){if(!enabled())return originals.cttNew.apply(this,arguments);var base=Object.values(listTemplates()).find(function(x){return x.isDefault&&x.active;})||Object.values(listTemplates())[0]||{};var t={code:'',name:'Template ใหม่',active:true,note:'',form:base.form||'ocean',accent:base.accent||'navy',accentHex:base.accentHex||'',font:base.font||'manrope',sections:clone(base.sections||{}),text:clone(base.text||{en:{},th:{}})};return O.queue(function(){return O.post('/v1/contract-templates',templateBody(t));}).then(function(row){var x=replaceTemplate(row);try{_cttSel=x.id;_cttEdit=true;}catch(_){}redraw();}).catch(function(e){O.fail('Could not create contract template',e);});};
    if(typeof originals.cttSetField==='function') window.cttSetField=function(id,k,v){if(!enabled())return originals.cttSetField.apply(this,arguments);return templateEdit(id,k,v);};
    if(typeof originals.cttSetText==='function') window.cttSetText=function(id,key,lang,v){if(!enabled())return originals.cttSetText.apply(this,arguments);var t=clone(listTemplates()[id]);if(!t)return;t.text=t.text||{en:{},th:{}};var L=lang==='th'?'th':'en';t.text[L]=t.text[L]||{};var kind='text';try{if(typeof CT_TMPL_GROUPS!=='undefined')CT_TMPL_GROUPS.forEach(function(g){(g.keys||[]).forEach(function(x){if(x.k===key)kind=x.type||'text';});});}catch(_){}t.text[L][key]=kind==='list'?String(v||'').split('\\n').map(function(s){return s.trim();}).filter(Boolean):v;return templateWrite(id,templateBody(t)).catch(function(e){O.fail('Could not save contract template text',e);});};
    if(typeof originals.cttSetForm==='function') window.cttSetForm=function(id,v){if(!enabled())return originals.cttSetForm.apply(this,arguments);return templateEdit(id,'form',v);};
    if(typeof originals.cttSetAccent==='function') window.cttSetAccent=function(id,v){if(!enabled())return originals.cttSetAccent.apply(this,arguments);var t=clone(listTemplates()[id]);if(!t)return;t.accent=v;t.accentHex='';return templateWrite(id,templateBody(t)).catch(function(e){O.fail('Could not save template accent',e);});};
    if(typeof originals.cttSetHex==='function') window.cttSetHex=function(id,v){if(!enabled())return originals.cttSetHex.apply(this,arguments);return templateEdit(id,'accentHex',/^#[0-9a-fA-F]{6}$/.test(v||'')?v:'');};
    if(typeof originals.cttSetFont==='function') window.cttSetFont=function(id,v){if(!enabled())return originals.cttSetFont.apply(this,arguments);return templateEdit(id,'font',v);};
    if(typeof originals.cttSetSection==='function') window.cttSetSection=function(id,sid,on){if(!enabled())return originals.cttSetSection.apply(this,arguments);var t=clone(listTemplates()[id]);if(!t)return;t.sections=t.sections||{};t.sections[sid]=!!on;return templateWrite(id,templateBody(t)).catch(function(e){O.fail('Could not save template sections',e);});};
    if(typeof originals.cttSetDefault==='function') window.cttSetDefault=function(id){if(!enabled())return originals.cttSetDefault.apply(this,arguments);return O.queue(function(){return O.post('/v1/contract-templates/'+enc(id)+'/default',{});}).then(function(){return loadTemplates();}).catch(function(e){O.fail('Could not set default contract template',e);});};
    if(typeof originals.cttToggleActive==='function') window.cttToggleActive=function(id){if(!enabled())return originals.cttToggleActive.apply(this,arguments);var t=listTemplates()[id];if(!t)return;return templateEdit(id,'active',!t.active);};
    if(typeof originals.cttDelete==='function') window.cttDelete=function(id){if(!enabled())return originals.cttDelete.apply(this,arguments);var t=listTemplates()[id];if(!t||!confirm('Delete contract template "'+t.name+'"?'))return;return O.queue(function(){return O.del('/v1/contract-templates/'+enc(id));}).then(function(){delete listTemplates()[id];countsStale=true;redraw();}).catch(function(e){O.fail('Could not delete contract template',e);});};
    if(typeof originals.cttResetKey==='function') window.cttResetKey=function(id,key,lang){if(!enabled())return originals.cttResetKey.apply(this,arguments);var t=clone(listTemplates()[id]);if(!t)return;var L=lang==='th'?'th':'en',v=typeof CT_DOC_I18N!=='undefined'&&CT_DOC_I18N[L]&&CT_DOC_I18N[L][key];if(v===undefined)return;t.text=t.text||{en:{},th:{}};t.text[L]=t.text[L]||{};t.text[L][key]=clone(v);return templateWrite(id,templateBody(t)).catch(function(e){O.fail('Could not reset contract template text',e);});};
  }

  function escapeHtml(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function showDocument(doc){
    var old=document.getElementById('la-ops-contract-doc');if(old)old.remove();var wrap=document.createElement('div');wrap.id='la-ops-contract-doc';
    wrap.style.cssText='position:fixed;inset:0;z-index:100005;background:rgba(20,28,38,.5);display:flex;align-items:center;justify-content:center;padding:22px;box-sizing:border-box';
    wrap.innerHTML='<div style="background:#fff;max-width:860px;width:100%;max-height:90vh;overflow:auto;border-radius:14px;padding:20px;font-family:inherit"><div style="display:flex;justify-content:space-between;gap:12px"><b>Contract document · read only</b><button type="button" style="border:0;background:none;font-size:18px;cursor:pointer">×</button></div><div style="margin-top:12px;font-size:12px;line-height:1.7">ID: '+escapeHtml(doc.id)+'<br>Version: '+escapeHtml(doc.version)+' · Language: '+escapeHtml(doc.lang||'—')+'<br>Generated: '+escapeHtml(doc.generated_at)+' · Template: '+escapeHtml(doc.template_name||'—')+'</div><pre style="white-space:pre-wrap;background:#f7f7f4;border-radius:8px;padding:12px;font-size:11px;overflow:auto">'+escapeHtml(JSON.stringify(doc.content||{},null,2))+'</pre></div>';
    wrap.querySelector('button').onclick=function(){wrap.remove();};document.body.appendChild(wrap);
  }
  function loadDocuments(agentId){
    if(!enabled())return Promise.resolve([]);return O.get('/v1/agents/'+enc(agentId)+'/documents').then(function(j){state.documents[agentId]=(j&&j.documents)||[];return state.documents[agentId];}).catch(function(e){O.fail('Could not load contract documents',e);throw e;});
  }
  function documentDetail(id){return O.get('/v1/contract-documents/'+enc(id));}
  function openDocuments(agentId,opts){return loadDocuments(agentId).then(function(rows){
    var wanted=opts&&opts.contractId;
    var candidates=wanted?rows.filter(function(x){return x&&x.contract_id===wanted;}):rows;
    if(!candidates.length){alert(wanted?'No document was found for this contract.':'No contract documents have been issued for this agent.');return rows;}
    return documentDetail(candidates[0].id).then(function(doc){showDocument(doc);return rows;});
  });}

  originals.ctOpenAddPromo=window.ctOpenAddPromo;originals.ctSaveAddPromo=window.ctSaveAddPromo;originals.ctVoidContract=window.ctVoidContract;originals.ctRenewActivate=window.ctRenewActivate;originals.ctDocOpen=window.ctDocOpen;originals.ctArtifactsFor=window.ctArtifactsFor;originals.ctArtifactSave=window.ctArtifactSave;originals.ctArtifactPersist=window.ctArtifactsPersist;originals.ctArtifactRemove=window.ctArtifactRemove;originals.ctArtifactReopen=window.ctArtifactReopen;
  wrapTemplateWrites();
  if(typeof originals.ctOpenAddPromo==='function')window.ctOpenAddPromo=function(agentId,editId){if(!enabled())return originals.ctOpenAddPromo.apply(this,arguments);return refreshAgentContracts(agentId).then(function(){return originals.ctOpenAddPromo.call(this,agentId,editId);}.bind(this)).catch(function(e){O.fail('Could not load promotions',e);});};
  if(typeof originals.ctSaveAddPromo==='function')window.ctSaveAddPromo=function(agentId,editId){return enabled()?savePromo(agentId,editId):originals.ctSaveAddPromo.apply(this,arguments);};
  if(typeof originals.ctVoidContract==='function')window.ctVoidContract=function(id,agentId){return enabled()?voidPromo(id,agentId):originals.ctVoidContract.apply(this,arguments);};
  if(typeof originals.ctRenewActivate==='function')window.ctRenewActivate=function(){
    if(!enabled())return originals.ctRenewActivate.apply(this,arguments);var id=typeof _ctRenewAgentId!=='undefined'?_ctRenewAgentId:null,d=typeof _ctRenewDraft!=='undefined'?_ctRenewDraft:null;if(!id||!d)return;
    var body={version:d.newVersion,start:d.newStart,end:d.newEnd,rate_type_id:d.newRateTypeId||null,carry:{programs:!!d.carry.programs,prices:!!d.carry.prices,addons:!!d.carry.addons,booking:!!d.carry.booking,signatory:!!d.carry.signatory,company:!!d.carry.company}};
    return (typeof agRenew==='function'?agRenew(id,body):O.post('/v1/agents/'+enc(id)+'/renew',body)).then(function(){if(typeof ctCloseRenewal==='function')ctCloseRenewal();return loadContracts();}).then(function(){alert('Contract renewal saved on operation-backend.');}).catch(function(e){O.fail('Could not renew contract',e);});
  };
  if(typeof originals.ctDocOpen==='function')window.ctDocOpen=function(agentId,opts){if(!enabled())return originals.ctDocOpen.apply(this,arguments);return openDocuments(agentId,opts);};
  if(typeof originals.ctArtifactsFor==='function')window.ctArtifactsFor=function(agentId){if(!enabled())return originals.ctArtifactsFor.apply(this,arguments);return [];};
  if(typeof originals.ctArtifactSave==='function')window.ctArtifactSave=function(){if(!enabled())return originals.ctArtifactSave.apply(this,arguments);O.fail('Contract document generation is read-only in operations mode',new Error('Legacy artifact upload mapping is blocked'));return null;};
  if(typeof originals.ctArtifactPersist==='function')window.ctArtifactsPersist=function(){if(!enabled())return originals.ctArtifactPersist.apply(this,arguments);};
  if(typeof originals.ctArtifactRemove==='function')window.ctArtifactRemove=function(){if(!enabled())return originals.ctArtifactRemove.apply(this,arguments);O.fail('Contract document history is read-only in operations mode',new Error('Legacy artifact metadata mapping is blocked'));return null;};
  if(typeof originals.ctArtifactReopen==='function')window.ctArtifactReopen=function(){if(!enabled())return originals.ctArtifactReopen.apply(this,arguments);O.fail('Contract artifact reopen is unavailable in operations mode',new Error('Legacy artifact metadata mapping is blocked'));return null;};

  /* §ctplSample · the preview's sample agent and the per-template agent counts.
     The preview draws the contract for cttSampleAgent(), but SB_AGENTS holds the /v1/agents list rows,
     which carry no contract version/dates, company block or programme periods: the cover read
     "Version —", the party box "—", and the programme pages were missing. Fetch that one agent's
     full record (GET /v1/agents/:id), keep it per agent id for the session, and paint again.
     A failed fetch leaves the list row in place (the preview still draws) and warns once.
     An agent object holds the full record when it has its own contractVersion key: the list
     mapping (10-ops-catalogue mapAgentSummary) never sets it, the detail mapping always does. */
  var sample={cache:{},inflight:{},failed:{}}, countsStale=false;
  function hasDetail(a){ return !!a&&Object.prototype.hasOwnProperty.call(a,'contractVersion'); }
  function agentRow(id){ return (typeof SB_AGENTS!=='undefined'&&Array.isArray(SB_AGENTS)?SB_AGENTS:[]).find(function(a){return a&&a.id===id;}); }
  function forgetPainted(){ try{ _cttSig=null; }catch(_){ } }
  function prepSample(){
    var a=typeof cttSampleAgent==='function'?cttSampleAgent():null;
    if(!a||!a.id||hasDetail(a)) return;
    var id=a.id;
    /* a catalogue reload swaps the list rows back in: put the cached record on again */
    if(sample.cache[id]){ Object.assign(a,sample.cache[id]); forgetPainted(); return; }
    if(sample.inflight[id]||sample.failed[id]) return;
    if(typeof window.laOpsAgentMap!=='function'){ sample.failed[id]=true; console.warn('[ops] contract preview: agent mapping unavailable, using the list row for '+id); return; }
    sample.inflight[id]=O.get('/v1/agents/'+enc(id)).then(function(s){
      var full=window.laOpsAgentMap(s); sample.cache[id]=full;
      var cur=agentRow(id); if(cur&&!hasDetail(cur)) Object.assign(cur,full);
      forgetPainted(); redrawTemplates();
    }).catch(function(e){
      sample.failed[id]=true;
      console.warn('[ops] contract preview: could not load agent '+id+', using the list row: '+((e&&e.message)||e));
    }).finally(function(){ delete sample.inflight[id]; });
  }
  /* An agent write can rebind an agent to another template or change the sample's record:
     drop the cached records and refresh the counts the next time the page is on screen. */
  if(typeof O.onWrite==='function') O.onWrite(function(kind){
    var k=String(kind||'');
    if(k==='agents'||/^remote:(agent|contract_template)/.test(k)){ sample.cache={}; sample.failed={}; countsStale=true; }
  });
  /* The agent list (SB_AGENTS) arrives with the boot's catalogue step, usually after the templates:
     fetch the sample's record then, so the page's first paint already has it. */
  if(O.catalogue&&typeof O.catalogue.load==='function'){
    var catalogueLoad=O.catalogue.load;
    O.catalogue.load=function(){
      return Promise.resolve(catalogueLoad.apply(this,arguments)).then(function(r){ try{ if(enabled()) prepSample(); }catch(_){ } return r; });
    };
  }
  originals.renderContractTemplates=window.renderContractTemplates; originals.cttUse=window.cttUse;
  if(typeof originals.renderContractTemplates==='function') window.renderContractTemplates=function(){
    if(!enabled()) return originals.renderContractTemplates.apply(this,arguments);
    var w=document.getElementById('cttv-wrap');
    if(countsStale&&w&&w.offsetWidth>0&&!state.templates.loading){ countsStale=false; loadTemplates(); }
    try{ prepSample(); }catch(_){ }
    return originals.renderContractTemplates.apply(this,arguments);
  };
  /* "N เอเยนต์" per template: legacy counted SB_AGENTS[].contractTemplateId, which the /v1/agents
     list rows don't carry (always 0). The server counts the same thing (every agent bound to the
     template, active or not) and returns it as `agents` on each template. */
  if(typeof originals.cttUse==='function') window.cttUse=function(id){
    if(!enabled()) return originals.cttUse.apply(this,arguments);
    var t=listTemplates()[id]; if(!t) return 0;
    return typeof t.agents==='number'?t.agents:originals.cttUse.apply(this,arguments);
  };

  window.__laOpsContractsCompat={fromServerContract:fromServerContract,toPromoBody:toPromoBody,promoWriteBody:promoWriteBody,fromServerTemplate:fromServerTemplate,templateBody:templateBody,seatPrices:seatPrices};
  window.laOpsContracts={state:state,load:loadContracts,loadTemplates:loadTemplates,loadDocuments:loadDocuments,documents:state.documents,fromServerContract:fromServerContract,toPromoBody:toPromoBody};
  if(enabled()){listContracts().length=0;var tm=listTemplates();Object.keys(tm).forEach(function(k){delete tm[k];});loadContracts();loadTemplates();}
})();
