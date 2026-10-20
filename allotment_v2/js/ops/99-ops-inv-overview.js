/* ════════════════════════════════════════════════════════════════════════
   §opsInvOverview (2026-10-20) · R2-2 · Inventory > Overview tab (05-fleet.js §invOv) on operation-backend
   ────────────────────────────────────────────────────────────────────────
   GET /v1/fleet/stock-overview     warehouses{tublamu,panwa,ranong}, ranked{...}, from, to   → ivoData()
   Legacy ivoData() added up FL_INVENTORY and its history in the browser. In ops the stock list carries no movements, so "received / withdrawn in
   30 days" and "top withdrawals" would read 0 and the pending memos would be matched by free text. The server computes all of it; this adapter maps
   the answer into legacy's shape and the card / ranking / compare / tops / todo drawing (ivoCard, ivoRanked, ivoCompare, ivoTops, ivoTodo) stays legacy:
     ivoData() → { W: { VP, TL, RN }, badLoc: [], noLoc: 0, from, to }   (VP = panwa, TL = tublamu, RN = ranong)
     W[k] = { w, lines, units, value, withQty, zero, below[{id, name, q, mn}], cat{c: {q, v}}, rows[{id, name, partNo, cat, unit, q, cost, v}],
              recQ, recV, wdQ, wdV, wdTop{id: {name, q, v}}, memoN, memoV }
   A miss answers empty figures, asks once, and draws the Inventory page again when the answer lands (flRenderInventory). Opening the Overview tab asks
   again (the answer is also kept 60 s). Warehouses are codes on the server, so there is nothing to fix: ivoFixLoc only tells the user so and never writes.
   Classic script · after 05-fleet.js and the fleet adapters, before 90-ops-boot.js.
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var NAMES = ['ivoData', 'ivoFixLoc', 'invSwitchTab'];
  var orig = {};
  NAMES.forEach(function(n){ orig[n] = window[n]; });
  var TTL = 60000;
  var KEYS = { VP: 'panwa', TL: 'tublamu', RN: 'ranong' };
  var CATS = ['engine', 'gearbox', 'propeller', 'hull', 'general'];
  var st = { raw: null, json: '', at: 0, busy: false };

  function num(v){ var n = Number(v); return Number.isFinite(n) ? n : 0; }
  function viewOn(){ try{ return !!(O.activeView && O.activeView() === 'fl-inventory'); }catch(_){ return false; } }
  function redraw(){
    try{ if(viewOn() && typeof window.flRenderInventory === 'function' && !(O.busy && O.busy())) window.flRenderInventory(); }catch(_){}
  }
  function wrap(name, fn){
    window[name] = function(){
      if(!O.enabled()) return orig[name] ? orig[name].apply(this, arguments) : undefined;
      return fn.apply(this, arguments);
    };
  }
  function whList(){
    var l = window.IVO_WH;
    return Array.isArray(l) && l.length ? l : [{ k: 'VP', loc: 'คลัง Visit Panwa', n: 'Visit Panwa' }, { k: 'TL', loc: 'คลัง Tub Lamu', n: 'Tub Lamu' }, { k: 'RN', loc: 'คลัง Ranong', n: 'Ranong' }];
  }
  function ymd(d){ var p = function(n){ return (n < 10 ? '0' : '') + n; }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
  function today(){ try{ if(typeof window.TODAY_STR !== 'undefined' && window.TODAY_STR) return window.TODAY_STR; }catch(_){} return ymd(new Date()); }

  /* one warehouse of the server's answer → legacy's W[k] */
  function mapWarehouse(w, a, ranked){
    var cat = {};
    CATS.forEach(function(c){ var x = a && a.by_category && a.by_category[c]; if(x && num(x.qty) > 0) cat[c] = { q: num(x.qty), v: num(x.value) }; });
    var top = {};
    ((a && a.top_withdrawn) || []).forEach(function(t){ top[t.item_id] = { name: t.name || '', q: num(t.qty), v: num(t.value) }; });
    var rows = ((ranked && ranked.rows) || []).map(function(r){
      return { id: r.item_id, name: r.name || '', partNo: r.part_no || '', cat: r.category || 'general', unit: r.unit || 'ชิ้น', q: num(r.qty), cost: num(r.cost), v: num(r.value) };
    });
    var rec = (a && a.received) || {}, wd = (a && a.withdrawn) || {}, memo = (a && a.memos_pending) || {};
    return { w: w, lines: num(a && a.lines), units: num(a && a.units), value: num(a && a.value), withQty: num(a && a.with_qty), zero: num(a && a.zero),
      below: ((a && a.below) || []).map(function(b){ return { id: b.item_id, name: b.name || '', q: num(b.qty), mn: num(b.min) }; }),
      cat: cat, rows: rows, recQ: num(rec.qty), recV: num(rec.value), wdQ: num(wd.qty), wdV: num(wd.value), wdTop: top, memoN: num(memo.count), memoV: num(memo.amount) };
  }
  function shape(j){
    var W = {};
    whList().forEach(function(w){
      var key = KEYS[w.k];
      W[w.k] = mapWarehouse(w, j && j.warehouses && j.warehouses[key], j && j.ranked && j.ranked[key]);
    });
    var to = (j && j.to) || today();
    return { W: W, badLoc: [], noLoc: 0, from: (j && j.from) || to, to: to };
  }

  function ask(force){
    if(st.busy || (!force && st.raw && Date.now() - st.at < TTL)) return;
    st.busy = true;
    O.get('/v1/fleet/stock-overview', { sort: 'value' }).then(function(j){
      var json = JSON.stringify(j), changed = json !== st.json;
      st.raw = j; st.json = json; st.at = Date.now(); st.busy = false;
      if(changed) redraw();
    }, function(e){
      st.busy = false; st.at = Date.now(); if(!st.raw) st.raw = {};
      O.fail('The inventory overview did not load', e);
    });
  }

  wrap('ivoData', function(){ ask(false); return shape(st.raw); });
  wrap('ivoFixLoc', function(){ alert('All warehouse names are already standard.'); });
  wrap('invSwitchTab', function(t){
    if(t === 'overview') st.at = 0;   // opening the tab asks again: stock may have moved since
    return orig.invSwitchTab ? orig.invSwitchTab.apply(this, arguments) : undefined;
  });
  O.invOverview = { shape: shape };
})();
