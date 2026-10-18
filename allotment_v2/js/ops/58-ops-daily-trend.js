/* ══════════════════════════════════════════════════════════════════════════
   §opsDailyTrend · Daily Report 14-day passenger series ⇄ operation-backend
   ──────────────────────────────────────────────────────────────────────────
   Legacy drTrend / drTrendBooked built the overview's stacked chart from the browser's
   booking list. The server already answers each day by market, so no booking is read here:

     travel date   GET /v1/reports/daily?date=D          by_market[{id,name,pax}] per day (14 reads, 4 at a time)
     booking date  GET /v1/bookings/daily-counts?from&to  live bookings + pax per sale day (all markets together:
                                                          the server does not split this one by market, B18)

   This file only answers the series, in legacy's own shape {pts:[{date,by,tot,today,lb}], keys, mkt},
   so 59-ops-daily-report.js can draw it with the legacy chart (drChart) and legend.
   Market colours follow legacy drPaint: DR_PALETTE in order of the 14-day total; past five, "อื่น ๆ".
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var NDAYS = 14, BACK = 2, KEEP = 5;
  var FALLBACK = ['#2563eb','#14b8a6','#a855f7','#f59e0b','#10b981','#ec4899','#64748b','#0ea5e9','#f43f5e','#84cc16'];
  var dayCache = {}, countsCache = {};

  function text(v){ return v == null ? '' : String(v); }
  function n(v){ return Number.isFinite(+v) ? +v : 0; }
  function ymd(d){
    if(typeof window.bookingV2LocalYMD === 'function') return window.bookingV2LocalYMD(d);
    var p = function(x){ return (x < 10 ? '0' : '') + x; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function shift(date, by){ var d = new Date(date + 'T12:00:00'); d.setDate(d.getDate() + by); return ymd(d); }
  function palette(){ return (typeof window.DR_PALETTE !== 'undefined' && window.DR_PALETTE && window.DR_PALETTE.length) ? window.DR_PALETTE : FALLBACK; }
  function paint(order, map){ var P = palette(); order.forEach(function(id, i){ if(map[id]) map[id].color = P[i % P.length]; }); }
  function monTH(){ try{ if(typeof window.laMonAbbrTH === 'function') return window.laMonAbbrTH(); }catch(_){} return ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']; }
  /* legacy label: the day number, with the month on the first point and on the 1st */
  function label(date, first){ var d = new Date(date + 'T12:00:00'); return d.getDate() + ((first || d.getDate() === 1) ? (' ' + monTH()[d.getMonth()]) : ''); }

  function readDay(date){
    if(dayCache[date]) return Promise.resolve(dayCache[date]);
    return O.get('/v1/reports/daily', { date: date }).then(function(d){
      var r = { date: date, total: n(d && d.pax && d.pax.total), by: (d && d.by_market) || [], raw: d };
      dayCache[date] = r; return r;
    });
  }
  function pool(dates, fn){
    var i = 0, out = [];
    function worker(){
      if(i >= dates.length) return Promise.resolve();
      var k = i++;
      return fn(dates[k]).then(function(r){ out[k] = r; }).then(worker);
    }
    return Promise.all([worker(), worker(), worker(), worker()]).then(function(){ return out; });
  }
  function fold(pts, mkt, order){
    order.sort(function(a, b){ return mkt[b].tot - mkt[a].tot; });
    paint(order, mkt);
    var keys = order.slice(0, KEEP), rest = order.slice(KEEP);
    if(rest.length){
      pts.forEach(function(p){ var o = 0; rest.forEach(function(id){ o += n(p.by[id]); delete p.by[id]; }); if(o) p.by._etc = o; });
      mkt._etc = { id: '_etc', name: 'อื่น ๆ', color: '#94a3b8', tot: 0 }; keys.push('_etc');
      paint(keys, mkt);
    }
    return { pts: pts, keys: keys, mkt: mkt };
  }

  /* Travel date: BACK days before the date to NDAYS-BACK-1 after, by market (legacy drTrend). */
  function travelSeries(date){
    var dates = []; for(var i = 0; i < NDAYS; i++) dates.push(shift(date, -BACK + i));
    return pool(dates, readDay).then(function(days){
      var mkt = {}, order = [];
      var pts = days.map(function(day, i){
        var by = {};
        day.by.forEach(function(m){
          var id = text(m.id); if(!id) return;
          if(!mkt[id]){ mkt[id] = { id: id, name: m.name || id, color: '', tot: 0 }; order.push(id); }
          mkt[id].tot += n(m.pax); by[id] = (by[id] || 0) + n(m.pax);
        });
        return { date: day.date, by: by, tot: day.total, today: day.date === date, lb: label(day.date, i === 0) };
      });
      return fold(pts, mkt, order);
    });
  }
  /* Booking date: the NDAYS sale days ending on the date, by market (legacy drTrendBooked). w6-d: GET /v1/bookings/daily-counts?markets=1 answers
     days[].markets {market_id: {bookings, pax}} (README "Fields the new frontend asked for"), so the stack is the server's. An older server
     (no markets in the answer) keeps the one series. Heads are counted as the server counts them (the booking's first trip). */
  function marketName(id){
    var list = typeof SB_MARKETS !== 'undefined' && Array.isArray(SB_MARKETS) ? SB_MARKETS : [];
    for(var i = 0; i < list.length; i++) if(list[i] && list[i].id === id) return list[i].name || id;
    return id === 'b2c' ? 'B2C' : id === 'unassigned' ? 'Unassigned' : id;
  }
  function bookedSeries(date){
    var from = shift(date, -(NDAYS - 1)), key = from + '|' + date + '|m';
    var p = countsCache[key] ? Promise.resolve(countsCache[key]) : O.get('/v1/bookings/daily-counts', { from: from, to: date, markets: 1 }).then(function(r){ countsCache[key] = r; return r; });
    return p.then(function(r){
      var got = {}; ((r && r.days) || []).forEach(function(d){ got[d.date] = d; });
      var withMarkets = ((r && r.days) || []).some(function(d){ return d && d.markets; });
      if(!withMarkets){
        var m1 = { _all: { id: '_all', name: 'ทุก Market', color: palette()[0], tot: 0 } }, pts1 = [];
        for(var k = NDAYS - 1; k >= 0; k--){
          var ds1 = shift(date, -k), d1 = got[ds1] || {}, v1 = n(d1.pax);
          m1._all.tot += v1;
          pts1.push({ date: ds1, by: { _all: v1 }, tot: v1, today: ds1 === date, lb: label(ds1, k === NDAYS - 1), bookings: n(d1.bookings) });
        }
        return { pts: pts1, keys: ['_all'], mkt: m1, bookedOneSeries: true };
      }
      var mkt = {}, order = [], pts = [];
      for(var i = NDAYS - 1; i >= 0; i--){
        var ds = shift(date, -i), d = got[ds] || {}, by = {}, tot = 0;
        Object.keys(d.markets || {}).forEach(function(id){
          var px = n(d.markets[id] && d.markets[id].pax); if(!px) return;
          if(!mkt[id]){ mkt[id] = { id: id, name: marketName(id), color: '', tot: 0 }; order.push(id); }
          mkt[id].tot += px; by[id] = (by[id] || 0) + px; tot += px;
        });
        pts.push({ date: ds, by: by, tot: tot, today: ds === date, lb: label(ds, i === NDAYS - 1), bookings: n(d.bookings) });
      }
      return fold(pts, mkt, order);
    });
  }
  /* One day's report as the trend read it (59 reuses it for the day itself and for 7 days back). */
  function day(date){ return readDay(date).then(function(r){ return r.raw; }); }

  function clear(){ dayCache = {}; countsCache = {}; }
  O.onWrite(clear);
  window.laOps.dailyTrend = { travelSeries: travelSeries, bookedSeries: bookedSeries, day: day, clear: clear, NDAYS: NDAYS, BACK: BACK };
})();
