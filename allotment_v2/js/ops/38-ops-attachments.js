/* Operation-backend attachment transport. Legacy callers keep their /api/attach behaviour. */
(function(){
  'use strict';
  var O=window.laOps; if(!O) return;
  var originalFetch=window.fetch;
  function on(){ return O.enabled && O.enabled(); }
  function path(id){ return '/v1/attachments/'+encodeURIComponent(id); }
  function json(r){ return r.text().then(function(t){ var j=null; try{ j=t?JSON.parse(t):null; }catch(_){} if(!r.ok){ var e=new Error((j&& (j.message||j.error))||('HTTP '+r.status)); e.status=r.status; e.body=j; throw e; } return j; }); }
  /* Existing screens still call fetch('/api/attach', …).  Route only that legacy
     transport in ops mode; all other fetches, including /api/mailimg, are untouched. */
  window.fetch=function(input, opts){
    if(!on() || typeof input!=='string' || input.indexOf('/api/attach')!==0) return originalFetch.apply(this,arguments);
    var m=(opts&&opts.method||'GET').toUpperCase(), id=input.slice('/api/attach/'.length).split('?')[0];
    if(m==='POST'){
      var body={}; try{ body=JSON.parse((opts&&opts.body)||'{}'); }catch(_){}
      return window.laOpsFetch('/v1/attachments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({filename:body.filename,mime:body.mime,data_b64:body.dataB64})}).then(function(r){
        return r.text().then(function(t){ var j=null; try{ j=t?JSON.parse(t):null; }catch(_){} if(j&&j.name&&!j.filename) j.filename=j.name;
          return new Response(JSON.stringify(j),{status:r.status,statusText:r.statusText,headers:{'Content-Type':'application/json'}}); });
      });
    }
    if(m==='DELETE') return window.laOpsFetch(path(id),{method:'DELETE'});
    return window.laOpsFetch(path(id),opts);
  };
  function blob(id){
    if(!on()) return originalFetch('/api/attach/'+encodeURIComponent(id)).then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.blob(); });
    return window.laOpsFetch(path(id)).then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.blob(); });
  }
  /* Browser URL consumers cannot carry the Bearer header. Mark them with this
     attribute and the observer below replaces a harmless placeholder with a blob URL. */
  function viewAttr(id){ return on() ? 'data-la-attachment-id="'+String(id).replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'"' : ''; }
  var blank='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
  function viewUrl(id){ return on() ? blank : '/api/attach/'+encodeURIComponent(id); }
  function hydrate(el){
    var id=el&&el.getAttribute&&el.getAttribute('data-la-attachment-id'); if(!id||el.dataset.laAttachmentLoading) return;
    el.dataset.laAttachmentLoading='1';
    blob(id).then(function(b){ var u=URL.createObjectURL(b); if(el.tagName==='IMG') el.src=u; else el.href=u; el.dataset.laAttachmentUrl=u; },function(e){ try{ console.warn('[ops] attachment '+id+' could not be shown: '+e.message); }catch(_){} });
  }
  function legacyView(el){
    if(!on() || !el || !el.getAttribute) return;
    var raw=el.getAttribute('src')||el.getAttribute('href')||'';
    var m=/^\/api\/attach\/([^?#]+)/.exec(raw); if(!m) return;
    el.setAttribute('data-la-attachment-id',decodeURIComponent(m[1]));
    if(el.hasAttribute('src')) el.setAttribute('src',blank); else el.setAttribute('href',blank);
    hydrate(el);
  }
  function scan(root){
    if(!root) return;
    if(root.nodeType===1){ legacyView(root); if(root.hasAttribute&&root.hasAttribute('data-la-attachment-id')) hydrate(root); }
    if(root.querySelectorAll){
      Array.prototype.forEach.call(root.querySelectorAll('img[src^="/api/attach/"],iframe[src^="/api/attach/"],a[href^="/api/attach/"]'),legacyView);
      Array.prototype.forEach.call(root.querySelectorAll('[data-la-attachment-id]'),hydrate);
    }
  }
  function observe(){ scan(document); new MutationObserver(function(ms){ ms.forEach(function(m){ Array.prototype.forEach.call(m.addedNodes,scan); }); }).observe(document.documentElement,{childList:true,subtree:true}); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',observe); else observe();
  window.laOpsAttachments={ blob:blob, viewAttr:viewAttr, viewUrl:viewUrl, scan:scan, responseJson:json };
})();
