/* ══════════════════════════════════════════════════════════════════════════
   §opsFleetKpis (2026-10-18, group F4) · fleet strips, memo rules and the agent contract clock ⇄ operation-backend
   ──────────────────────────────────────────────────────────────────────────
   The figures on top of Maintenance Jobs, Incidents and Inventory, the memo form's part-number rule and the agents'
   contract expiry used to be counted in the browser. They are the server's now (operation-backend
   todo/b3-fleet-agents-importers-model.md):

     GET /v1/fleet/jobs        kpis        flRenderMaint      strip, tab sizes, the "Awaiting Invoice" list (kpis.awaiting_invoice_job_ids)
     GET /v1/fleet/incidents   kpis        flRenderIncident   strip
     GET /v1/fleet/stock-items kpis        flRenderInventory  strip, value per item (item.value), the memo block (kpis.memos)
     POST /v1/fleet/memos      409 part_no_required   memoAddItem's rule: the server's message, then the person picks the part number
     PATCH /v1/fleet/memos     lump discount → discount_amt   moLiveLegacyDisc, moLiveTotals
     GET /v1/agents            contract_days_left / contract_expiring / contract_expired, expiring_count
                                                    ctDaysUntilExpiry, ctIsExpiringSoon, ctIsExpired, ctCountExpiringAgents

   How: the screens' own list reads (ops/24, ops/25, ops/10) hand their `kpis` to O.fleetKpis.put(). A write or a change
   event marks the answer stale; the next draw asks the server again with a filter that matches nothing, so only the
   strip comes back (the strip counts every row whatever filter the list has), and the screen is drawn again if it
   changed. Until the first answer arrives, and offline, legacy's own count is drawn (flKpi returns null).
   Outside ops mode nothing here runs and legacy is untouched.

   Load order: after js/ops/72-ops-pier-days.js (any time after 10, 16, 24, 25). Classic script.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  function enabled(){ return !!(O.enabled && O.enabled()); }

  /* ── the strips ── */
  var NOTHING = {
    jobs:      { path: '/v1/fleet/jobs',        params: { boat_id: '-none-' }, wrapId: 'fl-maint-pink-wrap', draw: 'flRenderMaint' },
    incidents: { path: '/v1/fleet/incidents',   params: { boat_id: '-none-' }, wrapId: 'fl-inc-pink-wrap',   draw: 'flRenderIncident' },
    stock:     { path: '/v1/fleet/stock-items', params: { q: '-none-' },       wrapId: 'fl-inv-pink-wrap',   draw: 'flRenderInventory' }
  };
  var store = {}, stale = {}, asking = {}, gen = 0;

  function put(kind, k){
    if(!NOTHING[kind] || !k || typeof k !== 'object') return;
    store[kind] = k; stale[kind] = false;
  }
  function redraw(kind){
    var d = NOTHING[kind];
    try{ if(!O.busy() && document.getElementById(d.wrapId) && typeof window[d.draw] === 'function') window[d.draw](); }catch(_){}
  }
  function ask(kind){
    if(asking[kind]) return;
    var d = NOTHING[kind], mine = ++gen;
    asking[kind] = mine;
    O.get(d.path, d.params).then(function(r){
      var before = JSON.stringify(store[kind] || null);
      var again = asking[kind] !== mine;
      asking[kind] = 0;
      if(r && r.kpis){ store[kind] = r.kpis; stale[kind] = again; }   // a write since we asked: this answer is already old, ask again on the next draw
      if(JSON.stringify(store[kind] || null) !== before) redraw(kind);
    }).catch(function(e){
      asking[kind] = 0; stale[kind] = 'failed';     // not asked again until the next write; the screen keeps what it has
      try{ console.warn('[ops] ' + d.path + ' kpis · ' + (e && e.message)); }catch(_){}
    });
  }
  /* flKpi(kind) · the server's strip, or null before the first answer (legacy's own count is drawn then) */
  window.flKpi = function(kind){
    if(!enabled() || !NOTHING[kind]) return null;
    if(stale[kind] === true || !store[kind]) ask(kind);
    return store[kind] || null;
  };
  function markStale(){ Object.keys(NOTHING).forEach(function(k){ if(store[k]) stale[k] = true; }); asking = {}; }
  O.onWrite(markStale);
  O.onChange(markStale);
  O.fleetKpis = { put: put, get: function(k){ return store[k] || null; }, ask: ask };

  /* ── memoAddItem · 409 part_no_required ──
     Legacy stops in the add-line form when a name is in stock under several part numbers (its own list). The server
     has the same rule on save, for a line that reached it without a part number. Its text is shown as it is, then
     the line goes back to the add-line row with the picker open, so the person chooses the part number by hand. */
  window.flMemoPartNoPick = function(err){
    var msg = (err && err.message) || '';
    try{ alert(msg); }catch(_){}
    try{
      var ids = (err && err.body && err.body.item_ids) || [];
      var inv = (typeof FL_INVENTORY !== 'undefined' && Array.isArray(FL_INVENTORY)) ? FL_INVENTORY : [];
      var names = ids.map(function(id){ var it = inv.find(function(x){ return x && x.id === id; }); return it ? it.name : null; }).filter(Boolean);
      var quoted = /"([^"]+)"/.exec(msg); if(quoted) names.push(quoted[1]);
      if(typeof _memoItems === 'undefined' || !Array.isArray(_memoItems)) return;
      var i = _memoItems.findIndex(function(l){ return l && !l.invId && names.indexOf(l.name) >= 0; });
      if(i < 0) return;
      var line = _memoItems.splice(i, 1)[0];
      var set = function(id, v){ var el = document.getElementById(id); if(el) el.value = v; };
      set('memo-new-name', line.name); set('memo-new-qty', line.qty); set('memo-new-price', line.price);
      if(typeof memoRenderItems === 'function') memoRenderItems();
      if(typeof memoSearchInv === 'function') memoSearchInv(line.name);
      var nm = document.getElementById('memo-new-name'); if(nm && nm.focus) nm.focus();
    }catch(e){ try{ console.warn('[ops] part_no_required · ' + e.message); }catch(_){} }
  };

  /* ── moLiveLegacyDisc / moLiveTotals · the memo's lump discount ──
     An old memo that kept only a lump `discount` has it as the fixed `discount_amt` on the server (the importer
     sets it; the first edit does too), so the browser must not add it again. A memo read from the server shows the
     server's stored totals as long as its lines are the ones the server holds; typing in the live editor changes the
     lines and then legacy's formula previews the new totals until Save, when the server's come back. */
  function wrapGlobal(name, fn){
    var orig = window[name];
    if(typeof orig !== 'function' || orig.__opsF4) return;
    var w = function(){
      if(!enabled()) return orig.apply(this, arguments);
      return fn.apply(this, [orig].concat([].slice.call(arguments)));
    };
    w.__opsF4 = true;
    window[name] = w;
  }
  wrapGlobal('moLiveLegacyDisc', function(orig, mo){
    if(mo && mo._fromOpsBackend) return 0;
    return orig(mo);
  });
  function sameLines(mo, items){
    var a = mo.items || [], b = items || [];
    if(a.length !== b.length) return false;
    for(var i = 0; i < a.length; i++){
      if(a[i].name !== b[i].name || +a[i].qty !== +b[i].qty || +a[i].price !== +b[i].price || (+a[i].discountPct || 0) !== (+b[i].discountPct || 0)) return false;
    }
    return true;
  }
  wrapGlobal('moLiveTotals', function(orig, mo, items){
    if(mo && mo._fromOpsBackend && mo.amount != null && sameLines(mo, items)){
      var vatEnabled = mo.vatEnabled !== false;
      return { sub: +mo.subtotal || 0, discTotal: +mo.discount || 0, afterDisc: +mo.afterDiscount || 0, vat: +mo.vat || 0,
               vatRate: vatEnabled ? (mo.vatRate != null ? mo.vatRate : 7) : 0, vatEnabled: vatEnabled, legacy: 0, total: +mo.amount || 0 };
    }
    return orig(mo, items);
  });

  /* ── the agents' contract clock ── */
  var expiringCount = null;
  O.contractClock = { put: function(n){ expiringCount = (typeof n === 'number') ? n : null; }, get: function(){ return expiringCount; } };
  O.onWrite(function(){ expiringCount = null; });
  function served(a){ return a && a.contractDaysLeft !== undefined; }
  wrapGlobal('ctDaysUntilExpiry', function(orig, a){ return served(a) ? a.contractDaysLeft : orig(a); });
  wrapGlobal('ctIsExpiringSoon', function(orig, a, t){
    // the server's window is 0..60 days; a caller with its own threshold keeps legacy's arithmetic on the server's day count
    if(served(a) && (t === undefined || t === 60)) return !!a.contractExpiring;
    return orig.apply(this, [a].concat(t === undefined ? [] : [t]));
  });
  wrapGlobal('ctIsExpired', function(orig, a){ return served(a) ? !!a.contractExpired : orig(a); });
  wrapGlobal('ctCountExpiringAgents', function(orig){
    var rows = (typeof SB_AGENTS !== 'undefined' && Array.isArray(SB_AGENTS)) ? SB_AGENTS : [];
    if(rows.length && rows.every(served)) return rows.filter(function(a){ return a.contractExpiring || a.contractExpired; }).length;
    return expiringCount != null ? expiringCount : orig();
  });
  O.onChange(function(c){ if(c && /agent|contract/.test(String(c.entity_type || ''))) expiringCount = null; });

  /* ── duplicate scan · laDupScan, laDupKind (GET /v1/fleet/duplicates) ──
     The counts in the cost bar and drawer for the three sets the server holds (job, memo, incident) and for the
     "same number" lists are the server's: copies (same document made twice) and numbers (different documents, one
     number, with the server's kind: same / stage / real). Sets the server does not hold (engines, boats, bookings,
     nested lists) keep legacy's scan. */
  var dups = null, dupStale = true, dupAsking = false;
  var DUP_COPY = { maint: 'job', memo: 'memo', incident: 'incident' };
  var DUP_NUM = { noMaint: 'job', noMemo: 'memo', noInc: 'incident' };
  function dupRead(){
    if(!enabled()) return null;
    if(dupStale && !dupAsking){
      dupAsking = true; dupStale = false;
      O.get('/v1/fleet/duplicates').then(function(d){
        var changed = JSON.stringify(dups) !== JSON.stringify(d);
        dups = d; dupAsking = false;
        if(changed && !O.busy() && typeof window.flRenderCostAnalytics === 'function' && document.getElementById('fl-cost-wrap')){ try{ window.flRenderCostAnalytics(); }catch(_){} }
      }).catch(function(e){ dupAsking = false; dupStale = false; try{ console.warn('[ops] duplicates · ' + (e && e.message)); }catch(_){} });
    }
    return dups;
  }
  O.onWrite(function(){ dupStale = true; });
  O.onChange(function(){ dupStale = true; });
  function byKind(list, kind){ return (list || []).find(function(x){ return x && x.kind === kind; }); }
  wrapGlobal('laDupScan', function(orig){
    var out = orig(), d = dupRead();
    if(!d) return out;
    out.sets.forEach(function(S){
      var c = DUP_COPY[S.k] && byKind(d.copies, DUP_COPY[S.k]); if(!c) return;
      var groups = (c.groups || []).map(function(g){ return { name: g.name, keepId: g.keep_id, drop: (g.drop_ids || []).length, ids: (g.drop_ids || []).slice() }; });
      var extra = groups.reduce(function(a, g){ return a + g.drop; }, 0);
      out.nDup += extra - S.extra; if(S.money) out.nMoney += extra - S.extra;
      S.extra = extra; S.groups = groups.slice(0, 40); if(typeof c.total === 'number') S.total = c.total;
    });
    out.nums.forEach(function(U){
      var n = DUP_NUM[U.k] && byKind(d.numbers, DUP_NUM[U.k]); if(!n) return;
      var groups = (n.groups || []).map(function(g){ return { name: g.no, drop: (g.members || []).length - 1 }; });
      var extra = groups.reduce(function(a, g){ return a + g.drop; }, 0);
      out.nNo += extra - U.extra;
      U.extra = extra; U.groups = groups.slice(0, 40); if(typeof n.total === 'number') U.total = n.total;
    });
    return out;
  });
  /* laDupKind(group): the group's kind (same / stage / real) and the fields that differ are the server's when it lists
     this very group (same document ids); otherwise legacy's comparison. */
  wrapGlobal('laDupKind', function(orig, group){
    var d = dupRead();
    if(d && group && group.length > 1){
      var ids = group.map(function(x){ return x && x.id; }).sort().join('|');
      var hit = null;
      (d.numbers || []).forEach(function(n){ (n.groups || []).forEach(function(g){
        if((g.members || []).map(function(m){ return m.id; }).sort().join('|') === ids) hit = g;
      }); });
      if(hit) return { kind: hit.kind, diff: (hit.diff || []).slice() };
    }
    return orig(group);
  });

  O.fleetKpisReady = true;
})();
