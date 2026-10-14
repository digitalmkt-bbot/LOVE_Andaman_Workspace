/* ══════════════════════════════════════════════════════════════════════════
   §opsGuideOrders (2026-10-15) · ใบสั่งงานมัคคุเทศก์ ⇄ operation-backend
   ──────────────────────────────────────────────────────────────────────────
   Legacy kept three blob keys per browser: go_asn (who is on which boat), go_no (the order numbers) and
   go_cfg (next number, signers, letterhead). Two staff could print the same number. Now:

   GET  /v1/guide-orders?date=                the day's saved orders (legacy: every boat of the day)
   PUT  /v1/guide-orders/{date}/{boat_id}     { guide_ids, other_count, signer_index } · the whole record
   POST /v1/guide-orders/{date}/{boat_id}/issue   the order number · once per boat per day, a reprint
                                              answers the same one · the client never picks or counts
   GET|PUT /v1/guide-orders/settings          { next_no, signers, head }

   The legacy readers (goAsn, goCfg, goNoFor, pjGdBusy) are synchronous; they read the cache this file fills.
   Numbering moved OUT of the print renderer: goPrint asks for the numbers first (goPrintIds / goPrintAsk /
   goPrintOpen in 08-app.js), one POST .../issue per boat, and only then draws the sheets.
   The guide register (the "guides" key) is the config store's (ops/61).

   Off unless laOps.enabled() and the login is not an agent's (the server answers an agent 403, even on reads).
   Load order: after ops/61-ops-config-store.js, before ops/90-ops-boot.js. Classic script.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O || !O.configStore) return;
  var CS = O.configStore;
  var TTL = 30000;                  // a day read this long ago is read again in the background
  var WAIT = 600;                   // typing in the signer / next-number fields saves once it pauses
  function active(){ return CS.active(); }
  function noop(){}
  function enc(s){ return encodeURIComponent(String(s)); }
  function orderPath(date, bid){ return '/v1/guide-orders/' + enc(date) + '/' + enc(bid); }
  function repaint(){
    var reg = document.querySelector('#acct-modal .go-reg');
    if(reg && typeof window.goRegOpen === 'function'){ try{ window.goRegOpen(); }catch(_){} return; }
    CS.redraw();
  }

  /* ── the days: orders by boat ── */
  var days = {};                    // date -> { cell, orders:{boat_id: view}, at, seq:{boat_id: n}, refreshing }
  function dayOf(date){
    date = String(date || '');
    var d = days[date]; if(d) return d;
    d = days[date] = { orders: {}, at: 0, seq: {}, refreshing: false };
    d.cell = CS.cell('Guide orders', function(){
      return O.get('/v1/guide-orders', { date: date }).then(function(r){
        var m = {}; ((r && r.orders) || []).forEach(function(v){ m[v.boat_id] = v; });
        d.orders = m; d.at = Date.now();
      });
    });
    return d;
  }
  /* a day served from the cache for a while is read again; redraw only if somebody changed it */
  function refreshDay(date){
    var d = dayOf(date);
    if(d.refreshing || !d.cell.loaded || Date.now() - d.at < TTL) return;
    d.refreshing = true;
    var before = JSON.stringify(d.orders);
    O.get('/v1/guide-orders', { date: String(date) }).then(function(r){
      var m = {}; ((r && r.orders) || []).forEach(function(v){ m[v.boat_id] = v; });
      d.at = Date.now(); d.refreshing = false;
      if(JSON.stringify(m) !== before && !d.pending){ d.orders = m; CS.redraw(); }
    }, function(){ d.refreshing = false; d.at = Date.now(); });
  }
  var BLANK = function(){ return { g: [], other: 0, sign: 0 }; };
  function asnOf(v){
    return v ? { g: (v.guide_ids || []).slice(), other: +v.other_count || 0, sign: +v.signer_index || 0 } : BLANK();
  }
  function numberOf(date, bid){ var v = dayOf(date).orders[bid]; return (v && v.order_no) || null; }

  /* ── the settings: next number, signers, letterhead ── */
  var set = { value: null, snap: null, seq: 0, timer: null };
  function setFrom(s){ return { next: s.next_no, signers: O.clone(s.signers), head: O.clone(s.head) }; }
  set.cell = CS.cell('Guide order settings', function(){
    return O.get('/v1/guide-orders/settings').then(function(s){
      if(set.snap){ set.snap = setFrom(s); return; }               // an unsaved edit stays; only what is saved is renewed
      set.value = setFrom(s); set.seq++;
    });
  });
  function setRead(){
    if(set.cell.loaded) return O.clone(set.value);
    set.cell.miss(); return null;
  }
  function setWrite(c){
    if(!set.cell.loaded){ O.fail('Guide order settings not saved', new Error('The settings are still loading, try again')); return; }
    c = c || {};
    if(!set.snap) set.snap = O.clone(set.value);
    set.value = { next: Math.max(1, parseInt(c.next, 10) || 1), signers: O.clone(c.signers || []), head: O.clone(c.head || set.value.head) };
    set.seq++;
    clearTimeout(set.timer); set.timer = setTimeout(setFlush, WAIT);
  }
  function setFlush(){
    clearTimeout(set.timer); set.timer = null;
    if(!set.snap) return Promise.resolve();
    return O.queue(function(){
      if(!set.snap) return null;
      var mine = set.seq, body = {};
      if(set.value.next !== set.snap.next) body.next_no = set.value.next;
      if(JSON.stringify(set.value.signers) !== JSON.stringify(set.snap.signers)) body.signers = set.value.signers;
      if(JSON.stringify(set.value.head) !== JSON.stringify(set.snap.head)) body.head = set.value.head;
      if(!Object.keys(body).length){ set.snap = null; return null; }
      return O.call('PUT', '/v1/guide-orders/settings', body).then(function(s){
        if(set.seq === mine){ set.value = setFrom(s); set.snap = null; }
        else set.snap = setFrom(s);                              // typed on since: its own save follows
      });
    }).then(noop, function(err){
      clearTimeout(set.timer); set.timer = null;
      if(set.snap){ set.value = set.snap; set.snap = null; set.seq++; }
      // 409 number_used and the 400 on removing the last signer: the server's own words, as they are
      O.fail('Guide order settings not saved', err); repaint();
    });
  }

  /* ── an order: save ── */
  function asnSet(orig, date, bid, o){
    if(!date || !bid){ O.fail('Guide order not saved', new Error('No date or boat')); return; }
    var d = dayOf(date);
    if(!d.cell.loaded){ O.fail('Guide order not saved', new Error('The day is still loading, try again')); return; }
    o = o || {};
    var prev = d.orders[bid];
    var body = { guide_ids: (o.g || []).slice(), other_count: Math.max(0, +o.other || 0), signer_index: Math.max(0, +o.sign || 0) };
    var mine = d.seq[bid] = (d.seq[bid] || 0) + 1;
    d.pending = (d.pending || 0) + 1;
    d.orders[bid] = Object.assign({ date: date, boat_id: bid, order_no: null }, prev || {},
      { guide_ids: body.guide_ids, other_count: body.other_count, signer_index: body.signer_index, recorded: true });
    // order_no is never sent: it is the server's (POST .../issue)
    return O.queue(function(){ return O.call('PUT', orderPath(date, bid), body); }).then(function(v){
      d.pending--; if(d.seq[bid] === mine) d.orders[bid] = v;
    }, function(e){
      d.pending--;
      if(d.seq[bid] === mine){ if(prev) d.orders[bid] = prev; else delete d.orders[bid]; }
      O.fail('Guide order not saved', e); repaint();
    });
  }

  /* ── the number: asked for before printing, never counted here ── */
  function issueOne(date, bid){
    var d = dayOf(date);
    return O.queue(function(){
      var cur = d.orders[bid]; if(cur && cur.order_no) return cur;                 // an earlier issue in this queue got it
      return O.post(orderPath(date, bid) + '/issue');
    }).then(function(v){ d.orders[bid] = v; return v; });
  }
  function issueAll(date, ids){
    return ids.reduce(function(p, bid){ return p.then(function(){ return issueOne(date, bid); }); }, Promise.resolve())
      .then(function(){ return set.cell.load(true).catch(noop); });                // the counter moved: read it again
  }

  /* anything the legacy screen reads that is not here yet: the promise for it, or null when all is here */
  function ready(date){
    var cells = [CS.H.guides.cell, set.cell, dayOf(date).cell].filter(function(c){ return !c.loaded; });
    return cells.length ? Promise.all(cells.map(function(c){ return c.load(); })) : null;
  }
  /* run a legacy screen function once its data is here, on the date it was asked for */
  function afterReady(name, dateOf){
    wrap(name, function(orig){
      var self = this, args = [].slice.call(arguments, 1), date = dateOf();
      var wait = ready(date);
      if(!wait) return orig.apply(self, args);
      return wait.then(function(){
        var keep = window._pckDate; window._pckDate = date;
        try{ return orig.apply(self, args); } finally { window._pckDate = keep; }
      }, function(e){ O.fail('Guide orders did not load', e); });
    });
  }

  /* goPrint with the numbers fetched first. A window is opened at once when the print has to wait on the
     server, so the browser still counts it as the click's own and does not block the pop-up. */
  function printOps(orig, bid){
    var date = window._pckDate, ids = window.goPrintIds(bid, date);
    if(!ids.length) return orig.call(this, bid);                                   // legacy's "no boat yet" alert
    var pre = null;
    function closePre(){ try{ if(pre) pre.close(); }catch(_){} }
    var wait = ready(date);
    if(wait) pre = window.open('', '_blank');
    return Promise.resolve(wait).then(function(){
      if(!window.goPrintAsk(date, ids)){ closePre(); return; }
      var todo = ids.filter(function(k){ return !numberOf(date, k); });
      if(!todo.length) return window.goPrintOpen(bid, date, ids, pre);
      if(!pre) pre = window.open('', '_blank');
      return issueAll(date, todo).then(function(){ return window.goPrintOpen(bid, date, ids, pre); }, function(e){
        closePre(); O.fail('Order numbers were not issued, nothing printed', e);
      });
    }, function(e){ closePre(); O.fail('Guide orders did not load', e); });
  }

  /* ── wiring ── */
  function wrap(name, fn){
    var orig = window[name]; if(typeof orig !== 'function') return;
    window[name] = function(){
      if(!active()) return orig.apply(this, arguments);
      return fn.apply(this, [orig].concat([].slice.call(arguments)));
    };
  }
  wrap('goAsn', function(orig, date, bid){
    if(!date) return BLANK();
    var d = dayOf(date);
    if(!d.cell.loaded){ d.cell.miss(); return BLANK(); }
    refreshDay(date);
    return asnOf(d.orders[bid]);
  });
  wrap('goAsnSet', asnSet);
  wrap('goNoFor', function(orig, date, bid){ return numberOf(date, bid); });       // the number is the server's: asked for, never made here
  wrap('goPrint', printOps);
  wrap('pjGdBusy', function(orig, date){
    if(date){ var d = dayOf(date); if(!d.cell.loaded) d.cell.miss(); else refreshDay(date); }
    return orig.apply(this, [].slice.call(arguments, 1));
  });
  afterReady('goSetupOpen', function(){ return window._pckDate; });
  afterReady('goRegOpen', function(){ return window._pckDate; });
  afterReady('pckGuideJobOrder', function(){ return window._pckDate; });

  /* the blob keys, for ctRead / ctWrite callers that go through them */
  function noWrite(what){ return function(){ O.fail(what + ' not saved', new Error('This setting is saved by the guide order screen')); }; }
  CS.H.go_cfg = { read: setRead, write: setWrite, cell: set.cell };
  CS.H.go_asn = {
    read: function(){
      var m = {};
      Object.keys(days).forEach(function(date){
        var d = days[date]; if(!d.cell.loaded) return;
        Object.keys(d.orders).forEach(function(bid){ if(d.orders[bid].recorded) m[date + '|' + bid] = asnOf(d.orders[bid]); });
      });
      return m;
    },
    write: noWrite('Guide order'), cell: set.cell,
  };
  CS.H.go_no = {
    read: function(){
      var m = {};
      Object.keys(days).forEach(function(date){
        var d = days[date]; if(!d.cell.loaded) return;
        Object.keys(d.orders).forEach(function(bid){ if(d.orders[bid].order_no) m[date + '|' + bid] = d.orders[bid].order_no; });
      });
      return m;
    },
    write: noWrite('Order number'), cell: set.cell,
  };

  if(active()) set.cell.load().catch(function(e){ O.fail('Guide order settings did not load', e); });

  window.laOps.guideOrders = { days: days, set: set, ready: ready, issueAll: issueAll, flushSettings: setFlush, orderPath: orderPath };
})();
