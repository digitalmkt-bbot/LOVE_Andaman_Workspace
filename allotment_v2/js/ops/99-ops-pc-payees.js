/* ════════════════════════════════════════════════════════════════════════
   §opsPcPayees (2026-10-20) · FE-6 · petty-cash payees and the claim's receipts (§pcRcpt, §pcPyCat in 08-app.js) on operation-backend
   ────────────────────────────────────────────────────────────────────────
   GET    /v1/pier-cash/payees?row_id=&q=&category=     {payees[], counts, row_category}: the list of the "จ่ายให้ใคร" dialog (suggested, uses, categories)
   POST   /v1/pier-cash/payees                           pcPySave (new)         PATCH /v1/pier-cash/payees/{id}   pcPySave (edit)
   DELETE /v1/pier-cash/payees/{id}                      pcPyDel
   PUT    /v1/pier-cash/rows/{row_id}/payee {payee_id|null}   pcPySet (the line's payee)
   GET    /v1/pier-cash/claims/{id}/receipts             pcPrintReceipts (pages[], company, skipped)
   Legacy kept the register in the blob (po_cash_payees). Here the register and each line's payee are the server's:
     · who is on a claimed line comes with the claim's lines (54-ops-pier-cash-claims.js keeps st.payee / st.rcpt); pcPyOf and pcRcptCount read those
     · the dialog's list is asked for the line, the search text and the tab (the server marks the suggested ones, counts the tabs and says each payee's
       categories and uses); the form (pcPyEdit) reads the payee from the last lists: ID number, address and ID card are there only with the accounting right
     · pcPyPick, pcPyEdit, pcPyImgUp, pcPyImgShow, pcPyTabSet, pcPyCatTog are legacy's (the dialog shell, the upload and the tabs are client state)
     · the receipts are laid out here from the server's pages (names, ID number, address, the amount in words, the company's full name and address);
       the ID card is <img src="/api/attach/<id>"> without the origin: the print stand-in (38-ops-attachments.js) swaps it for a blob URL
   Errors: 403 accounting_only, 409 claim_empty / no_payee / not a live claim line are shown as the server's message.
   Classic script · after 54-ops-pier-cash-claims.js and 38-ops-attachments.js, before 90-ops-boot.js.
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O || !O.pierCashClaims) return;
  var CL = O.pierCashClaims.state, enc = encodeURIComponent;
  var NAMES = ['pcPyOf', 'pcPyDB', 'pcPyStats', 'pcRcptCount', 'pcPyPick', 'pcPyList', 'pcPySet', 'pcPySave', 'pcPyDel', 'pcPrintReceipts'];
  var orig = {};
  NAMES.forEach(function(n){ orig[n] = window[n]; });

  var PY = { reg: {}, cache: {}, last: null, seq: 0, first: false, loading: false };
  function E(s){ return typeof window.pcE === 'function' ? window.pcE(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function acc(){ return typeof window.pcPyAcc === 'function' ? window.pcPyAcc() : true; }
  function keep(){ try{ if(typeof window.pcKeep === 'function') window.pcKeep(); }catch(_){} }
  function closeDlg(){ try{ if(typeof window.ckReasonClose === 'function') window.ckReasonClose(); }catch(_){} }
  function wrap(name, fn){
    window[name] = function(){
      if(!O.enabled()) return orig[name] ? orig[name].apply(this, arguments) : undefined;
      return fn.apply(this, arguments);
    };
  }
  function remember(p){ if(p && p.id) PY.reg[p.id] = Object.assign(PY.reg[p.id] || {}, p); }

  /* a server payee → legacy's {id, name, idNo, addr, veh, img, cats} (what pcPyEdit / pcPyOf read) */
  function legacyPayee(p){
    var o = { id: p.id, name: p.name || '', veh: p.vehicle || '', cats: (p.categories || []).slice() };
    if(p.id_no !== undefined) o.idNo = p.id_no || '';
    if(p.address) o.addr = Object.assign({ no: '', moo: '', road: '', sub: '', dist: '', prov: '' }, p.address);
    if(p.id_card_attachment_id !== undefined) o.img = p.id_card_attachment_id ? { id: p.id_card_attachment_id, name: (p.id_card && p.id_card.name) || 'ID card', mime: (p.id_card && p.id_card.mime) || 'image/jpeg' } : null;
    return o;
  }
  /* the legacy store the dialog's helpers read, built from the server's register (no blob) */
  wrap('pcPyDB', function(){
    var D = { p: {}, of: {} };
    Object.keys(PY.reg).forEach(function(id){ D.p[id] = legacyPayee(PY.reg[id]); });
    Object.keys(CL.payee).forEach(function(r){ if(CL.payee[r] && CL.payee[r].id) D.of[r] = CL.payee[r].id; });
    return D;
  });
  wrap('pcPyStats', function(D){
    var use = {}, cats = {};
    Object.keys(PY.reg).forEach(function(id){ use[id] = PY.reg[id].uses || 0; cats[id] = (PY.reg[id].categories || ['oth']).slice(); });
    return { use: use, cats: cats };
  });
  wrap('pcPyOf', function(x){
    if(!x || x.id == null) return null;
    var p = x.payee || CL.payee[String(x.id)] || null;
    return p ? { id: p.id, name: p.name || '' } : null;
  });
  wrap('pcRcptCount', function(pier, cid){
    var r = CL.rcpt[cid]; if(r) return { n: +r.with_payee || 0, all: +r.lines || 0 };
    var R = typeof window.pcClmRows === 'function' ? window.pcClmRows(pier, cid) : [];
    return { n: R.filter(function(o){ return o && o.x && o.x.payee; }).length, all: R.length };
  });

  /* ── the dialog ── */
  wrap('pcPyPick', function(rowId){
    PY.first = true; PY.cache = {};
    return orig.pcPyPick.apply(this, arguments);   // legacy's shell; it draws the list through pcPyList below
  });
  function listKey(){ return [window._pcPyRow || '', String(window._pcPyQ || '').trim(), window._pcPyTab || 'all'].join('|'); }
  function catT(k){ return typeof window.pcPyCatT === 'function' ? window.pcPyCatT(k) : k; }
  function draw(a){
    var el = document.getElementById('pc-py-ls'); if(!el) return;
    var cats = window.PC_PY_CAT || [{ k: 'van', t: 'รถตู้' }, { k: 'guide', t: 'ไกด์' }, { k: 'lt', t: 'หางยาว' }, { k: 'oth', t: 'อื่น ๆ' }];
    var q = String(window._pcPyQ || '').trim(), tab = window._pcPyTab || 'all', cur = (CL.payee[window._pcPyRow] || {}).id || '', ac = acc();
    var cnt = a.counts || {};
    var tb = document.getElementById('pc-py-tabs');
    if(tb) tb.innerHTML = [{ k: 'all', t: 'ทั้งหมด' }].concat(cats).map(function(c){
      return '<button type="button" class="' + ((!q && tab === c.k) ? 'on' : '') + '" onclick="pcPyTabSet(\'' + c.k + '\')">' + c.t + ' <i>' + (cnt[c.k] || 0) + '</i></button>'; }).join('');
    var ad = document.getElementById('pc-py-add'); if(ad) ad.textContent = '+ เพิ่มคนรับเงินใหม่' + ((tab !== 'all' && !q) ? (' (' + catT(tab) + ')') : '');
    var S = (a.payees || []).filter(function(p){ return p.suggested; }), Oth = (a.payees || []).filter(function(p){ return !p.suggested; });
    var one = function(p, isS){
      var id = E(p.id), u = p.uses || 0;
      return '<div class="o' + (p.id === cur ? ' on' : '') + (isS ? ' sug' : '') + '"><span class="n" onclick="pcPySet(\'' + id + '\')"><b>' + E(p.name || '—') + '</b>'
        + (p.vehicle ? (' <small>· ' + E(p.vehicle) + '</small>') : '')
        + (isS ? '<em class="bd">ชื่อตรงกับรายการ</em>' : '')
        + ((tab === 'all' || q) ? (p.categories || []).map(function(c){ return '<em class="ct">' + catT(c) + '</em>'; }).join('') : '')
        + (u ? ('<small class="u">ใช้ ' + u + ' ครั้ง</small>') : '') + '</span>'
        + (ac ? ('<small class="f' + (p.has_id_no ? '' : ' z') + '">' + (p.has_id_no ? 'เลขบัตร ✓' : 'ไม่มีเลขบัตร') + (p.has_id_card ? ' · รูปบัตร ✓' : '') + '</small>') : '')
        + '<button type="button" class="e" title="แก้ข้อมูล" onclick="pcPyEdit(\'' + id + '\')">&#9998;</button></div>'; };
    el.innerHTML = (S.length ? ('<div class="sec">แนะนำ</div>' + S.map(function(p){ return one(p, true); }).join('')) : '')
      + (Oth.length ? ((S.length ? '<div class="sec">' + (q ? 'ผลค้นหา' : (tab === 'all' ? 'ทั้งหมด' : catT(tab))) + ' · ใช้บ่อยก่อน</div>' : '') + Oth.map(function(p){ return one(p, false); }).join('')) : '')
      + ((!S.length && !Oth.length) ? ('<div class="pc2-mut" style="padding:10px 12px">' + (q ? 'ไม่พบชื่อนี้ · กด "+ เพิ่มคนรับเงินใหม่"' : ((cnt.all || 0) ? 'ยังไม่มีคนในประเภทนี้ · ดูแท็บ "ทั้งหมด" หรือกด "+ เพิ่มคนรับเงินใหม่"' : 'ยังไม่มีทะเบียนคนรับเงิน · กด "+ เพิ่มคนรับเงินใหม่"')) + '</div>') : '');
  }
  wrap('pcPyList', function(){
    var el = document.getElementById('pc-py-ls'); if(!el) return;
    var k = listKey(), a = PY.cache[k];
    if(a){ draw(a); return; }
    if(PY.last) draw(PY.last); else el.innerHTML = '<div class="pc2-mut" style="padding:10px 12px">กำลังโหลด…</div>';
    var my = ++PY.seq, q = String(window._pcPyQ || '').trim(), tab = window._pcPyTab || 'all';
    O.get('/v1/pier-cash/payees', { row_id: window._pcPyRow || '', q: q, category: q || tab === 'all' ? '' : tab }).then(function(j){
      (j.payees || []).forEach(remember);
      PY.cache[k] = j; PY.last = j;
      if(my !== PY.seq) return;
      /* the first time the dialog opens: the tab of the line's own category when that category has someone (legacy), else "all" */
      if(PY.first){
        PY.first = false;
        var rc = j.row_category;
        if(!q && tab === 'all' && rc && (j.counts || {})[rc] > 0){ window._pcPyTab = rc; window.pcPyList(); return; }
      }
      draw(j);
    }, function(e){ if(my === PY.seq){ O.fail('The payee list did not load', e); } });
  });

  /* ── writes ── */
  function after(){ PY.cache = {}; PY.last = null; O.wrote('pier'); }
  wrap('pcPySet', function(pid){
    if(typeof window.pcGuard === 'function' && !window.pcGuard()) return null;
    var row = window._pcPyRow; if(!row) return null;
    return O.queue(function(){ return O.call('PUT', '/v1/pier-cash/rows/' + enc(row) + '/payee', { payee_id: pid || null }); }).then(function(j){
      if(j && j.payee){ remember(j.payee); CL.payee[row] = { id: j.payee.id, name: j.payee.name }; } else delete CL.payee[row];
      after(); closeDlg(); keep(); return j;
    }, function(e){ O.fail('Payee not set', e); return null; });
  });
  wrap('pcPySave', function(pid){
    if(typeof window.pcGuard === 'function' && !window.pcGuard()) return null;
    if((window._pcPyUp || 0) > 0){ alert('The ID card image is still uploading. Please wait a moment, then press Save again.'); return null; }
    var v = function(id){ var e = document.getElementById('pc-py-' + id); return e ? String(e.value).replace(/\s+/g, ' ').trim() : null; };
    var name = v('name'); if(!name){ var ne = document.getElementById('pc-py-name'); if(ne){ ne.classList.add('bad'); ne.focus(); } return null; }
    var cats = (window._pcPyCats || []).length ? window._pcPyCats.slice() : ['oth'];
    var body = { name: name, vehicle: v('veh') || '', categories: cats };
    if(acc()){
      body.id_no = v('idno') || '';
      body.address = { no: v('no') || '', moo: v('moo') || '', road: v('road') || '', sub: v('sub') || '', dist: v('dist') || '', prov: v('prov') || '' };
      body.id_card_attachment_id = window._pcPyImg ? window._pcPyImg.id : null;
    }
    var row = window._pcPyRow;
    return O.queue(function(){
      return (pid ? O.patch('/v1/pier-cash/payees/' + enc(pid), body) : O.post('/v1/pier-cash/payees', body)).then(function(j){
        var p = j && j.payee; if(!p) return j;
        remember(p);
        if(!row) return j;
        return O.call('PUT', '/v1/pier-cash/rows/' + enc(row) + '/payee', { payee_id: p.id }).then(function(l){ CL.payee[row] = { id: p.id, name: p.name }; return j; });
      });
    }).then(function(j){ after(); closeDlg(); keep(); return j; }, function(e){ O.fail('Payee not saved', e); return null; });
  });
  wrap('pcPyDel', function(pid){
    if(typeof window.pcGuard === 'function' && !window.pcGuard()) return null;
    var p = PY.reg[pid]; if(!p) return null;
    var n = Object.keys(CL.payee).filter(function(r){ return CL.payee[r] && CL.payee[r].id === pid; }).length || (p.uses || 0);
    if(!confirm('Remove this person from the payee list?' + (n ? ('\n' + n + ' ledger line(s) will lose their payee.') : ''))) return null;
    return O.queue(function(){ return O.del('/v1/pier-cash/payees/' + enc(pid)); }).then(function(){
      delete PY.reg[pid]; Object.keys(CL.payee).forEach(function(r){ if(CL.payee[r] && CL.payee[r].id === pid) delete CL.payee[r]; });
      after(); closeDlg(); keep();
    }, function(e){ O.fail('Payee not removed', e); return null; });
  });

  /* ── the receipts (one A4 page per claimed line with a payee) ── */
  var RC_CSS = '#sheet{padding:0 !important;background:transparent !important;box-shadow:none !important}'
    + '#sheet .pg{background:#fff;padding:12mm 12mm 14mm;box-shadow:0 4px 18px rgba(0,0,0,.14);margin-bottom:14px;font-family:Sarabun,sans-serif;color:#111}'
    + '#sheet .rc{border:1.5px solid #111;padding:16px 22px 18px;font-size:14px;line-height:2}'
    + '#sheet .rc .top{display:flex;align-items:flex-start}#sheet .rc .top img{height:40px}'
    + '#sheet .rc .top .t{flex:1;text-align:center;font-size:20px;font-weight:700;margin-left:-80px;padding-top:8px}'
    + '#sheet .rc .dd{text-align:right;margin-top:4px}'
    + '#sheet .rc .row{display:flex;gap:12px}#sheet .rc .row>div{flex:1}'
    + '#sheet .rc .dt{display:inline-block;border-bottom:1px dotted #555;padding:0 6px;line-height:1.5;text-align:center}'
    + '#sheet .rc .f{color:#0B3D91;font-weight:600}'
    + '#sheet .rc .gr{margin-top:8px;display:grid;grid-template-columns:104px 1fr;line-height:1.8}'
    + '#sheet .rc .gr .dt{text-align:left}'
    + '#sheet .rc .sg{margin-top:20px;text-align:right;line-height:2.2}'
    + '#sheet .rc .sg .ln{display:inline-block;width:220px;border-bottom:1px dotted #555;height:20px;vertical-align:bottom}'
    + '#sheet .idc{display:block;margin:18px auto 0;max-width:86mm;max-height:60mm;border:1px solid #ccc;border-radius:6px}'
    + '#sheet img.idc[data-pdf]:not([src]){display:none}'
    + '#sheet .idb{margin:18px auto 0;width:86mm;height:54mm;border:1.5px dashed #9AA3B8;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#9AA3B8;font-size:13px}'
    + '@media print{#sheet .pg{box-shadow:none;margin:0;padding:0 2px;page-break-after:always;break-after:page}#sheet .pg:last-child{page-break-after:auto;break-after:auto}}';
  function receiptPages(R, ac){
    var F = function(val, w){ val = String(val == null ? '' : val).trim(); return '<span class="dt' + (val ? ' f' : '') + '"' + (w ? (' style="min-width:' + w + 'px"') : '') + '>' + (val ? E(val) : '&nbsp;') + '</span>'; };
    return R.pages.map(function(pg){
      var p = pg.payee || {}, a = (ac && p.address) || {}, im = ac ? p.id_card : null;
      var isI = im && /^image\//.test(im.mime || ''), isP = im && (/pdf/i.test(im.mime || '') || /\.pdf$/i.test(im.name || ''));
      var img = isI ? ('<img class="idc" src="/api/attach/' + enc(im.id) + '" alt="" onerror="this.outerHTML=\'<div class=idb>เปิดรูปบัตรไม่ได้ · แนบใหม่เป็น JPG/PNG</div>\'">')
        : isP ? ('<img class="idc" data-pdf="/api/attach/' + enc(im.id) + '" alt=""><div class="idb pdfw">กำลังเปิดรูปบัตร (PDF)…</div>')
        : ('<div class="idb">' + (!ac ? 'แนบสำเนาบัตรประชาชน' : (im ? 'รูปบัตรเป็นไฟล์ที่เปิดไม่ได้ · แนบใหม่เป็นรูป' : 'ยังไม่ได้แนบรูปบัตรในทะเบียน · แนบสำเนาบัตรประชาชน')) + '</div>');
      return '<div class="pg"><div class="rc">'
        + '<div class="top">' + ((typeof LA_LOGO_FULL !== 'undefined') ? ('<img src="' + LA_LOGO_FULL + '" alt="">') : '') + '<div class="t">ใบเสร็จรับเงิน</div></div>'
        + '<div class="dd">วันที่ ' + F(pg.date_th, 110) + '</div>'
        + '<div class="row"><div>ข้าพเจ้า ' + F(p.name, 230) + '</div><div>บัตรประชาชนเลขที่ ' + F(ac ? p.id_no : '', 170) + '</div></div>'
        + '<div class="row"><div>อยู่บ้านเลขที่ ' + F(a.no, 120) + '</div><div>หมู่ที่ ' + F(a.moo, 50) + ' ถนน ' + F(a.road, 140) + '</div></div>'
        + '<div class="row"><div>แขวง / ตำบล ' + F(a.sub, 170) + '</div><div>เขต / อำเภอ ' + F(a.dist, 170) + '</div></div>'
        + '<div>จังหวัด ' + F(a.prov, 170) + '</div>'
        + '<div class="gr"><span>ได้รับเงินจาก</span><span class="f">' + E(R.company.name_full) + '<br>' + E(R.company.address) + '</span></div>'
        + '<div class="gr"><span>ชำระค่า</span><span>' + F(pg.description) + '</span>'
        + '<span>เป็นจำนวนเงิน</span><span>' + F(pg.amount_display, 110) + ' บาท &nbsp;(' + F(pg.amount_text_th) + ')</span></div>'
        + '<div style="margin-top:6px">ไว้เรียบร้อยแล้ว</div>'
        + '<div class="sg">ลงชื่อ <span class="ln"></span> ผู้รับเงิน<br>( ' + F(p.name, 200) + ' )</div>'
        + '</div>' + img + '</div>'; }).join('');
  }
  wrap('pcPrintReceipts', function(cid){
    if(typeof window.pcClmGet === 'function' && !window.pcClmGet(cid)){ alert('This claim no longer exists.'); return null; }
    return O.get('/v1/pier-cash/claims/' + enc(cid) + '/receipts').then(function(R){
      if(R.skipped > 0 && !confirm(R.skipped + ' of ' + R.lines + ' lines have no payee and will be skipped.\nPrint the other ' + R.pages.length + '?')) return null;
      var pages = receiptPages(R, acc());
      window.pcPrintWin('ใบเสร็จรับเงิน · ' + String(R.claim.name || '') + ' · ' + R.claim.date, ('pettycash_receipts_' + R.claim.pier + '_' + R.claim.date + '_' + cid).replace(/[^A-Za-z0-9_.-]+/g, '_'), RC_CSS, pages, false);
      /* a payee's ID card kept as a PDF: its first page is drawn into the print window as a picture (legacy §pcRcpt2) */
      if(pages.indexOf('data-pdf=') >= 0 && typeof window.pcPdfToJpg === 'function'){
        var W = null; try{ W = window._pcLastPrintWin; }catch(_){}
        var paintPdf = function(real){
          var doc = real && real.document; if(!doc) return;
          [].slice.call(doc.querySelectorAll('img[data-pdf]')).forEach(function(im){
            window.pcPdfToJpg(im.getAttribute('data-pdf'), function(b){ var w = im.nextSibling;
              if(b){ im.src = URL.createObjectURL(b); if(w && w.className && String(w.className).indexOf('pdfw') >= 0) w.parentNode.removeChild(w); }
              else { im.parentNode.removeChild(im); if(w) w.textContent = 'เปิดรูปบัตร (PDF) ไม่ได้ · แนบใหม่เป็นรูป JPG/PNG'; } });
          });
        };
        /* the print stand-in (38-ops-attachments.js) writes the real window once the files are fetched: wait for it */
        if(W && W.__laReady) W.__laReady.then(function(real){ setTimeout(function(){ paintPdf(real); }, 100); }); else setTimeout(function(){ paintPdf(W); }, 400);
      }
      return R;
    }, function(e){
      if(e && (e.code === 'claim_empty' || e.code === 'no_payee')) { alert(e.message); return null; }
      O.fail('Receipts not made', e); return null;
    });
  });

  O.pcPayees = { state: PY };
})();
