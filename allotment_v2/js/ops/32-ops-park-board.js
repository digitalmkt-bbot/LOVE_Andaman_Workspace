/* ════════════════════════════════════════════════════════════════════════
   §opsParkBoard (2026-10-30) · Ticket Management's shared scratch board (lk-inbox §pkBoardShare, 2026-10-29)
   ────────────────────────────────────────────────────────────────────────
   GET  /v1/pier-office/park-board/{date}   → {date, text, updated_at, updated_by}
   PUT  /v1/pier-office/park-board/{date}   {text}   (empty text removes it; who and when are the server's)
   Legacy keeps the board in PIER_CFG.parkBoard[date] = {v, by, at} and saves it with poPersist(), which in ops mode does
   not send it, so every board stayed on one device. Here:
     · pkbGet: the day's board comes from the server (loaded once per day, then the open board is drawn again). Legacy's
       "move the device's own copy up" runs only once the server has answered that it has none, never before.
     · pkbPut: the typed sheet goes to the server 1 s after typing stops (0.2 s for the one-off move up); the device copy
       in localStorage stays as legacy's fallback. A refusal is a red toast; the text stays in the box.
     · pkbRec / pkbWho are legacy's: they read PIER_CFG.parkBoard[date], which only the server's answers fill.
   Classic script · after 32-ops-park.js, before 90-ops-boot.js.
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var L = { pkbGet: window.pkbGet, pkbPut: window.pkbPut };
  var loaded = {}, loading = {}, typed = {}, timer = 0, sending = null;

  function enabled(){ return !!(O.enabled && O.enabled()); }
  function day(){ return (typeof _poDate !== 'undefined' && _poDate) || ''; }
  function url(d){ return '/v1/pier-office/park-board/' + encodeURIComponent(d); }
  function localKey(d){ return 'la_pk_board_' + d; }
  function local(d){ try{ return localStorage.getItem(localKey(d)) || ''; }catch(_){ return ''; } }
  function keepLocal(d, v){ try{ if(v) localStorage.setItem(localKey(d), v); else localStorage.removeItem(localKey(d)); }catch(_){} }
  function boards(){
    if(typeof PIER_CFG === 'undefined' || !PIER_CFG) return {};
    if(!PIER_CFG.parkBoard || typeof PIER_CFG.parkBoard !== 'object') PIER_CFG.parkBoard = {};
    return PIER_CFG.parkBoard;
  }
  /* the server's answer → legacy's record. After a save the text is what was typed last (more may have been typed while
     it was out); who and when are the server's. */
  function apply(res){
    if(!res || !res.date) return;
    var M = boards(), v = typed[res.date] != null ? typed[res.date] : String(res.text || '');
    if(v) M[res.date] = { v: v, by: res.updated_by || '', at: res.updated_at || '' };
    else delete M[res.date];
  }
  function typing(){ var a = document.activeElement; return !!(a && a.classList && a.classList.contains('pkb-ta')); }
  function load(d){
    if(loading[d]) return loading[d];
    loading[d] = O.get(url(d)).then(function(res){
      apply(res); loaded[d] = true;
      if(!(res && res.text) && local(d)) send(d, local(d), 200);   // legacy's one-off move up, now that the server said it has none
      else if(day() === d && !typing() && typeof window.renderPierPark === 'function') window.renderPierPark();
    }, function(e){ O.fail('Scratch board not loaded', e); })
      .finally(function(){ delete loading[d]; });
    return loading[d];
  }
  function send(d, v, wait){
    clearTimeout(timer);
    timer = setTimeout(function(){
      var text = String(v || '');
      sending = O.queue(function(){ return O.call('PUT', url(d), { text: text }); }).then(apply, function(e){ O.fail('Scratch board not saved', e); });
    }, wait);
  }

  window.pkbGet = function(){
    if(!enabled()) return L.pkbGet ? L.pkbGet.apply(this, arguments) : '';
    var d = day(); if(!d) return '';
    if(typed[d] != null) return typed[d];
    var r = boards()[d];
    if(r && typeof r === 'object') return String(r.v || '');
    if(!loaded[d]) load(d);
    return local(d);   // until the server answers: this device's copy, shown but not sent
  };
  window.pkbPut = function(v, migrate){
    if(!enabled()) return L.pkbPut ? L.pkbPut.apply(this, arguments) : undefined;
    var d = day(); if(!d) return;
    typed[d] = String(v || '');
    keepLocal(d, v);
    send(d, v, migrate ? 200 : 1000);
  };

  O.parkBoard = { load: function(d){ delete loaded[d]; return load(d); }, flush: function(){ return sending; } };
})();
