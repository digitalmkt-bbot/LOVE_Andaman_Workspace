/* ════════════════════════════════════════════════════════════════════════
   §opsPierOffice (2026-10-13) · the rest of the pier office on operation-backend
   ────────────────────────────────────────────────────────────────────────
   42/43 own the lists, 47 the job sheets, 32 the park tickets, 44-ops-pier-money the money. This file is
   what was left: settings, licences, roster, pay, stock, sign-out sheets, boat close, fines, day close.

   GET    /v1/pier-office/settings                                  PIER_CFG scalars (cycleStart, codes, licWarnDays, payWsMin)
   PATCH  /v1/pier-office/settings                                  the scalars that changed
   PATCH  /v1/pier-office/license-types/{id}                        PIER_LIC_TYPES   (through 42's list spec)
   POST|PATCH|DELETE /v1/pier-office/license-classes[/{id}]         PIER_LIC_CLASSES
   GET    /v1/pier-office/staff/{id}/licences                       PIER_LICENSES, one call per person
   POST   /v1/pier-office/staff/{id}/licences · PATCH|DELETE /v1/pier-office/licences/{id}
   POST   /v1/pier-office/boats/{boat}/licence-check                plCheckBoat answers from the server
   GET    /v1/pier-office/{pier}/roster?from=&to=                   every cell, with its layer (paCell answers from it)
   PUT    /v1/pier-office/{pier}/roster/{date}/{staff}              a hand-set cell, a plan, the night code
   GET    /v1/pier-office/{pier}/pay?cycle=                         the trip allowance (paPayOf answers from it)
   PUT    /v1/pier-office/staff/{id}/pay-rate · GET|PUT /v1/pier-office/pay-rules
   GET    /v1/pier-office/{pier}/stock                              balances (poBal answers from them)
   POST   /v1/pier-office/{pier}/stock/{receive|count|adjust|laundry-out|laundry-in|mark-fixed|write-off}
   GET    /v1/pier-office/{pier}/moves?from=&limit=                  the stock ledger with each fine's status (PIER_MOVES, poLedgerOpen, finePay)
   GET    /v1/pier-office/{pier}/days/{date}/boats/{boat}/outstanding   per item: carry, issued, settled, outstanding (poBoatSum, poBoatCarry, the close dialog)
   POST   /v1/pier-office/{pier}/boats/{boat}/stock/{assign|unassign|ship-lost|ship-writeoff|ship-repair}
   POST   /v1/pier-office/{pier}/days/{date}/boats/{boat}/close     the boat's "close" (return, repair, write-off, lost, on board)
   PATCH  /v1/pier-office/moves/{id}                                the note of a move
   POST   /v1/pier-office/moves/{id}/fine-payment                   paid or waived
   GET|PUT /v1/pier-office/{pier}/days/{date}/sheets/{boat}  · POST …/commit    the sign-out sheet
   GET    /v1/pier-office/{pier}/days/{date}/boats                  stage of each boat, day lock, draft sheets
   POST   /v1/pier-office/{pier}/days/{date}/close | /reopen

   How it fits (same contract as 42-ops-pier-core.js): screens still change the legacy globals and call
   poPersist(); each area here is a spec that sends what changed, in order, and puts the globals back if the
   server refuses. Reads come the other way: a render wrapper fetches once, the legacy getters answer from the
   server's numbers (poBal, poBoatStage, poSheetPending, paCell, paPayOf, plCheckBoat), and the screen is
   drawn again. Browser rules this replaces when ops mode is on: the licence check, the roster layers, the pay
   formula, the sign-out sheet's stock diff (poIsCommit), the day-close checks.

   The ledger (2026-10-13): when the office draws, the pier's moves are read and PIER_MOVES is replaced by them
   (moves not yet sent are kept), so poLedgerOpen, poBoatSum, poBoatCarry and the fine rows show the server's
   history, not just this session's. The boat close dialog (poCloseOpen) first reads the boat's per-item
   outstanding; poBoatSum / poBoatCarry answer from it until the next write. Its save (poCloseSave) is
   server first (2026-10-14): the close command answers before any move is added or the dialog closes.
   ship_writeoff / ship_repair
   are the ship-writeoff / ship-repair commands (a note is required, no fine).
   Reads cover up to 5000 moves from 2000-01-01 (the server's cap); a longer ledger shows a toast and the newest 5000.
   Legacy mode (!O.enabled()): every wrapper delegates to the captured original.
   Classic script · loads after 47-ops-pier-job.js.
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O || !O.pier) return;
  var P = O.pier, clone = P.clone, text = P.text, nul = P.nul, enc = encodeURIComponent;
  var L = {};
  ['paCell', 'paHasJob', 'paPayOf', 'poBal', 'poBoatStage', 'poSheetPending', 'plCheckBoat', 'poBoatSum', 'poBoatCarry', 'poCloseOpen', 'poCloseSave', 'poIssueOpen', 'poIssueDraft', 'poIssueSave', 'poIsPrint',
   'renderPierOffice', 'renderPierAtt', 'paRoutesByCode', 'paRouteCode', 'poUnassigned'].forEach(function(n){ L[n] = window[n]; });

  function ready(){ return P.enabled() && P.loaded; }
  function cfg(){ var c = window.PIER_CFG; if(!c || typeof c !== 'object'){ c = window.PIER_CFG = {}; } return c; }
  function arr(name){ var a = window[name]; if(!Array.isArray(a)){ a = window[name] = []; } return a; }
  function num(v){ return v === '' || v == null || !isFinite(+v) ? null : +v; }
  function same(a, b){ return JSON.stringify(a) === JSON.stringify(b); }
  function ymd(d){ return typeof window.poYMD === 'function' ? window.poYMD(d) : d.toISOString().slice(0, 10); }
  function guarded(fn){ try{ return fn(); }catch(_){ return undefined; } }

  /* ── what is fresh · a render asks, the answer is cached, the screen is drawn again ── */
  var fresh = {}, inflight = {}, later = {};
  function invalidate(){ fresh = {}; }
  O.onWrite(function(kind){ if(kind === 'pier') invalidate(); });
  // The day's unassigned heads (poUnassigned) move when a booking or its boat changes: ask for the day again.
  O.onWrite(function(kind){
    if(kind !== 'booking' && kind !== 'trip-boat') return;
    Object.keys(fresh).forEach(function(k){ if(k.indexOf('day|') === 0) delete fresh[k]; });
  });
  P.afterLoad(function(){ invalidate(); stampLegacyMoves(); return Promise.resolve(); });
  function ensure(key, load, view){
    if(!ready() || fresh[key] || inflight[key]) return;
    /* §opsPierBusyRetry (2026-10-15) · a write is pending: ask again once it settles. The usual cause is the
       render itself: renderPierAtt's one-time migrations (paEnsureWsLt, paEnsureLtSplit, paEnsureNoteMig,
       paSkinApply) call poPersist on the first draw of a session. That run sends nothing, so nothing draws
       again, and skipping here left the roster empty (every total 0) until the next navigation. */
    if(P.busy()){
      if(!later[key]) later[key] = setTimeout(function(){ delete later[key]; ensure(key, load, view); }, 300);
      return;
    }
    inflight[key] = 1;
    load().then(function(){ fresh[key] = true; }, function(e){
      fresh[key] = true;   // do not ask again until something is written
      if(!(e && e.status === 403)) O.fail('Pier office not read', e);
    }).then(function(){
      delete inflight[key];
      var fn = window[view]; if(typeof fn === 'function' && !P.busy()) guarded(fn);
    });
  }

  /* ════ settings · PIER_CFG scalars ═══════════════════════════════════ */
  var SET_KEYS = [['cycleStart', 'cycle_start', 'int'], ['onBoatCode', 'on_boat_code', 'str'], ['mtCode', 'mt_code', 'str'],
                  ['ddCode', 'dd_code', 'nstr'], ['defCode', 'def_code', 'str'], ['nightCode', 'night_code', 'str'], ['licWarnDays', 'lic_warn_days', 'int']];
  /* settings.display · the screens' own preferences (legacy PIER_CFG.stBand, slotLb, signAgentColors, whoSects, cycNote).
     The server stores the object as sent (never reads it, 8 KB at most) and PATCH replaces it whole. The legacy setters
     (pjStColor, poSignColorSet, poWhoSectSave, paNote ...) write PIER_CFG and call poPersist, which sends the change here. */
  var DISPLAY_KEYS = ['stBand', 'slotLb', 'signAgentColors', 'whoSects', 'cycNote'];
  function displayView(){
    var c = cfg(), d = {};
    DISPLAY_KEYS.forEach(function(k){ var v = c[k]; if(v && typeof v === 'object' && Object.keys(v).length) d[k] = clone(v); });
    return d;
  }
  var setBase = null, setSrv = null;
  function setView(){
    var c = cfg(), o = {};
    SET_KEYS.forEach(function(k){
      var v = c[k[0]];
      if(k[2] === 'int'){ var n = parseInt(v, 10); if(isFinite(n)) o[k[1]] = n; }
      else if(k[2] === 'nstr') o[k[1]] = text(v) || null;
      else { var s = text(v); if(s) o[k[1]] = s; }
    });
    var m = c.payWsMin;
    if(m && typeof m === 'object'){
      if(num(m.cap) !== null) o.pay_ws_min_cap = +m.cap;
      if(num(m.crew) !== null) o.pay_ws_min_crew = +m.crew;
    }
    o.display = displayView();
    return o;
  }
  function applySettings(s){
    setSrv = s; var c = cfg();
    SET_KEYS.forEach(function(k){ c[k[0]] = s[k[1]] == null ? '' : s[k[1]]; });
    c.payWsMin = { cap: s.pay_ws_min_cap, crew: s.pay_ws_min_crew };
    var dsp = (s.display && typeof s.display === 'object') ? s.display : {};
    DISPLAY_KEYS.forEach(function(k){ if(dsp[k] && typeof dsp[k] === 'object') c[k] = clone(dsp[k]); else delete c[k]; });
    setBase = setView();
  }
  P.register({
    name: 'settings', order: 60,
    plan: function(){
      if(!setBase) return [];
      var cur = setView(), diff = {}, any = false;
      Object.keys(cur).forEach(function(k){ if(!same(cur[k], setBase[k])){ diff[k] = cur[k]; any = true; } });
      if(!any) return [];
      return [{ phase: 2, label: 'settings', run: function(){
        return O.call('PATCH', '/v1/pier-office/settings', diff).then(applySettings);
      } }];
    },
    restore: function(){ if(setSrv) applySettings(setSrv); },
    commit: function(){ if(setBase) setBase = setView(); }
  });
  P.afterLoad(function(){ return O.get('/v1/pier-office/settings').then(applySettings); });

  /* ════ licence types, classes, licences ══════════════════════════════ */
  P.listSpec({
    name: 'lictypes', order: 70, list: 'license-types', key: 'license_types', global: 'PIER_LIC_TYPES', remove: 'none',
    canCreate: function(){ return false; },
    fromServer: function(t){ return { id: t.id, side: t.side, short: t.short || '', formal: t.formal || '', perBoat: t.per_boat, active: t.active !== false }; },
    toServer: function(r){ return { short: text(r.short), formal: nul(r.formal), per_boat: parseInt(r.perBoat, 10) || 0, active: r.active !== false }; }
  });
  P.listSpec({
    name: 'licclasses', order: 71, list: 'license-classes', key: 'license_classes', global: 'PIER_LIC_CLASSES', remove: 'delete',
    canCreate: function(){ return true; },
    fromServer: function(c){ return { id: c.id, typeId: c.type_id, name: c.name || '', maxGt: c.max_gt, maxBhp: c.max_bhp, ord: c.sort }; },
    toServer: function(r, create){
      var o = { name: text(r.name), max_gt: num(r.maxGt), max_bhp: num(r.maxBhp) };
      if(create) o.type_id = r.typeId;
      return o;
    }
  });
  var licSpec = P.listSpec({
    name: 'licences', order: 80, list: 'licences', key: 'licences', global: 'PIER_LICENSES', remove: 'delete', noFill: true,
    canCreate: function(r){ return !!r.staffId; },
    createPath: function(r){ return '/v1/pier-office/staff/' + enc(r.staffId) + '/licences'; },
    patchPath: function(r){ return '/v1/pier-office/licences/' + enc(r.id); },
    deletePath: function(w){ return '/v1/pier-office/licences/' + enc(w.id); },
    fromServer: function(l){
      return { id: l.id, staffId: l.staff_id, classId: l.class_id, no: l.licence_no || '', exp: l.expires_on || '', issuedAt: l.issued_on || '',
               issuer: l.issuer || '', note: l.note || '', srv: { exp: l.expires_on || '', state: l.state || '', days: l.days_left } };
    },
    toServer: function(r){
      return { class_id: r.classId, licence_no: text(r.no), issued_on: nul(r.issuedAt), expires_on: nul(r.exp), issuer: nul(r.issuer), note: nul(r.note) };
    },
    onCommit: function(){ licCache = {}; }
  });
  P.onRemap(function(kind, oldId, newId){
    if(kind === 'staff') arr('PIER_LICENSES').forEach(function(l){ if(l.staffId === oldId) l.staffId = newId; });
  });
  P.afterLoad(function(){
    licCache = {};
    return Promise.all(arr('PIER_STAFF').map(function(s){
      return O.get('/v1/pier-office/staff/' + enc(s.id) + '/licences').then(function(a){ return (a && a.licences) || []; });
    })).then(function(parts){
      licSpec.setRows([].concat.apply([], parts).map(function(l){
        return { id: l.id, staffId: l.staff_id, classId: l.class_id, no: l.licence_no || '', exp: l.expires_on || '', issuedAt: l.issued_on || '',
                 issuer: l.issuer || '', note: l.note || '', srv: { exp: l.expires_on || '', state: l.state || '', days: l.days_left } };
      }));
    });
  });

  /* the licence check of a boat's crew (plCheckBoat) is the server's; the screen draws the old answer
     until the new one arrives, then draws again */
  var licCache = {};
  /* plState(l): ok | soon | bad | noexp. The server works it out for today in Asia/Bangkok (licence `state`, `days_left`,
     GET …/licences) with the pier's warning days; the browser used its own clock. Used only while the row's expiry is still the
     one the server judged (a date being edited uses the legacy test). */
  if(typeof window.plState === 'function'){
    var legacyPlState = window.plState;
    window.plState = function(l){
      if(!ready() || !l || !l.srv || l.srv.exp !== (l.exp || '') || !/^(ok|soon|bad|noexp)$/.test(l.srv.state)) return legacyPlState.apply(this, arguments);
      return l.srv.state;
    };
  }
  window.plCheckBoat = function(boatId, crewIds){
    if(!ready()) return L.plCheckBoat ? L.plCheckBoat.apply(this, arguments) : [];
    var ids = (crewIds || []).filter(Boolean), key = boatId + '|' + ids.slice().sort().join(',');
    var hit = licCache[key];
    if(hit && hit.notes) return hit.notes;
    if(!hit && boatId){
      licCache[key] = { notes: null };
      O.call('POST', '/v1/pier-office/boats/' + enc(boatId) + '/licence-check', { crew: ids }).then(function(notes){
        licCache[key] = { notes: (notes || []).map(function(n){ return { lv: n.level, t: n.text }; }) };
      }, function(){ licCache[key] = { notes: null, failed: true }; }).then(function(){
        var fn = window.renderPierJob; if(typeof fn === 'function' && !P.busy()) guarded(fn);
      });
    }
    return L.plCheckBoat ? L.plCheckBoat.apply(this, arguments) : [];
  };

  /* ════ roster · PIER_SHIFT ═══════════════════════════════════════════ */
  var rbase = {}, rcover = {}, cells = {}, rosters = {}, lastRoster = null, routeCodes = null;
  function sKey(date, sid){ return String(date) + '::' + String(sid); }
  function rsig(rec){ return rec ? (rec.c || '') + '|' + (rec.c && rec.plan ? 1 : 0) + '|' + (rec.n || '') : ''; }
  function staffPier(sid){
    var s = arr('PIER_STAFF').filter(function(x){ return x.id === sid; })[0];
    return s ? s.pier : '';
  }
  function shifts(){ var s = window.PIER_SHIFT; if(!s || typeof s !== 'object'){ s = window.PIER_SHIFT = {}; } return s; }
  function loadRoster(pier, from, to){
    return O.get('/v1/pier-office/' + enc(pier) + '/roster', { from: from, to: to }).then(function(j){
      var S = shifts(), seen = {};
      var daysMap = {};
      (j.days || []).forEach(function(d){
        rcover[d.date + '|' + pier] = 1;
        daysMap[d.date] = !!d.has_job;
      });
      (j.rows || []).forEach(function(r){
        (r.cells || []).forEach(function(c){
          var k = sKey(c.date, r.staff_id); seen[k] = 1; cells[k] = c;
          if(c.hand_code != null || c.night_code){
            var rec = {};
            if(c.hand_code != null){ rec.c = c.hand_code; rec.by = ''; rec.at = ''; if(c.is_plan) rec.plan = 1; }
            if(c.night_code) rec.n = c.night_code;
            S[k] = rec; rbase[k] = clone(rec);
          } else { delete S[k]; delete rbase[k]; }
        });
      });
      if(Array.isArray(j.route_codes)) routeCodes = j.route_codes;   // [{ code, routes: [{ id, name }] }]
      rosters[pier] = { pier: pier, from: j.from, to: j.to, days: daysMap, key: 'roster|' + pier + '|' + j.from + '|' + j.to };
      lastRoster = rosters[pier];
      return j;
    });
  }
  function boatName(id){
    if(!id) return '';
    var b = guarded(function(){ return typeof window.getBoat === 'function' ? window.getBoat(id) : null; });
    return (b && b.name) || id;
  }
  window.paCell = function(date, pier, st, E){
    var r = ready() && rosters[pier];
    if(r && date >= r.from && date <= r.to){
      var k = sKey(date, st && st.id), c = cells[k];
      if(c && rsig(shifts()[k]) === rsig(rbase[k])){
        return { c: c.code || '', src: c.layer, boat: boatName(c.boat_id), atPier: c.at_pier || '', rid: '' };
      }
    }
    return L.paCell ? L.paCell.apply(this, arguments) : { c:'', src:'none', boat:'', atPier:'' };
  };
  /* Route codes (paRouteCode / paRoutesByCode, hence paCodeMeta): the code each route holds is the server's
     (GET …/roster route_codes, routeCodeIndex); the roster cell of a sailed boat already carries it. Until a roster has
     been read, or for a route the index does not list, legacy's own guess answers (same table). */
  window.paRoutesByCode = function(code){
    if(!ready() || !routeCodes || !code) return L.paRoutesByCode.apply(this, arguments);
    var hit = routeCodes.filter(function(e){ return e.code === code; })[0];
    if(!hit) return L.paRoutesByCode.apply(this, arguments);   // not a code the server gives a route
    var ids = {};
    hit.routes.forEach(function(r){ ids[r.id] = 1; });
    var all = Array.isArray(window.ROUTES) ? window.ROUTES : [];
    return all.filter(function(r){ return ids[r.id]; });
  };
  window.paRouteCode = function(rid){
    if(ready() && routeCodes && rid){
      var rt = guarded(function(){ return typeof window.getRoute === 'function' ? window.getRoute(rid) : null; });
      if(rt && !String(rt.code || '').trim()){
        for(var i = 0; i < routeCodes.length; i++){
          if(routeCodes[i].routes.some(function(r){ return r.id === rid; })) return routeCodes[i].code;
        }
      }
    }
    return L.paRouteCode.apply(this, arguments);
  };
  window.paHasJob = function(date, pier, E){
    var r = ready() && rosters[pier];
    if(r && date >= r.from && date <= r.to && r.days && r.days[date] !== undefined){
      return !!r.days[date];
    }
    return L.paHasJob ? L.paHasJob.apply(this, arguments) : false;
  };
  P.register({
    name: 'roster', order: 90,
    plan: function(){
      var S = shifts(), keys = {}, jobs = [];
      Object.keys(S).forEach(function(k){ keys[k] = 1; });
      Object.keys(rbase).forEach(function(k){ keys[k] = 1; });
      Object.keys(keys).forEach(function(k){
        var p = k.split('::'), date = p[0], sid = p[1], pier = staffPier(sid);
        if(!pier || !rcover[date + '|' + pier]) return;
        var cur = S[k] || null, was = rbase[k] || null;
        if(rsig(cur) === rsig(was)) return;
        jobs.push({ phase: 2, label: 'roster cell', run: function(){
          var c2 = S[k] || null, w2 = rbase[k] || null, body = {};
          var cc = (c2 && c2.c) || '', wc = (w2 && w2.c) || '', cn = (c2 && c2.n) || '', wn = (w2 && w2.n) || '';
          if(cc !== wc || (cc && !!(c2 && c2.plan) !== !!(w2 && w2.plan))){ body.code = cc || null; if(cc) body.is_plan = !!(c2 && c2.plan); }
          if(cn !== wn) body.night_code = cn || null;
          if(!Object.keys(body).length) return null;
          return O.call('PUT', '/v1/pier-office/' + enc(pier) + '/roster/' + enc(date) + '/' + enc(sid), body).then(function(cell){
            cells[k] = cell; rbase[k] = c2 ? clone(c2) : null; if(!c2) delete rbase[k];
          });
        } });
      });
      return jobs;
    },
    restore: function(){
      var S = shifts();
      Object.keys(rbase).forEach(function(k){ S[k] = clone(rbase[k]); });
      Object.keys(S).forEach(function(k){
        var p = k.split('::'), pier = staffPier(p[1]);
        if(pier && rcover[p[0] + '|' + pier] && !rbase[k]) delete S[k];
      });
    },
    commit: function(){
      var S = shifts();
      Object.keys(S).forEach(function(k){
        var p = k.split('::'), pier = staffPier(p[1]);
        if(pier && rcover[p[0] + '|' + pier]) rbase[k] = clone(S[k]);
      });
    }
  });

  /* ════ pay · PIER_CFG.payRate / payRules ══════════════════════════════ */
  var pay = { rate: {}, rules: null, ruleSrv: null, ready: false }, lastPay = null;
  function cycleKey(date){
    var cs = parseInt(cfg().cycleStart, 10); if(!(cs >= 1 && cs <= 28)) cs = 26;
    var p = String(date).split('-'), y = +p[0], m = +p[1], d = +p[2];
    if(d < cs){ m -= 1; if(m < 1){ m = 12; y -= 1; } }
    return y + '-' + (m < 10 ? '0' : '') + m;
  }
  function rulesMap(list){
    var o = {}; (list || []).forEach(function(r){ o[r.code] = { x: +r.multiplier || 0, d: +r.per_day || 0, f: +r.flat || 0 }; });
    return o;
  }
  function rulesNorm(m){
    var o = {}; Object.keys(m || {}).sort().forEach(function(c){ var r = m[c] || {}; o[c] = [+r.x || 0, +r.d || 0, +r.f || 0]; });
    return o;
  }
  function applyPay(j){
    var c = cfg(); if(!c.payRate || typeof c.payRate !== 'object') c.payRate = {};
    (j.people || []).forEach(function(p){
      if(p.rate != null){ c.payRate[p.staff_id] = p.rate; pay.rate[p.staff_id] = p.rate; }
      else { delete c.payRate[p.staff_id]; delete pay.rate[p.staff_id]; }
    });
  }
  function payDirty(){
    var c = cfg(), cur = c.payRate && typeof c.payRate === 'object' ? c.payRate : {}, dirty = false;
    arr('PIER_STAFF').forEach(function(s){
      var a = num(cur[s.id]), b = pay.rate[s.id] == null ? null : pay.rate[s.id];
      if(a !== b) dirty = true;
    });
    if(!dirty && pay.rules && c.payRules && Object.keys(c.payRules).length && !same(rulesNorm(c.payRules), rulesNorm(pay.rules))) dirty = true;
    if(!dirty && setBase){
      var m = c.payWsMin || {};
      if(num(m.cap) !== setBase.pay_ws_min_cap || num(m.crew) !== setBase.pay_ws_min_crew) dirty = true;
    }
    return dirty;
  }
  P.register({
    name: 'pay', order: 95,
    plan: function(){
      if(!pay.ready) return [];
      var c = cfg(), cur = c.payRate && typeof c.payRate === 'object' ? c.payRate : {}, jobs = [];
      arr('PIER_STAFF').forEach(function(s){
        var a = num(cur[s.id]), b = pay.rate[s.id] == null ? null : pay.rate[s.id];
        if(a === b) return;
        jobs.push({ phase: 2, label: 'pay rate', run: function(){
          var v = num((cfg().payRate || {})[s.id]);
          return O.call('PUT', '/v1/pier-office/staff/' + enc(s.id) + '/pay-rate', { rate: v }).then(function(){
            if(v === null) delete pay.rate[s.id]; else pay.rate[s.id] = v;
          });
        } });
      });
      if(pay.rules && c.payRules && Object.keys(c.payRules).length && !same(rulesNorm(c.payRules), rulesNorm(pay.rules))){
        jobs.push({ phase: 2, label: 'pay rules', run: function(){
          var m = cfg().payRules || {};
          var rules = Object.keys(m).map(function(code){ var r = m[code] || {}; return { code: code, multiplier: +r.x || 0, per_day: +r.d || 0, flat: +r.f || 0 }; });
          return O.call('PUT', '/v1/pier-office/pay-rules', { rules: rules }).then(function(a){ pay.rules = rulesMap(a.rules); });
        } });
      }
      return jobs;
    },
    restore: function(){
      if(!pay.ready) return;
      var c = cfg(); c.payRate = clone(pay.rate) || {};
      if(pay.rules && c.payRules && Object.keys(c.payRules).length) c.payRules = clone(pay.rules);
    },
    commit: function(){}
  });
  P.afterLoad(function(){
    var cyc = cycleKey(ymd(new Date()));
    var rules = O.get('/v1/pier-office/pay-rules').then(function(a){
      pay.rules = rulesMap(a.rules);
      if(!a.defaulted) cfg().payRules = clone(pay.rules);
    });
    var piers = ['tublamu', 'panwa', 'ranong'].map(function(p){
      return O.get('/v1/pier-office/' + p + '/pay', { cycle: cyc }).then(applyPay);
    });
    // pay is for pier editors only: a 403 here is the normal answer for anyone else, and means no pay writes
    return Promise.all([rules].concat(piers)).then(function(){ pay.ready = true; }, function(){ pay.ready = false; });
  });
  window.paPayOf = function(sid, cnt, nights, ws){
    if(ready() && lastPay && fresh[lastPay.key] && lastPay.pier === window._poPier && lastPay.cycle === cycleKey(window._paDate) && !payDirty()){
      var p = lastPay.by[sid];
      if(p){
        var parts = (p.parts || []).map(function(x){
          var w = x.ws, note = '';
          if(w){
            note = [w.cap ? 'cap ' + w.cap : '', w.crew ? 'crew ' + w.crew : '', (w.cap || w.crew) && w.staff ? 'staff ' + w.staff : ''].filter(Boolean).join(' · ');
          }
          return { code: x.code, days: x.days, amt: x.amount, note: note };
        });
        var total = p.total != null ? p.total : parts.reduce(function(s, x){ return s + x.amt; }, 0);
        return { total: total, parts: parts, missing: !!p.missing, rate: p.rate };
      }
    }
    return L.paPayOf.apply(this, arguments);
  };

  /* ════ stock · balances, commands, boat close ═════════════════════════ */
  var stock = {}, stages = {};
  function balOf(r){ return { ready: r.ready, onboat: r.on_boat, onship: r.on_ship, dirty: r.dirty, laundry: r.laundry, repair: r.repair, gone: r.gone, inhand: r.inhand }; }
  function itemOf(id){ return arr('PIER_ITEMS').filter(function(i){ return i.id === id; })[0] || null; }
  function loadStock(pier){
    return O.get('/v1/pier-office/' + enc(pier) + '/stock').then(function(j){
      var m = {}; (j.items || []).forEach(function(r){ m[r.id] = balOf(r); }); stock[pier] = m;
    });
  }
  function putBalances(pier, rows){
    var m = stock[pier] = stock[pier] || {};
    (rows || []).forEach(function(r){ m[r.item_id] = balOf(r); });
  }
  window.poBal = function(itemId){
    var it = itemOf(itemId);
    if(ready() && it && stock[it.pier] && stock[it.pier][itemId]) return clone(stock[it.pier][itemId]);
    return L.poBal.apply(this, arguments);
  };
  function stageText(s){
    if(s.k === 'none') return { t: 'ยังไม่เบิก', c: '#9A9A93' };
    if(s.k === 'closed') return { t: 'ปิดยอดแล้ว' + (s.onboard ? ' · ยกไป ' + s.onboard : ''), c: '#1C7A4E' };
    if(s.k === 'carry') return { t: 'ค้างจากวันก่อน ' + s.left, c: '#B4560A' };
    return { t: 'ค้างคืน ' + s.left, c: '#B4560A' };
  }
  window.poBoatStage = function(date, boatId, pier){
    var s = stages[pier + '|' + date + '|' + boatId];
    if(ready() && s){ var t = stageText(s); return { k: s.k, t: t.t, c: t.c }; }
    return L.poBoatStage.apply(this, arguments);
  };
  window.poSheetPending = function(date, bid){
    var pier = window._poPier, s = stages[pier + '|' + date + '|' + bid];
    if(ready() && s) return s.sheet_status === 'draft' ? { n: 1, iss: 0, ret: 0 } : null;
    return L.poSheetPending.apply(this, arguments);
  };

  /* the day: lock, reopen trail, each boat's stage */
  var dayBase = {}, unassigned = {};
  window.poUnassigned = function(date, pier){
    var n = unassigned[pier + '|' + date];
    if(ready() && n !== undefined) return n;
    return L.poUnassigned.apply(this, arguments);
  };
  function dayKey(pier, date){ return pier + '::' + date; }
  function loadDay(pier, date){
    return O.get('/v1/pier-office/' + enc(pier) + '/days/' + enc(date) + '/boats').then(function(j){
      if(j.unassigned) unassigned[pier + '|' + date] = +j.unassigned.pax || 0;   // heads at the pier with no boat yet (poUnassigned)
      (j.boats || []).forEach(function(b){
        stages[pier + '|' + date + '|' + b.boat_id] = { k: b.stage, left: b.left, issued: b.issued, carry: b.carry, onboard: b.onboard, sheet_status: b.sheet_status };
      });
      var D = cfg().dayClose; if(!D || typeof D !== 'object') D = cfg().dayClose = {};
      var reopen = (j.reopens || []).map(function(r){ return { at: r.reopened_at, by: r.reopened_by || '', why: r.reason, closedAt: r.closed_at, closedBy: r.closed_by || '' }; });
      var k = dayKey(pier, date), e;
      if(j.closed) e = { at: j.closed.closed_at, by: j.closed.closed_by || '', reopen: reopen };
      else if(reopen.length) e = { at: reopen[reopen.length - 1].closedAt, by: reopen[reopen.length - 1].closedBy, reopen: reopen, open: 1 };
      else e = null;
      if(e) D[k] = e; else delete D[k];
      dayBase[k] = { closed: !!j.closed, entry: clone(e) };
    });
  }
  function dayClosed(e){ return !!(e && e.at && !e.open); }
  P.register({
    name: 'day', order: 120,
    plan: function(){
      var D = cfg().dayClose || {}, jobs = [];
      Object.keys(dayBase).forEach(function(k){
        var p = k.split('::'), pier = p[0], date = p[1], now = dayClosed(D[k]), was = dayBase[k].closed;
        if(now === was) return;
        var base = '/v1/pier-office/' + enc(pier) + '/days/' + enc(date);
        if(now){
          jobs.push({ phase: 5, label: 'day close', run: function(){
            return O.call('POST', base + '/close', who(pier)).then(function(row){
              dayBase[k] = { closed: true, entry: { at: row.closed_at, by: row.closed_by || '', reopen: ((D[k] || {}).reopen || []) } };
            });
          } });
        } else {
          var tr = (D[k] && D[k].reopen) || [], why = tr.length ? tr[tr.length - 1].why : '';
          jobs.push({ phase: 1, label: 'day reopen', run: function(){
            return O.call('POST', base + '/reopen', { reason: why }).then(function(){
              dayBase[k] = { closed: false, entry: clone(D[k]) };
            });
          } });
        }
      });
      return jobs;
    },
    restore: function(){
      var D = cfg().dayClose; if(!D || typeof D !== 'object') D = cfg().dayClose = {};
      Object.keys(dayBase).forEach(function(k){ if(dayBase[k].entry) D[k] = clone(dayBase[k].entry); else delete D[k]; });
    },
    commit: function(){}
  });

  /* who is recording · the pier's "ผู้บันทึก" pick (poWhoSet keeps the staff id under po_who::<pier>). Sent as the optional
     recorded_staff_id on every pier write; nothing is sent when nobody is picked (the server does not require it). */
  function who(pier){
    var id = ''; try{ id = localStorage.getItem('po_who::' + pier) || ''; }catch(_){}
    return id ? { recorded_staff_id: id } : {};
  }

  /* moves · every move the screens add (poAdd) goes to its command; the server's moves replace them */
  var CMD = { receive: 'receive', count: 'count', adjust: 'adjust', laundry_out: 'laundry-out', laundry_in: 'laundry-in', fixed: 'mark-fixed' };
  var BOATCMD = { assign: 'assign', unassign: 'unassign', ship_lost: 'ship-lost', ship_writeoff: 'ship-writeoff', ship_repair: 'ship-repair' };
  var SHIP_LOSS = { ship_lost: 1, ship_writeoff: 1, ship_repair: 1 };
  var CLOSE_T = { 'return': 'returned', repair: 'repair', writeoff: 'writeoff', lost: 'lost', onboard: 'onboard' };
  function moves(){ return arr('PIER_MOVES'); }
  // moves already in the browser when the office first loads are not ours to send
  var stamped = false;
  function stampLegacyMoves(){
    if(stamped) return; stamped = true;
    moves().forEach(function(m){ if(m && m.srv === undefined) m.srv = true; });
  }
  function fromServerMove(m){
    var o = { id: m.id, pier: m.pier, date: m.date, itemId: m.item_id, boatId: m.boat_id || '', type: m.type, qty: m.qty,
              note: m.note || '', at: m.recorded_at, by: m.recorded_by || '', srv: true, srvNote: m.note || '' };
    if(m.type === 'receive' && m.source) o.from = m.source;
    else if(m.from_kind) o.from = m.from_kind;
    if(m.fine_baht > 0){ o.fine = m.fine_baht; o.finePaid = m.fine_status === 'paid' || m.fine_status === 'waived'; }
    return o;
  }
  function swapMoves(sent, serverMoves){
    var list = moves();
    sent.forEach(function(m){ var i = list.indexOf(m); if(i >= 0) list.splice(i, 1); });
    (serverMoves || []).forEach(function(m){ list.push(fromServerMove(m)); });
  }
  function noteOf(m){ return text(m.note).replace(/\s*·\s*นับได้\s+\d+\s*\(.*\)\s*$/, ''); }
  function movesPlan(){
    var U = moves().filter(function(m){ return m && !m.srv; }), groups = {}, order = [], jobs = [], bad = {};
    function add(key, kind, m){ if(!groups[key]){ groups[key] = { kind: kind, moves: [] }; order.push(key); } groups[key].moves.push(m); }
    U.forEach(function(m){
      var t = m.type, boat = m.boatId || '';
      if(boat && CLOSE_T[t] && !(t === 'writeoff' && m.from === 'repair')) add('close|' + m.pier + '|' + m.date + '|' + boat, 'close', m);
      else if(BOATCMD[t] && boat) add('boat|' + t + '|' + m.pier + '|' + m.date + '|' + boat + '|' + (SHIP_LOSS[t] ? text(m.note) + '|' + (t === 'ship_lost' && m.fine > 0 ? m.id : '') : ''), 'boat', m);
      else if(t === 'writeoff' && m.from === 'repair') add('wo|' + m.pier + '|' + m.date + '|' + text(m.note), 'wo', m);
      else if(CMD[t] && !boat) add('cmd|' + t + '|' + m.pier + '|' + m.date + '|' + (m.from || '') + '|' + text(m.note), 'cmd', m);
      else if(CMD[t] && t === 'adjust') add('cmd|' + t + '|' + m.pier + '|' + m.date + '||' + text(m.note), 'cmd', m);
      else bad[t] = 1;
    });
    if(Object.keys(bad).length){
      jobs.push({ phase: 2, label: 'stock refused', run: function(){
        var e = new Error('Stock movement not available on the server yet: ' + Object.keys(bad).join(', '));
        throw e;
      } });
      return jobs;
    }
    order.forEach(function(key){
      var g = groups[key], first = g.moves[0], pier = first.pier, date = first.date, t = first.type;
      jobs.push({ phase: 2, label: 'stock ' + g.kind, run: function(){
        var live = g.moves.filter(function(m){ return moves().indexOf(m) >= 0; });
        if(!live.length) return null;
        var lines = {}, body, url;
        function sum(m, v){ lines[m.itemId] = (lines[m.itemId] || 0) + v; }
        if(g.kind === 'close'){
          var by = {}, bid = first.boatId;
          live.forEach(function(m){
            var o = by[m.itemId] = by[m.itemId] || { item_id: m.itemId, returned: 0, repair: 0, writeoff: 0, lost: 0, onboard: 0 };
            o[CLOSE_T[m.type]] += +m.qty || 0;
            if(m.type === 'lost' && m.fine > 0) o.fine_baht = (o.fine_baht || 0) + (+m.fine || 0);
          });
          url = '/v1/pier-office/' + enc(pier) + '/days/' + enc(date) + '/boats/' + enc(bid) + '/close';
          body = Object.assign({ lines: Object.keys(by).map(function(k){ return by[k]; }) }, who(pier));
        } else {
          var cmd = g.kind === 'wo' ? 'write-off' : g.kind === 'boat' ? BOATCMD[t] : CMD[t];
          live.forEach(function(m){
            if(t === 'count'){
              var books = stock[pier] && stock[pier][m.itemId] ? stock[pier][m.itemId].ready : null;
              if(books === null) throw new Error('Stock is not loaded for ' + pier + ': reload the page');
              sum(m, books + (+m.qty || 0));
            } else sum(m, +m.qty || 0);
          });
          body = Object.assign({ date: date, lines: Object.keys(lines).map(function(id){ return { item_id: id, qty: lines[id] }; }) }, who(pier));
          var note = t === 'count' ? noteOf(first) : text(first.note);
          if(note) body.note = note;
          if(t === 'receive') body.source = first.from || 'buy';
          if(t === 'ship_lost' && first.fine > 0) body.fine_baht = +first.fine;
          url = g.kind === 'boat' ? '/v1/pier-office/' + enc(pier) + '/boats/' + enc(first.boatId) + '/stock/' + cmd
                                  : '/v1/pier-office/' + enc(pier) + '/stock/' + cmd;
        }
        return O.call('POST', url, body).then(function(out){
          swapMoves(live, out.moves);
          renameFinePay(live, out.moves);
          putBalances(pier, out.balances);
        });
      } });
    });
    // a note corrected on a move the server knows
    moves().forEach(function(m){
      if(!m || !m.srv || m.srvNote === undefined || String(m.note || '') === m.srvNote) return;
      jobs.push({ phase: 2, label: 'move note', run: function(){
        return O.call('PATCH', '/v1/pier-office/moves/' + enc(m.id), { note: nul(m.note) }).then(function(){ m.srvNote = String(m.note || ''); });
      } });
    });
    return jobs;
  }
  // a fine paid against a move before the server gave it an id follows the move
  function renameFinePay(sent, serverMoves){
    var F = cfg().finePay; if(!F || typeof F !== 'object') return;
    sent.forEach(function(m, i){
      var s = (serverMoves || []).filter(function(x){ return x.item_id === m.itemId && x.type === m.type; })[0];
      if(s && F[m.id] && s.id !== m.id){ F[s.id] = F[m.id]; delete F[m.id]; }
    });
  }
  P.register({
    name: 'moves', order: 100,
    plan: function(){ return movesPlan(); },
    restore: function(){
      var list = moves();
      for(var i = list.length - 1; i >= 0; i--){ if(list[i] && !list[i].srv) list.splice(i, 1); }
      list.forEach(function(m){ if(m && m.srv && m.srvNote !== undefined) m.note = m.srvNote; });
    },
    commit: function(){}
  });

  /* ledger · the pier's moves from the server replace PIER_MOVES (what is not sent yet stays) */
  var LEDGER_FROM = '2000-01-01', LEDGER_LIMIT = 5000;
  function loadMoves(pier){
    return O.get('/v1/pier-office/' + enc(pier) + '/moves', { from: LEDGER_FROM, limit: LEDGER_LIMIT }).then(function(j){
      var list = moves(), keep = list.filter(function(m){ return m && (m.pier !== pier || !m.srv); });
      var F = cfg().finePay; if(!F || typeof F !== 'object') F = cfg().finePay = {};
      if(fineBase === null) fineBase = {};
      // the server answers newest first; legacy lists oldest first
      (j.moves || []).slice().reverse().forEach(function(sm){
        keep.push(fromServerMove(sm));
        var f = sm.fine;
        if(f && (f.status === 'paid' || f.status === 'waived')){
          var e = { st: f.status, at: f.paid_at || '', by: f.paid_by || '', how: f.how || '', note: f.note || '' };
          F[sm.id] = e; fineBase[sm.id] = clone(e);
        }
      });
      list.length = 0; keep.forEach(function(m){ list.push(m); });
      if(j.total > (j.moves || []).length) O.fail('Stock ledger is long', new Error('Showing the newest ' + j.moves.length + ' of ' + j.total + ' moves'));
    });
  }
  /* outstanding · a boat's day per item, from the server (the close dialog's figures) */
  var outst = {};
  O.onWrite(function(kind){ if(kind === 'pier') outst = {}; });
  function outKey(pier, date, boat){ return pier + '|' + date + '|' + boat; }
  function hasUnsent(boat){ return moves().some(function(m){ return m && !m.srv && m.boatId === boat; }); }
  function outOf(date, boat){
    var e = outst[outKey(window._poPier, date, boat)];
    return ready() && e && !hasUnsent(boat) ? e : null;
  }
  window.poBoatSum = function(date, boatId, pier){
    var r = L.poBoatSum.apply(this, arguments), e = outst[outKey(pier, date, boatId)];
    if(!ready() || !e || hasUnsent(boatId)) return r;
    e.forEach(function(x){
      if(r && r[x.item_id]) r[x.item_id] = { iss: x.issued, ret: x.returned, rep: x.repair, wo: x.writeoff, lost: x.lost, ob: x.onboard };
    });
    return r;
  };
  window.poBoatCarry = function(date, boatId){
    var e = outOf(date, boatId);
    if(!e) return L.poBoatCarry.apply(this, arguments);
    var out = {}; e.forEach(function(x){ if(x.carry > 0) out[x.item_id] = x.carry; });
    return out;
  };
  window.poCloseOpen = function(bid){
    var self = this, args = arguments, pier = window._poPier, date = window._poDate;
    if(!ready()) return L.poCloseOpen.apply(self, args);
    return O.get('/v1/pier-office/' + enc(pier) + '/days/' + enc(date) + '/boats/' + enc(bid) + '/outstanding').then(function(j){
      outst[outKey(pier, date, bid)] = j.items || [];
    }, function(e){ O.fail('Boat outstanding not read', e); }).then(function(){ return L.poCloseOpen.apply(self, args); });
  };

  /* boat close "ปิดยอด" · server first (2026-10-14). The dialog's numbers go to the close command before
     anything changes: no local moves, no early redraw. The server's moves, balances and stage come back and
     are put in, then the dialog closes. A refusal (409 day_closed / nothing_outstanding, 400 returned_too_many /
     shortfall_unaccounted) is the red toast plus the reason in the dialog, which stays open with what was
     typed. The command has no "anyway" flag. An item goes in only while the boat still has some of it out,
     worked out with the same getters the dialog drew from (the server's outstanding, once read). */
  var closing = {};
  function intOf(v){ var n = parseInt(v, 10); return isFinite(n) ? n : 0; }
  function field(id){ var el = document.getElementById(id); return el ? el.value : null; }
  function pierItems(pier){
    if(typeof window.poItemsAll === 'function') return window.poItemsAll(pier) || [];
    return arr('PIER_ITEMS').filter(function(i){ return i && i.pier === pier; });
  }
  function closeLines(pier, date, bid){
    var S = window.poBoatSum(date, bid, pier) || {}, C = window.poBoatCarry(date, bid) || {}, lines = [];
    pierItems(pier).forEach(function(it){
      var ret = field('poret_' + it.id), o = S[it.id];
      if(ret === null || !o) return;   // not on the dialog
      var out = (C[it.id] || 0) + o.iss - (o.ret + o.rep + o.wo + o.lost + o.ob);
      if(!(out > 0)) return;
      var line = { item_id: it.id, returned: intOf(ret), repair: 0, writeoff: 0, lost: 0, onboard: 0 };
      (window.PO_MISS || []).forEach(function(m){ var k = CLOSE_T[m.k]; if(k && k !== 'returned') line[k] = intOf(field('pom_' + m.k + '_' + it.id)); });
      var fine = intOf(field('pofine_' + it.id));
      if(line.lost > 0 && fine > 0) line.fine_baht = fine;
      lines.push(line);
    });
    return lines;
  }
  function closeMsg(t){ var el = document.getElementById('pocwmsg'); if(el) el.textContent = t; }
  window.poCloseSave = function(bid){
    if(!ready()) return L.poCloseSave.apply(this, arguments);
    if(typeof window.poDayGuard === 'function' && !window.poDayGuard()) return undefined;
    if(closing[bid]) return undefined;
    var pier = window._poPier, date = window._poDate, lines = closeLines(pier, date, bid);
    if(!lines.length){ closeMsg('Nothing outstanding on this boat'); return undefined; }
    closing[bid] = 1; closeMsg('');
    var url = '/v1/pier-office/' + enc(pier) + '/days/' + enc(date) + '/boats/' + enc(bid) + '/close';
    return O.queue(function(){ return O.call('POST', url, Object.assign({ lines: lines }, who(pier))); }).then(function(out){
      delete closing[bid];
      (out.moves || []).forEach(function(m){ moves().push(fromServerMove(m)); });
      putBalances(pier, out.balances);
      var st = out.stage, k = pier + '|' + date + '|' + bid;
      if(st) stages[k] = { k: st.k, left: st.left, issued: st.issued, carry: st.carry, onboard: st.onboard, sheet_status: (stages[k] || {}).sheet_status };
      O.wrote('pier');
      window.poModalClose(); window.renderPierOffice();
      return true;
    }, function(e){
      delete closing[bid];
      closeMsg((e && e.message) || 'Not closed');
      O.fail('Boat not closed', e);
      return false;
    });
  };

  /* fines · PIER_CFG.finePay[moveId] = { st: 'paid'|'waived', how, note } */
  var fineBase = null;
  P.afterLoad(function(){ if(fineBase === null) fineBase = clone(cfg().finePay) || {}; return Promise.resolve(); });
  P.register({
    name: 'fines', order: 110,
    plan: function(){
      if(!fineBase) return [];
      var F = cfg().finePay || {}, jobs = [];
      Object.keys(F).forEach(function(id){
        if(fineBase[id]) return;
        jobs.push({ phase: 3, label: 'fine payment', run: function(){
          var e = (cfg().finePay || {})[id], m = moves().filter(function(x){ return x && x.id === id; })[0];
          if(!e) return null;
          if(!m || !m.srv) throw new Error('The fine can be settled once its movement is saved on the server');
          return O.call('POST', '/v1/pier-office/moves/' + enc(id) + '/fine-payment', Object.assign({ status: e.st === 'waived' ? 'waived' : 'paid', how: nul(e.how), note: nul(e.note) }, who(m.pier))).then(function(){
            fineBase[id] = clone(e);
          });
        } });
      });
      return jobs;
    },
    restore: function(){
      if(!fineBase) return;
      var F = cfg().finePay || {};
      Object.keys(F).forEach(function(id){
        if(fineBase[id]) return;
        delete F[id];
        moves().forEach(function(m){ if(m && m.id === id) m.finePaid = false; });
      });
    },
    commit: function(){}
  });

  /* ════ sign-out sheets ═══════════════════════════════════════════════ */
  function sheetPath(pier, date, bid){ return '/v1/pier-office/' + enc(pier) + '/days/' + enc(date) + '/sheets/' + enc(bid); }
  function bookings(){ return Array.isArray(window.SB_BOOKINGS) ? window.SB_BOOKINGS : []; }
  function bkSrv(id){ var b = bookings().filter(function(x){ return x && x.id === id; })[0]; return b && b.opsId ? b.opsId : id; }
  function bkLocal(id){ var b = bookings().filter(function(x){ return x && x.opsId === id; })[0]; return b ? b.id : id; }
  function kindOfItem(id){ var it = itemOf(id); return it ? it.kind : ''; }
  function byKind(flat){
    var o = {}; Object.keys(flat || {}).forEach(function(item){ var k = kindOfItem(item); if(!k) return; (o[k] = o[k] || {})[item] = flat[item]; });
    return o;
  }
  function kindTotals(flat){
    var o = {}; Object.keys(flat || {}).forEach(function(item){ var k = kindOfItem(item); if(k) o[k] = (o[k] || 0) + (+flat[item] || 0); });
    return o;
  }
  function applySheet(pier, date, bid, v){
    var S = window.PIER_SHEET; if(!S || typeof S !== 'object') S = window.PIER_SHEET = {};
    var key = date + '::' + bid;
    if(!v || !v.status){ delete S[key]; return; }
    var split = v.split || {}, base = v.baseline || {};
    S[key] = {
      pier: pier, boatId: bid, date: date, at: v.saved_at, by: v.saved_by || '', size: byKind(split.issued), rsz: byKind(split.returned),
      wrote: v.status === 'committed' ? { ret: kindTotals(base.returned), rsz: clone(base.returned) || {} } : null,
      rows: (v.lines || []).map(function(l){
        return { id: l.id, bkId: l.booking_id ? bkLocal(l.booking_id) : '', extra: !l.booking_id, agN: l.agent_code || '', label: l.label || '', ad: l.adults,
                 iss: clone((l.qty || {}).issued) || {}, ret: clone((l.qty || {}).returned) || {}, dep: l.deposit_baht, back: l.deposit_returned_baht,
                 cut: l.deduction_a, cutB: l.deduction_b, note: l.note || '' };
      })
    };
  }
  function sheetBody(IS){
    var KS = IS.KS || [];
    function kmap(m){ var o = {}; KS.forEach(function(k){ o[k] = Math.max(0, parseInt((m || {})[k], 10) || 0); }); return o; }
    function flat(m){
      var o = {}; KS.forEach(function(k){ Object.keys((m || {})[k] || {}).forEach(function(id){ o[id] = Math.max(0, parseInt(m[k][id], 10) || 0); }); });
      return o;
    }
    return {
      lines: (IS.rows || []).map(function(r){
        var line = {
          agent_code: nul(String(r.agN || '').slice(0, 20)),
          adults: r.extra ? (parseInt(r.ad, 10) || 0) : (typeof window.poIsPax === 'function' ? window.poIsPax(r) : 0),
          deposit_baht: +r.dep || 0, deposit_returned_baht: +r.back || 0, deduction_a: +r.cut || 0, deduction_b: +r.cutB || 0,
          note: nul(r.note), qty: { issued: kmap(r.iss), returned: kmap(r.ret) }
        };
        if(r.extra) line.label = text((r.names && r.names[0]) || r.label) || '-';
        else line.booking_id = bkSrv(r.bkId);
        return line;
      }),
      split: { issued: flat(IS.size), returned: flat(IS.rsz) }
    };
  }
  function sheetSave(bid, commit){
    var IS = window._poIs;
    if(!IS || IS.bid !== bid) return Promise.resolve(false);
    if(typeof window.poDayGuard === 'function' && !window.poDayGuard()) return Promise.resolve(false);
    if(typeof window.poIsRead === 'function') window.poIsRead();
    var pier = window._poPier, date = window._poDate, body = sheetBody(IS);
    return O.queue(function(){
      return O.call('PUT', sheetPath(pier, date, bid), Object.assign(body, who(pier))).then(function(v){
        applySheet(pier, date, bid, v);
        if(!commit) return true;
        return O.anyway(function(extra){ return O.call('POST', sheetPath(pier, date, bid) + '/commit', Object.assign({}, who(pier), extra)); }, {
          confirm_decrease: { flag: 'confirm_decrease', ask: function(e){ return (e && e.message ? e.message : 'This lowers what was written') + '\n\nSave anyway?'; } }
        }).then(function(out){
          applySheet(pier, date, bid, out.sheet);
          (out.moves || []).forEach(function(m){ moves().push(fromServerMove(m)); });
          putBalances(pier, out.balances);
          return true;
        });
      });
    }).then(function(ok){ O.wrote('pier'); return ok; }, function(e){
      O.fail(commit ? 'Sign-out sheet not confirmed' : 'Sign-out sheet not saved', e);
      return false;
    });
  }
  var opening = {};
  window.poIssueOpen = function(bid){
    if(!ready()) return L.poIssueOpen.apply(this, arguments);
    var pier = window._poPier, date = window._poDate, args = arguments, self = this;
    if(opening[bid]) return undefined;
    opening[bid] = 1;
    return O.get(sheetPath(pier, date, bid)).then(function(v){ applySheet(pier, date, bid, v); }, function(e){ O.fail('Sign-out sheet not read', e); })
      .then(function(){ delete opening[bid]; return L.poIssueOpen.apply(self, args); });
  };
  window.poIssueDraft = function(bid){
    if(!ready()) return L.poIssueDraft.apply(this, arguments);
    return sheetSave(bid, false).then(function(ok){ if(ok){ window.poModalClose(); window.renderPierOffice(); } });
  };
  window.poIssueSave = function(bid){
    if(!ready()) return L.poIssueSave.apply(this, arguments);
    return sheetSave(bid, true).then(function(ok){ if(ok){ window.poModalClose(); window.renderPierOffice(); } });
  };
  window.poIsPrint = function(bid){
    if(!ready()) return L.poIsPrint.apply(this, arguments);
    return sheetSave(bid, false).then(function(ok){ if(ok){ window.renderPierOffice(); window.poSignSheet(bid); } });
  };

  /* ════ render wrappers · fetch once, draw again ═══════════════════════ */
  window.renderPierOffice = function(){
    var r = L.renderPierOffice.apply(this, arguments);
    if(ready()){
      var pier = window._poPier, date = window._poDate;
      ensure('stock|' + pier, function(){ return loadStock(pier); }, 'renderPierOffice');
      ensure('moves|' + pier, function(){ return loadMoves(pier); }, 'renderPierOffice');
      ensure('day|' + pier + '|' + date, function(){ return loadDay(pier, date); }, 'renderPierOffice');
    }
    return r;
  };
  window.renderPierAtt = function(){
    var r = L.renderPierAtt.apply(this, arguments);
    if(ready() && typeof window.paCycle === 'function'){
      var pier = window._poPier, cy = window.paCycle(window._paDate);
      ensure('roster|' + pier + '|' + cy.from + '|' + cy.to, function(){ return loadRoster(pier, cy.from, cy.to); }, 'renderPierAtt');
      var canPay = guarded(function(){ return !!window._paPay && typeof window.paPayCan === 'function' && window.paPayCan(); });
      if(canPay){
        var cyc = cycleKey(cy.from), key = 'pay|' + pier + '|' + cyc;
        ensure(key, function(){
          return O.get('/v1/pier-office/' + enc(pier) + '/pay', { cycle: cyc }).then(function(j){
            var by = {}; (j.people || []).forEach(function(p){ by[p.staff_id] = p; });
            lastPay = { key: key, pier: pier, cycle: cyc, by: by };
            applyPay(j);
          });
        }, 'renderPierAtt');
      }
    }
    return r;
  };

  // test hooks
  P._office = { loadMoves: loadMoves, cycleKey: cycleKey, sheetBody: sheetBody, setView: setView, state: function(){ return { stock: stock, stages: stages, cells: cells, pay: pay, dayBase: dayBase }; } };
})();
