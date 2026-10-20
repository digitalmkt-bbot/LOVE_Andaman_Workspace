/* ════════════════════════════════════════════════════════════════════════
   §opsEbOverview (2026-10-20) · FE-3b · Executive Board · "ภาพรวมรายได้" tab on the server's answer
   GET /v1/exec-board/overview?period=today|month|quarter|year&pier=   (staff only; an agent login gets 403 and its message is drawn)
   Ports legacy viewToday / viewPeriod / tomorrowCard / feedHtml markup (11-exec-board.js) with the numbers swapped for the answer's:
   kpis, trips_today, sales_today, trend, by_family, by_channel, by_nationality, top_agents, tomorrow, leakage, lead_by_market.
   Differences from legacy: a feed line shows the booking's pax total (the server sends no AD/CHD/INF/FOC split on a feed line) and the
   programme name without its variant; the clock behind "LIVE" is the browser's. Classic script · after 99-ops-exec-board.js.
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O || !O.eb) return;
  var X = O.eb, E = X.E, num = X.num, baht = X.baht, pct = X.pct, chgP = X.chgP, thD = X.thD, thDow = X.thDow, hhmm = X.hhmm;
  var kpi = X.kpi, src = X.src, hbar = X.hbar, chanCard = X.chanCard, liveTag = X.liveTag;
  var LBL = { today: 'วันนี้', month: 'เดือนนี้', quarter: 'ไตรมาสนี้', year: 'ปีนี้' };

  function name2(r){ return { f: r.family || r.name || '', v: X.variantOf(r.name, r.family) }; }
  function capCell(p, cap, add){
    if(!(cap > 0)) return '<span class="eb-mut">' + num(p) + ' · ไม่จำกัด</span>';
    var a = Math.max(0, p - add);
    return '<div class="eb-cap"><span class="t"><i style="width:' + Math.min(100, a * 100 / cap) + '%;background:var(--eb-s4)"></i><i style="width:' + Math.max(0, Math.min(100 - a * 100 / cap, add * 100 / cap)) + '%;background:#16A34A"></i></span><span class="n">' + num(p) + '/' + num(cap) + '</span></div>';
  }
  /* a list of the answer's feed lines: {booking_id, at, created_day, agent, family, service_date, pax, amount, pending_approval} */
  function feedHtml(list, opt){
    opt = opt || {}; var t0 = X.today();
    if(!list.length) return '<div class="eb-none">ยังไม่มีใบจอง</div>';
    return '<ul class="eb-feed">' + list.slice(0, opt.n || 7).map(function(x){
      var d = x.created_day === t0, when = (d && x.at) ? hhmm(x.at) : thD(x.created_day || t0);
      var tag = x.pending_approval ? '<span style="color:var(--eb-warn)">รออนุมัติ</span>'
        : opt.trav ? (x.service_date === X.addDays(t0, 1) ? 'พรุ่งนี้' : (x.service_date === t0 ? 'วันนี้' : ('เดินทาง ' + thD(x.service_date))))
        : (d ? '<span class="eb-up">ใหม่วันนี้</span>' : '');
      return '<li class="' + (d ? 'new' : '') + '"><span class="t">' + E(when) + '</span><span class="w"><b>' + E(x.agent) + '</b><span>'
        + (opt.trav ? E(thD(x.service_date)) + ' · ' : '') + E(x.family) + ' · ' + E(num(x.pax)) + ' pax</span></span><span class="a">' + baht(x.amount) + '<span>' + tag + '</span></span></li>';
    }).join('') + '</ul>';
  }
  function tomorrowCard(T, full){
    var tt = T.totals, lf = tt.load_factor_pct;
    var head = '<h2>พรุ่งนี้ · ' + E(thDow(T.date)) + ' ' + E(thD(T.date)) + ' ' + liveTag() + src('ที่มา: Booking (By trip)') + '</h2>';
    var tiles = '<div class="eb-tm">'
      + '<div><div class="l">ผู้โดยสาร</div><div class="v">' + num(tt.pax) + (tt.capacity ? '<small>/ ' + num(tt.capacity) + ' ที่</small>' : '') + '</div><div class="d">' + (tt.capacity ? 'Load factor ' + lf + '%' : '—') + '</div></div>'
      + '<div><div class="l">รายได้พรุ่งนี้</div><div class="v">' + baht(tt.revenue) + '</div><div class="d">' + num(T.rows.length) + ' รอบ</div></div>'
      + '<div><div class="l">จองเพิ่มวันนี้</div><div class="v" style="color:var(--eb-good)">+' + num(tt.added_pax) + '<small>pax</small></div><div class="d">+' + baht(tt.added_value) + ' · ' + num(tt.added_trips) + ' ใบ</div></div>'
      + (full
        ? '<div><div class="l">รออนุมัติ</div><div class="v" style="color:' + (tt.pending_pax ? 'var(--eb-warn)' : 'inherit') + '">' + num(tt.pending_pax) + '<small>pax</small></div><div class="d">' + num(tt.pending_trips) + ' ใบ · ' + baht(tt.pending_value) + '</div></div>'
        : '<div><div class="l">ยังขายได้</div><div class="v">' + (tt.capacity ? num(tt.free) + '<small>ที่</small>' : '—') + '</div><div class="d">' + E(T.rows.filter(function(r){ return r.free > 0; }).sort(function(a, b){ return b.free - a.free; }).slice(0, 3).map(function(r){ return name2(r).f + ' ' + r.free; }).join(' · ') || '—') + '</div></div>')
      + '</div>';
    if(!full) return '<div class="eb-card" id="eb-tmw">' + head + tiles + '</div>';
    var tbl = '<table class="eb-tbl"><thead><tr><th>โปรแกรม · รอบ</th><th>เวลา</th><th>ที่นั่ง</th><th>ว่าง</th><th>รายได้</th><th>วันนี้ +</th></tr></thead><tbody>'
      + (T.rows.length ? T.rows.map(function(r){ var n = name2(r);
        return '<tr><td><span class="eb-dot" style="background:' + E(r.color || '#8b909c') + '"></span><b>' + E(n.f) + '</b>' + (n.v ? ' · ' + E(n.v) : '') + '</td><td>' + E(r.departure) + '</td><td>' + capCell(r.pax, r.capacity, r.added_pax) + '</td>'
          + '<td>' + (r.free == null ? '—' : (r.free <= 0 ? '<span class="eb-st b">● เต็ม</span>' : num(r.free))) + '</td><td>' + baht(r.revenue) + '</td><td>' + (r.added_pax ? '<span class="eb-up">+' + num(r.added_pax) + '</span>' : '<span class="eb-mut">0</span>') + '</td></tr>'; }).join('')
        : '<tr><td colspan="6" class="eb-none">ยังไม่มีทริปพรุ่งนี้</td></tr>')
      + '</tbody></table><div class="eb-lgd"><i style="background:var(--eb-s4)"></i>จองไว้ก่อนวันนี้ <i style="background:#16A34A"></i>จองเพิ่มวันนี้</div>';
    return '<div class="eb-grid eb-r5" id="eb-tmw"><div class="eb-card">' + head + tiles + tbl + '</div>'
      + '<div class="eb-card"><h2>ใบจองล่าสุดของพรุ่งนี้ <span class="eb-tag">เรียงจากใหม่สุด</span></h2>' + feedHtml(T.feed)
      + '<div class="eb-foot">วันนี้เข้ามาสำหรับพรุ่งนี้ ' + num(tt.added_trips) + ' ใบ · +' + baht(tt.added_value) + '</div></div></div>';
  }

  /* ── "วันนี้" ── */
  function viewToday(A){
    var k = A.kpis, t0 = A.today, S = A.sales_today, TT = A.trips_today || [];
    var pc = k.passengers, ns = k.lost.pax, nsV = k.lost.value;
    var h = '<div class="eb-grid eb-kpis">'
      + kpi('รายได้ของทริปวันนี้', baht(k.revenue.value), chgP(k.revenue.last_week.change_pct) + ' vs ' + E(thDow(t0)) + 'ที่แล้ว · ' + chgP(k.revenue.last_year.change_pct) + ' vs ปีก่อน')
      + kpi('ผู้โดยสารวันนี้', num(pc.travelled) + '<small>/ ' + num(pc.booked) + ' จอง</small>', 'เช็คอินหน้าท่าแล้ว ' + num(pc.checked_in_bookings) + '/' + num(pc.bookings) + ' ใบ · ขาด/ยกเลิกหน้างาน ' + num(pc.lost), '', pc.bookings ? pc.checked_in_pct : null)
      + kpi('ยอดขายที่เข้ามาวันนี้', baht(k.sales_in.value), num(k.sales_in.bookings) + ' ใบ · ' + num(k.sales_in.pax) + ' pax · ' + chgP(k.sales_in.change_pct_vs_avg_7_days) + ' vs เฉลี่ย 7 วัน')
      + kpi('ยกเลิกวันนี้', k.cancelled.value ? ('<span style="color:var(--eb-bad)">' + baht(-k.cancelled.value) + '</span>') : baht(0), num(k.cancelled.bookings) + ' ใบ · ' + num(k.cancelled.pax) + ' pax · สุทธิ <b>' + baht(k.cancelled.net) + '</b>')
      + kpi('No-show / ยกเลิกหน้างาน', num(ns) + '<small>pax</small>', ns ? ('มูลค่าประมาณ ' + baht(nsV)) : 'ยังไม่มี', ns ? 'warn' : '')
      + kpi('เงินเข้าวันนี้', baht(k.money_in.value), 'โอน/ชำระ ' + num(k.money_in.payments) + ' รายการ · เงินสดหน้าท่า ' + baht(k.money_in.pier_cash))
      + '</div>';

    var trip = '<table class="eb-tbl"><thead><tr><th>โปรแกรม · รอบ</th><th>เวลา</th><th>เช็คอินหน้าท่า</th><th>เดินทางจริง / จอง</th><th>ขาด</th><th>รายได้</th><th>Load factor</th></tr></thead><tbody>'
      + (TT.length ? TT.map(function(r){
          var c = r.check_in, n = name2(r);
          var st = c.status === 'none' ? '<span class="eb-sts">ไม่มีใบจอง</span>' : (c.status === 'all' ? '<span class="eb-sts dep">ครบ ' + c.bookings + ' ใบ</span>' : (c.status === 'some' ? '<span class="eb-sts ck">' + c.done + '/' + c.bookings + ' ใบ</span>' : '<span class="eb-sts wt">ยังไม่เช็คอิน</span>'));
          var lf = r.load_factor_pct;
          return '<tr><td><span class="eb-dot" style="background:' + E(r.color || '#8b909c') + '"></span><b>' + E(n.f) + '</b>' + (n.v ? ' · ' + E(n.v) : '') + '</td><td>' + E(r.departure) + '</td><td>' + st + '</td>'
            + '<td><div class="eb-cap"><span class="t"><i style="width:' + (r.booked ? r.travelled * 100 / r.booked : 0) + '%;background:var(--eb-s4)"></i><i style="width:' + (r.booked ? r.lost * 100 / r.booked : 0) + '%;background:#D9483B"></i></span><span class="n">' + num(r.travelled) + '/' + num(r.booked) + '</span></div></td>'
            + '<td>' + (r.lost ? num(r.lost) : '<span class="eb-mut">0</span>') + '</td><td>' + baht(r.revenue) + '</td><td>' + (lf == null ? '<span class="eb-mut">—</span>' : (lf < 75 ? '<span class="eb-st w">▲ ' + lf + '%</span>' : lf + '%')) + '</td></tr>'; }).join('')
        : '<tr><td colspan="7" class="eb-none">วันนี้ไม่มีทริป</td></tr>')
      + '</tbody></table><div class="eb-lgd"><i style="background:var(--eb-s4)"></i>เดินทางจริง <i style="background:#D9483B"></i>ขาด / ยกเลิกหน้างาน</div>';

    var hmx = Math.max.apply(null, [1].concat(S.hours.map(function(x){ return x.value; })));
    var hb = '<div class="eb-hb">' + S.hours.map(function(x){ return '<div title="' + String(x.hour).padStart(2, '0') + ':00 · ' + baht(x.value) + '"><i class="' + (x.hour === S.now_hour ? 'now' : '') + '" style="height:' + Math.round(x.value * 100 / hmx) + '%"></i></div>'; }).join('') + '</div><div class="eb-hax">'
      + S.hours.map(function(x){ return '<span>' + String(x.hour).padStart(2, '0') + '</span>'; }).join('') + '</div>';
    var bt = S.by_travel;

    var agL = S.top_agents, qt = S.quiet_agents;
    h += '<div class="eb-sec">Live · ทริปวันนี้ / ยอดขายที่เข้ามาวันนี้</div><div class="eb-grid eb-r5">'
      + '<div class="eb-card"><h2>ทริปวันนี้ · ' + E(thDow(t0)) + ' ' + E(thD(t0)) + ' ' + liveTag() + src('ที่มา: เช็คอินหน้าท่า · Travel Summary') + '</h2>' + trip + '</div>'
      + '<div class="eb-card"><h2>ยอดขายวันนี้ ตามชั่วโมง <span class="eb-tag">วันจอง = วันนี้</span></h2>' + hb
      + '<h2 style="margin-top:14px">ใบจองที่เข้ามาวันนี้ <span class="eb-tag">ทุกวันเดินทาง · ใหม่สุดก่อน</span></h2>' + feedHtml(S.feed, { n: 6, trav: true })
      + '<div class="eb-foot">ยอดขายวันนี้ตามวันเดินทาง: ถึงพรุ่งนี้ ' + baht(bt.to_tomorrow) + ' · ภายใน 7 วัน ' + baht(bt.within_7_days) + ' · ไกลกว่านั้น ' + baht(bt.later) + '</div></div></div>';
    h += '<div class="eb-sec">พรุ่งนี้</div>' + tomorrowCard(A.tomorrow, false);
    h += '<div class="eb-sec">ยอดขายวันนี้มาจากไหน</div><div class="eb-grid eb-r3">'
      + '<div class="eb-card"><h2>เอเย่นต์ที่ส่งยอดวันนี้ <span class="eb-tag">Top 5</span>' + src('ที่มา: Booking · Sales') + '</h2>'
      + '<table class="eb-tbl"><thead><tr><th>เอเย่นต์</th><th>ใบ</th><th>Pax</th><th>ยอดขาย</th><th>vs เฉลี่ย 7 วัน</th><th>เซลส์</th></tr></thead><tbody>'
      + (agL.length ? agL.map(function(a){ return '<tr><td><b>' + E(a.name) + '</b></td><td>' + num(a.n) + '</td><td>' + num(a.pax) + '</td><td><b>' + baht(a.value) + '</b></td><td>' + chgP(a.change_pct_vs_avg_7_days) + '</td><td>' + E(a.sales || '—') + '</td></tr>'; }).join('')
        : '<tr><td colspan="6" class="eb-none">วันนี้ยังไม่มีใบจองเข้า</td></tr>')
      + '</tbody></table><div class="eb-foot">' + (qt.length ? ('เอเย่นต์ประจำที่ยังไม่ส่งยอดวันนี้: ' + qt.map(function(q){ return '<b>' + E(q.name) + '</b> (ปกติวันละ ~' + baht(q.usual_per_day) + ')'; }).join(' · ')) : 'เอเย่นต์ประจำส่งยอดมาครบแล้ววันนี้') + '</div></div>'
      + '<div class="eb-card"><h2>ช่องทาง · โปรแกรม <span class="eb-tag">ยอดขายวันนี้</span></h2>' + chanCard(S.by_channel, 'ช่องทางขาย')
      + hbar(S.by_family.map(function(f){ return { l: f.name, v: f.value, c: f.color }; }), baht) + '</div></div>';
    return h;
  }

  /* ── เดือน / ไตรมาส / ปี ── */
  function viewPeriod(A){
    var t0 = A.today, lbl = LBL[A.period] || '', k = A.kpis, Lk = A.leakage, R = A.range;
    var h = '<div class="eb-grid eb-kpis">'
      + kpi('รายได้' + lbl + ' (วันเดินทาง)', baht(k.revenue.value), chgP(k.revenue.change_pct) + ' vs ปีก่อน · ' + num(k.revenue.pax) + ' pax')
      + kpi('คาดการณ์สิ้น' + lbl.replace('นี้', ''), baht(k.forecast.value), 'ได้แล้ว ' + baht(k.forecast.done) + ' + จองไว้ ' + baht(k.forecast.booked) + (k.forecast.complete ? ' (ครบช่วงแล้ว)' : ''), '', k.forecast.done_pct)
      + kpi('ยอดขายที่เข้ามา (วันจอง)', baht(k.sales_in.value), num(k.sales_in.bookings) + ' ใบ · ' + chgP(k.sales_in.change_pct) + ' vs ปีก่อน')
      + kpi('รายได้เฉลี่ยต่อหัว', '฿' + num(k.revenue_per_pax.value), chgP(k.revenue_per_pax.change_pct) + ' vs ปีก่อน')
      + kpi('จองล่วงหน้า 30 วัน', baht(k.next_30_days.value), num(k.next_30_days.pax) + ' pax · ' + chgP(k.next_30_days.change_pct) + ' vs ช่วงเดียวกันปีก่อน')
      + kpi('ยกเลิก' + lbl + ' (วันที่ยกเลิก)', k.cancellations.value ? ('<span style="color:var(--eb-bad)">' + baht(-k.cancellations.value) + '</span>') : baht(0), num(k.cancellations.bookings) + ' ใบ · ' + num(k.cancellations.pax) + ' pax · สุทธิที่เข้ามา <b>' + baht(k.cancellations.net_sales_in) + '</b>', k.cancellations.warning ? 'warn' : '')
      + '</div>';
    h += '<div class="eb-sec">Live booking · พรุ่งนี้</div>' + tomorrowCard(A.tomorrow, true);

    var T = A.trend || [], mx = Math.max.apply(null, [1].concat(T.map(function(x){ return x.value; })));
    var bars = '<div class="eb-bars">' + T.map(function(x){
      return '<i class="' + (x.future ? 'f' : (x.today ? 't' : (x.weekend ? 'w' : ''))) + '" title="' + E(thDow(x.date) + ' ' + thD(x.date)) + ' · ' + baht(x.value) + (x.future ? ' (จองไว้แล้ว)' : '') + '" style="height:' + Math.max(1, Math.round(x.value * 100 / mx)) + '%"></i>'; }).join('') + '</div>'
      + '<div class="eb-axis"><span>' + E(thD(X.addDays(t0, -29))) + '</span><span>' + E(thD(X.addDays(t0, -15))) + '</span><span>วันนี้</span><span>' + E(thD(X.addDays(t0, 14))) + '</span></div>'
      + '<div class="eb-lgd"><i style="background:var(--eb-s3)"></i>วันธรรมดา <i style="background:var(--eb-s4)"></i>เสาร์–อาทิตย์ <i class="hatch"></i>จองไว้แล้ว (ยังเพิ่มได้)</div>';
    var nat = (A.by_nationality || []).map(function(n){ return { l: n.name, v: n.rev }; });
    h += '<div class="eb-sec">แนวโน้มรายได้</div><div class="eb-grid eb-r2">'
      + '<div class="eb-card"><h2>รายได้รายวัน · 30 วันที่ผ่านมา + 14 วันข้างหน้า' + src('ที่มา: Booking') + '</h2>' + bars + '</div>'
      + '<div class="eb-card"><h2>ช่องทาง · ตลาด <span class="eb-tag">สัดส่วนรายได้' + E(lbl) + '</span></h2>' + chanCard(A.by_channel, 'ช่องทางขาย')
      + '<div style="font-size:11.5px;color:var(--eb-ink2);font-weight:600;margin-bottom:4px">สัญชาติ (รายได้)</div>' + (nat.length ? hbar(nat, baht) : '<div class="eb-none">—</div>') + '</div></div>';

    var fams = A.by_family || [], top5 = A.top_agents.rows, drop = A.top_agents.dropped || [];
    h += '<div class="eb-sec">รายได้ตามโปรแกรม · เอเย่นต์</div><div class="eb-grid eb-r3">'
      + '<div class="eb-card"><h2>โปรแกรม · ' + E(lbl) + src('ที่มา: Booking · P&amp;L รายทริป') + '</h2><table class="eb-tbl"><thead><tr><th>โปรแกรม</th><th>รายได้</th><th>สัดส่วน</th><th>vs ปีก่อน</th><th>Pax</th><th>รายได้/หัว</th></tr></thead><tbody>'
      + (fams.length ? fams.map(function(x){ return '<tr><td><span class="eb-dot" style="background:' + E(x.color || '#8b909c') + '"></span><b>' + E(x.name) + '</b></td><td><b>' + baht(x.rev) + '</b></td><td>' + x.share_pct + '%</td><td>' + chgP(x.change_pct) + '</td><td>' + num(x.pax) + '</td><td>' + (x.pax ? '฿' + num(x.rev_per_pax) : '—') + '</td></tr>'; }).join('')
        : '<tr><td colspan="6" class="eb-none">ยังไม่มีรายได้ในช่วงนี้</td></tr>')
      + '</tbody></table></div>'
      + '<div class="eb-card"><h2>เอเย่นต์ · Top 5 ตามรายได้' + src('ที่มา: Booking') + '</h2><table class="eb-tbl"><thead><tr><th>เอเย่นต์</th><th>รายได้</th><th>vs ปีก่อน</th><th>รายได้/หัว</th><th>Pax</th></tr></thead><tbody>'
      + (top5.length ? top5.map(function(a){
          return '<tr><td><b>' + E(a.name) + '</b></td><td><b>' + baht(a.rev) + '</b></td><td>' + chgP(a.change_pct) + '</td><td>' + (a.pax ? '฿' + num(a.rev_per_pax) : '—') + '</td><td>' + num(a.pax) + '</td></tr>'; }).join('')
        : '<tr><td colspan="5" class="eb-none">—</td></tr>')
      + '</tbody></table><div class="eb-foot">Top 5 = ' + A.top_agents.top5_share_pct + '% ของรายได้' + (drop.length ? (' · ยอดตกเกิน 20% vs ปีก่อน: ' + drop.map(E).join(', ')) : '') + '</div></div></div>';

    var dc = k.discounts;
    h += '<div class="eb-sec">ส่วนลด · รายได้ที่หลุดมือ</div><div class="eb-grid eb-r4h">'
      + '<div class="eb-card"><h2>ส่วนลดที่ให้ไป <span class="eb-tag">' + E(lbl) + '</span>' + src('ที่มา: Booking') + '</h2>'
      + hbar([{ l: 'FOC', v: dc.foc }, { l: 'ส่วนลด', v: dc.discount }], baht)
      + '<div class="eb-foot">รวม ' + baht(dc.total) + ' · ' + (+dc.share_of_period_pct || 0).toFixed(1) + '% ของรายได้ทั้งช่วง</div></div>'
      + '<div class="eb-card"><h2>รายได้ที่หลุดมือ <span class="eb-tag">' + E(lbl) + '</span>' + src('ที่มา: เช็คอิน · Travel Summary') + '</h2><div class="eb-rows two">'
      + '<div class="rw"><span class="lb">No-show · ' + num(Lk.no_show_pax) + ' pax</span><span class="vv">' + baht(Lk.no_show_value) + '</span></div>'
      + '<div class="rw"><span class="lb">ยกเลิกหน้างาน · ' + num(Lk.onsite_cancel_pax) + ' pax</span><span class="vv">' + baht(Lk.onsite_cancel_value) + '</span></div>'
      + '<div class="rw"><span class="lb">ยกเลิกเพราะอากาศ · ' + num(Lk.weather_pax) + ' pax</span><span class="vv">' + baht(Lk.weather_value) + '</span></div>'
      + '</div><div class="eb-foot">มูลค่าประมาณจากราคาต่อหัวของใบนั้น · รายละเอียดค่าปรับดูที่ Travel Summary</div></div>'
      + '</div>';
    return h;
  }

  O.eb.views.rev = {
    path: function(EB){ return ['/v1/exec-board/overview', { period: EB.per || 'today', pier: EB.pier || '' }]; },
    draw: function(A){ return A.period === 'today' ? viewToday(A) : viewPeriod(A); }
  };
  O.eb.tomorrowCard = tomorrowCard;
})();
