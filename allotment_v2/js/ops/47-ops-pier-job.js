/* ════════════════════════════════════════════════════════════════════════
   §opsPierJob (2026-10-13) · pier job sheets, the boat's usual team and duty on operation-backend
   ────────────────────────────────────────────────────────────────────────
   GET   /v1/pier-office/{pier}/days/{date}/boats/{boat}/job          → the job card, with what the server works out
   PATCH /v1/pier-office/{pier}/days/{date}/boats/{boat}/job          → captain, assistant, crew, island, note, wristband, work code
   POST  …/job/complete | /job/reopen                                 → legacy's "จัดเสร็จแล้ว" lock (pjLockSet)
   PUT   /v1/pier-office/{pier}/days/{date}/boats/{boat}/duty         → who was on the boat (poDutySave)
   PUT   /v1/pier-office/boats/{boat}/team                            → the boat's usual team (pjTeamSave)
   PUT   /v1/trip-actuals/{date}/{boat}/venue                         → the day's restaurant (pjMvSet)

     legacy PIER_JOB['date::boat']            server job
       cap / asst / crew[] / island[]         captain_id|captain_name / assistant_id|assistant_name / crew + crew_names / island + island_names
                                              ('' is a blank slot = null). Legacy keeps a slot as the staff id OR the text typed (pjFreePick,
                                              pjStaffName shows the text as it is): an id the staff list knows goes as *_id, any other text as *_name
       note / wb / wbc / wc                   note / wristband_text / wristband_colour / work_code
       lock                                   completed_at (complete / reopen are the server's commands)
       mv ('' route's, '-' no meal, id)       restaurant_id (effective: the day's venue, else the route's)
       lb (own slot names), mj (repair job)   slot_labels / maintenance_job_id (400 if not this boat's open job)
       mv                                     read from meal.mode ('none' -> '-', 'day' -> venue id, else ''); written only by the venue PUT
     legacy PIER_TEAM[boat] {cap, asst, crew} is built from what the jobs show (the server sends no team read:
     a day with no job shows the team, a recorded job lists where it differs); PIER_DUTY from duty_staff_ids

     · the server works out `missing` (pjLockMiss), the carried wristband (pjWbOf), the substitutes (pjSubList),
       sailed and kind; those legacy functions answer from it
     · screens still change PIER_JOB / PIER_TEAM / PIER_DUTY and call poPersist(); 42-ops-pier-core.js
       sends the difference, and a refusal (409 job_complete, job_incomplete with the missing list,
       day_closed, 400) puts the card back and shows the server's message
   Not wired: other screens that read a day's job (check-in crew line) see only the days opened here; the roster
   endpoint (GET /v1/pier-office/{pier}/roster) already counts deployed boats with no saved card.
   Legacy mode: every wrapper delegates to the captured original when !enabled().
   Classic script · loads after 08-app.js and 42-ops-pier-core.js.
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O || !O.pier) return;
  var P = O.pier, clone = P.clone, nul = P.nul;
  var L = { pjLockMiss: window.pjLockMiss, pjWbOf: window.pjWbOf, pjSubList: window.pjSubList, pjCopyYday: window.pjCopyYday, renderPierJob: window.renderPierJob };
  var enc = encodeURIComponent;
  function enabled(){ return P.enabled(); }
  function obj(name){ var o = window[name]; if(!o || typeof o !== 'object'){ o = window[name] = {}; } return o; }

  var st = { views: {}, keys: {}, bids: {}, base: { job: {}, team: {}, duty: {} }, loaded: '', loading: '', seq: 0 };

  /* ── legacy <-> server ──────────────────────────────────────────────── */
  // A slot value is a staff id or typed text (legacy's one string). An id is one the staff list holds or one the server
  // has already sent as an id; anything else is a typed name and goes to *_name (the server refuses an unknown *_id).
  var seenIds = {};
  function staffIdSet(){
    var m = {};
    (Array.isArray(window.PIER_STAFF) ? window.PIER_STAFF : []).forEach(function(x){ if(x && x.id) m[x.id] = 1; });
    return m;
  }
  function sayIds(a){ (a || []).forEach(function(x){ if(x) seenIds[x] = 1; }); }
  function split1(v, ids){
    var t = v == null ? '' : String(v);
    if(!t) return { id: null, name: null };
    if(ids[t] || seenIds[t]) return { id: t, name: null };
    t = t.replace(/\s+/g, ' ').trim();
    return { id: null, name: t || null };
  }
  // two parallel lists (staff ids, typed names), same length, trailing blanks dropped
  function slots(a, ids){
    var ids2 = ids || staffIdSet(), idList = [], nameList = [];
    (Array.isArray(a) ? a : []).forEach(function(x){ var o = split1(x, ids2); idList.push(o.id); nameList.push(o.name); });
    while(idList.length && idList[idList.length - 1] === null && nameList[nameList.length - 1] === null){ idList.pop(); nameList.pop(); }
    return { ids: idList, names: nameList };
  }
  function pick(ids, names){
    var out = [], n = Math.max((ids || []).length, (names || []).length);
    for(var i = 0; i < n; i++) out.push((ids && ids[i]) || (names && names[i]) || '');
    return out;
  }
  function labels(o){
    var out = {};
    if(o && typeof o === 'object') Object.keys(o).forEach(function(k){ var t = String(o[k] == null ? '' : o[k]).trim(); if(k.trim() && t) out[k] = t; });
    return out;
  }
  // server meal.mode -> legacy mv: 'none' = '-' (no meal), 'day' = the venue id, 'route'/'unset' = '' (the route's)
  function mvOf(v){
    var m = v.meal;
    if(!m) return v.restaurant_id || '';
    return m.mode === 'none' ? '-' : (m.mode === 'day' ? (m.venue_id || '') : '');
  }
  function proj(J){
    var ids = staffIdSet(), cap = split1(J.cap, ids), asst = split1(J.asst, ids), crew = slots(J.crew, ids), island = slots(J.island, ids);
    return { captain_id: cap.id, captain_name: cap.name, assistant_id: asst.id, assistant_name: asst.name,
             crew: crew.ids, crew_names: crew.names, island: island.ids, island_names: island.names, note: nul(J.note),
             wristband_text: nul(J.wb), wristband_colour: nul(J.wbc), work_code: nul(J.wc), departure_time: nul(J.dep),
             slot_labels: labels(J.lb), maintenance_job_id: nul(J.mj) };
  }
  // a slot is one setting on the server: naming either half replaces it, so a change to one half sends both
  var PAIRS = [['captain_id', 'captain_name'], ['assistant_id', 'assistant_name'], ['crew', 'crew_names'], ['island', 'island_names']];
  function whole(diff, now){
    PAIRS.forEach(function(p){ if(diff[p[0]] !== undefined || diff[p[1]] !== undefined){ diff[p[0]] = now[p[0]]; diff[p[1]] = now[p[1]]; } });
    return diff;
  }
  function fromView(v, prev){
    sayIds([v.captain_id, v.assistant_id].concat(v.crew || [], v.island || [], v.duty_staff_ids || []));
    var J = { cap: v.captain_id || v.captain_name || '', asst: v.assistant_id || v.assistant_name || '', crew: pick(v.crew, v.crew_names),
              island: pick(v.island, v.island_names), note: v.note || '', wb: v.wristband_text || '', wbc: v.wristband_colour || '',
              lock: v.completed_at ? 1 : 0, mv: mvOf(v), wc: v.work_code || '', lb: labels(v.slot_labels), dep: v.departure_time || '' };
    if(v.maintenance_job_id) J.mj = v.maintenance_job_id;
    return J;
  }
  function teamFromView(v){
    var T = { cap: v.captain_id || v.captain_name || '', asst: v.assistant_id || v.assistant_name || '', crew: pick(v.crew, v.crew_names).filter(Boolean) };
    if(v.recorded){
      var crew = pick(v.crew, v.crew_names);
      (v.substitutes || []).forEach(function(s){
        var who = s.team_id || s.team_name || '';
        if(s.role === 'captain') T.cap = who;
        else if(s.role === 'assistant') T.asst = who;
        else if(s.role === 'crew') crew[s.position] = who;
      });
      T.crew = crew.filter(Boolean);
    }
    return T;
  }
  function projTeam(T){
    T = T || {};
    var ids = staffIdSet(), cap = split1(T.cap, ids), asst = split1(T.asst, ids), crew = slots((T.crew || []).filter(Boolean), ids);
    return { captain_id: cap.id, captain_name: cap.name, assistant_id: asst.id, assistant_name: asst.name, crew_ids: crew.ids, crew_names: crew.names };
  }
  function jkey(date, bid){ return date + '::' + bid; }

  /* ── what the server said, put into the legacy globals ──────────────── */
  function apply(date, bid, v){
    var key = jkey(date, bid), JOB = obj('PIER_JOB'), TEAM = obj('PIER_TEAM'), DUTY = obj('PIER_DUTY');
    st.views[key] = v; st.keys[key] = 1; st.bids[bid] = 1;
    P.dep = P.dep || {}; P.dep[date + '|' + bid] = { departure: v.departure || null, source: v.departure_source || null };   // §pjDep
    if(v.recorded) JOB[key] = fromView(v, JOB[key]); else delete JOB[key];
    TEAM[bid] = teamFromView(v);
    if((v.duty_staff_ids || []).length) DUTY[key] = v.duty_staff_ids.slice(); else delete DUTY[key];
    st.base.job[key] = { rec: !!v.recorded, J: v.recorded ? clone(JOB[key]) : null, proj: proj(v.recorded ? JOB[key] : { cap: v.captain_id || v.captain_name, asst: v.assistant_id || v.assistant_name, crew: pick(v.crew, v.crew_names), island: pick(v.island, v.island_names), note: v.note, wb: v.wristband_text, wbc: v.wristband_colour, wc: v.work_code, lb: v.slot_labels, mj: v.maintenance_job_id, dep: v.departure_time }),
                         lock: v.completed_at ? 1 : 0, mv: mvOf(v) };
    st.base.team[bid] = clone(TEAM[bid]);
    st.base.duty[key] = (v.duty_staff_ids || []).slice();
  }
  function snapshot(){
    var JOB = obj('PIER_JOB'), TEAM = obj('PIER_TEAM'), DUTY = obj('PIER_DUTY');
    Object.keys(st.keys).forEach(function(key){
      var c = JOB[key], bid = key.split('::')[1], was = st.base.job[key];
      st.base.job[key] = c ? { rec: true, J: clone(c), proj: proj(c), lock: c.lock ? 1 : 0, mv: c.mv || '' } : was;
      st.base.duty[key] = (DUTY[key] || []).slice();
      if(TEAM[bid]) st.base.team[bid] = clone(TEAM[bid]);
    });
  }
  function restoreAll(){
    var JOB = obj('PIER_JOB'), TEAM = obj('PIER_TEAM'), DUTY = obj('PIER_DUTY');
    Object.keys(st.keys).forEach(function(key){
      var b = st.base.job[key], bid = key.split('::')[1];
      if(b && b.rec) JOB[key] = clone(b.J); else delete JOB[key];
      if(st.base.duty[key] && st.base.duty[key].length) DUTY[key] = st.base.duty[key].slice(); else delete DUTY[key];
      if(st.base.team[bid]) TEAM[bid] = clone(st.base.team[bid]);
    });
  }

  /* ── reads ───────────────────────────────────────────────────────────── */
  function jobPath(pier, date, bid){ return '/v1/pier-office/' + enc(pier) + '/days/' + enc(date) + '/boats/' + enc(bid) + '/job'; }
  function boatIds(pier, date){
    var list = [];
    try{ list = typeof window.pjAllBoats === 'function' ? window.pjAllBoats(date, pier) : (typeof window.poBoats === 'function' ? window.poBoats(date, pier) : []); }catch(_){ list = []; }
    var seen = {}, out = [];
    list.forEach(function(b){ if(b && b.bid && !seen[b.bid]){ seen[b.bid] = 1; out.push(b.bid); } });
    return out;
  }
  function pool(items, worker, size){
    var i = 0, errors = [];
    function next(){
      if(i >= items.length) return Promise.resolve();
      var it = items[i++];
      return worker(it).catch(function(e){ errors.push(e); }).then(next);
    }
    var ps = []; for(var k = 0; k < (size || 6); k++) ps.push(next());
    return Promise.all(ps).then(function(){ if(errors.length) throw errors[0]; });
  }
  function loadDay(pier, date){
    var ids = boatIds(pier, date), key = pier + '|' + date, my = ++st.seq;
    st.loading = key;
    return pool(ids, function(bid){
      return O.get(jobPath(pier, date, bid)).then(function(v){ if(my === st.seq) apply(date, bid, v); });
    }).then(function(){
      if(my !== st.seq) return null;
      st.loaded = key; st.loading = '';
      return true;
    }, function(e){
      if(my === st.seq) st.loading = '';
      O.fail('Job sheets did not load', e);
      return null;
    });
  }
  function ensure(){
    var pier = window._poPier, date = window._poDate;
    if(!pier || !date || P.busy()) return;
    var key = pier + '|' + date;
    if(st.loaded === key || st.loading === key) return;
    loadDay(pier, date).then(function(ok){ if(ok) window.renderPierJob(); });
  }
  window.renderPierJob = function(){
    var r = L.renderPierJob.apply(this, arguments);
    if(enabled()) ensure();
    return r;
  };
  function reloadKeys(keys){
    return pool(keys, function(key){
      var p = key.split('::'), date = p[0], bid = p[1];
      return O.get(jobPath(window._poPier, date, bid)).then(function(v){ apply(date, bid, v); });
    });
  }

  /* ── the functions that used to compute ─────────────────────────────── */
  window.pjLockMiss = function(date, bid){
    if(!enabled()) return L.pjLockMiss.apply(this, arguments);
    var v = st.views[jkey(date, bid)];
    return v ? (v.missing || []).map(function(m){ return m.label; }) : L.pjLockMiss.apply(this, arguments);
  };
  window.pjWbOf = function(date, bid){
    if(!enabled()) return L.pjWbOf.apply(this, arguments);
    var v = st.views[jkey(date, bid)], raw = typeof window.pjRaw === 'function' ? window.pjRaw(date, bid) : null;
    if(raw && (String(raw.wbc || '').trim() || String(raw.wb || '').trim())) return { c: String(raw.wbc || ''), t: String(raw.wb || ''), from: '' };
    var c = v && v.wristband_carried;
    return c ? { c: c.colour || '', t: c.text || '', from: c.from_date || '' } : { c: '', t: '', from: '' };
  };
  window.pjSubList = function(date, bid){
    if(!enabled()) return L.pjSubList.apply(this, arguments);
    var v = st.views[jkey(date, bid)]; if(!v) return L.pjSubList.apply(this, arguments);
    var out = {};
    (v.substitutes || []).forEach(function(s){
      var who = s.team_id || s.team_name || '';
      if(s.role === 'captain') out.cap = who;
      else if(s.role === 'assistant') out.asst = who;
      else out['crew' + s.position] = who;
    });
    return out;
  };
  /* pjDepOf(date, bid, fallback): the time a boat leaves. A time on the card (J.dep, filled from the server's
     departure_time) wins as in legacy; otherwise the server's `departure` (the job's own, else the route's first time
     on that day's deployment) read with the job; otherwise legacy's fallback. A typed time is sent by the 'jobs' plan
     as PATCH …/job {departure_time} (pjDepSet -> pjSet -> poPersist). */
  if(typeof window.pjDepOf === 'function'){
    L.pjDepOf = window.pjDepOf;
    window.pjDepOf = function(date, bid, fallback){
      if(!enabled()) return L.pjDepOf.apply(this, arguments);
      var own = L.pjDepOf.call(this, date, bid, null);
      if(own) return own;
      var d = P.dep && P.dep[date + '|' + bid];
      return d && d.departure ? d.departure : fallback;
    };
  }
  // yesterday's cards are read first: legacy copies them from the browser's copy
  window.pjCopyYday = function(pier){
    if(!enabled()) return L.pjCopyYday.apply(this, arguments);
    var self = this, args = arguments;
    var d = new Date(window._poDate + 'T12:00:00'); d.setDate(d.getDate() - 1);
    var prev = typeof window.poYMD === 'function' ? window.poYMD(d) : d.toISOString().slice(0, 10);
    var ids = boatIds(pier, window._poDate);
    return pool(ids, function(bid){ return O.get(jobPath(pier, prev, bid)).then(function(v){ apply(prev, bid, v); }); }).then(function(){
      return L.pjCopyYday.apply(self, args);
    }, function(e){ O.fail('Yesterday\'s job sheets did not load', e); });
  };

  /* ── writes ──────────────────────────────────────────────────────────── */
  // 409 guide_double_booked lists who is on another boat (body.busy); OK resends with guide_anyway (legacy's pjGdBusy marker, but asked first).
  // O.anyway fits: the flag goes in the body next to the diff. Cancel = declined, the card is put back, nothing was saved.
  function boatName(id){
    try{ var l = window.boats || window.DEFAULT_BOATS || []; for(var i = 0; i < l.length; i++) if(l[i] && l[i].id === id && l[i].name) return l[i].name; }catch(_){}
    return id;
  }
  function patchJob(base, diff){
    if(typeof O.anyway !== 'function') return O.call('PATCH', base, diff);
    return O.anyway(function(extra){ return O.call('PATCH', base, Object.assign({}, diff, extra)); }, {
      guide_double_booked: { flag: 'guide_anyway', ask: function(e){
        var busy = (e && e.body && e.body.busy) || [];
        if(!busy.length) return '';
        return busy.map(function(b){ return (b.name || b.staff_id) + ' อยู่ ' + boatName(b.boat_id); }).join('\n') + '\n\nAssign anyway?';
      } }
    });
  }
  function same(a, b){ return JSON.stringify(a) === JSON.stringify(b); }
  P.register({
    name: 'jobs', order: 95,
    restore: function(){
      restoreAll();
      var keys = Object.keys(st.keys);
      if(keys.length) reloadKeys(keys).then(function(){ P.redraw(); }, function(){});
    },
    commit: function(){ snapshot(); },
    plan: function(){
      var jobs = [], JOB = obj('PIER_JOB'), TEAM = obj('PIER_TEAM'), DUTY = obj('PIER_DUTY'), touched = [];
      var pier = window._poPier;
      Object.keys(st.keys).forEach(function(key){
        var p = key.split('::'), date = p[0], bid = p[1], cur = JOB[key], b = st.base.job[key];
        if(cur && b){
          var a = proj(cur), diff = {}, any = false;
          Object.keys(a).forEach(function(k){ if(!same(a[k], b.proj[k])){ diff[k] = a[k]; any = true; } });
          if(any) whole(diff, a);
          var lockWas = b.lock, lockNow = cur.lock ? 1 : 0, mvNow = cur.mv || '', mvChanged = mvNow !== b.mv;
          if(any || lockWas !== lockNow || mvChanged){
            touched.push(key);
            jobs.push({ phase: 2, label: 'job ' + key, run: function(){
              var base = jobPath(pier, date, bid), chain = Promise.resolve();
              if(lockWas && !lockNow) chain = chain.then(function(){ return O.call('POST', base + '/reopen', {}); });
              if(mvChanged) chain = chain.then(function(){
                return O.call('PUT', '/v1/trip-actuals/' + enc(date) + '/' + enc(bid) + '/venue', { venue: mvNow === '-' ? 'none' : (mvNow || null) });
              });
              if(any) chain = chain.then(function(){ return patchJob(base, diff); });
              if(!lockWas && lockNow) chain = chain.then(function(){ return O.call('POST', base + '/complete', {}); });
              return chain;
            } });
          }
        }
        var duty = (DUTY[key] || []).slice(), dutyWas = st.base.duty[key] || [];
        if(!same(duty.slice().sort(), dutyWas.slice().sort())){
          if(touched.indexOf(key) < 0) touched.push(key);
          jobs.push({ phase: 2, label: 'duty ' + key, run: function(){
            return O.call('PUT', '/v1/pier-office/' + enc(pier) + '/days/' + enc(date) + '/boats/' + enc(bid) + '/duty', { staff_ids: duty });
          } });
        }
      });
      Object.keys(st.bids).forEach(function(bid){
        var cur = TEAM[bid], was = st.base.team[bid];
        if(!cur || !was || same(projTeam(cur), projTeam(was))) return;
        jobs.push({ phase: 2, label: 'team ' + bid, run: function(){
          var t = projTeam(cur);
          return O.call('PUT', '/v1/pier-office/boats/' + enc(bid) + '/team', t);
        } });
      });
      if(jobs.length) jobs.push({ phase: 9, label: 'jobs refresh', run: function(){ return reloadKeys(touched.length ? touched : Object.keys(st.keys)); } });
      return jobs;
    }
  });

  /* The Office screen's duty dialog (poDutySave) never loads the day's jobs, so the duty spec above would not know the boat
     and the list would stay in the browser. Load the day first (once), then let legacy set PIER_DUTY and poPersist. */
  var poDutySave0 = window.poDutySave;
  window.poDutySave = function(bid){
    var self = this, args = arguments, pier = window._poPier, date = window._poDate;
    if(!enabled() || !pier || !date || st.keys[jkey(date, bid)]) return poDutySave0.apply(self, args);
    return loadDay(pier, date).then(function(ok){
      if(ok) return poDutySave0.apply(self, args);   // on a failed load the toast says so and the dialog stays open
    });
  };

  O.pierJob = { state: st, loadDay: loadDay };
})();
