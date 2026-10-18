/* ══════════════════════════════════════════════════════════════════════════
   §opsFleetReportW5 (w5-f, 2026-10-18) · Fleet Report (rep-fleet) ⇄ GET /v1/fleet/reports/fleet?from=&to=
   ──────────────────────────────────────────────────────────────────────────
   Server: operation-backend README "The Fleet Report". Legacy repFleetGather walked FL_MAINT / FL_INCIDENTS / FL_PROJECTS / FL_MEMOS /
   FL_SAFETY / FL_INVENTORY / FL_DAILY and getCurStatus boat by boat and day by day in the browser. The server answers the range and
   the same number of days just before it ({ current, previous, stock, data_gaps }); the slides keep their texts and charts.

     repFleetGather(from, to)   the figures object the slides read (availability, days out by boat, incidents, repair jobs, projects,
                                purchasing, engine hours, spare parts, "where the data is thin"), built from current / previous
     renderReport('fleet')      asks for the answer, draws again when it lands
   The "where the data is thin" sentences are the screen's text over the server's codes (data_gaps[].code and numbers).
   Different from legacy by the server's rules (decided on the server side, README "The Fleet Report"): a repair job counts by its start
   date (legacy's mixed start and close dates), a cancelled project is left out, engine hours count every trip type.
   Until the first answer (and if it fails) legacy's own gather runs. Classic script · after 73-ops-srv-reads.js and 26-ops-fleet-daily.js.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O || !O.srv) return;
  function on(){ return !!(O.enabled && O.enabled()); }
  function n(v){ return Number.isFinite(+v) ? +v : 0; }
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
  function key(from, to){ return 'fleet|' + from + '|' + to; }
  var last = null;                       // the answer of the range on screen: its `previous` is the second call of repFleetSlides
  function repaint(){
    if(O.activeView() === 'rep-fleet' && !O.busy() && typeof window.renderReport === 'function') window.renderReport('fleet');
  }
  var CAT = { engine: 'เครื่องยนต์', gearbox: 'เกียร์', propeller: 'ใบจักร', hull: 'ตัวเรือ', general: 'ทั่วไป' };   // legacy's labels of a spare part's category
  function gapsOf(list, cur){
    var out = [];
    (list || []).forEach(function(g){
      if(g.code === 'jobs_without_cost') out.push(['warn', 'Repair cost was entered on ' + g.with_cost + ' of ' + g.started + ' jobs',
        'The repair figure on the earlier slide is therefore what was recorded, not what was actually spent']);
      else if(g.code === 'no_project_budget') out.push(['warn', 'Not one of the ' + g.projects + ' projects has a budget set',
        'Planned versus actual spend cannot be compared · the report can only show whether the schedule held']);
      else if(g.code === 'safety_default_pm') out.push(['warn', g.items + ' of ' + g.total + ' safety items still carry the default 1 Jan inspection date',
        'No real inspection cycle has been set per item, so nothing can tell us which ones are actually due']);
      else if(g.code === 'few_consumables') out.push(['bad', 'Only ' + g.consumables + ' fuel and consumable issue' + (g.consumables === 1 ? ' has' : 's have') + ' been logged',
        'Fuel cost per sailing or per seat cannot be worked out at all — one of the figures worth having most']);
      else if(g.code === 'idle_boats'){
        var names = (g.boats || []).map(function(b){ return b.name || b.boat_id; });
        out.push(['bad', g.idle + ' of ' + g.registered + ' boats were never available on a single day',
          'These look like boats that have been retired or laid up but never marked as such · '
          + 'this report excludes them from the availability figure, otherwise the whole fleet number is distorted ('
          + names.slice(0, 5).join(' · ') + (names.length > 5 ? (' and ' + (names.length - 5) + ' more') : '') + ')']);
      } else if(g.code === 'uniform_min') out.push(['note', 'Minimum stock is set to ' + g.min_qty + ' on every item alike',
        'That is the default, not a real reorder point · do not read “below minimum” as genuinely short']);
    });
    return out;
  }
  function gatherOf(p, stock, dataGaps){
    var av = p.availability, inc = p.incidents, jb = p.jobs, sp = p.spend, eg = p.engine_hours, pj = p.projects, mm = p.memos;
    var G = { nDays: n(p.days), boats: n(av.boats_in_service), boatsAll: n(av.boats_registered), idleBoats: (av.idle_boats || []).length,
      idleNames: (av.idle_boats || []).map(function(b){ return b.name || b.boat_id; }), downBy: {}, downTot: n(av.down_days), avail: n(av.availability_pct),
      inc: n(inc.count), incBy: {}, incSev: {}, incOpen: n(inc.open),
      mjOpen: Math.max(0, n(jb.started) - n(jb.closed)), mjDone: n(jb.closed), mjCost: n(jb.cost), mjCostN: n(jb.with_cost), mjDays: [], mjAvgDays: jb.average_days == null ? 0 : n(jb.average_days),
      mjOpenList: (jb.open_list || []).map(function(j){ return { nm: String(j.title || j.no || 'งานซ่อม'), bt: j.boat_name || j.boat_id || '', age: n(j.age), st: j.start_date, so: String(j.status || '') }; }),
      pjActive: n(pj.active), pjDone: n(pj.completed), pjLate: n(pj.late),
      pjList: (pj.list || []).map(function(x){ return { name: x.name || x.no || '-', boatId: x.boat_id, type: x.type || '-', status: x.status, planTo: x.plan_to || '', late: n(x.late_days) }; }),
      memoN: n(mm.count), memoAmt: n(mm.amount), memoPend: n(mm.pending), memoPendAmt: n(mm.pending_amount), memoBySup: {}, memoByType: {},
      engHrs: {}, engTot: n(eg.total), engReads: n(eg.reads),
      invZero: n(stock.at_zero), invLow: n(stock.below_min), invHave: n(stock.with_min), invVal: n(stock.value),
      invOut: (stock.out || []).map(function(i){ return { n: String(i.name || i.part_no || '—'), cat: CAT[i.category] || String(i.category || '—'), cost: n(i.cost), loc: String(i.warehouse || '') }; }),
      invMinUniform: stock.uniform_min == null ? '' : String(stock.uniform_min), invN: n(stock.items), gaps: dataGaps ? gapsOf(dataGaps) : [], __srv: true };
    (av.down_by_boat || []).forEach(function(b){ G.downBy[b.boat_id] = n(b.days); });
    (inc.by_boat || []).forEach(function(b){ G.incBy[b.boat_id] = n(b.n); });
    (inc.by_severity || []).forEach(function(s){ G.incSev[s.severity] = n(s.n); });
    (mm.by_supplier || []).forEach(function(s){ G.memoBySup[s.supplier] = n(s.amount); });
    (mm.by_type || []).forEach(function(s){ G.memoByType[s.memo_type] = n(s.amount); });
    (eg.by_boat || []).forEach(function(b){ G.engHrs[b.boat_id] = n(b.hours); });
    return G;
  }
  wrap('repFleetGather', function(orig, from, to){
    var args = [].slice.call(arguments, 1), j = O.srv.peek(key(from, to));
    if(j && j.from === from && j.to === to){ last = j; return gatherOf(j.current, j.stock, j.data_gaps); }
    j = last;
    if(j && j.previous && j.previous.from === from && j.previous.to === to) return gatherOf(j.previous, j.stock, null);
    return orig.apply(this, args);
  });
  wrap('renderReport', function(orig, kind){
    var args = [].slice.call(arguments, 1);
    if(kind !== 'fleet') return orig.apply(this, args);
    var st = typeof window.repSt === 'function' ? window.repSt('fleet') : null;
    if(st && st.from && st.to){
      var j = O.srv.read(key(st.from, st.to), '/v1/fleet/reports/fleet', { from: st.from, to: st.to }, repaint);
      if(j) last = j;
    }
    return orig.apply(this, args);
  });
})();
