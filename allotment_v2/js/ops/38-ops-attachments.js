/* Operation-backend attachment transport. Legacy callers keep their /api/attach behaviour. */
(function(){
  'use strict';
  var O=window.laOps; if(!O) return;
  var originalFetch=window.fetch;
  function on(){ return O.enabled && O.enabled(); }
  function path(id){ return '/v1/attachments/'+encodeURIComponent(id); }
  function legacyPath(id){ return '/api/attach/'+encodeURIComponent(id); }
  function json(r){ return r.text().then(function(t){ var j=null; try{ j=t?JSON.parse(t):null; }catch(_){} if(!r.ok){ var e=new Error((j&& (j.message||j.error))||('HTTP '+r.status)); e.status=r.status; e.body=j; throw e; } return j; }); }
  /* Legacy callers do r.json() then test j.error. The server answers {statusCode,message} on a
     refusal and an empty 204 on delete, so translate both to the legacy shape. */
  function legacyReply(r){
    return r.text().then(function(t){
      var j=null; try{ j=t?JSON.parse(t):null; }catch(_){}
      if(!r.ok){ j={error:(j&&(j.message||j.error))||('HTTP '+r.status), code:(j&&j.code)||null}; return new Response(JSON.stringify(j),{status:r.status,headers:{'Content-Type':'application/json'}}); }
      if(!j) j={ok:true};
      if(j.name&&!j.filename) j.filename=j.name;
      return new Response(JSON.stringify(j),{status:200,headers:{'Content-Type':'application/json'}});
    });
  }
  /* Compatibility only for any unconverted extension callers: route that legacy
     transport in ops mode; all other fetches, including /api/mailimg, are untouched. */
  window.fetch=function(input, opts){
    if(!on() || typeof input!=='string' || input.indexOf('/api/attach')!==0) return originalFetch.apply(this,arguments);
    var m=(opts&&opts.method||'GET').toUpperCase(), id=input.slice('/api/attach/'.length).split('?')[0]; try{ id=decodeURIComponent(id); }catch(_){}
    if(m==='POST'){
      var body={}; try{ body=JSON.parse((opts&&opts.body)||'{}'); }catch(_){}
      return window.laOpsFetch('/v1/attachments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({filename:body.filename,mime:body.mime,data_b64:body.dataB64})}).then(legacyReply);
    }
    if(m==='DELETE') return window.laOpsFetch(path(id),{method:'DELETE'}).then(legacyReply);
    return window.laOpsFetch(path(id),opts);
  };
  function upload(file){
    var body={ filename:file && file.filename, mime:file && file.mime, data_b64:file && (file.data_b64 || file.dataB64) };
    if(on()) return window.laOpsFetch('/v1/attachments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(json).then(function(meta){ if(meta&&meta.name&&!meta.filename) meta.filename=meta.name; return meta; });
    return originalFetch('/api/attach',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({bookingId:file&&file.bookingId,filename:body.filename,mime:body.mime,dataB64:body.data_b64})}).then(json);
  }
  function remove(id){
    if(on()) return window.laOpsFetch(path(id),{method:'DELETE'}).then(function(r){ if(!r.ok) return json(r); return null; });
    return originalFetch(legacyPath(id),{method:'DELETE'}).then(function(r){ if(!r.ok) return json(r); return null; });
  }
  function blob(id){
    if(!on()) return originalFetch(legacyPath(id)).then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.blob(); });
    return window.laOpsFetch(path(id)).then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.blob(); });
  }
  /* Browser URL consumers cannot carry the Bearer header. Mark them with this
     attribute and the observer below replaces a harmless placeholder with a blob URL. */
  function viewAttr(id){ return on() ? 'data-la-attachment-id="'+String(id).replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'"' : ''; }
  var blank='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
  function viewUrl(id){ return on() ? 'about:blank#la-attachment-'+encodeURIComponent(id) : legacyPath(id); }
  function hydrate(el){
    var id=el&&el.getAttribute&&el.getAttribute('data-la-attachment-id'); if(!id||el.dataset.laAttachmentLoading) return;
    el.dataset.laAttachmentLoading='1';
    blob(id).then(function(b){ var u=URL.createObjectURL(b); if(el.tagName==='IMG'||el.tagName==='IFRAME') el.src=u; else el.href=u; el.dataset.laAttachmentUrl=u; },function(e){ try{ console.warn('[ops] attachment '+id+' could not be shown: '+e.message); }catch(_){} });
  }
  function legacyView(el){
    if(!on() || !el || !el.getAttribute) return;
    var raw=el.getAttribute('src')||el.getAttribute('href')||'';
    var m=/^\/api\/attach\/([^?#]+)/.exec(raw) || /#la-attachment-([^?#]+)/.exec(raw); if(!m) return;
    el.setAttribute('data-la-attachment-id',decodeURIComponent(m[1]));
    if(el.hasAttribute('src')) el.setAttribute('src',el.tagName==='IFRAME'?'about:blank':blank); else el.setAttribute('href',blank);
    hydrate(el);
  }
  function scan(root){
    if(!root) return;
    if(root.nodeType===1){ legacyView(root); if(root.hasAttribute&&root.hasAttribute('data-la-attachment-id')) hydrate(root); }
    if(root.querySelectorAll){
      Array.prototype.forEach.call(root.querySelectorAll('img[src^="/api/attach/"],iframe[src^="/api/attach/"],a[href^="/api/attach/"],img[src*="#la-attachment-"],iframe[src*="#la-attachment-"],a[href*="#la-attachment-"]'),legacyView);
      Array.prototype.forEach.call(root.querySelectorAll('[data-la-attachment-id]'),hydrate);
    }
  }
  function observe(){ scan(document); new MutationObserver(function(ms){ ms.forEach(function(m){ Array.prototype.forEach.call(m.addedNodes,scan); }); }).observe(document.documentElement,{childList:true,subtree:true}); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',observe); else observe();

  /* ---- Print windows, OCR and project documents ------------------------------------
     Print sheets write HTML into a new window with /api/attach/<id> URLs, and Tesseract
     fetches such a URL itself; neither can send the Bearer header.  Fetch the bytes
     first and hand over blob URLs. */
  var ATTACH_RE=/(?:\/api\/attach\/|#la-attachment-)([A-Za-z0-9_.~%\-]+)/g;
  function idsIn(html){ var out=[],m; ATTACH_RE.lastIndex=0; while((m=ATTACH_RE.exec(String(html)))){ var id=decodeURIComponent(m[1]); if(out.indexOf(id)<0) out.push(id); } return out; }
  function rewriteHtml(html,urls){ return String(html).replace(ATTACH_RE,function(all,enc){ var id=decodeURIComponent(enc); return urls[id]||blank; }); }
  function blobUrls(ids){
    var urls={};
    return Promise.all(ids.map(function(id){ return blob(id).then(function(b){ urls[id]=URL.createObjectURL(b); },function(){}); })).then(function(){ return urls; });
  }
  function wrapGlobal(name,make){
    var orig=window[name]; if(typeof orig!=='function'||orig.__laAttach) return;
    var w=make(orig); w.__laAttach=true; window[name]=w;
  }
  /* The legacy print functions call window.open('','_blank') and document.write() synchronously.
     While one runs, hand it a stand-in window that rewrites the attachment URLs, then writes to the real one. */
  function withStandIn(orig,self,args){
    var realOpen=window.open;
    window.open=function(u){
      var real=realOpen.apply(window,arguments);
      if((u!==''&&u!=null)||!real) return real;
      var buf='', done;
      return { __laReal:real, __laReady:new Promise(function(r){ done=r; }), closed:false,
        focus:function(){ try{real.focus();}catch(_){} }, print:function(){ try{real.print();}catch(_){} },
        document:{ write:function(h){ buf+=h; }, close:function(){
          blobUrls(idsIn(buf)).then(function(urls){ real.document.write(rewriteHtml(buf,urls)); real.document.close(); done(real); });
        } } };
    };
    try{ return orig.apply(self,args); } finally{ window.open=realOpen; }
  }
  function installPrint(){
    ['pfmPrintReport','tsPrintSheet','docCheckPrintPack'].forEach(function(n){
      wrapGlobal(n,function(orig){ return function(){ return on()?withStandIn(orig,this,arguments):orig.apply(this,arguments); }; });
    });
    wrapGlobal('_docPackDrive',function(orig){ return function(w){
      if(w&&w.__laReal){ var self=this; return w.__laReady.then(function(real){ return orig.call(self,real); }); }
      return orig.apply(this,arguments);
    }; });
    wrapGlobal('_docOcrGetWorker',function(orig){ return function(){
      var p=orig.apply(this,arguments); if(!on()) return p;
      return p.then(function(wk){
        if(!wk||wk.__laProxy) return wk;
        var px=Object.create(wk); px.__laProxy=true;
        px.recognize=function(img){
          var m=typeof img==='string'&&(/^(?:\/api\/attach\/|about:blank#la-attachment-)([^?#]+)/.exec(img)), args=arguments;
          if(!m) return wk.recognize.apply(wk,args);
          return blob(decodeURIComponent(m[1])).then(function(b){ var u=URL.createObjectURL(b);
            var rest=[].slice.call(args,1);
            return wk.recognize.apply(wk,[u].concat(rest)).then(function(r){ URL.revokeObjectURL(u); return r; },function(e){ URL.revokeObjectURL(u); throw e; }); });
        };
        return px;
      });
    }; });
  }
  /* Fleet project documents: upload the file (shim above), then name it to the server. */
  function installFleetDocs(){
    var F=O.fleetDaily; if(!F||!F.projectDoc) return;
    function fail(t){ return function(e){ O.fail(t,e); return null; }; }
    function chain(){ var p=Promise.resolve(); return { add:function(fn){ p=p.then(fn); return p; } }; }
    wrapGlobal('flProjAddPhoto',function(orig){ return function(projId){
      if(!on()) return orig.apply(this,arguments);
      _flProjPickFiles('image/*',true,function(files){
        var c=chain();
        _flProjUploadAll(files,projId,function(meta){ c.add(function(){ return F.projectDoc('POST',projId,'',{attachment_id:meta.id,name:meta.name,type:'photo'}); }).catch(fail('Photo was not added')); },function(){});
      });
    }; });
    wrapGlobal('flProjAttachDoc',function(orig){ return function(projId){
      if(!on()) return orig.apply(this,arguments);
      var nameEl=document.getElementById('proj-doc-name-'+projId), noteEl=document.getElementById('proj-doc-note-'+projId);
      var typed=(nameEl&&nameEl.value.trim())||'', note=(noteEl&&noteEl.value.trim())||'';
      _flProjPickFiles('',true,function(files){
        var c=chain();
        _flProjUploadAll(files,projId,function(meta,f){
          var b={attachment_id:meta.id,name:(files.length===1&&typed)?typed:(meta.name||f.name||'file')}; if(note) b.note=note;
          c.add(function(){ return F.projectDoc('POST',projId,'',b); }).catch(fail('Document was not added'));
        },function(n){ if(n){ if(nameEl) nameEl.value=''; if(noteEl) noteEl.value=''; } });
      });
    }; });
    wrapGlobal('flProjAttachToDoc',function(orig){ return function(projId,docId){
      if(!on()) return orig.apply(this,arguments);
      _flProjPickFiles('',false,function(files){
        var c=chain();
        _flProjUploadAll(files,projId,function(meta){ c.add(function(){ return F.projectDoc('PATCH',projId,docId,{attachment_id:meta.id}); }).catch(fail('File was not attached')); },function(){});
      });
    }; });
    wrapGlobal('flProjAddPhotoUrl',function(orig){ return function(projId){
      if(!on()) return orig.apply(this,arguments);
      var url=prompt('Image URL (paste a link):',''); if(!url) return;
      var cap=prompt('Caption (optional):','')||'', b={type:'photo',url:url.trim()}; if(cap){ b.name=cap; b.note=cap; }
      return F.projectDoc('POST',projId,'',b).catch(fail('Photo was not added'));
    }; });
    wrapGlobal('flProjAddDocRecord',function(orig){ return function(projId,name,url,note){
      if(!on()) return orig.apply(this,arguments);
      var b={name:name}; if(url) b.url=url; if(note) b.note=note;
      return F.projectDoc('POST',projId,'',b).catch(fail('Document was not added'));
    }; });
    wrapGlobal('flProjUpdateDocStatus',function(orig){ return function(projId,docId,status){
      if(!on()) return orig.apply(this,arguments);
      return F.projectDoc('PATCH',projId,docId,{status:status}).catch(fail('Document status was not changed'));
    }; });
    wrapGlobal('flProjDeleteDoc',function(orig){ return function(projId,docId){
      if(!on()) return orig.apply(this,arguments);
      if(!confirm('Delete this document?')) return;
      return F.projectDoc('DELETE',projId,docId).catch(fail('Document was not deleted'));
    }; });
  }
  /* Payment slips on an already-recorded invoice/PFM payment (POST/DELETE
     /v1/invoices/:id/payments/:pid/slips). The slip list on screen is derived from the
     invoice's live payments; nothing is written to bk.paymentSlips for persistence. */
  function slipInvoice(bkId){ return typeof window.acctBookingInvoice==='function' ? window.acctBookingInvoice(bkId) : null; }
  function livePayments(inv){ return ((inv&&inv.payments)||[]).filter(function(p){ return p&&!p.deletedAt; }); }
  function slipTarget(inv){ var l=livePayments(inv), cash=l.filter(function(p){ return p.method!=='credit'; }); return (cash.length?cash:l).slice(-1)[0]||null; }
  function syncSlipView(bkId){
    var b=(typeof SB_BOOKINGS!=='undefined'?SB_BOOKINGS:[]).find(function(x){ return x&&x.id===bkId; }), inv=slipInvoice(bkId); if(!b) return;
    var out=[]; livePayments(inv).forEach(function(p){ (p.slips||[]).forEach(function(s){ if(s&&s.id) out.push({id:s.id,name:s.name,mime:s.mime,size:s.size,kind:'payment',amount:p.amount,at:p.recordedAt,by:p.recordedBy,paymentId:p.id}); }); });
    b.paymentSlips=out;
  }
  function rerenderSlips(bkId){ syncSlipView(bkId); if(typeof window.pfmSlipsRender==='function') window.pfmSlipsRender(); }
  wrapGlobal('pfmViewSlips',function(orig){ return function(bkId){ if(on()) syncSlipView(bkId); return orig.apply(this,arguments); }; });
  function attachSlip(bkId, blobData, mime, name){
    var M=O.money, inv=slipInvoice(bkId), pay=slipTarget(inv);
    if(!M||!M.addPaymentSlips){ alert('Payment slips are unavailable'); return; }
    if(!inv||!pay){ alert('Record a payment before adding a slip.'); return; }
    var fr=new FileReader();
    fr.onload=function(){
      var b64=String(fr.result).split(',')[1]||'';
      upload({filename:name,mime:mime,dataB64:b64}).then(function(meta){
        /* Server first: if the attach is refused, the upload must not stay behind. */
        return M.addPaymentSlips(inv.id,pay.id,[meta.id]).then(function(){ rerenderSlips(bkId); },function(){
          return remove(meta.id).then(null,function(){});
        });
      },function(e){ O.fail('Slip upload failed',e); });
    };
    fr.readAsDataURL(blobData);
  }
  wrapGlobal('pfmSlipsAttach',function(orig){ return function(file, kind){
    if(!on()) return orig.apply(this,arguments);
    var bkId=(typeof _pfmSlipBk!=='undefined'?_pfmSlipBk:null); if(!bkId||!file) return;
    var post=function(bl,mime,name){
      if(bl&&bl.size>6*1024*1024){ alert('File "'+name+'" is over 6MB'); return; }
      attachSlip(bkId,bl,mime,name);
    };
    if(/^image\//.test(file.type||'')){
      var dn=(typeof window._bkV2DownscaleImage==='function')?window._bkV2DownscaleImage:function(f,m,cb){ cb(f,f.type); };
      dn(file,1600,function(bl,mi){ if(bl) post(bl,mi,((file.name||'slip').replace(/\.[^.]+$/,''))+'.jpg'); else post(file,file.type,file.name||'slip'); });
    } else post(file,file.type||'application/octet-stream',file.name||'file');
  }; });
  wrapGlobal('pfmSlipDelete',function(orig){ return function(id){
    if(!on()) return orig.apply(this,arguments);
    var bkId=(typeof _pfmSlipBk!=='undefined'?_pfmSlipBk:null); if(!bkId) return;
    var inv=slipInvoice(bkId), pay=livePayments(inv).find(function(p){ return (p.slips||[]).some(function(s){ return s&&s.id===id; }); });
    if(!pay){ alert('This slip is not on an invoice payment, so it cannot be removed here.'); return; }
    if(!confirm('Delete this slip permanently?')) return;
    return O.money.removePaymentSlip(inv.id,pay.id,id).then(function(){
      rerenderSlips(bkId);
      return remove(id).then(null,function(e){ O.fail('Slip file was not deleted',e); });
    },function(){});
  }; });
  installPrint(); installFleetDocs();
  window.laOpsAttachments={ idsIn:idsIn, rewriteHtml:rewriteHtml, legacyReply:legacyReply, upload:upload, remove:remove, blob:blob, viewAttr:viewAttr, viewUrl:viewUrl, scan:scan, responseJson:json };
})();
