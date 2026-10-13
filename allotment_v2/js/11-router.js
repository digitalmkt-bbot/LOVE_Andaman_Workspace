/* ══════════════════════════════════════════════════════════════════════════
   §router (2026-10-05) · hash routing · phase 1
   ──────────────────────────────────────────────────────────────────────────
   Before this, the page you were on lived only in the DOM (.nav-item.active
   + .view.active). Refresh fell back to Dashboard (or to the per-tab
   sessionStorage snapshot), Back/Forward did nothing, and no page could be
   linked to. Now the URL says which page is open:

     #/dashboard
     #/fl-maintenance
     #/po-panwa
     #/booking?tab=bytrip&date=2026-10-05&route=r3
     #/booking?citytour=1&tab=cal

   Path = the nav item's data-view (the same names nav() already switches on).
   Hash rather than /paths: the app is one static HTML file, and real paths
   would need server rewrites.

   How it hooks in (nothing else had to change for the 71 sidebar items and the
   ~52 nav(document.querySelector(...)) jump buttons):
     · window.nav is wrapped · after a page switch the URL is written with
       history.pushState (pushState fires no hashchange, so no loop)
     · window.bookingV2Render is wrapped · keeps tab/date/route in the URL
       (tab change = new history entry, date stepping = replace, so Back
       doesn't walk through every day you clicked past)
     · hashchange/popstate (Back/Forward, typed or pasted URL) → laRouter.go
     · boot · _laRestoreView (01-auth-sync, 850ms after perms settle) asks
       laRouter for the URL the page was OPENED with, captured below at load,
       because laApplyPerms may already have clicked a fallback page by then

   Permissions: a URL for a page this account can't open is ignored and the URL
   is put back to the current page. That's UX only · the server is the wall.

   Embed mode (10-embed.js · ?embed=1) owns its own landing · router stays off.
   Load order: last <script> in <body> · classic script, no defer/async/module.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  if(window.__laEmbed) return;
  if(!window.history || typeof history.pushState !== 'function') return;

  var TAB_OK = ['cal','bytrip','all','locks','approvals','cancel'];
  var RX_DATE = /^\d{4}-\d{2}-\d{2}$/;
  var RX_ROUTE = /^[A-Za-z0-9_-]{1,40}$/;

  var booted = false;          // until boot, URL writes replace (no junk history entries)
  var applying = false;        // inside go() · syncs must not push
  var initialHash = location.hash || '';

  function bk(){ return (typeof _bkV2 !== 'undefined' && _bkV2) ? _bkV2 : (window._bkV2 || null); }

  /* '#/booking?tab=bytrip&date=…' → {view, params} · null if not a route */
  function parse(h){
    h = String(h == null ? location.hash : h);
    if(h.indexOf('#/') !== 0) return null;
    var s = h.slice(2), q = '', i = s.indexOf('?');
    if(i >= 0){ q = s.slice(i + 1); s = s.slice(0, i); }
    var view = decodeURIComponent(s).replace(/\/+$/, '');
    if(!view || !/^[a-z0-9-]+$/i.test(view)) return null;
    var params = {};
    try{ new URLSearchParams(q).forEach(function(v, k){ params[k] = v; }); }catch(_){}
    return { view: view, params: params };
  }

  function build(r){
    var q = [];
    Object.keys(r.params || {}).forEach(function(k){
      var v = r.params[k];
      if(v != null && v !== '') q.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
    });
    return '#/' + r.view + (q.length ? '?' + q.join('&') : '');
  }

  /* what the screen shows right now, as a route */
  function current(){
    var el = document.querySelector('.nav-item.active[data-view]');
    if(!el) return null;
    var r = { view: el.dataset.view, params: {} };
    if(r.view === 'booking'){
      if(el.dataset.citytour === '1') r.params.citytour = '1';
      var b = bk();
      if(b){
        if(b.tab && b.tab !== 'cal') r.params.tab = b.tab;
        if(b.tab === 'bytrip' && b.filterDate) r.params.date = b.filterDate;
        if(b.filterRoute) r.params.route = b.filterRoute;
      }
    }
    return r;
  }

  function write(hash, push){
    if(hash === location.hash) return;
    var url = location.pathname + location.search + hash;
    try{
      if(push && booted && !applying) history.pushState(null, '', url);
      else history.replaceState(null, '', url);
    }catch(_){}
  }

  function sync(push){ var r = current(); if(r) write(build(r), push); }

  function findNav(r){
    var sel = '.nav-item[data-view="' + r.view.replace(/"/g, '') + '"]';
    if(r.view === 'booking'){
      var want = r.params.citytour === '1';
      var all = document.querySelectorAll(sel);
      for(var i = 0; i < all.length; i++){ if((all[i].dataset.citytour === '1') === want) return all[i]; }
    }
    return document.querySelector(sel);
  }

  /* booking URL params → _bkV2 · only validated values reach state */
  function applyBookingParams(p){
    var b = bk(); if(!b) return;
    var tab = String(p.tab || 'cal').toLowerCase();
    b.tab = TAB_OK.indexOf(tab) >= 0 ? tab : 'cal';
    if(p.date && RX_DATE.test(p.date)){
      b.filterDate = p.date;
      try{ _bkV2T2Cursor = p.date.slice(0, 7); }catch(_){}
    }
    b.filterRoute = (p.route && RX_ROUTE.test(p.route)) ? p.route : null;
    b.detailId = null; b.newBooking = null; b.editingId = null;
  }

  /* open the page a route names · false if it can't (unknown / not allowed) */
  function go(r){
    if(!r) return false;
    var el = findNav(r);
    if(!el || el.style.display === 'none') return false;
    if(typeof window.laAllowed === 'function' && !window.laAllowed(r.view)) return false;
    applying = true;
    try{
      var cur = current();
      if(r.view === 'booking') applyBookingParams(r.params);
      var same = cur && cur.view === r.view && el.classList.contains('active');
      // same page, only booking params changed → re-render in place, don't reset the page
      if(same && r.view === 'booking' && typeof window.bookingV2Render === 'function') window.bookingV2Render();
      else if(!same) window.nav(el);
    }catch(e){ try{ console.error('[router] go failed:', e); }catch(_){} }
    finally{ applying = false; }
    sync(false);
    return true;
  }

  function onUrl(){
    if(!booted) return;
    var r = parse();
    if(!r) return;                     // a plain #anchor · not ours
    var cur = current();
    if(cur && build(cur) === build(r)) return;
    if(!go(r)) sync(false);            // refused → put the URL back to what's on screen
  }

  /* ── hooks ── */
  function wrapNav(){
    if(typeof window.nav !== 'function' || window.nav.__laRouted) return;
    var orig = window.nav;
    var w = function(el){
      var before = document.querySelector('.nav-item.active');
      // finally · nav() flips .active before it renders, so a render that throws
      // still leaves the user on the new page · the URL must follow either way
      try{ return orig.apply(this, arguments); }
      finally{
        var after = document.querySelector('.nav-item.active');
        if(after !== before || !location.hash) sync(true);
      }
    };
    w.__laRouted = true;
    window.nav = w;
  }

  function wrapBooking(){
    if(typeof window.bookingV2Render !== 'function' || window.bookingV2Render.__laRouted) return;
    var orig = window.bookingV2Render;
    var w = function(){
      try{ return orig.apply(this, arguments); }
      finally{ try{
        var act = document.querySelector('.nav-item.active[data-view="booking"]');
        if(act && !applying){
          var was = parse(), r = current();
          var tabWas = (was && was.view === 'booking') ? (was.params.tab || 'cal') : null;
          var tabNow = (r && r.params.tab) || 'cal';
          write(build(r), tabWas !== tabNow);
        }
      }catch(_){} }
    };
    w.__laRouted = true;
    window.bookingV2Render = w;
  }

  wrapNav();
  wrapBooking();
  window.addEventListener('hashchange', onUrl);
  window.addEventListener('popstate', onUrl);

  /* ── boot · called from _laRestoreView ──
     returns the route the page was opened with (once), or null */
  function takeInitial(){
    var r = parse(initialHash);
    initialHash = '';
    return r;
  }
  function boot(){ if(booted) return; booted = true; sync(false); }

  /* fallback · if _laRestoreView never runs (e.g. auth path changes), still go live */
  setTimeout(function(){
    if(booted) return;
    var r = takeInitial();
    booted = true;
    if(!(r && go(r))) sync(false);
  }, 4000);

  window.laRouter = {
    parse: parse, build: build, current: current, go: go,
    applyBookingParams: applyBookingParams,
    takeInitial: takeInitial, boot: boot, sync: sync
  };
})();
