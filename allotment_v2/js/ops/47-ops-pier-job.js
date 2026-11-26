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
             slot_labels: labels(J.lb), maintenance_job_id: nul(J.mj),
             itinerary_text: nul(J.itin), itinerary_colour: nul(J.itinc) };   // w5-f: the day's own itinerary (pjItinSet / pjItinColor); the server normalises the arrows
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
              lock: v.completed_at ? 1 : 0, mv: mvOf(v), wc: v.work_code || '', lb: labels(v.slot_labels), dep: v.departure_time || '',
              itin: v.itinerary_text || '', itinc: v.itinerary_colour || '' };
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
    st.base.job[key] = { rec: !!v.recorded, J: v.recorded ? clone(JOB[key]) : null, proj: proj(v.recorded ? JOB[key] : { cap: v.captain_id || v.captain_name, asst: v.assistant_id || v.assistant_name, crew: pick(v.crew, v.crew_names), island: pick(v.island, v.island_names), note: v.note, wb: v.wristband_text, wbc: v.wristband_colour, wc: v.work_code, lb: v.slot_labels, mj: v.maintenance_job_id, dep: v.departure_time, itin: v.itinerary_text, itinc: v.itinerary_colour }),
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
  /* §jobsOne (2026-11-26, UI parity: pier check-in 19 s, poj 35 reads) · the day's jobs of many boats in ONE read:
     GET …/days/{date}/jobs?boat_ids=a,b → { jobs: { bid: <what …/boats/{bid}/job answers, byte for byte> } }. A refused or
     failed batch (an older server, a boat it does not know) falls back to the one-boat reads, as before. */
  function readJobs(pier, date, ids){
    if(!ids.length) return Promise.resolve({});
    return O.get('/v1/pier-office/' + enc(pier) + '/days/' + enc(date) + '/jobs', { boat_ids: ids.join(',') }).then(function(j){
      if(!j || !j.jobs || typeof j.jobs !== 'object') throw new Error('no jobs in the answer');
      return j.jobs;
    }).catch(function(){
      var out = {};
      return pool(ids, function(bid){ return O.get(jobPath(pier, date, bid)).then(function(v){ out[bid] = v; }); }).then(function(){ return out; });
    });
  }
  function loadDay(pier, date){
    var ids = boatIds(pier, date), key = pier + '|' + date, my = ++st.seq;
    st.loading = key;
    return readJobs(pier, date, ids).then(function(jobs){
      if(my === st.seq) ids.forEach(function(bid){ if(jobs[bid]) apply(date, bid, jobs[bid]); });
    }).then(function(){
      if(my !== st.seq) return null;
      st.loaded = key; st.loading = '';
      return true;
    }, function(e){
      if(my === st.seq){ st.loading = ''; failedKey = key; }
      O.fail('Job sheets did not load', e);
      return null;
    });
  }
  function ensure(){
    var pier = window._poPier, date = window._poDate;
    if(!pier || !date) return;
    var key = pier + '|' + date;
    if(st.loaded === key || st.loading === key) return;
    /* §busyVisible · the load starts even while someone types; the redraw waits for them (it used to be skipped,
       and with §pjLockWait the fields would then stay held) */
    loadDay(pier, date).then(function(ok){
      if(!ok) return;
      var paint = function(){ if(window._poPier === pier && window._poDate === date) window.renderPierJob(); };
      if(O.whenFree) O.whenFree(paint); else if(!P.busy()) paint();
    });
  }
  /* §pjLockWait (2026-11-25, UI parity N14) · until the day's job cards have landed, nobody knows which sheets are done
     (completed_at → lock): the sheet drew every field enabled, and a change on a completed sheet came back
     409 job_complete. Legacy knew its lock at once and disabled them (lro). So the sheet's own fields (the handlers
     named pj…) stay disabled until the cards are in; the redraw that follows applies each card's real lock. A failed
     load leaves them as legacy would draw them. */
  var failedKey = '';
  function holdFields(pier){
    var host = document.getElementById('pj-host-' + pier); if(!host || !host.querySelectorAll) return;
    [].slice.call(host.querySelectorAll('select, input, textarea')).forEach(function(el){
      var h = el.getAttribute('onchange') || el.getAttribute('oninput') || el.getAttribute('onblur') || el.getAttribute('onclick') || '';
      if(/^\s*pj[A-Z]/.test(h) && !el.disabled && el !== document.activeElement){ el.disabled = true; el.setAttribute('data-pj-wait', '1'); el.title = 'Loading the job sheet…'; }
    });
  }
  window.renderPierJob = function(){
    var r = L.renderPierJob.apply(this, arguments);
    if(enabled()){
      ensure();
      var pier = window._poPier, key = pier + '|' + window._poDate;
      if(pier && st.loaded !== key && failedKey !== key) holdFields(pier);
    }
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
    var c = v ? v.wristband_carried : carryOf(date, bid);
    return c ? { c: c.colour || '', t: c.text || '', from: c.from_date || '' } : { c: '', t: '', from: '' };
  };
  /* §wbCarryRead (2026-11-24) · screens other than the job sheet (Pier check-in's boat band, pckWb) ask pjWbOf for a
     boat whose job this page never opened (answered with the day's own colour, else the carried one). Legacy walks the previous 14 days of PIER_JOB; here the job read answers
     `wristband_carried`, so the first ask reads that boat's job once (kept apart from the job sheet's state: nothing is
     put into PIER_JOB and nothing can be sent back) and redraws Pier check-in when it lands. The pier in the path is
     the boat's that day (its route's pier), else the pier office's; the carry itself does not depend on it. */
  var carry = {};      // date::bid -> { v: wristband_carried|null } (v undefined while the read is out)
  function pierOfBoat(date, bid){
    var list = Array.isArray(window.SB_BOOKINGS) ? window.SB_BOOKINGS : [];
    for(var i = 0; i < list.length; i++){
      var b = list[i]; if(!b || !Array.isArray(b.trips)) continue;
      for(var k = 0; k < b.trips.length; k++){
        var t = b.trips[k]; if(!t || t.date !== date) continue;
        var o = typeof window.bkOpsRead === 'function' ? (window.bkOpsRead(b, date) || {}) : (b.ops || {});
        var on = o.boatId === bid || (Array.isArray(o.boatSplits) && o.boatSplits.some(function(s){ return s && s.boatId === bid; }));
        if(on){ var p = typeof window.pckPierOf === 'function' ? window.pckPierOf(t.routeId) : ''; if(p) return p; }
      }
    }
    return window._poPier || '';
  }
  function carryOf(date, bid){
    if(!date || !bid) return null;
    var key = jkey(date, bid), c = carry[key];
    if(c) return c.v || null;
    if(st.loading && st.loading.slice(-date.length - 1) === '|' + date) return null;   // the job sheet is reading this day: its views answer
    var pier = pierOfBoat(date, bid);
    if(!pier) return null;
    carry[key] = {};
    /* §jobsOne (2026-11-26) · the asks of one draw are gathered and sent as ONE read per pier and day (…/jobs?boat_ids=), and
       Pier check-in is drawn again ONCE when they land. It was one read per boat, each landing redrawing the whole sheet
       (12 boats = 12 full redraws of ~0.5–1.6 s: the 19 s the parity harness waited on the page open). */
    var qk = pier + '|' + date, q = carryQ[qk] || (carryQ[qk] = { pier: pier, date: date, ids: [] });
    q.ids.push(bid);
    if(!carryTimer) carryTimer = setTimeout(flushCarry, 0);
    return null;
  }
  var carryQ = {}, carryTimer = null;
  function carryFrom(v){
    // the day's own colour first (the server carries one only when the day has none)
    var own = v && (String(v.wristband_colour || '').trim() || String(v.wristband_text || '').trim()) ? { colour: v.wristband_colour || '', text: v.wristband_text || '', from_date: '' } : null;
    return { v: own || (v && v.wristband_carried) || null };
  }
  function flushCarry(){
    carryTimer = null;
    var groups = Object.keys(carryQ).map(function(k){ return carryQ[k]; }); carryQ = {};
    Promise.all(groups.map(function(g){
      return readJobs(g.pier, g.date, g.ids).then(function(jobs){
        var any = false;
        g.ids.forEach(function(bid){ var c = carry[jkey(g.date, bid)] = carryFrom(jobs[bid]); if(c.v) any = true; });
        return any;
      }, function(){ g.ids.forEach(function(bid){ carry[jkey(g.date, bid)] = { v: null }; }); return false; });
    })).then(function(r){
      if(!r.some(Boolean) || typeof window.renderPierCheckin !== 'function') return;
      var h = typeof window.pckHostEl === 'function' ? window.pckHostEl() : null;
      if(h && h.offsetParent) O.redrawLater('renderPierCheckin', 'piercheckin');   // §redrawLater
    });
  }
  O.onWrite(function(kind){ if(String(kind || '').indexOf('pier') >= 0) carry = {}; });
  O.pierJobCarry = { of: carryOf, reset: function(){ carry = {}; } };   // for tests
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
  // pjCopyYday is the server's command now (POST …/jobs/copy-yesterday): 85-ops-pier-w5.js

  /* §pjLockGuard (2026-11-26, UI parity N14) · on a completed sheet (lock, the server's completed_at) legacy draws every field of the
     card disabled (lro = ro || lk, 08-app.js renderPierJob: pjWcSet, pjMjPick, pjMvSet …), so nothing on it changes until it is
     reopened. A change that still reached pjSet (a disabled select fired by script, the parity harness's 6 × 409 job_complete on
     poj-panwa b4) went to the server as PATCH …/job and came back refused. Here such a change is dropped before it is written,
     as the disabled field would have it, and the sheet redraws with the saved value. Reopen / complete (patch.lock) pass. */
  if(typeof window.pjSet === 'function'){
    L.pjSet = window.pjSet;
    window.pjSet = function(d, b, patch){
      if(enabled() && patch && typeof patch === 'object' && !Object.prototype.hasOwnProperty.call(patch, 'lock')){
        var J = obj('PIER_JOB')[String(d || '') + '::' + String(b || '')];
        if(J && J.lock){
          try{ console.warn('[ops] job sheet ' + b + ' ' + d + ' is complete: change dropped (reopen it first)'); }catch(_){}
          return undefined;
        }
      }
      return L.pjSet.apply(this, arguments);
    };
  }

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
          // §pjLockGuard · a sheet complete before and after has nothing to send (legacy's fields are disabled; the server would answer 409 job_complete)
          if(lockWas && lockNow){ if(any || mvChanged){ JOB[key] = clone(b.J); } any = false; mvChanged = false; }
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

  /* What kind of work a boat's day is (dd | mt | boat | none) is the server's: GET …/job `kind` (jobKindOf). Until the day's
     job has been read, legacy's own decision (pjBoatSt and TRIPS) answers. */
  var paJobKind0 = window.paJobKind;
  window.paJobKind = function(date, bid){
    var v = enabled() && st.views[jkey(date, bid)];
    if(v && /^(dd|mt|boat|none)$/.test(v.kind)) return v.kind;
    return paJobKind0.apply(this, arguments);
  };

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
  /* ── the pier's boats of a day, as the server works them out ─────────────────────────────────────────
     GET /v1/pier-office/{pier}/days/{date}/boats → boats[].booked.prep (legacy pjPax, pjPrep) and fleet[] (legacy PJ_ST /
     pjBoatSt / pjAllBoats: state, stale, no_charter). Read once per pier and day, kept while it is current: a write marks it
     old, the old answer stays on screen until the new one arrives, then the screen is drawn again. Until the first answer, and
     for a boat the server does not list, the legacy functions answer from the browser as before.
     w5-f: the long-tail head count of pjPrep (lt) is booked.join_heads. Not the server's yet: the guide languages of
     pjPax are the server's spelling (EN, RU, CN, the typed one) without pckLangNorm's tidying. */
  var day = { by: {}, cbs: {} };
  function dkey(pier, date){ return pier + '|' + date; }
  O.onWrite(function(){ Object.keys(day.by).forEach(function(k){ day.by[k].old = true; }); });
  function wantBoats(pier, date, redraw){
    if(!enabled() || !P.loaded || !pier || !date) return;
    var k = dkey(pier, date), e = day.by[k];
    if(e && !e.loading && !e.old) return;             // current: nothing to ask, nothing to draw again
    // who draws again when the answer comes (once): the caller's screen, else the job page
    var cb = redraw || function(){ if(typeof window.renderPierJob === 'function') window.renderPierJob(); };
    var q = day.cbs[k] || (day.cbs[k] = []); if(q.indexOf(cb) < 0 && (redraw || !q.length)) q.push(cb);
    if(e && e.loading) return;
    if(!e) e = day.by[k] = { boats: {}, fleet: {}, old: true };
    e.loading = true;
    O.get('/v1/pier-office/' + enc(pier) + '/days/' + enc(date) + '/boats').then(function(j){ landDay(k, e, j); }, function(err){ dayFailed(k, e, err); });
  }
  function landDay(k, e, j){
    e.boats = {}; e.fleet = {}; e.order = [];
    ((j && j.boats) || []).forEach(function(b){ if(b && b.boat_id) e.boats[b.boat_id] = b; });
    ((j && j.fleet) || []).forEach(function(f){ if(f && f.boat_id){ e.fleet[f.boat_id] = f; e.order.push(f.boat_id); } });   // e.order: the server's order of the pier's boats (pjAllBoats)
    e.old = false; e.loading = false; e.loaded = true;
    var q2 = day.cbs[k] || []; day.cbs[k] = [];
    if(!P.busy()) q2.forEach(function(fn){ try{ fn(); }catch(_){} });
  }
  function dayFailed(k, e, err){
    e.loading = false;                 // keep what we had; the next render asks again only after another write
    e.old = false; day.cbs[k] = [];
    try{ console.warn('[ops] boats of the day ' + k + ' · ' + (err && err.message)); }catch(_){}
  }
  /* §daysOne (2026-11-26, UI parity: Ranong 13 per-day reads) · a month screen (petty cash long-tail, pc2LT) asks for the boats of
     every day of the month at once: ONE read GET /v1/pier-office/{pier}/days?from=&to= → { days: { date: <…/days/{date}/boats,
     byte for byte> } }. The days it covers are marked as loading first, so the per-day asks of the same draw wait for it; the
     redraws they ask for run once each day lands, as before. A failed month read asks day by day, as before. */
  function wantRange(pier, from, to){
    if(!enabled() || !P.loaded || !pier || !from || !to || to < from) return;
    var dates = [], d = new Date(from + 'T00:00:00Z');
    for(; d.toISOString().slice(0, 10) <= to && dates.length < 62; d.setUTCDate(d.getUTCDate() + 1)) dates.push(d.toISOString().slice(0, 10));
    var need = dates.filter(function(ds){ var e = day.by[dkey(pier, ds)]; return !e || (!e.loading && e.old); });
    if(need.length < 2) return;
    need.forEach(function(ds){ var k = dkey(pier, ds), e = day.by[k] || (day.by[k] = { boats: {}, fleet: {}, old: true }); e.loading = true; });
    O.get('/v1/pier-office/' + enc(pier) + '/days', { from: need[0], to: need[need.length - 1] }).then(function(j){
      if(!j || !j.days || typeof j.days !== 'object') throw new Error('no days in the answer');
      need.forEach(function(ds){ var k = dkey(pier, ds); landDay(k, day.by[k], j.days[ds]); });
    }).catch(function(){
      need.forEach(function(ds){
        var k = dkey(pier, ds), e = day.by[k], cbs = day.cbs[k] || []; day.cbs[k] = [];
        e.loading = false; e.old = true;
        if(cbs.length) cbs.forEach(function(cb){ wantBoats(pier, ds, cb); }); else wantBoats(pier, ds);
      });
    });
  }
  function boatOf(pier, date, bid){ var e = day.by[dkey(pier, date)]; return e && e.loaded ? e.boats[bid] : null; }
  // the fleet entry of a boat on a date, from whichever pier lists it
  function fleetOf(date, bid){
    var ks = Object.keys(day.by);
    for(var i = 0; i < ks.length; i++){
      if(ks[i].split('|')[1] !== date || !day.by[ks[i]].loaded) continue;
      var f = day.by[ks[i]].fleet[bid]; if(f) return { pier: ks[i].split('|')[0], f: f };
    }
    return null;
  }
  var wrapRender = window.renderPierJob;
  window.renderPierJob = function(){
    var r = wrapRender.apply(this, arguments);
    if(enabled()) wantBoats(window._poPier, window._poDate);
    return r;
  };
  if(typeof window.pjPax === 'function'){
    L.pjPax = window.pjPax;
    window.pjPax = function(date, boatId, pier){
      var b = enabled() ? boatOf(pier, date, boatId) : null, p = b && b.booked && b.booked.prep;
      if(!p) return L.pjPax.apply(this, arguments);
      /* parity M5 (2026-11-27) · legacy pjPax reads pckGuideLangs: each language through pckLangNorm, once (case-blind), so a typed
         "Spain" is the chip ES. The server's prep keeps the typed spelling (legacy pjPrep's own count does too). */
      var langs = {}, seenL = {};
      Object.keys(p.languages || {}).forEach(function(c){
        var n = typeof window.pckLangNorm === 'function' ? window.pckLangNorm(c) : c; if(!n || seenL[n.toLowerCase()]) return;
        seenL[n.toLowerCase()] = 1; langs[n] = 1; });
      return { ad: p.pax.ad, chd: p.pax.chd, inf: p.pax.inf, foc: p.pax.foc, n: p.pax.bookings, langs: langs };
    };
  }
  if(typeof window.pjPrep === 'function'){
    L.pjPrep = window.pjPrep;
    window.pjPrep = function(date, boatId, pier){
      var out = L.pjPrep.apply(this, arguments);       // lt (long-tail heads) is the server's booked.join_heads, set below (w5-f)
      var b = enabled() ? boatOf(pier, date, boatId) : null, p = b && b.booked && b.booked.prep;
      if(!p) return out;
      out.lang = {}; Object.keys(p.languages || {}).forEach(function(c){ out.lang[c] = p.languages[c]; });
      out.halal = p.halal; out.veg = p.veg; out.vegan = p.vegan; out.allerg = p.allergy;
      out.booked = p.booked; out.arrived = p.arrived; out.noShow = p.no_show; out.ckAny = !!p.check_in_started;
      out.firstPick = p.first_pickup || ''; out.lastPick = p.last_pickup || '';
      if(b.booked.join_heads != null) out.lt = +b.booked.join_heads || 0;   // w5-f: the join add-on's heads on the boat (legacy pxLongtail), the server's
      return out;
    };
  }
  // the card's state (PJ_ST key), the stale-programme flag and "not hired today" come from the server's fleet; the log, jobs and note stay legacy's
  if(typeof window.pjBoatSt === 'function'){
    L.pjBoatSt = window.pjBoatSt;
    window.pjBoatSt = function(date, boat, op){
      var out = L.pjBoatSt.apply(this, arguments), h = enabled() && boat ? fleetOf(date, boat.id) : null;
      if(!h) return out;                                 // w4-f5: the server's state wins for every state, 'ovn' (charter kept overnight, Q39) included
      out.k = h.f.state; out.stale = !!h.f.stale; out.srvOpenJobs = +h.f.open_jobs || 0;
      if(!!h.f.no_charter !== !!out.noCharter){ out.noCharter = !!h.f.no_charter; out.note = h.f.note || ''; }
      return out;
    };
  }
  // pjWcAuto(ST): the "auto" work code is MT when the boat has an open repair job; the server counted them (fleet[].open_jobs)
  if(typeof window.pjWcAuto === 'function'){
    L.pjWcAuto = window.pjWcAuto;
    window.pjWcAuto = function(ST){
      if(!enabled() || !ST || typeof ST.srvOpenJobs !== 'number') return L.pjWcAuto.apply(this, arguments);
      return ST.srvOpenJobs > 0 && typeof window.paMtCode === 'function' ? window.paMtCode() : '';
    };
  }
  // the pier that has a boat on a date: the pier whose fleet lists it; a pier whose fleet is loaded and does not list it does not have it
  if(typeof window.pjPierOf === 'function'){
    L.pjPierOf = window.pjPierOf;
    window.pjPierOf = function(boat, date){
      var out = L.pjPierOf.apply(this, arguments);
      if(!enabled() || !boat) return out;
      var h = fleetOf(date, boat.id); if(h) return h.pier;
      var e = out && day.by[dkey(out, date)];
      return e && e.loaded ? '' : out;
    };
  }
  O.pier.dayBoats = { want: wantBoats, wantRange: wantRange, boat: boatOf, fleet: fleetOf, entry: function(pier, date){ var e = day.by[dkey(pier, date)]; return e && e.loaded ? e : null; } };   // w4-f2: fleet (permits on the card) is read by 74-ops-permits.js

  O.pierJob = { state: st, loadDay: loadDay };
})();
