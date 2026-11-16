/* ══════════════════════════════════════════════════════════════════════════
   §opsBoatAudit (sync 11-12 · lk-inbox §flAud, 2026-11-11) · who created / edited a boat and each status row
   ──────────────────────────────────────────────────────────────────────────
   Legacy keeps { <boat id or status row id>: { cb, ca, ub, ua } } in the blob key fl_audit: flAudMark(ids, 'c'|'u')
   stamps the browser's login after each save, flAudGet reads it for the boat header (flAudBoatTxt) and the status
   history rows (flAudLine). Here the server stamps it in the same transaction as the boat / status-row write
   (config entry fl_audit, read-only to clients: a PUT is 409 server_owned), so every screen shows the same names.

   flAudGet   ← the config store's fl_audit entry (ops/61 loads GET /v1/config, which carries it)
   flAudMark  → nothing to send: the write already stamped it; the entry is read again after a boat write
                (O.onWrite kinds boat, boat-status-log, deployments), and the screen drawn again.
   Legacy's texts and layout are its own. Off unless laOps.enabled() (ops/61's active()).
   Load order: after ops/61-ops-config-store.js and ops/22-ops-fleet-boats.js. Classic script.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  function cs(){ return O.configStore || null; }
  function on(){ var c = cs(); try{ return !!(c && c.active && c.active()); }catch(_){ return false; } }
  function wrap(name, fn){
    var orig = window[name]; if(typeof orig !== 'function' || orig.__opsAud) return;
    var w = function(){ if(!on()) return orig.apply(this, arguments); return fn.apply(this, [orig].concat([].slice.call(arguments))); };
    w.__opsAud = true; window[name] = w;
  }
  function current(){
    var c = cs(); if(!c || !c.loaded || !c.loaded()) return {};
    var e = c.ents && c.ents.fl_audit, v = e && e.value;
    return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
  }

  var timer = null, busy = false, again = false;
  function refresh(){
    if(busy){ again = true; return null; }
    busy = true;
    return O.queue(function(){ return O.get('/v1/config/fl_audit'); }).then(function(r){
      var c = cs();
      if(c && c.ents && r){
        var e = c.ents.fl_audit || (c.ents.fl_audit = { value: null, version: null, snap: null, seq: 0, timer: null });
        e.value = r.value || {}; e.version = r.version == null ? null : r.version; e.seq++;
      }
      try{ if(c && typeof c.redraw === 'function') c.redraw(); }catch(_){}
    }).catch(function(e){ try{ console.warn('[ops] fl_audit · ' + (e && e.message)); }catch(_){} })
      .then(function(){ busy = false; if(again){ again = false; schedule(); } });
  }
  function schedule(){ clearTimeout(timer); timer = setTimeout(refresh, 400); }

  wrap('flAudGet', function(){ return O.clone ? O.clone(current()) : JSON.parse(JSON.stringify(current())); });
  wrap('flAudMark', function(){ schedule(); });
  if(typeof O.onWrite === 'function') O.onWrite(function(kind){ if(on() && /^(boat|boat-status-log|deployments)$/.test(String(kind || ''))) schedule(); });

  window.__laOpsBoatAudit = { current: current, refresh: refresh, schedule: schedule };
})();
