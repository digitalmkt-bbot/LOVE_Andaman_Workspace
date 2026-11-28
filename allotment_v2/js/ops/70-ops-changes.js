/* ══════════════════════════════════════════════════════════════════════════
   §opsChanges (2026-10-11) · operation-backend change-feed client
   ──────────────────────────────────────────────────────────────────────────
   The backend's SSE stream needs a Bearer header, which browser EventSource
   cannot send. Poll the same durable /v1/changes cursor instead: start at the
   current version (never toast old history), then read later changes in order.
   Remote writes invalidate the existing page caches and booking changes show a
   short toast. This is deliberately off outside operation-backend mode.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O || !window.LA_LEGACY_UNAVAILABLE || window.__laEmbedToken) return;   // w5-a: the embed token may not read /v1/changes
  var cursor = null, loading = false, started = false, warned = false;
  var POLL_MS = 20000, PAGE = 500;

  function mine(change){
    var me = window.LA_ME && window.LA_ME.username;
    return !!(me && change && change.changed_by && String(change.changed_by) === String(me));
  }
  /* §liveNotice (2026-11-28) · another person's booking change shows bottom-left, in the sidebar lane, the way legacy's
     "มีข้อมูลใหม่จากคนอื่น" card (#la-refresh, css/01-base.css §laRfLeft) does, not as save toasts top-right.
     owner: "ของเดิมเราขึ้นอัพเดทอยู่ฝั่งซ้ายล่าง พอดีกับ sidebar และปรับหน้าตา ui ให้เข้ากับระบบด้วย".
     · the changes of one pull become ONE card per action and person ("อัปเดต booking 8 ใบ · โดย RSVN05"), so a run of
       re-confirms is one card, not a stack that covers the page;
     · the booking shows by its code (BK-…) or lead name, never the server's internal id (booking_<uuid>), and once only;
     · at most LIVE_MAX cards; each leaves after LIVE_MS (kept while the pointer is on it). Look: css/01-base.css #la-live-wrap. */
  var LIVE_MAX = 3, LIVE_MS = 8000, pendingNotes = [], notesQueued = false;
  function bookingLabel(id){
    var s = String(id || ''), list = (typeof SB_BOOKINGS !== 'undefined' && Array.isArray(SB_BOOKINGS)) ? SB_BOOKINGS : [];
    for(var i = 0; i < list.length; i++){
      var b = list[i];
      if(b && (b.opsId === s || b.id === s)){ var c = b.code || b.voucherRef || b.leadPax; if(c) return String(c); break; }
    }
    if(/^lg_/.test(s)) return s.slice(3);                          // lg_BK-26114692-PV3W → BK-26114692-PV3W
    if(/^booking_[0-9a-f-]{20,}$/i.test(s)) return '';               // internal id: nothing a person can read
    return s;
  }
  function bookingToast(change){
    if(!change || change.kind !== 'booking' || mine(change)) return;
    pendingNotes.push({ action: change.action === 'created' || change.action === 'deleted' ? change.action : 'updated',
      by: change.changed_by ? String(change.changed_by) : '', id: String(change.entity_id || '') });
    if(!notesQueued){ notesQueued = true; Promise.resolve().then(flushNotes); }   // after the whole page of changes is applied
  }
  var NOTE_WORD = { created: 'Booking ใหม่', updated: 'อัปเดต booking', deleted: 'ลบ booking' };
  function noteEsc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return '&#' + c.charCodeAt(0) + ';'; }); }
  function flushNotes(){
    notesQueued = false;
    var notes = pendingNotes; pendingNotes = [];
    var groups = [], byKey = {};
    notes.forEach(function(n){
      var k = n.action + '|' + n.by, g = byKey[k];
      if(!g){ g = byKey[k] = { action: n.action, by: n.by, ids: [] }; groups.push(g); }
      if(g.ids.indexOf(n.id) < 0) g.ids.push(n.id);
    });
    groups.forEach(showNote);
  }
  function liveWrap(){
    var w = document.getElementById('la-live-wrap');
    if(!w && document.body){ w = document.createElement('div'); w.id = 'la-live-wrap'; w.setAttribute('role', 'status'); w.setAttribute('aria-live', 'polite'); document.body.appendChild(w); }
    return w;
  }
  function showNote(g){
    try{
      var w = liveWrap(); if(!w) return;
      var labels = g.ids.map(bookingLabel).filter(Boolean), n = g.ids.length;
      var title = NOTE_WORD[g.action] + (n > 1 ? ' ' + n + ' ใบ' : '');
      var codes = labels.slice(0, 3).map(function(c){ return '<span>' + noteEsc(c) + '</span>'; }).join(' ') + (labels.length > 3 ? ' <span>+' + (labels.length - 3) + '</span>' : '');
      var el = document.createElement('div');
      el.className = 'la-live la-live-' + g.action;
      el.innerHTML = '<span class="la-live-dot"></span><span class="la-live-tx"><b>' + noteEsc(title) + '</b>'
        + (codes ? '<code>' + codes + '</code>' : '')
        + (g.by ? '<i>โดย ' + noteEsc(g.by) + '</i>' : '') + '</span>'
        + '<button type="button" aria-label="ปิด">×</button>';
      w.appendChild(el);
      while(w.children.length > LIVE_MAX) w.removeChild(w.firstChild);
      var t = null;
      var gone = function(){ clearTimeout(t); el.classList.add('la-live-out'); setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); }, 200); };
      el.querySelector('button').addEventListener('click', gone);
      el.addEventListener('mouseenter', function(){ clearTimeout(t); });
      el.addEventListener('mouseleave', function(){ t = setTimeout(gone, 1500); });
      t = setTimeout(gone, LIVE_MS);
    }catch(_){}
  }
  /* §opsHandoff (2026-10-12) · a van or pickup change redraws the screen that shows it, but only while
     that screen is open. Goes through _laRerender so scroll and focus survive. van_bill is not listed:
     _laRerender goes through nav(), which clears the bill view's open accordions. */
  var SCREEN_BY_KIND = { van:'vanjobs', van_day:'vanjobs', van_stop:'vanjobs', van_group:'vanjobs',
    pickup_area:'pickup-setup', pickup_profile:'pickup-setup' };
  function repaintFor(change){
    var view = SCREEN_BY_KIND[change.kind];
    if(!view) return;
    var act = document.querySelector('.nav-item.active');
    if(!act || !act.dataset || act.dataset.view !== view) return;
    queueDraw();
  }
  /* §opsCheckinLive (Q34a) · Van Check-in shows bookings (check-in marks, arrivals), vans, groups and stops, so a change
     of those kinds on the open day redraws it. Runs AFTER O.wrote (the booking and van caches are dropped by then) and
     forgets the van day's 5 s throttle, so the redraw's reload really asks the server. _laRerender keeps the scroll
     position and puts the cursor back in the field being typed in; while someone is typing in a field the redraw waits
     (retry every 1.5 s, up to 8 times), so a note is never cut off. */
  var CHECKIN_KINDS = { booking:1, van:1, van_day:1, van_stop:1, van_group:1, deployment:1 };
  /* §ckLiveOps (2026-11-28) · Pier and Land check-in redraw too, as legacy's idle refresh redraws whatever screen is
     open. Each screen's day: Van check-in keeps _vanCkDate; Pier and Land share _pckDate (08-app.js). */
  var CHECKIN_DAY = { vancheckin:'_vanCkDate', piercheckin:'_pckDate', landcheckin:'_pckDate' };
  function activeView(){
    var act = document.querySelector('.nav-item.active');
    return (act && act.dataset && act.dataset.view) || '';
  }
  /* §ckLiveCalm (2026-11-28) · one redraw per batch, at most one every DRAW_GAP_MS. Before this every change in a
     /v1/changes page redrew the open screen on its own, and each redraw reloads the screen's whole day (van-jobs,
     van-days, van-stops, van-groups, manifest, bookings). With the 2 s check on Pier/Van check-in and a busy booking
     afternoon, the office sent ~20 requests/s (Railway, 2026-11-28 16:05-16:20) and every other read queued behind
     them: Travel Summary waited past 120 s and stayed on "Loading…". Now the changes of one pull ask for ONE redraw;
     a redraw within DRAW_GAP_MS of the last waits for the gap; the steps to run first (dropDay) are kept by key. */
  var DRAW_GAP_MS = 5000, lastDraw = 0, drawTimer = null, drawWanted = false, drawPreps = {}, busyTries = 0;
  function draw(){
    drawTimer = null;
    if(O.busy && O.busy()){
      if(busyTries++ < 8){ drawTimer = setTimeout(draw, 1500); return; }
      busyTries = 0; drawWanted = false; drawPreps = {}; return;
    }
    busyTries = 0; drawWanted = false;
    var preps = drawPreps; drawPreps = {};
    Object.keys(preps).forEach(function(k){ try{ preps[k](); }catch(_){} });
    lastDraw = Date.now();
    if(typeof window._laRerender === 'function') window._laRerender();
  }
  function queueDraw(key, prep){ drawWanted = true; if(key && prep) drawPreps[key] = prep; }
  function flushDraw(){
    if(!drawWanted || drawTimer) return;
    var wait = lastDraw + DRAW_GAP_MS - Date.now();
    if(wait <= 0) draw(); else drawTimer = setTimeout(draw, wait);
  }
  function repaintCheckin(change){
    if(!change || !CHECKIN_KINDS[change.kind]) return;
    var view = activeView();
    if(!CHECKIN_DAY[view]) return;
    var dv = window[CHECKIN_DAY[view]];
    var day = (typeof dv === 'string') ? dv : '';
    if(day && Array.isArray(change.route_days) && change.route_days.length &&
       !change.route_days.some(function(d){ return d && d.service_date === day; })) return;
    if(view === 'vancheckin' && O.vanJobs && O.vanJobs.dropDay) queueDraw('van:' + day, function(){ O.vanJobs.dropDay(day); });
    else queueDraw();
  }
  function apply(change){
    if(!change || !Number.isInteger(+change.version)) return;
    cursor = +change.version;
    // All listeners refresh only what they already display/cache. Keep remote changes
    // separate from a local write so this tab can suppress its own notification only.
    if(O.changed) O.changed(change);
    repaintFor(change);
    if(O.wrote) O.wrote('remote:' + (change.kind || 'change'));
    repaintCheckin(change);
    bookingToast(change);
  }
  function baseline(){
    return O.get('/v1/changes').then(function(j){
      if(j && Number.isInteger(+j.version)) cursor = +j.version;
      started = cursor !== null;
      return j;
    });
  }
  function pull(){
    if(loading || !O.enabled() || !O.state.loaded || document.hidden) return;
    loading = true;
    var first = cursor === null ? baseline() : O.get('/v1/changes', { since: cursor, limit: PAGE }).then(function(j){
      var changes = (j && Array.isArray(j.changes)) ? j.changes : [];
      changes.forEach(apply);
      flushDraw();
      // Empty means the response version is our durable cursor. Do not jump past a
      // non-empty page: a full page may have more rows still waiting after it.
      if(!changes.length && j && Number.isInteger(+j.version)) cursor = +j.version;
      if(changes.length >= PAGE) setTimeout(pull, 0);
      return j;
    });
    first.then(function(){ warned = false; }, function(e){
      if(!warned){ warned = true; try{ console.warn('[ops] change feed unavailable · ' + ((e && e.message) || e)); }catch(_){} }
    }).then(function(){ loading = false; });
  }
  setInterval(pull, POLL_MS);
  /* §ckLiveOps (2026-11-28) · legacy §ckLive2: while Pier or Van check-in is open (legacy _laLiveView), ask every 2 s,
     so a check-in on one device shows on another within about 2 s, not 20. Stops when the tab is hidden or the screen
     changes; the 20 s poll above stays for every other screen. pull() never overlaps itself (loading). */
  var LIVE_VIEWS = { piercheckin:1, vancheckin:1 }, LIVE_MS = 2000;
  setInterval(function(){ if(!document.hidden && LIVE_VIEWS[activeView()]) pull(); }, LIVE_MS);
  document.addEventListener('visibilitychange', function(){ if(!document.hidden) pull(); });
  // Boot completes asynchronously after this classic script is evaluated.
  (function wait(){ if(O.enabled() && O.state.loaded){ pull(); return; } setTimeout(wait, 500); })();
  O.changes = { notes: flushNotes, label: bookingLabel, pull: pull, version: function(){ return cursor; }, started: function(){ return started; } };
})();
