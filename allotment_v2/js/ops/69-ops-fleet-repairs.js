/* ══════════════════════════════════════════════════════════════════════════
   §opsFleetRepairs (2026-10-17) · lost-stock repair, duplicate numbers and copies ⇄ operation-backend
   ──────────────────────────────────────────────────────────────────────────
   Legacy's Inventory "check the stock" panel and Cost Analytics' "duplicate data" bar scanned and edited the
   browser's own arrays. The server now decides (operation-backend todo/rules-fleet-model.md, Q6 and Q7):

     GET  /v1/fleet/stock-repair/lost            invLostScan, _invSurplus   (what is lost, what the wrong item took in)
     POST /v1/fleet/stock-repair/lost/fix        invLostFix                 {memo_id, idx}
     POST /v1/fleet/duplicates/numbers/renumber-one   laRenumberOne / costNoRenumberOne   {kind, id}
     POST /v1/fleet/duplicates/numbers/renumber       laRenumberSet / costDupRenumber     {kind}
     POST /v1/fleet/duplicates/numbers/drop-copies    costNoDropDupes                     {kind, no}
     POST /v1/fleet/duplicates/clean                  laDupClean / costDupClean           {kind}
     POST /v1/fleet/duplicates/clean-all              laDupCleanAll / costDupCleanAll     {}

   The screens, the questions (confirm) and the messages (alert) are legacy's, word for word. What changes is who
   does the work: the command goes to the server, then jobs, incidents, memos and stock are read again (the browser's
   copies are the server's). The scan that draws the panels (laDupScan, costDupInspect) still reads those copies.
   Kinds: noMemo / memo -> memo, noMaint / maint -> job, noInc / incident -> incident.

   Load order: after js/ops/26-ops-fleet-daily.js. Classic script.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  function enabled(){ return !!(O.enabled && O.enabled()); }
  function esc(s){ return typeof window.ckEsc === 'function' ? window.ckEsc(s) : String(s == null ? '' : s); }
  function wrap(name, fn){
    var orig = window[name];
    if(typeof orig !== 'function' || orig.__opsRepairs) return;
    var w = function(){
      if(!enabled()) return orig.apply(this, arguments);
      return fn.apply(this, [orig].concat([].slice.call(arguments)));
    };
    w.__opsRepairs = true;
    window[name] = w;
  }

  var KIND = { noMemo: 'memo', memo: 'memo', noMaint: 'job', maint: 'job', noInc: 'incident', incident: 'incident' };
  var WH_NAME = { tublamu: 'คลัง Tub Lamu', panwa: 'คลัง Visit Panwa', ranong: 'คลัง Ranong' };

  /* the browser's copies of jobs, incidents, memos, stock and the cost page, read again after a command */
  function refetchAll(){
    var tasks = [];
    if(O.fleetJobs && O.fleetJobs.refetchAll) tasks.push(O.fleetJobs.refetchAll());
    if(O.fleetStock && O.fleetStock.refetch) tasks.push(O.fleetStock.refetch());
    return Promise.all(tasks.map(function(p){ return Promise.resolve(p).catch(function(){}); }));
  }
  function redraw(){
    try{ if(typeof window.flRenderCostAnalytics === 'function' && document.getElementById('fl-cost-wrap')) window.flRenderCostAnalytics(); }catch(_){}
    try{ if(typeof window.flRenderInventory === 'function' && document.getElementById('inv-dup-host')) window.flRenderInventory(); }catch(_){}
  }
  function guard(){ return !(typeof window.laGuardEdit === 'function' && !window.laGuardEdit('fleet')); }
  function groupOf(key, no){
    var U = (window.LA_DUP_NUMS || []).filter(function(x){ return x.k === key; })[0];
    if(!U) return { U: null, grp: [] };
    return { U: U, grp: (U.get() || []).filter(function(x){ return U.no(x) === no; }) };
  }

  /* ── Q7 · duplicate numbers and copies ─────────────────────────────────────────────────────────── */

  wrap('costNoDropDupes', function(orig, key, no){
    if(!guard()) return null;
    var g = groupOf(key, no), kind = KIND[key];
    if(!g.U || !kind) return null;
    if(g.grp.length < 2){ alert('ไม่พบใบซ้ำของเลข ' + no + ' แล้ว'); return null; }
    var keep = g.grp[0], drop = g.grp.slice(1);
    var money = g.U.money ? drop.reduce(function(a, x){ return a + (+x.amount || 0); }, 0) : 0;
    var msg = 'ลบใบซ้ำของเลข ' + no + '\n\n'
      + 'ทั้ง ' + g.grp.length + ' ใบมีเนื้อหาตรงกันทุกฟิลด์ ต่างแค่ id\n'
      + 'เก็บไว้ : ' + keep.id + '\n'
      + 'ลบทิ้ง : ' + drop.length + ' ใบ (' + drop.map(function(x){ return x.id; }).slice(0, 3).join(', ') + (drop.length > 3 ? ' …' : '') + ')\n'
      + (money ? ('\nยอดที่เคยถูกนับเกิน: ฿' + Math.round(money).toLocaleString() + '\n') : '')
      + '\nลบแล้วย้อนไม่ได้ · ข้อมูลไม่หายเพราะใบที่เก็บไว้เหมือนกันทุกอย่าง';
    if(!confirm(msg)) return null;
    return O.queue(function(){ return O.post('/v1/fleet/duplicates/numbers/drop-copies', { kind: kind, no: no }); }).then(function(r){
      return refetchAll().then(function(){
        O.wrote('fleet-duplicates');
        alert('ลบใบซ้ำแล้ว ' + ((r && r.dropped) || drop.length) + ' ใบ · เหลือ ' + ((r && r.kept) || keep.id));
        try{ window.costDupInspect(key); }catch(_){}
        redraw();
        return r;
      });
    }, function(e){
      if(e && e.status === 409 && e.code === 'not_a_true_copy'){
        var diff = (e.body && e.body.diff) || [];
        alert('เลข ' + no + ' ไม่ใช่ใบซ้ำแท้แล้ว\n\nมีฟิลด์ที่ต่างกัน: ' + diff.join(', ')
          + '\n\nปุ่มลบใช้ได้เฉพาะกลุ่มที่ทุกฟิลด์ตรงกันหมด · ปิดแผงแล้วเปิดใหม่เพื่อดูสถานะล่าสุด');
        return null;
      }
      if(e && e.status === 409 && e.code === 'no_duplicates'){ alert('ไม่พบใบซ้ำของเลข ' + no + ' แล้ว'); refetchAll().then(redraw); return null; }
      O.fail('Could not drop the copies', e); return null;
    });
  });

  /* one document gets the next free number (laRenumberOne's caller: costNoRenumberOne) */
  wrap('costNoRenumberOne', function(orig, key, id){
    if(!guard()) return null;
    var U = (window.LA_DUP_NUMS || []).filter(function(x){ return x.k === key; })[0], kind = KIND[key];
    if(!U || !kind) return null;
    var m = (U.get() || []).filter(function(x){ return x.id === id; })[0]; if(!m) return null;
    if(!confirm('ออกเลขใหม่ให้ใบนี้?\n\n' + (m.no || '') + ' · ' + (m.title || '')
      + '\n\nใบอื่นที่เลขเดียวกันจะไม่ถูกแตะ · เลขเดิมเก็บไว้ที่ prevNo · ไม่มีการลบ')) return null;
    return O.queue(function(){ return O.post('/v1/fleet/duplicates/numbers/renumber-one', { kind: kind, id: id }); }).then(function(r){
      return refetchAll().then(function(){
        O.wrote('fleet-duplicates');
        if(r) alert('ออกเลขใหม่แล้ว\n\n' + r.from + ' → ' + r.to);
        try{ window.costDupInspect(key); }catch(_){}
        redraw();
        return r;
      });
    }).catch(function(e){ O.fail('Could not renumber', e); return null; });
  });

  /* every clashing group: the oldest keeps its number, the others are renumbered (costDupRenumber -> laRenumberSet) */
  wrap('costDupRenumber', function(orig, key){
    if(!guard()) return null;
    var U = (window.LA_DUP_NUMS || []).filter(function(x){ return x.k === key; })[0], kind = KIND[key];
    if(!U || !kind) return null;
    var arr = U.get() || [], groups = {};
    arr.forEach(function(x){ var n = U.no(x); if(!n) return; (groups[n] = groups[n] || []).push(x); });
    var cols = Object.keys(groups).filter(function(n){ return groups[n].length > 1; });
    if(!cols.length){ alert('ไม่พบเลขที่ชนกัน'); return null; }
    var msg = 'ออกเลขใหม่ให้เอกสารที่เลขชนกัน · ' + cols.length + ' เลข\n\n'
      + cols.slice(0, 10).join(', ') + (cols.length > 10 ? ' …' : '') + '\n\n'
      + 'ใบที่สร้างก่อนจะได้ครองเลขเดิม · ใบที่มาทีหลังได้เลขใหม่\n'
      + 'เลขเดิมถูกเก็บไว้ที่ prevNo · ค้นด้วยเลขเก่ายังเจอ\n'
      + 'ไม่มีการลบเอกสารใด ๆ';
    if(!confirm(msg)) return null;
    return O.queue(function(){ return O.post('/v1/fleet/duplicates/numbers/renumber', { kind: kind }); }).then(function(r){
      return refetchAll().then(function(){
        O.wrote('fleet-duplicates');
        var ch = (r && r.changed) || [];
        alert((r && r.n > 0) ? ('ออกเลขใหม่แล้ว ' + r.n + ' ใบ\n\n'
            + ch.slice(0, 12).map(function(c){ return c.from + ' → ' + c.to + ' · ' + String(c.title).slice(0, 40); }).join('\n')
            + (ch.length > 12 ? '\n…' : ''))
          : 'ไม่มีอะไรต้องแก้');
        redraw();
        return r;
      });
    }).catch(function(e){ O.fail('Could not renumber', e); return null; });
  });

  /* the named legacy workers never touch the browser's arrays in ops mode: the server does the work (above) */
  wrap('laRenumberSet', function(){ return { n: 0, changed: [] }; });
  wrap('laRenumberOne', function(){ return null; });
  wrap('laDupClean', function(){ return 0; });
  wrap('laDupCleanAll', function(){ return 0; });

  function cleanKind(key){ return key === 'maint' ? 'job' : (key === 'memo' || key === 'incident') ? key : null; }

  wrap('costDupClean', function(orig, key){
    if(!guard()) return null;
    var lbl = ((window.LA_DUP_SETS || []).concat(window.LA_DUP_NESTED || []).filter(function(x){ return x.k === key; })[0] || {}).label || key;
    if(!confirm('ล้างรายการซ้ำในกลุ่ม "' + lbl + '" ?\n\nระบบจะเก็บใบที่มีเนื้อหามากที่สุดไว้ '
      + 'แล้วย้าย memo / ประวัติเบิกอะไหล่ ที่ชี้ใบที่ถูกลบ ให้มาชี้ใบที่เก็บไว้')) return null;
    var kind = cleanKind(key);
    /* lines inside a document (history, parts, memo lines, pier payments) cannot repeat on the server: nothing to clean */
    if(!kind){ alert('ไม่พบรายการซ้ำที่ล้างได้'); redraw(); return null; }
    return O.queue(function(){ return O.post('/v1/fleet/duplicates/clean', { kind: kind }); }).then(function(r){
      return refetchAll().then(function(){
        O.wrote('fleet-duplicates');
        var n = (r && r.removed) || 0;
        alert(n > 0 ? ('ล้างไปแล้ว ' + n + ' รายการ') : 'ไม่พบรายการซ้ำที่ล้างได้');
        redraw();
        return r;
      });
    }).catch(function(e){ O.fail('Could not clean the copies', e); return null; });
  });

  wrap('costDupCleanAll', function(orig){
    if(!guard()) return null;
    if(!confirm('ล้างรายการซ้ำทุกกลุ่มที่ล้างได้ ?\n\nทะเบียนเรือ / เครื่องยนต์ / เกียร์ / ใบจักร / เอเจนต์ / บุคกิ้ง จะไม่ถูกแตะ\nเพราะถูกอ้าง id กระจายทั้งระบบ ต้องดูทีละรายการเอง')) return null;
    return O.queue(function(){ return O.post('/v1/fleet/duplicates/clean-all', {}); }).then(function(r){
      return refetchAll().then(function(){
        O.wrote('fleet-duplicates');
        var n = (r && r.total) || 0;
        alert(n > 0 ? ('ล้างไปแล้ว ' + n + ' รายการ') : 'ไม่พบรายการซ้ำที่ล้างได้');
        redraw();
        return r;
      });
    }).catch(function(e){ O.fail('Could not clean the copies', e); return null; });
  });

  /* ── Q6 · received stock that has no item in stock ─────────────────────────────────────────────── */

  var lost = null;       // the last GET /v1/fleet/stock-repair/lost answer

  function readLost(){
    return O.get('/v1/fleet/stock-repair/lost').then(function(r){ lost = r || { count: 0, lost: [] }; return lost; });
  }
  function recOf(memoId, idx){
    var hit = null;
    ((lost && lost.lost) || []).forEach(function(x){ if(x.memo_id === memoId && x.idx === idx) hit = x; });
    return hit;
  }
  function memoOf(id){ return (typeof FL_MEMOS !== 'undefined' ? FL_MEMOS : []).filter(function(x){ return x.id === id; })[0] || null; }
  function itemOf(id){ return (typeof FL_INVENTORY !== 'undefined' ? FL_INVENTORY : []).filter(function(x){ return x.id === id; })[0] || null; }

  /* the panel reads the scan when it opens, so the scan is read first */
  wrap('invDupOpen', function(orig){
    var args = [].slice.call(arguments, 1), self = this;
    return readLost().catch(function(e){ lost = null; O.fail('Could not read the lost-stock scan', e); }).then(function(){ return orig.apply(self, args); });
  });

  wrap('invLostScan', function(orig){
    if(!lost) return orig.apply(this, [].slice.call(arguments, 1));
    return (lost.lost || []).map(function(x){
      var m = memoOf(x.memo_id) || { id: x.memo_id, no: x.memo_no, items: [] };
      var it = (m.items || [])[x.idx] || { name: x.name, partNo: x.part_no, unit: x.unit, qty: x.qty, price: x.price };
      return { m: m, idx: x.idx, it: it, wrong: x.wrong ? (itemOf(x.wrong.item_id) || { id: x.wrong.item_id, name: x.wrong.name, qty: x.wrong.qty_total, totalQty: x.wrong.qty_total, history: [] }) : null };
    });
  });

  /* surplus = what the wrong item took in from this memo beyond the memo's own lines for it. The panel offers the
     pull when over >= quantity; the server also needs the wrong item to still hold it (pull.possible), so a pull it
     does not offer shows as not possible here too. */
  wrap('_invSurplus', function(orig, wrong, m){
    if(!lost || !wrong || !m) return orig.apply(this, [].slice.call(arguments, 1));
    var rec = null;
    (lost.lost || []).forEach(function(x){ if(x.memo_id === m.id && x.wrong && x.wrong.item_id === wrong.id) rec = x; });
    if(!rec) return orig.apply(this, [].slice.call(arguments, 1));
    var s = rec.surplus || {}, q = Math.max(0, +rec.qty || 0);
    var over = (rec.pull && rec.pull.possible) ? s.over : Math.min(s.over, q - 1);
    return { rows: [{ location: WH_NAME[rec.warehouse] || rec.warehouse }], sum: s.sum, own: s.own, over: over };
  });

  wrap('invLostFix', function(orig, memoId, idx){
    if(!guard()) return null;
    var rec = recOf(memoId, idx);
    if(!rec) return orig.apply(this, [].slice.call(arguments, 1));
    var loc = WH_NAME[rec.warehouse] || rec.warehouse || 'คลัง Tub Lamu';
    var qty = Math.max(0, +rec.qty || 0), unit = rec.unit || 'ชิ้น';
    var wrong = rec.wrong, canPull = !!(rec.pull && rec.pull.possible);
    var msg = 'ซ่อมรายการ "' + rec.name + '" ของ ' + rec.memo_no + '\n\n'
      + '1. สร้างรายการในคลัง · ' + qty + ' ' + unit + ' @ ' + loc + '\n';
    msg += canPull
      ? ('2. ถอน ' + qty + ' ' + unit + ' ออกจาก "' + wrong.name + '" ที่ถูกบวกเกินไว้\n   (ตอนนี้ '
         + wrong.qty_total + ' → ' + (wrong.qty_total - qty) + ')\n\nยอดรวมทั้งระบบเท่าเดิม')
      : ('2. ไม่แตะยอดของชิ้นอื่น' + (wrong ? (' · คำนวณส่วนเกินของ "' + wrong.name + '" ไม่ลงตัว ต้องไปตรวจเอง') : ''));
    if(!confirm(msg)) return null;
    return O.queue(function(){ return O.post('/v1/fleet/stock-repair/lost/fix', { memo_id: memoId, idx: idx }); }).then(function(r){
      return refetchAll().then(function(){
        O.wrote('fleet-stock-repair');
        if(typeof window.flShowToast === 'function') window.flShowToast('ซ่อมแล้ว · ' + rec.name + ' คงเหลือ ' + qty + ' ' + unit + ' @ ' + loc);
        if(typeof window.flRenderInventory === 'function') window.flRenderInventory();
        if(typeof window.invDupOpen === 'function') window.invDupOpen();
        return r;
      });
    }).catch(function(e){
      if(e && e.status === 409 && e.code === 'not_lost'){ readLost().then(function(){ if(typeof window.invDupOpen === 'function') window.invDupOpen(); }).catch(function(){}); }
      O.fail('Could not repair the stock line', e); return null;
    });
  });

  O.fleetRepairs = { readLost: readLost, lost: function(){ return lost; } };
  window.laOpsFleetRepairs = O.fleetRepairs;
})();
