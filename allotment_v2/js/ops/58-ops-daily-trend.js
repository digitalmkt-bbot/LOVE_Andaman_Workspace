/* ══════════════════════════════════════════════════════════════════════════
   §opsDailyTrend · Daily Report 14-day passenger trend by market ⇄ operation-backend
   ──────────────────────────────────────────────────────────────────────────
   Legacy drTrend / drTrendBooked drew a stacked 14-day chart from the browser's booking
   list. The server already answers each day by market, so no booking is read here:

     travel date   GET /v1/reports/daily?date=D          by_market[{id,name,color,pax}] per day (14 reads, 4 at a time)
     booking date  GET /v1/bookings/daily-counts?from&to  live bookings + pax per sale day (all markets together:
                                                          the server does not split this one by market)

   33-ops-money-reports.js renders the Daily Report and leaves an empty
   #dr-trend-host; mount(date) fills it. The mode buttons reuse the legacy
   drTrendMode(), which re-enters renderDailyReport.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var NDAYS = 14, BACK = 2, KEEP = 5;
  var PALETTE = ['#1683C7', '#0F6E56', '#D4A017', '#5B289A', '#D87A30', '#94a3b8'];
  var dayCache = {}, countsCache = {}, gen = 0;

  function text(v){ return v == null ? '' : String(v); }
  function esc(v){ return text(v).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function n(v){ return Number.isFinite(+v) ? +v : 0; }
  function ymd(d){
    if(typeof window.bookingV2LocalYMD === 'function') return window.bookingV2LocalYMD(d);
    var p = function(x){ return (x < 10 ? '0' : '') + x; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function shift(date, by){ var d = new Date(date + 'T12:00:00'); d.setDate(d.getDate() + by); return ymd(d); }
  function mode(){ return window._drTrendMode === 'booked' ? 'booked' : 'travel'; }

  function readDay(date){
    if(dayCache[date]) return Promise.resolve(dayCache[date]);
    return O.get('/v1/reports/daily', { date: date }).then(function(d){
      var r = { date: date, total: n(d && d.pax && d.pax.total), by: (d && d.by_market) || [] };
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

  /* Points {date, by:{marketId:pax}, tot}, the market list and the top-5 + "Other" fold (legacy drTrend). */
  function travelSeries(date){
    var dates = []; for(var i = 0; i < NDAYS; i++) dates.push(shift(date, -BACK + i));
    return pool(dates, readDay).then(function(days){
      var mkt = {}, order = [];
      var pts = days.map(function(day){
        var by = {};
        day.by.forEach(function(m){
          var id = text(m.id); if(!id) return;
          if(!mkt[id]){ mkt[id] = { id: id, name: m.name || id, color: m.color || '', tot: 0 }; order.push(id); }
          mkt[id].tot += n(m.pax); by[id] = (by[id] || 0) + n(m.pax);
        });
        return { date: day.date, by: by, tot: day.total, today: day.date === date };
      });
      return fold(pts, mkt, order);
    });
  }
  function fold(pts, mkt, order){
    order.sort(function(a, b){ return mkt[b].tot - mkt[a].tot; });
    var keys = order.slice(0, KEEP), rest = order.slice(KEEP);
    if(rest.length){
      pts.forEach(function(p){ var o = 0; rest.forEach(function(id){ o += n(p.by[id]); delete p.by[id]; }); if(o) p.by._etc = o; });
      mkt._etc = { id: '_etc', name: 'Other', color: '#94a3b8', tot: 0 }; keys.push('_etc');
    }
    keys.forEach(function(k, i){ if(!mkt[k].color) mkt[k].color = PALETTE[i % PALETTE.length]; });
    return { pts: pts, keys: keys, mkt: mkt };
  }
  /* By booking date: the server's per-day totals; one series, since daily-counts has no market split. */
  function bookedSeries(date){
    var from = shift(date, -(NDAYS - 1)), key = from + '|' + date;
    var p = countsCache[key] ? Promise.resolve(countsCache[key]) : O.get('/v1/bookings/daily-counts', { from: from, to: date }).then(function(r){ countsCache[key] = r; return r; });
    return p.then(function(r){
      var mkt = { _all: { id: '_all', name: 'All markets', color: '#1683C7', tot: 0 } };
      var pts = ((r && r.days) || []).map(function(d){ mkt._all.tot += n(d.pax); return { date: d.date, by: { _all: n(d.pax) }, tot: n(d.pax), today: d.date === date, bookings: n(d.bookings) }; });
      return { pts: pts, keys: ['_all'], mkt: mkt, bookedNote: true };
    });
  }

  function lbl(date){ var d = new Date(date + 'T12:00:00'); return String(d.getDate()); }
  function html(S, date, m){
    var max = 1; S.pts.forEach(function(p){ if(p.tot > max) max = p.tot; });
    var bars = S.pts.map(function(p){
      var segs = S.keys.map(function(k){
        var v = n(p.by[k]); if(!v) return '';
        var mk = S.mkt[k] || {};
        return '<div title="' + esc((mk.name || k) + ' · ' + v + ' pax') + '" style="height:' + (v / max * 100).toFixed(1) + '%;background:' + esc(mk.color || '#94a3b8') + '"></div>';
      }).join('');
      return '<div data-ops-dr-day="' + esc(p.date) + '" style="flex:1;min-width:0;display:flex;flex-direction:column;align-items:center"><div style="font-size:10px;font-variant-numeric:tabular-nums;color:var(--fd-ink-soft);height:14px">' + (p.tot || '') + '</div>'
        + '<div style="width:100%;height:110px;display:flex;flex-direction:column-reverse;justify-content:flex-start;' + (p.today ? 'outline:1px solid #1683C7;' : '') + '">' + segs + '</div>'
        + '<div style="font-size:10px;margin-top:3px;' + (p.today ? 'font-weight:700;color:#1683C7' : 'color:var(--fd-ink-soft)') + '">' + esc(lbl(p.date)) + '</div></div>';
    }).join('');
    var legend = S.keys.map(function(k){ var mk = S.mkt[k] || {}; return '<span style="display:inline-block;margin:0 12px 4px 0;font-size:10.5px"><i style="display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:4px;background:' + esc(mk.color || '#94a3b8') + '"></i>' + esc(mk.name || k) + '</span>'; }).join('');
    var total = S.pts.reduce(function(a, p){ return a + p.tot; }, 0);
    var tab = function(id, label){
      var on = m === id;
      return '<button type="button" data-ops-dr-mode="' + id + '" style="border:0.5px solid ' + (on ? '#1683C7' : 'var(--fd-line-soft)') + ';border-radius:999px;padding:3px 11px;font-size:11px;cursor:pointer;background:' + (on ? '#1683C7' : '#fff') + ';color:' + (on ? '#fff' : 'inherit') + '" onclick="drTrendMode(\'' + id + '\')">' + label + '</button>';
    };
    return '<div style="margin-bottom:16px;background:#fff;border:0.5px solid var(--fd-line-soft);border-radius:12px;padding:13px 15px">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:8px"><div style="font-size:12px;font-weight:600">Passengers · ' + NDAYS + ' days by market</div>'
      + '<div style="display:flex;gap:6px">' + tab('travel', 'By travel date') + tab('booked', 'By booking date') + '</div></div>'
      + '<div style="display:flex;gap:4px;align-items:flex-end">' + bars + '</div>'
      + '<div style="margin-top:8px;border-top:0.5px solid var(--fd-line-soft);padding-top:8px">' + legend + '<span style="float:right;font-size:10.5px;color:var(--fd-ink-soft)">Total ' + total + ' pax</span></div>'
      + (S.bookedNote ? '<div data-ops-dr-bookednote="1" style="margin-top:4px;font-size:10.5px;color:#8a6d1a">By booking date the server counts all markets together, so this view is not split by market.</div>' : '') + '</div>';
  }

  /* Fill #dr-trend-host for this date; a later render (other date or mode) cancels an older read. */
  function mount(date){
    var host = document.getElementById('dr-trend-host'); if(!host) return Promise.resolve();
    var my = ++gen, m = mode();
    host.innerHTML = O.loadingHtml ? O.loadingHtml('Loading trend…') : '';
    return (m === 'booked' ? bookedSeries(date) : travelSeries(date)).then(function(S){
      if(my !== gen) return;
      host.innerHTML = html(S, date, m);
    }, function(e){
      if(my !== gen) return;
      host.innerHTML = '<div data-ops-dr-trend-error="1" style="margin-bottom:16px;padding:12px 15px;color:#A32D2D;font-size:12px">The trend did not load from operation-backend.</div>';
      O.fail('Trend did not load', e);
    });
  }

  O.onWrite(function(){ dayCache = {}; countsCache = {}; });
  window.laOps.dailyTrend = { mount: mount, travelSeries: travelSeries, bookedSeries: bookedSeries, clear: function(){ dayCache = {}; countsCache = {}; } };
})();
