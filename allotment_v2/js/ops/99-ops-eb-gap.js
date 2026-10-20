/* ════════════════════════════════════════════════════════════════════════
   §opsEbGap (2026-10-20) · FE-3d · Executive Board · Gap to Target tab and the allocation window on the server's answers
   gap    GET /v1/exec-board/gap?range=h14|month|next&pier=   (cells[], decisions[] with the server's suggestion, sales[], open_days)
          + GET /v1/exec-board/overview?period=today          (only for the "lead time" card: lead_by_market)
   alloc  GET /v1/exec-board/alloc/{month}?pier=              (shares, calc, seats, families, sales, lf, lf_default)
          PUT /v1/exec-board/alloc/{month} {shares, lf}       (the server writes only the rows that changed)
          DELETE /v1/exec-board/alloc/{month}                 (back to the computed shares)
   Ports legacy viewGap / gapCellHtml / leadCompact and the allocation window (ebAllocEdit, ebAllocMonth, ebAllocTot, ebAllocFill,
   ebAllocReset, ebAllocSave). The blob key exec_alloc is no longer read or written. EB.allocEdit / EB.draft keep their meaning
   (§execAllocDraft: no redraw while a field is being typed in). Classic script · after 99-ops-exec-board.js.
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O || !O.eb) return;
  var X = O.eb, E = X.E, num = X.num, baht = X.baht, pct = X.pct, thD = X.thD, thDow = X.thDow, toast = X.toast;
  var L0 = { ebAllocEdit: window.ebAllocEdit, ebAllocMonth: window.ebAllocMonth, ebAllocTot: window.ebAllocTot, ebAllocFill: window.ebAllocFill,
             ebAllocReset: window.ebAllocReset, ebAllocSave: window.ebAllocSave };
  var DOW_S = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'], LF_DEF = 0.90;
  var CALL_CLS = { quiet: 'q', short_family: 'o', lock_unused: 'l' };
  var SRC_TXT = { last_year_same_month: 'เดือนเดียวกันปีก่อน', last_90_days: '90 วันล่าสุด' };

  function famNameOf(f){ var x = (typeof _BKV2_FAMILIES !== 'undefined') ? _BKV2_FAMILIES.filter(function(y){ return y.id === f; })[0] : null; return (x && x.name) || f; }
  function shareSrc(S){
    if(S.manual) return 'กำหนดโดย ' + (S.set_by || 'ผู้บริหาร') + ' · ' + (S.set_at ? thD(String(S.set_at).slice(0, 10)) : '');
    return SRC_TXT[S.source] || '';
  }
  function stChip(st, txt){ return '<span class="eb-st ' + st.code + '">' + txt + '</span>'; }

  function gapCellHtml(c, F, d){
    if(!c) return '<div class="eg-c off">—</div>';
    var cls = c.worst === 'full' || c.worst === 'g' ? 'g' : (c.worst === 'y' ? 'w' : 'b'); if(c.below_break_even) cls = 'b';
    var tip = F.name + ' · ' + thDow(d) + ' ' + thD(d) + '\n' + c.trips + ' เที่ยว · จอง ' + c.booked + '/' + c.capacity + ' · ว่าง ' + c.free + (c.locked ? ' · ล็อก ' + c.locked : '') + '\nเป้า ' + c.target + ' · ควรจองแล้ว ' + Math.round(c.expected) + ' · คาดสุดท้าย ' + Math.round(c.projected)
      + c.routes.map(function(s){ return '\n  ' + X.variantOf(s.name, F.name) + ' ' + s.booked + '/' + s.capacity + (s.break_even ? ' · คุ้มทุน ' + s.break_even : ''); }).join('') + (c.in_today ? '\nเข้ามาวันนี้ +' + c.in_today : '') + '\nกดเพื่อเปิด By trip';
    return '<button class="eg-c ' + cls + '" title="' + E(tip) + '" onclick="ebGoTrip(\'' + E(d) + '\',\'' + E(c.routes[0].route_id) + '\')"><b>' + (c.worst === 'full' ? 'เต็ม' : num(c.free)) + '</b>' + (c.in_today ? '<i>+' + num(c.in_today) + '</i>' : '') + (c.behind && c.worst !== 'full' ? '<small>−' + num(c.behind) + '</small>' : '') + '</button>';
  }
  /* legacy leadCompact: median lead time per market, the six slowest; the rows are the overview's (top 8 markets by pax, 5+ trips) */
  function leadCompact(OV){
    if(!OV) return '<div class="eb-none">กำลังโหลด…</div>';
    var rows = (OV.lead_by_market || []).slice().sort(function(a, b){ return b.median - a.median; }).slice(0, 6);
    if(!rows.length) return '<div class="eb-none">ยังมีข้อมูลไม่พอ</div>';
    var mx = Math.max.apply(null, rows.map(function(r){ return r.median; }).concat([1]));
    return rows.map(function(r){ return '<div class="eg-ld"><span>' + E(r.name) + '</span><span class="b"><i style="width:' + Math.max(4, Math.round(r.median * 100 / mx)) + '%"></i></span><span class="n">' + r.median + ' วัน</span></div>'; }).join('')
      + '<div class="eb-foot">' + OV.lead_within7_pct + '% ของที่นั่งเข้ามาภายใน 7 วันก่อนออก · วันที่ยังแดงจึงยังมีโอกาส แต่ 7 วันสุดท้ายคือตัวตัดสิน</div>';
  }

  function viewGap(G, EB, xs){
    var T = G.totals, M = T.month, t0 = G.today, SH = G.shares, R = G.range;
    X.last.gapYm = G.month;
    var projTxt = T.projected_state === 'reaches_target' ? 'ถึงเป้า' : (T.projected_state === 'close' ? 'ใกล้เคียงเป้า' : 'ไม่ถึงเป้า');
    var head = '<div class="eb-card eg-head"><div class="eg-hl">'
      + '<div class="k">' + E(String(R.label).toUpperCase()) + ' · ' + E(thD(R.from)) + ' – ' + E(thD(R.to)) + '</div>'
      + '<div class="big">ต้องหาอีก <span class="n ' + (T.gap > 0 ? 'bad' : 'good') + '">' + num(T.gap) + '</span> ที่นั่ง</div>'
      + '<div class="s">จากเป้า ' + num(T.target) + ' (เรือที่วาง × LF เป้า) · จองแล้ว ' + num(T.booked) + ' (' + T.booked_pct + '%) · เฉลี่ย <b>' + num(T.need_per_day) + ' ที่/วัน</b> ตลอด ' + T.days_left + ' วัน</div>'
      + '<div class="bar"><div class="t"><i style="width:' + Math.min(100, T.booked_pct) + '%"></i><s style="left:' + Math.min(100, T.should_pct) + '%"></s></div><span>ควรถึง ' + T.should_pct + '% ณ วันนี้ตามเส้นโค้งปกติ</span></div>'
      + '<div class="c ' + (T.behind_pct > 10 ? 'bad' : (T.behind_pct > 0 ? 'warn' : 'good')) + '">' + (T.behind_pct > 0 ? 'ตามหลังเส้นโค้ง ' + T.behind_pct + '%' : 'ตามเส้นโค้งหรือนำหน้า') + ' · 7 วันล่าสุดเข้าเฉลี่ย ' + Math.round(T.pace7) + ' ที่/วัน' + (T.gap > 0 ? ' · ถ้าคงอัตรานี้จะได้ ~' + num(T.projected) + ' ' + projTxt : '') + '</div></div>'
      + '<div class="eg-tiles">'
      + '<div><div class="l">เที่ยวที่เสี่ยงไม่เต็ม</div><div class="v ' + (T.risk_trips ? 'bad' : '') + '">' + num(T.risk_trips) + '<small> / ' + num(T.trips) + '</small></div><div class="d">ตามหลังเส้นโค้งหรือต่ำกว่าคุ้มทุน</div></div>'
      + '<div><div class="l">ต่ำกว่าคุ้มทุน (7 วัน)</div><div class="v ' + (T.below_break_even_trips ? 'warn' : '') + '">' + num(T.below_break_even_trips) + '<small> เที่ยว</small></div><div class="d">' + (T.below_break_even_trips ? 'ขาดรวม ' + num(T.below_break_even_seats_short) + ' ที่' : 'ไม่มี') + '</div></div>'
      + '<div><div class="l">ถ้าเต็มครบตามเป้า</div><div class="v">+' + baht(T.value_if_full) + '</div><div class="d">ช่องว่าง × รายได้/หัว ฿' + num(G.rpp) + '</div></div>'
      + '<div><div class="l">เข้ามาวันนี้ (' + E(R.label) + ')</div><div class="v good">+' + num(T.in_today) + '</div><div class="d">เป้า ' + num(T.need_per_day) + '/วัน · ' + (T.days_left && T.in_today >= T.gap / T.days_left ? 'วันนี้ถึงเป้า' : 'ยังไม่ถึงเป้าวัน') + '</div></div>'
      + '</div></div>';

    var cells = {}; G.cells.forEach(function(c){ cells[c.family_id + '|' + c.date] = c; });
    var n = G.days.length, grid = '<div class="eb-card"><h2>เส้นทาง × วัน <span class="eb-tag">ตัวเลข = ที่ว่าง · สี = เทียบเส้นโค้งปกติ · มุมขวา = เข้ามาวันนี้ · กดช่องไป By trip</span>'
      + '<span class="eg-lg"><span><i style="background:#D1FAE5"></i>เต็ม / ตามแผน</span><span><i style="background:#FEF3C7"></i>ตามทัน</span><span><i style="background:#FEE2E2"></i>ตามหลัง / ต่ำกว่าคุ้มทุน</span><span><i style="background:#F3F4F6"></i>ไม่มีเรือ</span></span></h2>'
      + '<div class="eg-grid' + (n > 16 ? ' dense' : '') + '" style="grid-template-columns:minmax(120px,170px) repeat(' + n + ',minmax(0,1fr)) 86px">'
      + '<div></div>' + G.days.map(function(d){ var w = X.dt(d.date).getDay(); return '<div class="eg-dh' + (w === 0 || w === 6 ? ' we' : '') + (d.date === t0 ? ' td' : '') + '">' + DOW_S[w] + ' ' + X.dt(d.date).getDate() + '</div>'; }).join('') + '<div class="eg-dh r">รวม</div>'
      + (G.families.length ? G.families.map(function(F){ var tF = 0, tB = 0, tFree = 0;
          var cs = G.days.map(function(d){ var c = cells[F.id + '|' + d.date]; if(c){ tF += c.target; tB += c.booked; tFree += c.free; } return gapCellHtml(c, F, d.date); }).join('');
          return '<div class="eg-rn"><b>' + E(F.name) + '</b><small>' + F.trips_per_day + ' รอบ/วัน</small></div>' + cs + '<div class="eg-tot"><b>' + num(tFree) + '</b><small>ว่าง · ขาย ' + pct(tB, tF > 0 ? tF / LF_DEF : 0) + '%</small></div>'; }).join('')
        : '<div class="eb-none" style="grid-column:1/-1">ยังไม่ได้วางเรือในช่วงนี้</div>')
      + '</div></div>';

    var sl = G.sales, expand = EB.gx;
    var rows = sl.map(function(o){ var open = expand === o.sales_id;
      var h = '<div class="eg-sr' + (open ? ' open' : '') + '" data-sid="' + E(o.sales_id) + '"><button class="nm" onclick="ebSet(\'gx\',\'' + E(open ? '' : o.sales_id) + '\')" title="กดเพื่อดูรายเส้นทาง"><span class="eb-dot" style="background:' + E(o.color) + '"></span>' + E(o.name) + '<i>' + (open ? '▾' : '▸') + '</i></button>'
        + '<div class="pb"><i style="width:' + Math.min(100, o.booked_pct) + '%;background:' + E(o.color) + '"></i><s style="left:' + M.should_pct + '%"></s><b>' + num(o.booked) + ' / ' + num(o.target) + ' · ' + o.booked_pct + '%</b></div>'
        + '<div class="gp ' + (o.pace_state) + '">' + num(o.gap) + '</div>'
        + '<div class="nd">' + num(o.need_per_day_ceil) + '<small> (เฉลี่ย ' + Math.round(o.pace) + ')</small></div>'
        + '<div class="td">' + stChip(o.status, '+' + num(o.today) + ' ' + E(o.status.label)) + '</div></div>';
      if(open){
        h += '<div class="eg-sx">' + (o.families.length ? o.families.map(function(x){
            return '<div class="r' + (x.lag ? ' lag' : '') + '"><span class="f">' + E(x.name) + '<small>รับ ' + x.weight_pct + '%' + (x.lag ? ' · <b>ตามหลัง</b>' : '') + '</small></span><span class="n">' + (x.gap ? num(x.gap) : '✓') + '</span><span class="n">' + (x.gap ? num(x.need_per_day_ceil) : '—') + '</span><span class="n ' + x.status.code + '">+' + num(x.today) + '</span>'
              + '<span class="od">' + (x.open_days.length ? x.open_days.map(function(d){ return '<button onclick="ebGoTrip(\'' + E(d.date) + '\',\'' + E(d.route_id) + '\')">' + E(d.label) + ' · ว่าง ' + num(d.free) + '</button>'; }).join('') : '<small class="eb-mut">ไม่มีวันว่างในช่วงนี้</small>') + '</span></div>'; }).join('')
          : '<div class="eb-none">ยังไม่มีเป้าแยกเส้นทาง</div>')
          + '<div class="eg-sxh"><span>เส้นทาง</span><span>ขาด</span><span>ต้องได้/วัน</span><span>วันนี้</span><span>วันที่ว่างเยอะ · กดไปขาย</span></div>'
          + (o.calls.length ? '<div class="eg-calls"><span class="eb-mut">เอเยนต์ที่ควรติดต่อ:</span>' + o.calls.slice(0, 5).map(function(c){ return '<span class="' + (CALL_CLS[c.kind] || '') + '" title="' + E(c.detail) + '">' + E(c.name) + ' · ' + E(c.why) + '</span>'; }).join('') + '</div>' : '') + '</div>';
      }
      return h; }).join('');
    var salesCard = '<div class="eb-card"><h2>ช่องว่างแบ่งให้เซลส์ <span class="eb-tag">' + (SH.manual ? 'สัดส่วนที่ผู้บริหารกำหนด · ' + E(shareSrc(SH)) : 'ตามสัดส่วนที่ขายได้ต่อเส้นทาง (' + E(shareSrc(SH) || 'ยังไม่มีฐาน') + ')') + ' · กดชื่อดูรายเส้นทาง</span>'
      + (X.canAlloc() ? '<button class="eb-btn s" style="margin-left:auto" onclick="ebAllocEdit(true)">' + (SH.manual ? 'แก้สัดส่วน' : 'กำหนดสัดส่วนเอง') + '</button>' : '') + '</h2>'
      + '<div class="eg-sh"><span>เซลส์</span><span>จองแล้ว / เป้า ' + E(G.month) + '</span><span>ช่องว่าง</span><span>ต้องได้/วัน</span><span>วันนี้</span></div>'
      + (rows || '<div class="eb-none">ยังไม่มีเซลส์ที่ผูกกับใบจอง</div>')
      + '<div class="eb-foot">ขีดดำ = ควรถึงแล้ว ณ วันนี้ (' + M.should_pct + '% ของเดือน) · "วันนี้" = ที่นั่งที่คนนั้นปิดได้วันนี้สำหรับเดือนนี้ เทียบกับที่ต้องได้/วัน · เฉลี่ย = 7 วันล่าสุด</div></div>';

    var decH = '<div class="eb-card"><h2>ตัดสินใจเที่ยวนี้ <span class="eb-tag">ต่ำกว่าคุ้มทุนใน 7 วัน หรือเพซไม่ทันใน 3 วัน · เรียงตามวันออก</span></h2>'
      + (G.decisions.length ? G.decisions.slice(0, 6).map(function(s){
          var sg = s.suggestion, merge = s.options.indexOf('merge') >= 0;
          var opts = [['notify_sales', 'แจ้งเซลส์'], ['b2c_promo', 'โปร B2C'], [merge ? 'merge' : 'reduce_boats', merge && sg.merge_with ? 'รวมกับ ' + DOW_S[X.dt(sg.merge_with.date).getDay()] + ' ' + X.dt(sg.merge_with.date).getDate() : 'ลดเรือ'], ['wait', 'รอดู']];
          return '<div class="eg-dec"><div><b>' + E(s.family + (s.variant ? ' ' + s.variant : '')) + ' · ' + E(s.label) + '</b><small>จอง ' + s.booked + '/' + s.capacity + (s.break_even ? ' · ขาดคุ้มทุน ' + s.short_of_break_even : ' · เป้า ' + s.target) + ' · ออกใน ' + s.lead + ' วัน · ' + E(sg.reason) + '</small></div>'
            + '<span class="eg-opt">' + opts.map(function(x){ return '<b class="' + (x[0] === sg.action ? 'on' : '') + '">' + E(x[1]) + '</b>'; }).join('') + '<button onclick="ebGoTrip(\'' + E(s.date) + '\',\'' + E(s.route_id) + '\')">By trip →</button></span></div>'; }).join('')
          + '<div class="eb-foot">ตัวเลือกที่ไฮไลต์คือข้อเสนอของระบบจากเส้นโค้งและจุดคุ้มทุน · ปุ่มเป็นทางลัด ไม่มีอะไรเกิดขึ้นเอง</div>'
        : '<div class="eb-none">ไม่มีเที่ยวที่ต้องตัดสินใจตอนนี้</div>') + '</div>';
    var lead = '<div class="eb-card"><h2>ใครจองล่วงหน้าแค่ไหน <span class="eb-tag">lead time มัธยฐาน · 90 วัน</span></h2>' + leadCompact(xs && xs[0]) + '</div>';
    return head + grid + '<div class="eb-grid eb-r3" style="margin-top:12px">' + salesCard + '<div style="display:flex;flex-direction:column;gap:12px;min-width:0">' + decH + lead + '</div></div>';
  }

  O.eb.views.gap = {
    path: function(EB){ return ['/v1/exec-board/gap', { range: EB.gp === 'h' || !EB.gp ? 'h14' : EB.gp, pier: EB.pier || '' }]; },
    extra: function(EB){ return [['/v1/exec-board/overview', { period: 'today', pier: EB.pier || '' }]]; },
    draw: viewGap
  };

  /* ══ the allocation window ══ */
  function ymNow(){ return X.today().slice(0, 7); }
  function addMonth(ym, n){ var y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1 + n; return new Date(y, m, 1).getFullYear() + '-' + String(new Date(y, m, 1).getMonth() + 1).padStart(2, '0'); }
  function laMonFull(ym){ var M = (typeof MONTHS_TH !== 'undefined') ? MONTHS_TH : null; var y = +ym.slice(0, 4), m = +ym.slice(5, 7); return (M ? M[m - 1] : ym.slice(5, 7)) + ' ' + (y + 543); }
  function laMonShort(ym){ var M = (typeof laMonAbbrTH === 'function') ? laMonAbbrTH() : null; var y = +ym.slice(0, 4), m = +ym.slice(5, 7); return (M ? M[m - 1] : ym.slice(5, 7)) + ' ' + String(y + 543).slice(2); }
  function lfOf(A, f){ var v = A.lf && +A.lf[f]; return (v > 0 && v <= 100) ? v : A.lf_default; }
  function loadAlloc(ym){
    return O.get('/v1/exec-board/alloc/' + encodeURIComponent(ym), { pier: window._eb.pier || '' }).then(function(A){
      var ov = document.getElementById('eb-alloc-ov'); if(!window._eb.allocEdit && !ov) return A;   // closed meanwhile
      allocModal(A); return A;
    }, function(e){ window._eb.allocEdit = false; O.fail('The allocation did not load', e); return null; });
  }
  window.ebAllocEdit = function(on, ym){
    if(!O.enabled()) return L0.ebAllocEdit ? L0.ebAllocEdit.apply(this, arguments) : undefined;
    var EB = window._eb;
    if(!on){ EB.allocEdit = false; EB.draft = null; var ov = document.getElementById('eb-alloc-ov'); if(ov) ov.remove(); X.keepRender(true); return; }
    if(!X.canAlloc()){ toast('ต้องมีสิทธิ์แก้ไขส่วน Sales'); return; }
    EB.allocEdit = true; EB.allocYm = ym || EB.allocYm || X.last.gapYm || ymNow(); EB.draft = EB.draft || {};
    return loadAlloc(EB.allocYm);
  };
  window.ebAllocMonth = function(ym){
    if(!O.enabled()) return L0.ebAllocMonth ? L0.ebAllocMonth.apply(this, arguments) : undefined;
    window._eb.allocYm = ym; window._eb.draft = {}; return loadAlloc(ym);
  };
  function allocModal(A){
    var EB = window._eb, D = EB.draft || {}, ym = A.month;
    var shares = A.manual ? (A.shares || {}) : ((A.calc && A.calc.shares) || {});
    var cur = function(f, sid){ if((f + '|' + sid) in D) return D[f + '|' + sid]; var v = shares[f] && shares[f][sid]; v = Math.round(v || 0); return v || ''; };
    var calc = function(f, sid){ var c = A.calc && A.calc.shares && A.calc.shares[f]; return Math.round((c && c[sid]) || 0); };
    var curLf = function(f){ return ('lf|' + f) in D ? D['lf|' + f] : lfOf(A, f); };
    var capOf = function(f){ return (A.seats[f] && A.seats[f].capacity) || 0; }, bkOf = function(f){ return (A.seats[f] && A.seats[f].booked) || 0; };
    var old = document.getElementById('eb-alloc-ov'); var sc = old ? (old.querySelector('.ea-body') || {}).scrollTop || 0 : 0; if(old) old.remove();
    var ov = document.createElement('div'); ov.id = 'eb-alloc-ov';
    var inp = function(f, sid){ return '<input type="number" min="0" max="100" step="1" data-f="' + E(f) + '" data-s="' + E(sid) + '" value="' + E(cur(f, sid)) + '" placeholder="0" aria-label="' + E(sid + ' ' + famNameOf(f)) + '" oninput="ebAllocTot(\'' + E(f) + '\')">'; };
    var months = [ymNow(), addMonth(ymNow(), 1)], fams = A.families, sales = A.sales.map(function(s){ return { id: s.id, name: s.name, color: s.color || '#185FA5' }; });
    var calcSrc = SRC_TXT[A.calc && A.calc.source] || 'ยังไม่มีฐาน';
    var h = '<div class="ea" id="eb-alloc" role="dialog" aria-modal="true" aria-label="กำหนดสัดส่วนช่องว่างให้เซลส์">'
      + '<div class="ea-hd"><div><div class="t">กำหนดสัดส่วนช่องว่างให้เซลส์</div><div class="s">' + E(laMonFull(ym)) + ' · ช่องว่างของแต่ละเส้นทางจะถูกแบ่งเป็นเป้าของเซลส์ตามสัดส่วนนี้ · ไม่กระทบใบจองหรือราคา</div></div>'
      + '<span class="eb-seg">' + months.map(function(m){ return '<button class="' + (m === ym ? 'on' : '') + '" onclick="ebAllocMonth(\'' + m + '\')">' + E(laMonShort(m)) + '</button>'; }).join('') + '</span>'
      + '<button class="x" aria-label="ปิด" onclick="ebAllocEdit(false)">✕</button></div>'
      + '<div class="ea-src"><span>ที่มาของสัดส่วน</span><span class="eb-seg"><button class="' + (A.manual ? '' : 'on') + '" onclick="ebAllocReset(\'' + E(ym) + '\')">คำนวณให้ (' + E(calcSrc) + ')</button><button class="on-m ' + (A.manual ? 'on' : '') + '">กำหนดเอง</button></span>'
      + '<span class="eb-mut">แก้แล้วบันทึก = ใช้ค่านี้ทั้งเดือน · กด "คำนวณให้" เมื่อไหร่ก็กลับมาเป็นอัตโนมัติ</span><span class="eb-sp"></span><span class="eb-mut">' + (A.manual ? 'บันทึกล่าสุด: ' + E(shareSrc({ manual: true, set_by: A.set_by, set_at: A.set_at })) : 'ยังไม่เคยกำหนดเอง') + '</span></div>'
      + '<div class="ea-body"><div class="ea-grid" style="grid-template-columns:150px repeat(' + fams.length + ',minmax(0,1fr)) 100px">'
      + '<div class="hh">เซลส์</div>' + fams.map(function(f){ var gap = Math.max(0, Math.round(capOf(f) * (curLf(f) / 100) - bkOf(f))); return '<div class="hh f"><b>' + E(famNameOf(f)) + '</b><small>ช่องว่างเดือนนี้ <span class="eb-num" data-fgap="' + E(f) + '">' + num(gap) + '</span> ที่ · วาง ' + num(capOf(f)) + ' จอง ' + num(bkOf(f)) + '</small><label>เป้า LF <input type="number" min="1" max="100" step="1" data-lf="' + E(f) + '" value="' + E(curLf(f)) + '" oninput="ebAllocTot(\'' + E(f) + '\')">%</label></div>'; }).join('') + '<div class="hh r">เป้ารวมของคน<br>(ที่นั่ง)</div>'
      + sales.map(function(s){ return '<div class="sn"><span class="eb-dot" style="background:' + E(s.color) + '"></span>' + E(s.name) + '</div>' + fams.map(function(f){ return '<div class="cell">' + inp(f, s.id) + '<span>% · <b data-seat="' + E(f) + '|' + E(s.id) + '">0</b></span><small>(คำนวณ ' + calc(f, s.id) + ')</small></div>'; }).join('') + '<div class="rt" data-rowtot="' + E(s.id) + '">0</div>'; }).join('')
      + '<div class="sn mut"><span class="eb-dot" style="background:#9CA3AF"></span>B2C / ไม่มีเซลส์<small>อัตโนมัติ</small></div>' + fams.map(function(f){ return '<div class="cell mut">ที่เหลือ · <b data-rest="' + E(f) + '">0</b>%</div>'; }).join('') + '<div class="rt mut" data-rowtot="__none">0</div>'
      + '<div class="tt">รวมต่อเส้นทาง</div>' + fams.map(function(f){ return '<div class="tt"><b class="eb-atot" data-tot="' + E(f) + '">0%</b><span class="eb-st" data-totst="' + E(f) + '"></span></div>'; }).join('') + '<div class="tt r" data-rowtot="__all">0</div>'
      + '</div><div class="eb-foot">ตัวเลขหลัง % = เป้าที่นั่งของคนนั้นในเส้นทางนั้น (ช่องว่าง × สัดส่วน) · ใส่ไม่ครบ 100 กด "เกลี่ยให้ครบ" ระบบเติมส่วนที่เหลือตามสัดส่วนเดิม · เกิน 100 บันทึกไม่ได้</div></div>'
      + '<div class="ea-ft"><button class="eb-btn" onclick="ebAllocFill()">เกลี่ยให้ครบ 100%</button><button class="eb-btn" onclick="ebAllocReset(\'' + E(ym) + '\')">ใช้ค่าคำนวณ</button><span class="eb-mut" id="ea-dirty"></span><span class="eb-sp"></span><button class="eb-btn" onclick="ebAllocEdit(false)">ยกเลิก</button><button class="eb-btn p" onclick="ebAllocSave(\'' + E(ym) + '\')">บันทึกสัดส่วน ' + E(laMonShort(ym)) + '</button></div></div>';
    ov.innerHTML = h; document.body.appendChild(ov);
    ov.addEventListener('mousedown', function(e){ if(e.target === ov) window.ebAllocEdit(false); });
    ov._A = A; fams.forEach(function(f){ window.ebAllocTot(f, true); }); try{ var bd = ov.querySelector('.ea-body'); if(bd) bd.scrollTop = sc; }catch(_){}
  }
  window.ebAllocTot = function(f, quiet){
    if(!O.enabled()) return L0.ebAllocTot ? L0.ebAllocTot.apply(this, arguments) : undefined;
    var ov = document.getElementById('eb-alloc-ov'), box = document.getElementById('eb-alloc'); if(!box || !ov) return; var A = ov._A, EB = window._eb;
    var capOf = function(ff){ return (A.seats[ff] && A.seats[ff].capacity) || 0; }, bkOf = function(ff){ return (A.seats[ff] && A.seats[ff].booked) || 0; };
    EB.draft = EB.draft || {}; if(!quiet) box.querySelectorAll('input[data-f],input[data-lf]').forEach(function(i){ EB.draft[i.dataset.lf ? ('lf|' + i.dataset.lf) : (i.dataset.f + '|' + i.dataset.s)] = i.value; });
    var lfI = box.querySelector('input[data-lf="' + f + '"]'), lf = Math.max(1, Math.min(100, +(lfI && lfI.value) || lfOf(A, f))) / 100;
    var gap = Math.max(0, Math.round(capOf(f) * lf - bkOf(f))); var ge = box.querySelector('[data-fgap="' + f + '"]'); if(ge) ge.textContent = num(gap);
    var t = 0; box.querySelectorAll('input[data-f="' + f + '"]').forEach(function(i){ var v = Math.max(0, +i.value || 0); t += v; var se = box.querySelector('[data-seat="' + f + '|' + i.dataset.s + '"]'); if(se) se.textContent = num(Math.round(gap * v / 100)); });
    var te = box.querySelector('[data-tot="' + f + '"]'); if(te){ te.textContent = Math.round(t * 10) / 10 + '%'; te.className = 'eb-atot ' + (t > 100.5 ? 'over' : (t < 99.5 ? 'under' : 'ok')); }
    var ts = box.querySelector('[data-totst="' + f + '"]'); if(ts){ ts.textContent = t > 100.5 ? 'เกิน ' + Math.round((t - 100) * 10) / 10 : (t < 99.5 ? 'ขาด ' + Math.round((100 - t) * 10) / 10 : 'ครบ'); ts.className = 'eb-st ' + (t > 100.5 ? 'b' : (t < 99.5 ? 'w' : 'g')); }
    var re = box.querySelector('[data-rest="' + f + '"]'); if(re) re.textContent = Math.max(0, Math.round((100 - t) * 10) / 10);
    var rows = {}, all = 0; A.families.forEach(function(ff){ var lfI2 = box.querySelector('input[data-lf="' + ff + '"]'), lf2 = Math.max(1, Math.min(100, +(lfI2 && lfI2.value) || lfOf(A, ff))) / 100; var g2 = Math.max(0, Math.round(capOf(ff) * lf2 - bkOf(ff))); var tt = 0;
      box.querySelectorAll('input[data-f="' + ff + '"]').forEach(function(i){ var v = Math.max(0, +i.value || 0); tt += v; rows[i.dataset.s] = (rows[i.dataset.s] || 0) + Math.round(g2 * v / 100); }); rows.__none = (rows.__none || 0) + Math.round(g2 * Math.max(0, 100 - tt) / 100); all += g2; });
    Object.keys(rows).forEach(function(sid){ var el = box.querySelector('[data-rowtot="' + sid + '"]'); if(el) el.textContent = num(rows[sid]); }); var ae = box.querySelector('[data-rowtot="__all"]'); if(ae) ae.textContent = num(all);
    var dd = document.getElementById('ea-dirty'); if(dd && !quiet) dd.textContent = 'ยังไม่ได้บันทึก';
  };
  window.ebAllocFill = function(){
    if(!O.enabled()) return L0.ebAllocFill ? L0.ebAllocFill.apply(this, arguments) : undefined;
    var ov = document.getElementById('eb-alloc-ov'), box = document.getElementById('eb-alloc'); if(!box || !ov) return; var A = ov._A;
    A.families.forEach(function(f){ var ins = [].slice.call(box.querySelectorAll('input[data-f="' + f + '"]')), t = 0; ins.forEach(function(i){ t += Math.max(0, +i.value || 0); });
      if(t >= 99.5 && t <= 100.5) return;
      if(t > 0){ var acc = 0; ins.forEach(function(i, k){ var v = Math.max(0, +i.value || 0); if(!v){ return; } var nv = (k === ins.length - 1) ? Math.max(0, 100 - acc) : Math.round(v * 100 / t); acc += nv; i.value = nv; });
        var t2 = 0; ins.forEach(function(i){ t2 += (+i.value || 0); }); if(t2 !== 100){ for(var k = ins.length - 1; k >= 0; k--){ if(+ins[k].value > 0){ ins[k].value = Math.max(0, (+ins[k].value) + (100 - t2)); break; } } } }
      else { var sh = A.calc && A.calc.shares && A.calc.shares[f]; if(sh){ ins.forEach(function(i){ var v = Math.round(sh[i.dataset.s] || 0); i.value = v || ''; }); } }
      window.ebAllocTot(f); });
    toast('เกลี่ยให้ครบ 100% แล้ว · ยังไม่ได้บันทึก');
  };
  window.ebAllocReset = function(ym){
    if(!O.enabled()) return L0.ebAllocReset ? L0.ebAllocReset.apply(this, arguments) : undefined;
    if(!confirm('Use the computed shares for this month? The manual allocation will be removed.')) return;
    if(!X.canAlloc()){ toast('บันทึกไม่ได้ · ต้องมีสิทธิ์แก้ไขส่วน Sales'); return; }
    return O.queue(function(){ return O.del('/v1/exec-board/alloc/' + encodeURIComponent(ym)); }).then(function(){
      window._eb.draft = {}; X.forget(); O.wrote('exec-alloc'); toast('กลับไปใช้ค่าคำนวณของ ' + ym + ' แล้ว');
      if(document.getElementById('eb-alloc-ov')) loadAlloc(ym);
      X.keepRender(true);
    }, function(e){ O.fail('Allocation not reset', e); });
  };
  window.ebAllocSave = function(ym){
    if(!O.enabled()) return L0.ebAllocSave ? L0.ebAllocSave.apply(this, arguments) : undefined;
    var box = document.getElementById('eb-alloc'), ov = document.getElementById('eb-alloc-ov'); if(!box || !ov) return; var A = ov._A;
    var shares = {}, lf = {};
    box.querySelectorAll('input[data-f][data-s]').forEach(function(i){ var v = +i.value || 0; if(v > 0){ (shares[i.dataset.f] = shares[i.dataset.f] || {})[i.dataset.s] = Math.round(v * 10) / 10; } });
    /* a load factor goes only where it differs from the default or was set before: the server then writes only the changed rows */
    box.querySelectorAll('input[data-lf]').forEach(function(i){ var v = Math.round(+i.value || 0); if(v > 0 && v <= 100 && (v !== A.lf_default || (A.lf && A.lf[i.dataset.lf] != null))) lf[i.dataset.lf] = v; });
    var over = false; Object.keys(shares).forEach(function(f){ var t = 0; Object.keys(shares[f]).forEach(function(k){ t += shares[f][k]; }); if(t > 100.5) over = true; });
    if(over){ alert('Route total is over 100% - please fix before saving.'); return; }
    if(!X.canAlloc()){ toast('บันทึกไม่ได้ · ต้องมีสิทธิ์แก้ไขส่วน Sales'); return; }
    return O.queue(function(){ return O.call('PUT', '/v1/exec-board/alloc/' + encodeURIComponent(ym), { shares: shares, lf: lf }); }).then(function(){
      var EB = window._eb; EB.allocEdit = false; EB.draft = null; var o2 = document.getElementById('eb-alloc-ov'); if(o2) o2.remove();
      X.forget(); O.wrote('exec-alloc'); X.keepRender(true); toast('บันทึกสัดส่วน ' + ym + ' แล้ว');
    }, function(e){ O.fail('Allocation not saved', e); });
  };
})();
