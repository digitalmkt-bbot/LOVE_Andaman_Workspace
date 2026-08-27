
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
  var ld=sx('GET','/api/load');
  try{ console.log('[boot] me=200 load='+ld.status+' bytes='+(ld.text?ld.text.length:0)); }catch(e){}
  // Sync load failed (WebKit aborts long-blocking sync XHR on slow links — Chrome doesn't) →
  // switch to ASYNC retry behind a blocking overlay. Overlay stays up until data lands so nobody
  // edits an empty state; on arrival the data is applied in place via the soft-refresh path.
  function _laAsyncLoad(st){
    try{ console.warn('[boot] sync /api/load failed (status '+st+') → async retry'); }catch(e){}
    onReady(function(){ if(document.getElementById('la-bootload')) return;
      var ov=document.createElement('div'); ov.id='la-bootload';
      ov.style.cssText='position:fixed;inset:0;z-index:100050;background:rgba(14,34,53,.93);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;font:15px/1.5 "DM Sans",sans-serif;text-align:center;padding:20px';
      ov.innerHTML='<div style="font-size:34px">⏳</div><div><b>กำลังโหลดข้อมูลจากเซิร์ฟเวอร์…</b><br><span id="la-bootload-st" style="opacity:.75;font-size:13px">เครือข่ายช้าหรือหลุด · กำลังลองใหม่อัตโนมัติ</span></div>';
      document.body.appendChild(ov); });
    var tries=0;
    (function go(){ tries++;
      function fail(why){ var s=document.getElementById('la-bootload-st'); if(s) s.textContent='ครั้งที่ '+tries+' ไม่สำเร็จ ('+why+') · ลองใหม่ใน 4 วิ'; setTimeout(go,4000); }
      var x=new XMLHttpRequest(); x.open('GET',bust('/api/load'),true);
      x.onload=function(){ try{
        if(x.status!==200){ fail('status '+x.status); return; }
        var j=JSON.parse(x.responseText);
        if(typeof j.data!=='string' || j.data.length<2){ fail('empty'); return; }
        VER=j.version||0; LASTBY=j.updated_by?(j.updated_by+' · '+fmt(j.updated_at)):'';
        try{ BASE=JSON.parse(j.data); }catch(e){ BASE={}; }
        _orig(LS, j.data); _laMark(VER);
        _syncReady=true; _dirty=false; try{ clearTimeout(_t); }catch(e){}   // §syncGate · ข้อมูลจริงถึงแล้วค่อยเปิดเซฟ · ทิ้งงานค้างที่เกิดตอน state ยังว่าง
        var el=document.getElementById('la-bootload'); if(el) el.remove();
        // app already initialized (rendered empty) → re-apply in place; not yet → it reads the fresh blob itself
        if(window._laReloadData){ if(window._laReloadData()){ if(window._laRerender) window._laRerender(); } else { _laReload(); return; } }
        try{ console.log('[boot] async /api/load ok on try '+tries+' ('+j.data.length+' bytes)'); }catch(e){}
      }catch(e){ fail(String(e&&e.message||e)); } };
      x.onerror=function(){ fail('network'); };
      try{ x.send(); }catch(e){ fail('send'); }
    })();
  }
  if(ld.status!==200 || !ld.json){ _laAsyncLoad(ld.status); }
  if(ld.status===200 && ld.json){
    VER=ld.json.version||0; LASTBY = ld.json.updated_by? (ld.json.updated_by+' · '+fmt(ld.json.updated_at)) : '';
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
  function _laSaveErrClear(){ if(!_laSaveErrShown) return; _laSaveErrShown=false; var d=document.getElementById('la-saveerr'); if(d) d.remove(); }
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
      else { _laSaveErr('กำลังลองบันทึกขึ้นระบบใหม่… (ข้อมูลยังอยู่ในเครื่อง อย่าเพิ่งปิดหน้า)','#7A4A00'); setTimeout(function(){ var nv=localStorage.getItem(LS); if(nv) save(nv); }, 5000); } };   // transient (5xx/0) → retry + warn
    x.onerror=function(){ _laSaveErr('เชื่อมต่อระบบไม่ได้ · กำลังลองเซฟใหม่… (ข้อมูลยังอยู่ในเครื่อง อย่าเพิ่งปิดหน้า)','#7A4A00'); setTimeout(function(){ var nv=localStorage.getItem(LS); if(nv) save(nv); }, 5000); };
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
      // §B2C alert: when this refresh came from a B2C sync, count genuinely NEW b2c bookings (vs the
      //   blob we're about to overwrite) so we can notify the user instead of the booking arriving silently.
      var _b2cNew=[]; if(j.updated_by==='B2C'){ try{ _b2cNew=_laB2CNew(localStorage.getItem(LS), j.data); }catch(e){} }
      _orig(LS, j.data);                                           // write WITHOUT triggering a save
      VER=j.version||VER; try{BASE=JSON.parse(j.data);}catch(e){BASE={};} _laMark(VER);
      _laPending=null;
      var ok = window._laReloadData ? window._laReloadData() : false;
      if(!ok){ _laReload(); return; }                             // in-place failed → fall back to full reload
      if(window._laRerender) window._laRerender();
      LASTBY = j.updated_by ? (j.updated_by+' · '+fmt(j.updated_at)) : LASTBY;
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
  function _laB2CIds(raw){ var s={}; if(!raw) return s; try{ var o=JSON.parse(raw); var arr=o&&o.sb_bookings; if(Array.isArray(arr)){ for(var i=0;i<arr.length;i++){ var b=arr[i]; if(!b||!b.id) continue; if(String(b.id).indexOf('b2c_')!==0) continue; if(b.status&&_B2C_CXL.indexOf(b.status)>=0) continue; s[b.id]=1; } } }catch(e){} return s; }
  function _laB2CDiff(oldRaw,newRaw){ var o=_laB2CIds(oldRaw), n=_laB2CIds(newRaw), c=0; for(var id in n){ if(!o[id]) c++; } return c; }
  // Return detail objects for genuinely NEW (non-cancelled) b2c bookings — route/date/pax/total for the alert card.
  function _laB2CNew(oldRaw,newRaw){ var out=[]; try{ var oldS=_laB2CIds(oldRaw); var o=JSON.parse(newRaw); var arr=o&&o.sb_bookings; if(!Array.isArray(arr)) return out; var rm={}; if(Array.isArray(o.routes)){ o.routes.forEach(function(r){ if(r&&r.id) rm[r.id]=r.name||r.id; }); } for(var i=0;i<arr.length;i++){ var b=arr[i]; if(!b||!b.id) continue; if(String(b.id).indexOf('b2c_')!==0) continue; if(b.status&&_B2C_CXL.indexOf(b.status)>=0) continue; if(oldS[b.id]) continue; var t=(b.trips&&b.trips[0])||{}; var pax=0; (b.trips||[]).forEach(function(tp){ var p=tp.pax||{}; for(var k in p){ if(/^(ad|chd|inf|foc)(_fr|_th)?$/.test(k)) pax+=(+p[k]||0); } }); out.push({ id:b.id, route:(rm[t.routeId]||t.routeId||'-'), date:(t.date||''), pax:pax, total:(b.priceBreakdown&&b.priceBreakdown.total)||0 }); } }catch(e){} return out; }
  function _laFmtDate(s){ if(!s) return '-'; var p=String(s).split('-'); if(p.length<3) return s; var M=['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']; return (+p[2])+' '+(M[+p[1]]||p[1])+' '+p[0]; }
  // Jump to Booking → By-Trip tab for the alerted booking's date
  function _laB2CGoTo(date){ try{ var nav=document.querySelector('.nav-item[data-view="booking"]'); if(nav) nav.click(); if(window._bkV2){ _bkV2.tab='bytrip'; if(date){ _bkV2.filterDate=date; _bkV2.filterRoute=null; window._bkV2T2Cursor=String(date).slice(0,7); } } if(typeof bkV2Render==='function') bkV2Render(); }catch(e){} }
  function _laBeep(){ try{ var AC=window.AudioContext||window.webkitAudioContext; if(!AC) return; var ctx=window.__laAC||(window.__laAC=new AC()); function tone(freq,at,dur){ var o=ctx.createOscillator(),g=ctx.createGain(); o.type='sine'; o.frequency.value=freq; o.connect(g); g.connect(ctx.destination); var t=ctx.currentTime+at; g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.35,t+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t+dur); o.start(t); o.stop(t+dur+0.02); } function play(){ try{ tone(880,0,0.16); tone(1174,0.16,0.22); }catch(e){} } if(ctx.state==='suspended'){ try{ var p=ctx.resume(); if(p&&p.then) p.then(play).catch(play); else play(); }catch(e){ play(); } } else { play(); } }catch(e){} }
  function _laB2CAlert(list){ if(!list||!list.length) return; var n=list.length, b=list[0];
    var SHIP='<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1"/><path d="M4 18l-1 -5h18l-2 4"/><path d="M5 13v-6h8l4 6"/><path d="M7 7v-4h-1"/></svg>';
    onReady(function(){ var d=document.createElement('div'); d.className='la-b2c-alert';
      d.style.cssText='position:fixed;top:16px;right:16px;z-index:100000;width:372px;max-width:calc(100vw - 32px);font-family:"DM Sans",sans-serif;cursor:pointer';
      var more = n>1 ? '<div style="font-size:11px;color:#6a7580;margin-top:3px">+ อีก '+(n-1)+' รายการ</div>' : '';
      d.innerHTML='<div style="position:relative;background:rgba(255,255,255,.62);-webkit-backdrop-filter:blur(22px) saturate(180%);backdrop-filter:blur(22px) saturate(180%);border-radius:20px;box-shadow:0 12px 34px rgba(0,0,0,.20);border:0.5px solid rgba(255,255,255,.65);padding:13px 15px;display:flex;align-items:center;gap:12px">'
        +'<div class="la-b2c-x" style="position:absolute;top:-8px;left:-8px;width:24px;height:24px;border-radius:50%;background:rgba(240,240,242,.92);border:0.5px solid rgba(0,0,0,.08);display:flex;align-items:center;justify-content:center;color:#555;font-size:15px;line-height:1">×</div>'
        +'<div style="width:44px;height:44px;border-radius:11px;background:#1683C7;display:flex;align-items:center;justify-content:center;flex-shrink:0">'+SHIP+'</div>'
        +'<div style="flex:1;min-width:0">'
          +'<div style="display:flex;align-items:center;gap:7px"><span style="font-size:14px;font-weight:700;color:#0f1720">New Booking</span><span style="font-size:10px;font-weight:700;color:#0a5a7a;background:rgba(220,238,250,.85);border-radius:20px;padding:1px 7px">B2C</span><span style="margin-left:auto;font-size:11px;color:#4a5560">now</span></div>'
          +'<div style="font-size:13px;color:#26313a;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(b.route)+'</div>'
          +'<div style="font-size:12px;color:#4a5560;margin-top:2px;font-family:\'DM Mono\',monospace">'+esc(_laFmtDate(b.date))+' · '+(b.pax||0)+' pax · ฿'+Number(b.total||0).toLocaleString()+'</div>'
          +more
        +'</div>'
        +'<div style="align-self:stretch;display:flex;align-items:center;padding-left:12px;border-left:0.5px solid rgba(0,0,0,.10)"><span style="font-size:13px;font-weight:700;color:#0d6ea8;white-space:nowrap">ดู booking</span></div>'
      +'</div>';
      d.title='คลิกเพื่อดู booking';
      d.onclick=function(){ try{ _laB2CGoTo(b.date); }catch(e){} try{ d.remove(); }catch(e){} };
      var xb=d.querySelector('.la-b2c-x'); if(xb){ xb.onclick=function(e){ if(e&&e.stopPropagation)e.stopPropagation(); try{d.remove();}catch(_){} }; }
      document.body.appendChild(d);
      setTimeout(function(){ try{ d.style.transition='opacity .4s'; d.style.opacity='0'; setTimeout(function(){ try{d.remove();}catch(e){} },400); }catch(e){} }, 8000);
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
  var LA_VIEW_AREA={'sales-board':'sales','b2b-dash':'sales','contract-tmpl':'sales',dashboard:'overview',calendar:'overview',daily:'overview',booking:'operations',operation:'operations',vehicles:'operations',vanjobs:'operations',vancheckin:'operations',piercheckin:'operations',travelsum:'operations',dailyreport:'operations','pickup-setup':'operations',boatassign:'operations',agents:'sales','rate-types':'sales',b2c:'sales',staff:'sales',marketdata:'sales',pickupmap:'sales',accounting:'accounting',costing:'accounting',trippl:'accounting',dailypfm:'accounting','fl-dashboard':'fleet','fl-boatstatus':'fleet','fl-dailyreport':'fleet','fl-incident':'fleet','fl-projects':'fleet','fl-maintenance':'fleet','fl-inventory':'fleet','fl-consumables':'fleet','fl-cost':'fleet','fl-insights':'fleet','fl-fuel':'fleet','fl-asset':'fleet','po-panwa':'pier','po-tublamu':'pier','po-ranong':'pier','poj-panwa':'pier','poj-tublamu':'pier','poj-ranong':'pier','pol-panwa':'pier','pol-tublamu':'pier','pol-ranong':'pier','poa-panwa':'pier','poa-tublamu':'pier','poa-ranong':'pier',settings:'config',teammkt:'config',addonsvc:'config'};
  // Per-MENU registry (finer than the 6 groups) · {v:view, t:label, a:area}
  var LA_NAV=[
    {v:'dashboard',t:'Dashboard',a:'overview'},{v:'calendar',t:'Calendar',a:'overview'},{v:'daily',t:'Daily Availability',a:'overview'},
    /* §สิทธิ์ · reconfirm กับ bookingflow ไม่เคยอยู่ใน LA_NAV เลย และ laAllowed() ปล่อยผ่านเมนูที่ไม่รู้จัก
       (return managed?false:true) → 2 หน้านี้เปิดให้ "ทุกคน" มาตลอด แม้ผู้ใช้จะไม่ได้ติ๊กพื้นที่ปฏิบัติการไว้
       ใส่เข้ากลุ่ม operations · เรียงตามลำดับในเมนูจริง (Booking → Re-confirm → Booking Flow → ตรวจเอกสาร) */
    {v:'booking',t:'Booking',a:'operations'},{v:'reconfirm',t:'Re-confirm',a:'operations'},{v:'bookingflow',t:'Booking Flow',a:'operations'},{v:'doccheck',t:'ตรวจเอกสาร',a:'operations'},{v:'operation',t:'Boat Operation',a:'operations'},{v:'fleetcal',t:'Fleet Calendar',a:'operations'},{v:'insurance',t:'Insurance',a:'operations'},{v:'vehicles',t:'Transfer Fleet',a:'operations'},{v:'vanjobs',t:'ใบงานรถ',a:'operations'},{v:'vancheckin',t:'เช็คอินรถ',a:'operations'},{v:'piercheckin',t:'เช็คอินหน้าท่า',a:'operations'},{v:'travelsum',t:'Travel Summary',a:'operations'},{v:'dailyreport',t:'Daily Report',a:'operations'},{v:'pickup-setup',t:'Pickup time setup',a:'operations'},
    {v:'sales-board',t:'Sales Board',a:'sales'},{v:'b2b-dash',t:'B2B Dashboard',a:'sales'},{v:'agents',t:'Agent List',a:'sales'},{v:'rate-types',t:'Rate Types',a:'sales'},{v:'contract-tmpl',t:'Contract Templates',a:'sales'},{v:'b2c',t:'B2C Channels',a:'sales'},{v:'staff',t:'Staff & Welfare',a:'sales'},{v:'marketdata',t:'Demand',a:'sales'},{v:'focdetail',t:'FOC Detail',a:'sales'},{v:'pickupmap',t:'แผนที่จุดรับ',a:'sales'},
    {v:'accounting',t:'Accounting',a:'accounting'},{v:'costing',t:'ต้นทุน & จุดคุ้มทุน',a:'accounting'},{v:'trippl',t:'P&L รายทริป',a:'accounting'},{v:'dailypfm',t:'Daily PFM',a:'accounting'},
    {v:'fl-dashboard',t:'Fleet Dashboard',a:'fleet'},{v:'fl-boatstatus',t:'Boat Status',a:'fleet'},{v:'fl-dailyreport',t:'Daily Fleet Log',a:'fleet'},{v:'fl-incident',t:'Incident / Job',a:'fleet'},{v:'fl-projects',t:'Projects',a:'fleet'},{v:'fl-maintenance',t:'Maintenance',a:'fleet'},{v:'fl-inventory',t:'Inventory / Memo',a:'fleet'},{v:'fl-consumables',t:'เบิกของใช้/น้ำมัน',a:'fleet'},{v:'fl-cost',t:'Cost Analytics',a:'fleet'},{v:'fl-insights',t:'Fleet Insights',a:'fleet'},{v:'fl-fuel',t:'Fuel',a:'fleet'},{v:'fl-asset',t:'Company Asset',a:'fleet'},
    {v:'poj-panwa',t:'Phuket · ใบงานเรือ',a:'pier'},{v:'po-panwa',t:'Phuket · เบิก-คืนอุปกรณ์',a:'pier'},{v:'poa-panwa',t:'Phuket · ตารางการทำงาน',a:'pier'},{v:'pol-panwa',t:'Phuket · ใบอนุญาต',a:'pier'},
    {v:'poj-tublamu',t:'Tub Lamu · ใบงานเรือ',a:'pier'},{v:'po-tublamu',t:'Tub Lamu · เบิก-คืนอุปกรณ์',a:'pier'},{v:'poa-tublamu',t:'Tub Lamu · ตารางการทำงาน',a:'pier'},{v:'pol-tublamu',t:'Tub Lamu · ใบอนุญาต',a:'pier'},
    {v:'poj-ranong',t:'Ranong · ใบงานเรือ',a:'pier'},{v:'po-ranong',t:'Ranong · เบิก-คืนอุปกรณ์',a:'pier'},{v:'poa-ranong',t:'Ranong · ตารางการทำงาน',a:'pier'},{v:'pol-ranong',t:'Ranong · ใบอนุญาต',a:'pier'},
    {v:'settings',t:'Programs',a:'config'},{v:'teammkt',t:'Team & Markets',a:'config'},{v:'addonsvc',t:'Add-on Services',a:'config'}
  ];
  // Expand a stored perms array → Set of allowed view keys. Group keys (the 6 areas) expand to every menu in that group (back-compat with old data). View keys pass through.
  function laExpandPerms(perms){ if(!Array.isArray(perms)) return null; var set={}, areaKeys=LA_AREAS.map(function(a){return a.k;});
    perms.forEach(function(p){ if(areaKeys.indexOf(p)>=0){ LA_NAV.forEach(function(n){ if(n.a===p) set[n.v]=1; }); } else set[p]=1; });
    laBackfillPier(set);
    if(!set['contract-tmpl'] && (set['rate-types']||set['agents'])) set['contract-tmpl']=1;   // §contract-tmpl เพิ่มใหม่ 2026-07-14 · back-fill สิทธิ์ให้คนที่ถือ rate-types/agents อยู่แล้ว (perms แบบ view-list เก่าไม่มี key นี้ → เข้าหน้าไม่ได้)
    if(!set['b2b-dash'] && (set['sales-board']||set['marketdata'])) set['b2b-dash']=1;   // §b2b-dash
    if(!set['costing'] && set['accounting']) set['costing']=1;   // §fill · costing ลงทะเบียน 2026-08-11 · คนที่ถือหน้า Accounting อยู่แล้วยกให้ต่อ (perms แบบ view-list เก่าไม่มี key นี้)
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
    return set;
  }
  function laPermViewList(perms){ var set=laExpandPerms(perms); if(!set) return LA_NAV.map(function(n){return n.v;}); return LA_NAV.filter(function(n){return set[n.v];}).map(function(n){return n.v;}); }
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

  window.__laTab='list';
  window.__laSetTab=function(t){ window.__laTab=t; __laRenderTabs(); __laLoadUsers(); };
  window.__laRenderTabs=function(){ var el=document.getElementById('la-tabs'); if(!el) return;
    el.innerHTML=[['overview','ภาพรวม'],['list','รายชื่อผู้ใช้'],['add','+ เพิ่มผู้ใช้']].map(function(p){
      var on=window.__laTab===p[0];
      return '<button onclick="__laSetTab(\''+p[0]+'\')" style="border:0;border-radius:8px;padding:6px 13px;font-size:12.5px;font-weight:'+(on?'700':'500')+';cursor:pointer;font-family:inherit;background:'+(on?'#fff':'transparent')+';color:'+(on?'#15396B':'#8b9a94')+';box-shadow:'+(on?'0 1px 3px rgba(0,0,0,.09)':'none')+'">'+p[1]+'</button>';
    }).join(''); };

  window.__laUsers=function(){
    var old=document.getElementById('la-umodal'); if(old) old.remove();
    window.__laTab='list'; window.__laQ='';
    var ov=document.createElement('div'); ov.className='la-modal'; ov.id='la-umodal'; ov.onclick=function(e){ if(e.target===ov) ov.remove(); };
    ov.innerHTML='<div class="la-card" style="padding:16px 18px;width:760px">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'
        +'<div style="font-size:16px;font-weight:800;color:#15396B">จัดการผู้ใช้ + สิทธิ์เข้าถึง</div>'
        +'<button class="la-ub-btn" style="background:#eee;color:#444" onclick="document.getElementById(\'la-umodal\').remove()">ปิด</button></div>'
      +'<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px">'
        +'<div id="la-tabs" style="display:flex;gap:3px;background:#f1efe9;border-radius:10px;padding:3px"></div>'
        +'<input id="la-q" placeholder="ค้นหาชื่อ / username" oninput="window.__laQ=this.value;__laLoadUsers()" style="flex:1;max-width:230px;border:1px solid #d7d3ca;border-radius:8px;padding:7px 10px;font-size:12.5px;font-family:inherit">'
      +'</div>'
      +'<div id="la-ulist" style="font-size:13px;color:#555;max-height:62vh;overflow:auto">กำลังโหลด...</div></div>';
    document.body.appendChild(ov); __laRenderTabs(); __laLoadUsers();
  };

  window.__laLoadUsers=function(){
    var el=document.getElementById('la-ulist'); if(!el) return;
    if(!window.__laUserList || window.__laTab!=='add'){
      var r=sx('GET','/api/users');
      if(r.status!==200||!r.json){ el.textContent='โหลดรายชื่อไม่ได้'; return; }
      window.__laUserList=r.json.users||[];
    }
    var qEl=document.getElementById('la-q'); if(qEl) qEl.style.display = (window.__laTab==='add') ? 'none' : '';
    var US=window.__laUserList||[];
    var q=String(window.__laQ||'').toLowerCase();
    var F=US.filter(function(u){ return !q || (String(u.username)+String(u.name||'')).toLowerCase().indexOf(q)>=0; });

    if(window.__laTab==='overview'){
      var byD={}; US.forEach(function(u){ var d=laDeptOf(u); (byD[d]=byD[d]||[]).push(u); });
      el.innerHTML='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(228px,1fr));gap:9px">'
       + LA_DEPTS.filter(function(d){return byD[d.k];}).map(function(d){ var ms=byD[d.k];
          return '<div style="background:#faf9f6;border:1px solid #eee9e0;border-radius:11px;padding:11px 12px">'
           +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px">'
             +'<span style="font-size:13px;font-weight:700;color:#2b3a34">'+esc(d.t)+'</span>'
             +'<span style="font-size:11px;color:#98a29c">'+ms.length+' คน</span></div>'
           +laAreaBadges(ms[0])
           +'<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:9px">'+ms.map(function(u){ return '<span title="'+esc(u.username+' · '+(u.name||''))+'">'+laAvatar(u,22)+'</span>'; }).join('')+'</div></div>';
         }).join('')
       +'</div><div style="font-size:11px;color:#9aa8a2;margin-top:10px;border-top:1px solid #f1efe9;padding-top:8px">– ไม่มีสิทธิ์ · <span style="color:#185FA5">👁 ดูอย่างเดียว</span> · <span style="color:#0F6E56">✎ แก้ไขได้</span> &nbsp;(สิทธิ์ที่โชว์ = ของคนแรกในแผนก)</div>';
      return;
    }

    if(window.__laTab==='add'){
      el.innerHTML='<div style="display:flex;gap:6px;flex-wrap:wrap">'
        +'<input id="la-nu" placeholder="username" style="flex:1;min-width:120px;border:1px solid #d7d3ca;border-radius:7px;padding:7px 9px;font-size:13px;font-family:inherit">'
        +'<input id="la-nn" placeholder="ชื่อ" style="flex:1;min-width:100px;border:1px solid #d7d3ca;border-radius:7px;padding:7px 9px;font-size:13px;font-family:inherit">'
        +'<input id="la-np" type="password" placeholder="รหัสผ่าน" style="flex:1;min-width:120px;border:1px solid #d7d3ca;border-radius:7px;padding:7px 9px;font-size:13px;font-family:inherit">'
        +laDeptSelectHTML('la-nd','rsvn')
        +'<select id="la-nr" style="border:1px solid #d7d3ca;border-radius:7px;padding:7px;font-size:13px;font-family:inherit"><option value="staff">staff</option><option value="admin">admin</option></select></div>'
        +'<div style="font-size:11px;color:#999;margin-top:8px">เป็นเซลล์ (เห็นเฉพาะเอเยนต์ของตัวเอง): '+laSalesSelectHTML('la-ns','')+'</div>'
        +'<div style="font-size:11px;color:#999;margin-top:11px">เข้าถึงเมนู (staff):</div>'
        +laPresetBtnsHTML('na')+laPermBoxesHTML('na',LA_NAV.map(function(n){return n.v;}))
        +'<div style="font-size:11px;color:#999;margin-top:9px">สิทธิ์แก้ไข ราย section <span style="color:#bbb">(ไม่ติ๊ก = ดูอย่างเดียว):</span></div>'
        +laEditBoxesHTML('naE',LA_AREAS.map(function(a){return a.k;}))
        +'<button class="la-ub-btn" style="background:#1C4A30;margin-top:12px" onclick="__laAddUser()">เพิ่มผู้ใช้</button>';
      return;
    }

    // ── รายชื่อผู้ใช้ · แยกแผนก ──
    var byD={}; F.forEach(function(u){ var d=laDeptOf(u); (byD[d]=byD[d]||[]).push(u); });
    var groups=LA_DEPTS.filter(function(d){ return byD[d.k]; });
    if(!groups.length){ el.innerHTML='<div style="padding:20px;text-align:center;color:#9aa8a2;font-size:12px">ไม่พบผู้ใช้ที่ค้นหา</div>'; return; }
    el.innerHTML=groups.map(function(d){ var ms=byD[d.k];
      return '<div style="display:flex;align-items:center;gap:7px;margin:12px 0 5px"><span style="font-size:12px;font-weight:700;color:#2b3a34">'+esc(d.t)+'</span>'
        +'<span style="font-size:10.5px;color:#a8b0aa;background:#f1efe9;border-radius:9px;padding:1px 7px">'+ms.length+'</span>'
        +'<span style="flex:1;height:1px;background:#f1efe9"></span></div>'
      + ms.map(function(u){
        var isMe=(u.role==='admin'&&u.username===ME.username);
        return '<div style="display:grid;grid-template-columns:28px 1fr auto;gap:9px;align-items:center;padding:8px 6px;border-bottom:1px solid #f5f3ee">'
          +laAvatar(u,28)
          +'<div style="min-width:0">'
            +'<div style="font-size:12.5px;font-weight:700;color:#2b3a34">'+esc(u.username)+(u.role==='admin'?' <span style="font-size:9px;color:#993C1D;background:#FAECE7;border-radius:7px;padding:1px 6px;font-weight:700">ADMIN</span>':'')+'</div>'
            +'<div style="font-size:10.5px;color:#98a29c;margin:1px 0 4px">'+esc(u.name||'')+'</div>'
            +laAreaBadges(u)
          +'</div>'
          +'<div style="display:flex;gap:4px">'
            +'<button class="la-ub-btn" onclick="__laEditPerms('+u.id+')">สิทธิ์</button>'
            +'<button class="la-ub-btn" style="background:#8a7f6a" onclick="__laReset('+u.id+',\''+esc(u.username)+'\')">รหัส</button>'
            +(isMe?'':'<button class="la-ub-btn" style="background:#A32D2D" onclick="__laDelUser('+u.id+',\''+esc(u.username)+'\')">ลบ</button>')
          +'</div></div>';
      }).join('');
    }).join('')
    +'<div style="font-size:11px;color:#9aa8a2;margin-top:12px;border-top:1px solid #f1efe9;padding-top:8px">– ไม่มีสิทธิ์ · <span style="color:#185FA5">👁 ดูอย่างเดียว</span> · <span style="color:#0F6E56">✎ แก้ไขได้</span></div>';
  };

  window.__laAddUser=function(){
    var u=document.getElementById('la-nu').value.trim(), n=document.getElementById('la-nn').value.trim(),
        p=document.getElementById('la-np').value, role=document.getElementById('la-nr').value,
        dept=document.getElementById('la-nd').value,
        salesId=(document.getElementById('la-ns')||{}).value||'';
    if(!u||!p){ alert('ต้องมี username + รหัสผ่าน'); return; }
    var perms=laReadBoxes('na'); var editAreas=laReadEditBoxes('naE');
    var r=sx('POST','/api/users',JSON.stringify({username:u,name:n,password:p,role:role,dept:dept,perms:perms,editAreas:editAreas,salesId:salesId}),'application/json');
    if(r.status===200){ window.__laUserList=null; window.__laSetTab('list'); }
    else alert((r.json&&r.json.error)||'เพิ่มผู้ใช้ไม่สำเร็จ');
  };

  window.__laEditPerms=function(id){ var u=(window.__laUserList||[]).filter(function(x){return x.id===id;})[0]; if(!u) return; var old=document.getElementById('la-pmodal'); if(old) old.remove();
    var sel=laPermViewList(u.perms);
    var esel=Array.isArray(u.editAreas)?u.editAreas:LA_AREAS.map(function(a){return a.k;});
    var udept=laDeptOf(u);
    var ov=document.createElement('div'); ov.className='la-modal'; ov.id='la-pmodal'; ov.style.zIndex='100000'; ov.onclick=function(e){ if(e.target===ov) ov.remove(); };
    ov.innerHTML='<div class="la-card" style="padding:18px 20px;width:520px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><div style="font-size:15px;font-weight:800;color:#15396B">สิทธิ์ของ '+esc(u.username)+'</div><button class="la-ub-btn" style="background:#eee;color:#444" onclick="document.getElementById(\'la-pmodal\').remove()">ปิด</button></div><div style="font-size:11px;color:#999;margin-bottom:4px">Role: <select id="la-ed-role" style="border:1px solid #d7d3ca;border-radius:6px;padding:4px 7px;font-size:12px;font-family:inherit"><option value="staff"'+(u.role!=='admin'?' selected':'')+'>staff</option><option value="admin"'+(u.role==='admin'?' selected':'')+'>admin (เห็นทุกอย่าง)</option></select>'+'<span style="font-size:11px;color:#999;margin-left:10px">แผนก</span> '+laDeptSelectHTML('la-ed-dept',udept)+'</div>'+'<div style="font-size:11px;color:#999;margin:6px 0 4px">เป็นเซลล์ (เห็นเฉพาะเอเยนต์ของตัวเอง): '+laSalesSelectHTML('la-ed-sales',u.salesId||'')+'</div>'+laPresetBtnsHTML('ed')+laPermBoxesHTML('ed',sel)+'<div style="font-size:11px;color:#999;margin-top:9px">สิทธิ์แก้ไข ราย section <span style="color:#bbb">(ไม่ติ๊ก = ดูอย่างเดียว):</span></div>'+laEditBoxesHTML('edE',esel)+'<button class="la-ub-btn" style="background:#1C4A30;margin-top:12px" onclick="__laSavePerms('+id+')">บันทึก</button></div>';
    document.body.appendChild(ov);
  };
  window.__laSavePerms=function(id){ var role=document.getElementById('la-ed-role').value; var perms=laReadBoxes('ed'); var editAreas=laReadEditBoxes('edE'); var dEl=document.getElementById('la-ed-dept'); var dept=dEl?dEl.value:null; var sEl=document.getElementById('la-ed-sales'); var salesId=sEl?sEl.value:''; var r=sx('POST','/api/users/perms',JSON.stringify({id:id,role:role,dept:dept,perms:perms,editAreas:editAreas,salesId:salesId}),'application/json'); if(r.status===200){ var pm=document.getElementById('la-pmodal'); if(pm) pm.remove(); window.__laUserList=null; __laLoadUsers(); alert('บันทึกสิทธิ์แล้ว · ผู้ใช้คนนั้นต้องออกแล้วเข้าใหม่จึงจะเห็นผล'); } else alert((r.json&&r.json.error)||'บันทึกไม่สำเร็จ'); };
  window.__laDelUser=function(id,un){ if(!confirm('ลบผู้ใช้ "'+un+'"?')) return; var r=sx('DELETE','/api/users?id='+id); if(r.status===200){ window.__laUserList=null; __laLoadUsers(); } else alert((r.json&&r.json.error)||'ลบไม่สำเร็จ'); };
  window.__laReset=function(id,un){ var p=prompt('ตั้งรหัสผ่านใหม่ของ "'+un+'":'); if(!p) return; var r=sx('POST','/api/users/password',JSON.stringify({id:id,password:p}),'application/json'); alert(r.status===200?'เปลี่ยนรหัสแล้ว':((r.json&&r.json.error)||'ไม่สำเร็จ')); };
})();
