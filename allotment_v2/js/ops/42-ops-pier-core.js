/* ════════════════════════════════════════════════════════════════════════
   §opsPierCore (2026-10-13) · the pier office screens on operation-backend · shared plumbing
   ────────────────────────────────────────────────────────────────────────
   Legacy keeps the pier office in browser globals (PIER_STAFF, PIER_ITEMS, PIER_KINDS, PIER_CODES,
   PIER_SECT, PIER_LIC_*, PIER_CFG, PIER_MOVES, PIER_SHEET, PIER_JOB, …) and every save ends in ONE
   function, poPersist(), which writes the whole lot to the browser blob. There is no /api/* any
   more, so in ops mode that blob write reaches nobody.

   This file is the bridge the other pier adapters (43-ops-pier-cash … 47-ops-pier-roster) share:

     O.pier.register(spec)   a collection of rows the server owns. spec = {
                               name, order,            run order inside a phase (lower first)
                               fill(json),             put the server's answer into the legacy globals
                               plan(),                 what changed since the last server answer:
                                                       [{ run(): Promise, label }]  or []
                               restore(),              put the globals back to the last server answer
                               commit()                the globals now ARE the server's state }
     O.pier.load()           GET /v1/pier-office (every list) and fill every spec
     O.pier.ensure(view)     load once a minute; a render wrapper calls it, then redraws
     O.pier.onRemap(fn)      fn(kind, oldId, newId) after the server gave a row its own id
     O.pier.flush()          run the writes now (tests, and screens that must not wait)

   How a save works (legacy functions stay as they are; they still mutate the globals and call
   poPersist): the poPersist wrapper below asks every spec what changed since the server last
   answered and sends it through O.queue, creates first (so a new group exists before a person is put
   in it), then changes, then deletes, then the order command. If the server refuses ANY of it, every
   spec is put back to the server's last answer, the server's message is a red toast, and the screen
   is drawn again: a refused write never stays on screen. While the request is in flight the screen
   already shows the typed value (legacy functions change the globals before calling poPersist);
   typing in a box waits 0.5 s so one letter is not one request.

   Writes are OFF until the first successful load (a spec with no baseline plans nothing), so a
   failed load can never push local seed data to the server.

   Legacy mode (!O.enabled()): poPersist is legacy's, untouched.
   Classic script · loads after 08-app.js, before the other pier adapters.
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  var L = { poPersist: window.poPersist, poModalClose: window.poModalClose };
  var P = O.pier = { specs: [], loaded: false, loadedAt: 0, view: '', lastModal: null };
  var remapFns = [], afterLoadFns = [];
  var timer = null, inflight = 0, loading = null;

  function enabled(){ return !!(O.enabled && O.enabled()); }
  function clone(x){ return x == null ? x : JSON.parse(JSON.stringify(x)); }
  function text(v){ return v == null ? '' : String(v).trim(); }
  function nul(v){ var s = text(v); return s === '' ? null : s; }

  P.clone = clone; P.text = text; P.nul = nul; P.enabled = enabled;
  P.adopt = function(name, rows){ var s = P.specs.filter(function(x){ return x.name === name; })[0]; if(s && s.adopt) s.adopt(rows); };
  P.register = function(spec){
    P.specs = P.specs.filter(function(s){ return s.name !== spec.name; });
    P.specs.push(spec);
    P.specs.sort(function(a, b){ return (a.order || 0) - (b.order || 0); });
  };
  P.onRemap = function(fn){ remapFns.push(fn); };
  // fn(json) after every spec is filled, one after the other; a promise it returns is waited for (licences are read per person)
  P.afterLoad = function(fn){ afterLoadFns.push(fn); };
  P.remapped = function(kind, oldId, newId){
    remapFns.forEach(function(fn){ try{ fn(kind, oldId, newId); }catch(_){} });
  };

  /* ── reads ───────────────────────────────────────────────────────────── */
  P.load = function(){
    if(!enabled()) return Promise.resolve(null);
    if(loading) return loading;
    loading = O.get('/v1/pier-office').then(function(j){
      P.specs.forEach(function(s){ if(s.fill) s.fill(j || {}); });
      return afterLoadFns.reduce(function(p, fn){ return p.then(function(){ return fn(j || {}); }); }, Promise.resolve()).then(function(){
        P.loaded = true; P.loadedAt = Date.now();
        return j;
      });
    }).then(function(j){ loading = null; return j; }, function(e){
      loading = null;
      O.fail('Pier office did not load', e);
      return null;
    });
    return loading;
  };
  function idle(){ return !timer && inflight === 0; }
  // A render wrapper asks for fresh data; the screen is drawn again when it arrives. Never while a
  // write is pending (the answer would overwrite what the person just typed).
  P.ensure = function(view){
    P.view = view || P.view;
    if(!enabled() || loading || !idle()) return;
    if(P.loaded && Date.now() - P.loadedAt < 60000) return;
    P.load().then(function(j){ if(j) P.redraw(); });
  };

  /* ── drawing again ───────────────────────────────────────────────────── */
  P.redraw = function(){
    try{
      var fn = P.view && window[P.view];
      if(typeof fn === 'function') fn();
    }catch(_){}
    try{
      if(P.lastModal && document.getElementById('po-modal')) P.lastModal();
    }catch(_){}
  };
  // The openers of the pier office dialogs: remember the open one so a refusal can show it again.
  ['poItemsOpen', 'poStaffOpen', 'paSectOpen', 'paCodesOpen', 'plTypesOpen'].forEach(function(name){
    var orig = window[name]; if(typeof orig !== 'function') return;
    window[name] = function(){
      var args = arguments, self = this;
      P.lastModal = function(){ return orig.apply(self, args); };
      return orig.apply(this, arguments);
    };
  });
  window.poModalClose = function(){
    P.lastModal = null;
    return L.poModalClose ? L.poModalClose.apply(this, arguments) : undefined;
  };
  // Render wrappers: draw as legacy does, then fetch once (and draw again when it arrives).
  ['renderPierOffice', 'renderPierAtt', 'renderPierLic', 'renderPierJob'].forEach(function(name){
    var orig = window[name]; if(typeof orig !== 'function') return;
    window[name] = function(){
      var r = orig.apply(this, arguments);
      if(enabled()) P.ensure(name);
      return r;
    };
  });

  /* ── writes ──────────────────────────────────────────────────────────── */
  function typing(){
    try{ var a = document.activeElement; return !!(a && /^(INPUT|TEXTAREA)$/.test(a.tagName)); }catch(_){ return false; }
  }
  function schedule(){
    if(timer) clearTimeout(timer);
    timer = setTimeout(function(){ timer = null; run(); }, typing() ? 500 : 0);
  }
  function restoreAll(){
    P.specs.forEach(function(s){ try{ if(s.restore) s.restore(); }catch(_){} });
  }
  function run(){
    inflight++;
    return O.queue(function(){
      // plan at run time: whatever the globals hold now
      var jobs = [];
      P.specs.forEach(function(s){ if(s.plan) s.plan().forEach(function(j){ jobs.push(j); }); });
      jobs.sort(function(a, b){ return (a.phase || 0) - (b.phase || 0); });   // stable: spec order kept inside a phase
      return jobs.reduce(function(p, j){ return p.then(function(){ return j.run(); }); }, Promise.resolve()).then(function(){
        P.specs.forEach(function(s){ if(s.commit) s.commit(); });
        if(jobs.length) O.wrote('pier');
        return jobs.length;
      });
    }).then(function(n){
      inflight--;
      if(n && idle()) P.redraw();   // ids the server gave must reach the buttons on screen
      return n;
    }, function(e){
      inflight--;
      restoreAll();
      if(!(e && e.declined)) O.fail('Pier office not saved' + (e && e.code ? ' · ' + e.code : ''), e);   // declined = said no at a confirm: no red toast
      // part of the batch may have gone through: read what the server holds, then draw it
      return (idle() ? P.load() : Promise.resolve(null)).then(function(){ P.redraw(); return null; });
    });
  }
  P.flush = function(){
    if(timer){ clearTimeout(timer); timer = null; }
    return run();
  };

  window.poPersist = function(){
    var r = L.poPersist ? L.poPersist.apply(this, arguments) : undefined;   // legacy's local copy (view prefs that have no server home)
    if(enabled() && P.loaded) schedule();
    return r;
  };

  /* ── a list the server owns, written as legacy's array of rows ───────── */
  /* cfg = { name, order, list, global, base, toServer(row), fromServer(row), create(): bool,
             remove: 'delete'|'none', path, refs: [{ kind, apply(old, nw) }], key, orderBy }
     The rows keep legacy's shape; the server's id replaces legacy's after a create. */
  P.listSpec = function(cfg){
    var base = null;
    var spec = {
      name: cfg.name, order: cfg.order || 0,
      rows: function(){ var a = window[cfg.global]; return Array.isArray(a) ? a : []; },
      fill: function(j){
        var rows = j[cfg.key];
        if(cfg.noFill || !Array.isArray(rows)) return;
        window[cfg.global] = rows.map(cfg.fromServer);
        base = clone(window[cfg.global]);
        if(cfg.after) try{ cfg.after(); }catch(_){}
      },
      restore: function(){ if(base){ window[cfg.global] = clone(base); if(cfg.after) try{ cfg.after(); }catch(_){} } },
      commit: function(){ if(base) base = clone(spec.rows()); if(cfg.onCommit) try{ cfg.onCommit(); }catch(_){} },
      baseIds: function(){ return (base || []).map(function(r){ return r.id; }); },
      setRows: function(rows){ window[cfg.global] = rows; base = clone(rows); if(cfg.after) try{ cfg.after(); }catch(_){} },
      // rows the server made or changed itself (a transfer's receipt makes the receiver's item): into the list and its
      // base alike, so the next save does not send them back
      adopt: function(svRows){
        if(!Array.isArray(window[cfg.global])) window[cfg.global] = [];
        (svRows || []).forEach(function(sv){
          var r = cfg.fromServer(sv);
          [window[cfg.global], base].forEach(function(list){
            if(!list) return;
            var i = -1; list.forEach(function(x, n){ if(x && x.id === r.id) i = n; });
            if(i >= 0) list[i] = clone(r); else list.push(clone(r));
          });
        });
        if(cfg.after) try{ cfg.after(); }catch(_){}
      },
      plan: function(){
        if(!base) return [];
        var cur = spec.rows(), was = {}, now = {}, jobs = [];
        base.forEach(function(r){ was[r.id] = r; });
        cur.forEach(function(r){ now[r.id] = r; });
        // creates · phase 1
        cur.forEach(function(r){
          if(was[r.id] || !cfg.canCreate(r)) return;
          jobs.push({ phase: 1, label: cfg.name + ' add', run: function(){
            return O.call('POST', cfg.createPath ? cfg.createPath(r) : '/v1/pier-office/' + cfg.list, cfg.toServer(r, true)).then(function(sv){
              var old = r.id; r.id = sv.id;
              if(cfg.refs) cfg.refs.forEach(function(f){ f(old, sv.id); });
              P.remapped(cfg.name, old, sv.id);
            });
          } });
        });
        // changes · phase 2 (only the keys that differ)
        cur.forEach(function(r){
          var w = was[r.id]; if(!w) return;
          var changed = function(){
            var a = cfg.toServer(r), b = cfg.toServer(w), diff = {}, any = false;
            Object.keys(a).forEach(function(k){ if(JSON.stringify(a[k]) !== JSON.stringify(b[k])){ diff[k] = a[k]; any = true; } });
            return any ? diff : null;
          };
          if(!changed()) return;
          jobs.push({ phase: 2, label: cfg.name + ' change', run: function(){
            var diff = changed();   // again at run time: a group made a moment ago has its own id by now
            return diff ? O.call('PATCH', cfg.patchPath ? cfg.patchPath(r) : '/v1/pier-office/' + cfg.list + '/' + encodeURIComponent(r.id), diff) : null;
          } });
        });
        // deletes · phase 3
        if(cfg.remove === 'delete') base.forEach(function(w){
          if(now[w.id]) return;
          jobs.push({ phase: 3, label: cfg.name + ' delete', run: function(){
            return O.call('DELETE', cfg.deletePath ? cfg.deletePath(w) : '/v1/pier-office/' + cfg.list + '/' + encodeURIComponent(w.id));
          } });
        });
        // order · phase 4 · only when the order of the rows both sides know has changed
        if(cfg.orderBy){
          var groups = {};
          cur.forEach(function(r, i){ var g = cfg.orderBy(r); (groups[g] = groups[g] || []).push({ r: r, i: i }); });
          Object.keys(groups).forEach(function(g){
            var seq = function(rows){ return rows.slice().sort(function(a, b){
              var x = isFinite(+a.r.ord) && a.r.ord !== '' && a.r.ord != null ? +a.r.ord : 1e12;
              var y = isFinite(+b.r.ord) && b.r.ord !== '' && b.r.ord != null ? +b.r.ord : 1e12;
              return x - y || a.i - b.i; }).map(function(o){ return o.r; }); };
            var nowSeq = seq(groups[g]);
            var wasRows = base.map(function(r, i){ return { r: r, i: i }; }).filter(function(o){ return cfg.orderBy(o.r) === g; });
            var wasIds = seq(wasRows).map(function(r){ return r.id; }).filter(function(id){ return now[id]; });
            var nowKnown = nowSeq.filter(function(r){ return was[r.id]; }).map(function(r){ return r.id; });
            if(JSON.stringify(wasIds) === JSON.stringify(nowKnown)) return;
            jobs.push({ phase: 4, label: cfg.name + ' order', run: function(){
              var body = { ids: seq(groups[g]).map(function(r){ return r.id; }) };
              if(cfg.orderPier) body.pier = g;
              return O.call('POST', '/v1/pier-office/' + cfg.list + '/order', body);
            } });
          });
        }
        return jobs;
      }
    };
    P.register(spec);
    return spec;
  };

  // true while a save is waiting its turn or on its way: a reader must not overwrite the screen then
  P.busy = function(){ return !!timer || inflight > 0; };

  // test hooks
  P._state = function(){ return { timer: !!timer, inflight: inflight, loaded: P.loaded }; };
})();
