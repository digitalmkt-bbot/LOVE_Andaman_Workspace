/* ══════════════════════════════════════════════════════════════════════════
   §opsMemoWithdraw (sync 11-13 · lk-inbox §memoUseNow2, 5952c69d, 2026-11-12) · withdraw a job's received memo parts
   ──────────────────────────────────────────────────────────────────────────
   Legacy: the job's parts section shows "เบิกของจาก Memo ที่รับเข้าคลังแล้ว · N รายการ" when the job's memos received parts the
   job has not taken yet (flMaintMemoPending), and one confirm withdraws them all (flMaintWithdrawFromMemos → flMaintWithdraw +
   flSave). flSave is a no-op in ops mode, so here the server decides and writes:

   GET  /v1/fleet/jobs/{id}/memo-pending    → flMaintMemoPending(m) (lines {memo_no, item_name, unit, warehouse, want, qty})
   POST /v1/fleet/jobs/{id}/memo-withdraw   ← flMaintWithdrawFromMemos(jobId) (answers {issued, failed}; 409 memo_nothing_pending)

   flMaintMemoPending answers the last read for the job and asks again in the background; when the answer lands the button's host
   (#maint-memo-wd-<id>) is drawn again with legacy's flMaintMemoBtnHtml. Legacy's button, confirm and toast texts are its own.
   Off unless laOps.enabled(). Load order: after ops/24 (fleet jobs) and ops/25 (fleet stock). Classic script.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  function on(){ try{ return !!(O.enabled && O.enabled()); }catch(_){ return false; } }
  function enc(v){ return encodeURIComponent(v == null ? '' : String(v)); }
  var WH = { tublamu: 'คลัง Tub Lamu', panwa: 'คลัง Visit Panwa', ranong: 'คลัง Ranong' };
  var cache = {}, inflight = {}, at = {};

  /* The server's line in the shape legacy's button and confirm read: x.mo.no, x.inv.{id,name,unit}, x.loc, x.want, x.qty. */
  function legacyLine(l){
    return { mo: { id: l.memo_id, no: l.memo_no }, it: { id: l.line_id }, inv: { id: l.item_id, name: l.item_name, unit: l.unit || '' },
             loc: WH[l.warehouse] || l.warehouse || '', want: +l.want || 0, qty: +l.qty || 0 };
  }
  function redrawHost(jobId){
    var host = document.getElementById('maint-memo-wd-' + jobId); if(!host) return;
    var jobs = typeof FL_MAINT !== 'undefined' && Array.isArray(FL_MAINT) ? FL_MAINT : [];
    var m = jobs.find(function(x){ return x && x.id === jobId; }); if(!m) return;
    try{ host.innerHTML = window.flMaintMemoBtnHtml(m); }catch(_){}
  }
  function load(jobId){
    if(inflight[jobId]) return inflight[jobId];
    inflight[jobId] = O.get('/v1/fleet/jobs/' + enc(jobId) + '/memo-pending').then(function(r){
      var before = JSON.stringify(cache[jobId] || null);
      cache[jobId] = ((r && r.lines) || []).map(legacyLine); at[jobId] = Date.now();
      if(JSON.stringify(cache[jobId]) !== before) redrawHost(jobId);
      return cache[jobId];
    }).catch(function(e){ try{ console.warn('[ops] memo-pending · ' + (e && e.message)); }catch(_){} return cache[jobId] || []; })
      .then(function(v){ delete inflight[jobId]; return v; });
    return inflight[jobId];
  }

  var origPending = window.flMaintMemoPending;
  if(typeof origPending === 'function') window.flMaintMemoPending = function(m){
    if(!on() || !m || !m.id) return origPending.apply(this, arguments);
    if(!cache[m.id] || Date.now() - (at[m.id] || 0) > 15000) load(m.id);   // one read per job per 15 s, not one per redraw
    return (cache[m.id] || []).slice();
  };

  var origWithdraw = window.flMaintWithdrawFromMemos;
  if(typeof origWithdraw === 'function') window.flMaintWithdrawFromMemos = function(jobId){
    if(!on()) return origWithdraw.apply(this, arguments);
    var jobs = typeof FL_MAINT !== 'undefined' && Array.isArray(FL_MAINT) ? FL_MAINT : [];
    var m = jobs.find(function(x){ return x && x.id === jobId; }); if(!m) return;
    return load(jobId).then(function(all){
      var L = (all || []).filter(function(x){ return x.qty > 0; });
      if(!L.length){ if(typeof window.flShowToast === 'function') window.flShowToast('ไม่มีของจาก Memo ที่รอเบิกแล้ว'); return null; }
      var txt = L.slice(0, 12).map(function(x){ return '  · ' + x.inv.name + ' × ' + x.qty + ' ' + (x.inv.unit || '') + ' · ' + x.loc + (x.qty < x.want ? (' (ขาด ' + (x.want - x.qty) + ' · ของในคลังไม่พอ)') : ''); }).join('\n')
        + (L.length > 12 ? ('\n  · และอีก ' + (L.length - 12) + ' รายการ') : '');
      if(!confirm('เบิกของจาก Memo ลงงาน ' + (m.no || '') + ' ทั้งหมด ' + L.length + ' รายการ?\n\n' + txt)) return null;
      return O.queue(function(){ return O.post('/v1/fleet/jobs/' + enc(jobId) + '/memo-withdraw', {}); }).then(function(res){
        delete cache[jobId];
        var stock = O.fleetStock && typeof O.fleetStock.refetch === 'function' ? O.fleetStock.refetch() : null;
        var jobsLoad = O.fleetJobs && typeof O.fleetJobs.load === 'function' ? O.fleetJobs.load() : null;
        return Promise.all([stock, jobsLoad]).then(function(){
          O.wrote('fleet-job-part-add');
          try{ if(typeof window.flMaintRefreshParts === 'function') window.flMaintRefreshParts(jobId); }catch(_){}
          return load(jobId);
        }).then(function(){
          redrawHost(jobId);
          if(typeof window.flShowToast === 'function') window.flShowToast('เบิกลงงาน ' + (m.no || '') + ' แล้ว ' + ((res && res.issued) || 0) + ' รายการ' + (res && res.failed ? (' · ไม่สำเร็จ ' + res.failed) : ''));
          return res;
        });
      }, function(e){
        if(e && e.code === 'memo_nothing_pending'){ delete cache[jobId]; redrawHost(jobId); if(typeof window.flShowToast === 'function') window.flShowToast('ไม่มีของจาก Memo ที่รอเบิกแล้ว'); return null; }
        O.fail('Could not withdraw memo parts to the job', e); return null;
      });
    });
  };
  /* A receive, a part added or taken off: what is pending changes. */
  if(typeof O.onWrite === 'function') O.onWrite(function(kind){ if(/^fleet-(memo-receive|job-part-add|job-part-remove)$/.test(String(kind || ''))) cache = {}; });

  window.__laOpsMemoWithdraw = { load: load, legacyLine: legacyLine, cache: function(){ return cache; } };
})();
