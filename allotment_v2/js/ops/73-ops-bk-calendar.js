/* ══════════════════════════════════════════════════════════════════════════
   §opsBkCalendar (w4-f1, 2026-10-18) · Booking calendar / matrix / month cards ⇄ GET /v1/bookings/calendar
   ──────────────────────────────────────────────────────────────────────────
   Server: operation-backend todo/b2-reports-model.md ("Range reports", row GET /v1/bookings/calendar).
   Legacy added every booking of the month up in the browser on each draw (bookingV2Aggregate). The server counts once
   per month and kind (marine page / City Tour page) and answers:
     days[].families[]  the calendar chips          → bookingV2FamilyAggregate (chips, day badge, orphan chips, the Selected Day panel)
     stats              the four cards on top        → bookingV2RenderStats
     route_avgs         "Avg pax · per program"      → bookingV2RenderRouteAvgs
     matrix             program x day with variants  → bookingV2RenderMatrix (cells, heat range, month sum, AD/CHD/INF/FOC columns)
   Markup, texts and click handlers are legacy's own (copied); only the figures come from the answer. While the answer is
   missing (or the read failed) legacy's own sums run. Differences from legacy (zone from the trip, cancelled bookings not
   in the family card, FOC mark) are the server's: see docs/walk/w4-f1.md.
   bookingV2DayLockedExact (the lock badge) is not part of the answer and stays legacy's.
   Classic script, after 73-ops-srv-reads.js.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O || !O.srv) return;
  function on(){ return !!(O.enabled && O.enabled()); }
  function n(v){ return Number.isFinite(+v) ? +v : 0; }
  function kind(){ return window._bkV2CityTourOnly ? 'land' : 'marine'; }
  function wrap(name, fn){
    var orig = window[name];
    if(typeof orig !== 'function' || orig.__w4f1) return;
    var w = function(){
      var args = [].slice.call(arguments);
      if(!on()) return orig.apply(this, args);
      return fn.apply(this, [orig].concat(args));
    };
    w.__w4f1 = true; w.__orig = orig; window[name] = w;
  }
  function repaint(){
    if(O.activeView() === 'booking' && !O.busy() && typeof window.bookingV2RenderKeep === 'function') window.bookingV2RenderKeep();
  }
  /* the answer for one month of the page on screen, null while there is none */
  function month(ym){
    if(!/^\d{4}-\d{2}$/.test(ym || '')) return null;
    var j = O.srv.read('cal|' + ym + '|' + kind(), '/v1/bookings/calendar', { month: ym, kind: kind() }, repaint);
    if(j && !j.__byDate){ j.__byDate = {}; (j.days || []).forEach(function(d){ var fm = {}; (d.families || []).forEach(function(f){ fm[f.family_id] = f; }); d.__fam = fm; j.__byDate[d.date] = d; }); }
    return j;
  }
  function cursorYm(){
    var c = window._bkV2 && window._bkV2.cursor; if(!c) return '';
    return c.getFullYear() + '-' + String(c.getMonth() + 1).padStart(2, '0');
  }

  /* ── the calendar chips and the Selected Day panel ──────────────────────── */
  wrap('bookingV2FamilyAggregate', function(orig, familyId, dateStr){
    var j = month(String(dateStr || '').slice(0, 7)), d = j && j.__byDate[dateStr];
    if(!d) return orig.apply(this, [].slice.call(arguments, 1));
    var f = d.__fam[familyId];
    if(!f) return { total: 0, ad: 0, chd: 0, inf: 0, foc: 0, pk: 0, kl: 0, nt: 0, hasFocPending: false, subCount: 0 };
    return { total: n(f.total), ad: n(f.ad), chd: n(f.chd), inf: n(f.inf), foc: n(f.foc), pk: n(f.pk), kl: n(f.kl), nt: n(f.nt), hasFocPending: !!f.foc_pending, subCount: n(f.sub_count) };
  });

  /* ── the four cards on top ──────────────────────────────────────────────── */
  wrap('bookingV2RenderStats', function(orig){
    var ym = cursorYm(), j = month(ym), s = j && j.stats;
    if(!s) return orig.apply(this, [].slice.call(arguments, 1));
    var cur = window._bkV2.cursor;
    var monthLbl = cur.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
    var hi = s.busiest, lo = s.quietest, dNum = function(k){ return Number(String(k).slice(8, 10)); };
    var card3 = s.foc_waiting_bookings > 0
      ? '<div class="bkv2-stat warn">\n        <div class="s-lab">รอ FOC</div>\n        <div class="s-val">' + s.foc_waiting_bookings + ' <span class="s-unit">ใบ</span></div>\n        <div class="s-foot">ต้องตรวจก่อนออกเรือ</div>\n      </div>'
      : '<div class="bkv2-stat">\n        <div class="s-lab">วันแน่นสุด / เบาสุด</div>\n        <div class="s-val">' + (hi ? hi.pax : '—') + ' <span class="s-unit">' + (lo ? ('/ ' + lo.pax) : '') + '</span></div>\n        <div class="s-foot">' + (hi ? (dNum(hi.date) + ' · ' + dNum(lo.date) + ' ของเดือน') : 'ยังไม่มีข้อมูล') + '</div>\n      </div>';
    var t = s.today, tIsCur = !!t;
    return '\n    <div class="bkv2-stats">\n      <div class="bkv2-stat hero">\n        <div class="s-lab">' + monthLbl + '</div>\n        <div class="s-val">' + n(s.pax).toLocaleString() + ' <span class="s-unit">pax</span></div>\n        <div class="s-foot">' + s.bookings + ' ใบจอง &middot; เฉลี่ย ' + s.avg_per_day + ' pax/วัน</div>\n      </div>\n'
      + '      <div class="bkv2-stat' + (s.unconfirmed > 0 ? ' alert' : ' success') + '">\n        <div class="s-lab">' + (s.unconfirmed > 0 ? 'ยังไม่ยืนยัน' : 'ยืนยันครบแล้ว') + '</div>\n        <div class="s-val">' + (s.unconfirmed > 0 ? s.unconfirmed : s.confirmed) + ' <span class="s-unit">ใบ</span></div>\n        <div class="s-foot">'
      + (s.unconfirmed > 0 ? ('<b>' + s.unconfirmed_pax + ' pax</b> &middot; จาก ' + s.bookings + ' ใบ') : (n(s.confirmed_pax).toLocaleString() + ' pax')) + '</div>\n      </div>\n      ' + card3 + '\n'
      + '      <div class="bkv2-stat">\n        <div class="s-lab">' + (tIsCur ? 'วันนี้' : 'Today') + '</div>\n        <div class="s-val">' + (tIsCur ? t.pax : '—') + ' <span class="s-unit">' + (tIsCur ? 'pax' : '') + '</span></div>\n        <div class="s-foot">'
      + (tIsCur ? (t.bookings + ' ใบจอง &middot; ' + t.trips + ' ทริป') : 'ไม่ได้อยู่ในเดือนที่ดู') + '</div>\n      </div>\n    </div>\n  ';
  });

  /* ── "Avg pax · per program" ────────────────────────────────────────────── */
  wrap('bookingV2RenderRouteAvgs', function(orig){
    var j = month(cursorYm()), list = j && j.route_avgs;
    if(!list) return orig.apply(this, [].slice.call(arguments, 1));
    var mode = window._bkV2.avgMode || 'week';
    var modeLab = { week: 'pax /week', day: 'pax /day', total: 'pax total' }[mode];
    var sub = { week: '÷ weeks in month', day: '÷ days route ran', total: 'sum of all pax' }[mode];
    var cards = list.map(function(f){
      var val = mode === 'week' ? f.per_week : (mode === 'day' ? f.per_day : f.pax);
      return '\n      <div class="bkv2-route-card" style="border-left-color:' + f.color + '">\n        <div class="rc-name">' + f.name + '</div>\n        <div class="rc-meta">' + f.bookings + ' bookings &middot; ' + f.days_ran + ' day' + (f.days_ran === 1 ? '' : 's') + ' ran &middot; ' + f.variants + ' variant' + (f.variants === 1 ? '' : 's') + '</div>\n        <div class="rc-row">\n          <div class="rc-unit">' + modeLab + '</div>\n          <div class="rc-val">' + val + '</div>\n        </div>\n      </div>\n    ';
    }).join('');
    return '\n    <div class="bkv2-routes">\n      <div class="bkv2-routes-hd">\n        <span class="bkv2-routes-ttl">Avg pax &middot; per program</span>\n        <span class="bkv2-routes-sub">' + sub + '</span>\n        <div class="bkv2-mode">\n'
      + '          <button class="bkv2-mode-btn ' + (mode === 'week' ? 'on' : '') + '" onclick="bookingV2SetAvgMode(\'week\')">Weekly</button>\n          <button class="bkv2-mode-btn ' + (mode === 'day' ? 'on' : '') + '" onclick="bookingV2SetAvgMode(\'day\')">Daily</button>\n          <button class="bkv2-mode-btn ' + (mode === 'total' ? 'on' : '') + '" onclick="bookingV2SetAvgMode(\'total\')">Total</button>\n'
      + '        </div>\n      </div>\n      <div class="bkv2-routes-grid">' + cards + '</div>\n    </div>\n  ';
  });

  /* ── the matrix ─────────────────────────────────────────────────────────── */
  wrap('bookingV2RenderMatrix', function(orig){
    var ym = cursorYm(), j = month(ym), M = j && j.matrix;
    if(!M) return orig.apply(this, [].slice.call(arguments, 1));
    var B = window._bkV2, cur = B.cursor, year = cur.getFullYear(), mon = cur.getMonth();
    var lastDay = new Date(year, mon + 1, 0).getDate();
    var todayKey = window.bookingV2DateKey(new Date());
    var _dk = function(d){ return year + '-' + String(mon + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0'); };
    var headers = '<th class="rowh">Route</th>', wkArr = [];
    for(var d = 1; d <= lastDay; d++){
      var dow = new Date(year, mon, d).getDay(), weekend = dow === 0 || dow === 6, dateKey = _dk(d);
      wkArr.push(weekend);
      headers += '<th class="dh ' + (weekend ? 'weekend' : '') + ' ' + (dateKey === todayKey ? 'today' : '') + ' ' + ((B.selected && B.selected.date === dateKey) ? 'sel' : '') + '" onclick="bookingV2SelectDay(\'' + dateKey + '\')" title="View ' + dateKey + '">' + ['S','M','T','W','T','F','S'][dow] + '<span class="dnum">' + d + '</span></th>';
    }
    headers += '<th class="rowh sumh">รวมเดือน</th>';
    headers += '<th class="pxh" title="ผู้ใหญ่">AD</th><th class="pxh" title="เด็ก">CHD</th><th class="pxh" title="ทารก">INF</th><th class="pxh" title="ฟรี / FOC">FOC</th>';
    var pxCells = function(o){ return ['ad','chd','inf','foc'].map(function(k){ var v = +((o || {})[k]) || 0; return v ? '<td class="px">' + v.toLocaleString() + '</td>' : '<td class="px z">&middot;</td>'; }).join(''); };
    var sumCell = function(val, foot, col, brk){ return '<td class="sum"><b' + (col ? ' style="color:' + col + '"' : '') + '>' + val.toLocaleString() + '</b><i>' + foot + '</i></td>' + pxCells(brk); };
    var brkTitle = function(x){ return x ? 'AD ' + (+x.ad || 0) + ' · CHD ' + (+x.chd || 0) + ' · INF ' + (+x.inf || 0) + ' · FOC ' + (+x.foc || 0) : ''; };
    var rows = M.families.map(function(F){
      var fam = { id: F.family_id, name: F.name, color: F.color };
      var isExpanded = B.expanded.has(fam.id);
      var parentRow = '<td class="rowh" onclick="bookingV2ToggleFamily(\'' + fam.id + '\')" style="border-left-color:' + fam.color + '"><span class="caret">' + (isExpanded ? '▾' : '▸') + '</span>' + fam.name + '<span class="subc">' + F.variants.length + ' variant' + (F.variants.length === 1 ? '' : 's') + '</span></td>';
      for(var d2 = 1; d2 <= lastDay; d2++){
        var dk = _dk(d2), wk = wkArr[d2 - 1] ? ' wk' : '';
        if(isExpanded){ parentRow += '<td class="cell blank' + wk + '"></td>'; continue; }
        var c = F.cells[d2 - 1], sel = B.selected && B.selected.date === dk && B.selected.familyId === fam.id;
        if(!c.open && c.total === 0){ parentRow += '<td class="cell closed' + wk + '" title="All routes in this family closed">&times;</td>'; continue; }
        if(c.total === 0){ parentRow += '<td class="cell empty' + wk + (sel ? ' sel' : '') + '" onclick="bookingV2SelectFamilyCell(\'' + dk + '\',\'' + fam.id + '\')">&mdash;</td>'; continue; }
        var cls = ['cell', c.foc_pending ? 'foc' : '', sel ? 'sel' : '', c.foc_pending ? 'focdot' : '', wk.trim()].filter(Boolean).join(' ');
        var st = (c.foc_pending || sel) ? '' : ' style="' + window.bookingV2MxHeat(c.total, F.min, F.max, fam.color, false) + '"';
        parentRow += '<td class="' + cls + '"' + st + ' onclick="bookingV2SelectFamilyCell(\'' + dk + '\',\'' + fam.id + '\')">' + c.total + '</td>';
      }
      parentRow += sumCell(F.sum, isExpanded ? 'รวมทุก variant' : (F.live_days ? Math.round(F.sum / F.live_days) + '/วันที่ออก' : 'ไม่ได้ออกเลย'), isExpanded ? '#5B6670' : fam.color, F);
      var html = '<tr class="fam ' + (isExpanded ? 'expanded' : '') + '">' + parentRow + '</tr>';
      if(isExpanded){
        var withData = F.variants.filter(function(v){ return v.live_days; }), noData = F.variants.filter(function(v){ return !v.live_days; });
        var showEmpty = !!(B.mxEmpty && B.mxEmpty.has(fam.id));
        var shown = showEmpty ? F.variants : (withData.length ? withData : F.variants);
        shown.forEach(function(V){
          var subRow = '<td class="rowh" title="' + V.name + '">' + V.name + '</td>';
          for(var d3 = 1; d3 <= lastDay; d3++){
            var dk3 = _dk(d3), wk3 = wkArr[d3 - 1] ? ' wk' : '', cc = V.cells[d3 - 1], has = cc.total > 0;
            if(!cc.open && !has){ subRow += '<td class="cell closed' + wk3 + '" title="Route closed">&times;</td>'; continue; }
            var sel3 = B.selected && B.selected.date === dk3 && B.selected.routeId === V.route_id;
            if(!has){ subRow += '<td class="cell empty' + wk3 + (sel3 ? ' sel' : '') + '" onclick="bookingV2SelectCell(\'' + dk3 + '\',\'' + V.route_id + '\')">&mdash;</td>'; continue; }
            if(!cc.open){ subRow += '<td class="cell closed-with-data' + wk3 + ' ' + (sel3 ? 'sel' : '') + '" onclick="bookingV2SelectCell(\'' + dk3 + '\',\'' + V.route_id + '\')" title="Bookings on closed route">' + cc.total + '</td>'; continue; }
            var cls3 = ['cell', cc.foc_pending ? 'foc' : '', sel3 ? 'sel' : '', cc.foc_pending ? 'focdot' : '', wk3.trim()].filter(Boolean).join(' ');
            var st3 = (cc.foc_pending || sel3) ? '' : ' style="' + window.bookingV2MxHeat(cc.total, V.min, V.max, fam.color, false) + '"';
            subRow += '<td class="' + cls3 + '"' + st3 + ' onclick="bookingV2SelectCell(\'' + dk3 + '\',\'' + V.route_id + '\')">' + cc.total + '</td>';
          }
          subRow += sumCell(V.sum, V.live_days + ' วัน', V.live_days ? fam.color : '#B6BCC3', V);
          html += '<tr class="sub">' + subRow + '</tr>';
        });
        if(noData.length && withData.length){
          html += '<tr class="sub emptyvars"><td class="rowh mxmore" colspan="' + (lastDay + 6) + '" onclick="bookingV2ToggleEmptyVars(\'' + fam.id + '\')">'
            + (showEmpty ? '▾' : '▸') + ' <u>อีก ' + noData.length + ' variant' + (noData.length === 1 ? '' : 's') + ' ไม่มีคนทั้งเดือน</u>'
            + ' <span class="mxmore-n">' + noData.map(function(v){ return v.name; }).join(' · ') + '</span></td></tr>';
        }
      }
      return html;
    }).join('');
    var anyExpanded = B.expanded.size > 0, nVariants = M.families.reduce(function(a, f){ return a + f.variants.length; }, 0);
    var toolbar = '<div class="bkv2-mx-toolbar"><span>' + M.families.length + ' programs &middot; ' + nVariants + ' variants</span><span style="margin-left:auto"></span><button onclick="bookingV2ExpandAllFamilies()">Expand all</button>' + (anyExpanded ? '<button onclick="bookingV2CollapseAllFamilies()">Collapse all</button>' : '')
      + '<button onclick="bookingV2TogglePanel()" title="' + (B.panelHid ? 'กางแผงรายละเอียดวัน' : 'พับแผงขวา · ตารางกว้างขึ้น 360px') + '">' + (B.panelHid ? '&rsaquo;&rsaquo; แผงขวา' : '&lsaquo;&lsaquo; พับแผงขวา') + '</button></div>';
    var maxDay = Math.max.apply(null, [1].concat(M.day_totals.map(function(t){ return t.total; })));
    var totRow = '<td class="rowh">รวมทั้งวัน</td>', grand = 0, gB = { ad: 0, chd: 0, inf: 0, foc: 0 };
    M.day_totals.forEach(function(t, i){
      var v = t.total || 0; grand += v; gB.ad += t.ad; gB.chd += t.chd; gB.inf += t.inf; gB.foc += t.foc;
      totRow += '<td class="' + (_dk(i + 1) === todayKey ? 'today' : '') + '"' + (v ? ' title="' + _dk(i + 1) + ' · ' + brkTitle(t) + '"' : '') + '><div class="tn">' + (v || '·') + '</div><div class="ttrack"><div class="tbar" style="width:' + (v ? Math.max(8, Math.round(v / maxDay * 100)) : 0) + '%"></div></div></td>';
    });
    totRow += sumCell(grand, 'เฉลี่ย ' + Math.round(grand / lastDay) + '/วัน', '', gB);
    var colgroup = '<col class="label">';
    for(var d4 = 1; d4 <= lastDay; d4++) colgroup += '<col class="day">';
    colgroup += '<col class="sumcol"><col class="pxcol"><col class="pxcol"><col class="pxcol"><col class="pxcol">';
    return '\n    ' + window.bookingV2RenderStats() + '\n    ' + window.bookingV2RenderRouteAvgs() + '\n    <div class="bkv2-split' + (B.panelHid ? ' nopanel' : '') + '">\n      <div class="bkv2-mx">\n        ' + toolbar + '\n        <table>\n          <colgroup>' + colgroup + '</colgroup>\n          <thead><tr>' + headers + '</tr></thead>\n          <tbody>\n            ' + rows + '\n            <tr class="tot">' + totRow + '</tr>\n          </tbody>\n        </table>\n      </div>\n      ' + window.bookingV2PanelSlot() + '\n    </div>\n    ' + window.bookingV2RenderFooterHints('mx') + '\n  ';
  });
})();
