/* ════════════════════════════════════════════════════════════════════════
   §opsFleetWork (2026-10-20) · FE-11 · Fleet Work: oil board, closed jobs, job summary (05-fleet.js §flwOil, §flwSum) on operation-backend
   ────────────────────────────────────────────────────────────────────────
   GET /v1/fleet/oil-board                    rows[], counts   → flwOilRows / flwOilRate (flwOilCounts and the "open job" button read the mapped rows)
   GET /v1/fleet/work/done?boat_id=           items[]          → flwDoneItems(boatId)  (closed in the last 30 days, newest first)
   GET /v1/fleet/work/summary?kind=job|incident&id=            → flwsOpen asks first; flwsData / flwsText / flwsShort answer from it
   Legacy computed these from FL_DAILY, FL_MAINT, FL_ENGINES, the photo lists and the browser's clock. The sync readers answer from a cache and the
   page is drawn again (flRenderWork) when the server's answer lands; the summary sheet opens when its answer is in (a refusal is a toast).
   The text in "Copy text" (short and full) is the server's own (text, short_text). Rows are mapped to legacy's shapes:
     oil row    {b, engs[{e, ss{curH, interval, base, since, left}, noData, rate}], worst, st, rate, gb{g, ss}, mj{key, no, title}, pier, nNo}
     done item  {key 'dn:<id>', kind 'mj', id, no, title, boatId, stage 6, done, owner, silent 0, cost, sub, projId, ref}
     summary    {kind, m, inc, b, memos, parts, pc, cost, log[{d, t, by}], hidPk, photos, proj, text, shortText}
   Open item (server): the 30-day window of closed jobs is the server's; a job closed longer ago still opens from the Maintenance page because legacy's
   special case (FLW.item === 'dn:<id>') is kept here from the local job record. Classic script · after 24-ops-fleet-jobs.js and 99-ops-fleet-photos.js.
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var NAMES = ['flwOilRows', 'flwOilRate', 'flwDoneItems', 'flwsOpen', 'flwsData', 'flwsText', 'flwsShort', 'flwMemoLabel'];
  var orig = {};
  NAMES.forEach(function(n){ orig[n] = window[n]; });
  var TTL = 60000;

  function enc(x){ return encodeURIComponent(x); }
  function num(v){ var n = Number(v); return Number.isFinite(n) ? n : 0; }
  function viewOn(){ try{ return !!(O.activeView && O.activeView() === 'fl-work'); }catch(_){ return false; } }
  function redraw(){
    try{ if(viewOn() && typeof window.flRenderWork === 'function' && !(O.busy && O.busy())) window.flRenderWork(); }catch(_){}
  }
  function wrap(name, fn){
    window[name] = function(){
      if(!O.enabled()) return orig[name] ? orig[name].apply(this, arguments) : undefined;
      return fn.apply(this, arguments);
    };
  }
  function boatOf(id, name){
    var b = null; try{ b = typeof window.getBoat === 'function' ? window.getBoat(id) : null; }catch(_){}
    return b || { id: id, name: name || id };
  }

  /* ── oil board ── */
  var oil = { rows: null, raw: null, at: 0, busy: false, json: '' };
  function mapEngine(x, last){
    return { e: { id: x.id, pos: x.pos || '', serial: x.serial || '', lastServiceDate: x.last_service_date || '' },
      ss: { curH: num(x.hours), interval: num(x.interval), base: num(x.base), since: num(x.since), left: x.left == null ? 0 : num(x.left) },
      noData: !!x.no_data, rate: x.rate == null ? null : num(x.rate) };
  }
  function mapOilRow(r){
    var worst = r.worst ? mapEngine(r.worst) : null, gb = r.gearbox;
    return { b: boatOf(r.boat.id, r.boat.name), engs: (r.engines || []).map(mapEngine), worst: worst, st: r.state, rate: r.rate == null ? null : num(r.rate),
      gb: gb ? { g: { id: gb.id, serial: gb.serial || '' }, ss: { since: num(gb.since), interval: num(gb.interval), left: gb.left == null ? 0 : num(gb.left) } } : null,
      mj: r.job ? { key: r.job.key, no: r.job.no, title: r.job.title, id: r.job.id } : null, pier: r.pier || '', nNo: num(r.no_data_count) };
  }
  function askOil(){
    if(oil.busy || (oil.rows && Date.now() - oil.at < TTL)) return;
    oil.busy = true;
    O.get('/v1/fleet/oil-board').then(function(j){
      var json = JSON.stringify(j), changed = json !== oil.json;
      oil.raw = j; oil.json = json; oil.rows = ((j && j.rows) || []).map(mapOilRow); oil.at = Date.now(); oil.busy = false;
      if(changed) redraw();
    }, function(e){
      oil.busy = false; oil.at = Date.now(); if(!oil.rows) oil.rows = [];
      O.fail('The oil-change board did not load', e);
    });
  }
  wrap('flwOilRows', function(){ askOil(); return oil.rows || []; });
  wrap('flwOilRate', function(engId){
    askOil();
    var hit = null; ((oil.raw && oil.raw.rows) || []).forEach(function(r){ (r.engines || []).forEach(function(x){ if(x.id === engId) hit = x; }); });
    return hit && hit.rate != null ? num(hit.rate) : null;
  });

  /* ── closed jobs ── */
  var done = {};   // boat id → { items, at, busy }
  function mapDone(x){
    var rec = null; try{ rec = (window.FL_MAINT || []).filter(function(m){ return m && m.id === x.id; })[0] || null; }catch(_){}
    return { key: x.key, kind: 'mj', id: x.id, no: x.no, title: x.title, boatId: x.boat_id || '', stage: 6, done: true, owner: x.owner || '', silent: 0, cost: num(x.cost),
      sub: x.sub || '', projId: x.project_id || '', ref: rec || { id: x.id, status: 'done', endDate: x.closed_on || '', outcome: x.outcome || null, parentProjectId: x.project_id || null } };
  }
  function askDone(bid){
    var d = done[bid] = done[bid] || { items: null, at: 0, busy: false };
    if(d.busy || (d.items && Date.now() - d.at < TTL)) return d;
    d.busy = true;
    O.get('/v1/fleet/work/done', { boat_id: bid || '' }).then(function(j){
      var items = ((j && j.items) || []).map(mapDone), changed = JSON.stringify(items.map(function(i){ return i.key; })) !== JSON.stringify((d.items || []).map(function(i){ return i.key; }));
      d.items = items; d.at = Date.now(); d.busy = false; if(changed || !d.items.length) redraw();
    }, function(e){ d.busy = false; d.at = Date.now(); if(!d.items) d.items = []; O.fail('Closed jobs did not load', e); });
    return d;
  }
  wrap('flwDoneItems', function(boatId){
    var d = askDone(boatId || ''), out = (d.items || []).slice();
    /* legacy opened a job from the Maintenance page even when it closed more than 30 days ago */
    try{
      var cur = (window.FLW && window.FLW.item) || '';
      if(String(cur).indexOf('dn:') === 0 && !out.some(function(i){ return i.key === cur; })){
        var m = (window.FL_MAINT || []).filter(function(x){ return x && x.id === cur.slice(3) && x.status === 'done' && String(x.boatId || '') === String(boatId || ''); })[0];
        if(m) out.push({ key: cur, kind: 'mj', id: m.id, no: m.no || 'MJ', title: m.title || '(no title)', boatId: m.boatId || '', stage: 6, done: true, owner: String(m.owner || '').trim(), silent: 0,
          cost: num(m.cost), sub: 'closed ' + (m.endDate || '') + (m.outcome ? (' · ' + m.outcome) : ''), projId: m.parentProjectId || '', ref: m });
      }
    }catch(_){}
    return out;
  });

  /* ── job summary ── */
  var sums = {};   // 'mj:<id>' | 'inc:<id>' → the mapped summary
  function mapSummary(kind, S){
    var J = O.fleetJobs || {}, P = O.fleetPhotoFrom || function(x){ return x; };
    var boat = S.boat ? boatOf(S.boat.id, S.boat.name) : null;
    if(boat && S.boat) { boat = Object.assign({}, boat); if(!boat.type) boat.type = S.boat.type; if(!boat.pier) boat.pier = S.boat.pier; }
    return {
      kind: kind, m: S.job && J.fromServerJob ? J.fromServerJob(S.job) : null, inc: S.incident && J.fromServerIncident ? J.fromServerIncident(S.incident) : null, b: boat,
      memos: (S.memos || []).map(function(m){ return { id: m.id, no: m.no, title: m.title, supplier: m.supplier, amount: m.amount, status: m.status, _srvLabel: m.label, _srvOpen: m.open }; }),
      parts: (S.parts || []).map(function(p){ return { name: p.name, qty: p.qty, unit: p.unit, cost: p.cost, location: p.location || '' }; }), pc: num(S.parts_cost), cost: num(S.cost),
      log: (S.log || []).map(function(l, i){ return { d: l.date, t: l.text, by: l.by, o: i }; }), hidPk: num(S.hidden_part_lines),
      photos: (S.photos || []).map(P).filter(function(p){ return p && !p.removed && p.url; }), proj: S.project || null,
      text: S.text || '', shortText: S.short_text || ''
    };
  }
  wrap('flwsOpen', function(kind, id){
    if(kind !== 'mj' && kind !== 'inc') return null;
    return O.get('/v1/fleet/work/summary', { kind: kind === 'mj' ? 'job' : 'incident', id: id }).then(function(S){
      sums[kind + ':' + id] = mapSummary(kind, S);
      return orig.flwsOpen.call(window, kind, id);
    }, function(e){ O.fail('The job summary did not load', e); return null; });
  });
  wrap('flwsData', function(kind, id){ return sums[kind + ':' + id] || null; });
  wrap('flwsText', function(D){ return D && D.text ? D.text : (orig.flwsText ? orig.flwsText.apply(this, arguments) : ''); });
  wrap('flwsShort', function(D){ return D && D.shortText ? D.shortText : (orig.flwsShort ? orig.flwsShort.apply(this, arguments) : ''); });
  /* a summary memo is the server's row: its label (waiting for ...) is the server's too */
  window.flwMemoLabel = function(mo){
    if(mo && mo._srvLabel !== undefined && O.enabled()) return mo._srvLabel;
    return orig.flwMemoLabel ? orig.flwMemoLabel.apply(this, arguments) : '';
  };

  /* a write may change the oil rounds, the jobs on the board or what is closed: ask again the next time the page draws */
  O.onWrite(function(){ oil.at = 0; Object.keys(done).forEach(function(k){ done[k].at = 0; }); sums = {}; });
  O.fleetWork = { oilRows: function(){ return oil.rows; }, _sums: sums };
})();
