/* ════════════════════════════════════════════════════════════════════════
   §opsVanRateSets (2026-10-20) · FE-5 · Transfer Fleet rate sets (§vanTpl in 08-app.js) on operation-backend
   ────────────────────────────────────────────────────────────────────────
   GET    /v1/van-rate-sets                    sets: {id, name, base, cells, desc, groups}      → vanTpls()
   POST   /v1/van-rate-sets {name}             vanTplNew        PATCH /v1/van-rate-sets/{id} (rename: no screen yet)
   DELETE /v1/van-rate-sets/{id}               vanTplDel        PUT /v1/van-rate-sets/{id}/cells {route_id, field, rate}   vanTplSet
   POST   /v1/van-rate-sets/seed               vanTplSeed (once per session; the server only seeds when there is no set, then auto-links)
   POST   /v1/van-rates/apply {set_id, groups} vanTplApply / vanTplBulk   POST /v1/van-rates/copy {from_group, groups}   vanTplCopy
   POST   /v1/van-rates/pier-fill {set_id|group, pier, PK?, KL?}   vanPierFill
   GET    /v1/van-rates → groups[].state       vanGroupState / vanTplDiff (kind tpl | own | def, label, diff): 45-ops-van-bills.js keeps it
                                               on each group as R[gk]._state and the link as R[gk].tpl
   The blob keys van_rate_tpl and the tpl link are no longer used. Server first: nothing changes on screen until the answer comes.
   Not wired (client UI state only): ctVanFull, ctPierSet, ctXOpen, vanTplPick, vanTplSel, vanTplSelAllMissing, vanTplEdit.
   Classic script · after 45-ops-van-bills.js, before 90-ops-boot.js.
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var NAMES = ['vanTpls', 'vanTplsSave', 'vanTplSeed', 'vanTplAutoLink', 'vanTplDesc', 'vanTplDiff', 'vanGroupState', 'vanTplApply', 'vanTplBulk', 'vanTplCopy',
    'vanTplNew', 'vanTplDel', 'vanTplSet', 'vanPierFill', 'ctRender'];
  var orig = {}, S = { sets: null, loading: null, seeded: false };
  NAMES.forEach(function(n){ orig[n] = window[n]; });

  function enc(x){ return encodeURIComponent(x); }
  function VR(){ return O.vanRates; }
  function repaint(){ if(typeof window.ctRender === 'function') window.ctRender(); }
  function putSets(view){
    var m = {};
    ((view && view.sets) || []).forEach(function(s){ m[s.id] = { name: s.name, base: s.base, rt: s.cells || {}, desc: s.desc || '', groups: s.groups || [] }; });
    S.sets = m; return m;
  }
  function loadSets(force){
    if(S.sets && !force) return Promise.resolve(S.sets);
    if(S.loading) return S.loading;
    S.loading = O.get('/v1/van-rate-sets').then(putSets).then(function(m){ S.loading = null; return m; }, function(e){ S.loading = null; throw e; });
    return S.loading;
  }
  function wrap(name, fn){
    window[name] = function(){
      if(!O.enabled()) return orig[name] ? orig[name].apply(this, arguments) : undefined;
      return fn.apply(this, arguments);
    };
  }
  /* a write: the answer replaces the cache (a {groups, rates} answer goes to 45-ops-van-bills.js), then the screen is drawn again */
  function done(view){
    if(view && view.sets) putSets(view);
    if(view && view.groups && VR()) VR().apply(view);
    repaint();
    return view;
  }
  function run(title, send){
    return O.queue(send).then(done, function(e){ O.fail(title, e); return null; });
  }
  function ticked(){ return Object.keys((typeof _ct !== 'undefined' && _ct && _ct.vsel) || {}); }
  function stateOf(gk){ var G = window.vanRates ? window.vanRates()[gk] : null; return (G && G._state) || null; }
  function clearTicks(v){ if(v && typeof _ct !== 'undefined') _ct.vsel = {}; return v; }

  /* ── readers ── */
  wrap('ctRender', function(){
    var self = this, args = arguments;
    if(S.sets) return orig.ctRender.apply(self, args);
    return loadSets().then(function(){ return orig.ctRender.apply(self, args); }, function(e){ S.sets = {}; O.fail('Van rate sets could not load', e); return orig.ctRender.apply(self, args); });
  });
  wrap('vanTpls', function(){ return O.clone(S.sets || {}); });
  wrap('vanTplsSave', function(){ return; });
  wrap('vanTplAutoLink', function(){ return; });
  wrap('vanTplSeed', function(){
    if(!S.seeded){
      S.seeded = true;
      O.queue(function(){ return O.post('/v1/van-rate-sets/seed', {}); }).then(function(v){
        var changed = (v && (v.seeded || []).length) || (v && (v.linked || []).length);
        putSets(v);
        if(changed && VR()) VR().load(true).then(repaint, function(){});
        else if(changed) repaint();
      }, function(e){ try{ console.warn('[ops] van rate sets were not seeded · ' + (e && e.message)); }catch(_){} });
    }
    return O.clone(S.sets || {});
  });
  wrap('vanTplDesc', function(t){ return (t && t.desc) || ''; });
  wrap('vanTplDiff', function(gk){ var st = stateOf(gk); return st && st.kind === 'tpl' ? st.diff : null; });
  wrap('vanGroupState', function(gk){
    var st = stateOf(gk);
    if(!st || st.kind === 'def') return { k: 'def', t: '' };
    if(st.kind === 'tpl') return { k: 'tpl', t: st.label, d: st.diff };
    return { k: 'own', t: st.label };
  });

  /* ── writes ── */
  wrap('vanTplApply', function(gk, tid){
    return run('Rate set not applied', function(){ return O.post('/v1/van-rates/apply', { set_id: tid || null, groups: [gk] }); });
  });
  wrap('vanTplBulk', function(){
    var sel = ticked(); if(!sel.length){ alert('Tick at least one group first.'); return null; }
    var el = document.getElementById('ct-vtpl-bulk'), tid = el ? el.value : '';
    if(!tid){ alert('Choose a rate set first.'); return null; }
    if(!confirm('Apply this rate set to ' + sel.length + ' group(s)? Their current route rates will be replaced.')) return null;
    return run('Rate set not applied', function(){ return O.post('/v1/van-rates/apply', { set_id: tid, groups: sel }); }).then(clearTicks);
  });
  wrap('vanTplCopy', function(){
    var sel = ticked(); if(!sel.length){ alert('Tick at least one group first.'); return null; }
    var el = document.getElementById('ct-vcopy'), src = el ? el.value : ''; if(!src){ alert('Choose a group to copy from.'); return null; }
    if(!confirm('Copy rates from that group to ' + sel.length + ' group(s)?')) return null;
    var to = sel.filter(function(g){ return g !== src; }); if(!to.length) return null;
    return run('Rates not copied', function(){ return O.post('/v1/van-rates/copy', { from_group: src, groups: to }); }).then(clearTicks);
  });
  wrap('vanTplNew', function(){
    var nm = prompt('Name of the new rate set (e.g. Khao Lak partners 1,800):'); if(nm == null) return null; nm = String(nm).trim(); if(!nm) return null;
    return O.queue(function(){ return O.post('/v1/van-rate-sets', { name: nm }); }).then(function(v){
      putSets(v); if(v && v.id && typeof _ct !== 'undefined') _ct.vtplEdit = v.id;
      repaint(); return v;
    }, function(e){ O.fail('Rate set not created', e); return null; });
  });
  wrap('vanTplDel', function(id){
    var t = (S.sets || {})[id], n = t ? (t.groups || []).length : 0;
    if(!confirm('Delete this rate set?' + (n ? ('\n' + n + ' group(s) keep their current numbers but will no longer be linked to it.') : ''))) return null;
    return O.queue(function(){ return O.del('/v1/van-rate-sets/' + enc(id)); }).then(function(v){
      if(typeof _ct !== 'undefined' && _ct.vtplEdit === id) _ct.vtplEdit = '';
      if(v && v.sets) putSets(v); else if(S.sets) delete S.sets[id];
      return VR() ? VR().load(true).then(repaint, repaint) : repaint();   // the groups that were linked now show their own numbers
    }, function(e){ O.fail('Rate set not deleted', e); return null; });
  });
  wrap('vanTplSet', function(id, routeId, field, val){
    var s = String(val == null ? '' : val).trim(), rate = s === '' ? null : (+s || 0);
    return O.queue(function(){ return O.call('PUT', '/v1/van-rate-sets/' + enc(id) + '/cells', { route_id: routeId || null, field: routeId ? field : 'base', rate: rate }); })
      .then(function(v){ putSets(v); return VR() ? VR().load(true).then(repaint, repaint) : repaint(); },   // a group linked to this set shows "set + N edited" against the new numbers
        function(e){ O.fail('Rate not saved', e); repaint(); return null; });
  });
  wrap('vanPierFill', function(kind, id, pier){
    var pk = (document.getElementById('ct-pf-pk-' + pier) || {}).value, kl = (document.getElementById('ct-pf-kl-' + pier) || {}).value;
    pk = String(pk == null ? '' : pk).trim(); kl = String(kl == null ? '' : kl).trim();
    if(pk === '' && kl === ''){ alert('Enter PK and/or KL first.'); return null; }
    var body = { pier: pier }; if(kind === 'tpl') body.set_id = id; else body.group = id;
    if(pk !== '') body.PK = +pk || 0;
    if(kl !== '') body.KL = +kl || 0;
    return run('Pier rates not filled', function(){ return O.post('/v1/van-rates/pier-fill', body); });
  });

  O.vanRateSets = { load: loadSets, cache: function(){ return S.sets; } };
})();
