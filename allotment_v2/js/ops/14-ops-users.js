/* ══════════════════════════════════════════════════════════════════════════
   §opsUsers · User admin + password reset <-> operation-backend
   ──────────────────────────────────────────────────────────────────────────
   The user window in 01-auth-sync.js talks through one synchronous helper, sx(). For /api/users*
   that helper now calls window.laOpsUsersSx(method,url,body), which answers {status,json,text}
   in the shape the window already reads. The screen code stays as it was; only the transport and
   the field names change. Admin only on the server (403 otherwise).

   GET    /api/users                  -> GET   /v1/users                 {users:[...]}
   POST   /api/users                  -> POST  /v1/users                 (201)
   POST   /api/users/perms            -> PATCH /v1/users/:id
   POST   /api/users/password         -> POST  /v1/users/:id/password
   DELETE /api/users?id=N             -> PATCH /v1/users/:id {disabled:true}
                                         (the server never deletes a login; a disabled one is
                                          hidden from the list and cannot sign in)

   Mapping: server view_perms + actions <-> legacy perms (act-* keys live inside perms in the
   browser, in their own list on the server); edit_areas <-> editAreas; sales_id <-> salesId.
   Returns null when operation mode is off, so sx() falls back to its old path.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O=window.laOps; if(!O) return;

  function base(){ return window.LA_OPS_BACKEND||''; }
  function token(){ try{ return sessionStorage.getItem('la_ops_token')||''; }catch(_){ return ''; } }

  /* one synchronous call; a 401 sends the user back to login, as laOpsFetch does */
  function xhr(method, path, body){
    var x=new XMLHttpRequest();
    try{
      x.open(method, base()+path, false);
      x.setRequestHeader('Authorization','Bearer '+token());
      if(body!==undefined) x.setRequestHeader('Content-Type','application/json');
      x.send(body!==undefined?JSON.stringify(body):null);
    }catch(e){ return {status:0, json:null, text:''}; }
    if(x.status===401){ try{ sessionStorage.removeItem('la_ops_token'); }catch(_){} try{ location.reload(); }catch(_){} }
    var j=null; try{ j=JSON.parse(x.responseText); }catch(_){}
    return {status:x.status, json:j, text:x.responseText};
  }

  /* any 2xx is "200" to the window; a refusal carries the server's message as .error */
  function answer(r, shape){
    if(r.status>=200 && r.status<300) return {status:200, json:shape?shape(r.json):(r.json||{ok:true}), text:r.text};
    var msg=(r.json&&(r.json.message||r.json.error))||'';
    return {status:r.status||0, json:{error:msg}, text:r.text};
  }

  function isAct(k){ return typeof k==='string' && k.indexOf('act-')===0; }
  function splitPerms(perms){
    if(!Array.isArray(perms)) return {view:null, acts:[]};
    return { view:perms.filter(function(k){ return !isAct(k); }), acts:perms.filter(isAct) };
  }
  function toRow(u){
    var perms=Array.isArray(u.view_perms)?u.view_perms.concat(u.actions||[]):null;
    return { id:u.id, username:u.username, name:u.name||'', role:u.role||'staff', dept:u.dept||'',
      salesId:u.sales_id||'', agentId:u.agent_id||'', perms:perms,
      editAreas:Array.isArray(u.edit_areas)?u.edit_areas.slice():null };
  }
  function parse(body){ try{ return typeof body==='string'?JSON.parse(body):(body||{}); }catch(_){ return {}; } }

  function patchBody(b){
    var s=splitPerms(b.perms), out={};
    if(b.role!==undefined) out.role=b.role;
    if(b.dept!==undefined) out.dept=b.dept||null;
    if(b.salesId!==undefined) out.sales_id=b.salesId||null;
    if(b.editAreas!==undefined) out.edit_areas=b.editAreas;
    if(b.perms!==undefined){ out.view_perms=s.view; out.actions=s.acts; }
    return out;
  }

  function users(method, url, body){
    if(!O.enabled()) return null;
    var u=String(url).split('?'), path=u[0], b=parse(body), id;
    if(method==='GET' && path==='/api/users')
      return answer(xhr('GET','/v1/users'), function(j){
        return {users:((j&&j.users)||[]).filter(function(x){ return !x.disabled_at; }).map(toRow)}; });
    if(method==='POST' && path==='/api/users'){
      var nb=patchBody(b);
      nb.username=b.username; nb.name=b.name||b.username; nb.password=b.password;
      if(!nb.role) nb.role='staff';
      return answer(xhr('POST','/v1/users',nb), toRow);
    }
    if(method==='POST' && path==='/api/users/perms')
      return answer(xhr('PATCH','/v1/users/'+encodeURIComponent(b.id),patchBody(b)), toRow);
    if(method==='POST' && path==='/api/users/password')
      return answer(xhr('POST','/v1/users/'+encodeURIComponent(b.id)+'/password',{password:b.password}));
    if(method==='DELETE' && path==='/api/users'){
      id=(/(?:^|&)id=([^&]+)/.exec(u[1]||'')||[])[1];
      if(!id) return {status:400, json:{error:'id is required'}, text:''};
      return answer(xhr('PATCH','/v1/users/'+encodeURIComponent(id),{disabled:true}), toRow);
    }
    return null;
  }

  window.laOpsUsersSx=users;
  O.users={sx:users, toRow:toRow, splitPerms:splitPerms};
})();
