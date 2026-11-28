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
     §liveNoticeOne (2026-11-28) · owner (screenshot: two "อัปเดต booking 94 ใบ / 9 ใบ … โดย lk_service" cards over the
     "มีข้อมูลใหม่จากคนอื่น" card): "เหมือนมันจะรกเกิน". So:
     · ONE card at most. Later changes fold into it (counts add up, the timer starts again) instead of stacking;
     · background sync accounts (lk_service, …_service, …sync, system) show nothing: they are not a person's work;
     · codes are listed only for one or two bookings; more is a count ("มีการเปลี่ยนแปลง booking 12 ใบ · ใหม่ 2 · อัปเดต 10");
     · while legacy's #la-refresh card shows, this one stays hidden (css), so the lane never holds two cards.
     The booking shows by its code (BK-…) or lead name, never the server's internal id (booking_<uuid>). */
  var NOTE_MS = 8000, pendingNotes = [], notesQueued = false, card = null;
  function systemActor(by){ return /(^|[._\s-])(service|sync|system|bot)$/i.test(String(by || '')) || /^system$/i.test(String(by || '')); }
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
  /* §b2cPopOps (2026-11-28) · a new B2C booking gets legacy's top-right card again (01-auth-sync.js _laB2CAlertBookings:
     route, date, pax, THB, paid, "Open booking"). Love Kingdom's orders arrive through a sync account (lk_service), which
     the bottom-left card skips, so this path does not go through it. The feed row carries no booking, so each one is read
     once (GET /v1/bookings/{id}); one page of changes makes one card. Only "created": an update or a resync stays silent. */
  var B2C_MAX = 10, b2cQueue = [], b2cQueued = false;
  function isB2C(bk, by){
    if(!bk) return false;
    var f = bk.srvFlags || {};
    return /^b2c_/i.test(String(bk.id || '')) || bk.agentId === 'a_b2c' || !!f.isB2C || !!f.b2cChannel || /^lk_/i.test(String(by || ''));
  }
  function b2cCreated(change){
    if(!change || change.kind !== 'booking' || change.action !== 'created' || mine(change) || !change.entity_id) return;
    if(typeof window._laB2CAlertBookings !== 'function') return;
    b2cQueue.push(change);
    if(!b2cQueued){ b2cQueued = true; Promise.resolve().then(flushB2C); }
  }
  function flushB2C(){
    b2cQueued = false;
    var rows = b2cQueue.splice(0, B2C_MAX); b2cQueue = [];
    if(!rows.length) return;
    Promise.all(rows.map(function(c){
      return O.get('/v1/bookings/' + encodeURIComponent(String(c.entity_id))).then(function(ob){
        if(!ob || !O.bookings || typeof O.bookings.fromServer !== 'function') return null;
        var bk = O.bookings.fromServer(ob);
        return isB2C(bk, c.changed_by) ? bk : null;
      }, function(){ return null; });
    })).then(function(bks){
      bks = bks.filter(Boolean);
      if(bks.length) try{ window._laB2CAlertBookings(bks); }catch(_){}
    });
  }
  /* §b2cOnly (2026-11-28) · owner: "เราหมายถึงเฉพาะข้อมูลที่ Sync B2C เท่านั้นนะ ของ B2B ไม่ต้อง". A booking change by staff no
     longer draws the bottom-left card; only a new B2C booking pops up (top-right, b2cCreated). The card code stays for
     O.changes.notes (tests) and in case it is wanted back: flip NOTES_ON. */
  var NOTES_ON = false;
  function bookingToast(change){
    b2cCreated(change);
    if(!NOTES_ON) return;
    if(!change || change.kind !== 'booking' || mine(change) || systemActor(change.changed_by)) return;
    pendingNotes.push({ action: change.action === 'created' || change.action === 'deleted' ? change.action : 'updated',
      by: change.changed_by ? String(change.changed_by) : '', id: String(change.entity_id || '') });
    if(!notesQueued){ notesQueued = true; Promise.resolve().then(flushNotes); }   // after the whole page of changes is applied
  }
  var NOTE_WORD = { created: 'Booking ใหม่', updated: 'อัปเดต booking', deleted: 'ลบ booking' };
  var COUNT_WORD = { created: 'ใหม่', updated: 'อัปเดต', deleted: 'ลบ' };
  function noteEsc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return '&#' + c.charCodeAt(0) + ';'; }); }
  function flushNotes(){
    notesQueued = false;
    var notes = pendingNotes; pendingNotes = [];
    if(!notes.length) return;
    var live = card && card.el && card.el.parentNode ? card : null;
    var st = live ? card.st : { ids: {}, order: [], by: [] };
    notes.forEach(function(n){
      var cur = st.ids[n.id];
      // one booking counts once: created/deleted win over a later update of the same booking
      if(!cur){ st.ids[n.id] = n.action; st.order.push(n.id); }
      else if(n.action !== 'updated') st.ids[n.id] = n.action;
      if(n.by && st.by.indexOf(n.by) < 0) st.by.push(n.by);
    });
    showCard(st);
  }
  function liveWrap(){
    var w = document.getElementById('la-live-wrap');
    if(!w && document.body){ w = document.createElement('div'); w.id = 'la-live-wrap'; w.setAttribute('role', 'status'); w.setAttribute('aria-live', 'polite'); document.body.appendChild(w); }
    return w;
  }
  function cardHtml(st){
    var n = st.order.length, counts = { created: 0, updated: 0, deleted: 0 };
    st.order.forEach(function(id){ counts[st.ids[id]]++; });
    var kinds = ['created', 'updated', 'deleted'].filter(function(k){ return counts[k]; });
    var kind = kinds.length === 1 ? kinds[0] : 'mixed';
    var title = n === 1 ? NOTE_WORD[st.ids[st.order[0]]]
      : kinds.length === 1 ? NOTE_WORD[kinds[0]] + ' ' + n + ' ใบ'
      : 'มีการเปลี่ยนแปลง booking ' + n + ' ใบ';
    var detail = kinds.length > 1 ? kinds.map(function(k){ return COUNT_WORD[k] + ' ' + counts[k]; }).join(' · ') : '';
    var labels = n <= 2 ? st.order.map(bookingLabel).filter(Boolean) : [];
    var by = st.by.slice(0, 2).join(', ') + (st.by.length > 2 ? ' +' + (st.by.length - 2) : '');
    return { kind: kind, html: '<span class="la-live-dot"></span><span class="la-live-tx"><b>' + noteEsc(title) + '</b>'
      + (labels.length ? '<code>' + labels.map(function(c){ return '<span>' + noteEsc(c) + '</span>'; }).join(' ') + '</code>' : '')
      + ((detail || by) ? '<i>' + noteEsc(detail) + (detail && by ? ' · ' : '') + (by ? 'โดย ' + noteEsc(by) : '') + '</i>' : '') + '</span>'
      + '<button type="button" aria-label="ปิด">×</button>' };
  }
  function showCard(st){
    try{
      var w = liveWrap(); if(!w) return;
      var c = cardHtml(st), el = card && card.el && card.el.parentNode ? card.el : null;
      if(!el){
        while(w.firstChild) w.removeChild(w.firstChild);
        el = document.createElement('div');
        w.appendChild(el);
        card = { el: el, st: st, t: null };
        var gone = function(){ clearTimeout(card && card.t); if(card && card.el === el) card = null; el.classList.add('la-live-out'); setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); }, 200); };
        el.addEventListener('click', function(e){ if(e && e.target && e.target.tagName === 'BUTTON') gone(); });
        el.addEventListener('mouseenter', function(){ if(card) clearTimeout(card.t); });
        el.addEventListener('mouseleave', function(){ if(card) card.t = setTimeout(gone, 1500); });
        card.gone = gone;
      }
      card.st = st;
      el.className = 'la-live la-live-' + c.kind;
      el.innerHTML = c.html;
      clearTimeout(card.t); card.t = setTimeout(card.gone, NOTE_MS);
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
  /* §ckLiveBg (2026-11-28) · a window that is open but not in front (another window or app has focus) redraws at most
     every BG_DRAW_GAP_MS: after #123 the office still sent ~20 requests/s, most from check-in tabs left open on several
     Windows PCs. The front window keeps DRAW_GAP_MS; a hidden tab does not ask at all (pull). */
  var BG_DRAW_GAP_MS = 30000;
  function focused(){ try{ return typeof document.hasFocus !== 'function' || document.hasFocus(); }catch(_){ return true; } }
  /* §ckSse (2026-11-28) · while the push stream is up the front window redraws at most every LIVE_DRAW_GAP_MS (a change
     that comes alone draws at once); a window behind others keeps BG_DRAW_GAP_MS and draws at once when it is clicked. */
  var LIVE_DRAW_GAP_MS = 2000;
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
    var wait = lastDraw + (focused() ? (streamLive() ? LIVE_DRAW_GAP_MS : DRAW_GAP_MS) : BG_DRAW_GAP_MS) - Date.now();
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
  /* §holdOnBooking (2026-11-28) · owner: "the redraw should only refresh if the user click the notification"; the network panel still
     showed, after each /v1/changes, the whole booking screen read again (van-days, van-jobs, by-trip, after-trip, van-board,
     availability, boat-operation, …): a dozen modules each react to a change on their own and some of them redraw. So while the
     booking screen is open the changes are HELD here, not handed to any module: another person's change shows the "โหลดเลย" card
     (#la-refresh); the click hands every held change over at once and redraws once (O.refreshHooks, 30-ops-locks.js). Leaving the
     booking screen hands them over quietly. The live notes (bookingToast) still show at once. */
  var held = [];
  function holding(){ return activeView() === 'booking'; }
  function deliver(change){
    // All listeners refresh only what they already display/cache. Keep remote changes
    // separate from a local write so this tab can suppress its own notification only.
    if(O.changed) O.changed(change);
    repaintFor(change);
    if(O.wrote) O.wrote('remote:' + (change.kind || 'change'));
    repaintCheckin(change);
  }
  function release(){ var h = held; held = []; h.forEach(deliver); }
  var CARD_KINDS = { booking:1, seat_lock:1, deployment:1, route:1, boat:1, weather_closure:1 };
  function refreshCard(by){
    if(!document.body) return;
    var d = document.getElementById('la-refresh');
    if(!d){
      d = document.createElement('div'); d.id = 'la-refresh';
      d.innerHTML = '<span class="la-rf-dot"></span><span class="la-rf-tx"><b>มีข้อมูลใหม่จากคนอื่น</b><i></i></span><button type="button">โหลดเลย</button>';
      d.querySelector('button').addEventListener('click', function(){
        if(d.parentNode) d.parentNode.removeChild(d);
        release();
        // the changed bookings are merged first (bookingV2LoadFromOpsBackend.js), so the one redraw shows them
        var merged; try{ merged = typeof window._opsRemoteBookingsFlush === 'function' ? window._opsRemoteBookingsFlush() : null; }catch(_){ merged = null; }
        Promise.resolve(merged).catch(function(){}).then(function(){
          var hooks = O.refreshHooks || [];
          if(hooks.length) hooks.forEach(function(fn){ try{ fn(); }catch(_){} });
          else if(typeof window.bookingV2RenderKeep === 'function') window.bookingV2RenderKeep();
        });
      });
      document.body.appendChild(d);
    }
    var i = d.querySelector('.la-rf-tx i');
    if(i) i.innerHTML = (by ? 'โดย ' + noteEsc(by) + ' · ' : '') + 'กดโหลดเพื่อดูข้อมูลล่าสุด';
  }
  function apply(change){
    if(!change || !Number.isInteger(+change.version)) return;
    if(cursor !== null && +change.version <= cursor) return;   // §ckSse · the stream and a poll can both bring the same row
    cursor = +change.version;
    bookingToast(change);
    if(!holding()){ release(); deliver(change); return; }
    held.push(change);
    if(CARD_KINDS[change.kind] && !mine(change)) refreshCard(change.changed_by ? String(change.changed_by) : '');
  }
  // off the booking screen: what was held goes to the modules (their caches go stale; the next screen reads fresh)
  try{ document.addEventListener('click', function(ev){
    var a = ev.target && ev.target.closest && ev.target.closest('.nav-item'); if(!a) return;
    setTimeout(function(){ if(held.length && !holding()){ var c = document.getElementById('la-refresh'); if(c && c.parentNode) c.parentNode.removeChild(c); release(); } }, 0);
  }, true); }catch(_){}
  function baseline(){
    return O.get('/v1/changes').then(function(j){
      if(j && Number.isInteger(+j.version)) cursor = +j.version;
      started = cursor !== null;
      if(started) setTimeout(openStream, 0);   // §ckSse · the stream starts where the feed starts: at the current version
      return j;
    });
  }
  function pull(){
    if(held.length && !holding()) release();   // §holdOnBooking · the screen changed without a nav click
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
  setInterval(function(){ if(!streamLive()) pull(); }, POLL_MS);
  /* §ckLiveOps (2026-11-28) · legacy §ckLive2: while Pier or Van check-in is open (legacy _laLiveView), ask every 2 s,
     so a check-in on one device shows on another within about 2 s, not 20. Stops when the tab is hidden or the screen
     changes; the 20 s poll above stays for every other screen. pull() never overlaps itself (loading). */
  /* §ckLiveBg (2026-11-28) · every 10 s, not 2 s, and only in the window that has focus (a window behind others keeps the
     20 s poll). Coming back to the window asks at once, so what the person looks at is fresh. */
  var LIVE_VIEWS = { piercheckin:1, vancheckin:1 }, LIVE_MS = 10000;
  setInterval(function(){ if(!streamLive() && !document.hidden && focused() && LIVE_VIEWS[activeView()]) pull(); }, LIVE_MS);

  /* §ckSse (2026-11-28) · owner: check-in on machine A must show on machine B "เกือบเรียลไทม์". operation-backend pushes every
     change row on GET /v1/changes/stream (text/event-stream: `id: <version>` `event: change` `data: <the /v1/changes row>`,
     `event: hb` every 25 s, Postgres NOTIFY on commit, so tens of ms). EventSource cannot send the Bearer header, so the
     stream is read with fetch (laOpsFetch adds it). Rows go through apply() exactly as a polled page does; the polls above
     stop while the stream is up and come back when it drops. A hidden tab closes its stream (no open connection per
     forgotten tab) and reopens it from the cursor when shown, so nothing is missed. */
  var STREAM_STALE_MS = 60000, stream = null, streamBeat = 0, streamWait = 0, streamRetry = null;
  function streamLive(){ return !!(stream && stream.live && Date.now() - streamBeat < STREAM_STALE_MS); }
  function canStream(){
    return typeof window.laOpsFetch === 'function' && typeof TextDecoder !== 'undefined' && typeof AbortController !== 'undefined';
  }
  function streamEvent(block){
    var ev = 'message', data = [];
    block.split('\n').forEach(function(line){
      if(line.indexOf('event:') === 0) ev = line.slice(6).trim();
      else if(line.indexOf('data:') === 0) data.push(line.slice(5).replace(/^ /, ''));
    });
    if(!data.length) return;
    var j = null; try{ j = JSON.parse(data.join('\n')); }catch(_){ return; }
    if(ev === 'change'){ apply(j); return true; }
    if(ev === 'hb' && j && Number.isInteger(+j.version) && cursor !== null && +j.version > cursor) pull();   // a row the stream missed
  }
  function closeStream(){
    var s0 = stream; stream = null;
    if(s0){ s0.live = false; try{ s0.ctl.abort(); }catch(_){} }
  }
  function retryStream(){
    if(streamRetry) return;
    streamWait = Math.min(60000, streamWait ? streamWait * 2 : 5000);
    streamRetry = setTimeout(function(){ streamRetry = null; openStream(); }, streamWait);
  }
  function openStream(){
    if(stream || !canStream() || document.hidden || cursor === null || !O.enabled()) return;
    var me = { ctl: new AbortController(), live: false };
    stream = me;
    window.laOpsFetch('/v1/changes/stream?since=' + cursor, { headers: { Accept: 'text/event-stream' }, signal: me.ctl.signal }).then(function(r){
      if(stream !== me) return;
      if(!r || !r.ok || !r.body || typeof r.body.getReader !== 'function') throw new Error('stream HTTP ' + (r && r.status));
      me.live = true; streamBeat = Date.now(); streamWait = 0;
      var rd = r.body.getReader(), dec = new TextDecoder(), buf = '';
      function step(){
        return rd.read().then(function(x){
          if(stream !== me) return;
          if(x.done) throw new Error('stream ended');
          streamBeat = Date.now();
          buf += dec.decode(x.value, { stream: true }).replace(/\r\n?/g, '\n');
          var any = false, cut;
          while((cut = buf.indexOf('\n\n')) >= 0){ if(streamEvent(buf.slice(0, cut))) any = true; buf = buf.slice(cut + 2); }
          if(any) flushDraw();
          return step();
        });
      }
      return step();
    }).then(null, function(e){
      if(stream !== me) return;            // closed on purpose (hidden tab)
      closeStream();
      if(!warned){ try{ console.warn('[ops] change stream down, polling · ' + ((e && e.message) || e)); }catch(_){} }
      pull(); retryStream();
    });
  }
  // a stream that went quiet (no heartbeat for a minute: a proxy cut it without closing) is replaced
  setInterval(function(){ if(stream && stream.live && !streamLive()){ closeStream(); pull(); openStream(); } }, 15000);
  document.addEventListener('visibilitychange', function(){
    if(document.hidden){ closeStream(); return; }
    if(cursor !== null && canStream()) openStream(); else pull();
  });
  try{ if(typeof window.addEventListener === 'function') window.addEventListener('focus', function(){
    if(drawTimer && drawWanted){ clearTimeout(drawTimer); drawTimer = null; }   // a window behind others draws the moment it is clicked
    if(!streamLive()) pull();
    flushDraw();
  }); }catch(_){}
  // Boot completes asynchronously after this classic script is evaluated.
  (function wait(){
    if(O.enabled() && O.state.loaded){ pull(); return; }
    setTimeout(wait, 500);
  })();
  O.changes = { stream: function(){ return { live: streamLive(), open: !!stream }; }, openStream: openStream, closeStream: closeStream, notes: flushNotes, label: bookingLabel, b2c: flushB2C, isB2C: isB2C, pull: pull, version: function(){ return cursor; }, started: function(){ return started; } };
})();
