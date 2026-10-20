/* ════════════════════════════════════════════════════════════════════════
   §opsEbSales (2026-10-20) · FE-3c · Executive Board · Sales Performance and Sales Targets tabs on the server's answers
   sales  GET /v1/exec-board/sales?kind=week|month&offset=0..-520            (company-wide, no pier)
   tgt    GET /v1/exec-board/sales-targets?month=this|next&me=1&pier=        (cards[], team, text for the LINE copy button)
   Ports legacy viewSales / spLabel and viewSalesTgt markup (11-exec-board.js). ebCopy stays legacy's (it reads data-copy). The server
   decides the weeks, the previous span (same number of days), the quiet agents and which salesperson "me" is; nothing is counted here.
   Classic script · after 99-ops-exec-board.js.
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O || !O.eb) return;
  var X = O.eb, E = X.E, num = X.num, baht = X.baht, pct = X.pct, chg = X.chg, chgP = X.chgP, thD = X.thD, thDow = X.thDow;
  var kpi = X.kpi, src = X.src, liveTag = X.liveTag;

  /* legacy spLabel: a month shows its name and year, a week its two ends; a running one adds how far it has come */
  function labelOf(p, kind, withTail){
    var tail = '';
    if(kind === 'month'){
      var d = X.dt(p.from), M = (typeof laMonAbbrTH === 'function') ? laMonAbbrTH() : [];
      if(withTail !== false && !p.full) tail = ' · ถึง ' + thD(p.to) + ' (' + p.days + ' วัน)';
      return (M[d.getMonth()] || '') + ' ' + d.getFullYear() + tail;
    }
    var end = p.end || X.addDays(p.from, 6);
    if(withTail !== false && !p.full) tail = ' · ถึงวันนี้ ' + p.days + ' วัน';
    return thD(p.from) + ' – ' + thD(end) + tail;
  }
  X.navLabel = function(EB, a){ return a && a.range ? labelOf(a.range, EB.sp || 'week') : ''; };

  function salesBar(a){ return a; }
  function viewSales(A, EB){
    var kind = A.kind, R = A.range, T = A.totals, vs = T.vs_previous, rows = A.sales, M = kind === 'month';
    var h = '<div class="eb-grid eb-kpis">'
      + kpi('Pax ที่ขายได้ (สุทธิ)', num(T.pax), (T.cancelled_pax ? 'หักยกเลิก ' + num(T.cancelled_pax) + ' · ' : '') + (+T.pax_per_day).toFixed(1) + ' / วัน · ' + chgP(vs.pax.change_pct) + ' vs ช่วงก่อน')
      + kpi('ยอดขาย (Value sold)', baht(T.value), baht(T.value_per_day) + ' / วัน · ' + chgP(vs.value.change_pct))
      + kpi('ใบจอง', num(T.bookings), (+T.pax_per_booking).toFixed(2) + ' pax / ใบ · ' + chgP(vs.bookings.change_pct))
      + kpi('FOC', num(T.foc) + '<small>pax</small>', (T.foc_pct == null ? '0' : (+T.foc_pct).toFixed(1)) + '% ของ pax' + (vs.foc_pct != null ? (' · ช่วงก่อน ' + (+vs.foc_pct).toFixed(1) + '%') : ''), T.foc_warning ? 'warn' : '')
      + kpi('THB / Pax', '฿' + num(T.value_per_pax), chgP(vs.value_per_pax.change_pct) + ' vs ช่วงก่อน')
      + kpi('เอเยนต์ที่ส่งยอด', num(T.agents_sent), '<span class="eb-up">★ ใหม่ ' + num(T.agents_new) + '</span> · เงียบไป ' + num(T.agents_quiet))
      + '</div>';

    var head = '<tr><th>#</th><th>เซลส์</th><th>Pax</th><th>ยอดขาย</th><th>% ยอดขาย</th><th>ใบ</th><th title="Pax ของใบที่จองไว้ก่อนช่วงนี้ แล้วยกเลิกในช่วงนี้ · หักออกจาก Pax / ยอดขายแล้ว">หักยกเลิก</th><th>FOC</th><th>FOC %</th><th>THB / Pax</th><th>Pax / วัน</th><th>vs ช่วงก่อน</th><th>เอเยนต์ส่ง</th><th>★ ใหม่</th><th>เงียบไป</th>'
      + (M ? '<th>เอเยนต์ทั้งหมด</th><th>Activation</th><th>Pax / เอเยนต์</th>' : '<th>เอเยนต์อันดับ 1</th>') + '</tr>';
    var body = rows.map(function(x){
      var fp = x.pax ? x.foc * 100 / x.pax : null, ta = x.top_agent;
      return '<tr' + (x.unassigned ? ' class="eb-dim"' : '') + '><td>' + (x.unassigned ? '' : x.rank) + '</td><td><span class="eb-dot" style="background:' + E(x.color) + '"></span><b>' + E(x.name) + '</b></td>'
        + '<td><b>' + num(x.pax) + '</b></td><td><b>' + baht(x.value) + '</b></td>'
        + '<td><div class="eb-pct"><span><i style="width:' + x.share_pct + '%;background:' + E(x.color) + '"></i></span>' + x.share_pct + '%</div></td>'
        + '<td>' + num(x.bookings) + '</td><td>' + (x.cancelled_pax ? '<span class="eb-dn">−' + num(x.cancelled_pax) + '</span>' : '<span class="eb-mut">0</span>') + '</td><td>' + num(x.foc) + '</td><td>' + (fp == null ? '—' : (fp > 10 ? '<span class="eb-st w">' + fp.toFixed(1) + '%</span>' : fp.toFixed(1) + '%')) + '</td>'
        + '<td>฿' + num(x.value_per_pax) + '</td><td>' + (+x.pax_per_day).toFixed(1) + '</td><td>' + chgP(x.change_pct_vs_previous) + '</td>'
        + '<td>' + num(x.agents_sent) + '</td><td>' + (x.agents_new ? '<span class="eb-up">' + x.agents_new + '</span>' : '<span class="eb-mut">0</span>') + '</td><td>' + (x.agents_quiet ? num(x.agents_quiet) : '<span class="eb-mut">0</span>') + '</td>'
        + (M ? '<td>' + (x.agents_total || '—') + '</td><td>' + (x.activation_pct == null ? '—' : x.activation_pct + '%') + '</td><td>' + (x.pax_per_agent == null ? '—' : (+x.pax_per_agent).toFixed(1)) + '</td>'
            : '<td class="eb-l" title="' + E(ta ? ta.name : '') + '">' + (ta ? E(ta.name) + ' <span class="eb-mut">' + ta.share_pct + '%</span>' : '—') + '</td>')
        + '</tr>';
    }).join('');
    var foot = '<tr class="eb-tot"><td></td><td><b>รวมทั้งทีม</b></td><td><b>' + num(T.pax) + '</b></td><td><b>' + baht(T.value) + '</b></td><td>100%</td><td>' + num(T.bookings) + '</td><td>' + (T.cancelled_pax ? '<span class="eb-dn">−' + num(T.cancelled_pax) + '</span>' : '0') + '</td><td>' + num(T.foc) + '</td><td>' + (T.foc_pct == null ? '—' : (+T.foc_pct).toFixed(1) + '%') + '</td>'
      + '<td>฿' + num(T.value_per_pax) + '</td><td>' + (+T.pax_per_day).toFixed(1) + '</td><td>' + chgP(vs.pax.change_pct) + '</td><td>' + num(T.agents_sent) + '</td><td>' + num(T.agents_new) + '</td><td>' + num(T.agents_quiet) + '</td>'
      + (M ? '<td>' + num(T.agents_total) + '</td><td>' + (T.activation_pct == null ? '—' : T.activation_pct + '%') + '</td><td>' + (T.pax_per_agent == null ? '—' : (+T.pax_per_agent).toFixed(1)) + '</td>' : '<td></td>') + '</tr>';
    h += '<div class="eb-sec">อันดับเซลส์ · ' + E(labelOf(R, kind)) + '</div><div class="eb-card eb-scroll"><h2>ยอดขายตามเซลส์ <span class="eb-tag">นับตามวันที่ใบเข้าระบบ · หักใบเก่าที่ยกเลิกในช่วงนี้ · ไม่นับ quote</span>' + src('ที่มา: Booking · Sales') + '</h2>'
      + '<table class="eb-tbl eb-sp">' + '<thead>' + head + '</thead><tbody>' + (body || '<tr><td colspan="17" class="eb-none">ยังไม่มีใบจองในช่วงนี้</td></tr>') + foot + '</tbody></table>'
      + '<div class="eb-foot">vs ช่วงก่อน = Pax ต่อวันเทียบ' + (kind === 'month' ? 'เดือนก่อน (จำนวนวันเท่ากัน)' : 'สัปดาห์ก่อน') + ' · ★ ใหม่ = เอเยนต์ที่ส่งใบแรกในระบบภายในช่วงนี้ · เงียบไป = ' + E(A.quiet.label) + '</div></div>';

    /* แนวโน้ม 7 ช่วง · ต่อวัน */
    var tr = A.trend, P = tr.periods;
    var trendTbl = function(key, fmt){
      var mx = 1; tr.sales.forEach(function(s){ s[key].forEach(function(v){ if(v > mx) mx = v; }); });
      var tmx = Math.max.apply(null, [1].concat(tr.team[key]));
      var line = function(name, color, vals, m){ var last = vals[vals.length - 1], prev = vals[vals.length - 2];
        return '<tr><td><span class="eb-dot" style="background:' + E(color) + '"></span><b>' + E(name) + '</b></td><td><div class="eb-spark">'
          + vals.map(function(v, j){ return '<i title="' + E(labelOf(P[j], kind)) + ' · ' + fmt(v) + ' / วัน" style="height:' + Math.max(2, Math.round(v * 100 / m)) + '%;background:' + (j === vals.length - 1 ? E(color) : 'var(--eb-s2)') + '"></i>'; }).join('')
          + '</div></td><td><b>' + fmt(last) + '</b></td><td>' + chg(last, prev) + '</td></tr>'; };
      return '<table class="eb-tbl eb-tr"><thead><tr><th>เซลส์</th><th>7 ' + (kind === 'month' ? 'เดือน' : 'สัปดาห์') + ' (ต่อวัน)</th><th>ล่าสุด</th><th>vs ก่อนหน้า</th></tr></thead><tbody>'
        + tr.sales.map(function(s){ return line(s.name, s.color, s[key], mx); }).join('')
        + line('ทั้งทีม', '#0F1B3D', tr.team[key], tmx)
        + '</tbody></table>';
    };
    h += '<div class="eb-sec">แนวโน้ม 7 ' + (kind === 'month' ? 'เดือน' : 'สัปดาห์') + ' · ' + E(labelOf(P[0], kind, false)) + ' ถึง ' + E(labelOf(P[P.length - 1], kind, false)) + '</div><div class="eb-grid eb-r4h">'
      + '<div class="eb-card"><h2>Pax ต่อวัน</h2>' + trendTbl('pax_per_day', function(v){ return (+v).toFixed(1); }) + '</div>'
      + '<div class="eb-card"><h2>ยอดขายต่อวัน</h2>' + trendTbl('value_per_day', baht) + '</div></div>';

    /* Top 10 · เงียบไป */
    var top = A.top_agents, Q = A.quiet;
    h += '<div class="eb-sec">เอเยนต์</div><div class="eb-grid eb-r4h">'
      + '<div class="eb-card"><h2>Top 10 เอเยนต์ <span class="eb-tag">' + E(labelOf(R, kind)) + '</span></h2><table class="eb-tbl eb-l2"><thead><tr><th>#</th><th>เอเยนต์</th><th>เซลส์</th><th>Pax</th><th>ยอดขาย</th></tr></thead><tbody>'
      + (top.length ? top.map(function(a){
          return '<tr><td>' + a.rank + '</td><td class="eb-l"><b>' + E(a.name) + '</b>' + (a.new ? ' <span class="eb-new">★ ใหม่</span>' : '') + '</td><td><span class="eb-dot" style="background:' + E(a.sales_color) + '"></span>' + E(a.sales_name) + '</td><td><b>' + num(a.pax) + '</b></td><td>' + baht(a.value) + '</td></tr>'; }).join('')
        : '<tr><td colspan="5" class="eb-none">—</td></tr>') + '</tbody></table></div>'
      + '<div class="eb-card"><h2>เอเยนต์ที่เงียบไป <span class="eb-tag">' + E(Q.label) + ' · ' + num(Q.count) + ' ราย</span></h2>'
      + (Q.agents.length ? '<div class="eb-qscroll"><table class="eb-tbl eb-l2"><thead><tr><th>#</th><th>เอเยนต์</th><th>เซลส์</th><th>Pax ช่วงก่อน</th></tr></thead><tbody>'
          + Q.agents.map(function(a, i){ return '<tr><td>' + (i + 1) + '</td><td class="eb-l">' + E(a.name) + '</td><td><span class="eb-dot" style="background:' + E(a.sales_color) + '"></span>' + E(a.sales_name) + '</td><td>' + num(a.previous_pax) + '</td></tr>'; }).join('')
          + '</tbody></table></div>' : '<div class="eb-none">ไม่มีเอเยนต์ที่เงียบไป</div>') + '</div></div>';

    /* เอเยนต์ที่ส่งยอด แยกตามเซลส์ */
    h += '<div class="eb-sec">เอเยนต์ที่ส่งยอดเข้ามา · แยกตามเซลส์</div><div class="eb-mv">'
      + rows.map(function(x, i){
          var L = x.agents, nNew = L.filter(function(a){ return a.new; }).length, mx = Math.max.apply(null, [1].concat(L.map(function(a){ return a.pax; })));
          return '<div class="eb-card"><h2><span class="eb-dot" style="background:' + E(x.color) + '"></span>' + (x.unassigned ? '' : '#' + (i + 1) + ' ') + E(x.name) + '</h2>'
            + '<div class="eb-foot" style="margin:-6px 0 8px">' + num(L.filter(function(a){ return a.bookings > 0; }).length) + ' ราย · ★ ใหม่ ' + num(nNew) + ' · ' + num(x.pax) + ' pax · ' + baht(x.value) + '</div>'
            + '<div class="eb-mvl">' + L.slice(0, 12).map(function(a){ return '<div class="rw" title="' + E(a.name + ' · ' + a.pax + ' pax · ' + baht(a.value) + ' · ' + a.bookings + ' ใบ') + '"><span class="lb">' + E(a.name) + (a.new ? ' <span class="eb-new">★</span>' : '') + '</span><span class="mini"><i style="width:' + Math.max(0, Math.round(a.pax * 100 / mx)) + '%;background:' + E(x.color) + '"></i></span><span class="vv"' + (a.pax < 0 ? ' style="color:var(--eb-bad)" title="ยกเลิกใบเก่า"' : '') + '>' + num(a.pax) + '</span></div>'; }).join('')
            + (L.length > 12 ? '<div class="eb-foot">+ อีก ' + (L.length - 12) + ' ราย</div>' : '') + '</div></div>';
        }).join('') + '</div>';
    return h;
  }

  /* ── เป้าเซลส์ ── */
  var CALL_CLS = { quiet: 'q', short_family: 'o', lock_unused: 'l' };
  function viewSalesTgt(A, EB){
    var t0 = A.today, tm = A.team, teamToday = tm.today, teamNeed = tm.need, only = !!EB.me;
    var d14 = tm.d14, mx = Math.max.apply(null, [1, teamNeed].concat(d14.map(function(x){ return x.pax; })));
    var chip = function(st, txt){ return '<span class="eb-st ' + st.code + '">' + txt + '</span>'; };
    var head = '<div class="eb-card eg-head st"><div class="eg-hl">'
      + '<div class="k"><span>วันนี้ · ' + E(thDow(t0)) + ' ' + E(thD(t0)) + '</span>' + liveTag() + '</div>'
      + '<div class="big">ทั้งทีมได้ <span class="n ' + (tm.on_target ? 'good' : 'bad') + '">' + num(teamToday) + '</span> <span class="u">/ ต้องได้ ' + num(tm.need_ceil) + ' ที่</span></div>'
      + '<div class="s">ทัน ' + tm.hit + ' คน · ใกล้เคียง ' + tm.near + ' · ไม่ทัน ' + tm.miss + ' · ช่องว่าง' + E(A.label) + 'เหลือ ' + num(tm.month_gap) + ' · อีก ' + A.days_left + ' วัน</div>'
      + '<div class="bar"><div class="t"><i style="width:' + Math.min(100, tm.bar_pct) + '%;background:' + (tm.on_target ? '#15803D' : '#F59E0B') + '"></i></div><span>' + (teamNeed > 0 ? tm.bar_pct + '% ของเป้าวัน' : 'ถึงเป้าเดือนแล้ว') + '</span></div>'
      + '<div class="c">เป้า/วัน = ช่องว่างที่เหลือ ÷ วันที่เหลือ · ปรับทุกเช้า</div></div>'
      + '<div class="st-chart"><div class="hh"><b>ทีมทำได้ต่อวัน · 14 วันล่าสุด</b><span class="eb-mut">แท่ง = ที่นั่งที่ปิดได้ (สำหรับ' + E(A.label) + ') · เส้น = ต้องได้/วัน · เขียว = ถึง</span></div>'
      + '<div class="bars"><s style="bottom:' + Math.round(teamNeed * 100 / mx) + '%"></s><em style="bottom:' + Math.round(teamNeed * 100 / mx) + '%">ต้องได้ ' + num(tm.need_ceil) + '</em>'
      + d14.map(function(x, i){ return '<div class="' + (i === 13 ? 'td' : (x.pax >= teamNeed ? 'ok' : '')) + '" style="height:' + Math.max(2, Math.round(x.pax * 100 / mx)) + '%" title="' + E(thD(x.date)) + ' · ' + num(x.pax) + ' ที่"><b>' + num(x.pax) + '</b></div>'; }).join('') + '</div>'
      + '<div class="hx">' + d14.map(function(x, i){ return '<span' + (i === 13 ? ' class="td"' : '') + '>' + (i === 13 ? 'วันนี้' : X.dt(x.date).getDate()) + '</span>'; }).join('') + '</div></div></div>';

    var cards = A.cards.map(function(o){
      var gap = o.gap, nd = o.need_per_day, st = o.status;
      var dots = '<span class="st-d7" title="7 วันล่าสุด · ถึงเป้าวัน ' + o.days_on_target + ' วัน">' + o.d7.map(function(v, i){ return '<i class="' + (i === 6 ? (v >= nd ? 'td' : 'tdm') : (v >= nd && nd > 0 ? 'ok' : '')) + '" title="' + E(thD(X.addDays(t0, i - 6))) + ' · ' + num(v) + '"></i>'; }).join('') + '</span>';
      var L = o.families;
      return '<div class="eb-card st-card' + (o.alert ? ' alert' : '') + '" data-sid="' + E(o.sales_id) + '"><div class="st-h"><span class="eb-dot" style="background:' + E(o.color) + '"></span><b>' + E(o.name) + '</b><span class="eb-mut">' + E(A.label) + ' ' + num(o.booked) + ' / ' + num(o.target) + ' · ขาด ' + num(gap) + '</span><span class="eb-sp"></span>' + dots + chip(st, 'วันนี้ +' + num(o.today) + ' / ' + num(o.need_per_day_ceil) + ' · ' + E(st.label)) + '</div>'
        + '<div class="eg-sxh"><span>เส้นทาง</span><span>ขาด</span><span>ต้องได้/วัน</span><span>วันนี้</span><span>วันที่ว่างเยอะ · กดไปขาย</span></div>'
        + (L.length ? L.map(function(x){
            return '<div class="eg-sx-r' + (x.lag ? ' lag' : '') + '"><span class="f">' + E(x.name) + (x.lag ? ' <b>ตามหลัง</b>' : '') + '</span><span class="n ' + (x.lag ? 'bad' : '') + '">' + (x.gap ? num(x.gap) : '✓') + '</span><span class="n">' + (x.gap ? num(x.need_per_day_ceil) : '—') + '</span><span class="n ' + x.status.code + '">' + (x.today ? '+' + num(x.today) : '0') + '</span>'
              + '<span class="od">' + (x.open_days.length ? x.open_days.map(function(d){ return '<button onclick="ebGoTrip(\'' + E(d.date) + '\',\'' + E(d.route_id) + '\')">' + E(d.label) + ' · ว่าง ' + num(d.free) + '</button>'; }).join('') : '<small class="eb-mut">ไม่มีวันว่าง</small>') + '</span></div>'; }).join('')
          : '<div class="eb-none">ยังไม่มีเป้าแยกเส้นทาง</div>')
        + '<div class="st-ft"><span class="eb-mut">เอเยนต์ที่ควรติดต่อ:</span>' + (o.calls.length ? o.calls.slice(0, 4).map(function(c){ return '<span class="eg-call ' + (CALL_CLS[c.kind] || '') + '" title="' + E(c.detail) + '">' + E(c.name) + ' · ' + E(c.why) + '</span>'; }).join('') : '<span class="eb-mut">ไม่มี</span>')
        + '<span class="eb-sp"></span><button class="eb-btn" data-copy="' + E(o.text) + '" onclick="ebCopy(this)">คัดลอกสรุปส่งไลน์</button></div></div>';
    }).join('');
    if(!cards) cards = '<div class="eb-card eb-none">' + (only ? (A.reason === 'no_salesperson' ? 'บัญชีนี้ยังไม่ได้ผูกกับเซลส์ (ตั้งใน Sales › บัญชีผู้ใช้)' : 'ยังไม่มีเป้าของคุณใน' + E(A.label)) : 'ยังไม่มีเซลส์ที่มีเป้าใน' + E(A.label)) + '</div>';
    return head + '<div class="st-cards">' + cards + '</div><div class="eb-foot">การ์ดเรียงจากคนที่ตามหลังมากสุด · กรอบแดง = ไม่ทันเป้าวันติดกัน 3 วัน · ตัวเลขมาจากสัดส่วนที่ผู้บริหารกำหนดในหน้า Gap to Target' + (only ? '' : ' · เซลส์กด "เฉพาะฉัน" เห็นการ์ดตัวเอง') + '</div>';
  }

  O.eb.views.sales = {
    path: function(EB){ return ['/v1/exec-board/sales', { kind: EB.sp || 'week', offset: +EB.off || 0 }]; },
    draw: viewSales
  };
  O.eb.views.tgt = {
    path: function(EB){ return ['/v1/exec-board/sales-targets', { month: EB.stm || 'this', me: EB.me ? '1' : '0', pier: EB.pier || '' }]; },
    draw: viewSalesTgt
  };
})();
