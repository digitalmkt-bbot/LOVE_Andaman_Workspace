/* ══════════════════════════════════════════════════════════════════════════
   §opsFleetExtras (w6-a, 2026-10-18) · fleet leftovers of the w5-a walk (items 5 and 6)
   ──────────────────────────────────────────────────────────────────────────
   flMaintCostShare(m, kind)  ⇄ job `cost_share {engine, gearbox, propeller}` (GET /v1/fleet/jobs): the job's cost divided by the number of
     assets of that kind on it (at least 1). The job mapper (ops/24) keeps it as m.costShare; asset pages, boat totals and the Work board read it
     through this wrapper. A job without the field (offline, not yet read) keeps legacy's sum.
   flExtraToCol(ds, pierKey, bid, xid) ⇄ POST /v1/fleet/daily-log/{date}/boats/{boat_id}/extras/{extra_id}/to-issue {item_id}: the extra's quantity is
     added onto the issue column and the extra is removed in ONE server transaction (legacy: two writes, flIssueSet then flExtraDel, which could
     leave the quantity added and the extra still there). Legacy's checks and confirm are kept as they were; the sum is the server's:
     the answer {before, added, after, unit_mismatch} is what the screen takes, and a figure that differs from the confirm's (someone changed the
     column meanwhile) is told to the person. Classic script, after ops/24 and ops/26.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  function wrap(name, fn){
    var orig = window[name];
    if(typeof orig !== 'function' || orig.__w6a) return;
    var w = function(){
      if(!O.enabled()) return orig.apply(this, arguments);
      return fn.apply(this, [orig].concat([].slice.call(arguments)));
    };
    w.__w6a = true; w.__orig = orig; window[name] = w;
  }
  var KIND = { eng: 'engine', gb: 'gearbox', prop: 'propeller' };
  wrap('flMaintCostShare', function(orig, m, kind){
    var k = KIND[kind] || 'engine';
    if(m && m._fromOpsBackend && m.costShare && typeof m.costShare[k] === 'number') return m.costShare[k];
    return orig.apply(this, [].slice.call(arguments, 1));
  });

  function enc(s){ return encodeURIComponent(s); }
  wrap('flExtraToCol', function(orig, ds, pierKey, bid, xid){
    if(typeof window.laCanEditArea === 'function' && !window.laCanEditArea('fleet') && !window.laCanEditArea('operations')){ alert('ดูอย่างเดียว · แก้ไม่ได้'); return; }
    var row = null; window.flExtraGet(ds, bid).forEach(function(x){ if(x && x.id === xid) row = x; });
    if(!row) return;
    var nm = String(row.n || '').trim();
    var it = window.flIssueFor(pierKey).filter(function(y){ return String(y.name || '').trim() === nm; })[0];
    if(!it){ alert('ท่านี้ยังไม่มีคอลัมน์ชื่อ "' + nm + '"'); return; }
    var add = (row.q == null) ? 0 : row.q;
    if(!isFinite(add)){ alert('จำนวนในแถวนี้ไม่ใช่ตัวเลข · แก้ที่ปุ่ม "แก้ / ลบ" ก่อน'); return; }
    var bn = bid; try{ var b = (BOATS || []).filter(function(z){ return z.id === bid; })[0]; if(b) bn = b.name; }catch(_){}
    var path = '/v1/fleet/daily-log/' + enc(ds) + '/boats/' + enc(bid) + '/extras/' + enc(xid) + '/to-issue';
    var compat = window.__laOpsFleetDailyCompat;
    /* §w9 · the confirm's figures and the unit warning are the server's dry run (before + added = after, unit_mismatch), not the browser's sum */
    return O.call('POST', path, { item_id: it.id, dry_run: true }).then(function(d){
      var warn = d.unit_mismatch
      ? ('\n\n\u26a0 หน่วยไม่ตรงกัน · แถวนี้เป็น "' + d.unit_mismatch.extra_unit + '" แต่คอลัมน์เป็น "' + d.unit_mismatch.item_unit + '"\nถ้าไม่ใช่ของอย่างเดียวกัน ให้กดยกเลิกแล้วแก้ชื่อแทน')
        : '';
      if(!confirm('ย้ายเข้าคอลัมน์ "' + nm + '"\n' + bn + ' · ' + ds + '\n\n'
        + 'ในคอลัมน์ตอนนี้ ' + d.before + '  +  ' + d.added + '  =  ' + d.after + (d.item_unit ? (' ' + d.item_unit) : '') + '\n'
        + 'แล้วลบบรรทัดนี้ออกจากรายการอื่นๆ' + warn)) return;
      return O.queue(function(){
        return O.call('POST', path, { item_id: it.id });
      }).then(function(r){
        if(compat && r && r.day) compat.applyDailyDay(r.day);
        O.wrote('fleet-daily-extra-del');
        try{ if(typeof window.flRenderDR === 'function' && document.getElementById('fl-dr-body')) window.flRenderDR(); }catch(_){}
        if(r && typeof r.after === 'number' && r.after !== d.after)
          O.toast({ kind: 'info', title: 'Moved to the column', status: 'OK', sub: r.before + ' + ' + r.added + ' = ' + r.after, dur: 7000 });
        return r;
      });
    }).catch(function(e){ O.fail('Could not move the extra to the column', e); return null; });
  });
})();
