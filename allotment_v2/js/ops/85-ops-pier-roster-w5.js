/* ══════════════════════════════════════════════════════════════════════════
   §opsPierRosterW5 (w5-f, 2026-10-18) · the roster page: counts, TOTAL, range paste and notes are the server's
   ──────────────────────────────────────────────────────────────────────────
   Server: operation-backend README "Pier office: roster and pay".

     renderPierAtt / paRowTotal   ← GET …/roster `rows[].totals { by_code, work, row_total, nights }`: each person's per-code counts,
                                    work days, TOTAL (work + OFF + PH) and nights. 48-ops-pier-office.js keeps them with the roster
                                    (P.rosterTotals); a small marked edit in renderPierAtt (08-app.js, "[w5-f small edit]") asks
                                    window.opsPierAttTotals for them. Not used while a hand edit is waiting to be sent, or before the
                                    roster of the range has been read: legacy's own counting shows then.
     paRangeApply                 → POST …/roster/range { staff_ids, from, to, code, dow?, is_plan, overwrite }: ONE call; the server
                                    decides which cells are skipped (a cell with a code is kept unless overwrite) and answers
                                    { written, skipped }; the roster is then read again.
     paNote / paCycNote           → PUT …/roster/notes/{cycle}/{staff_id} { note } and ← GET …/roster/notes?cycle=YYYY-MM.
                                    A note of 121 characters or more is the server's 400 (legacy cut it silently at 120).
   paCycle stays the browser's (cycle dates follow the synced cycle_start setting; the roster read takes any from/to).
   Legacy mode: every wrapper delegates to the captured original. Classic script · after 48-ops-pier-office.js.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O || !O.pier) return;
  var P = O.pier, enc = encodeURIComponent;
  function on(){ return P.enabled() && P.loaded; }
  function wrap(name, fn){
    var orig = window[name];
    if(typeof orig !== 'function' || orig.__w5f) return;
    var w = function(){
      var args = [].slice.call(arguments);
      if(!on()) return orig.apply(this, args);
      return fn.apply(this, [orig].concat(args));
    };
    w.__w5f = true; w.__orig = orig; window[name] = w;
  }

  /* ── totals ─────────────────────────────────────────────────────────── */
  window.opsPierAttTotals = function(pier, sid, from, to){
    if(!on() || typeof P.rosterTotals !== 'function') return null;
    var t = P.rosterTotals(pier, sid, from, to); if(!t) return null;
    var cnt = {}; Object.keys(t.by_code || {}).forEach(function(c){ if(+t.by_code[c]) cnt[c] = +t.by_code[c]; });
    Object.defineProperty(cnt, '__rowTotal', { value: +t.row_total || 0, enumerable: false });   // paRowTotal reads it back
    return { cnt: cnt, w: +t.work || 0, nights: +t.nights || 0 };
  };
  wrap('paRowTotal', function(orig, w, cnt){
    if(cnt && typeof cnt.__rowTotal === 'number') return cnt.__rowTotal;   // the server's row_total of this person
    return orig.apply(this, [].slice.call(arguments, 1));
  });

  /* ── cycle notes ────────────────────────────────────────────────────── */
  var notes = {}, noteLoading = {};
  function nkey(pier, cycle){ return pier + '|' + cycle; }
  function cycleOf(from){ return String(from || '').slice(0, 7); }
  O.onWrite(function(kind){ if(kind === 'pier') Object.keys(notes).forEach(function(k){ notes[k].old = true; }); });
  function loadNotes(pier, cycle){
    var k = nkey(pier, cycle); if(noteLoading[k]) return; noteLoading[k] = true;
    O.get('/v1/pier-office/' + enc(pier) + '/roster/notes', { cycle: cycle }).then(function(j){
      var was = notes[k] ? JSON.stringify(notes[k].map) : null;
      notes[k] = { map: (j && j.notes) || {}, old: false };
      delete noteLoading[k];
      if(was !== JSON.stringify(notes[k].map) && !P.busy() && typeof window.renderPierAtt === 'function' && window._poPier === pier) window.renderPierAtt();
    }, function(e){
      delete noteLoading[k]; notes[k] = notes[k] || { map: null, old: false };
      if(!(e && e.status === 403)) O.fail('Roster notes did not load', e);
    });
  }
  wrap('renderPierAtt', function(orig){
    var r = orig.apply(this, [].slice.call(arguments, 1));
    try{
      var pier = window._poPier, cy = typeof window.paCycle === 'function' ? window.paCycle(window._paDate) : null;
      if(pier && cy){ var n = notes[nkey(pier, cycleOf(cy.from))]; if(!n || n.old) loadNotes(pier, cycleOf(cy.from)); }
    }catch(_){}
    return r;
  });
  wrap('paCycNote', function(orig, from, sid){
    var n = notes[nkey(window._poPier, cycleOf(from))];
    if(n && n.map && !n.old) return n.map[sid] != null ? String(n.map[sid]) : '';
    if(n && n.map) return n.map[sid] != null ? String(n.map[sid]) : '';     // an old answer stays until the new one lands
    return orig.apply(this, [].slice.call(arguments, 1));
  });
  wrap('paNote', function(orig, sid, txt){
    if(typeof window.poGuard === 'function' && !window.poGuard()) return;
    var pier = window._poPier, from = window.paCycle(window._paDate).from, cycle = cycleOf(from), v = String(txt == null ? '' : txt).trim();
    return P.flush().then(function(){
      return O.queue(function(){ return O.call('PUT', '/v1/pier-office/' + enc(pier) + '/roster/notes/' + enc(cycle) + '/' + enc(sid), { note: v || null }); });
    }).then(function(r){
      var n = notes[nkey(pier, cycle)] || (notes[nkey(pier, cycle)] = { map: {}, old: false });
      n.map = n.map || {};
      if(r && r.note) n.map[sid] = r.note; else delete n.map[sid];
    }, function(e){
      O.fail('Note not saved' + (e && e.code ? ' · ' + e.code : ''), e);
      if(typeof window.renderPierAtt === 'function') window.renderPierAtt();     // the box goes back to the saved note
    });
  });

  /* ── range paste ────────────────────────────────────────────────────── */
  wrap('paRangeApply', function(orig){
    var ids = []; document.querySelectorAll('.pa-rs:checked').forEach(function(x){ ids.push(x.value); });
    if(!ids.length){ var m = document.getElementById('pa_msg'); if(m) m.innerHTML = '<b style="color:#C0271C">เลือกพนักงานอย่างน้อย 1 คน</b>'; return; }
    var d1 = window.poV('pa_d1'), d2 = window.poV('pa_d2'), code = window.poV('pa_code'), dow = window.poV('pa_dow'), ovr = window.poV('pa_ovr') === '1';
    var plan = window.poV('pa_lay') !== '0';     // §paLayers · a range is a plan by default
    if(!d1 || !d2 || d2 < d1){ alert('ช่วงวันที่ไม่ถูกต้อง'); return; }
    var pier = window._poPier, body = { staff_ids: ids, from: d1, to: d2, code: code, is_plan: plan, overwrite: ovr };
    if(dow !== '') body.dow = +dow;
    return P.flush().then(function(){
      return O.queue(function(){ return O.call('POST', '/v1/pier-office/' + enc(pier) + '/roster/range', body); });
    }).then(function(r){
      O.wrote('pier');                      // the roster is read again (48 invalidates on a pier write)
      window.poModalClose(); window.renderPierAtt();
      var n = (r && r.written) || 0, skip = (r && r.skipped) || 0;
      alert('ลง' + (plan ? 'โครงงาน' : 'แก้ทับ') + 'แล้ว ' + n + ' ช่อง'
        + (skip ? (' · ข้าม ' + skip + ' ช่องที่ลงไว้แล้ว') : '')
        + (plan ? '\n\nช่องเหล่านี้เป็นฐาน · จัดคนลงใบงานเรือวันไหน วันนั้นจะขึ้นรหัสเส้นทางทับให้เอง' : ''));
    }, function(e){
      var m = document.getElementById('pa_msg');
      if(m) m.innerHTML = '<b style="color:#C0271C">' + String((e && e.message) || 'Not applied').replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</b>';
      O.fail('Range not applied' + (e && e.code ? ' · ' + e.code : ''), e);
    });
  });
})();
