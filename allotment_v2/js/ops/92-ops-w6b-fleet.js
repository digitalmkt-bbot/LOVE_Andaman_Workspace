/* ══════════════════════════════════════════════════════════════════════════
   §opsW6bFleet (w6-b, 2026-10-18) · the Fleet rules the backend now answers (w5-b MISSING-SERVER-FIELD list, fleet part) ⇄ operation-backend
   ──────────────────────────────────────────────────────────────────────────
   Source: docs/walk/w5-b.md section 4; the server side is operation-backend todo/w5b-model.md and the README section
   "Server fields for the walk's MISSING-SERVER-FIELD list". One wrapper per legacy function. Nothing here works a figure out: the
   answer is read, drawn, and kept until a write; legacy's own answer is drawn only before the first answer arrives, offline, and for a
   record the server did not describe. Only user choices are sent.

     flProjYoYStats      ← GET /v1/fleet/projects/stats?year=            {this_year, last_year, previous_year}
     flProjInsight       ← GET /v1/fleet/projects/{id}                    insights {lines, recs}
     flMaintStashConfirm ← POST /v1/fleet/jobs/{id}/assets/{idx}/stash   {location, note?}  (one transaction: part off, spare, job line, history)
     flStartGearSwap     ← POST /v1/fleet/jobs/{id}/swap-out {engine_id} (a job that is already started: the engine row's swap button)
     _flBoatRanOn        ← GET /v1/boats/{id}/ran-on?date=               ran     (the "starts today / tomorrow" line of the new-job preview)
     flOpenSwapModal     ← GET /v1/fleet/incidents/{id}/swap-options     spares in four groups, model_match
     invDupScan / invDupMerge ← GET /v1/fleet/stock-items/duplicates     dup {keep_id, drop_ids}, need_part_no, ok
     flwMemoOpen / flwMemoLabel ← GET /v1/fleet/work                     memos {id, open, label}, open_memo_ids
     faDocData           ← GET /v1/fleet/certificates                    group, next {days, types}, counts.all / no_date
     _swapDocStep2       ← GET /v1/fleet/safety/{id}/replace-preview     next_pm, pm_months

   Classic script, after js/ops/81-ops-fleet-w5.js, 24-ops-fleet-jobs.js, 25-ops-fleet-stock.js and 68-ops-fleet-views.js.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  function enabled(){ return !!(O.enabled && O.enabled()); }
  function enc(v){ return encodeURIComponent(v == null ? '' : String(v)); }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function fn(name){ return typeof window[name] === 'function' ? window[name] : null; }

  function wrap(name, f){
    var orig = window[name];
    if(typeof orig !== 'function' || orig.__w6b) return;
    var w = function(){
      if(!enabled()) return orig.apply(this, arguments);
      return f.apply(this, [orig].concat([].slice.call(arguments)));
    };
    w.__w6b = true; w.__orig = orig; window[name] = w;
  }

  /* ── one read cache: an answer is kept; a write marks it stale (it is read again, the old answer is drawn meanwhile) ── */
  var cache = {}, asked = {};
  function stale(){ Object.keys(cache).forEach(function(k){ cache[k].stale = true; }); asked = {}; }
  O.onWrite(stale);
  if(O.onChange) O.onChange(stale);
  function read(key, path, q, redraw){
    var c = cache[key];
    if((!c || c.stale) && !asked[key]){
      asked[key] = true;
      O.get(path, q).then(function(d){
        var changed = !c || JSON.stringify(c.data) !== JSON.stringify(d);
        cache[key] = { data: d, stale: false }; delete asked[key];
        if(changed && redraw && !O.busy()){ try{ redraw(d); }catch(_){} }
      }, function(e){
        asked[key] = 'failed';       // not asked again until the next write; the screen keeps legacy's answer
        try{ console.warn('[ops] ' + path + ' · ' + (e && e.message)); }catch(_){}
      });
    }
    return c ? c.data : null;
  }
  function redrawJobs(){
    try{ if(fn('flRenderMaint') && document.getElementById('fl-maint-list')) window.flRenderMaint(); }catch(_){}
    try{ if(fn('flBoardRefresh') && document.getElementById('fl-board')) window.flBoardRefresh(); }catch(_){}
  }

  /* ══ Projects: year over year, and the insight card ═══════════════════════════════════════════════════════ */
  function yoyIn(s){
    s = s || {};
    return { count: +s.count || 0, completed: +s.completed || 0, cancelled: +s.cancelled || 0, totalSpend: +s.total_spend || 0, avgCost: +s.avg_cost || 0,
      avgDuration: +s.avg_duration || 0, onTimePct: +s.on_time_pct || 0, avgSlip: +s.avg_slip || 0,
      byType: Object.assign({ drydock: 0, overhaul: 0, refit: 0, scheduled: 0, other: 0 }, s.by_type || {}),
      monthSpend: Array.isArray(s.month_spend) ? s.month_spend.slice(0, 12) : [0,0,0,0,0,0,0,0,0,0,0,0] };
  }
  wrap('flProjYoYStats', function(orig, yearTY){
    var y = yearTY || new Date(String(typeof TODAY_STR !== 'undefined' ? TODAY_STR : O.today())).getFullYear();
    var s = read('yoy|' + y, '/v1/fleet/projects/stats', { year: y }, function(){
      if(document.getElementById('fl-proj-yoy-body') && fn('flProjRenderYoyModal')) window.flProjRenderYoyModal();
    });
    if(!s || !s.this_year) return orig.apply(this, [].slice.call(arguments, 1));
    return { yearTY: +s.year || y, yearLY: +s.previous_year || (y - 1), TY: yoyIn(s.this_year), LY: yoyIn(s.last_year) };
  });

  wrap('flProjInsight', function(orig, p){
    if(!p || !p.id) return orig.apply(this, [].slice.call(arguments, 1));
    var d = read('ins|' + p.id, '/v1/fleet/projects/' + enc(p.id), null, function(){
      if(typeof _selProjId !== 'undefined' && _selProjId === p.id && fn('flProjRenderDetail')) window.flProjRenderDetail(p.id);
    });
    var ins = d && d.insights;
    if(!ins || !Array.isArray(ins.lines)) return orig.apply(this, [].slice.call(arguments, 1));
    return { lines: ins.lines.slice(), recs: (ins.recs || []).slice() };
  });

  /* ══ Stash a gearbox / propeller out of a job: ONE command ═════════════════════════════════════════════════
     Legacy: the part becomes a spare at the chosen place, leaves the job, and a line goes on the job log. The server does all of it in
     one transaction (409 not_stashable for any other asset). The dialog's place and note are the only things sent. */
  wrap('flMaintStashConfirm', function(orig){
    var st = window._flStash; window._flStash = null;
    var close = function(){ if(fn('closeModal')) window.closeModal('fl-modal-stash'); };
    if(!st){ close(); return null; }
    var jobs = (typeof FL_MAINT !== 'undefined' && Array.isArray(FL_MAINT)) ? FL_MAINT : [];
    var m = jobs.find(function(x){ return x && x.id === st.jobId; });
    var a = m && m.assets ? m.assets[st.idx] : null;
    if(!a){ close(); return null; }
    if(!(a.gbId || a.propId)){ alert('ถอดเก็บได้เฉพาะเกียร์/ใบจักร'); close(); return null; }
    var sel = document.getElementById('fl-stash-loc'), noteEl = document.getElementById('fl-stash-note');
    var locKey = sel ? sel.value : 'pier:central';
    var locs = (typeof FL_STASH_LOCS !== 'undefined') ? FL_STASH_LOCS : [];
    var locLabel = (locs.find(function(l){ return l.key === locKey; }) || {}).label || locKey;
    var note = noteEl ? String(noteEl.value || '').trim() : '';
    var lbl = a.label || '';
    var body = { location: locKey }; if(note) body.note = note;
    return O.queue(function(){
      return O.post('/v1/fleet/jobs/' + enc(m.id) + '/assets/' + enc(st.idx) + '/stash', body);
    }).then(function(){
      return O.fleetJobs.refetchAll(m.boatId);
    }).then(function(){
      O.wrote('fleet-job-stash');
      close();
      if(fn('flRenderMaintDetail')) window.flRenderMaintDetail(st.jobId);
      if(fn('flShowToast')) window.flShowToast('ถอดเก็บ ' + lbl + ' → ' + locLabel);
      return null;
    }).catch(function(e){ O.fail('Could not stash the part', e); return null; });
  });

  /* ══ Swap an engine out of a job that is ALREADY started (the engine row's swap button) ═════════════════════
     POST …/swap-out {engine_id}: the engine goes off the boat as fixing, its gearbox and propeller stay on the boat waiting for the
     replacement, and the logs are written; `waiting` lists the positions to fill. The replacement picker of legacy is shown from it; the
     install and skip steps are the wrappers of 24-ops-fleet-jobs.js (they run on ctx.started). */
  wrap('flStartGearSwap', function(orig){
    var ctx = window._flStartGear;
    if(!ctx || !ctx.reentry) return orig.apply(this, [].slice.call(arguments, 1));
    return O.queue(function(){
      return O.post('/v1/fleet/jobs/' + enc(ctx.jobId) + '/swap-out', ctx.onlyEngId ? { engine_id: ctx.onlyEngId } : {});
    }).then(function(res){
      ctx.swaps = ((res && res.waiting) || []).map(function(w){ return { oldEngId: w.engine_id, pos: w.pos, filled: false }; });
      ctx.swap = true; ctx.started = true;
      return O.fleetJobs.refetchAll(ctx.boatId).then(function(){
        O.wrote('fleet-job-swap-out');
        redrawJobs();
        if(fn('flStartSwapRenderPicker')) window.flStartSwapRenderPicker();
        return res;
      });
    }).catch(function(e){ O.fail('Could not swap the engine out', e); return null; });
  });

  /* ══ New job / incident preview: did the boat already run today? ═══════════════════════════════════════════
     The preview says the boat "becomes Fixing from tomorrow, because it already ran a trip today". `ran` is the server's (a deployment or
     a live booking that day, the rule the start itself uses). */
  wrap('_flBoatRanOn', function(orig, boatId, ds){
    var legacy = orig.apply(this, [].slice.call(arguments, 1));
    if(!boatId || !ds) return legacy;
    var r = read('ran|' + boatId + '|' + ds, '/v1/boats/' + enc(boatId) + '/ran-on', { date: ds }, function(d){
      if(d && !!d.ran !== !!legacy && document.getElementById('fln-prev') && fn('flnPreview')) window.flnPreview();
    });
    return r ? !!r.ran : legacy;
  });

  /* ══ Quick Swap (spare exchange during an incident): the spares offered ═════════════════════════════════════
     The server lists the spares that fit (a gearbox of the same brand, a propeller of the same size, never at a shop), in four groups:
     on the boat, at the pier the boat works from now, at its home pier, at another pier. Legacy's dialog is drawn first, then drawn again
     from the server's answer. */
  function swapBody(o, damaged, assetType){
    var pierLbl = function(p){ return ((typeof PIER_LABELS !== 'undefined' && PIER_LABELS[p]) || p || '—'); };
    var spares = o.spares || [];
    var render = function(list){
      return list.map(function(s){
        var info = fn('flParseSpareLoc') ? window.flParseSpareLoc(s.location) : { icon: '' };
        var ok = s.model_match !== false;
        var warn = !ok ? '<span style="background:#FAEEDA;color:#854F0B;padding:2px 6px;border-radius:7px;font-size:9px;font-weight:600;letter-spacing:.02em" title="Model ของ spare ไม่ตรงกับเกียร์ที่พัง · ใส่แทนแล้วอาจไม่เข้ากับตำแหน่ง/ทิศหมุน">⚠ model ต่าง</span>' : '';
        var dim = !ok ? 'opacity:.78;' : '';
        var spare = (typeof FL_GEARBOXES !== 'undefined' ? FL_GEARBOXES : []).concat(typeof FL_PROPELLERS !== 'undefined' ? FL_PROPELLERS : []).find(function(x){ return x.id === s.id; }) || {};
        var line = !ok ? '<div style="font-size:9.5px;color:#854F0B;margin-top:2px">spare: ' + esc(spare.model || '?') + ' · damaged: ' + esc((damaged && damaged.model) || '?') + '</div>' : '';
        return '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid ' + (ok ? 'var(--border)' : '#f0c875') + ';border-radius:6px;cursor:pointer;background:' + (ok ? 'var(--white)' : '#fffaf0') + ';' + dim + 'transition:all .12s" onclick="flConfirmSwap(\'' + esc(s.id) + '\')">'
          + '<span style="font-size:14px">' + (info.icon || '') + '</span><div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">'
          + '<span style="font-family:\'DM Mono\',monospace;font-size:11px;font-weight:600">' + esc(s.label) + '</span>' + warn + '</div>'
          + '<div style="font-size:10px;color:var(--ink-soft);margin-top:1px">' + esc(s.location_label) + (s.note ? ' · ' + esc(s.note) : '') + '</div>' + line + '</div>'
          + '<span style="font-size:9px;color:' + (ok ? 'var(--ocean)' : '#854F0B') + ';font-weight:600;text-transform:uppercase">เลือก</span></div>';
      }).join('');
    };
    var by = function(g){ return spares.filter(function(s){ return s.group === g; }); };
    var sec = function(list, head, color){ return list.length ? '<div style="margin-bottom:12px"><div style="font-size:10px;font-weight:600;color:' + color + ';text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px">' + head + '</div><div style="display:flex;flex-direction:column;gap:4px">' + render(list) + '</div></div>' : ''; };
    var onBoat = by('on_boat'), cur = by('current_pier'), home = by('home_pier'), other = by('other_pier');
    var brand = damaged ? damaged.brand : '';
    return '<div style="margin-bottom:12px"><div style="font-size:11px;color:var(--ink-soft);margin-bottom:4px">เปลี่ยนแทน:</div>'
      + '<div style="background:var(--red-light);border:1px solid rgba(196,58,46,.2);border-radius:6px;padding:8px 10px"><div style="font-family:\'DM Mono\',monospace;font-size:11px;font-weight:600;color:var(--red)">' + esc(damaged && damaged.serial) + '</div>'
      + '<div style="font-size:10px;color:var(--ink-mid);margin-top:1px">' + esc(brand) + ' ' + esc((damaged && (damaged.model || damaged.size)) || '') + ' · ' + esc((damaged && damaged.note) || '') + '</div></div></div>'
      + sec(onBoat, '🚢 บนเรือลำนี้ (เร็วที่สุด)', '#1c4e7e')
      + (o.moved_away ? '<div style="margin-bottom:10px;background:#EAF3FA;border:1px solid #BFD9F2;border-radius:8px;padding:7px 10px;font-size:10.5px;color:#0C447C;line-height:1.5">&#9875; เรือลำนี้<b> ย้ายมาอยู่ ' + esc(pierLbl(o.current_pier)) + '</b> ชั่วคราว (ท่าประจำคือ ' + esc(pierLbl(o.home_pier)) + ') &middot; คลังของท่าที่เรืออยู่ตอนนี้ขึ้นก่อน</div>' : '')
      + sec(cur, '🏪 คลังท่าที่เรืออยู่ตอนนี้ &middot; ' + esc(pierLbl(o.current_pier)), '#0e6b87')
      + sec(home, '&#128666; คลังท่าประจำ &middot; ' + esc(pierLbl(o.home_pier)) + ' <span style="text-transform:none;font-weight:500;opacity:.85">(ต้องขนมาก่อนใช้)</span>', '#854F0B')
      + sec(other, '📦 ท่าอื่น <span style="text-transform:none;font-weight:500;opacity:.85">(ต้องขนมาก่อนใช้)</span>', 'var(--ink-soft)')
      + (!spares.length ? '<div style="text-align:center;padding:20px;font-size:12px;color:var(--ink-soft);line-height:1.6"><div style="font-size:24px;opacity:.3;margin-bottom:8px">📭</div>'
        + '<div style="font-weight:600;color:var(--ink-mid);margin-bottom:3px">ไม่มีสแปร์ ' + esc(brand) + ' ในคลังไหนเลย</div>'
        + '<div style="font-size:11px">ไม่พบ ' + (assetType === 'gearbox' ? 'เกียร์' : 'ใบจักร') + ' ' + esc(brand) + ' ทั้งบนเรือลำนี้และในคลังทุกท่า<br/><span style="color:var(--ink-soft)">เพิ่ม spare ใหม่ หรือเช็คว่ามีตัวที่อยู่ร้านซ่อม (shop) รอรับกลับอยู่ไหม</span></div></div>' : '');
  }
  wrap('flOpenSwapModal', function(orig, incId, assetType, assetId){
    var ret = orig.apply(this, [].slice.call(arguments, 1));
    if(!incId || !assetType || !assetId) return ret;
    var paint = function(o){
      var body = document.getElementById('fl-swap-body');
      var ctx = (typeof flSwapCtx !== 'undefined') ? flSwapCtx : null;
      if(!o || !body || !ctx || ctx.incId !== incId || ctx.assetId !== assetId) return;
      var arr = assetType === 'gearbox' ? (typeof FL_GEARBOXES !== 'undefined' ? FL_GEARBOXES : []) : (typeof FL_PROPELLERS !== 'undefined' ? FL_PROPELLERS : []);
      var damaged = arr.find(function(x){ return x.id === assetId; });
      body.innerHTML = swapBody(o, damaged, assetType);
    };
    var hit = read('swap|' + incId + '|' + assetType + '|' + assetId, '/v1/fleet/incidents/' + enc(incId) + '/swap-options', { asset_type: assetType, asset_id: assetId }, paint);
    if(hit) paint(hit);
    return ret;
  });

  /* ══ Inventory duplicate scan ══════════════════════════════════════════════════════════════════════════════
     Which items are the same part (name + part number), which share a name and need a part number, and which one to keep when merging
     (longest history, then most stock) are the server's. The dialog draws from the legacy shape; the merge sends the server's keep_id and
     drop_ids. */
  var dupGroups = {};
  function invById(id){ return (typeof _invAll === 'function' ? _invAll() : []).find(function(x){ return x && x.id === id; }); }
  function member(m){
    var x = invById(m.id);
    if(x) return x;
    return { id: m.id, name: m.name, partNo: m.part_no || '', totalQty: m.total_qty, qty: m.total_qty, unit: '', supplier: '', history: new Array(m.history_count || 0) };
  }
  wrap('invDupScan', function(orig){
    var d = read('dups', '/v1/fleet/stock-items/duplicates', null, function(){
      if(document.getElementById('inv-dup-ov') && fn('invDupOpen')) window.invDupOpen(true);
    });
    if(!d || !Array.isArray(d.dup)) return orig.apply(this, [].slice.call(arguments, 1));
    dupGroups = {};
    var keyOf = typeof _invKeyOf === 'function' ? _invKeyOf : function(n, p){ return n + '\u0000' + p; };
    return {
      dup: d.dup.map(function(g){
        var key = keyOf(g.name, g.part_no || '');
        dupGroups[key] = g;
        return { key: key, name: g.name, pn: g.part_no || '', list: g.members.map(member), server: g };
      }),
      needPn: (d.need_part_no || []).map(function(g){ return { name: g.name, list: g.members.map(member), noPn: g.no_part_no }; }),
      ok: (d.ok || []).map(function(g){ return { name: g.name, list: g.members.map(member) }; })
    };
  });
  /* opening the scan always asks again (the lists change as stock is edited); the redraw after the answer reuses it */
  wrap('invDupOpen', function(orig, fromAnswer){
    if(fromAnswer !== true){ if(cache['dups']) cache['dups'].stale = true; delete asked['dups']; }
    return orig.apply(this, [].slice.call(arguments, 1));
  });
  wrap('invDupMerge', function(orig, keyEnc){
    if(typeof laGuardEdit === 'function' && !laGuardEdit('fleet')) return null;
    var key = decodeURIComponent(keyEnc || '');
    var g = dupGroups[key];
    if(!g) return orig.apply(this, [].slice.call(arguments, 1));
    var keep = member(g.members.find(function(m){ return m.id === g.keep_id; }) || g.members[0]);
    var unit = keep.unit || 'ชิ้น';
    if(!confirm('รวม "' + keep.name + '" ' + g.members.length + ' รายการเป็นรายการเดียว?\n\nยอดรวมหลังรวม ' + g.total_qty + ' ' + unit + ' (เท่าเดิม ไม่มีของหาย)')) return null;
    return O.fleetStock.mergeStock(g.keep_id, g.drop_ids).then(function(){
      O.wrote('fleet-stock-merge');
      if(fn('flShowToast')) window.flShowToast('รวมแล้ว · ' + keep.name);
      if(fn('flRenderInventory')) window.flRenderInventory();
      if(fn('invDupOpen')) window.invDupOpen();
    }).catch(function(e){ O.fail('Could not merge stock items', e); return null; });
  });

  /* ══ Fleet Work: which memos of a job are open ═════════════════════════════════════════════════════════════
     Each job item of GET /v1/fleet/work lists its memos with `open` (pending approval, or approved / ordered and not labour) and the
     server's `label` ("approved, not paid yet" ...). The page reads the same cache as flwItems (68-ops-fleet-views.js). */
  function workMemos(){
    if(!O.fleetViews || !O.fleetViews.read) return null;
    var w = O.fleetViews.read('/v1/fleet/work', { boats: 'all' }, function(){
      if(document.getElementById('view-fl-work') && document.getElementById('view-fl-work').classList.contains('active') && fn('flRenderWork')) window.flRenderWork();
    });
    if(!w) return null;
    var by = {};
    (w.boats || []).forEach(function(b){ (b.items || []).forEach(function(it){ (it.memos || []).forEach(function(m){ if(m && m.id) by[m.id] = m; }); }); });
    return by;
  }
  wrap('flwMemoOpen', function(orig, mo){
    var by = workMemos(), s = by && mo && by[mo.id];
    return s ? !!s.open : orig.apply(this, [].slice.call(arguments, 1));
  });
  wrap('flwMemoLabel', function(orig, mo){
    var by = workMemos(), s = by && mo && by[mo.id];
    return s && s.label ? s.label : orig.apply(this, [].slice.call(arguments, 1));
  });

  /* ══ Documents: the boat's group and its "next to do" ═══════════════════════════════════════════════════════
     `group` (0 due within 30 days, 1 expired or no date, 2 within 90 days, 3 the rest) and `next {days, types}` are on each boat row of
     GET /v1/fleet/certificates; the tiles use counts.all and counts.no_date (a document with no expiry date is counted with the expired). */
  wrap('faDocData', function(orig){
    var D = orig.apply(this, [].slice.call(arguments, 1));
    var c = O.fleetBoats && O.fleetBoats.certificates ? O.fleetBoats.certificates() : null;
    if(!D || !Array.isArray(D.rows) || !c || !Array.isArray(c.boats)) return D;
    var by = {}; c.boats.forEach(function(r){ by[r.boat_id] = r; });
    D.rows.forEach(function(r){
      var s = r.b && by[r.b.id];
      if(!s || typeof s.group !== 'number') return;
      r.grp = s.group;
      r.next = s.next ? { d: s.next.days, k: (s.next.types || []).slice() } : null;
    });
    var K = c.counts;
    if(K && typeof K.no_date === 'number' && D.c){
      D.c.exp = (+K.exp || 0) + K.no_date;
      D.c.all = typeof K.all === 'number' ? K.all : (D.c.ok + D.c.w90 + D.c.w30 + D.c.proc + D.c.exp);
    }
    return D;
  });

  /* ══ Replace wizard, step 2: the next PM date ══════════════════════════════════════════════════════════════
     Install date + the category's months (pm_months) is worked out by the server and nothing is written. Legacy's date is drawn until
     it arrives, then the step is drawn again. */
  wrap('_swapDocStep2', function(orig, it){
    var html = orig.apply(this, [].slice.call(arguments, 1));
    var sd = (typeof _swapDoc !== 'undefined') ? _swapDoc : null;
    if(!sd || !sd.installDate || !it || !it.id) return html;
    var p = read('prev|' + it.id + '|' + sd.installDate, '/v1/fleet/safety/' + enc(it.id) + '/replace-preview', { install_date: sd.installDate }, function(){
      if(typeof _swapDoc !== 'undefined' && _swapDoc && _swapDoc.step === 2 && fn('swapDocRender')) window.swapDocRender();
    });
    if(!p || !p.next_pm) return html;
    return html.replace(/(Next PM <span[^>]*>)([^<]*)(<\/span><\/div><div[^>]*>)([^<]*)(<\/div>)/, function(m, a, mo, b, d, e){ return a + p.pm_months + 'mo' + b + p.next_pm + e; });
  });
})();
