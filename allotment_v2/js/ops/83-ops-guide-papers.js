/* ═════════════════════════════════════════════════════════════════
   §opsGuidePapers (w5-d, 2026-10-18) · the guide order (ใบสั่งงานมัคคุเทศก์) and the harbour's travel register (ทะเบียนรายชื่อผู้เดินทาง)
   with the numbers the server works out

   Both papers are legal documents the pier prints; legacy added their numbers up in the browser from the bookings it held. The server
   answers them per boat and day (README "Guide orders"; src/domain/day-papers.ts):

     GET /v1/guide-orders/{date}/{boat}/sheet   counts{ad chd inf} (foc inside adults) · guides[] · lead_guide · crew · crew_from ·
                                                others · total · seats · over_seats · route_id
     GET /v1/travel-register/{date}/{boat}      crew[{name position group}] · passengers[{name nationality phone}] · boat_reg · departure ·
                                                destination · totals{captain engineer crew guides staff passengers thai foreign
                                                unspecified_nationality people names_over unnamed unnamed_crew}

   Wrapped here (legacy's markup, Thai texts and print flow stay; only the numbers and lists come from the answers):
     goCounts(date, bid)        counts                     goCrewN(date, bid)       crew
     goRouteOf(date, bid)       the route of route_id      goIsGuide(g)             while a sheet draws: the sheet's guides (licensed)
     goIslandN(date, bid)       (what is left of others once the order's own people are taken off: only inside goSheet)
     goSheet(date, bid, issue)  legacy's page, then its seven figures (adults, children, infants, guides, crew, others, total) and the seats
                                are the sheet's own
     pckTravelCrew / pckTravelRows   crew and passengers of the register
     pckTravelSheet             legacy's page, then the nine figures of the summary (captain ... people) are the register's totals
   goRows is not wrapped: nothing is left that reads it but goCounts and goRouteOf, which answer from the sheet.
   goPrintOpen and goSetupOpen wait for the answers (a few hundred ms) so a printed paper never carries a stale number; if a read fails
   the print goes on with legacy's arithmetic. A write makes the held answers stale, and legacy's arithmetic answers until they are read again.
   The role test in the guide register's own list (goIsGuide outside a sheet) is legacy's: MISSING-SERVER-FIELD guides[].licensed.

   Load order: after 62-ops-guide-orders.js. Classic script.
   ═════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var sheets = {}, regs = {}, epoch = 0, ctx = null;

  function enabled(){ return !!(O.enabled && O.enabled()); }
  function g(name){ try{ return window[name]; }catch(_){ return undefined; } }
  function enc(x){ return encodeURIComponent(x == null ? '' : String(x)); }
  function num(v){ return +v || 0; }
  function key(date, bid){ return date + '|' + bid; }

  /* ── the reads ── */
  function held(store, date, bid){
    var c = store[key(date, bid)];
    return c && c.data && c.epoch === epoch ? c.data : null;
  }
  function read(store, path, date, bid){
    var k = key(date, bid), c = store[k];
    if(c && c.data && c.epoch === epoch) return Promise.resolve(c.data);
    if(c && c.loading && c.epoch === epoch) return c.loading;
    var ep = epoch;
    c = store[k] = { data: null, epoch: ep, loading: null };
    c.loading = O.get(path).then(function(res){ c.data = res || null; c.loading = null; return c.data; }, function(){ c.loading = null; return null; });
    return c.loading;
  }
  function sheetOf(date, bid){ return held(sheets, date, bid); }
  function regOf(date, bid){ return held(regs, date, bid); }
  function readSheet(date, bid){ return read(sheets, '/v1/guide-orders/' + enc(date) + '/' + enc(bid) + '/sheet', date, bid); }
  function readReg(date, bid){ return read(regs, '/v1/travel-register/' + enc(date) + '/' + enc(bid), date, bid); }

  function wrap(name, fn){
    var orig = window[name]; if(typeof orig !== 'function' || orig.__opsGuidePapers) return;
    var w = function(){
      if(!enabled()) return orig.apply(this, arguments);
      var r;
      try{ r = fn.call(this, orig, arguments); }catch(e){ if(window.console) console.warn('[ops] guide papers · ' + name + ' · ' + (e && e.message)); r = undefined; }
      return r === undefined ? orig.apply(this, arguments) : r;
    };
    w.__opsGuidePapers = true; window[name] = w;
  }

  /* ── the guide order ── */
  wrap('goCounts', function(orig, a){
    var S = sheetOf(a[0], a[1]); if(!S || !S.counts) return undefined;
    return { ad: num(S.counts.ad), chd: num(S.counts.chd), inf: num(S.counts.inf) };
  });
  wrap('goCrewN', function(orig, a){
    var S = sheetOf(a[0], a[1]); if(!S || S.crew == null) return undefined;
    return num(S.crew);
  });
  wrap('goRouteOf', function(orig, a){
    var S = sheetOf(a[0], a[1]); if(!S) return undefined;
    if(!S.route_id) return {};
    var r = typeof g('getRoute') === 'function' ? window.getRoute(S.route_id) : null;
    return r || undefined;
  });
  wrap('goIsGuide', function(orig, a){
    if(!ctx || !a[0]) return undefined;
    return ctx.licensed.indexOf(a[0].id) >= 0;
  });
  wrap('goIslandN', function(orig, a){
    if(!ctx || ctx.date !== a[0] || ctx.bid !== a[1]) return undefined;
    var A = typeof g('goAsn') === 'function' ? window.goAsn(a[0], a[1]) : { g: [], other: 0 };
    var picked = (A.g || []).map(function(id){ return typeof g('goGuide') === 'function' ? window.goGuide(id) : null; }).filter(Boolean);
    var interns = picked.filter(function(x){ return ctx.licensed.indexOf(x.id) < 0; }).length;
    var n = num(ctx.sheet.others) - num(A.other) - interns;
    return n >= 0 ? n : undefined;
  });
  wrap('goSheet', function(orig, a){
    var date = a[0], bid = a[1], S = sheetOf(date, bid); if(!S) return undefined;
    ctx = { date: date, bid: bid, sheet: S, licensed: (S.guides || []).map(function(x){ return x.id; }) };
    var html;
    try{ html = orig.apply(this, a); } finally { ctx = null; }
    // the seven figures of the table, in the order the page prints them: adults, children, infants, guides, crew, others, total
    var vals = [num(S.counts && S.counts.ad), num(S.counts && S.counts.chd), num(S.counts && S.counts.inf), (S.guides || []).length, num(S.crew), num(S.others), num(S.total)];
    var i = 0;
    html = String(html).replace(/<td class="n">\d+<\/td>/g, function(m){ return i < vals.length ? '<td class="n">' + vals[i++] + '</td>' : m; });
    if(num(S.seats) > 0) html = html.replace(/(<td class="k kp">ผู้โดยสาร<\/td><td class="v">)[^<]*(<\/td>)/, '$1' + num(S.seats) + ' ที่นั่ง$2');
    return html;
  });

  /* ── the travel register ── */
  wrap('pckTravelCrew', function(orig, a){
    var R = regOf(a[1], a[0]); if(!R || !Array.isArray(R.crew)) return undefined;
    var out = R.crew.filter(function(c){ return String(c.name || '').trim(); }).map(function(c){ return { name: c.name, pos: c.position, grp: c.group }; });
    out.blank = num(R.totals && R.totals.unnamed_crew);
    return out;
  });
  wrap('pckTravelRows', function(orig, a){
    var R = regOf(a[1], a[0]); if(!R || !Array.isArray(R.passengers) || !R.totals) return undefined;
    var T = R.totals;
    return { people: R.passengers.map(function(p){ return { name: p.name, nat: p.nationality || '', phone: p.phone || '' }; }),
      pax: num(T.passengers), th: num(T.thai), fr: Math.max(0, num(T.foreign) - num(T.unspecified_nationality)), over: num(T.names_over), noname: num(T.unnamed) };
  });
  wrap('pckTravelSheet', function(orig, a){
    var R = regOf(a[1], a[0]); if(!R || !R.totals) return undefined;
    var html = String(orig.apply(this, a)), T = R.totals;
    var at = html.indexOf('<div class="sum">'); if(at < 0) return html;
    // captain, engineer, crew, guides, staff, Thai, foreign, everyone, and the "normal" line (everyone)
    var vals = [num(T.captain), num(T.engineer), num(T.crew), num(T.guides), num(T.staff), num(T.thai), num(T.foreign), num(T.people), num(T.people)];
    var i = 0, head = html.slice(0, at), tail = html.slice(at);
    tail = tail.replace(/<td class="n">\d+<\/td>/g, function(m){ return i < vals.length ? '<td class="n">' + vals[i++] + '</td>' : m; });
    return head + tail;
  });

  /* ── the print and the dialog wait for the answers ── */
  wrap('goPrintOpen', function(orig, a){
    var bid = a[0], date = a[1], ids = a[2] || [], self = this, args = a;
    var jobs = [];
    ids.forEach(function(k){ jobs.push(readSheet(date, k)); jobs.push(readReg(date, k)); });
    Promise.all(jobs).then(function(){ return orig.apply(self, args); }, function(){ return orig.apply(self, args); });
    return null;
  });
  wrap('goSetupOpen', function(orig, a){
    var bid = a[0], date = typeof _pckDate !== 'undefined' ? _pckDate : '', self = this, args = a;
    if(sheetOf(date, bid)) return undefined;
    readSheet(date, bid).then(function(){ orig.apply(self, args); }, function(){ orig.apply(self, args); });
    return null;
  });

  O.onWrite(function(kind){
    if(/^(weather|market|devlog|daily-report|fleet|costing|trip-pl|addon-types|park|meal)/i.test(String(kind || ''))) return;
    epoch++;
  });
  O.guidePapers = { sheet: sheetOf, register: regOf, readSheet: readSheet, readRegister: readReg, clear: function(){ sheets = {}; regs = {}; epoch++; } };
})();
