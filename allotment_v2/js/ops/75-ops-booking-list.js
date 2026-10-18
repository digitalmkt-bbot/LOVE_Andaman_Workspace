/* ══════════════════════════════════════════════════════════════════════════
   §opsBookingList (2026-10-18, w4-f3) · the All-bookings screen, the agent dropdown and the save warnings
   ──────────────────────────────────────────────────────────────────────────
   Backend guide: operation-backend todo/booking-list-model.md, README "All-bookings screen".
   Loads after 40-ops-bookings.js and js/booking/*.js. Classic script. Legacy functions are named bookingV2* here.

   bookingV2RenderTab3   Each row of GET /v1/bookings now carries last_activity, is_new, is_soon, is_today,
                         possible_duplicate and duplicates; 40-ops-bookings.js keeps them on the booking as
                         bk.srvList (read-only, never sent). The screen (bookingV2RenderTab3.js, marked
                         §opsBookingList) reads them through laOpsListFlags(raw). The Pending-FOC pill and the
                         search ask the server (GET /v1/bookings?pending_foc=true, ?q=): laOpsListSet(kind, q)
                         gives the set of booking ids it answered, or null until the answer is in (legacy's own
                         test runs meanwhile). The KPI card reads stats.pending_foc_count.
   bookingV2LastAct      The row's last_activity {at, kind, text, by}.
   bookingV2AgentDDStats GET /v1/agents/ranking -> recent (agents this login confirmed last), top (busiest others).
   duplicates / passenger types on save
                         The save answer's warnings[] (code possible_duplicate, passenger_types) are shown with the
                         server's own message (laOps.saveWarnings, called by 40-ops-bookings.js). The confirm that
                         legacy asks BEFORE saving stays legacy's (see docs/walk/w4-f3.md, MISSING-SERVER-FIELD).
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  function enabled(){ return !!(O.enabled && O.enabled()); }
  function wrap(name, fn){
    var orig = window[name];
    if(typeof orig !== 'function' || orig.__opsList) return;
    var w = function(){
      var args = [].slice.call(arguments);
      if(!enabled()) return orig.apply(this, args);
      return fn.apply(this, [orig].concat(args));
    };
    w.__opsList = true; w.__orig = orig; window[name] = w;
  }
  function tab3Open(){ var st = window._bkV2; return !!(st && st.tab === 'all' && !st.newBooking); }
  function redraw(){
    try{
      if(!tab3Open() || typeof window.bookingV2Render !== 'function') return;
      var a = document.activeElement, search = a && a.id === 'bkv2-search-input';
      var typingElsewhere = a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && !search;
      if(typingElsewhere) return;
      var pos = search ? a.selectionStart : 0;
      window.bookingV2Render();
      if(search){
        var inp = document.getElementById('bkv2-search-input');
        if(inp){ inp.focus(); try{ inp.setSelectionRange(pos, pos); }catch(_){} }
      }
    }catch(e){ console.warn('[ops] list redraw failed', e); }
  }

  /* ── the row's server fields ─────────────────────────────────────────── */
  window.laOpsListFlags = function(raw){ return (enabled() && raw && raw.srvList) ? raw.srvList : null; };

  wrap('bookingV2LastAct', function(orig, raw, b){
    var s = raw && raw.srvList, a = s && s.lastActivity;
    if(!a || !a.at) return orig(raw, b);
    return { at: String(a.at), kind: a.kind || 'create', text: a.text || '', by: a.by || '' };
  });

  /* ── the sets the server answers: Pending-FOC pill and search ────────── */
  var SETS = {};            // key -> { ids:Set|null, at, busy, stale, failedAt }
  var FAIL_MS = 15000, MAX_PAGES = 5, WAIT_MS = 250, timers = {};

  function setKey(kind, q){ return kind === 'q' ? 'q|' + String(q || '').trim().toLowerCase() : kind; }
  function setParams(kind, q){
    var p = { limit: 100 };
    if(kind === 'pending_foc') p.pending_foc = 'true';
    else p.q = String(q || '').trim();
    return p;
  }
  function loadSet(kind, q, key){
    var e = SETS[key] = SETS[key] || {};
    if(e.busy) return;
    e.busy = true;
    var ids = new Set(), pages = 0;
    function page(cursor){
      var p = setParams(kind, q); if(cursor) p.cursor = cursor;
      return O.get('/v1/bookings', p).then(function(j){
        var rows = (j && j.bookings) || [];
        rows.forEach(function(ob){ ids.add(ob.external_id || ob.id); ids.add(ob.id); });
        /* the hits join SB_BOOKINGS (a search reaches months that are not loaded) */
        try{
          if(typeof window._opsBookingMerge === 'function' && typeof window.bookingV2FromOpsBooking === 'function')
            window._opsBookingMerge(rows.map(window.bookingV2FromOpsBooking));
        }catch(_){}
        if(j && j.next_cursor && ++pages < MAX_PAGES) return page(j.next_cursor);
      });
    }
    page(null).then(function(){
      var old = e.ids, changed = !old || old.size !== ids.size || Array.from(ids).some(function(i){ return !old.has(i); });
      SETS[key] = { ids: ids, at: Date.now(), busy: false, stale: false };
      if(changed) redraw();
    }, function(err){
      SETS[key] = { ids: e.ids || null, at: Date.now(), busy: false, failedAt: Date.now() };
      try{ console.warn('[ops] list ' + key + ': the server did not answer, the screen keeps its own test · ' + ((err && err.message) || err)); }catch(_){}
    });
  }
  /* kind 'pending_foc' | 'q' -> Set of booking ids, or null (not answered yet) */
  window.laOpsListSet = function(kind, q){
    if(!enabled()) return null;
    if(kind === 'q' && !String(q || '').trim()) return null;
    var key = setKey(kind, q), e = SETS[key];
    var failedRecently = e && e.failedAt && Date.now() - e.failedAt < FAIL_MS;
    if(!failedRecently && (!e || (e.stale && !e.busy) || (!e.ids && !e.busy))){
      if(kind === 'q'){
        /* typing: wait for a pause before asking */
        clearTimeout(timers[key]);
        timers[key] = setTimeout(function(){ loadSet(kind, q, key); }, WAIT_MS);
        if(!e) SETS[key] = { ids: null, at: 0, busy: false, pending: true };
      } else loadSet(kind, q, key);
    }
    return (SETS[key] && SETS[key].ids) || null;
  };
  /* any booking write may move who matches: keep the old set on screen, ask again on the next draw */
  var statsTimer = null;
  O.onWrite(function(kind){
    Object.keys(SETS).forEach(function(k){ if(SETS[k]) SETS[k].stale = true; });
    /* the KPI cards (stats.pending_foc_count ...) are the server's too: ask again after a booking write */
    if(kind === 'booking' && window._opsAllStats){
      clearTimeout(statsTimer);
      statsTimer = setTimeout(function(){
        O.get('/v1/bookings/stats').then(function(j){ if(j){ window._opsAllStats = j; redraw(); } }, function(){});
      }, 400);
    }
  });

  /* ── the agent dropdown: GET /v1/agents/ranking ──────────────────────── */
  var rank = { res: null, at: 0, busy: false, failedAt: 0, shape: null };
  var RANK_MS = 60000;
  function rankShape(res){
    var recent = [], recentAt = {}, top = [], cnt = {};
    (res.recent || []).forEach(function(r){ recent.push(r.agent_id); recentAt[r.agent_id] = Date.parse(r.at) || 0; });
    (res.top || []).forEach(function(r){ top.push(r.agent_id); cnt[r.agent_id] = r.count; });
    return { n: -1, me: '', at: Date.now(), recent: recent, recentAt: recentAt, top: top, cnt: cnt, server: true };
  }
  function rankAsk(){
    if(rank.busy) return;
    rank.busy = true;
    O.get('/v1/agents/ranking').then(function(res){
      rank = { res: res, at: Date.now(), busy: false, failedAt: 0, shape: rankShape(res || {}) };
      /* the dropdown may be open on the legacy order: draw it again */
      try{
        var dd = document.getElementById('bkv2-agent-dd'), inp = document.getElementById('bkv2-agent-input');
        if(dd && inp && dd.classList.contains('open') && typeof window.bookingV2AgentDDRender === 'function') window.bookingV2AgentDDRender(inp.value);
      }catch(_){}
    }, function(err){
      rank.busy = false; rank.failedAt = Date.now();
      try{ console.warn('[ops] agent ranking: the server did not answer, the dropdown keeps its own order · ' + ((err && err.message) || err)); }catch(_){}
    });
  }
  wrap('bookingV2AgentDDStats', function(orig){
    var fresh = rank.shape && Date.now() - rank.at < RANK_MS;
    if(!fresh && !(rank.failedAt && Date.now() - rank.failedAt < FAIL_MS)) rankAsk();
    return rank.shape || orig();
  });
  O.onWrite(function(kind){ if(kind === 'booking') rank.at = 0; });
  window.laOpsListRank = { _state: function(){ return rank; } };

  /* ── warnings on a save answer ───────────────────────────────────────── */
  O.saveWarnings = function(bk, warnings){
    (warnings || []).forEach(function(w){
      if(!w || (w.code !== 'possible_duplicate' && w.code !== 'passenger_types')) return;
      var sub = '';
      if(w.code === 'possible_duplicate'){
        sub = (w.duplicates || []).slice(0, 3).map(function(d){
          return (d.voucher_ref || d.code || d.booking_id) + (d.lead_pax ? ' · ' + d.lead_pax : '') + ((d.reasons || []).length ? ' (' + d.reasons.join(' · ') + ')' : '');
        }).join('\n');
      } else if(w.expected && w.listed){
        var fmt = function(o){ return ['AD', 'CHD', 'INF', 'FOC'].map(function(k){ return k + ' ' + (o[k] || 0); }).join(' · '); };
        sub = fmt(w.listed) + '  /  ' + fmt(w.expected);
      }
      O.toast({ kind: 'pending', title: w.message || w.code, id: bk.id, status: 'WARNING', sub: sub, dur: 12000 });
    });
  };

  window.laOpsBookingList = { _sets: SETS };
})();
