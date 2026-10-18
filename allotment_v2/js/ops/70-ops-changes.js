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
  function bookingToast(change){
    if(!change || change.kind !== 'booking' || mine(change)) return;
    var action = change.action || 'updated';
    var title = action === 'created' ? 'New booking' : action === 'deleted' ? 'Booking deleted' : 'Booking updated';
    var sub = change.entity_id || '';
    if(change.changed_by) sub += (sub ? ' · ' : '') + 'by ' + change.changed_by;
    O.toast({ kind: action === 'deleted' ? 'error' : action === 'created' ? 'success' : 'neutral',
      title: title, id: change.entity_id || '', status: action.toUpperCase(), sub: sub, dur: 7000 });
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
    if(typeof window._laRerender === 'function') window._laRerender();
  }
  /* §opsCheckinLive (Q34a) · Van Check-in shows bookings (check-in marks, arrivals), vans, groups and stops, so a change
     of those kinds on the open day redraws it. Runs AFTER O.wrote (the booking and van caches are dropped by then) and
     forgets the van day's 5 s throttle, so the redraw's reload really asks the server. _laRerender keeps the scroll
     position and puts the cursor back in the field being typed in; while someone is typing in a field the redraw waits
     (retry every 1.5 s, up to 8 times), so a note is never cut off. */
  var CHECKIN_KINDS = { booking:1, van:1, van_day:1, van_stop:1, van_group:1, deployment:1 };
  function repaintCheckin(change, tries){
    if(!change || !CHECKIN_KINDS[change.kind]) return;
    var act = document.querySelector('.nav-item.active');
    if(!act || !act.dataset || act.dataset.view !== 'vancheckin') return;
    var day = (typeof window._vanCkDate === 'string') ? window._vanCkDate : '';
    if(day && Array.isArray(change.route_days) && change.route_days.length &&
       !change.route_days.some(function(d){ return d && d.service_date === day; })) return;
    if(O.busy && O.busy()){ if((tries || 0) < 8) setTimeout(function(){ repaintCheckin(change, (tries || 0) + 1); }, 1500); return; }
    if(O.vanJobs && O.vanJobs.dropDay) O.vanJobs.dropDay(day);
    if(typeof window._laRerender === 'function') window._laRerender();
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
  document.addEventListener('visibilitychange', function(){ if(!document.hidden) pull(); });
  // Boot completes asynchronously after this classic script is evaluated.
  (function wait(){ if(O.enabled() && O.state.loaded){ pull(); return; } setTimeout(wait, 500); })();
  O.changes = { pull: pull, version: function(){ return cursor; }, started: function(){ return started; } };
})();
