/* ══════════════════════════════════════════════════════════════════════════
   §opsFleetW5 (w5-b, 2026-10-18) · what the Fleet screens still decided in the browser ⇄ operation-backend
   ──────────────────────────────────────────────────────────────────────────
   Wiring recheck rows (operation-backend docs/verify/wire2/wire-03.md and wire-04.md), fleet part. One wrapper per legacy function;
   legacy runs outside operation mode, until the server's answer is in hand, and when a read fails.

     flMemoWarehouse    ← GET /v1/fleet/memos/{id} default_warehouse {warehouse, why}   (the receive dialog's warehouse and its line)
     flDeleteEngine     ← DELETE /v1/fleet/engines/{id}  (409 has_history: the server's message, in legacy's alert)
     faDocAlertCount    ← GET /v1/fleet/certificates counts (exp + warn30)             the Documents tab badge
     faDocData          ← the same counts for the stage tiles (ok, 90 days, 30 days, renewing, expired)
     flGuessDocType     ← doc_type the server gave the document (by name)
     flDocBetter        ← `current` the server gave the document
     _flBuildInspectionSection ← the safety item's `state` (REPLACED, MISSING, EXPIRED, DUE <= 30, SOON <= 90, OK, OK_NO_PM)
     _swapDocStep3      ← next_no of GET /v1/fleet/incidents and /jobs (the numbers the wizard will use)

   Nothing here works a figure out. Classic script, after js/ops/76-ops-fleet-kpis.js and 22/24/25/26.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  function enabled(){ return !!(O.enabled && O.enabled()); }
  function enc(v){ return encodeURIComponent(v == null ? '' : String(v)); }

  function wrap(name, fn){
    var orig = window[name];
    if(typeof orig !== 'function' || orig.__w5b) return;
    var w = function(){
      if(!enabled()) return orig.apply(this, arguments);
      return fn.apply(this, [orig].concat([].slice.call(arguments)));
    };
    w.__w5b = true; w.__orig = orig; window[name] = w;
  }

  /* ── the receive dialog's warehouse: the server's default_warehouse of the memo ─────────────────────────────
     flOpenReceiveMemo asks the single-memo read first (it carries default_warehouse) and then opens the dialog; flMemoWarehouse
     answers from it. The server reads the pier of the memo's boat TODAY (assignment, status entry, home pier); a boat a started
     job holds at a shop is at no pier, and the answer says why. */
  var WH_LABEL = { tublamu: 'คลัง Tub Lamu', panwa: 'คลัง Visit Panwa', ranong: 'คลัง Ranong' };
  var dwh = {};
  O.onWrite(function(){ dwh = {}; });
  wrap('flOpenReceiveMemo', function(orig, moId){
    var self = this;
    return O.get('/v1/fleet/memos/' + enc(moId)).then(function(m){
      if(m && m.default_warehouse) dwh[moId] = m.default_warehouse;
    }, function(){}).then(function(){ return orig.call(self, moId); });
  });
  wrap('flMemoWarehouse', function(orig, mo){
    var d = mo && dwh[mo.id];
    if(!d || !d.warehouse) return orig.apply(this, [].slice.call(arguments, 1));
    return { wh: WH_LABEL[d.warehouse] || d.warehouse, why: d.why || '' };
  });

  /* ── Delete engine: the server decides whether it has history ───────────────────────────────────────────────
     Legacy looked through the browser's own arrays (flEngRefs) and, with none, removed the engine from FL_ENGINES; the server
     was never asked, so the engine came back after a reload. Now: legacy's confirm, then DELETE. A 409 has_history is the
     server's message (it names what refers to the engine) in legacy's alert; nothing is removed on screen. */
  wrap('flDeleteEngine', function(orig){
    var id = (typeof flEditEngId !== 'undefined') ? flEditEngId : null;
    var e = id && typeof window.flGetEng === 'function' ? window.flGetEng(id) : null;
    if(!e) return null;
    if(!confirm('Delete engine ' + e.serial + ' (' + (e.model || '') + ')? This cannot be undone.')) return null;
    return O.queue(function(){ return O.del('/v1/fleet/engines/' + enc(e.id)); }).then(function(){
      return O.fleetAssets && O.fleetAssets.refetchChain ? O.fleetAssets.refetchChain() : null;
    }).then(function(){
      if(typeof flSelEngId !== 'undefined' && flSelEngId === e.id) flSelEngId = null;
      flEditEngId = null;
      O.wrote('fleet-engine-delete');
      if(typeof window.closeModal === 'function') window.closeModal('fl-modal-engine');
      if(typeof window.flRenderEngList === 'function') window.flRenderEngList();
      if(typeof window.flRenderEngDetailPink === 'function') window.flRenderEngDetailPink();
      return null;
    }).catch(function(err){
      if(err && err.status === 409) alert(err.message);
      else O.fail('Could not delete the engine', err);
      return null;
    });
  });

  /* ── Documents: the matrix the server worked out (GET /v1/fleet/certificates) ───────────────────────────────
     counts {ok, warn90, warn30, exp, processing, na}: `na` counts a type nobody filled in as well as a document with no expiry
     date; legacy's tiles count only documents that exist, so the "no date" ones are the matrix cells that hold a document with
     status na. The tab badge is exp + warn30, as legacy. */
  /* the matrix is read again after a write (the tiles must not count an old answer next to rows that changed): until the new one
     lands, legacy's count over the statuses already on the documents is drawn */
  var certObj = null, certAt = 0, wroteAt = 0, certBusy = false;
  O.onWrite(function(){ wroteAt = Date.now(); });
  function matrix(){
    var c = O.fleetBoats && O.fleetBoats.certificates ? O.fleetBoats.certificates() : null;
    if(!(c && c.counts && Array.isArray(c.boats))) return null;
    certAt = O.fleetBoats.certificatesAt ? O.fleetBoats.certificatesAt() : (c !== certObj ? Date.now() : certAt);
    certObj = c;
    if(wroteAt > certAt){
      if(!certBusy && O.fleetBoats.refreshCertificates){
        certBusy = true;
        O.fleetBoats.refreshCertificates().then(function(){ certBusy = false; try{ if(document.getElementById('fl-docs-pink-wrap') && !O.busy() && typeof window.faRenderDocs === 'function') window.faRenderDocs(); }catch(_){} },
          function(){ certBusy = false; wroteAt = 0; });
      }
      return null;
    }
    return c;
  }
  function noDate(c){
    var n = 0;
    c.boats.forEach(function(b){ Object.keys(b.cells || {}).forEach(function(k){ var x = b.cells[k]; if(x && x.status === 'na') n++; }); });
    return n;
  }
  wrap('faDocAlertCount', function(orig){
    var c = matrix();
    return c ? (+c.counts.exp || 0) + (+c.counts.warn30 || 0) : orig.apply(this, [].slice.call(arguments, 1));
  });
  wrap('faDocData', function(orig){
    var D = orig.apply(this, [].slice.call(arguments, 1)), c = matrix();
    if(!c || !D || !D.c) return D;
    var K = c.counts, nd = noDate(c);
    D.c = { ok: +K.ok || 0, w90: +K.warn90 || 0, w30: +K.warn30 || 0, proc: +K.processing || 0, exp: (+K.exp || 0) + nd };
    D.c.all = D.c.ok + D.c.w90 + D.c.w30 + D.c.proc + D.c.exp;
    return D;
  });

  /* the type and the "current copy" of a document are the server's (documents carry docType and current once the matrix
     or a boat read has been made); legacy's name guess and copy comparison run for a document that has neither */
  var typeOf = null, typeSig = '';
  function typeMap(){
    var B = (typeof BOATS !== 'undefined' && Array.isArray(BOATS)) ? BOATS : [], n = 0;
    B.forEach(function(b){ n += (b && b.docs ? b.docs.length : 0) + 1; });
    var sig = B.length + ':' + n;
    if(typeOf && sig === typeSig) return typeOf;
    typeOf = {}; typeSig = sig;
    B.forEach(function(b){ ((b && b.docs) || []).forEach(function(d){ if(d && d.name && d.docType && !(d.name in typeOf)) typeOf[d.name] = d.docType; }); });
    return typeOf;
  }
  wrap('flGuessDocType', function(orig, name){
    var t = typeMap()[String(name == null ? '' : name)];
    if(t) return t === 'other' ? null : t;
    return orig.apply(this, [].slice.call(arguments, 1));
  });
  wrap('flDocBetter', function(orig, existing, doc){
    if(doc && typeof doc === 'object' && doc.docType && typeof doc.current === 'boolean' && doc.docType !== 'other') return doc.current;
    return orig.apply(this, [].slice.call(arguments, 1));
  });

  /* ── a safety item's inspection strip: the label, its colours and "Nd left" come from the server's state ─────
     Legacy counted from nextPM alone (30 / 90 day steps); the server's state is the nearer of the expiry and the next PM.
     The strip keeps legacy's words (OVERDUE · Nd ago / DUE / SOON / OK / Not scheduled). */
  wrap('_flBuildInspectionSection', function(orig, it){
    var html = orig.apply(this, [].slice.call(arguments, 1)), st = it && it.state;
    if(!st || !st.label) return html;
    var d = st.days, abs = Math.abs(d == null ? 0 : d), lbl, fg, bg;
    switch(st.label){
      case 'EXPIRED': lbl = 'OVERDUE · ' + abs + 'd ago'; fg = '#A32D2D'; bg = '#FCEBEB'; break;
      case 'DUE': lbl = 'DUE · ' + abs + 'd left'; fg = '#854F0B'; bg = '#FFF5EB'; break;
      case 'SOON': lbl = 'SOON · ' + abs + 'd left'; fg = '#854F0B'; bg = '#FFFAF5'; break;
      case 'OK': lbl = 'OK · ' + abs + 'd left'; fg = '#0F6E56'; bg = '#E1F5EE'; break;
      default: lbl = 'Not scheduled'; fg = '#999'; bg = '#fafaf8';
    }
    return html.replace(/(<div style="background:)(#[0-9A-Fa-f]{3,8})(;border-radius:8px;padding:9px 12px;margin-bottom:8px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">\s*<span style="background:#fff;color:)(#[0-9A-Fa-f]{3,8})(;font-size:9px[^>]*>)([^<]*)(<\/span>)/,
      function(m, a, _bg, b, _fg, c, _l, e){ return a + bg + b + fg + c + lbl + e; });
  });

  /* ── Replace wizard, step 3: the numbers the records will get are the server's next_no ───────────────────────
     The preview used to count the browser's lists + 1. Now it asks GET /v1/fleet/incidents and /jobs (next_no), draws legacy's
     numbers until they arrive, then draws the step again. (w6-b: the memo list carries next_no too, so the MO number is the server's.) */
  var nos = null, nosAt = 0, nosBusy = false;
  O.onWrite(function(){ nos = null; });
  function askNos(){
    if(nosBusy) return;
    nosBusy = true;
    Promise.all([
      O.get('/v1/fleet/incidents', { boat_id: '-none-' }),
      O.get('/v1/fleet/jobs', { boat_id: '-none-' }),
      O.get('/v1/fleet/memos', { boat_id: '-none-' }).catch(function(){ return null; })
    ]).then(function(r){
      nos = { inc: r[0] && r[0].next_no, mj: r[1] && r[1].next_no, mo: r[2] && r[2].next_no }; nosAt = Date.now(); nosBusy = false;
      if(typeof _swapDoc !== 'undefined' && _swapDoc && _swapDoc.step === 3 && typeof window.swapDocRender === 'function') window.swapDocRender();
    }, function(){ nosBusy = false; nosAt = Date.now(); });
  }
  wrap('_swapDocStep3', function(orig){
    var html = orig.apply(this, [].slice.call(arguments, 1));
    if(!nos && !nosBusy && Date.now() - nosAt > 5000) askNos();
    if(!nos || !nos.inc || !nos.mj) return html;
    var pad = function(p, n){ return p + '-' + String(n + 1).padStart(3, '0'); };
    var li = pad('INC', (typeof FL_INCIDENTS !== 'undefined' ? (FL_INCIDENTS || []).length : 0));
    var lj = pad('MJ', (typeof FL_MAINT !== 'undefined' ? (FL_MAINT || []).length : 0));
    var lm = pad('MO', (typeof FL_MEMOS !== 'undefined' ? (FL_MEMOS || []).length : 0));
    html = html.split(li).join(nos.inc).split(lj).join(nos.mj);
    return nos.mo ? html.split(lm).join(nos.mo) : html;     // w6-b: the memo number is the server's too (GET /v1/fleet/memos next_no)
  });
})();
