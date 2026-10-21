/* ══════════════════════════════════════════════════════════════════════════
   §opsAddonServices · Add-on Services ⇄ operation-backend
   ──────────────────────────────────────────────────────────────────────────
   The service catalogue is a durable server resource in operations mode. The
   legacy screen's SB_ADDON_SVCS shape is only a rendering projection:
     server type/description → legacy icon/desc
     server variants       → legacy variants (including prices for round-trip)

   This is deliberately separate from booking-priced add-on types. The latter
   stay on the legacy path until their API mapping is verified.

   GET    /v1/addon-services?active=all
   GET    /v1/addon-services/:id
   POST   /v1/addon-services
   PATCH  /v1/addon-services/:id  (variants replaces the complete list)
   DELETE /v1/addon-services/:id
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O=window.laOps; if(!O) return;
  var legacyRender=window.renderAddonSvc;
  var legacyAdd=window.aosAddService;
  var legacyEdit=window.aosEditService;
  var legacyDelete=window.aosDeleteService;
  var legacyAddVariant=window.aosAddVariant;
  var legacyEditVariant=window.aosEditVariant;
  var legacyDeleteVariant=window.aosDeleteVariant;
  var legacySave=window.aosSaveModal;
  var state={loaded:false,failed:false,loading:null};

  function enabled(){ return O.enabled(); }
  function list(){ return (typeof SB_ADDON_SVCS!=='undefined' && Array.isArray(SB_ADDON_SVCS)) ? SB_ADDON_SVCS : []; }
  function clone(v){ return O.clone ? O.clone(v) : (v==null ? v : JSON.parse(JSON.stringify(v))); }
  function enc(v){ return encodeURIComponent(v); }
  function text(v){ return v==null ? '' : String(v).trim(); }
  function nullable(v){ var s=text(v); return s ? s : null; }
  function price(v){ return v===null || v===undefined || v==='' ? null : Number(v); }
  function iconType(v){ return ['boat','van','guide','other'].indexOf(v)>=0 ? v : 'other'; }

  /* operation-backend service → the legacy Add-on Services renderer shape. */
  function fromServer(s){
    s=s||{};
    return {
      id:s.id, name:s.name||'', icon:iconType(s.type), desc:s.description||'',
      active:s.active!==false, sort:s.sort==null ? null : s.sort,
      created_at:s.created_at, updated_at:s.updated_at,
      variants:(Array.isArray(s.variants)?s.variants:[]).map(function(v){ return {
        id:v.id, name:v.name||'', unit:v.unit==null ? '' : v.unit,
        selling:price(v.selling), net:price(v.net)
      }; })
    };
  }
  function variantBody(v){
    var out={};
    if(v && v.id) out.id=String(v.id);
    out.name=text(v&&v.name);
    out.unit=nullable(v&&v.unit);
    out.selling=price(v&&v.selling);
    out.net=price(v&&v.net);
    return out;
  }
  function variantsBody(rows){ return (Array.isArray(rows)?rows:[]).map(variantBody); }
  function serviceFields(d){
    var body={name:text(d&&d.name),type:iconType(d&&d.icon),description:nullable(d&&d.desc)};
    if(d && typeof d.active==='boolean') body.active=d.active;
    if(d && (typeof d.sort==='number' || d.sort===null)) body.sort=d.sort;
    return body;
  }
  function createBody(d){
    var body=serviceFields(d); body.variants=variantsBody(d&&d.variants); return body;
  }
  function patchBody(d){ return serviceFields(d); }
  function variantsPatch(rows){ return {variants:variantsBody(rows)}; }

  function replaceAll(rows){
    var target=list(), mapped=(rows||[]).map(fromServer);
    target.length=0; Array.prototype.push.apply(target,mapped); return mapped;
  }
  function replaceOne(row){
    var mapped=fromServer(row), target=list(), i=target.findIndex(function(x){ return x&&x.id===mapped.id; });
    if(i<0) target.push(mapped); else target[i]=mapped;
    return mapped;
  }
  function removeOne(id){
    var target=list(), i=target.findIndex(function(x){ return x&&x.id===id; });
    if(i>=0) target.splice(i,1);
  }
  function redraw(){
    if(O.busy && O.busy()) return;
    try{
      var el=document.querySelector('.nav-item.active[data-view]');
      if(el && el.dataset.view==='addonsvc' && typeof legacyRender==='function') legacyRender();
    }catch(_){ }
  }
  function notReady(){
    O.fail('Add-on Services are not ready',new Error(state.failed ? 'The server catalogue failed to load; reload before editing' : 'The server catalogue is still loading'));
  }
  function load(){
    if(!enabled()) return Promise.resolve(false);
    if(state.loading) return state.loading;
    state.loading=O.get('/v1/addon-services',{active:'all'}).then(function(result){
      replaceAll(result && result.addon_services);
      state.loaded=true; state.failed=false; redraw(); return true;
    }).catch(function(error){
      state.loaded=false; state.failed=true; replaceAll([]);
      O.fail('Could not load Add-on Services',error); redraw(); return false;
    }).finally(function(){ state.loading=null; });
    return state.loading;
  }
  function ready(){ return state.loaded ? Promise.resolve(true) : load(); }
  function write(method,path,body){ return O.queue(function(){ return O.call(method,path,body); }); }
  function canWrite(){ return enabled() && state.loaded; }
  function fail(title,error){ O.fail(title,error); return null; }
  function service(id){ return list().find(function(s){ return s&&s.id===id; }); }
  function finish(row,kind){ replaceOne(row); if(O.wrote) O.wrote(kind); redraw(); return row; }

  /* Keep the legacy list renderer, but never let a local seed appear as an
     operations-mode server result while the authoritative request is pending. */
  if(enabled()) replaceAll([]);
  if(typeof legacyRender==='function'){
    window.renderAddonSvc=function(){
      if(!enabled()) return legacyRender.apply(this,arguments);
      if(!state.loaded){ if(!state.loading){ replaceAll([]); load(); } return; }
      return legacyRender.apply(this,arguments);
    };
  }

  function guard(original){
    if(!enabled()) return original && original.apply(this,Array.prototype.slice.call(arguments,1));
    if(!canWrite()){ notReady(); return; }
  }
  function addService(){
    if(!enabled()) return legacyAdd && legacyAdd.apply(this,arguments);
    if(!canWrite()){ notReady(); return; }
    return legacyAdd && legacyAdd.apply(this,arguments);
  }
  function editService(id){
    if(!enabled()) return legacyEdit && legacyEdit.apply(this,arguments);
    if(!canWrite()){ notReady(); return; }
    return legacyEdit && legacyEdit.apply(this,arguments);
  }
  function addVariant(id){
    if(!enabled()) return legacyAddVariant && legacyAddVariant.apply(this,arguments);
    if(!canWrite()){ notReady(); return; }
    return legacyAddVariant && legacyAddVariant.apply(this,arguments);
  }
  function editVariant(id,varId){
    if(!enabled()) return legacyEditVariant && legacyEditVariant.apply(this,arguments);
    if(!canWrite()){ notReady(); return; }
    return legacyEditVariant && legacyEditVariant.apply(this,arguments);
  }

  function deleteService(id){
    if(!enabled()) return legacyDelete && legacyDelete.apply(this,arguments);
    if(!canWrite()){ notReady(); return; }
    var current=service(id); if(!current) return;
    if(!confirm('Delete add-on service "'+current.name+'"?')) return;
    return write('DELETE','/v1/addon-services/'+enc(id)).then(function(){
      removeOne(id); if(O.wrote) O.wrote('addon-service-delete'); redraw();
    }).catch(function(error){ return fail('Could not delete Add-on Service',error); });
  }

  function deleteVariant(id,varId){
    if(!enabled()) return legacyDeleteVariant && legacyDeleteVariant.apply(this,arguments);
    if(!canWrite()){ notReady(); return; }
    var current=service(id); if(!current) return;
    var v=(current.variants||[]).find(function(x){ return x&&x.id===varId; }); if(!v) return;
    if(!confirm('Delete variant "'+v.name+'"?')) return;
    var next=(current.variants||[]).filter(function(x){ return x.id!==varId; });
    return write('PATCH','/v1/addon-services/'+enc(id),variantsPatch(next)).then(function(row){
      finish(row,'addon-service-variant-delete');
    }).catch(function(error){ return fail('Could not delete Add-on Service variant',error); });
  }

  function saveModal(){
    if(!enabled()) return legacySave && legacySave.apply(this,arguments);
    if(!canWrite()){ notReady(); return; }
    var type=typeof _aosModalType!=='undefined' ? _aosModalType : null;
    var id=typeof _aosModalSvcId!=='undefined' ? _aosModalSvcId : null;
    var draft=typeof _aosModalDraft!=='undefined' ? _aosModalDraft : null;
    if(!draft) return;
    if(!text(draft.name)){ alert('Please enter a service or variant name'); return; }
    var path,body,isNew=false;
    if(type==='service'){
      isNew=!id; path=isNew ? '/v1/addon-services' : '/v1/addon-services/'+enc(id);
      body=isNew ? createBody(draft) : patchBody(draft);
    }else if(type==='variant'){
      var current=service(id); if(!current) return;
      var varId=typeof _aosModalVarId!=='undefined' ? _aosModalVarId : null;
      var next=(current.variants||[]).map(function(v){ return clone(v); });
      var row=variantBody(draft), at=next.findIndex(function(v){ return v.id===varId; });
      if(at<0) next.push(row); else next[at]=row;
      path='/v1/addon-services/'+enc(id); body=variantsPatch(next);
    }else return;
    return write(isNew?'POST':'PATCH',path,body).then(function(server){
      finish(server,isNew?'addon-service-create':(type==='variant'?'addon-service-variant-save':'addon-service-save'));
      if(typeof window.aosCloseModal==='function') window.aosCloseModal();
    }).catch(function(error){ return fail(type==='variant' ? 'Could not save Add-on Service variant' : 'Could not save Add-on Service',error); });
  }

  function wrap(name,fn){
    if(typeof window[name]!=='function') return;
    var w=fn; w.__opsAddonServices=true; window[name]=w;
  }
  wrap('aosAddService',addService);
  wrap('aosEditService',editService);
  wrap('aosDeleteService',deleteService);
  wrap('aosAddVariant',addVariant);
  wrap('aosEditVariant',editVariant);
  wrap('aosDeleteVariant',deleteVariant);
  wrap('aosSaveModal',saveModal);

  /* ── an agent's Additional Services (legacy agpAddon*, agent.addonServices) ⇄ /v1/agents/{id}/addon-services ──
     The agent takes a service from the catalogue and states its own Selling / Net per variant. Legacy kept it on the agent object only (lost on
     reload). Server first: the answer is the agent's whole list, which replaces the local one; a refusal leaves the screen as it was.
       agpAddonAddService  PUT .../{service_id} with no body  (every variant at 0; the legacy function then opens the price modal)
       agpAddonSaveVariants PUT .../{service_id} {variants:[{variant_id,selling,net}]}
       agpAddonRemove       DELETE .../{service_id}  (after legacy's own confirm) */
  function agentOf(id){ return typeof sbGetAgent==='function' ? sbGetAgent(id) : null; }
  function agentListFrom(rows){
    return (rows||[]).map(function(s){ return {svcId:s.service_id, variants:(s.variants||[]).map(function(v){ return {varId:v.variant_id, selling:v.selling||0, net:v.net||0}; })}; });
  }
  function agentPath(agentId,svcId){ return '/v1/agents/'+enc(agentId)+'/addon-services/'+enc(svcId); }
  var legacyAgentAdd=window.agpAddonAddService, legacyAgentSave=window.agpAddonSaveVariants, legacyAgentRemove=window.agpAddonRemove;
  function agentRedraw(agentId){ try{ if(typeof window.agRenderDetail==='function') window.agRenderDetail(agentId); }catch(_){ } }
  if(typeof legacyAgentAdd==='function') window.agpAddonAddService=function(svcId){
    if(!enabled()) return legacyAgentAdd.apply(this,arguments);
    var self=this, args=arguments, a=agentOf(_agpAddonAgentId);
    if(!a) return undefined;
    return write('PUT',agentPath(a.id,svcId),{}).then(function(res){
      // the server holds the service now; the legacy function adds the same zero-priced entry itself and opens the price modal
      a.addonServices=agentListFrom(res && res.addon_services).filter(function(p){ return p.svcId!==svcId; });
      if(O.wrote) O.wrote('agent-addon-service');
      return legacyAgentAdd.apply(self,args);
    }).catch(function(error){ return fail('Could not add the service to the contract',error); });
  };
  if(typeof legacyAgentSave==='function') window.agpAddonSaveVariants=function(){
    if(!enabled()) return legacyAgentSave.apply(this,arguments);
    var a=agentOf(_agpAddonAgentId), svcId=_agpAddonEditSvcId, draft=_agpAddonDraft;
    if(!a || !svcId || !draft){ if(typeof window.agpAddonCloseModal==='function') window.agpAddonCloseModal(); return undefined; }
    var variants=(draft.variants||[]).map(function(v){ return {variant_id:v.varId, selling:Number(v.selling)||0, net:Number(v.net)||0}; });
    return write('PUT',agentPath(a.id,svcId),{variants:variants}).then(function(res){
      a.addonServices=agentListFrom(res && res.addon_services);
      if(O.wrote) O.wrote('agent-addon-service');
      if(typeof window.agpAddonCloseModal==='function') window.agpAddonCloseModal();
      agentRedraw(a.id);
    }).catch(function(error){ return fail('Could not save the service prices',error); });   // the modal stays open with what was typed
  };
  if(typeof legacyAgentRemove==='function') window.agpAddonRemove=function(agentId,svcId){
    if(!enabled()) return legacyAgentRemove.apply(this,arguments);
    var a=agentOf(agentId); if(!a) return undefined;
    var svc=list().find(function(s){ return s && s.id===svcId; });
    if(!confirm('ลบ "'+((svc&&svc.name)||'Service นี้')+'" ออกจากสัญญา ?')) return undefined;
    return write('DELETE',agentPath(agentId,svcId)).then(function(){
      a.addonServices=(a.addonServices||[]).filter(function(p){ return p.svcId!==svcId; });
      if(O.wrote) O.wrote('agent-addon-service');
      agentRedraw(agentId);
    }).catch(function(error){ return fail('Could not remove the service from the contract',error); });
  };

  window.__laOpsAddonServiceCompat={
    fromServer:fromServer, toCreateBody:createBody, toPatch:patchBody,
    variantsPatch:variantsPatch, variantBody:variantBody
  };
  O.addonServices={load:load,ready:ready,refresh:load,state:state,fromServer:fromServer};

  if(enabled()) load();
})();
