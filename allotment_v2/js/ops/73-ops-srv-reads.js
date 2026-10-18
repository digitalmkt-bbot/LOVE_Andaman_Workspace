/* ══════════════════════════════════════════════════════════════════════════
   §opsSrvReads (w4-f1, 2026-10-18) · one small cache for the server's report reads
   ──────────────────────────────────────────────────────────────────────────
   The Dashboard, Action Board, booking calendar and the range reports (cancellations, B2B, operations, our mix,
   pickup map, prep, analysis) each draw from ONE server answer per screen/range (operation-backend
   todo/b1-sales-dashboard-model.md, todo/b2-reports-model.md). The renders stay synchronous, so this file does
   the asking and the remembering:

     laOps.srv.read(key, path, params, onLand)
        returns the cached answer (or null while there is none) and starts the read when there is no answer yet or
        the answer is stale. onLand() is called once when a read lands, to redraw the screen.
        A stale answer (a write happened) stays on screen until the new one lands. A failed read is shown to the
        person once (laOps.fail) and not repeated until the next write.
     laOps.srv.peek(key)    the cached answer, no read
     laOps.srv.status(key)  'loading' | 'failed' | 'ready' | 'idle'
     laOps.srv.clear()      forget everything

   Nothing here computes a figure. Load order: before the other 73-ops-*.js files. Classic script.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O || (O.srv && O.srv.__w4f1)) return;
  var cache = {}, loading = {}, failed = {}, stale = {}, waiters = {};

  function read(key, path, params, onLand){
    if(!O.enabled()) return null;
    if(typeof onLand === 'function'){ var ws = (waiters[key] = waiters[key] || []); if(ws.indexOf(onLand) < 0) ws.push(onLand); }
    var have = cache[key] || null;
    if(have && !stale[key]) { drop(key); return have; }
    if(failed[key]) { drop(key); return have; }
    if(!loading[key]){
      loading[key] = O.get(path, params).then(function(j){
        cache[key] = j; delete stale[key]; delete failed[key];
        return j;
      }, function(e){
        failed[key] = e;
        O.fail('Could not load ' + (path.split('/').slice(-2).join('/')), e);
        return null;
      }).then(function(j){
        delete loading[key];
        var w = waiters[key] || []; delete waiters[key];
        w.forEach(function(fn){ try{ fn(j); }catch(_){} });
        return j;
      });
    }
    return have;
  }
  /* an answer that is already good needs no redraw: forget the callbacks that were queued for this call */
  function drop(key){ if(!loading[key]) delete waiters[key]; }
  function peek(key){ return cache[key] || null; }
  function clear(){ cache = {}; loading = {}; failed = {}; stale = {}; waiters = {}; }
  /* a write (here or from another machine) makes every answer old; the old one stays until the new lands */
  O.onWrite(function(){ Object.keys(cache).forEach(function(k){ stale[k] = true; }); failed = {}; });

  function status(key){ return loading[key] ? 'loading' : failed[key] ? 'failed' : cache[key] ? 'ready' : 'idle'; }

  O.srv = { read: read, peek: peek, clear: clear, status: status, __w4f1: true,
            fresh: function(key){ return !!cache[key] && !stale[key]; } };
})();
