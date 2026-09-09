
/* ════ LOGIN + CLOUD SYNC (Railway Postgres) ════
   - login gate (/api/me) · data blob in DB with version (optimistic concurrency)
   - auto-load on open · auto-save on change · 409 = blocked + reload (no silent overwrite)
   - degrades to plain localStorage when /api isn't there (e.g. localhost old server). */
(function(){
  var LS='loveandaman_v2', VER=0, _t=null, _conflict=false, ME=null, LASTBY='';
  // Globally-unique id (multi-user safe): millisecond + 5 random base36 chars.
  // Use for EVERY new record's id so concurrent users/tabs never collide (the cloud diff-merge keys by id).
  // Defined BEFORE any early return below — a failed/401 boot used to leave LA_UID undefined and
  // every fleet view crashed with "Can't find variable: LA_UID" (seen on Safari).
  window.LA_UID=function(p){ return (p||'')+Date.now().toString(36)+Math.random().toString(36).slice(2,7); };
  // cache-buster on every GET — iPadOS Safari serves stale cached /api GETs (empty/old data, survives reload)
  function bust(url){ return url+(url.indexOf('?')<0?'?_=':'&_=')+Date.now(); }
  function sx(method,url,body,ct){ var x=new XMLHttpRequest(); try{ x.open(method,method==='GET'?bust(url):url,false); if(ct) x.setRequestHeader('Content-Type',ct); x.send(body!=null?body:null);}catch(e){return{status:0};} var j=null; try{j=JSON.parse(x.responseText);}catch(e){} return {status:x.status,json:j,text:x.responseText}; }
  function fmt(s){ try{ return new Date(s).toLocaleString('th-TH',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}); }catch(e){ return s||''; } }
  /* §laStamp · เวลาที่ข้อมูลอัพเดตล่าสุดเคยอยู่แต่ใน LASTBY ซึ่งเป็นตัวแปรใน IIFE นี้
     หน้าอื่นเลยเอาไปโชว์ไม่ได้ · ปล่อยค่าดิบขึ้น window ไว้ให้หน้าที่อยากบอกความสดของข้อมูล */
  function _laStamp(o){ try{ if(o && o.updated_at){
    window.LA_UPDATED_AT = o.updated_at; window.LA_UPDATED_BY = o.updated_by || ''; } }catch(e){} }

  // sync GET with quick retry — WebKit (Safari iPad/macOS) fails sync XHR where Chrome doesn't;
  // a transient 0/5xx must NOT silently disable cloud sync (that rendered an empty app with no hint)
  // §bootRetry · หน่วงแบบบล็อก · ตรงนี้เป็นด่านบูตที่ยังไงก็ซิงโครนัสอยู่แล้ว
  function _laHold(ms){ var t=Date.now()+ms; while(Date.now()<t){} }
  //   404 = ช่วง deploy ที่ตัวเก่าถูกถอดแล้วตัวใหม่ยังไม่ขึ้น · ต้องลองใหม่ ไม่ใช่ยอมแพ้
  function _laBootRetryable(st){ return st===0 || st===404 || st>=500; }
  function sxr(url){
    var r=sx('GET',url);
    for(var i=0;i<3 && _laBootRetryable(r.status); i++){
      _laHold(i===0?600:1400);   // ตัวใหม่ตั้งตัวเป็นวินาที · ยิงรัวติดกันไม่ช่วยอะไร
      r=sx('GET',url);
    }
    return r;
  }
  function _laLocalHost(){ return /^(localhost|127\.|192\.168\.|10\.|\[::1\])/.test(location.hostname); }
  // full-screen blocking error — replaces the old silent bail so a Safari boot failure is visible + reportable
  function bootFail(stage, status){ onReady(function(){
    if(document.getElementById('la-bootfail')) return;
    var d=document.createElement('div'); d.id='la-bootfail';
    d.style.cssText='position:fixed;inset:0;z-index:100050;background:rgba(14,34,53,.96);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;font:15px/1.5 "DM Sans",sans-serif;text-align:center;padding:20px';
    d.innerHTML='<div style="font-size:34px">📡</div><div><b>เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ</b><br><span style="opacity:.75;font-size:13px">'+stage+' · status '+status+'</span></div><button onclick="location.reload()" style="background:#fff;color:#15396B;border:0;border-radius:10px;padding:10px 22px;font-weight:700;font-size:14px;cursor:pointer;font-family:inherit">ลองใหม่</button>';
    document.body.appendChild(d); }); }

  // 1) AUTH (sync, before app init)
  var me=sxr('/api/me');
  if(me.status===401){ onReady(showLogin); return; }            // not logged in → login screen, do not load/sync
  if(me.status!==200){                                           // backend unreachable
    if(_laLocalHost()) return;                                   // local dev without backend → plain localStorage (intentional)
    try{ console.error('[boot] /api/me failed · status '+me.status+' (retried)'); }catch(e){}
    // §bootRetry · 404 ที่ยังไม่หายหลังลองครบ = ไม่ใช่ช่วง deploy แล้ว · บอกให้ตรงว่าน่าจะเป็นอะไร
    bootFail(me.status===404?'auth /api/me · เซิร์ฟเวอร์อาจกำลังอัปเดต':'auth /api/me', me.status); return; }
  ME=me.json||{}; window.LA_ME=ME;                               // expose current user (edit-lock / audit)
  // §per-user sidebar (accent colour + collapsible groups) · retry until the footer is mounted
  //  (laSbInit ran once but the sidebar footer wasn't stable yet → picker dropped)
  onReady(function(){ var _t=0; (function _go(){ try{ if(typeof laSbInit==='function') laSbInit(); }catch(e){}
    if(!(document.getElementById&&document.getElementById('la-sbcolor-sw')) && _t++<25) setTimeout(_go,180); })(); });

  // ── STATE STORE: in-memory, persisted to SQL (no localStorage blob mirror) ──
  //    The full app state (~6 MB) exceeds the browser localStorage quota (~5 MB); SQL (operation_schemas)
  //    is the store. localStorage now holds only tiny keys (version marker, per-view prefs). The state blob
  //    lives in RAM (_mem) and syncs to SQL via /api/save. A page reload always re-loads from SQL.
  var _mem=null, _syncReady=false;
  // §Safari root cause (2026-07-20): assigning localStorage.setItem=fn does NOT override the method
  // in WebKit — the Storage named-property setter stores the function as a DATA ITEM instead — so this
  // shim was a silent no-op on Safari: every "memory" write of the ~7MB state blob hit real
  // localStorage, threw QuotaExceededError (~5MB quota), and killed this whole boot script
  // (no sync, no saves, stale/empty app). Override on Storage.prototype instead — a plain object,
  // overridable in every engine. Route by `this` so sessionStorage passes through untouched.
  var _SP=Storage.prototype, _oSet=_SP.setItem, _oGet=_SP.getItem, _oDel=_SP.removeItem;
  function _isLS(s){ try{ return s===window.localStorage; }catch(e){ return false; } }
  var _rawSet=function(k,v){ _oSet.call(localStorage,k,v); }, _rawGet=function(k){ return _oGet.call(localStorage,k); }, _rawDel=function(k){ _oDel.call(localStorage,k); };
  function _orig(k,v){ if(k===LS){ _mem=v; } else { _rawSet(k,v); } }   // raw write, NO save trigger (cloud-refresh apply)
  _SP.getItem=function(k){ return (_isLS(this)&&k===LS) ? _mem : _oGet.call(this,k); };
  // §emptyBlobGuard (2026-07-30) · ล้าง blob (เช่นปุ่ม Reset) ต้องยกเลิกการเซฟที่ค้างอยู่ด้วย
  //   เดิม removeItem ตั้ง _mem=null เฉยๆ แล้ว location.reload() → ตอนหน้าปิด _laFlush เห็น _dirty ยังจริง
  //   อ่าน blob ได้ null → cur={} → computeDiff ตีความว่า "ลบข้อมูลทั้งหมด" แล้วยิงขึ้นเซิร์ฟเวอร์แบบ sync
  //   (เจอจริง 30 ก.ค. 2026 · เซิร์ฟเวอร์ตีกลับ trips 94→0 — ถ้าไม่มีตัวกันฝั่งนั้น ข้อมูลหายเกลี้ยง)
  _SP.removeItem=function(k){ if(_isLS(this)&&k===LS){ _mem=null; _dirty=false; try{ clearTimeout(_t); }catch(e){} return; } _oDel.call(this,k); };
  _SP.setItem=function(k,v){ if(!_isLS(this)||k!==LS){ return _oSet.call(this,k,v); } _mem=v;   // state blob → memory only (no quota)
    if(_syncReady && typeof laCanEdit==='function' && laCanEdit()){ _dirty=true; clearTimeout(_t); _t=setTimeout(function(){ save(v); },1000); } };   // view-only users never sync
  // Reclaim quota on devices poisoned by the broken shim: the pre-mem-store ~6MB blob still sitting
  // in real localStorage, the junk 'setItem'/'getItem'/'removeItem' items WebKit created from the old
  // instance assignments, and any oversized _snap_ full copies. All dead weight — SQL is the store.
  try{ _rawDel(LS); _rawDel('setItem'); _rawDel('getItem'); _rawDel('removeItem');
       Object.keys(localStorage).forEach(function(k){ if(k.indexOf(LS+'_snap_')===0) _rawDel(k); }); }catch(e){}

  // 2) LOAD from cloud (sync gate) · BASE = snapshot we loaded (used to diff our changes)
  var BASE={}, _refreshShown=false, _dirty=false, _recoverPush=false;
  function _laMark(v){ try{ localStorage.setItem(LS+'__v', String(v)); }catch(e){} }   // remember which server version the local data is synced to (survives reload)
  // Graft LOCAL-ONLY records (ids the server doesn't have) into the server blob · additive only, never overwrites a server record → no revert
  function _laGraftLocalOnly(srv, loc){ var g=0; Object.keys(loc||{}).forEach(function(k){ var lv=loc[k], sv=srv[k];
    if(Array.isArray(lv) && lv.length && lv.every(function(x){return x&&typeof x==='object'&&x.id!=null;})){
      if(!Array.isArray(sv)){ srv[k]=lv.slice(); g+=lv.length; return; }
      var ids={}; sv.forEach(function(x){ if(x&&x.id!=null) ids[String(x.id)]=1; });
      lv.forEach(function(x){ if(x&&x.id!=null && !ids[String(x.id)]){ sv.push(x); g++; } }); } });
    return g; }
  var _ldT0=Date.now();
  var ld=sx('GET','/api/load');
  /* §bootDiag · จดเวลาและขนาดไว้เสมอ · ปัญหา "ช้าเฉพาะบางช่วงเวลา" ต้องมีตัวเลขถึงจะตามได้
     ข้อมูลทั้งก้อนตอนนี้ ~16 MB (sb_bookings อย่างเดียว ~11 MB) โหลดใหม่ทุกครั้งที่เปิดหน้า */
  try{
    var _ldMs=Date.now()-_ldT0, _ldB=(ld.text?ld.text.length:0);
    console.log('[boot] '+new Date().toISOString()+' load='+ld.status
      +' bytes='+_ldB+' ('+(_ldB/1048576).toFixed(1)+' MB) in '+_ldMs+'ms'
      +(_ldMs>0?(' = '+(_ldB/1048576/(_ldMs/1000)).toFixed(1)+' MB/s'):''));
    window.__laBoot={at:new Date().toISOString(), status:ld.status, bytes:_ldB, ms:_ldMs};
  }catch(e){}
  // Sync load failed (WebKit aborts long-blocking sync XHR on slow links — Chrome doesn't) →
  // switch to ASYNC retry behind a blocking overlay. Overlay stays up until data lands so nobody
  // edits an empty state; on arrival the data is applied in place via the soft-refresh path.
  /* §bootDiag · จอโหลดต้องบอกได้ว่า "ช้า" หรือ "ค้าง"
     ของเดิมขึ้นข้อความเดียวค้างไว้ · คนใช้เห็นแค่นาฬิกาทราย ไม่รู้ว่าเน็ตกำลังไหลอยู่ไหม
     และเราก็ตามไม่ได้ว่าเซิร์ฟเวอร์ตอบอะไร ตอนไหน โหลดไปได้เท่าไร
     ตอนนี้: โชว์ไบต์ที่ได้ · เวลาที่ใช้ · ความเร็ว · รหัสสถานะ พร้อมปุ่มคัดลอกให้ส่งต่อได้
     และใส่ timeout 90 วิ — ของเดิมถ้าคำขอค้างไม่ตอบเลย จะไม่มีอะไรมาปลุกให้ลองใหม่ */
  function _laAsyncLoad(st){
    try{ console.warn('[boot] sync /api/load failed (status '+st+') → async retry @'+new Date().toISOString()); }catch(e){}
    var T0=Date.now(), tries=0, log=['sync /api/load = '+st+' @'+new Date().toISOString()];
    var MB=function(b){ return (b/1048576).toFixed(1); };
    var el=function(id){ return document.getElementById(id); };
    var say=function(html){ var d=el('la-bootload-st'); if(d) d.innerHTML=html; };
    window._laBootCopy=function(){
      var t=log.join('\n')+'\nUA: '+navigator.userAgent;
      try{ if(navigator.clipboard) navigator.clipboard.writeText(t); else { var a=document.createElement('textarea');
        a.value=t; document.body.appendChild(a); a.select(); document.execCommand('copy'); document.body.removeChild(a); } }catch(e){}
      var b=el('la-bootcopy'); if(b){ b.textContent='คัดลอกแล้ว'; setTimeout(function(){ b.textContent='คัดลอกรายละเอียด'; },1500); }
    };
    onReady(function(){ if(el('la-bootload')) return;
      var ov=document.createElement('div'); ov.id='la-bootload';
      ov.style.cssText='position:fixed;inset:0;z-index:100050;background:rgba(14,34,53,.93);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;font:15px/1.5 "DM Sans",sans-serif;text-align:center;padding:20px';
      ov.innerHTML='<div style="font-size:34px">&#8987;</div>'
        +'<div><b>กำลังโหลดข้อมูลจากเซิร์ฟเวอร์…</b><br>'
        +'<span id="la-bootload-st" style="opacity:.8;font-size:13px">กำลังเริ่ม…</span></div>'
        +'<button id="la-bootcopy" onclick="_laBootCopy()" style="margin-top:6px;background:rgba(255,255,255,.14);'
        +'color:#fff;border:1px solid rgba(255,255,255,.3);border-radius:9px;padding:5px 13px;font:600 12px inherit;cursor:pointer">'
        +'คัดลอกรายละเอียด</button>';
      document.body.appendChild(ov); });
    (function go(){ tries++;
      var t1=Date.now(), got=0, total=0, tick=null;
      function stop(){ try{ clearInterval(tick); }catch(e){} }
      function fail(why){
        stop();
        var secs=((Date.now()-t1)/1000).toFixed(0);
        log.push('ครั้งที่ '+tries+' ล้ม: '+why+' · ได้ '+MB(got)+' MB ใน '+secs+' วิ');
        try{ console.warn('[boot] load try '+tries+' failed: '+why+' after '+secs+'s, got '+got+' bytes'); }catch(e){}
        say('<b>ครั้งที่ '+tries+' ไม่สำเร็จ</b> · '+why
          +'<br>ได้ข้อมูลมา '+MB(got)+' MB ใน '+secs+' วินาที · รวมแล้ว '+((Date.now()-T0)/1000).toFixed(0)+' วิ'
          +'<br>ลองใหม่ใน 4 วิ…');
        setTimeout(go,4000);
      }
      var x=new XMLHttpRequest(); x.open('GET',bust('/api/load'),true);
      x.timeout=90000;                                    /* ค้างเกินนาทีครึ่ง = ตัดแล้วลองใหม่ ดีกว่าค้างตลอดกาล */
      x.ontimeout=function(){ fail('หมดเวลา 90 วินาที'); };
      if(x.onprogress!==undefined){
        x.onprogress=function(e){ got=e.loaded||0; total=e.total||0; };
      }
      /* เดินนาฬิกาเองทุกครึ่งวิ · จะได้เห็นว่ากำลังไหลอยู่จริงหรือหยุดนิ่ง */
      tick=setInterval(function(){
        var secs=(Date.now()-t1)/1000;
        var sp=secs>0?(got/1048576/secs):0;
        say('ครั้งที่ '+tries+' · ได้ '+MB(got)+(total?(' / '+MB(total)):'')+' MB'
          +' · '+secs.toFixed(0)+' วินาที'+(sp>0.01?(' · '+sp.toFixed(1)+' MB/วิ'):'')
          +(got===0&&secs>8?'<br><span style="color:#FFC9C3">ยังไม่มีข้อมูลเข้ามาเลย — เซิร์ฟเวอร์ยังไม่ตอบ</span>':''));
      },500);
      x.onload=function(){ try{
        stop();
        var secs=((Date.now()-t1)/1000).toFixed(1);
        if(x.status!==200){ fail('เซิร์ฟเวอร์ตอบ '+x.status); return; }
        var j=JSON.parse(x.responseText);
        if(typeof j.data!=='string' || j.data.length<2){ fail('ข้อมูลว่าง'); return; }
        VER=j.version||0; LASTBY=j.updated_by?(j.updated_by+' · '+fmt(j.updated_at)):''; _laStamp(j);
        try{ BASE=JSON.parse(j.data); }catch(e){ BASE={}; }
        _orig(LS, j.data); _laMark(VER);
        _syncReady=true; _dirty=false; try{ clearTimeout(_t); }catch(e){}   // §syncGate · ข้อมูลจริงถึงแล้วค่อยเปิดเซฟ · ทิ้งงานค้างที่เกิดตอน state ยังว่าง
        var ov=el('la-bootload'); if(ov) ov.remove();
        // app already initialized (rendered empty) → re-apply in place; not yet → it reads the fresh blob itself
        if(window._laReloadData){ if(window._laReloadData()){ if(window._laRerender) window._laRerender(); } else { _laReload(); return; } }
        try{ console.log('[boot] async /api/load ok on try '+tries+' ('+j.data.length+' bytes in '+secs+'s)'); }catch(e){}
      }catch(e){ fail(String(e&&e.message||e)); } };
      x.onerror=function(){ fail('เชื่อมต่อไม่ได้'); };
      try{ x.send(); }catch(e){ fail('ส่งคำขอไม่ได้'); }
    })();
  }
  if(ld.status!==200 || !ld.json){ _laAsyncLoad(ld.status); }
  if(ld.status===200 && ld.json){
    VER=ld.json.version||0; LASTBY = ld.json.updated_by? (ld.json.updated_by+' · '+fmt(ld.json.updated_at)) : ''; _laStamp(ld.json);
    var _srvStr=(typeof ld.json.data==='string' && ld.json.data.length>2)?ld.json.data:'';
    var _loc=localStorage.getItem(LS), _locObj=null, _srvObj=null;
    try{ if(_loc && _loc.length>2) _locObj=JSON.parse(_loc); }catch(e){}
    try{ if(_srvStr) _srvObj=JSON.parse(_srvStr); }catch(e){}
    if(_srvObj){
      try{BASE=JSON.parse(_srvStr);}catch(e){BASE={};}                                   // BASE = pure server snapshot → a recover-push diffs against this
      if(_locObj){
        var _lv=parseInt(localStorage.getItem(LS+'__v')||'-1',10);
        var _keepLocal=false;
        if(_lv===VER){ var _d0=computeDiff(_srvObj,_locObj); if(_d0._changed) _keepLocal=true; }   // local was synced to THIS server version → any diff = this user's UNSAVED work → keep it all + push
        if(_keepLocal){ localStorage.setItem(LS, _loc); _recoverPush=true; }
        else { var _g=_laGraftLocalOnly(_srvObj, _locObj);                                          // server moved ahead → adopt server, but RESCUE local-only new records (e.g. just-created bookings not yet saved)
               if(_g>0){ localStorage.setItem(LS, JSON.stringify(_srvObj)); _recoverPush=true; }
               else { localStorage.setItem(LS, _srvStr); } }
      } else { localStorage.setItem(LS, _srvStr); }
      _laMark(VER);
    } else { if(_loc && _loc.length>2) seedFull(_loc); }
  }

  // 3) AUTO-SAVE on change (debounced) · per-entity REST writes (setItem shimmed to memory+save above).
  //    The record-level diff is translated into /api/v1 ops (put / per-field patch / del per record) and
  //    sent as ONE transactional batch — the server writes only those records' rows, not the whole dataset.
  //    A key the REST index doesn't know (mapping drift) falls back to the legacy whole-diff /api/save.
  // §syncGate (2026-07-30) · เปิด auto-save ได้ก็ต่อเมื่อ "ได้ข้อมูลจริงจากเซิร์ฟเวอร์แล้ว" เท่านั้น
  //   เดิมบรรทัดนี้เป็น _syncReady=true เสมอ แม้ /api/load จะล้มเหลว (502) และกำลัง retry แบบ async อยู่
  //   ช่วงนั้น _mem ยังว่าง แต่ flLoad() เห็น state ว่างแล้วเข้าโหมด "First-time" → seed อาร์เรย์เปล่า
  //   แล้วเขียน blob → setItem → debounce 1 วิ → save() ยิงขึ้นเซิร์ฟเวอร์ = ลบข้อมูลจริงทั้งหมด
  //   (เจอจริง 30 ก.ค. 2026 14:14 · /api/load 502 · เซิร์ฟเวอร์ตีกลับ trips 94→0 · ข้อมูลจริงมาถึงตอน 14:14:16
  //    หน้าต่างอันตราย 4 วินาที แล้วหายเอง — เลยดูเหมือน "แปปเดียว")
  //   ไม่ได้ข้อมูล = ไม่มีสิทธิ์เขียนทับของบนเซิร์ฟเวอร์ · overlay บังจออยู่แล้ว ผู้ใช้แก้อะไรไม่ได้ระหว่างนี้
  _syncReady = (ld.status===200 && !!ld.json);
  var REST_RESOURCES=null;                                              // {entity: 'array'|'map'} from GET /api/v1
  (function(){ var ri=sx('GET','/api/v1'); if(ri.status===200&&ri.json&&ri.json.resources) REST_RESOURCES=ri.json.resources; })();
  function laDiffToOps(d, cur){
    if(!REST_RESOURCES) return null;
    var ops=[], ok=true;
    Object.keys(d.cols||{}).forEach(function(k){ if(!ok) return; var c=d.cols[k];
      if(!REST_RESOURCES[k]){ ok=false; return; }
      var curMap={}; (Array.isArray(cur[k])?cur[k]:[]).forEach(function(x){ if(x&&x.id!=null) curMap[String(x.id)]=x; });
      (c.up||[]).forEach(function(rec){ ops.push({op:'put', r:k, id:String(rec.id), body:rec}); });
      (c.patch||[]).forEach(function(pr){ var full=curMap[String(pr.id)]||null;   // per-FIELD patch: server merges onto its CURRENT record → concurrent edits to different fields both survive (full = fallback if the record vanished server-side)
        ops.push({op:'patch', r:k, id:String(pr.id), body:{m:pr.m, full:full}}); });
      (c.del||[]).forEach(function(id){ ops.push({op:'del', r:k, id:String(id)}); }); });
    Object.keys(d.objs||{}).forEach(function(k){ if(!ok) return; var o=d.objs[k];
      if(!REST_RESOURCES[k]){ ok=false; return; }
      Object.keys(o.p||{}).forEach(function(sub){ var v=(cur[k]||{})[sub]; if(v===undefined){ ok=false; return; } ops.push({op:'put', r:k, id:sub, body:v}); });
      (o.d||[]).forEach(function(sub){ ops.push({op:'del', r:k, id:sub}); }); });
    Object.keys(d.sets||{}).forEach(function(k){ if(!ok) return; var v=d.sets[k];
      if(REST_RESOURCES[k]) ops.push({op:'putall', r:k, body:v});
      else ops.push({op:'meta', id:k, body:v}); });
    if(!ok){ try{ console.warn('[sync] diff has a key the REST index does not know -> legacy /api/save (run the mapping drift check)'); }catch(e){} }
    return ok?ops:null;
  }
  function seedFull(loc){ var cur; try{cur=JSON.parse(loc);}catch(e){return;} var x=new XMLHttpRequest(); x.open('POST','/api/save',true); x.setRequestHeader('Content-Type','application/json'); x.onload=function(){ if(x.status===200){ try{VER=JSON.parse(x.responseText).version;}catch(e){} BASE=cur; _laMark(VER); } }; try{ x.send(JSON.stringify({baseVersion:0,full:loc})); }catch(e){} }
  var _laSaveErrShown=false;
  function _laSaveErr(msg,color){ _laSaveErrShown=true; onReady(function(){ var d=document.getElementById('la-saveerr'); if(!d){ d=document.createElement('div'); d.id='la-saveerr'; d.style.cssText='position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:100001;color:#fff;border-radius:22px;padding:9px 18px;font:13px/1.35 "DM Sans",sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.3);max-width:82vw;text-align:center'; document.body.appendChild(d);} d.style.background=color||'#A32D2D'; d.innerHTML='⚠ '+msg; }); }
  function _laSaveErrClear(){ if(!_laSaveErrShown) return; _laSaveErrShown=false; var d=document.getElementById('la-saveerr'); if(d) d.remove(); _laRetryN=0; }
  /* §pkTk7 · ลองเซฟใหม่แบบถอยเวลา แล้วหยุดเมื่อถึงเวลา
     ของเดิมลองทุก 5 วินาทีไม่มีที่สิ้นสุด · เซิร์ฟเวอร์ที่ล่มจริงจะโดนยิงทั้งวัน
     และข้อความไม่บอกรหัสสถานะ คนใช้เห็นแถบค้างโดยไม่รู้สาเหตุ ตามต่อไม่ได้
     ตอนนี้: 5 · 10 · 20 · 40 · 60 · 60 วินาที แล้วหยุด พร้อมปุ่มลองเองและบอกรหัส */
  var _laRetryN=0, _laRetryT=null;
  function _laRetryNow(){ try{ clearTimeout(_laRetryT); }catch(e){}
    var nv=localStorage.getItem(LS); if(nv) save(nv); }
  window.laRetrySaveNow=function(){ _laRetryN=0; _laRetryNow(); };
  function _laRetry(why){
    _laRetryN++;
    if(_laRetryN>6){
      _laSaveErr('บันทึกขึ้นระบบไม่สำเร็จ · '+why+' — ลองแล้ว '+(_laRetryN-1)+' ครั้ง '
        +'<b>ข้อมูลยังอยู่ในเครื่องครบ</b> อย่าเพิ่งปิดหน้า'
        +'<br><button onclick="laRetrySaveNow()" style="margin-top:7px;background:#fff;color:#7A4A00;'
        +'border:0;border-radius:9px;padding:5px 13px;font-weight:700;cursor:pointer;font-family:inherit">'
        +'ลองบันทึกอีกครั้ง</button>','#7A4A00');
      return;
    }
    var wait=[5000,10000,20000,40000,60000,60000][_laRetryN-1]||60000;
    _laSaveErr('กำลังลองบันทึกขึ้นระบบใหม่ ('+_laRetryN+'/6) · '+why
      +' — ข้อมูลยังอยู่ในเครื่อง อย่าเพิ่งปิดหน้า','#7A4A00');
    try{ clearTimeout(_laRetryT); }catch(e){}
    _laRetryT=setTimeout(_laRetryNow, wait);
  }
  // save-safety guard (feat/validation-deprecate-blob): the server refused a save that would delete/shrink
  // existing data (stale whole-blob overwrite). Show a persistent blocking banner + Reload; do NOT retry,
  // do NOT advance BASE — the correct data is on the server, reloading discards the bad local overwrite.
  function _laShrinkBlocked(detail){
    try{
      var rows=(Array.isArray(detail)?detail:[]).slice(0,6).map(function(d){ return d.table+' '+d.from+'→'+d.to; }).join(' · ');
      onReady(function(){
        var d=document.getElementById('la-shrinkblock');
        if(!d){ d=document.createElement('div'); d.id='la-shrinkblock';
          d.style.cssText='position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:100002;background:#A32D2D;color:#fff;border-radius:14px;padding:12px 16px;font:13px/1.45 "DM Sans",sans-serif;box-shadow:0 8px 26px rgba(0,0,0,.35);max-width:88vw;text-align:center';
          document.body.appendChild(d); }
        d.innerHTML='⚠ <b>ยับยั้งการบันทึก</b> — การบันทึกนี้จะทำให้ข้อมูลหายผิดปกติ'+(rows?(' ('+rows+')'):'')
          +'<br>ข้อมูลในเครื่องไม่ตรงกับระบบ · ข้อมูลที่ถูกต้องอยู่บนเซิร์ฟเวอร์ '
          +'<button onclick="location.reload()" style="margin-top:8px;background:#fff;color:#A32D2D;border:0;border-radius:9px;padding:6px 14px;font-weight:700;cursor:pointer;font-family:inherit">โหลดข้อมูลใหม่จากระบบ</button>';
      });
    }catch(e){}
  }
  // blob ว่าง/พังไม่เคยแปลว่า "ผู้ใช้ลบข้อมูลทั้งหมด" — มันแปลว่า state ยังไม่พร้อมหรือเพิ่งถูกล้าง
  // ปล่อยให้ diff เดินต่อคือเปิดทางลบข้อมูลทั้งระบบด้วยการเซฟครั้งเดียว
  function _laBlobUsable(cur){ return !!(cur && typeof cur==='object' && Object.keys(cur).length>0); }
  function save(v, forceLegacy){ var cur; try{cur=JSON.parse(v);}catch(e){return;}
    if(!_laBlobUsable(cur)){ try{ console.warn('[sync] blob ว่าง — ไม่ส่งขึ้นเซิร์ฟเวอร์ (กันลบข้อมูลทั้งระบบ)'); }catch(e){} _dirty=false; return; }
    var d=computeDiff(BASE,cur); if(!d._changed){ _dirty=false; return; }
    var ops = forceLegacy ? null : laDiffToOps(d, cur);
    var x=new XMLHttpRequest(); x.open('POST', ops?'/api/v1/_batch':'/api/save', true); x.setRequestHeader('Content-Type','application/json');
    x.onload=function(){ if(x.status===200){ var r={}; try{r=JSON.parse(x.responseText);}catch(e){} VER=r.version||VER; BASE=cur; _laMark(VER); _dirty=false; _laSaveErrClear(); window.__savedAt=Date.now(); badgeTick(); if(r.behind){ _laPending=r; _laTryRefresh(); } }
      else if(ops && (x.status===404||x.status===400)){ save(v, true); }   // old server / op the batch can't express → legacy whole-diff save
      else if(x.status===403){ _laSaveErr('บันทึกขึ้นระบบไม่ได้ · บัญชีนี้ไม่มีสิทธิ์แก้ไข (การเปลี่ยนแปลงยังไม่ถูกบันทึก) — กรุณา login ใหม่ หรือติดต่อ admin'); }   // will never succeed → stop retrying, tell the user
      else if(x.status===401){ _laSaveErr('เซสชันหมดอายุ · ข้อมูลยังอยู่ในเครื่อง — กรุณาเข้าสู่ระบบใหม่ แล้วระบบจะเซฟให้อัตโนมัติ','#7A4A00'); }
      else if(x.status===409){ var _r9={}; try{_r9=JSON.parse(x.responseText);}catch(e){} _laShrinkBlocked(_r9&&_r9.detail); }   // save-safety: server refused a wipe/shrink of existing data — do NOT retry, keep local, tell user to reload
      else { _laRetry('เซิร์ฟเวอร์ตอบ '+x.status+(x.status===0?' (เชื่อมต่อไม่ได้)':'')); } };   // transient (5xx/0) → retry + warn
    x.onerror=function(){ _laRetry('เชื่อมต่อระบบไม่ได้'); };
    try{ x.send(JSON.stringify(ops ? {baseVersion:VER, ops:ops} : {baseVersion:VER, diff:{sets:d.sets,cols:d.cols,objs:d.objs}})); }catch(e){} }
  // FLUSH pending change before the page unloads (refresh/close) so a fast refresh never loses the last edit
  function _laFlush(){ if(!_dirty) return; try{ var cur=JSON.parse(localStorage.getItem(LS)||'{}');
    if(!_laBlobUsable(cur)){ _dirty=false; return; }   // §emptyBlobGuard · ปิดหน้าตอน blob ว่าง = ไม่มีอะไรให้เซฟ ไม่ใช่คำสั่งลบ
    var d=computeDiff(BASE,cur); if(!d._changed){ _dirty=false; return; }
    var ops=laDiffToOps(d,cur);
    var url = ops ? '/api/v1/_batch' : '/api/save';
    var payload = JSON.stringify(ops ? {baseVersion:VER, ops:ops} : {baseVersion:VER, diff:{sets:d.sets,cols:d.cols,objs:d.objs}});
    // SYNCHRONOUS save so it commits to cloud BEFORE the page reloads (otherwise the reload reloads stale data → reverts the edit)
    try{ var x=new XMLHttpRequest(); x.open('POST',url,false); x.setRequestHeader('Content-Type','application/json'); x.send(payload); if(x.status===200){ _dirty=false; try{VER=JSON.parse(x.responseText).version||VER;}catch(_){} BASE=cur; _laMark(VER); } else if(navigator.sendBeacon){ navigator.sendBeacon(url, new Blob([payload],{type:'application/json'})); } }
    catch(e){ if(navigator.sendBeacon) navigator.sendBeacon(url, new Blob([payload],{type:'application/json'})); }
  }catch(e){} }
  window.addEventListener('beforeunload', _laFlush);
  window.addEventListener('pagehide', _laFlush);
  // recover unsaved local work detected at load (new bookings / edits that never reached the cloud) → push it now
  if(_recoverPush){ _dirty=true; clearTimeout(_t); _t=setTimeout(function(){ try{ var nv=localStorage.getItem(LS); if(nv) save(nv); }catch(e){} }, 1500); }
  function _isPlainObj(x){ return x && typeof x==='object' && !Array.isArray(x); }
  // Deep diff of two plain objects → {p:{key:{v:val}|{m:subdiff}}, d:[deletedKeys]} or null if identical.
  function _deepDiff(b,c){ var p={}, d=[], ch=false;
    Object.keys(c).forEach(function(k){ if(!(k in b)){ p[k]={v:c[k]}; ch=true; }
      else if(_isPlainObj(b[k])&&_isPlainObj(c[k])){ var s=_deepDiff(b[k],c[k]); if(s){ p[k]={m:s}; ch=true; } }
      else if(JSON.stringify(b[k])!==JSON.stringify(c[k])){ p[k]={v:c[k]}; ch=true; } });
    Object.keys(b).forEach(function(k){ if(!(k in c)){ d.push(k); ch=true; } });
    return ch ? {p:p,d:d} : null; }
  function computeDiff(base,cur){ var sets={},cols={},objs={},ch=false,keys={};
    Object.keys(base||{}).forEach(function(k){keys[k]=1;}); Object.keys(cur||{}).forEach(function(k){keys[k]=1;});
    Object.keys(keys).forEach(function(k){ var b=base?base[k]:undefined, c=cur?cur[k]:undefined;
      var isCol = Array.isArray(c) && c.length>0 && c.every(function(x){return x&&typeof x==='object'&&x.id!=null;});
      if(isCol){ var bmap={}; if(Array.isArray(b)) b.forEach(function(x){ if(x&&x.id!=null) bmap[String(x.id)]=x; });
        var up=[],patch=[],seen={}; c.forEach(function(x){ var id=String(x.id); seen[id]=1; var bx=bmap[id];
          if(bx===undefined){ up.push(x); }                                                       // new record → full insert
          else if(JSON.stringify(bx)!==JSON.stringify(x)){                                         // changed record → per-FIELD patch (2 users can edit different fields of the same record)
            var fd=(_isPlainObj(bx)&&_isPlainObj(x))?_deepDiff(bx,x):null;
            if(fd) patch.push({id:x.id,m:fd}); else up.push(x); } });
        var del=[]; Object.keys(bmap).forEach(function(id){ if(!seen[id]) del.push(id); });
        if(up.length||patch.length||del.length){ cols[k]={idf:'id',up:up,patch:patch,del:del}; ch=true; } }
      else if(_isPlainObj(b)&&_isPlainObj(c)){ var od=_deepDiff(b,c); if(od){ objs[k]=od; ch=true; } }   // object map → per-sub-key merge (no clobber)
      else { if(JSON.stringify(b)!==JSON.stringify(c)){ sets[k]=(c===undefined?null:c); ch=true; } } });
    return {sets:sets,cols:cols,objs:objs,_changed:ch}; }
  // poll for others' changes → offer refresh (no silent stale, no forced reload mid-edit)
  // ── AUTO-REFRESH when others save · seamless when idle · never interrupts typing/editing ──
  var _laPending=null, _laLastInput=Date.now();
  ['mousedown','keydown','input','touchstart','wheel'].forEach(function(ev){ try{ document.addEventListener(ev, function(){ _laLastInput=Date.now(); }, true); }catch(e){} });
  function _laBusy(){
    if(_dirty) return true;                                                             // local changes not yet synced → never overwrite
    if(window._bkV2 && (_bkV2.newBooking || _bkV2.editingId)) return true;              // a booking form is open
    var ae=document.activeElement;
    if(ae && (ae.tagName==='INPUT'||ae.tagName==='TEXTAREA'||ae.tagName==='SELECT'||ae.isContentEditable)) return true;  // typing in a field
    if(document.querySelector('.la-modal')||document.getElementById('la-umodal')||document.getElementById('la-pmodal')) return true;  // a dialog is open
    if(document.getElementById('dc-panel-docs')) return true;                           // Document-Check drawer open (reading details) → don't interrupt
    try{ if(typeof _agSelected!=='undefined' && _agSelected) return true; }catch(e){}   // Agent detail open (reading/editing) → don't yank back to the list
    if(Date.now()-_laLastInput < 2000) return true;                                     // interacted within last 2s (snappy · SSE pushes instantly)
    return false;
  }
  // remember the current screen (per-tab · NOT synced) so an auto-refresh returns here instead of Dashboard
  function _laSaveView(){ try{
    var act=document.querySelector('.nav-item.active'); var view=act&&act.dataset?act.dataset.view:''; if(!view) return;
    var st={view:view};
    if(window._bkV2){ st.bk={tab:_bkV2.tab||'', filterDate:_bkV2.filterDate||'', filterRoute:_bkV2.filterRoute||'', detailId:_bkV2.detailId||'', boat:!!_bkV2.boatAssignMode, van:!!_bkV2.vanAssignMode}; if(window._bkV2T2Cursor) st.t2c=_bkV2T2Cursor; }
    try{ if(typeof _agSelected!=='undefined' && _agSelected) st.ag=_agSelected; }catch(e){}   // keep the open Agent detail across a full reload
    var mn=document.querySelector('main'); st.sc=mn?mn.scrollTop:0; st.scw=window.scrollY||0;
    sessionStorage.setItem('la_view', JSON.stringify(st));
  }catch(e){} }
  window._laReload=function(){ try{_laSaveView();}catch(e){} location.reload(); };
  function _laRestoreView(){ try{
    var raw=sessionStorage.getItem('la_view'); if(!raw) return; var st=JSON.parse(raw); if(!st||!st.view) return;
    if(typeof laAllowed==='function' && !laAllowed(st.view)) return;          // respect role permissions
    var el=document.querySelector('.nav-item[data-view="'+st.view+'"]'); if(!el || el.style.display==='none') return;
    if(st.bk && window._bkV2){ if(st.bk.tab)_bkV2.tab=st.bk.tab; if(st.bk.filterDate)_bkV2.filterDate=st.bk.filterDate; if(st.bk.filterRoute)_bkV2.filterRoute=st.bk.filterRoute; if(st.bk.detailId)_bkV2.detailId=st.bk.detailId; _bkV2.boatAssignMode=st.bk.boat; _bkV2.vanAssignMode=st.bk.van; if(st.t2c) window._bkV2T2Cursor=st.t2c; }
    try{ if(st.view==='agents' && st.ag && typeof _agSelected!=='undefined') _agSelected=st.ag; }catch(e){}   // reopen the Agent detail after a full reload
    el.click();
    setTimeout(function(){ try{ var mn=document.querySelector('main'); if(mn&&st.sc) mn.scrollTop=st.sc; if(st.scw) window.scrollTo(0,st.scw); }catch(e){} }, 220);
  }catch(e){} }
  // SEAMLESS in-place refresh · pulls latest cloud data + re-renders current view · NO page reload (no Dashboard flash)
  function _laSoftRefresh(){
    if(_laBusy()){ if(_laPending) showRefresh(_laPending); return; }
    var x=new XMLHttpRequest(); x.open('GET',bust('/api/load'),true);
    x.onload=function(){ try{
      if(x.status!==200) return;                                   // keep pending · retry next idle tick
      var j=JSON.parse(x.responseText);
      if(typeof j.data!=='string' || j.data.length<2){ _laPending=null; return; }
      if(_laBusy()) return;                                        // user resumed during fetch → defer
      _orig(LS, j.data);                                           // write WITHOUT triggering a save
      VER=j.version||VER; try{BASE=JSON.parse(j.data);}catch(e){BASE={};} _laMark(VER);
      /* §b2cPop · เทียบจาก BASE ที่เพิ่ง parse ไปแล้ว · ไม่ parse เพิ่มสักรอบ
         และไม่เช็ค updated_by อีกแล้ว · ของเดิมเช็คแล้วใบจองหลุดเงียบ
         เวลามีคนอื่นกดบันทึกคั่นระหว่างที่ผู้ใช้ยุ่งอยู่ */
      var _b2cNew=[]; try{ _b2cNew=_laB2CScan(BASE); }catch(e){}
      _laPending=null;
      var ok = window._laReloadData ? window._laReloadData() : false;
      if(!ok){ _laReload(); return; }                             // in-place failed → fall back to full reload
      if(window._laRerender) window._laRerender();
      LASTBY = j.updated_by ? (j.updated_by+' · '+fmt(j.updated_at)) : LASTBY; _laStamp(j);
      var bn=document.getElementById('la-refresh'); if(bn){ bn.remove(); _refreshShown=false; }
      try{ badgeTick(); }catch(e){}
      if(_b2cNew.length>0){ try{ _laB2CAlert(_b2cNew); }catch(e){} }
    }catch(e){ _laReload(); } };
    try{ x.send(); }catch(e){}
  }
  window._laSoftRefresh=_laSoftRefresh;   // expose for the banner button's inline onclick
  function _laTryRefresh(){ if(!_laPending) return; if(_laBusy()) showRefresh(_laPending); else _laSoftRefresh(); }
  // poll cloud version
  setInterval(function(){ var x=new XMLHttpRequest(); x.open('GET',bust('/api/version'),true); x.onload=function(){ if(x.status===200){ var j={}; try{j=JSON.parse(x.responseText);}catch(e){} if((j.version||0)>VER){ _laPending=j; _laTryRefresh(); } try{ _laB2CHealth(j.b2c); }catch(e){} } }; try{x.send();}catch(e){} }, 10000);
  // §B2C sync-down alert (2026-07-31): a failed B2C sync is non-fatal on the server — it logs and moves
  // on — so without this the app looks perfectly healthy while orders silently stop arriving. Server
  // side only reports a fault after 3 consecutive failed runs (~2 min) or 10 min with no successful
  // run at all, so a restart or one dropped connection never puts this on screen.
  // NOT dismissible on purpose: bookings are still being taken on the website while this is up.
  function _laB2CHealth(h){
    var el=document.getElementById('la-b2c-down');
    if(!h || !h.configured || h.ok){ if(el) el.remove(); return; }
    var why = h.neverOk ? 'ยังไม่เคยดึงสำเร็จตั้งแต่เซิร์ฟเวอร์เริ่มทำงาน'
            : (h.staleMin!=null && h.staleMin>=10 ? ('ดึงสำเร็จครั้งล่าสุดเมื่อ '+h.staleMin+' นาทีที่แล้ว')
            : ('ล้มเหลวติดกัน '+(h.consecutive||0)+' ครั้ง'));
    var det = h.phase ? (' · ขั้นตอน '+h.phase) : '';
    var msg = h.message ? ('\n'+h.message) : '';
    if(!el){
      el=document.createElement('div'); el.id='la-b2c-down';
      // Anchored to the BOTTOM, not the top: sticky headers all over the app compute their offset from
      // the --topbar CSS var, so a fixed bar at the top would sit on top of every one of them.
      el.style.cssText='position:fixed;bottom:0;left:0;right:0;z-index:100000;background:#A32D2D;color:#fff;'
        +'font:13px/1.4 "DM Sans",sans-serif;padding:9px 16px;text-align:center;box-shadow:0 -2px 10px rgba(0,0,0,.25)';
      document.body.appendChild(el);
    }
    // Booking ids are not shown because we do not know them — that is the whole problem. Point staff at
    // the B2C admin, which is the only place the missing orders can be read while the sync is down.
    el.innerHTML='&#9888; <b>ดึงข้อมูล B2C ไม่ได้</b> — '+esc(why)+esc(det)
      +' · booking ที่ลูกค้าจองเข้ามาช่วงนี้จะยังไม่ขึ้นในระบบ ให้เช็คที่หน้า B2C admin โดยตรง'
      +(msg?('<span title="'+esc(msg)+'" style="opacity:.75;cursor:help"> &#9432;</span>'):'');
  }
  window._laB2CHealth=_laB2CHealth;
  // Real-time push via SSE · server notifies instantly on any save (poll above is just a fallback)
  function _laStartSSE(){ if(typeof EventSource==='undefined') return; try{ if(window.__laSSE) window.__laSSE.close(); var es=new EventSource('/api/events'); es.onmessage=function(e){ try{ var j=JSON.parse(e.data); if((j.version||0)>VER){ _laPending=j; _laTryRefresh(); } }catch(_){} }; window.__laSSE=es; }catch(e){} }
  _laStartSSE();
  // keep the saved screen fresh · once new data is pending, seamlessly refresh the moment the user goes idle
  setInterval(function(){ _laSaveView(); if(_laPending && !_laBusy()) _laSoftRefresh(); }, 3000);
  function showRefresh(info){ if(_refreshShown) return; _refreshShown=true; onReady(function(){ var d=document.createElement('div'); d.id='la-refresh'; d.style.cssText='position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:99999;background:#185FA5;color:#fff;border-radius:24px;padding:8px 8px 8px 16px;font:13px/1.3 "DM Sans",sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.25);display:flex;align-items:center;gap:10px'; d.innerHTML='🔄 มีข้อมูลใหม่จากคนอื่น'+((info&&info.updated_by)?(' (โดย '+esc(info.updated_by)+')'):'')+' · จะรีเฟรชอัตโนมัติเมื่อว่าง <button onclick="_laSoftRefresh()" style="background:#fff;color:#185FA5;border:none;border-radius:16px;padding:6px 14px;font-weight:700;cursor:pointer;font-family:inherit">โหลดเลย</button>'; document.body.appendChild(d); }); }
  // §B2C new-booking alert helpers (2026-07-24)
  var _B2C_CXL=['cancelled','rejected','cancelled_weather'];
  /* §b2cPop · จำ id ของใบ b2c ที่รู้จักแล้วไว้ในหน่วยความจำ
     ของเดิมเทียบด้วยการ JSON.parse สตริงบล็อบทั้งเก่าและใหม่
     วัดของจริงบล็อบ 15.2 MB · เท่ากับ parse 15 MB สองรอบทุกครั้งที่มีของเข้า
     ตอนนี้รับ object ที่ _laSoftRefresh parse ไว้แล้ว (BASE) · parse เพิ่ม 0 รอบ
     จึงเทียบได้ทุกรอบโดยไม่ต้องเดาจาก updated_by

     รอบแรกที่เห็นข้อมูล จำเฉย ๆ ไม่เด้ง
     ไม่งั้นเปิดแอปครั้งแรกจะเด้งว่ามีของใหม่เท่าจำนวนใบ b2c ทั้งกอง */
  var _laB2CSeen=null;
  var _B2C_PIER={tublamu:'Tub Lamu', panwa:'Visit Panwa', ranong:'Ranong'};
  function _laB2CScan(obj){
    var out=[], arr=obj&&obj.sb_bookings;
    if(!Array.isArray(arr)) return out;
    var first=(_laB2CSeen===null), seen={}, rm={};
    if(!first && Array.isArray(obj.routes)) obj.routes.forEach(function(r){
      if(r&&r.id) rm[r.id]={n:(r.name||r.id), p:(_B2C_PIER[r.pier]||r.pier||'')}; });
    for(var i=0;i<arr.length;i++){
      var b=arr[i]; if(!b||!b.id) continue;
      if(String(b.id).indexOf('b2c_')!==0) continue;
      if(b.status&&_B2C_CXL.indexOf(b.status)>=0) continue;   /* ยกเลิกแล้วไม่นับ */
      seen[b.id]=1;
      if(first || _laB2CSeen[b.id]) continue;
      var t=(b.trips&&b.trips[0])||{}, pax=0;
      (b.trips||[]).forEach(function(tp){ var p=tp.pax||{};
        for(var k in p){ if(/^(ad|chd|inf|foc)(_fr|_th)?$/.test(k)) pax+=(+p[k]||0); } });
      var r=rm[t.routeId]||{}, ps=b.paymentSnapshot||{};
      out.push({ id:b.id, ref:_laB2CRef(b), route:(r.n||t.routeId||'-'), port:(r.p||''),
                 date:(t.date||''), pax:pax,
                 total:(b.priceBreakdown&&b.priceBreakdown.total)||0,
                 lead:(b.leadPax||''), paid:(ps.paidStatus||''),
                 trips:(b.trips||[]).length });
    }
    _laB2CSeen=seen;
    return first?[]:out;
  }
  /* เลขที่ที่ลูกค้าถือมาคือ voucherRef · id จริงเป็น b2c_BK-001_1
     ตัดทั้งหัว b2c_ และหาง _1 ที่เป็นลำดับทริป ไม่ใช่ส่วนหนึ่งของเลขที่ */
  function _laB2CRef(b){
    if(b&&b.voucherRef) return String(b.voucherRef);
    return String((b&&b.id)||'').replace(/^b2c_/,'').replace(/_\d+$/,'');
  }
  /* ชื่อย่อ · "NALINRAT KUNPHIPHIT" → "Nalinrat K." · แถบท้ายมีที่จำกัด */
  function _laB2CWho(nm){
    var p=String(nm||'').trim().split(/\s+/).filter(Boolean);
    if(!p.length) return '';
    var f=p[0].charAt(0).toUpperCase()+p[0].slice(1).toLowerCase();
    return p.length>1 ? (f+' '+p[1].charAt(0).toUpperCase()+'.') : f;
  }
  /* สถานะชำระเงิน · ค่าจริงในข้อมูล paid 86 / deposit 16 / unpaid 4 จาก 107 ใบ */
  function _laB2CPaid(v){
    if(v==='paid')    return {t:'\u2713 PAID', c:'#409060'};
    if(v==='deposit') return {t:'DEPOSIT',     c:'#B07500'};
    if(v==='unpaid')  return {t:'UNPAID',      c:'#BA1824'};
    return null;
  }
  /* §b2cEn · การ์ดนี้เป็นภาษาอังกฤษทั้งใบ · วันที่จึงใช้เดือนอังกฤษด้วย
     ใช้ที่การ์ด B2C ที่เดียว ไม่กระทบวันที่ในหน้าอื่น */
  function _laFmtDate(s){ if(!s) return '-'; var p=String(s).split('-'); if(p.length<3) return s; var M=['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return (+p[2])+' '+(M[+p[1]]||p[1])+' '+p[0]; }
  // Jump to Booking → By-Trip tab for the alerted booking's date
  function _laB2CGoTo(date){ try{ var nav=document.querySelector('.nav-item[data-view="booking"]'); if(nav) nav.click(); if(window._bkV2){ _bkV2.tab='bytrip'; if(date){ _bkV2.filterDate=date; _bkV2.filterRoute=null; window._bkV2T2Cursor=String(date).slice(0,7); } } if(typeof bkV2Render==='function') bkV2Render(); }catch(e){} }
  function _laBeep(){ try{ var AC=window.AudioContext||window.webkitAudioContext; if(!AC) return; var ctx=window.__laAC||(window.__laAC=new AC()); function tone(freq,at,dur){ var o=ctx.createOscillator(),g=ctx.createGain(); o.type='sine'; o.frequency.value=freq; o.connect(g); g.connect(ctx.destination); var t=ctx.currentTime+at; g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.35,t+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t+dur); o.start(t); o.stop(t+dur+0.02); } function play(){ try{ tone(880,0,0.16); tone(1174,0.16,0.22); }catch(e){} } if(ctx.state==='suspended'){ try{ var p=ctx.resume(); if(p&&p.then) p.then(play).catch(play); else play(); }catch(e){ play(); } } else { play(); } }catch(e){} }
  /* §b2cPop · คิวเดียวกับ save toast · มุมขวาบนมีเจ้าของคนเดียว
     ของเดิมสองเจ้าลงพิกัดเดียวกัน (top:16 right:16) แล้ว save toast z-index สูงกว่า
     กดบันทึกอยู่แล้วมี booking เข้า = การ์ดโดนทับสนิท 4 วินาที
     และ .la-b2c-alert เองก็ไม่มีกล่องเรียง append กี่ใบก็ทับกันเอง
     กล่องนี้เป็น flex column อยู่แล้ว เรียงลงมาทั้งสองเจ้า ไม่มีทางทับอีก
     สไตล์ต้องตรงกับที่ 08-app.js สร้าง เพราะใครถึงก่อนก็เป็นคนสร้าง */
  function _laB2CStack(){
    var w=document.getElementById('la-savetoast-wrap');
    if(!w){ w=document.createElement('div'); w.id='la-savetoast-wrap';
      w.style.cssText='position:fixed;z-index:100001;display:flex;flex-direction:column;gap:10px;pointer-events:none';
      document.body.appendChild(w); }
    /* §b2cCard · ตำแหน่ง 5 · ขวาบนสุด · ตั้งทุกครั้ง ไม่ใช่แค่ตอนสร้าง
       เพราะกล่องนี้ใช้ร่วมกับ save toast ใครถึงก่อนก็เป็นคนสร้าง
       วัดจากหน้าจริง · การ์ดสูง 156px กินช่วง 8-164px
       แถบหัว Re-confirm อยู่ 22-155px · ทับแค่แถบหัว เลยเข้าการ์ดใบแรก 9px
       ซึ่งเป็นมุมโค้ง ไม่มีตัวอักษร */
    w.style.top='8px'; w.style.right='12px'; w.style.left='auto'; w.style.bottom='auto';
    return w;
  }
  /* สไตล์ของการ์ด · ใส่ครั้งเดียว */
  function _laB2CCSS(){
    if(document.getElementById('la-b2c-css')) return;
    var st=document.createElement('style'); st.id='la-b2c-css';
    st.textContent=
     '.la-b2c-alert{pointer-events:auto;width:384px;max-width:calc(100vw - 24px);background:#fff;'
      +'border-radius:12px;overflow:hidden;box-shadow:0 18px 42px rgba(10,20,40,.32);'
      +'font-family:"DM Sans",-apple-system,sans-serif}'
     /* หัวจดหมาย · ค่าทุกตัวถอดจากใบ Booking Confirmation จริง */
     +'.la-b2c-alert .lh{position:relative;display:flex;align-items:stretch;gap:11px;'
      +'padding:0 24px 0 0;border-bottom:1.5px solid #EFEBE2}'
     +'.la-b2c-alert .lh img{height:54px;width:auto;display:block;flex:none}'
     +'.la-b2c-alert .bn{align-self:center;min-width:0;flex:1}'
     +'.la-b2c-alert .bn b{display:block;font-size:13px;font-weight:800;color:#020E48;line-height:1.15}'
     +'.la-b2c-alert .bn i{display:block;font-size:9px;color:#797979;font-style:italic;margin-top:1px}'
     +'.la-b2c-alert .rt{align-self:center;text-align:right;flex:none}'
     +'.la-b2c-alert .rt i{display:block;font-style:normal;font-size:8px;font-weight:800;'
      +'letter-spacing:.11em;color:#111;text-transform:uppercase}'
     +'.la-b2c-alert .rt b{display:block;font-size:15px;font-weight:800;font-style:italic;'
      +'color:#BA1824;margin-top:1px;white-space:nowrap}'
     +'.la-b2c-alert .rt em{display:block;font-size:8.5px;font-style:italic;color:#9A958B;margin-top:1px}'
     +'.la-b2c-alert .xx{position:absolute;top:6px;right:5px;width:17px;height:17px;display:flex;'
      +'align-items:center;justify-content:center;color:#C6C0B4;font-size:14px;line-height:1;cursor:pointer}'
     +'.la-b2c-alert .xx:hover{color:#8A8378}'
     /* ทริปใบเดียว */
     +'.la-b2c-alert .tp{padding:10px 14px 0;cursor:pointer}'
     +'.la-b2c-alert .t1{display:flex;align-items:baseline;gap:9px}'
     +'.la-b2c-alert .t1 s{text-decoration:none;flex:1;min-width:0;font-size:13px;font-weight:800;'
      +'color:#111;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
     +'.la-b2c-alert .t1 u{text-decoration:none;font-size:12.5px;font-weight:800;color:#2D4479;'
      +'font-family:"DM Mono",ui-monospace,monospace;white-space:nowrap}'
     +'.la-b2c-alert .t2{font-size:11px;color:#797979;margin-top:2px;'
      +'font-family:"DM Mono",ui-monospace,monospace}'
     +'.la-b2c-alert .t2 b{color:#111;font-weight:500}'
     /* หลายใบ */
     +'.la-b2c-alert .rows{padding:2px 14px 0}'
     +'.la-b2c-alert .rw{display:flex;align-items:baseline;gap:9px;padding:7px 6px;margin:0 -6px;'
      +'border-top:1px solid #F3EFE6;border-radius:7px;cursor:pointer}'
     +'.la-b2c-alert .rw:first-child{border-top:0}'
     +'.la-b2c-alert .rw:hover{background:#F5F8FC}'
     +'.la-b2c-alert .rw s{text-decoration:none;flex:1;min-width:0;font-size:12.5px;font-weight:700;'
      +'color:#111;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
     +'.la-b2c-alert .rw em{font-style:normal;font-size:10.5px;color:#8A8378;'
      +'font-family:"DM Mono",ui-monospace,monospace;white-space:nowrap}'
     +'.la-b2c-alert .rw u{text-decoration:none;font-size:11.5px;font-weight:500;color:#2D4479;'
      +'font-family:"DM Mono",ui-monospace,monospace;white-space:nowrap;min-width:56px;text-align:right}'
     +'.la-b2c-alert .rw n{font-size:8.5px;font-style:italic;font-weight:800;color:#BA1824;'
      +'white-space:nowrap;min-width:60px;text-align:right;overflow:hidden;text-overflow:ellipsis}'
     +'.la-b2c-alert .more{padding:7px 0 8px;border-top:1px solid #F3EFE6;font-size:10.5px;'
      +'color:#A09A8E;font-weight:600}'
     /* แถบท้าย */
     +'.la-b2c-alert .ft{display:flex;align-items:center;gap:9px;margin-top:10px;'
      +'padding:9px 14px 11px;border-top:1px solid #EFEBE2;background:#F1F4F9}'
     +'.la-b2c-alert .ft i{font-style:normal;font-size:8px;font-weight:800;letter-spacing:.14em;'
      +'color:#8E9CBB;text-transform:uppercase;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
     +'.la-b2c-alert .ft b{font-size:14px;font-weight:800;color:#2D4479;'
      +'font-family:"DM Mono",ui-monospace,monospace;white-space:nowrap}'
     +'.la-b2c-alert .ft .pd{font-size:10.5px;font-weight:800;white-space:nowrap}'
     +'.la-b2c-alert .ft a{margin-left:auto;font-size:11.5px;font-weight:700;color:#fff;'
      +'text-decoration:none;background:#02104D;border-radius:7px;padding:6px 12px;'
      +'white-space:nowrap;cursor:pointer}'
     +'.la-b2c-alert .ft a:hover{background:#04197A}';
    document.head.appendChild(st);
  }
  function _laB2CAlert(list){ if(!list||!list.length) return;
    var n=list.length, show=list.slice(0,3), rest=n-show.length, one=list[0];
    var tPax=0, tAmt=0, dates=[];
    list.forEach(function(x){ tPax+=(+x.pax||0); tAmt+=(+x.total||0); if(x.date) dates.push(x.date); });
    dates.sort();
    var goDate=dates[0]||'';
    var _2=function(v){ return (v<10?'0':'')+v; };
    var nw=new Date(), hhmm=_2(nw.getHours())+':'+_2(nw.getMinutes());
    var B=function(v){ return Number(v||0).toLocaleString(); };
    onReady(function(){
      _laB2CCSS();
      var wrap=_laB2CStack();
      var d=document.createElement('div'); d.className='la-b2c-alert';

      /* หัวจดหมาย · ช่องแดงเป็นเลขที่ใบจองถ้ามาใบเดียว ถ้าหลายใบเป็นจำนวนใบ */
      var head='<div class="lh">'
        +'<img src="assets/la-tab.png" alt="" onerror="this.style.display=\'none\'">'
        +'<span class="bn"><b>LOVE ANDAMAN</b><i>Your experience, Our Passion</i></span>'
        +'<span class="rt"><i>'+(n>1?'New bookings':'New booking')+'</i>'
          +'<b>'+esc(n>1?(n+' bookings'):(one.ref||'-'))+'</b>'
          +'<em>'+hhmm+' &middot; B2C</em></span>'
        +'<span class="xx" title="Close">&times;</span>'
      +'</div>';

      var body, foot;
      if(n===1){
        /* ใบเดียว · เจอบ่อยที่สุด · ข้อมูลจริง 107 ใบไม่มีใบไหนเกิน 1 ทริป */
        var sub=[_laFmtDate(one.date)];
        if(one.port) sub.push(one.port);
        sub.push((one.pax||0)+' pax');
        body='<div class="tp" data-d="'+esc(one.date)+'">'
            +'<div class="t1"><s>'+esc(one.route)+'</s><u>THB '+B(one.total)+'</u></div>'
            +'<div class="t2"><b>'+esc(sub[0])+'</b> &middot; '+esc(sub.slice(1).join(' \u00b7 '))+'</div>'
          +'</div>';
        var pd=_laB2CPaid(one.paid), who=_laB2CWho(one.lead);
        foot='<div class="ft"><i>'+esc(who||'\u2014')+'</i>'
            +(pd?('<span class="pd" style="color:'+pd.c+'">'+pd.t+'</span>'):'')
            +'<a data-d="'+esc(one.date)+'">Open booking &rsaquo;</a></div>';
      } else {
        /* หลายใบ · กดบรรทัดไหนไปวันของใบนั้น ไม่ใช่วันของใบแรก */
        body='<div class="rows">'
          + show.map(function(x){
              return '<div class="rw" data-d="'+esc(x.date)+'" title="Go to '+esc(_laFmtDate(x.date))+'">'
                +'<s>'+esc(x.route)+'</s>'
                +'<em>'+esc(_laFmtDate(x.date))+' &middot; '+(x.pax||0)+' pax</em>'
                +'<u>'+B(x.total)+'</u><n>'+esc(x.ref||'')+'</n></div>'; }).join('')
          + (rest>0?('<div class="more">+'+rest+' more</div>'):'')
        +'</div>';
        foot='<div class="ft"><i>'+n+' bookings &middot; '+tPax+' pax</i>'
            +'<b>THB '+B(tAmt)+'</b>'
            +'<a data-d="'+esc(goDate)+'">View all &rsaquo;</a></div>';
      }
      d.innerHTML=head+body+foot;

      var go=function(dt){ try{ _laB2CGoTo(dt||goDate); }catch(e){} try{ d.remove(); }catch(e){} };
      Array.prototype.forEach.call(d.querySelectorAll('[data-d]'), function(r){
        r.onclick=function(e){ if(e&&e.stopPropagation)e.stopPropagation(); go(r.getAttribute('data-d')); };
      });
      var xb=d.querySelector('.xx');
      if(xb) xb.onclick=function(e){ if(e&&e.stopPropagation)e.stopPropagation(); try{d.remove();}catch(_){} };
      wrap.appendChild(d);
      /* หลายใบให้เวลานานขึ้นตามจำนวน · และชี้ค้างไว้แล้วรอ
         ของเดิม 8 วินาทีตายตัว อ่านไม่ทันก็คือไม่ทัน */
      var dur=Math.min(20000, 8000+2500*(n-1)), tm=null;
      var close=function(){ try{ d.style.transition='opacity .4s'; d.style.opacity='0';
        setTimeout(function(){ try{d.remove();}catch(e){} },400); }catch(e){} };
      var arm=function(){ tm=setTimeout(close, dur); };
      d.onmouseenter=function(){ if(tm){ clearTimeout(tm); tm=null; } };
      d.onmouseleave=function(){ if(!tm) arm(); };
      arm();
    }); _laBeep(); }
  // Prime/resume the AudioContext on the first user gesture so the alert beep can actually play
  // (browsers keep a freshly-created AudioContext 'suspended' until a gesture unlocks audio).
  (function(){ function _laPrimeAudio(){ try{ var AC=window.AudioContext||window.webkitAudioContext; if(!AC) return; if(!window.__laAC) window.__laAC=new AC(); if(window.__laAC.state==='suspended') window.__laAC.resume(); }catch(e){} } ['pointerdown','keydown','touchstart'].forEach(function(ev){ try{ document.addEventListener(ev,_laPrimeAudio,{passive:true,capture:true}); }catch(e){} }); })();

  // 4) UI · user badge + logout + (admin) user mgmt
  function onReady(fn){ if(document.body) fn(); else document.addEventListener('DOMContentLoaded',fn); }
  onReady(function(){
    var st=document.createElement('style'); st.textContent='#la-userbadge{position:fixed;bottom:12px;left:12px;z-index:99998;display:flex;align-items:center;gap:8px;max-width:230px;flex-wrap:wrap;background:rgba(20,40,30,.92);color:#eafff2;border:1px solid rgba(255,255,255,.15);border-radius:20px;padding:5px 6px 5px 12px;font:12px/1.2 "DM Sans",sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.18)}#la-userbadge b{font-weight:700}.la-ub-btn{background:rgba(255,255,255,.14);border:none;color:#eafff2;border-radius:13px;padding:4px 10px;font-size:11px;cursor:pointer;font-family:inherit}.la-ub-btn:hover{background:rgba(255,255,255,.26)}.la-modal{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;font-family:"DM Sans",sans-serif}.la-card{background:#fff;border-radius:14px;width:560px;max-width:94vw;max-height:86vh;overflow:auto;box-shadow:0 24px 70px rgba(0,0,0,.3)}';
    document.head.appendChild(st);
    var b=document.createElement('div'); b.id='la-userbadge';
    b.innerHTML='<span>👤 <b>'+esc(ME.name||ME.username)+'</b>'+(ME.role==='admin'?' · admin':(laCanEdit()?'':' · <span style="color:#FFD08A">👁 ดูอย่างเดียว</span>'))+(LASTBY?(' <span style="opacity:.7">· แก้ล่าสุด '+esc(LASTBY)+'</span>'):'')+'</span>'+(ME.role==='admin'?'<button class="la-ub-btn" onclick="__laUsers()">ผู้ใช้</button>':'')+'<button class="la-ub-btn" onclick="__laLogout()">ออก</button>';
    document.body.appendChild(b);
    if(!laCanEdit()){ var vb=document.createElement('div'); vb.id='la-viewonly'; vb.style.cssText='position:fixed;bottom:12px;right:12px;z-index:99998;background:#7A4A00;color:#fff;border-radius:20px;padding:6px 14px;font:12px/1.25 "DM Sans",sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.22)'; vb.innerHTML='👁 โหมดดูอย่างเดียว · การแก้ไขจะไม่ถูกบันทึก'; document.body.appendChild(vb); }
    laWrapNav(); laApplyPerms(); laApplyAdminOnly(); setTimeout(laApplyPerms,600); setTimeout(laApplyAdminOnly,600); setTimeout(_laRestoreView,850);
  });
  // ── Per-user area access (role-based nav gating) ──
  var LA_AREAS=[{k:'overview',t:'ภาพรวม · Dashboard/Calendar'},{k:'operations',t:'ปฏิบัติการ · Booking/Boat Op/รถ'},{k:'sales',t:'ขาย · Agents/Rate/Demand'},{k:'accounting',t:'บัญชี · Accounting/PFM'},{k:'fleet',t:'เรือ/ช่าง · Fleet/Maintenance'},{k:'pier',t:'ท่าเรือ · Office ท่าเรือ'},{k:'config',t:'ตั้งค่า · Programs/Team'}];
  var LA_PRESETS={Sales:['overview','sales'],Operations:['overview','operations'],Fleet:['fleet'],Accounting:['overview','accounting'],Pier:['pier']};
  var LA_VIEW_AREA={'sales-board':'sales','b2b-dash':'sales','contract-tmpl':'sales',dashboard:'overview',calendar:'overview',daily:'overview',booking:'operations',operation:'operations',vehicles:'operations',vanjobs:'operations',vancheckin:'operations',piercheckin:'operations',travelsum:'operations',dailyreport:'operations','pickup-setup':'operations',boatassign:'operations',agents:'sales','rate-types':'sales',b2c:'sales',staff:'sales',marketdata:'sales',pickupmap:'sales',accounting:'accounting',costing:'accounting',trippl:'accounting',dailypfm:'accounting',prpo:'accounting','fl-dashboard':'fleet','fl-boatstatus':'fleet','fl-dailyreport':'fleet','fl-incident':'fleet','fl-projects':'fleet','fl-maintenance':'fleet','fl-inventory':'fleet','fl-consumables':'fleet','fl-cost':'fleet','fl-insights':'fleet','fl-fuel':'fleet','fl-asset':'fleet','po-panwa':'pier','po-tublamu':'pier','po-ranong':'pier','poj-panwa':'pier','poj-tublamu':'pier','poj-ranong':'pier','pol-panwa':'pier','pol-tublamu':'pier','pol-ranong':'pier','poa-panwa':'pier','poa-tublamu':'pier','poa-ranong':'pier','pop-panwa':'pier','pop-tublamu':'pier','pop-ranong':'pier','pok-panwa':'pier','pok-tublamu':'pier','pok-ranong':'pier',
    'rep-ops':'operations','rep-fleet':'fleet',
    settings:'config',teammkt:'config',addonsvc:'config'};
  // Per-MENU registry (finer than the 6 groups) · {v:view, t:label, a:area}
  var LA_NAV=[
    {v:'dashboard',t:'Dashboard',a:'overview'},{v:'calendar',t:'Calendar',a:'overview'},{v:'daily',t:'Daily Availability',a:'overview'},
    /* §สิทธิ์ · reconfirm กับ bookingflow ไม่เคยอยู่ใน LA_NAV เลย และ laAllowed() ปล่อยผ่านเมนูที่ไม่รู้จัก
       (return managed?false:true) → 2 หน้านี้เปิดให้ "ทุกคน" มาตลอด แม้ผู้ใช้จะไม่ได้ติ๊กพื้นที่ปฏิบัติการไว้
       ใส่เข้ากลุ่ม operations · เรียงตามลำดับในเมนูจริง (Booking → Re-confirm → Booking Flow → ตรวจเอกสาร) */
    {v:'booking',t:'Booking',a:'operations'},{v:'reconfirm',t:'Re-confirm',a:'operations'},{v:'bookingflow',t:'Booking Flow',a:'operations'},{v:'doccheck',t:'ตรวจเอกสาร',a:'operations'},{v:'operation',t:'Boat Operation',a:'operations'},{v:'fleetcal',t:'Fleet Calendar',a:'operations'},{v:'insurance',t:'Insurance',a:'operations'},{v:'vehicles',t:'Transfer Fleet',a:'operations'},{v:'vanjobs',t:'ใบงานรถ',a:'operations'},{v:'vancheckin',t:'เช็คอินรถ',a:'operations'},{v:'piercheckin',t:'เช็คอินหน้าท่า',a:'operations'},{v:'travelsum',t:'Travel Summary',a:'operations'},{v:'dailyreport',t:'Daily Report',a:'operations'},{v:'pickup-setup',t:'Pickup time setup',a:'operations'},
    {v:'sales-board',t:'Sales Board',a:'sales'},{v:'b2b-dash',t:'B2B Dashboard',a:'sales'},{v:'agents',t:'Agent List',a:'sales'},{v:'rate-types',t:'Rate Types',a:'sales'},{v:'contract-tmpl',t:'Contract Templates',a:'sales'},{v:'b2c',t:'B2C Channels',a:'sales'},{v:'staff',t:'Staff & Welfare',a:'sales'},{v:'marketdata',t:'Demand',a:'sales'},{v:'focdetail',t:'FOC Detail',a:'sales'},{v:'pickupmap',t:'แผนที่จุดรับ',a:'sales'},
    {v:'accounting',t:'Accounting',a:'accounting'},{v:'costing',t:'ต้นทุน & จุดคุ้มทุน',a:'accounting'},{v:'trippl',t:'P&L รายทริป',a:'accounting'},{v:'dailypfm',t:'Daily PFM',a:'accounting'},{v:'vanbill',t:'วางบิลรถร่วม',a:'accounting'},{v:'prpo',t:'PR/PO Dashboard',a:'accounting'},
    {v:'fl-dashboard',t:'Fleet Dashboard',a:'fleet'},{v:'fl-boatstatus',t:'Boat Status',a:'fleet'},{v:'fl-dailyreport',t:'Daily Fleet Log',a:'fleet'},{v:'fl-incident',t:'Incident / Job',a:'fleet'},{v:'fl-projects',t:'Projects',a:'fleet'},{v:'fl-maintenance',t:'Maintenance',a:'fleet'},{v:'fl-inventory',t:'Inventory / Memo',a:'fleet'},{v:'fl-consumables',t:'เบิกของใช้/น้ำมัน',a:'fleet'},{v:'fl-cost',t:'Cost Analytics',a:'fleet'},{v:'fl-insights',t:'Fleet Insights',a:'fleet'},{v:'fl-fuel',t:'Fuel',a:'fleet'},{v:'fl-asset',t:'Company Asset',a:'fleet'},
    {v:'poj-panwa',t:'Phuket · ใบงานเรือ',a:'pier'},{v:'po-panwa',t:'Phuket · เบิก-คืนอุปกรณ์',a:'pier'},{v:'poa-panwa',t:'Phuket · ตารางการทำงาน',a:'pier'},{v:'pol-panwa',t:'Phuket · ใบอนุญาต',a:'pier'},{v:'pop-panwa',t:'Phuket · เงินสดย่อย',a:'pier'},{v:'pok-panwa',t:'Phuket · ตั๋วอุทยาน',a:'pier'},
    {v:'poj-tublamu',t:'Tub Lamu · ใบงานเรือ',a:'pier'},{v:'po-tublamu',t:'Tub Lamu · เบิก-คืนอุปกรณ์',a:'pier'},{v:'poa-tublamu',t:'Tub Lamu · ตารางการทำงาน',a:'pier'},{v:'pol-tublamu',t:'Tub Lamu · ใบอนุญาต',a:'pier'},{v:'pop-tublamu',t:'Tub Lamu · เงินสดย่อย',a:'pier'},{v:'pok-tublamu',t:'Tub Lamu · ตั๋วอุทยาน',a:'pier'},
    {v:'poj-ranong',t:'Ranong · ใบงานเรือ',a:'pier'},{v:'po-ranong',t:'Ranong · เบิก-คืนอุปกรณ์',a:'pier'},{v:'poa-ranong',t:'Ranong · ตารางการทำงาน',a:'pier'},{v:'pol-ranong',t:'Ranong · ใบอนุญาต',a:'pier'},{v:'pop-ranong',t:'Ranong · เงินสดย่อย',a:'pier'},{v:'pok-ranong',t:'Ranong · ตั๋วอุทยาน',a:'pier'},
    {v:'rep-ops',t:'Operations Report',a:'operations'},{v:'rep-fleet',t:'Fleet Report',a:'fleet'},
    {v:'settings',t:'Programs',a:'config'},{v:'teammkt',t:'Team & Markets',a:'config'},{v:'addonsvc',t:'Add-on Services',a:'config'}
  ];
  /* §permExplicit · หมุดบอกว่า "รายการนี้ admin ระบุมาครบแล้ว"
     ตัวยกสิทธิ์ทั้งหมดข้างล่างมีไว้กู้ข้อมูลเก่าที่เก็บเป็นชื่อกลุ่ม
     ถ้ายังวิ่งกับรายการที่ admin เพิ่งติ๊กมาเอง จะกลายเป็นเติมสิทธิ์ที่เขาตั้งใจตัดออก
     หมุดนี้ถูกเติมตอนบันทึกจากหน้าจัดการผู้ใช้เท่านั้น · ข้อมูลเก่าไม่มีหมุด = เหมือนเดิม */
  var LA_PERM_EXPLICIT='*explicit';
  function laPermIsExplicit(perms){ return Array.isArray(perms) && perms.indexOf(LA_PERM_EXPLICIT)>=0; }
  /* ปิดหมุดเข้ารายการที่จะบันทึก · ตัดของเดิมออกก่อนกันซ้ำ */
  function laPermSeal(list){
    var out=(list||[]).filter(function(v){ return v!==LA_PERM_EXPLICIT; });
    out.push(LA_PERM_EXPLICIT); return out;
  }
  window.laPermSeal=laPermSeal;
  // Expand a stored perms array → Set of allowed view keys. Group keys (the 6 areas) expand to every menu in that group (back-compat with old data). View keys pass through.
  function laExpandPerms(perms){ if(!Array.isArray(perms)) return null; var set={}, areaKeys=LA_AREAS.map(function(a){return a.k;});
    perms.forEach(function(p){ if(areaKeys.indexOf(p)>=0){ LA_NAV.forEach(function(n){ if(n.a===p) set[n.v]=1; }); } else set[p]=1; });
    /* ระบุมาครบแล้ว = ใช้ตามนั้นตรง ๆ ไม่ต้องยกสิทธิ์เพิ่มให้อีก */
    if(set[LA_PERM_EXPLICIT]) return set;
    laBackfillPier(set);
    if(!set['contract-tmpl'] && (set['rate-types']||set['agents'])) set['contract-tmpl']=1;   // §contract-tmpl เพิ่มใหม่ 2026-07-14 · back-fill สิทธิ์ให้คนที่ถือ rate-types/agents อยู่แล้ว (perms แบบ view-list เก่าไม่มี key นี้ → เข้าหน้าไม่ได้)
    if(!set['b2b-dash'] && (set['sales-board']||set['marketdata'])) set['b2b-dash']=1;   // §b2b-dash
    if(!set['costing'] && set['accounting']) set['costing']=1;   // §fill · costing ลงทะเบียน 2026-08-11 · คนที่ถือหน้า Accounting อยู่แล้วยกให้ต่อ (perms แบบ view-list เก่าไม่มี key นี้)
    /* §prpo · ย้ายจากกลุ่มปฏิบัติการมาอยู่บัญชี-การเงิน 2026-09-04
       ยกให้ฝั่งบัญชีเป็นหลัก · แต่ไม่ดึงคืนจากคนฝั่งปฏิบัติการที่เคยเห็นอยู่แล้ว
       (คนที่เก็บสิทธิ์เป็น group key 'operations' จะหลุดทันทีที่ย้ายกลุ่ม ถ้าไม่เผื่อไว้) */
    if(!set['prpo'] && (set['accounting']||set['costing']||set['dailypfm']
        ||set['dailyreport']||set['travelsum']||set['piercheckin'])) set['prpo']=1;
    if(!set['dailyreport'] && set['travelsum']) set['dailyreport']=1;   // §dailyreport เพิ่มใหม่ 2026-08-02 · back-fill ให้คนที่ถือ Travel Summary (เอกสารปิดวันชุดเดียวกัน)   // §b2b-dash เพิ่มใหม่ 2026-07-20 · back-fill ให้คนที่ถือ sales-board/marketdata (perms แบบ view-list เก่าไม่มี key นี้)
    return set; }
  /* §pierSplit · Office ท่าเรือ เคยอยู่ในกลุ่ม operations · ย้ายออกมาเป็นกลุ่มของตัวเอง
     ใครที่ติ๊ก operations ไว้แต่เดิมยังต้องเห็นเหมือนเดิม จนกว่า admin จะเข้าไปปรับ */
  function laBackfillPier(set){
    if(!set) return set;
    if(set['operations'] || set['piercheckin']){
      if(!set['po-panwa'] && !set['po-tublamu'] && !set['po-ranong']){ set['po-panwa']=1; set['po-tublamu']=1; set['po-ranong']=1; }
      if(!set['poj-panwa'] && !set['poj-tublamu'] && !set['poj-ranong']){ set['poj-panwa']=1; set['poj-tublamu']=1; set['poj-ranong']=1; }
      if(!set['pol-panwa'] && !set['pol-tublamu'] && !set['pol-ranong']){ set['pol-panwa']=1; set['pol-tublamu']=1; set['pol-ranong']=1; }
      if(!set['poa-panwa'] && !set['poa-tublamu'] && !set['poa-ranong']){ set['poa-panwa']=1; set['poa-tublamu']=1; set['poa-ranong']=1; }
    }
    /* §poCash · เงินสดย่อยเพิ่มใหม่ 2026-09-02 · ยกให้คนที่ถือหน้าเบิก-คืนของท่านั้นอยู่แล้ว */
    ['panwa','tublamu','ranong'].forEach(function(k){ if(!set['pop-'+k] && set['po-'+k]) set['pop-'+k]=1; });
    /* §pkTk2 · ตั๋วอุทยานเพิ่มใหม่ · ยกให้คนที่ถือหน้าเบิก-คืนของท่านั้นอยู่แล้วเหมือนกัน */
    ['panwa','tublamu','ranong'].forEach(function(k){ if(!set['pok-'+k] && set['po-'+k]) set['pok-'+k]=1; });
    return set;
  }
  function laPermViewList(perms){ var set=laExpandPerms(perms); if(!set) return LA_NAV.map(function(n){return n.v;}); return LA_NAV.filter(function(n){return set[n.v];}).map(function(n){return n.v;}); }
  /* §permExplicit · อ่านอย่างเดียว · ไว้ตอบคำถาม "ทำไมคนนี้เห็นหน้านี้"
     laPermViewList(perms) = รายชื่อหน้าที่เปิดได้จริงจากค่าที่เก็บไว้ */
  window.laPermViewList=laPermViewList;
  window.laPermExpand=laExpandPerms;
  // §adminTools · ป้าย data-adminonly = admin เท่านั้น · ไม่เกี่ยวกับสิทธิ์เมนู
  //   laApplyPerms() ซ่อนให้เฉพาะคนที่ถูกจำกัดเมนู · ตัวนี้ยึด role อย่างเดียว
  //   ME ว่าง (เปิดไฟล์ export ตรง ๆ ไม่มีระบบ login) → ไม่ซ่อน เหมือนพฤติกรรมเดิม
  function laApplyAdminOnly(){ try{ if(!ME || ME.role==='admin') return;
    document.querySelectorAll('[data-adminonly]').forEach(function(el){ el.style.display='none'; });
  }catch(_){} }
  window.laApplyAdminOnly=laApplyAdminOnly;
  function laCanEdit(){ return !ME || ME.role==='admin' || ME.canEdit!==false; }   // can edit ANYTHING (global save-gate)
  function laCanEditArea(area){ if(!ME || ME.role==='admin') return true; if(Array.isArray(ME.editAreas)) return ME.editAreas.indexOf(area)>=0; return ME.canEdit!==false; }   // per-section edit
  function _laToast(msg){ try{ var t=document.getElementById('la-toast'); if(!t){ t=document.createElement('div'); t.id='la-toast'; t.style.cssText='position:fixed;bottom:56px;right:12px;z-index:100000;background:#7A4A00;color:#fff;border-radius:10px;padding:9px 14px;font:12px/1.35 "DM Sans",sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.25);max-width:290px;opacity:0;transition:opacity .18s'; document.body.appendChild(t); } t.textContent=msg; t.style.opacity='1'; clearTimeout(t._h); t._h=setTimeout(function(){ t.style.opacity='0'; },2600); }catch(e){} }
  window.laCanEdit=laCanEdit; window.laCanEditArea=laCanEditArea;
  // §pierEdit · ต้องรู้ว่า "ตั้งไว้เป็นรายการ" หรือ "ไม่เคยตั้ง" เพื่อรองรับหมวดที่เพิ่งแยกออกมา
  window.laEditAreas=function(){ return (ME && Array.isArray(ME.editAreas)) ? ME.editAreas.slice() : null; };
  window.laIsAdmin=function(){ return !!(ME && ME.role==='admin'); };   // admin-only actions (e.g. delete agent profile)
  window.laGuardEdit=function(area){ if(laCanEditArea(area)) return true; _laToast('👁 ส่วนนี้คุณมีสิทธิ์ดูอย่างเดียว · แก้ไขไม่ได้ (ติดต่อ admin)'); return false; };
  function laFullAccess(){ return !ME || ME.role==='admin' || !Array.isArray(ME.perms); }
  function laAllowed(view){ if(laFullAccess()) return true; var set=laExpandPerms(ME.perms); if(!set) return true; if(set[view]) return true; var managed=false; for(var i=0;i<LA_NAV.length;i++){ if(LA_NAV[i].v===view){managed=true;break;} } return managed?false:true; }
  /* §plMerge · หน้าที่ยุบเมนูมารวมกันต้องเช็คสิทธิ์ของเมนูที่ถูกยุบเองได้
     ไม่งั้นคนที่มีสิทธิ์หน้าหนึ่งจะเห็นอีกหน้าที่ admin ไม่ได้ให้สิทธิ์ไว้ */
  window.laAllowed=laAllowed;
  function laApplyPerms(){ if(laFullAccess()) return;
    var items=document.querySelectorAll('.nav-item[data-view]');
    items.forEach(function(it){ it.style.display = laAllowed(it.dataset.view) ? '' : 'none'; });
    document.querySelectorAll('[data-adminonly]').forEach(function(it){ it.style.display='none'; }); // admin-only nodes hidden for everyone else (laApplyPerms only runs for non-admins)
    /* §pierSub · หัวกลุ่มท่าไม่มี data-view จึงไม่โดนรอบบน · ซ่อนเองถ้าลูกไม่เหลือสักอัน */
    document.querySelectorAll('.nav-item.po-grp[data-pogrp]').forEach(function(g){
      var kids=[].slice.call(document.querySelectorAll('.nav-item.po-sub[data-pogrp="'+g.dataset.pogrp+'"]'));
      g.style.display = kids.some(function(k){ return k.style.display!=='none'; }) ? '' : 'none';
    });
    var nodes=[].slice.call(document.querySelectorAll('.sidebar .nav-section, .sidebar .nav-item[data-view]'));
    if(!nodes.length) nodes=[].slice.call(document.querySelectorAll('.nav-section, .nav-item[data-view]'));
    nodes.forEach(function(node,i){ if(node.classList.contains('nav-section')){ var vis=false; for(var j=i+1;j<nodes.length;j++){ if(nodes[j].classList.contains('nav-section')) break; if(nodes[j].style.display!=='none'){vis=true;break;} } node.style.display=vis?'':'none'; } });
    var active=document.querySelector('.nav-item.active');
    if(!active || active.style.display==='none' || !laAllowed(active.dataset.view)){
      var all=document.querySelectorAll('.nav-item[data-view]');
      for(var k=0;k<all.length;k++){ if(all[k].style.display!=='none' && laAllowed(all[k].dataset.view)){ all[k].click(); break; } }
    }
  }
  function laWrapNav(){ if(window.__laNavWrapped||typeof window.nav!=='function') return; var orig=window.nav; window.nav=function(el){ try{ var v=el&&el.dataset&&el.dataset.view; if(v&&!laAllowed(v)){ alert('คุณไม่มีสิทธิ์เข้าถึงเมนูนี้ · ติดต่อ admin'); return; } }catch(e){} return orig.apply(this,arguments); }; window.__laNavWrapped=true; }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function badgeTick(){ var b=document.getElementById('la-userbadge'); if(b){ b.style.borderColor='rgba(120,240,170,.7)'; setTimeout(function(){ b.style.borderColor='rgba(255,255,255,.15)'; },600);} }
  // §mobUser · ของเดิมใช้ XHR แบบ synchronous ซึ่งเบราว์เซอร์รุ่นใหม่เลิกอุ้ม
  //   พังแล้วกลืน error · reload เฉย ๆ · จอกระพริบแล้วยังเป็นคนเดิม ไม่มีอะไรบอกว่าทำไม
  //   ตอนนี้ยิงแล้วตรวจว่าออกจริงไหมก่อน · ออกไม่ได้ต้องบอก
  // §outSheet · confirm() เชื่อไม่ได้บนมือถือ · Safari ปิดกล่องเด้งได้เองหลังเจอซ้ำ ๆ
  //   แล้วคืน false ทันทีโดยไม่ขึ้นกล่อง = โค้ดเข้าใจว่าผู้ใช้กดยกเลิก = กดปุ่มแล้วเงียบสนิท
  //   ใช้แผ่นยืนยันของแอปเอง จะได้ไม่มีทางเงียบอีก ทุกทางต้องเห็นอะไรสักอย่าง
  window.__laLogoutSheet=null;
  window.__laLogout=function(){
    if(document.getElementById('la-out')) return;
    var ov=document.createElement('div'); ov.className='la-modal'; ov.id='la-out';
    ov.innerHTML='<div class="la-card" style="width:340px;max-width:92vw;padding:22px 22px 18px;text-align:center">'
      +'<div style="font-size:15px;font-weight:800;color:#15396B">ออกจากระบบ?</div>'
      +'<div id="la-out-msg" style="font-size:12.5px;color:#7C8091;margin:7px 0 16px;line-height:1.6">'
        +'คุณจะต้องล็อกอินใหม่เพื่อกลับเข้าใช้งาน</div>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:9px">'
        +'<button id="la-out-no" style="padding:12px 0;border:1px solid #DCDFE5;border-radius:11px;background:#fff;'
          +'color:#3a4453;font:700 13px inherit;cursor:pointer;min-height:46px">ยกเลิก</button>'
        +'<button id="la-out-yes" style="padding:12px 0;border:none;border-radius:11px;background:#A32D2D;'
          +'color:#fff;font:700 13px inherit;cursor:pointer;min-height:46px">ออกจากระบบ</button>'
      +'</div></div>';
    document.body.appendChild(ov);
    var msg=document.getElementById('la-out-msg'), yes=document.getElementById('la-out-yes'), no=document.getElementById('la-out-no');
    var close=function(){ try{ ov.remove(); }catch(_){} };
    no.onclick=close;
    ov.onclick=function(e){ if(e.target===ov) close(); };
    yes.onclick=function(){
      yes.disabled=true; no.disabled=true;
      yes.textContent='กำลังออก…'; yes.style.background='#8C9099';
      msg.textContent='กำลังแจ้งเซิร์ฟเวอร์…'; msg.style.color='#7C8091';
      var done=function(){ try{ location.replace(location.pathname+'?t='+Date.now()); }catch(_){ location.reload(); } };
      var fail=function(why){
        msg.innerHTML='<b style="color:#A32D2D">ออกจากระบบไม่สำเร็จ</b><br>'+(why||'เน็ตอาจหลุด')
          +'<br>ลองใหม่อีกครั้ง ถ้ายังไม่ได้ให้ปิดแท็บแล้วเปิดใหม่';
        yes.disabled=false; no.disabled=false; yes.textContent='ลองใหม่'; yes.style.background='#A32D2D';
      };
      try{
        // §ssoLogout (2026-08-27): when Authentik SSO is on, the server answers /api/logout with
        // {ssoLogout:'/auth/logout'}. Reloading the page instead would bounce through the SSO gate,
        // Authentik would still be holding its own session, and the user would land back inside the
        // app — a sign-out button that appears to do nothing. Go end that session too.
        var sso=null;
        fetch('/api/logout',{credentials:'same-origin',cache:'no-store'})
          .then(function(r){ return r.ok?r.json():null; })
          .then(function(j){ if(j && j.ssoLogout) sso=j.ssoLogout;
                             return fetch('/api/me',{credentials:'same-origin',cache:'no-store'}); })
          .then(function(r){ return r.ok?r.json():null; })
          .then(function(j){ if(j && (j.username||j.name)) fail('เซิร์ฟเวอร์ยังจำ session นี้อยู่');
                             else if(sso) location.replace(sso);
                             else done(); })
          .catch(function(e){ fail(String((e&&e.message)||e)); });
      }catch(e){ fail(String((e&&e.message)||e)); }
    };
  };

  // ── Login screen ──
  function showLogin(){
    if(!document.getElementById('la-login-css')){ var lc=document.createElement('style'); lc.id='la-login-css'; lc.textContent='.la-modal{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;font-family:"DM Sans",sans-serif}.la-card{background:#fff;border-radius:14px;width:560px;max-width:94vw;max-height:86vh;overflow:auto;box-shadow:0 24px 70px rgba(0,0,0,.3)}#la-login{background:linear-gradient(135deg,#0e2235 0%,#14506e 55%,#1f7ea3 100%)}'; (document.head||document.documentElement).appendChild(lc); }
    document.documentElement.style.overflow='hidden';
    var ov=document.createElement('div'); ov.className='la-modal'; ov.id='la-login';
    ov.innerHTML='<div class="la-card" style="width:380px;padding:26px 26px 22px;text-align:center"><div style="font-size:34px">🌊</div><div style="font-size:18px;font-weight:800;color:#15396B;margin:6px 0 2px">LOVE Andaman</div><div style="font-size:12px;color:#888;margin-bottom:18px">เข้าสู่ระบบเพื่อใช้งาน</div><input id="la-u" placeholder="Username" style="width:100%;box-sizing:border-box;border:1px solid #d7d3ca;border-radius:9px;padding:10px 12px;font-size:14px;margin-bottom:9px;font-family:inherit"><input id="la-p" type="password" placeholder="Password" style="width:100%;box-sizing:border-box;border:1px solid #d7d3ca;border-radius:9px;padding:10px 12px;font-size:14px;font-family:inherit"><div id="la-err" style="color:#C0392B;font-size:12px;min-height:16px;margin:8px 0"></div><button id="la-go" style="width:100%;background:#1C4A30;color:#fff;border:none;border-radius:9px;padding:11px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit">เข้าสู่ระบบ</button></div>';
    document.body.appendChild(ov);
    function go(){ var u=document.getElementById('la-u').value.trim(), p=document.getElementById('la-p').value; var e=document.getElementById('la-err'); e.textContent='กำลังเข้าสู่ระบบ...';
      var r=sx('POST','/api/login',JSON.stringify({username:u,password:p}),'application/json');
      if(r.status===200){ location.reload(); } else { e.textContent=(r.json&&r.json.error)||'เข้าสู่ระบบไม่สำเร็จ'; } }
    document.getElementById('la-go').onclick=go;
    document.getElementById('la-p').addEventListener('keydown',function(ev){ if(ev.key==='Enter') go(); });
    document.getElementById('la-u').focus();
  }

  // ── Admin: user management + area permissions ──
  /* §laUsers2 · ตั้งแต่หน้าต่างผู้ใช้เปลี่ยนเป็นตัวใหม่ ชุดฟังก์ชันข้างล่างนี้ไม่มีใครเรียกแล้ว
     (laPermBoxesHTML · laEditBoxesHTML · laPresetBtnsHTML · laReadBoxes · laReadEditBoxes ·
      laDeptSelectHTML · laSalesSelectHTML · laAreaBadges · laAvatar · laPermSummary)
     คงไว้ก่อน ยังไม่ลบ · เผื่อต้องถอยกลับไปใช้หน้าต่างเดิม แล้วค่อยเก็บกวาดรอบหน้า */
  function laPermBoxesHTML(prefix, sel){ sel=sel||[]; var on={}; sel.forEach(function(v){on[v]=1;});
    return '<div style="margin-top:8px;max-height:46vh;overflow:auto">'+LA_AREAS.map(function(a){
      var items=LA_NAV.filter(function(n){return n.a===a.k;});
      var allOn=items.length>0 && items.every(function(n){return on[n.v];});
      var rows=items.map(function(n){ return '<label style="display:inline-flex;align-items:center;gap:5px;font-size:12px;color:#444;cursor:pointer;margin:3px 12px 3px 0"><input type="checkbox" id="la-'+prefix+'-'+n.v+'" '+(on[n.v]?'checked':'')+' style="width:14px;height:14px;cursor:pointer">'+esc(n.t)+'</label>'; }).join('');
      return '<div style="border:1px solid #ece9e2;border-radius:9px;padding:8px 10px;margin-bottom:7px"><label style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:#15396B;cursor:pointer"><input type="checkbox" '+(allOn?'checked':'')+' onclick="__laToggleGroup(\''+prefix+'\',\''+a.k+'\',this.checked)" style="width:15px;height:15px;cursor:pointer">'+esc(a.t.split(' · ')[0])+' <span style="font-weight:400;color:#aaa">('+items.length+')</span></label><div style="display:flex;flex-wrap:wrap;margin-top:6px;padding-left:6px">'+rows+'</div></div>';
    }).join('')+'</div>'; }
  window.__laToggleGroup=function(prefix,grp,onv){ LA_NAV.forEach(function(n){ if(n.a===grp){ var el=document.getElementById('la-'+prefix+'-'+n.v); if(el) el.checked=onv; } }); };
  function laEditBoxesHTML(prefix, sel){ sel=sel||[]; var on={}; sel.forEach(function(v){on[v]=1;}); return '<div style="display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:6px">'+LA_AREAS.map(function(a){ return '<label style="display:inline-flex;align-items:center;gap:5px;font-size:12px;color:#444;cursor:pointer"><input type="checkbox" id="la-'+prefix+'-'+a.k+'" '+(on[a.k]?'checked':'')+' style="width:14px;height:14px;cursor:pointer">'+esc(a.t.split(' · ')[0])+'</label>'; }).join('')+'</div>'; }
  function laReadEditBoxes(prefix){ var out=[]; LA_AREAS.forEach(function(a){ var el=document.getElementById('la-'+prefix+'-'+a.k); if(el&&el.checked) out.push(a.k); }); return out; }
  function laPresetBtnsHTML(prefix){ return '<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:8px;align-items:center"><span style="font-size:11px;color:#999">ลัด:</span>'+Object.keys(LA_PRESETS).map(function(nm){ return '<button type="button" class="la-ub-btn" style="background:#eef3ff;color:#3358d6" onclick="__laSetPreset(\''+prefix+'\',\''+nm+'\')">'+esc(nm)+'</button>'; }).join('')+'<button type="button" class="la-ub-btn" style="background:#e9f7ef;color:#0F6E56" onclick="__laSetPreset(\''+prefix+'\',\'ALL\')">ทุกพื้นที่</button><button type="button" class="la-ub-btn" style="background:#f3f3f3;color:#777" onclick="__laSetPreset(\''+prefix+'\',\'NONE\')">ล้าง</button></div>'; }
  window.__laSetPreset=function(prefix,name){ var areas = name==='ALL'?LA_AREAS.map(function(a){return a.k;}) : name==='NONE'?[] : (LA_PRESETS[name]||[]); var allow={}; areas.forEach(function(ak){ LA_NAV.forEach(function(n){ if(n.a===ak) allow[n.v]=1; }); }); LA_NAV.forEach(function(n){ var el=document.getElementById('la-'+prefix+'-'+n.v); if(el) el.checked=!!allow[n.v]; var gh=document.querySelector('[onclick="__laToggleGroup(\''+prefix+'\',\''+n.a+'\',this.checked)"]'); }); LA_AREAS.forEach(function(a){ var items=LA_NAV.filter(function(n){return n.a===a.k;}); var allOn=items.every(function(n){var el=document.getElementById('la-'+prefix+'-'+n.v);return el&&el.checked;}); var gh=document.querySelector('input[onclick="__laToggleGroup(\''+prefix+'\',\''+a.k+'\',this.checked)"]'); if(gh) gh.checked=allOn; }); };
  function laReadBoxes(prefix){ var out=[]; LA_NAV.forEach(function(n){ var el=document.getElementById('la-'+prefix+'-'+n.v); if(el&&el.checked) out.push(n.v); }); return out; }
  function laPermSummary(u){ var vo='';
    if(u.role!=='admin'){ if(Array.isArray(u.editAreas)){ if(!u.editAreas.length) vo=' · 👁 ดูอย่างเดียวทั้งหมด'; else if(u.editAreas.length>=LA_AREAS.length) vo=' · ✎ แก้ได้ทุก section'; else vo=' · ✎ แก้: '+u.editAreas.map(function(k){ for(var i=0;i<LA_AREAS.length;i++){ if(LA_AREAS[i].k===k) return LA_AREAS[i].t.split(' · ')[0]; } return k; }).join(','); } else if(u.canEdit===false) vo=' · 👁 ดูอย่างเดียว'; } if(u.role==='admin') return 'ทุกพื้นที่ (admin)'; if(!Array.isArray(u.perms)) return 'ทุกเมนู'+vo; var set=laExpandPerms(u.perms)||{}; var n=0; LA_NAV.forEach(function(x){if(set[x.v])n++;}); if(n===0) return 'ไม่มีสิทธิ์'+vo; if(n>=LA_NAV.length) return 'ทุกเมนู'+vo; var grps=LA_AREAS.filter(function(a){return LA_NAV.filter(function(x){return x.a===a.k;}).every(function(x){return set[x.v];});}).map(function(a){return a.t.split(' · ')[0];}); return n+' เมนู'+(grps.length?(' ('+grps.join(', ')+(grps.length<LA_AREAS.length?' +':'')+')'):'')+vo; }

  // ── Departments (UI grouping only) · u.dept null → guessed from the username prefix ──
  var LA_DEPTS=[{k:'rsvn',t:'สำรองที่นั่ง'},{k:'transfer',t:'รถรับส่ง'},{k:'pier',t:'ท่าเรือ / เรือ'},{k:'sales',t:'ขาย / GSA'},{k:'acct',t:'บัญชี'},{k:'admin',t:'ผู้ดูแลระบบ'},{k:'other',t:'อื่นๆ'}];
  function laDeptName(k){ for(var i=0;i<LA_DEPTS.length;i++){ if(LA_DEPTS[i].k===k) return LA_DEPTS[i].t; } return k||'อื่นๆ'; }
  function laGuessDept(u){ var n=String(u.username||'');
    if(u.role==='admin') return 'admin';
    if(/^RSVN/i.test(n)) return 'rsvn';
    if(/^TRANSFER/i.test(n)) return 'transfer';
    if(/^Pier/i.test(n)) return 'pier';
    if(/^GSA|^DOS/i.test(n)) return 'sales';
    if(/^CRS|^ACC/i.test(n)) return 'acct';
    return 'other'; }
  function laDeptOf(u){ return u.dept || laGuessDept(u); }
  // Per-area state: 0 = ไม่มีสิทธิ์ · 1 = ดูอย่างเดียว · 2 = แก้ไขได้
  function laAreaState(u, area){
    if(u.role==='admin') return 2;
    var set = laExpandPerms(u.perms);
    var sees = !set ? true : LA_NAV.some(function(n){ return n.a===area && set[n.v]; });
    if(!sees) return 0;
    var canEd = Array.isArray(u.editAreas) ? (u.editAreas.indexOf(area)>=0) : (u.canEdit!==false);
    return canEd ? 2 : 1; }
  var LA_ST=[{ic:'–',c:'#9aa8a2',bg:'transparent'},{ic:'👁',c:'#185FA5',bg:'#E6F1FB'},{ic:'✎',c:'#0F6E56',bg:'#E1F5EE'}];
  function laAreaBadges(u){ return '<div style="display:flex;gap:3px;flex-wrap:wrap">'+LA_AREAS.map(function(a){
      var s=LA_ST[laAreaState(u,a.k)], t=a.t.split(' · ')[0];
      return '<span title="'+esc(t)+'" style="font-size:9.5px;padding:2px 6px;border-radius:8px;background:'+s.bg+';color:'+s.c+';border:.5px solid '+(s.bg==='transparent'?'#e6e3dc':'transparent')+'">'+s.ic+' '+esc(t)+'</span>';
    }).join('')+'</div>'; }
  function laAvatar(u,sz){ sz=sz||28; var C=['#534AB7','#0F6E56','#993C1D','#185FA5','#993556','#854F0B','#3B6D11'];
    var h=C[(String(u.username).charCodeAt(0)+String(u.username).length)%C.length];
    var ini=String(u.name||u.username).trim().slice(0,2).toUpperCase();
    return '<div style="width:'+sz+'px;height:'+sz+'px;border-radius:50%;background:'+h+'1f;color:'+h+';display:flex;align-items:center;justify-content:center;font-size:'+(sz<26?9:10)+'px;font-weight:700;flex:none">'+esc(ini)+'</div>'; }
  function laDeptSelectHTML(id, cur){ return '<select id="'+id+'" style="border:1px solid #d7d3ca;border-radius:7px;padding:7px;font-size:13px;font-family:inherit">'+
    LA_DEPTS.map(function(d){ return '<option value="'+d.k+'"'+(d.k===cur?' selected':'')+'>'+esc(d.t)+'</option>'; }).join('')+'</select>'; }
  /* §user→sales · dropdown เลือกว่า user คนนี้ "คือ" sales คนไหน · ว่าง = ไม่จำกัด (เห็นทุกเอเยนต์)
     ดึงจาก SB_SALES ที่โหลดแล้ว (global) · admin เปิดโมดัลนี้ตอนแอปโหลดเสร็จแล้ว SB_SALES จึงพร้อมเสมอ */
  function laSalesSelectHTML(id, cur){
    var list = (typeof SB_SALES!=='undefined' && Array.isArray(SB_SALES)) ? SB_SALES : [];
    return '<select id="'+id+'" style="border:1px solid #d7d3ca;border-radius:7px;padding:7px;font-size:13px;font-family:inherit">'+
      '<option value="">— ไม่จำกัด (เห็นทุกเอเยนต์) —</option>'+
      list.map(function(s){ return '<option value="'+esc(s.id)+'"'+(s.id===cur?' selected':'')+'>'+esc(s.name||s.code||s.id)+'</option>'; }).join('')+'</select>'; }

  /* ══════════════════════════════════════════════════════════════════════════
     §laUsers2 · หน้าต่างจัดการผู้ใช้ + สิทธิ์เข้าถึง
       ของเดิมเป็นลิสต์เดียวยาว ๆ ในการ์ดกว้าง 760px · ดูออกว่าใครมีสิทธิ์อะไร
       แต่ตอบไม่ได้ว่า "ใครแก้บัญชีได้บ้าง" หรือ "คนไหนถือสิทธิ์เกินงาน"
       ต้องไล่เปิดทีละคน

       สี่หน้าจอ · รายชื่อ (แยกแผนก) · ตารางสิทธิ์ (เทียบทุกคนพร้อมกัน) ·
       ภาพรวม (สรุป + เตือน) · เพิ่มผู้ใช้

       เก็บโครงสิทธิ์เดิมไว้ทั้งหมด ไม่ได้ลดทอน:
         perms     · รายเมนู 59 หน้า ไม่ใช่ราย "พื้นที่" — พื้นที่ที่ถือไม่ครบขึ้นเป็น 4/12
         editAreas · พื้นที่ที่แก้ไขได้ · ไม่อยู่ในนี้ = ดูอย่างเดียว
         role      · admin ข้ามทั้งสองอย่าง
         salesId   · ผูกกับเซลล์ เห็นเฉพาะเอเยนต์ของตัวเอง
         dept      · ไม่ได้ตั้ง = เดาจากคำนำหน้า username

       ตารางสิทธิ์กดแล้วยังไม่ยิงเซิร์ฟเวอร์ทันที · เก็บไว้ก่อนแล้วขึ้นแถบให้กดบันทึก
       เพราะกดพลาดในตารางสิทธิ์คือคนเข้าระบบไม่ได้ทั้งวัน
     ══════════════════════════════════════════════════════════════════════════ */
  window.__laTab='list';
  var LAU={q:'',dept:'',area:'',role:'',hideOff:1,rows:null,err:'',
           draft:null,cur:null,add:null,dirty:{},pwd:null,del:null};

  function lauMenus(k){ return LA_NAV.filter(function(n){ return n.a===k; }); }
  function lauPerms(u){ return laPermViewList(u.perms); }
  function lauEditOf(u){ return Array.isArray(u.editAreas)?u.editAreas.slice():LA_AREAS.map(function(a){return a.k;}); }
  function lauGot(P,k){ var n=0; lauMenus(k).forEach(function(m){ if(P.indexOf(m.v)>=0) n++; }); return n; }
  /* สถานะของพื้นที่หนึ่ง · no = ไม่มีสิทธิ์ · part = ถือบางเมนู · view = ครบแต่ดูอย่างเดียว · edit = ครบและแก้ได้ */
  function lauLvl(role,P,E,k){
    if(role==='admin') return 'edit';
    if(!lauGot(P,k)) return 'no';
    return E.indexOf(k)>=0?'edit':'view';
  }
  /* ถือไม่ครบทุกหน้าในพื้นที่นั้นหรือเปล่า · แยกจากระดับสิทธิ์ ไม่ใช่ระดับที่สี่ */
  function lauPart(role,P,k){
    if(role==='admin') return false;
    var g=lauGot(P,k); return g>0 && g<lauMenus(k).length;
  }
  var LAU_C={overview:'#5B4BC4',operations:'#0F6E56',sales:'#185FA5',accounting:'#7A3FA8',
             fleet:'#8A5A00',pier:'#0E6E7A',config:'#B4436C'};
  function lauAC(k){ return LAU_C[k]||'#5A6270'; }
  function lauArea(k){ return LA_AREAS.filter(function(a){return a.k===k;})[0]||{t:k}; }
  function lauAT(k){ return String(lauArea(k).t).split(' · ')[0]; }
  function lauAS(k){ return String(lauArea(k).t).split(' · ')[1]||''; }
  function lauDeptT(k){ for(var i=0;i<LA_DEPTS.length;i++) if(LA_DEPTS[i].k===k) return LA_DEPTS[i].t; return k; }
  function lauSalesList(){ return (typeof SB_SALES!=='undefined' && Array.isArray(SB_SALES))?SB_SALES:[]; }
  function lauSalesName(id){ var l=lauSalesList(); for(var i=0;i<l.length;i++) if(l[i].id===id) return l[i].name||l[i].code||id; return id; }
  function lauIsMe(u){ return String(u.username)===String(ME.username); }
  function lauAvC(u){ var C=['#534AB7','#0F6E56','#993C1D','#185FA5','#993556','#854F0B','#0E6E7A'];
    var n=String(u.username); return C[(n.charCodeAt(0)+n.length)%C.length]; }

  function lauCSS(){ return ''
   +'#la-uwin{position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.5);backdrop-filter:blur(5px);'
     +'display:flex;align-items:center;justify-content:center;padding:20px;'
     +'font-family:"Sarabun","Noto Sans Thai",sans-serif;color:#0F172A;font-size:14px}'
   +'#la-uwin *{box-sizing:border-box}'
   +'#la-uwin button,#la-uwin input,#la-uwin select{font-family:inherit}'
   +'#la-uwin .shell{width:100%;max-width:1240px;max-height:94vh;background:#F5F7FB;border-radius:26px;'
     +'border:1px solid rgba(15,23,42,.08);box-shadow:0 24px 70px -20px rgba(15,23,42,.34);'
     +'display:flex;flex-direction:column;overflow:hidden}'
   +'#la-uwin .hd{background:rgba(255,255,255,.9);border-bottom:1px solid #E6EAF0;padding:13px 20px;'
     +'display:flex;align-items:center;gap:13px;flex-wrap:wrap;flex:none}'
   +'#la-uwin .hd h1{font-size:16px;font-weight:800;margin:0;letter-spacing:-.01em;line-height:1.25}'
   +'#la-uwin .hd .s{font-size:11.5px;color:#94A3B8;font-weight:500;margin-top:1px}'
   +'#la-uwin .mk{width:38px;height:38px;border-radius:12px;background:#15396B;display:flex;'
     +'align-items:center;justify-content:center;flex:none;color:#9FD3B8;font-size:17px}'
   +'#la-uwin .sp{flex:1}'
   +'#la-uwin .tabs{display:flex;gap:2px;background:#EEF1F6;border:1px solid #E6EAF0;border-radius:99px;padding:4px}'
   +'#la-uwin .tabs button{border:0;background:transparent;border-radius:99px;padding:7px 15px;font-size:12.5px;'
     +'font-weight:600;color:#475569;cursor:pointer;white-space:nowrap}'
   +'#la-uwin .tabs button.on{background:#15396B;color:#fff;font-weight:700}'
   +'#la-uwin .b{border:1px solid #E6EAF0;background:#fff;border-radius:99px;padding:8px 15px;font-size:12.5px;'
     +'font-weight:600;color:#475569;cursor:pointer;white-space:nowrap}'
   +'#la-uwin .b:hover{border-color:#C6CEDA;color:#0F172A}'
   +'#la-uwin .b:disabled{opacity:.42;cursor:not-allowed}'
   +'#la-uwin .b.pri{background:#15396B;border-color:#15396B;color:#fff;font-weight:700}'
   +'#la-uwin .b.dgr{background:#B4392B;border-color:#B4392B;color:#fff;font-weight:700}'
   +'#la-uwin .b.gh{background:#F1F4F8}'
   +'#la-uwin .b.sm{padding:5px 12px;font-size:11.5px}'
   +'#la-uwin .ic{width:34px;height:34px;border-radius:99px;border:1px solid #E6EAF0;background:#fff;'
     +'color:#94A3B8;cursor:pointer;font-size:13px;line-height:1;flex:none}'
   +'#la-uwin .ic:hover{background:#F1F4F8;color:#0F172A}'
   +'#la-uwin .ic:disabled{opacity:.33;cursor:not-allowed}'
   +'#la-uwin .body{flex:1;min-height:0;overflow:auto;padding:17px 20px;display:flex;flex-direction:column;gap:13px}'
   +'#la-uwin .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}'
   +'#la-uwin .stat{background:#fff;border:1px solid #E6EAF0;border-radius:18px;padding:14px 16px;'
     +'display:flex;align-items:center;justify-content:space-between;gap:10px;box-shadow:0 3px 16px -6px rgba(15,23,42,.10)}'
   +'#la-uwin .stat .k{font-size:11.5px;font-weight:600;color:#94A3B8;display:block;margin-bottom:3px}'
   +'#la-uwin .stat .v{font-size:22px;font-weight:800;letter-spacing:-.02em;line-height:1.1}'
   +'#la-uwin .stat .v small{font-size:12px;font-weight:600;color:#94A3B8;margin-left:3px}'
   +'#la-uwin .stat .sic{width:38px;height:38px;border-radius:12px;display:flex;align-items:center;'
     +'justify-content:center;flex:none;font-size:17px}'
   +'#la-uwin .tool{background:#fff;border:1px solid #E6EAF0;border-radius:18px;padding:11px 12px;'
     +'display:flex;gap:9px;align-items:center;flex-wrap:wrap;box-shadow:0 3px 16px -6px rgba(15,23,42,.10)}'
   +'#la-uwin .srch{position:relative;flex:1;min-width:190px;max-width:300px}'
   +'#la-uwin .srch input{width:100%;border:1px solid #E6EAF0;background:#F8FAFC;border-radius:99px;'
     +'padding:9px 14px 9px 34px;font-size:13px;font-weight:500;outline:none}'
   +'#la-uwin .srch input:focus{border-color:#15396B;background:#fff}'
   +'#la-uwin .srch i{position:absolute;left:13px;top:50%;transform:translateY(-50%);color:#94A3B8;font-style:normal}'
   +'#la-uwin select.pill{border:1px solid #E6EAF0;background:#F8FAFC;border-radius:99px;padding:9px 14px;'
     +'font-size:12.5px;font-weight:600;color:#475569;outline:none;cursor:pointer}'
   +'#la-uwin .grp{background:#fff;border:1px solid #E6EAF0;border-radius:18px;padding:15px 16px;margin-bottom:12px;'
     +'box-shadow:0 3px 16px -6px rgba(15,23,42,.10)}'
   +'#la-uwin .grp .gh{display:flex;align-items:center;gap:9px;border-bottom:1px solid #F1F4F8;padding-bottom:10px;margin-bottom:10px}'
   +'#la-uwin .grp .gh h2{font-size:13px;font-weight:800;margin:0}'
   +'#la-uwin .grp .gh .n{background:#EEF1F6;color:#475569;border-radius:99px;padding:1px 9px;font-size:11.5px;font-weight:700}'
   +'#la-uwin .grp .gh .ad{margin-left:auto;border:0;background:none;color:#185FA5;font-size:12px;font-weight:700;cursor:pointer}'
   +'#la-uwin .dot{width:9px;height:9px;border-radius:99px;flex:none}'
   +'#la-uwin .row{display:flex;align-items:center;gap:13px;padding:11px 12px;border:1px solid #F1F4F8;'
     +'border-radius:14px;background:#FBFCFE;margin-bottom:8px;flex-wrap:wrap}'
   +'#la-uwin .row:last-child{margin-bottom:0}'
   +'#la-uwin .row:hover{background:#fff;border-color:#E6EAF0}'
   +'#la-uwin .row.self{background:#F7FBF9;border-color:#D5E9E0}'
   +'#la-uwin .who{display:flex;align-items:center;gap:10px;width:236px;flex:none;min-width:0}'
   +'#la-uwin .av{width:36px;height:36px;border-radius:99px;flex:none;display:flex;align-items:center;'
     +'justify-content:center;font-size:12px;font-weight:800;color:#fff}'
   +'#la-uwin .who .u{font-size:13.5px;font-weight:700;line-height:1.3;display:flex;align-items:center;gap:5px;flex-wrap:wrap}'
   +'#la-uwin .who .u em{font-style:normal;font-weight:600;color:#94A3B8;font-size:12px}'
   +'#la-uwin .who .m{font-size:11.5px;color:#94A3B8;font-weight:500;margin-top:2px}'
   +'#la-uwin .who .m b{color:#475569}'
   +'#la-uwin .bds{flex:1;display:flex;flex-wrap:wrap;gap:5px;min-width:200px}'
   +'#la-uwin .bd{display:inline-flex;align-items:center;gap:5px;border-radius:99px;padding:3px 10px;'
     +'font-size:11.5px;font-weight:700;border:1px solid}'
   +'#la-uwin .bd .fr{font-size:10px;font-weight:800;opacity:.75}'
   +'#la-uwin .bd.off{background:#F5F7FA;border-color:#EDF0F4;color:#CBD5E1;font-weight:500}'
   +'#la-uwin .acts{display:flex;gap:6px;flex:none;margin-left:auto}'
   +'#la-uwin .tg{border-radius:99px;padding:2px 8px;font-size:10px;font-weight:800;letter-spacing:.04em;border:1px solid}'
   +'#la-uwin .tg.adm{background:#FDF1E4;color:#8A5A00;border-color:#F3E0C6}'
   +'#la-uwin .tg.me{background:#E9F3EE;color:#0F6E56;border-color:#C7E3D6}'
   +'#la-uwin .tg.sl{background:#EAF1FA;color:#185FA5;border-color:#CFE0F3}'
   +'#la-uwin .mx{background:#fff;border:1px solid #E6EAF0;border-radius:18px;overflow:auto}'
   +'#la-uwin table{border-collapse:separate;border-spacing:0;width:100%}'
   +'#la-uwin .mx th,#la-uwin .mx td{padding:10px;font-size:12.5px;text-align:center;white-space:nowrap}'
   +'#la-uwin .mx thead th{background:#F7F9FC;border-bottom:1px solid #E6EAF0;font-size:11px;font-weight:800;'
     +'color:#475569;position:sticky;top:0;z-index:3}'
   +'#la-uwin .mx th.nm,#la-uwin .mx td.nm{text-align:left;position:sticky;left:0;background:#fff;z-index:2;'
     +'border-right:1px solid #F1F4F8;min-width:190px}'
   +'#la-uwin .mx thead th.nm{background:#F7F9FC;z-index:4}'
   +'#la-uwin .mx tbody td{border-bottom:1px solid #F1F4F8}'
   +'#la-uwin .mx tr.dt td,#la-uwin .mx tr.dt td.nm{background:#FFFCF3}'
   +'#la-uwin .cl{width:34px;height:30px;border-radius:9px;border:1px solid transparent;cursor:pointer;'
     +'font-size:11px;font-weight:800;line-height:1}'
   +'#la-uwin .cl.no{background:#F1F4F8;color:#D2D9E2;border-color:#EAEEF3}'
   +'#la-uwin .cl.pt{border-style:dashed;border-width:1.5px;font-size:9.5px;letter-spacing:-.02em}'
   +'#la-uwin .cl.view{background:#E7F0FA;color:#185FA5;border-color:#CADCF0}'
   +'#la-uwin .cl.edit{background:#0F6E56;color:#fff;border-color:#0F6E56}'
   +'#la-uwin .lg{display:flex;gap:15px;align-items:center;padding:11px 14px;font-size:11.5px;color:#475569;'
     +'border-top:1px solid #F1F4F8;background:#FBFCFE;flex-wrap:wrap}'
   +'#la-uwin .lg span{display:inline-flex;align-items:center;gap:7px}'
   +'#la-uwin .savebar{position:sticky;bottom:0;background:#FFFBF0;border:1px solid #F0E1C2;border-radius:14px;'
     +'padding:10px 14px;display:flex;align-items:center;gap:12px;font-size:12.5px;font-weight:600;color:#8A5A00;'
     +'box-shadow:0 -6px 18px -10px rgba(15,23,42,.24);margin-top:10px}'
   +'#la-uwin .ov{display:grid;grid-template-columns:2fr 1fr;gap:13px}'
   +'#la-uwin .card{background:#fff;border:1px solid #E6EAF0;border-radius:18px;padding:18px;'
     +'box-shadow:0 3px 16px -6px rgba(15,23,42,.10)}'
   +'#la-uwin .card h3{font-size:14px;font-weight:800;margin:0 0 14px}'
   +'#la-uwin .bars{display:grid;grid-template-columns:1fr 1fr;gap:11px}'
   +'#la-uwin .bar{background:#F8FAFC;border:1px solid #F1F4F8;border-radius:14px;padding:12px 13px}'
   +'#la-uwin .bar .t{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;'
     +'font-size:12.5px;font-weight:700}'
   +'#la-uwin .bar .t .c{background:#15396B;color:#fff;border-radius:99px;padding:1px 9px;font-size:11px;font-weight:700}'
   +'#la-uwin .bar .tr{height:7px;border-radius:99px;background:#E7EBF1;overflow:hidden;display:flex}'
   +'#la-uwin .bar .f1{background:#0F6E56}#la-uwin .bar .f2{background:#9DC4E8}'
   +'#la-uwin .bar .cap{font-size:10.5px;color:#94A3B8;margin-top:6px;font-weight:500}'
   +'#la-uwin .note{background:linear-gradient(150deg,#123A5E,#0E5A6E 60%,#0F6E56);color:#fff;border-radius:18px;'
     +'padding:20px;display:flex;flex-direction:column;justify-content:space-between;min-height:250px;position:relative;overflow:hidden}'
   +'#la-uwin .note .bl{position:absolute;right:-60px;bottom:-70px;width:220px;height:220px;border-radius:99px;background:rgba(255,255,255,.09)}'
   +'#la-uwin .note .kk{display:inline-flex;background:rgba(255,255,255,.16);border-radius:99px;padding:4px 12px;'
     +'font-size:11.5px;font-weight:700;margin-bottom:13px;position:relative}'
   +'#la-uwin .note h3{font-size:16.5px;font-weight:800;line-height:1.5;margin:0 0 9px;position:relative}'
   +'#la-uwin .note p{font-size:12.5px;line-height:1.85;color:rgba(255,255,255,.84);margin:0;position:relative}'
   +'#la-uwin .note .nf{border-top:1px solid rgba(255,255,255,.22);padding-top:13px;margin-top:16px;display:flex;'
     +'justify-content:space-between;align-items:center;font-size:12px;font-weight:700;position:relative}'
   +'#la-uwin .note .nf b{background:#fff;color:#0E4A3C;border-radius:99px;padding:3px 12px}'
   +'#la-uwin .ftr{background:#fff;border-top:1px solid #E6EAF0;padding:10px 20px;display:flex;'
     +'justify-content:space-between;align-items:center;font-size:11.5px;color:#94A3B8;font-weight:500;flex:none}'
   +'#la-uwin .fg{display:grid;grid-template-columns:1fr 1fr;gap:11px}'
   +'#la-uwin .f{margin-bottom:11px}'
   +'#la-uwin .f label{display:block;font-size:11px;font-weight:700;color:#475569;letter-spacing:.03em;margin-bottom:5px}'
   +'#la-uwin .f input,#la-uwin .f select{width:100%;border:1px solid #E6EAF0;background:#F8FAFC;border-radius:10px;'
     +'padding:10px 13px;font-size:13px;font-weight:500;outline:none}'
   +'#la-uwin .f input:focus,#la-uwin .f select:focus{border-color:#15396B;background:#fff}'
   +'#la-uwin .f .hint{font-size:11px;color:#94A3B8;margin-top:5px;line-height:1.6}'
   +'#la-uwin .sect{font-size:11.5px;font-weight:800;color:#475569;letter-spacing:.04em;margin:18px 0 9px;'
     +'padding-top:14px;border-top:1px solid #F1F4F8}'
   +'#la-uwin .pset{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:13px}'
   +'#la-uwin .pset .pl{font-size:11.5px;color:#94A3B8;font-weight:600}'
   +'#la-uwin .pset button{border:1px solid #E6EAF0;background:#F8FAFC;border-radius:99px;padding:5px 12px;'
     +'font-size:11.5px;font-weight:700;color:#475569;cursor:pointer}'
   +'#la-uwin .ar{border:1px solid #E6EAF0;border-radius:14px;margin-bottom:9px;overflow:hidden;background:#fff}'
   +'#la-uwin .ar.has{border-color:#BFD4EE;background:#FBFDFF}'
   +'#la-uwin .ar .top{display:flex;align-items:center;gap:10px;padding:10px 12px}'
   +'#la-uwin .ar .nm{flex:1;min-width:0}'
   +'#la-uwin .ar .nm b{display:block;font-size:13px;font-weight:700}'
   +'#la-uwin .ar .nm span{display:block;font-size:11px;color:#94A3B8;font-weight:500;margin-top:1px}'
   +'#la-uwin .fr2{background:#EEF1F6;color:#475569;border-radius:99px;padding:1px 8px;font-size:10.5px;font-weight:800;flex:none}'
   +'#la-uwin .fr2.part{background:#FDF4E3;color:#8A5A00}'
   +'#la-uwin .fr2.all{background:#E9F3EE;color:#0F6E56}'
   +'#la-uwin .seg{display:flex;border:1px solid #E6EAF0;border-radius:99px;overflow:hidden;background:#fff;flex:none}'
   +'#la-uwin .seg button{border:0;background:#fff;padding:5px 11px;font-size:11px;font-weight:700;color:#94A3B8;cursor:pointer}'
   +'#la-uwin .seg button+button{border-left:1px solid #E6EAF0}'
   +'#la-uwin .seg button.on.v{background:#185FA5;color:#fff}'
   +'#la-uwin .seg button.on.e{background:#0F6E56;color:#fff}'
   +'#la-uwin .seg button.on.n{background:#98A2B0;color:#fff}'
   +'#la-uwin .ar .ex{border:0;background:none;color:#94A3B8;font-size:11.5px;font-weight:700;cursor:pointer;flex:none}'
   +'#la-uwin .mns{display:none;padding:2px 12px 11px;flex-wrap:wrap;gap:5px}'
   +'#la-uwin .ar.open .mns{display:flex}'
   +'#la-uwin .mn{border:1px solid #E6EAF0;background:#fff;border-radius:99px;padding:3px 10px;font-size:11px;'
     +'font-weight:600;color:#94A3B8;cursor:pointer;user-select:none}'
   +'#la-uwin .mn.on{background:#E9F3EE;border-color:#BFE0CD;color:#0F6E56}'
   +'#la-uwin .mask{position:fixed;inset:0;z-index:100001;background:rgba(15,23,42,.46);backdrop-filter:blur(4px);'
     +'display:flex;align-items:center;justify-content:center;padding:20px}'
   +'#la-uwin .dlg{background:#fff;border-radius:22px;box-shadow:0 28px 80px -18px rgba(15,23,42,.5);'
     +'width:100%;max-width:620px;max-height:90vh;display:flex;flex-direction:column;overflow:hidden}'
   +'#la-uwin .dlg.sm{max-width:420px}'
   +'#la-uwin .dlg .dh{background:#F8FAFC;border-bottom:1px solid #E6EAF0;padding:15px 20px;display:flex;'
     +'justify-content:space-between;align-items:center;gap:12px;flex:none}'
   +'#la-uwin .dlg .dh h3{font-size:15px;font-weight:800;margin:0}'
   +'#la-uwin .dlg .dh p{font-size:12px;color:#94A3B8;margin:2px 0 0;font-weight:500}'
   +'#la-uwin .dlg .db{padding:16px 20px;overflow:auto;flex:1;min-height:0}'
   +'#la-uwin .dlg .df{background:#F8FAFC;border-top:1px solid #E6EAF0;padding:13px 20px;display:flex;'
     +'justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;flex:none}'
   +'#la-uwin .tst{position:fixed;right:22px;bottom:22px;z-index:100002;background:#0F172A;color:#fff;'
     +'border-radius:99px;padding:11px 18px;font-size:12.5px;font-weight:600;display:flex;align-items:center;gap:10px;'
     +'box-shadow:0 14px 34px -10px rgba(15,23,42,.6)}'
   +'#la-uwin .tst i{width:8px;height:8px;border-radius:99px;background:#34D399;display:block;flex:none;font-style:normal}'
   +'#la-uwin .tst.err i{background:#F87171}'
   +'@media(max-width:900px){#la-uwin .stats{grid-template-columns:repeat(2,1fr)}'
     +'#la-uwin .ov{grid-template-columns:1fr}#la-uwin .who{width:auto}#la-uwin .acts{margin-left:0}'
     +'#la-uwin .fg{grid-template-columns:1fr}}';
  }

  /* ── หน้าต่างหลัก ── */
  window.__laUsers=function(){
    var old=document.getElementById('la-uwin'); if(old) old.remove();
    if(!document.getElementById('la-uwin-css')){
      var st=document.createElement('style'); st.id='la-uwin-css'; st.textContent=lauCSS();
      document.head.appendChild(st);
    }
    window.__laTab='list';
    LAU={q:'',dept:'',area:'',role:'',hideOff:1,rows:null,err:'',draft:null,cur:null,add:null,dirty:{},pwd:null,del:null};
    var ov=document.createElement('div'); ov.id='la-uwin';
    ov.onclick=function(e){ if(e.target===ov) __laClose(); };
    ov.innerHTML='<div class="shell">'
      +'<div class="hd">'
        +'<div class="mk">&#9783;</div>'
        +'<div><h1>จัดการผู้ใช้ + สิทธิ์เข้าถึง</h1><div class="s">LOVE Andaman · Operations</div></div>'
        +'<div class="sp"></div>'
        +'<div class="tabs" id="la-tabs"></div>'
        +'<button class="ic" onclick="__laClose()">&#10005;</button>'
      +'</div>'
      +'<div class="body"><div class="stats" id="la-stats"></div>'
        +'<div class="tool" id="la-tool"></div><div id="la-main"></div></div>'
      +'<div class="ftr"><span id="la-ftl">—</span><span>ผู้ใช้ต้องออกแล้วเข้าใหม่ สิทธิ์ใหม่จึงจะมีผล</span></div>'
    +'</div>';
    document.body.appendChild(ov);
    __laLoadUsers();
  };
  window.__laClose=function(){ var w=document.getElementById('la-uwin'); if(w) w.remove(); };
  window.__laSetTab=function(t){
    if(Object.keys(LAU.dirty).length && t!=='matrix'){
      if(!confirm('ยังมีสิทธิ์ที่แก้ในตารางแต่ยังไม่ได้บันทึก · ออกจากแท็บนี้แล้วจะหายไป')) return;
      LAU.dirty={};
    }
    window.__laTab=t; __laRender();
  };
  window.__laFld=function(k,v){ LAU[k]=v; __laRender(); };
  /* inline onclick/oninput อยู่นอก closure นี้ · มองไม่เห็นตัวแปร LAU ตรง ๆ
     ต้องผ่านตัวช่วยที่แขวนไว้บน window เท่านั้น */
  window.__laAddSet=function(k,v){ if(!LAU.add) return; LAU.add[k]=v;
    if(k==='role') __laRender(); else if(k==='u') __laAddHint(); };
  window.__laAddCancel=function(){ LAU.add=null; __laSetTab('list'); };
  window.__laDirtyDrop=function(){ LAU.dirty={}; __laRender(); };
  window.__laToggleOff=function(){ LAU.hideOff=LAU.hideOff?0:1; __laRender(); };

  window.__laLoadUsers=function(){
    var m=document.getElementById('la-main');
    if(m) m.innerHTML='<div class="card" style="text-align:center;padding:40px;color:#94A3B8">กำลังโหลดรายชื่อ…</div>';
    var r=sx('GET','/api/users');
    if(r.status!==200||!r.json){ LAU.rows=null; LAU.err=(r.json&&r.json.error)||('โหลดรายชื่อไม่ได้ (HTTP '+r.status+')'); }
    else { LAU.err=''; LAU.rows=(r.json.users||[]).map(function(u){
      return {id:u.id,username:u.username,name:u.name||'',role:u.role||'staff',
              dept:laDeptOf(u),salesId:u.salesId||'',
              /* §permExplicit · raw = ค่าที่เก็บไว้จริง ๆ · perms = ที่คลี่เป็นรายเมนูแล้ว
                 หมุด '*explicit' ไม่ใช่ชื่อเมนู จึงหายไปตอนคลี่ ต้องเก็บต้นฉบับไว้ดูเอง */
              raw:(Array.isArray(u.perms)?u.perms.slice():null),
              perms:lauPerms(u),edit:lauEditOf(u)}; }); }
    __laRender();
  };

  function lauToast(msg,err){
    var w=document.getElementById('la-uwin'); if(!w) return;
    var t=w.querySelector('.tst'); if(t) t.remove();
    var d=document.createElement('div'); d.className='tst'+(err?' err':'');
    d.innerHTML='<i></i><span></span>'; d.querySelector('span').textContent=msg;
    w.appendChild(d); setTimeout(function(){ try{ d.remove(); }catch(_){} },2800);
  }

  function lauFiltered(){
    var q=String(LAU.q||'').toLowerCase();
    return (LAU.rows||[]).filter(function(u){
      if(q && (u.username+' '+u.name).toLowerCase().indexOf(q)<0) return false;
      if(LAU.dept && u.dept!==LAU.dept) return false;
      if(LAU.area && lauLvl(u.role,u.perms,u.edit,LAU.area)==='no') return false;
      if(LAU.role==='admin' && u.role!=='admin') return false;
      if(LAU.role==='staff' && u.role==='admin') return false;
      if(LAU.role==='ro' && (u.role==='admin'||u.edit.length)) return false;
      if(LAU.role==='sales' && !u.salesId) return false;
      return true;
    });
  }

  window.__laRender=function(){
    var w=document.getElementById('la-uwin'); if(!w) return;
    var T=window.__laTab;
    document.getElementById('la-tabs').innerHTML=[['list','รายชื่อ'],['matrix','ตารางสิทธิ์'],
      ['ov','ภาพรวม'],['add','+ เพิ่มผู้ใช้']].map(function(p){
        return '<button class="'+(T===p[0]?'on':'')+'" onclick="__laSetTab(\''+p[0]+'\')">'+p[1]+'</button>'; }).join('');

    var US=LAU.rows||[];
    document.getElementById('la-stats').innerHTML=lauStats(US);
    document.getElementById('la-ftl').textContent = LAU.err ? LAU.err : (US.length+' บัญชี');

    var tool=document.getElementById('la-tool');
    tool.style.display=(T==='add')?'none':'';
    if(T!=='add') tool.innerHTML=lauTool();

    var el=document.getElementById('la-main');
    if(LAU.err){ el.innerHTML='<div class="card" style="text-align:center;padding:36px">'
      +'<div style="font-size:13px;font-weight:700;color:#B4392B">'+esc(LAU.err)+'</div>'
      +'<button class="b" style="margin-top:12px" onclick="__laLoadUsers()">ลองใหม่</button></div>'; return; }
    var F=lauFiltered();
    el.innerHTML = T==='list' ? lauList(F) : T==='matrix' ? lauMatrix(F)
                 : T==='ov' ? lauOverview(US) : lauAdd();
    if(T==='add') __laAddHint();
  };

  function lauStats(US){
    var n=US.length, adm=0, ro=0, sl=0;
    US.forEach(function(u){ if(u.role==='admin') adm++;
      else { if(!u.edit.length) ro++; } if(u.salesId) sl++; });
    var S=[['ผู้ใช้ทั้งหมด',n,'คน','#15396B','👥'],
           ['ผู้ดูแลระบบ',adm,'คน','#8A5A00','🔑'],
           ['ดูอย่างเดียว',ro,'คน','#185FA5','👁'],
           ['ผูกกับเซลล์',sl,'คน','#0F6E56','🏷']];
    return S.map(function(x){ return '<div class="stat"><div><span class="k">'+x[0]+'</span>'
      +'<div class="v">'+x[1]+'<small>'+x[2]+'</small></div></div>'
      +'<div class="sic" style="background:'+x[3]+'18;color:'+x[3]+'">'+x[4]+'</div></div>'; }).join('');
  }

  function lauTool(){
    var opt=function(v,t,cur){ return '<option value="'+esc(v)+'"'+(cur===v?' selected':'')+'>'+esc(t)+'</option>'; };
    return '<div class="srch"><i>&#128269;</i>'
      +'<input value="'+esc(LAU.q)+'" placeholder="ค้นหา username หรือ ชื่อ…" oninput="__laFld(\'q\',this.value)"></div>'
      +'<select class="pill" onchange="__laFld(\'dept\',this.value)">'+opt('','ทุกแผนก',LAU.dept)
        +LA_DEPTS.map(function(d){ return opt(d.k,d.t,LAU.dept); }).join('')+'</select>'
      +'<select class="pill" onchange="__laFld(\'area\',this.value)">'+opt('','ทุกพื้นที่',LAU.area)
        +LA_AREAS.map(function(a){ return opt(a.k,lauAT(a.k),LAU.area); }).join('')+'</select>'
      +'<select class="pill" onchange="__laFld(\'role\',this.value)">'+opt('','ทุกบทบาท',LAU.role)
        +opt('admin','admin',LAU.role)+opt('staff','staff',LAU.role)
        +opt('ro','ดูอย่างเดียว',LAU.role)+opt('sales','ผูกกับเซลล์',LAU.role)+'</select>'
      +'<div class="sp"></div>'
      +'<button class="b gh" onclick="__laToggleOff()">'+(LAU.hideOff?'ซ่อนพื้นที่ที่ไม่มีสิทธิ์':'แสดงทุกพื้นที่')+'</button>';
  }

  /* ── รายชื่อ ── */
  function lauList(F){
    if(!F.length) return '<div class="card" style="text-align:center;padding:44px">'
      +'<div style="font-weight:700">ไม่พบผู้ใช้ที่ตรงเงื่อนไข</div>'
      +'<div style="font-size:12px;color:#94A3B8;margin-top:4px">ลองเปลี่ยนคำค้นหรือตัวกรอง</div></div>';
    var by={}; F.forEach(function(u){ (by[u.dept]=by[u.dept]||[]).push(u); });
    return LA_DEPTS.filter(function(d){ return by[d.k]; }).map(function(d){
      var ms=by[d.k];
      return '<div class="grp"><div class="gh"><span class="dot" style="background:'+lauAvC(ms[0])+'"></span>'
        +'<h2>'+esc(d.t)+'</h2><span class="n">'+ms.length+'</span>'
        +'<button class="ad" onclick="__laSetTab(\'add\')">+ เพิ่มผู้ใช้</button></div>'
        +ms.map(lauRow).join('')+'</div>';
    }).join('');
  }
  function lauRow(u){
    var me=lauIsMe(u);
    var bds = u.role==='admin'
      ? '<span class="bd" style="background:#FDF1E4;border-color:#F3E0C6;color:#8A5A00">ทุกพื้นที่ · แก้ได้ทุกอย่าง</span>'
      : LA_AREAS.map(function(a){
          var L=lauLvl(u.role,u.perms,u.edit,a.k);
          if(L==='no') return LAU.hideOff?'':'<span class="bd off">'+esc(lauAT(a.k))+'</span>';
          var g=lauGot(u.perms,a.k), n=lauMenus(a.k).length, C=lauAC(a.k);
          return '<span class="bd" style="background:'+C+'14;border-color:'+C+'33;color:'+C+'">'
            +esc(lauAT(a.k))+(lauPart(u.role,u.perms,a.k)?('<span class="fr">'+g+'/'+n+'</span>'):'')
            +'<span style="font-size:10px;opacity:.9">'+(L==='edit'?'✎':'👁')+'</span></span>';
        }).join('');
    return '<div class="row'+(me?' self':'')+'">'
      +'<div class="who"><div class="av" style="background:'+lauAvC(u)+'">'
        +esc(String(u.name||u.username).trim().slice(0,2).toUpperCase())+'</div>'
        +'<div style="min-width:0"><div class="u">'+esc(u.username)
          +(u.name?(' <em>('+esc(u.name)+')</em>'):'')
          +(u.role==='admin'?'<span class="tg adm">ADMIN</span>':'')
          +(me?'<span class="tg me">คุณ</span>':'')
          +(u.salesId?('<span class="tg sl" title="เห็นเฉพาะเอเยนต์ของเซลล์คนนี้">'+esc(lauSalesName(u.salesId))+'</span>'):'')
        +'</div><div class="m">'+(u.role==='admin'?LA_NAV.length:u.perms.length)+' เมนู · <b>'
          +(u.role==='admin'?'admin':(u.edit.length?(u.edit.length+' พื้นที่แก้ไขได้'):'ดูอย่างเดียว'))+'</b></div></div></div>'
      +'<div class="bds">'+(bds||'<span style="font-size:12px;color:#CBD5E1">ยังไม่มีสิทธิ์เข้าหน้าไหนเลย</span>')+'</div>'
      +'<div class="acts">'
        +'<button class="b sm" onclick="__laEditPerms('+u.id+')">สิทธิ์</button>'
        +'<button class="b sm" onclick="__laReset('+u.id+')">รหัสผ่าน</button>'
        +'<button class="ic" title="'+(me?'ลบบัญชีตัวเองไม่ได้':'ลบผู้ใช้')+'"'+(me?' disabled':'')
          +' onclick="__laDelUser('+u.id+')">&#128465;</button>'
      +'</div></div>';
  }

  /* ── ตารางสิทธิ์ ── */
  function lauDraftOf(u){ var d=LAU.dirty[u.id]; return d?d:{perms:u.perms,edit:u.edit}; }
  function lauMatrix(F){
    var nd=Object.keys(LAU.dirty).length;
    return '<div class="mx"><table><thead><tr><th class="nm">ผู้ใช้งาน</th><th>แผนก</th>'
      +LA_AREAS.map(function(a){ return '<th>'+esc(lauAT(a.k))
        +'<div style="font-size:9.5px;font-weight:600;color:#94A3B8;margin-top:2px">'+lauMenus(a.k).length+' เมนู</div></th>'; }).join('')
      +'</tr></thead><tbody>'
      +F.map(function(u){ var D=lauDraftOf(u), dirty=!!LAU.dirty[u.id];
        return '<tr class="'+(dirty?'dt':'')+'"><td class="nm"><b style="font-size:13px">'+esc(u.username)+'</b>'
          +(u.name?('<span style="color:#94A3B8;font-weight:600;font-size:11.5px"> ('+esc(u.name)+')</span>'):'')
          +(u.role==='admin'?'<span class="tg adm">ADMIN</span>':'')
          +(lauIsMe(u)?'<span class="tg me">คุณ</span>':'')+'</td>'
          +'<td style="font-size:11.5px;color:#475569;font-weight:600">'+esc(lauDeptT(u.dept))+'</td>'
          +LA_AREAS.map(function(a){
              var L=lauLvl(u.role,D.perms,D.edit,a.k), g=lauGot(D.perms,a.k), n=lauMenus(a.k).length;
              var pt=lauPart(u.role,D.perms,a.k);
              var lab=L==='no'?'·':(pt?(g+'/'+n):(L==='edit'?'✎':'👁'));
              var ti=u.role==='admin'?'admin · แก้ได้ทุกอย่าง'
                : L==='no' ? 'ไม่มีสิทธิ์'
                : (pt?(g+' จาก '+n+' เมนู'):'ทุกเมนู')+' · '+(L==='edit'?'แก้ไขได้':'ดูอย่างเดียว');
              return '<td><button class="cl '+L+(pt?' pt':'')+'" title="'+esc(ti)+'"'
                +(u.role==='admin'?' disabled style="cursor:default"':(' onclick="__laCycle('+u.id+',\''+a.k+'\')"'))
                +'>'+lab+'</button></td>'; }).join('')
          +'</tr>'; }).join('')
      +'</tbody></table>'
      +'<div class="lg">'
        +'<span><span class="cl no" style="display:inline-flex;align-items:center;justify-content:center">&#183;</span> ไม่มีสิทธิ์</span>'
        +'<span><span class="cl view" style="display:inline-flex;align-items:center;justify-content:center">&#128065;</span> ดูอย่างเดียว</span>'
        +'<span><span class="cl edit" style="display:inline-flex;align-items:center;justify-content:center">&#9998;</span> แก้ไขได้</span>'
        +'<span><span class="cl view pt" style="display:inline-flex;align-items:center;justify-content:center;font-size:9px">3/12</span>'
          +' ตัวเลข = ถือไม่ครบทุกหน้า (สียังบอกว่าดูหรือแก้)</span>'
        +'<span style="color:#94A3B8;margin-left:auto">คลิกเพื่อวน · เลือกรายหน้าได้ที่ปุ่ม “สิทธิ์”</span>'
      +'</div></div>'
      +(nd?('<div class="savebar">&#9888; แก้สิทธิ์ไว้ '+nd+' คน ยังไม่ได้บันทึก<div class="sp"></div>'
        +'<button class="b" onclick="__laDirtyDrop()">ทิ้งการแก้ไข</button>'
        +'<button class="b pri" onclick="__laSaveMatrix()">บันทึกทั้งหมด</button></div>'):'');
  }
  window.__laCycle=function(id,k){
    var u=(LAU.rows||[]).filter(function(x){return x.id===id;})[0]; if(!u||u.role==='admin') return;
    var D=LAU.dirty[id]||{perms:u.perms.slice(),edit:u.edit.slice()};
    var L=lauLvl(u.role,D.perms,D.edit,k), M=lauMenus(k).map(function(m){return m.v;});
    /* วน ไม่มี → ดู → แก้ไข → ไม่มี · พื้นที่ที่เลือกไว้บางหน้า กดแล้วยังคงหน้าที่เลือกไว้เท่าเดิม
       เปลี่ยนแค่ดู/แก้ · จะเปิดครบทุกหน้าต้องไปกดที่ปุ่ม "สิทธิ์" ซึ่งเห็นรายชื่อหน้าจริง */
    if(L==='no'){ D.perms=D.perms.concat(M); D.edit=D.edit.filter(function(x){return x!==k;}); }
    else if(L==='view'){ D.edit.push(k); }
    else { D.perms=D.perms.filter(function(v){ return M.indexOf(v)<0; });
      D.edit=D.edit.filter(function(x){return x!==k;}); }
    LAU.dirty[id]=D; __laRender();
  };
  window.__laSaveMatrix=function(){
    var ids=Object.keys(LAU.dirty), ok=0, bad=[];
    ids.forEach(function(id){
      var u=(LAU.rows||[]).filter(function(x){return String(x.id)===String(id);})[0]; if(!u) return;
      var D=LAU.dirty[id];
      var r=sx('POST','/api/users/perms',JSON.stringify({id:u.id,role:u.role,dept:u.dept,
        perms:laPermSeal(D.perms),editAreas:D.edit,salesId:u.salesId}),'application/json');
      if(r.status===200) ok++; else bad.push(u.username);
    });
    LAU.dirty={};
    lauToast(bad.length?('บันทึกไม่สำเร็จ: '+bad.join(', ')):('บันทึกสิทธิ์แล้ว '+ok+' คน'), bad.length);
    __laLoadUsers();
  };

  /* ── ภาพรวม ── */
  function lauOverview(US){
    var n=US.length||1;
    var bars=LA_AREAS.map(function(a){
      var e=0,v=0;
      US.forEach(function(u){ var L=lauLvl(u.role,u.perms,u.edit,a.k);
        if(L==='no') return; if(L==='edit') e++; else v++; });
      var C=lauAC(a.k);
      return '<div class="bar"><div class="t"><span style="color:'+C+'">'+esc(lauAT(a.k))+'</span>'
        +'<span class="c">'+(e+v)+' คน</span></div>'
        +'<div class="tr"><div class="f1" style="width:'+(e/n*100)+'%"></div>'
          +'<div class="f2" style="width:'+(v/n*100)+'%"></div></div>'
        +'<div class="cap">✎ แก้ไขได้ '+e+' · 👁 ดู/บางส่วน '+v+' · ไม่มีสิทธิ์ '+(US.length-e-v)+'</div></div>';
    }).join('');
    var wide=US.filter(function(u){ return u.role!=='admin' && u.perms.length>=LA_NAV.length*0.6; });
    var none=US.filter(function(u){ return u.role!=='admin' && !u.perms.length; });
    var adm =US.filter(function(u){ return u.role==='admin'; });
    var iss=[];
    if(wide.length) iss.push('<b>'+wide.length+' บัญชีถือสิทธิ์กว้าง</b> — '
      +esc(wide.map(function(u){return u.username;}).join(' · '))+' เข้าได้เกิน 60% ของเมนูทั้งหมด');
    if(none.length) iss.push('<b>'+none.length+' บัญชีเข้าไม่ได้เลย</b> — '
      +esc(none.map(function(u){return u.username;}).join(' · '))+' ล็อกอินได้แต่ไม่มีหน้าให้เปิด');
    if(adm.length>2) iss.push('<b>admin '+adm.length+' บัญชี</b> — '+esc(adm.map(function(u){return u.username;}).join(' · ')));
    return '<div class="ov"><div class="card"><h3>สิทธิ์แยกตามพื้นที่</h3><div class="bars">'+bars+'</div></div>'
      +'<div class="note"><div class="bl"></div><div><span class="kk">ตรวจสิทธิ์</span>'
        +'<h3>'+(iss.length?('พบ '+iss.length+' เรื่องที่ควรทบทวน'):'ไม่พบสิทธิ์ที่เกินงาน')+'</h3>'
        +'<p>'+(iss.length?iss.join('<br><br>'):'ทุกบัญชีถือสิทธิ์เท่าที่งานต้องใช้')+'</p></div>'
        +'<div class="nf"><span>บัญชีที่แก้ไขข้อมูลได้</span><b>'
          +US.filter(function(u){ return u.role==='admin'||u.edit.length; }).length+' / '+US.length+'</b></div></div></div>';
  }

  /* ── ตัวเลือกสิทธิ์ · ใช้ร่วมกันทั้งหน้าเพิ่มและหน้าต่างแก้ ── */
  function lauPermHTML(D,pfx){
    return LA_AREAS.map(function(a){
      var M=lauMenus(a.k), g=lauGot(D.perms,a.k), ed=D.edit.indexOf(a.k)>=0;
      var L=!g?'no':(ed?'edit':'view'), pt=(g>0&&g<M.length);
      return '<div class="ar '+(g?'has':'')+'" id="'+pfx+'-ar-'+a.k+'">'
        +'<div class="top"><span class="dot" style="background:'+lauAC(a.k)+'"></span>'
          +'<div class="nm"><b>'+esc(lauAT(a.k))+'</b><span>'+esc(lauAS(a.k))+'</span></div>'
          +'<span class="fr2 '+(pt?'part':(g?'all':''))+'" title="'+(pt?('ถือ '+g+' จาก '+M.length+' หน้า'):(g?'ครบทุกหน้า':'ไม่มีสิทธิ์'))+'">'+g+'/'+M.length+'</span>'
          +'<button class="ex" onclick="document.getElementById(\''+pfx+'-ar-'+a.k+'\').classList.toggle(\'open\')">เมนู &#9662;</button>'
          +'<div class="seg">'
            +'<button class="'+(L==='no'?'on n':'')+'" onclick="__laSetArea(\''+pfx+'\',\''+a.k+'\',\'no\')">ไม่มี</button>'
            +'<button class="'+(L==='view'?'on v':'')+'" onclick="__laSetArea(\''+pfx+'\',\''+a.k+'\',\'view\')">ดู</button>'
            +'<button class="'+(L==='edit'?'on e':'')+'" onclick="__laSetArea(\''+pfx+'\',\''+a.k+'\',\'edit\')">แก้ไข</button>'
          +'</div></div>'
        +'<div class="mns">'+M.map(function(m){
            return '<span class="mn '+(D.perms.indexOf(m.v)>=0?'on':'')+'" onclick="__laTogMenu(\''+pfx+'\',\''+a.k+'\',\''+m.v+'\')">'
              +esc(m.t)+'</span>'; }).join('')+'</div></div>';
    }).join('');
  }
  function lauTarget(pfx){ return pfx==='a'?LAU.add:LAU.draft; }
  function lauRepaint(pfx){
    var el=document.getElementById(pfx==='a'?'la-aperm':'la-pbody'); if(!el) return;
    var open=[]; Array.prototype.forEach.call(el.querySelectorAll('.ar.open'),function(x){ open.push(x.id); });
    el.innerHTML=lauPermHTML(lauTarget(pfx),pfx);
    open.forEach(function(id){ var n=document.getElementById(id); if(n) n.classList.add('open'); });
  }
  /* ปุ่มชุดนี้ตอบคำถามเดียว · "ดูหรือแก้ได้" · ไม่ใช่ "กี่หน้า"
     กดบนพื้นที่ที่ติ๊กหน้าไว้บางส่วนแล้ว จะคงหน้าที่ติ๊กไว้เท่าเดิม เปลี่ยนแค่สิทธิ์แก้ไข
     (ของเดิมกดแล้วเปิดครบทุกหน้าให้เงียบ ๆ · คนที่ตั้งใจให้เห็นแค่ 4 หน้าจะได้ทั้ง 12 หน้าไปโดยไม่รู้ตัว)
     ยกเว้นพื้นที่ที่ยังไม่มีสิทธิ์เลย · กดดู/แก้ = เปิดให้ทั้งพื้นที่ เพราะเป็นสิ่งที่ตั้งใจแน่ ๆ */
  window.__laSetArea=function(pfx,k,L){
    var D=lauTarget(pfx), M=lauMenus(k).map(function(m){return m.v;});
    var g=lauGot(D.perms,k);
    D.edit=D.edit.filter(function(x){ return x!==k; });
    if(L==='no'){ D.perms=D.perms.filter(function(v){ return M.indexOf(v)<0; }); }
    else {
      if(!g) D.perms=D.perms.concat(M);
      if(L==='edit') D.edit.push(k);
    }
    lauRepaint(pfx);
  };
  window.__laTogMenu=function(pfx,k,v){
    var D=lauTarget(pfx);
    if(D.perms.indexOf(v)>=0) D.perms=D.perms.filter(function(x){ return x!==v; }); else D.perms.push(v);
    var M=lauMenus(k).map(function(m){return m.v;});
    if(!M.some(function(x){ return D.perms.indexOf(x)>=0; })) D.edit=D.edit.filter(function(x){ return x!==k; });
    lauRepaint(pfx);
  };
  function lauPresetKeys(name){
    return name==='ALL'?LA_AREAS.map(function(a){return a.k;}) : name==='NONE'?[] : (LA_PRESETS[name]||[]);
  }
  window.__laPreset=function(pfx,name){
    var D=lauTarget(pfx), ks=lauPresetKeys(name);
    D.perms=[]; ks.forEach(function(k){ D.perms=D.perms.concat(lauMenus(k).map(function(m){return m.v;})); });
    D.edit=ks.filter(function(k){ return k!=='overview'; });
    lauRepaint(pfx); lauToast('ใช้ชุดลัด '+name);
  };
  function lauPsetHTML(pfx){
    var names=Object.keys(LA_PRESETS).concat(['ALL','NONE']);
    return '<div class="pset"><span class="pl">ชุดลัด:</span>'+names.map(function(n){
      return '<button onclick="__laPreset(\''+pfx+'\',\''+n+'\')">'+(n==='ALL'?'ทุกพื้นที่':n==='NONE'?'ล้าง':n)+'</button>'; }).join('')+'</div>';
  }

  /* ── หน้าต่างสิทธิ์ ── */
  window.__laEditPerms=function(id){
    var u=(LAU.rows||[]).filter(function(x){return x.id===id;})[0]; if(!u) return;
    LAU.cur=u; LAU.draft={perms:u.perms.slice(),edit:u.edit.slice()};
    var w=document.getElementById('la-uwin'); if(!w) return;
    var old=w.querySelector('#la-pmask'); if(old) old.remove();
    var d=document.createElement('div'); d.className='mask'; d.id='la-pmask';
    d.onclick=function(e){ if(e.target===d) d.remove(); };
    d.innerHTML='<div class="dlg"><div class="dh"><div><h3>สิทธิ์เข้าใช้งาน</h3>'
      +'<p>'+esc(u.username)+(u.name?(' ('+esc(u.name)+')'):'')+'</p></div>'
      +'<button class="ic" onclick="document.getElementById(\'la-pmask\').remove()">&#10005;</button></div>'
      +'<div class="db">'
        +'<div class="fg">'
          +'<div class="f"><label>บทบาท</label><select id="la-p-role" onchange="__laDrawPerm()">'
            +'<option value="staff"'+(u.role!=='admin'?' selected':'')+'>staff · สิทธิ์ตามที่ติ๊ก</option>'
            +'<option value="admin"'+(u.role==='admin'?' selected':'')+'>admin · เข้าได้ทุกที่ แก้ได้ทุกอย่าง</option>'
          +'</select></div>'
          +'<div class="f"><label>แผนก</label><select id="la-p-dept">'
            +LA_DEPTS.map(function(x){ return '<option value="'+x.k+'"'+(x.k===u.dept?' selected':'')+'>'+esc(x.t)+'</option>'; }).join('')
          +'</select></div></div>'
        +'<div class="f"><label>เป็นเซลล์คนไหน</label><select id="la-p-sales">'
          +'<option value="">— ไม่จำกัด (เห็นทุกเอเยนต์) —</option>'
          +lauSalesList().map(function(x){ return '<option value="'+esc(x.id)+'"'+(x.id===u.salesId?' selected':'')+'>'
            +esc(x.name||x.code||x.id)+'</option>'; }).join('')
        +'</select><div class="hint">ตั้งไว้แล้วผู้ใช้จะเห็นเฉพาะใบจองของเอเยนต์ที่เซลล์คนนั้นดูแล</div></div>'
        +'<div class="sect">พื้นที่และเมนู</div>'
        +'<div style="font-size:11.5px;color:#94A3B8;line-height:1.75;margin:-2px 0 11px">'
          +'ปุ่ม <b style="color:#185FA5">ดู</b> / <b style="color:#0F6E56">แก้ไข</b> = ทำอะไรได้ &nbsp;·&nbsp; '
          +'ตัวเลข <b style="color:#8A5A00">n/N</b> = เข้าได้กี่หน้าจากทั้งหมด (กด “เมนู” เพื่อเลือกทีละหน้า)</div>'
        /* §permExplicit · บัญชีเก่าที่เก็บสิทธิ์เป็นชื่อกลุ่ม จะถูกกางเป็นรายหน้าให้ดู
           ต้องบอกไว้ ไม่งั้น admin เห็น "ท่าเรือ 18/18" แล้วนึกว่าตัวเองเคยติ๊กไว้เอง */
        +(laPermIsExplicit(u.raw)?'':'<div style="background:#FDF8F0;border:1px solid #F0E1C2;'
          +'border-radius:11px;padding:9px 12px;font-size:11.5px;color:#8A5A00;line-height:1.7;'
          +'margin:-2px 0 11px">บัญชีนี้ยังเก็บสิทธิ์แบบเก่า (เป็นชื่อกลุ่ม) · '
          +'ตัวเลขที่เห็นคือหน้าที่เขาเข้าได้จริงตอนนี้ ซึ่งระบบกางออกมาให้<br>'
          +'<b>กดบันทึกครั้งนี้แล้วจะกลายเป็นรายหน้าตามที่ติ๊กไว้ทันที</b> — ติ๊กออกแล้วจะติ๊กออกจริง '
          +'ไม่ถูกเติมกลับอีก</div>')
        +'<div id="la-pset">'+lauPsetHTML('p')+'</div>'
        +'<div id="la-pbody"></div>'
      +'</div>'
      +'<div class="df"><span style="font-size:11.5px;color:#94A3B8">กด <b style="color:#475569">เมนู &#9662;</b> เพื่อเลือกทีละหน้า</span>'
        +'<div style="display:flex;gap:8px"><button class="b" onclick="document.getElementById(\'la-pmask\').remove()">ยกเลิก</button>'
        +'<button class="b pri" onclick="__laSavePerms('+u.id+')">บันทึกสิทธิ์</button></div></div></div>';
    w.appendChild(d);
    __laDrawPerm();
  };
  window.__laDrawPerm=function(){
    var isAdm=(document.getElementById('la-p-role')||{}).value==='admin';
    var ps=document.getElementById('la-pset'); if(ps) ps.style.display=isAdm?'none':'';
    var el=document.getElementById('la-pbody'); if(!el) return;
    el.innerHTML=isAdm
      ? '<div style="background:#FDF8F0;border:1px solid #F0E1C2;border-radius:14px;padding:14px 16px;'
        +'font-size:12.5px;color:#8A5A00;line-height:1.85"><b>admin เข้าได้ทุกหน้าและแก้ได้ทุกอย่าง</b><br>'
        +'สิทธิ์รายเมนูจะถูกข้ามทั้งหมด · เปลี่ยนกลับเป็น staff ถ้าต้องการจำกัด</div>'
      : lauPermHTML(LAU.draft,'p');
  };
  window.__laSavePerms=function(id){
    var u=LAU.cur; if(!u) return;
    var role=document.getElementById('la-p-role').value;
    if(lauIsMe(u) && role!=='admin'){ lauToast('ถอดสิทธิ์ admin ของตัวเองไม่ได้',1); return; }
    var dept=document.getElementById('la-p-dept').value;
    var salesId=document.getElementById('la-p-sales').value;
    var perms, editAreas;
    if(role==='admin'){ perms=LA_NAV.map(function(n){return n.v;}); editAreas=LA_AREAS.map(function(a){return a.k;}); }
    else { perms=LAU.draft.perms.slice(); editAreas=LAU.draft.edit.slice(); }
    if(role!=='admin' && !perms.length && !confirm('ยังไม่ได้เลือกสิทธิ์เลย · ผู้ใช้คนนี้จะล็อกอินได้แต่เปิดหน้าไหนไม่ได้ ยืนยันไหม')) return;
    perms=laPermSeal(perms);   /* §permExplicit · ติ๊กมาเท่าไรได้เท่านั้น ไม่ให้ตัวยกสิทธิ์เก่าเติมกลับ */
    var r=sx('POST','/api/users/perms',JSON.stringify({id:id,role:role,dept:dept,perms:perms,
      editAreas:editAreas,salesId:salesId}),'application/json');
    if(r.status!==200){ lauToast((r.json&&r.json.error)||'บันทึกไม่สำเร็จ',1); return; }
    var m=document.getElementById('la-pmask'); if(m) m.remove();
    __laLoadUsers(); lauToast('บันทึกสิทธิ์ของ '+u.username+' แล้ว');
  };

  /* ── เพิ่มผู้ใช้ ── */
  function lauAdd(){
    if(!LAU.add) LAU.add={u:'',n:'',pw:'',dept:'rsvn',role:'staff',salesId:'',perms:[],edit:[]};
    var D=LAU.add;
    return '<div class="card">'
      +'<div class="sect" style="margin-top:0;padding-top:0;border-top:0">บัญชี</div>'
      +'<div class="fg">'
        +'<div class="f"><label>Username *</label>'
          +'<input id="la-a-u" value="'+esc(D.u)+'" placeholder="เช่น RSVN07" oninput="__laAddSet(\'u\',this.value)">'
          +'<div class="hint" id="la-a-hint"></div></div>'
        +'<div class="f"><label>ชื่อเรียก</label>'
          +'<input id="la-a-n" value="'+esc(D.n)+'" placeholder="เช่น Joy" oninput="__laAddSet(\'n\',this.value)"></div></div>'
      +'<div class="fg">'
        +'<div class="f"><label>รหัสผ่านเริ่มต้น *</label>'
          +'<input id="la-a-p" type="password" placeholder="อย่างน้อย 6 ตัวอักษร" oninput="__laAddSet(\'pw\',this.value)"></div>'
        +'<div class="f"><label>แผนก</label><select id="la-a-d" onchange="__laAddSet(\'dept\',this.value)">'
          +LA_DEPTS.map(function(x){ return '<option value="'+x.k+'"'+(x.k===D.dept?' selected':'')+'>'+esc(x.t)+'</option>'; }).join('')
        +'</select></div></div>'
      +'<div class="fg">'
        +'<div class="f"><label>บทบาท</label><select onchange="__laAddSet(\'role\',this.value)">'
          +'<option value="staff"'+(D.role==='staff'?' selected':'')+'>staff · สิทธิ์ตามที่ติ๊ก</option>'
          +'<option value="admin"'+(D.role==='admin'?' selected':'')+'>admin · เข้าได้ทุกที่</option></select></div>'
        +'<div class="f"><label>เป็นเซลล์คนไหน</label><select onchange="__laAddSet(\'salesId\',this.value)">'
          +'<option value="">— ไม่จำกัด —</option>'
          +lauSalesList().map(function(x){ return '<option value="'+esc(x.id)+'"'+(x.id===D.salesId?' selected':'')+'>'
            +esc(x.name||x.code||x.id)+'</option>'; }).join('')
        +'</select><div class="hint">ตั้งไว้ = เห็นเฉพาะเอเยนต์ของเซลล์คนนั้น</div></div></div>'
      +(D.role==='admin'
        ? '<div class="sect">สิทธิ์</div><div style="background:#FDF8F0;border:1px solid #F0E1C2;border-radius:14px;'
          +'padding:14px 16px;font-size:12.5px;color:#8A5A00;line-height:1.85">'
          +'<b>admin เข้าได้ทุกหน้าและแก้ได้ทุกอย่างอยู่แล้ว</b><br>ไม่ต้องเลือกสิทธิ์รายเมนู</div>'
        : '<div class="sect">สิทธิ์เข้าใช้งาน</div>'+lauPsetHTML('a')+'<div id="la-aperm">'+lauPermHTML(D,'a')+'</div>')
      +'<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px;padding-top:14px;border-top:1px solid #F1F4F8">'
        +'<button class="b" onclick="__laAddCancel()">ยกเลิก</button>'
        +'<button class="b pri" onclick="__laAddUser()">สร้างบัญชี</button></div></div>';
  }
  window.__laAddHint=function(){
    var el=document.getElementById('la-a-hint'); if(!el) return;
    var v=String((LAU.add&&LAU.add.u)||'').trim();
    if(!v){ el.innerHTML='แผนกจะเดาจากคำนำหน้าให้เอง — RSVN / TRANSFER / Pier / GSA'; return; }
    var g=laGuessDept({username:v,role:(LAU.add.role||'staff')});
    LAU.add.dept=g; var s=document.getElementById('la-a-d'); if(s) s.value=g;
    el.innerHTML='เดาแผนกจากชื่อได้เป็น <b style="color:#475569">'+esc(lauDeptT(g))+'</b> — เปลี่ยนเองได้ที่ช่องแผนก';
  };
  window.__laAddUser=function(){
    var D=LAU.add||{};
    var u=String(D.u||'').trim(), n=String(D.n||'').trim(), p=String(D.pw||'');
    if(!u){ lauToast('ต้องกรอก Username',1); return; }
    if(p.length<6){ lauToast('รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร',1); return; }
    var perms,editAreas;
    if(D.role==='admin'){ perms=LA_NAV.map(function(x){return x.v;}); editAreas=LA_AREAS.map(function(a){return a.k;}); }
    else { perms=D.perms.slice(); editAreas=D.edit.slice();
      if(!perms.length && !confirm('ยังไม่ได้เลือกสิทธิ์เลย · บัญชีนี้จะล็อกอินได้แต่เปิดหน้าไหนไม่ได้ ยืนยันไหม')) return;
      perms=laPermSeal(perms); }   /* §permExplicit · บัญชีใหม่ระบุครบตั้งแต่ต้น */
    var r=sx('POST','/api/users',JSON.stringify({username:u,name:n,password:p,role:D.role||'staff',
      dept:D.dept,perms:perms,editAreas:editAreas,salesId:D.salesId||''}),'application/json');
    if(r.status!==200){ lauToast((r.json&&r.json.error)||'เพิ่มผู้ใช้ไม่สำเร็จ',1); return; }
    LAU.add=null; window.__laTab='list'; __laLoadUsers(); lauToast('สร้างบัญชี '+u+' แล้ว');
  };

  /* ── รหัสผ่าน ── */
  window.__laReset=function(id){
    var u=(LAU.rows||[]).filter(function(x){return x.id===id;})[0]; if(!u) return;
    LAU.pwd=u;
    var w=document.getElementById('la-uwin'); var old=w.querySelector('#la-wmask'); if(old) old.remove();
    var d=document.createElement('div'); d.className='mask'; d.id='la-wmask';
    d.onclick=function(e){ if(e.target===d) d.remove(); };
    d.innerHTML='<div class="dlg sm"><div class="dh"><div><h3>เปลี่ยนรหัสผ่าน</h3>'
      +'<p>'+esc(u.username)+(u.name?(' ('+esc(u.name)+')'):'')+'</p></div>'
      +'<button class="ic" onclick="document.getElementById(\'la-wmask\').remove()">&#10005;</button></div>'
      +'<div class="db"><div class="f"><label>รหัสผ่านใหม่</label>'
        +'<input type="password" id="la-w1" placeholder="อย่างน้อย 6 ตัวอักษร" oninput="__laPwChk()"></div>'
        +'<div class="f"><label>พิมพ์ซ้ำอีกครั้ง</label>'
        +'<input type="password" id="la-w2" placeholder="พิมพ์รหัสผ่านเดิมอีกครั้ง" oninput="__laPwChk()">'
        +'<div class="hint" id="la-wmsg">&nbsp;</div></div></div>'
      +'<div class="df"><span></span><div style="display:flex;gap:8px">'
        +'<button class="b" onclick="document.getElementById(\'la-wmask\').remove()">ยกเลิก</button>'
        +'<button class="b pri" id="la-wgo" disabled onclick="__laPwSave()">บันทึกรหัสผ่าน</button></div></div></div>';
    w.appendChild(d);
    var i=document.getElementById('la-w1'); if(i) i.focus();
  };
  window.__laPwChk=function(){
    var a=(document.getElementById('la-w1')||{}).value||'', b=(document.getElementById('la-w2')||{}).value||'';
    var m=document.getElementById('la-wmsg'), go=document.getElementById('la-wgo');
    var ok=false, msg='&nbsp;';
    if(a && a.length<6) msg='<span style="color:#B4392B">สั้นเกินไป · ต้องอย่างน้อย 6 ตัวอักษร</span>';
    else if(a && b && a!==b) msg='<span style="color:#B4392B">สองช่องไม่ตรงกัน</span>';
    else if(a && b && a===b){ msg='<span style="color:#0F6E56">ตรงกันแล้ว</span>'; ok=true; }
    if(m) m.innerHTML=msg; if(go) go.disabled=!ok;
  };
  window.__laPwSave=function(){
    var u=LAU.pwd; if(!u) return;
    var p=(document.getElementById('la-w1')||{}).value||'';
    var r=sx('POST','/api/users/password',JSON.stringify({id:u.id,password:p}),'application/json');
    if(r.status!==200){ lauToast((r.json&&r.json.error)||'เปลี่ยนรหัสไม่สำเร็จ',1); return; }
    var m=document.getElementById('la-wmask'); if(m) m.remove();
    lauToast('เปลี่ยนรหัสผ่านของ '+u.username+' แล้ว');
  };

  /* ── ลบผู้ใช้ ── */
  window.__laDelUser=function(id){
    var u=(LAU.rows||[]).filter(function(x){return x.id===id;})[0]; if(!u) return;
    if(lauIsMe(u)){ lauToast('ลบบัญชีตัวเองไม่ได้',1); return; }
    LAU.del=u;
    var w=document.getElementById('la-uwin'); var old=w.querySelector('#la-dmask'); if(old) old.remove();
    var d=document.createElement('div'); d.className='mask'; d.id='la-dmask';
    d.onclick=function(e){ if(e.target===d) d.remove(); };
    d.innerHTML='<div class="dlg sm"><div class="db" style="text-align:center;padding:26px 24px 20px">'
      +'<div style="width:48px;height:48px;border-radius:15px;background:#FBEDEB;color:#B4392B;display:flex;'
        +'align-items:center;justify-content:center;font-size:20px;margin:0 auto 12px">&#128465;</div>'
      +'<h3 style="font-size:15.5px;font-weight:800;margin:0 0 6px">ลบผู้ใช้นี้?</h3>'
      +'<p style="font-size:12.5px;color:#475569;margin:0;line-height:1.8"><b>'+esc(u.username)+'</b>'
        +(u.name?(' ('+esc(u.name)+')'):'')+' · '+esc(lauDeptT(u.dept))+'</p>'
      +'<p style="font-size:11.5px;color:#94A3B8;margin:10px 0 0;line-height:1.7">'
        +'ประวัติงานที่ผู้ใช้นี้เคยบันทึกไว้ยังอยู่ครบ · ลบเฉพาะบัญชีเข้าใช้งาน</p></div>'
      +'<div class="df" style="justify-content:center">'
        +'<button class="b" style="flex:1" onclick="document.getElementById(\'la-dmask\').remove()">ยกเลิก</button>'
        +'<button class="b dgr" style="flex:1" onclick="__laDelGo()">ลบบัญชี</button></div></div>';
    w.appendChild(d);
  };
  window.__laDelGo=function(){
    var u=LAU.del; if(!u) return;
    var r=sx('DELETE','/api/users?id='+u.id);
    if(r.status!==200){ lauToast((r.json&&r.json.error)||'ลบไม่สำเร็จ',1); return; }
    var m=document.getElementById('la-dmask'); if(m) m.remove();
    __laLoadUsers(); lauToast('ลบบัญชี '+u.username+' แล้ว');
  };
})();
