/* ════════════════════════════════════════════════════════════════════════
   §opsPierCashClaims · petty cash claims (ตั้งเบิก) and refund matching on operation-backend
   ────────────────────────────────────────────────────────────────────────
   POST   /v1/pier-cash/{pier}/days/{date}/claims   {name, row_ids}      → {claim, day}
   GET    /v1/pier-cash/{pier}/claims?month=yyyy-mm                      → {claims, totals}
   PATCH  /v1/pier-cash/claims/{id}                 {name}               → {claim}
   DELETE /v1/pier-cash/claims/{id}                                      → {claim, released, day}
   DELETE /v1/pier-cash/claims/{id}/rows/{row_id}                        → {claim, day}
   GET    /v1/pier-cash/{pier}/refund-match[?as_of=yyyy-mm-dd]           → {first_claim_date, units, refunds}

   Legacy kept the claims in the blob (po_cash_claims) and put `claim` on rows it held in the browser, so a
   claim lasted on one device and refund matching saw only the days loaded there. In ops mode:
     · a line's claim comes with the day ledger (46-ops-pier-cash.js legacyRow / applyDay)
     · the month's claims are read here and kept in pcClmArr() (what pcClmOn / pcClmList read)
     · pcClmRows answers from the claim's server lines (the claim's days may not be loaded)
     · pcClmSave / pcClmDel / pcClmRename / pcClmUnline call the server and redraw from its answer
     · pcRefundMatch is built from the server's answer (it reads the pier's whole ledger)
   Legacy alerts are kept; a refused write is shown with alert(message) (the server's 409 texts are legacy's).
   Not wired here: the printed claim form (pcPrintClaim with an id) still uses the browser's rows.
   Legacy mode: every wrapper delegates to the captured original when !enabled().
   Classic script · loads after 46-ops-pier-cash.js, before 90-ops-boot.js.
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O || !O.pierCash) return;
  var enc = encodeURIComponent, L = {};
  ['renderPierCash','pcClmRows','pcClmSave','pcClmDel','pcClmRename','pcClmUnline','pcRefundMatch'].forEach(function(n){ L[n] = window[n]; });
  function on(){ return !!(O.enabled && O.enabled()); }

  var st = { months: {}, pendM: {}, failM: {}, lines: {}, refund: {}, pendR: {}, failR: {}, epoch: 0 };
  function arr(){ return typeof window.pcClmArr === 'function' ? window.pcClmArr() : []; }
  function keep(){ try{ if(typeof window.pcKeep === 'function') window.pcKeep(); else if(typeof window.renderPierCash === 'function') window.renderPierCash(window._pcPier); }catch(_){} }
  function guard(){ return !(typeof window.pcGuard === 'function') || window.pcGuard(); }
  function getClaim(id){ return typeof window.pcClmGet === 'function' ? window.pcClmGet(id) : null; }
  function mapClaim(c){ return { id: c.id, pier: c.pier, date: c.date, name: c.name || '', by: c.created_by || '', ts: c.created_at || '' }; }
  function dropClaim(id){ var a = arr(); for(var i = a.length - 1; i >= 0; i--) if(a[i] && a[i].id === id) a.splice(i, 1); delete st.lines[id]; }
  function putClaim(c){
    var a = arr(), m = mapClaim(c), hit = false;
    a.forEach(function(x, i){ if(x && x.id === c.id){ a[i] = m; hit = true; } });
    if(!hit) a.push(m);
    if(c.lines) st.lines[c.id] = c.lines;
  }

  /* ── the month's claims ─────────────────────────────────────────────── */
  function loadClaims(pier, ym){
    var k = pier + '|' + ym, my = st.epoch;
    st.pendM[k] = true;
    return O.get('/v1/pier-cash/' + enc(pier) + '/claims', { month: ym }).then(function(j){
      delete st.pendM[k];
      if(my !== st.epoch) return false;
      var a = arr();
      for(var i = a.length - 1; i >= 0; i--) if(a[i] && a[i].pier === pier && String(a[i].date || '').slice(0, 7) === ym) a.splice(i, 1);
      ((j && j.claims) || []).forEach(putClaim);
      st.months[k] = true; return true;
    }, function(e){
      delete st.pendM[k]; st.failM[k] = true;
      O.fail('Petty cash claims did not load', e); return false;
    });
  }
  function ensureClaims(){
    var p = window._pcPier, ym = window._pcYM; if(!p || !ym) return;
    var k = p + '|' + ym;
    if(st.months[k] || st.pendM[k] || st.failM[k]) return;
    loadClaims(p, ym).then(function(ok){ if(ok) keep(); });
  }
  window.renderPierCash = function(){
    var r = L.renderPierCash.apply(this, arguments);
    if(on()) ensureClaims();
    return r;
  };
  // every cash write (row, pull, claim) can change a claim's amount or status and every refund match
  O.onWrite(function(){
    st.epoch++; st.months = {}; st.refund = {}; st.failM = {}; st.failR = {};
    if(on() && /^pop-/.test(O.activeView() || '') && window._pcPier && window._pcYM){
      var p = window._pcPier, ym = window._pcYM;
      loadClaims(p, ym).then(function(ok){ if(ok) keep(); });
    }
  });

  window.pcClmRows = function(pier, id){
    if(!on() || !st.lines[id]) return L.pcClmRows.apply(this, arguments);
    var SRC = { longtail: 'lt', park: 'pk', dock: 'dock' };
    return st.lines[id].map(function(l){
      return { ds: l.date, x: { id: l.row_id, txt: l.description || '', amt: +l.amount || 0, at: l.time || '', src: SRC[l.source] || '', claim: id } };
    });
  };

  /* ── writes ─────────────────────────────────────────────────────────── */
  function done(j){
    if(j && j.day && O.pierCash.applyDay) O.pierCash.applyDay(j.day);
  }
  function refused(e, c){
    alert((e && e.message) || 'Not saved');
    if(c && O.pierCash.loadCurrent) return O.pierCash.loadCurrent(c.p, c.d, true).then(keep);
  }

  window.pcClmSave = function(){
    if(!on()) return L.pcClmSave.apply(this, arguments);
    if(!guard() || !window._pcClmForm) return;
    var inp = document.getElementById('pc-clm-name');
    var name = String(inp ? inp.value : (window._pcClmForm.name || '')).replace(/\s+/g, ' ').trim();
    if(!name){ if(inp){ inp.classList.add('bad'); inp.focus(); } return; }
    var D = window.pcDay(window._pcPier, window._pcDate, false); if(!D) return;
    var ids = {}; window.pcClmPick().ok.forEach(function(x){ ids[x.id] = 1; });
    var rows = (D.out || []).filter(function(x){ return x && ids[x.id] && !window.pcClmOn(x); });
    if(!rows.length){ alert('Nothing to claim: the ticked lines are gone or already claimed.'); return; }
    var c = { p: window._pcPier, d: window._pcDate };
    return O.queue(function(){
      return O.post('/v1/pier-cash/' + enc(c.p) + '/days/' + enc(c.d) + '/claims', { name: name, row_ids: rows.map(function(x){ return x.id; }) });
    }).then(function(j){
      done(j);
      if(j && j.claim) putClaim(j.claim);
      window._pcClmForm = null; window._pcSel = {};
      if(j && j.claim && window._pcClmOpen) window._pcClmOpen[j.claim.id] = 1;
      O.wrote('pier'); keep();
    }, function(e){ return refused(e, c); });
  };

  window.pcClmDel = function(id){
    if(!on()) return L.pcClmDel.apply(this, arguments);
    if(!guard()) return;
    var c = getClaim(id); if(!c) return;
    if(!confirm('Remove this claim?\nThe lines stay in the ledger; only the claim is removed.')) return;
    return O.queue(function(){ return O.del('/v1/pier-cash/claims/' + enc(id)); }).then(function(j){
      done(j); dropClaim(id);
      if(window._pcClmOpen) delete window._pcClmOpen[id];
      O.wrote('pier'); keep();
    }, function(e){ return refused(e, { p: window._pcPier, d: window._pcDate }); });
  };

  window.pcClmRename = function(id){
    if(!on()) return L.pcClmRename.apply(this, arguments);
    if(!guard()) return;
    var c = getClaim(id); if(!c) return;
    var v = prompt('Claim name:', c.name || ''); if(v == null) return;
    v = String(v).replace(/\s+/g, ' ').trim(); if(!v || v === c.name) return;
    return O.queue(function(){ return O.patch('/v1/pier-cash/claims/' + enc(id), { name: v }); }).then(function(j){
      if(j && j.claim){ var keepLines = st.lines[id]; putClaim(j.claim); if(!j.claim.lines && keepLines) st.lines[id] = keepLines; }
      O.wrote('pier'); keep();
    }, function(e){ return refused(e, null); });
  };

  window.pcClmUnline = function(id, rowId){
    if(!on()) return L.pcClmUnline.apply(this, arguments);
    if(!guard()) return;
    var c = getClaim(id); if(!c) return;
    return O.queue(function(){ return O.del('/v1/pier-cash/claims/' + enc(id) + '/rows/' + enc(rowId)); }).then(function(j){
      done(j);
      if(j && j.claim) putClaim(j.claim);
      O.wrote('pier'); keep();
    }, function(e){ return refused(e, { p: window._pcPier, d: window._pcDate }); });
  };

  /* ── refund matching ────────────────────────────────────────────────── */
  function emptyMatch(){ return { claim: {}, rem: {}, list: [], res: {}, by: {}, U: {}, keys: [], urem: {}, uby: {}, c0: '' }; }
  function build(a){
    var M = emptyMatch();
    (a.units || []).forEach(function(u){
      M.U[u.key] = { k: u.key, ds: u.date, amt: u.amount, name: u.name || '', cid: u.claim_id || '', ts: u.created_at || '' };
      M.keys.push(u.key);
      M.urem[u.key] = u.left;
      M.uby[u.key] = (u.returned_by || []).map(function(b){ return { ref: b.ref_date, id: b.row_id, amt: b.amount }; });
    });
    (a.refunds || []).forEach(function(r){
      M.res[r.row_id] = { ds: r.date, amt: r.amount, days: (r.days || []).slice(), units: (r.covers || []).map(function(c){ return c.key; }),
        cov: (r.covers || []).map(function(c){ return { k: c.key, ds: c.date, name: c.name || '', amt: c.amount, full: c.full }; }),
        how: r.how, diff: r.diff, exact: r.exact };
    });
    M.keys.forEach(function(k){
      var d = M.U[k].ds;
      if(M.claim[d] == null){ M.claim[d] = 0; M.rem[d] = 0; M.list.push(d); }
      M.claim[d] += M.U[k].amt; M.rem[d] += M.urem[k];
      if(M.uby[k].length) M.by[d] = (M.by[d] || []).concat(M.uby[k]);
    });
    M.c0 = a.first_claim_date || '';
    return M;
  }
  window.pcRefundMatch = function(pier, upto){
    if(!on()) return L.pcRefundMatch.apply(this, arguments);
    var k = pier + '|' + (upto || '');
    if(st.refund[k]) return st.refund[k];
    if(!st.pendR[k] && !st.failR[k]){
      var my = st.epoch; st.pendR[k] = true;
      O.get('/v1/pier-cash/' + enc(pier) + '/refund-match', upto ? { as_of: upto } : undefined).then(function(a){
        delete st.pendR[k];
        if(my !== st.epoch) return;
        st.refund[k] = build(a || {}); keep();
      }, function(e){
        delete st.pendR[k]; st.failR[k] = true;
        O.fail('Refund matching did not load', e);
      });
    }
    return emptyMatch();      // until the server answers; never the browser's partial calculation
  };

  O.pierCashClaims = { state: st };
})();
