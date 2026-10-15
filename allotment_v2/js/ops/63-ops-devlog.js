/* ══════════════════════════════════════════════════════════════════════════
   §opsDevlog (2026-10-15) · System Log (view `devlog`, admin only) ⇄ operation-backend
   ──────────────────────────────────────────────────────────────────────────
   Legacy kept the notes in the blob (admin_devlog), shared by the admins through /api/save. Now they are the
   config store's admin-only key:

   GET|PUT /v1/config/admin_devlog      { value: [ {id,text,tag,done,at,by,doneAt,doneBy} ], version }
                                        read and written by an admin's login only (anyone else: 403)

   devlogLoad / devlogSave stay synchronous and keep their shapes: devlogLoad answers a copy of the list the
   screen shows, devlogSave(arr) is handed the whole new list. This file turns the difference between the two
   into single actions (add one, tick one, delete one) and sends the list with the version it last read.
   Two admins at once: a 409 stale_version reads the list again and applies the same action to the fresh one,
   so neither admin's note is lost. A save the server refuses is taken off the screen again, with its message.

   Off unless laOps.enabled(), the login is not an agent's and is an admin (devlogIsAdmin).
   Load order: after ops/61-ops-config-store.js, before ops/90-ops-boot.js. Classic script.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O || !O.configStore) return;
  var CS = O.configStore;
  var PATH = '/v1/config/admin_devlog';
  var TTL = 10000;                  // the list shown this long ago is read again in the background
  var TRIES = 4;                    // stale_version: read again and re-apply, at most this many times
  function noop(){}
  function mine(){ return CS.active() && typeof window.devlogIsAdmin === 'function' && window.devlogIsAdmin(); }

  var saved = { list: [], version: null, at: 0 };   // what the server last said
  var pending = [];                                  // unsent / in-flight actions, oldest first: [{ op }]
  var shown = [];                                    // saved + pending, what the screen reads
  var refreshing = false;

  function apply(list, op){
    var out = O.clone(list) || [];
    if(op.add){ if(!out.some(function(x){ return x.id === op.add.id; })) out.unshift(O.clone(op.add)); return out; }
    if(op.del) return out.filter(function(x){ return x.id !== op.del; });
    if(op.toggle){
      out.forEach(function(x){ if(x.id === op.toggle.id){ x.done = op.toggle.done; x.doneAt = op.toggle.doneAt; x.doneBy = op.toggle.doneBy; } });
    }
    return out;
  }
  function rebuild(){ shown = pending.reduce(function(l, p){ return apply(l, p.op); }, saved.list); }
  function take(r){
    saved = { list: O.clone((r && r.value) || []), version: r && r.version != null ? r.version : null, at: Date.now() };
  }

  /* what changed between the list shown and the one legacy hands back */
  function diff(oldL, newL){
    var ops = [], oldBy = {}, newBy = {};
    oldL.forEach(function(x){ oldBy[x.id] = x; });
    newL.forEach(function(x){ newBy[x.id] = x; });
    newL.slice().reverse().forEach(function(x){ if(!oldBy[x.id]) ops.push({ add: x }); });
    newL.forEach(function(x){
      var o = oldBy[x.id];
      if(o && !!o.done !== !!x.done) ops.push({ toggle: { id: x.id, done: !!x.done, doneAt: x.doneAt == null ? null : x.doneAt, doneBy: x.doneBy == null ? null : x.doneBy } });
    });
    oldL.forEach(function(x){ if(!newBy[x.id]) ops.push({ del: x.id }); });
    return ops;
  }

  var cell = CS.cell('System Log', function(){
    return O.get(PATH).then(function(r){ take(r); rebuild(); });
  });

  function repaint(){ if(typeof window.renderDevLog === 'function' && document.getElementById('devlog-host')){ try{ window.renderDevLog(); }catch(_){} } }

  /* one action, sent on its own: PUT with the version read; on 409 read again and re-apply it to the fresh list */
  function send(entry){
    return O.queue(function(){
      var n = 0;
      function go(){
        n++;
        var body = { value: apply(saved.list, entry.op) };
        if(saved.version != null) body.version = saved.version;
        return O.call('PUT', PATH, body).then(function(r){ take(r); }, function(e){
          if(e && e.code === 'stale_version' && n < TRIES){
            return O.get(PATH).then(function(r){ take(r); return go(); });
          }
          throw e;
        });
      }
      return go();
    }).then(function(){
      pending.splice(pending.indexOf(entry), 1); rebuild(); repaint();
    }, function(e){
      pending.splice(pending.indexOf(entry), 1); rebuild();
      O.fail('System Log note not saved', e); repaint();
    });
  }

  function wrap(name, fn){
    var orig = window[name]; if(typeof orig !== 'function') return;
    window[name] = function(){
      if(!mine()) return orig.apply(this, arguments);
      return fn.apply(this, [orig].concat([].slice.call(arguments)));
    };
  }
  wrap('devlogLoad', function(){
    if(cell.loaded) return O.clone(shown);
    cell.miss(); return [];
  });
  wrap('devlogSave', function(orig, arr){
    if(!cell.loaded){ O.fail('System Log note not saved', new Error('The log is still loading, try again')); return; }
    var ops = diff(shown, arr || []);
    ops.forEach(function(op){ var entry = { op: op }; pending.push(entry); send(entry); });
    rebuild();
  });
  /* the list is read again in the background when the screen is drawn after a while; redraw only if it changed */
  wrap('renderDevLog', function(orig){
    var r = orig.apply(this, [].slice.call(arguments, 1));
    if(cell.loaded && !refreshing && !pending.length && Date.now() - saved.at > TTL){
      refreshing = true;
      var before = JSON.stringify(saved.list);
      O.get(PATH).then(function(x){
        refreshing = false;
        if(pending.length) return;
        take(x);
        if(JSON.stringify(saved.list) !== before){ rebuild(); repaint(); }
      }, function(){ refreshing = false; });
    }
    return r;
  });

  if(mine()) cell.load().catch(function(e){ O.fail('System Log did not load', e); });

  window.laOps.devlog = { cell: cell, diff: diff, apply: apply, state: function(){ return { saved: saved, pending: pending, shown: shown }; } };
})();
