/* ══════════════════════════════════════════════════════════════════════════
   §opsCostingSheet (2026-10-18, w4-f3) · the Fact Sheet is drawn from the server's `sheet`
   ──────────────────────────────────────────────────────────────────────────
   Backend guide: operation-backend todo/w2-costing-model.md, README "The sheet and the draft calc (Q37)".
   Loads after 44-ops-costing-pl.js (which keeps the answers of POST /v1/costing/calc). Classic script.

   ctFactSheet(pl) in js/08-app.js drew the print sheet from ~440 lines of browser arithmetic (rent block, the cost table,
   per-head economics, the profit curve, VAT, on-demand, the five price levels, the contract by month and best / base /
   worst). 44-ops-costing-pl.js already made its primitives (ctProfitAt, ctCalc, ctBreakEven ...) the server's; this file
   goes the rest of the way: with the server's answer for the plan in hand, ctFactSheet is redrawn from `sheet.*` and
   does no arithmetic. The markup, the Thai texts and the class names are legacy's, copied from ctFactSheet.
   What stays the browser's: the plan's name, the itinerary rows, the stamp and the Thai labels (month names, the five
   level names, the season names) - formatting, not rules.

   Without an answer (offline, a plan not asked for yet, the server refused) legacy's function runs as before.
   ctFactPrint: when the answer is not cached yet the window is opened at once (a pop-up must open on the click), the
   answer is asked for, and the sheet is written when it arrives.

   NOT in the server's sheet (MISSING-SERVER-FIELD in docs/walk/w4-f3.md): the effective unit cost of an on-demand
   line is there (unit_cost), but the override EDITOR's per-part placeholders (ctEffLine) are not.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  function enabled(){ return !!(O.enabled && O.enabled()); }

  var e = function(s){ return window.ctE(s); };
  var B = function(v){ return window.ctB(v); };
  var N = function(v){ return window.ctN(v); };
  var SEASON = { high: 'hi', low: 'lo' };
  var SC_META = { worst: { l: 'Worst case', c: '#9f1239' }, base: { l: 'Base case', c: '#14100C' }, best: { l: 'Best case', c: '#0F6E56' } };
  var LEVEL = {
    cost_covering: { l: 'ราคาเท่าทุน',  why: function(s){ return 'ที่ ' + s.pax + ' คน · ต่ำกว่านี้ขาดทุนทันที'; } },
    penetration:   { l: 'เจาะตลาด',     why: function(s, x){ return 'ลด ' + Math.abs(x.change_pct) + '% จากราคาปัจจุบัน'; } },
    current:       { l: 'ราคาปัจจุบัน', why: function(){ return 'ที่ตั้งไว้ในแผนนี้'; } },
    target:        { l: 'ตั้งเป้า',     why: function(s, x){ return 'ขึ้น ' + x.change_pct + '%'; } },
    premium:       { l: 'พรีเมียม',     why: function(s, x){ return 'ขึ้น ' + x.change_pct + '%'; } }
  };
  var signed = function(v){ return (v < 0 ? '−' : '+') + N(Math.abs(v)); };
  var kindTh = function(k){ return k === 'mixed' ? 'ผสม' : (k === 'variable' ? 'ผันแปร' : 'คงที่'); };

  /* the sheet, drawn from the server's `sheet` (res.sheet); `pl` only supplies what the server does not hold: the name, the itinerary */
  function fromServer(pl, res){
    var S = res.sheet, K = S.key_figures, P = S.params, RN = S.rent;
    var pax = S.pax, seats = S.seats, boats = S.boats, cap = S.capacity, be = K.break_even;
    var pAd = K.price.adult, pCh = K.price.child;
    var rentOn = !!(RN && RN.total > 0);
    var baseCase = K.base_case;

    var kpi4 = function(){
      if(!baseCase)
        return '<div class="fs-k"><s>ราคาขาย</s><b>' + N(pAd) + '</b><i>เด็ก ' + N(pCh)
          + (+K.price.commission_pct > 0 ? (' · คอม ' + (+K.price.commission_pct) + '%') : ' · ไม่มีคอม') + '</i></div>';
      return '<div class="fs-k hi"><s>ทั้งสัญญา · BASE CASE</s><b class="'
        + (baseCase.profit < 0 ? 'neg' : 'pos') + '">' + (baseCase.profit < 0 ? '−' : '+')
        + N(Math.abs(baseCase.profit)) + '</b><i>' + e(baseCase.days + ' วัน · ' + N(baseCase.heads) + ' หัว') + ' · หักค่าเช่าเต็มก้อนแล้ว</i></div>';
    };
    var kpiHtml = '<div class="fs-kpi">'
      + '<div class="fs-k hi"><s>จุดคุ้มทุน</s><b>' + (be ? (be + ' คน') : 'ไม่ถึง')
        + '</b><i>' + (be ? (K.break_even_load_pct + '% ของ ' + cap + ' ที่นั่ง') : ('เต็มลำ ' + cap + ' ที่นั่งก็ยังขาดทุน')) + '</i></div>'
      + '<div class="fs-k"><s>กำไรที่คาด · ' + pax + ' คน</s><b class="' + (K.profit < 0 ? 'neg' : 'pos') + '">'
        + (K.profit < 0 ? '−' : '+') + N(Math.abs(K.profit)) + '</b><i>Margin '
        + K.margin_pct + '% ของรายได้สุทธิ</i></div>'
      + '<div class="fs-k"><s>ต้นทุนต่อทริป</s><b>' + N(K.cost.net) + '</b><i>คงที่ ' + N(K.cost.fixed)
        + ' + ผันแปร ' + N(K.cost.variable) + '</i></div>'
      + kpi4() + '</div>';

    /* parameters */
    var Pr = [['เครื่องยนต์', e(P.engines || '')], ['จำนวนลำ', boats + ' ลำ'],
      ['ความจุ/ลำ', seats + ' ที่นั่ง' + (P.boat_pinned ? '' : ' (พิมพ์เอง)')],
      ['จำนวนคนที่คาด', pax + ' คน'], ['คนไทย', P.pax_th + ' คน'],
      ['เด็ก', (+P.child_pct || 0) + '% = ' + P.children + ' คน'],
      ['ราคาผู้ใหญ่', B(P.price_adult) + ' <span class="fs-tag">รวม VAT</span>'],
      ['ราคาเด็ก', B(P.price_child)], ['คอมมิชชั่น', (+P.commission_pct || 0) + '%'],
      ['ราคาน้ำมัน', B(P.fuel_price) + '/ลิตร'], ['VAT', (+S.vat_rate || 0) + '%'],
      ['ความจุรวม', cap + ' ที่นั่ง']];
    var params = '<div class="fs-g">' + Pr.map(function(x){ return '<div><span>' + x[0] + '</span><b>' + x[1] + '</b></div>'; }).join('') + '</div>';

    /* the boat and the rent */
    var rent = '';
    var boatName = '';
    if(pl.boatId){ try{ boatName = ((typeof window.getBoat === 'function' ? window.getBoat(pl.boatId) : null) || {}).name || pl.boatId; }catch(_){ boatName = pl.boatId; } }
    if(pl.boatId){
      if(!RN){
        rent = '<div class="fs-h2">เรือที่ใช้</div><div class="fs-g">'
          + '<div><span>เรือ</span><b>' + e(boatName) + '</b></div>'
          + '<div><span>ที่นั่ง</span><b>' + seats + '</b></div>'
          + '<div><span>สถานะ</span><b>เรือของบริษัท</b></div>'
          + '<div><span>กินน้ำมันเทียบสูตรกลาง</span><b>' + S.boat_fuel_pct + '%</b></div></div>';
      } else {
        var dNd = RN.days_needed;
        rent = '<div class="fs-h2">เรือเช่า · เงื่อนไขสัญญา <em>ผูกกับลำ ใช้ร่วมทุกเส้นทางที่ลำนี้วิ่ง</em></div>'
          + '<div class="fs-g">'
          + '<div><span>เรือ</span><b>' + e(RN.name) + '</b></div>'
          + '<div><span>ที่นั่ง</span><b>' + RN.seats + '</b></div>'
          + '<div><span>ค่าเช่า/งวด</span><b>' + B(RN.total)
            + (RN.mode === 'seat' ? (' <span class="fs-tag">' + B(RN.per_seat) + '/ที่นั่ง</span>') : '') + '</b></div>'
          + '<div><span>วันในงวด</span><b>' + RN.days + ' วัน</b></div>'
          + '<div><span>วันหยุดตามตกลง</span><b>' + RN.days_off + ' วัน</b></div>'
          + '<div><span>วันที่วิ่งได้</span><b>' + RN.run_days + ' วัน</b></div>'
          + '<div><span>ค่าเช่า/วันวิ่ง</span><b>' + B(RN.per_day) + '</b></div>'
          + '<div><span>ค่าเช่า/ทริป</span><b>' + B(RN.per_trip)
            + (RN.trips_per_day > 1 ? (' <span class="fs-tag">' + RN.trips_per_day + ' รอบ/วัน</span>') : '') + '</b></div>'
          + '<div><span>ช่วงสัญญา</span><b>' + (RN.from ? e(RN.from) : '—') + ' → ' + (RN.to ? e(RN.to) : 'ไม่ระบุ') + '</b></div>'
          + '<div><span>เจ้าของเรือรับผิดชอบ</span><b>' + ((RN.owner_pays || []).map(function(x){ return x.label; }).join(' · ') || '—') + '</b></div>'
          + '<div><span>ผู้เช่าจ่ายเอง</span><b>น้ำมันเรือ</b></div>'
          + '<div><span>ค่าเช่ามี VAT</span><b>' + (RN.vat ? 'ขอคืนได้' : 'ไม่มี') + '</b></div>'
          + '<div><span>กินน้ำมันเทียบสูตรกลาง</span><b>' + S.boat_fuel_pct + '%</b></div></div>'
          + '<div class="fs-note"><b>จุดคุ้มทุนของค่าเช่า</b> · '
          + (dNd == null
              ? ('ที่ ' + pax + ' คน/ทริป วิ่งกี่วันก็ไม่คุ้ม (กำไรก่อนค่าเช่าติดลบ ' + B(Math.abs(RN.profit_before_rent)) + '/ทริป)')
              : ('ต้องวิ่ง <b>' + dNd + ' วัน/งวด</b> ที่ ' + pax + ' คน/ทริป · มีให้วิ่ง ' + RN.run_days + ' วัน'
                 + (RN.within_run_days ? (' · เหลือหายใจ ' + RN.spare_days + ' วัน · ลูกค้ารวม '
                           + (RN.heads_needed).toLocaleString() + ' หัว/งวด')
                        : ' · <b>เกินจำนวนวันที่มี</b>')))
          + '<br>P&amp;L รายทริปลงค่าเช่าตามทริปที่วิ่งจริง ไม่ใช่เต็มก้อน · '
          + 'ส่วนที่ขาดดูได้ที่ P&amp;L รายทริป → รายเดือน → Unabsorbed boat rent</div>';
      }
    }

    /* cost table */
    var ctr = '';
    (S.cost_groups || []).forEach(function(g){
      ctr += '<tr class="g"><td class="l">' + e(g.group) + '</td><td>' + kindTh(g.kind) + '</td><td>'
          +  N(g.amount) + '</td><td>' + (g.vat_amount ? N(g.vat_amount) : '—') + '</td><td>' + N(g.net) + '</td>'
          +  '<td>' + g.share_pct + '%</td></tr>';
      (g.lines || []).forEach(function(r){
        ctr += '<tr class="ln' + (r.amount ? '' : ' dim') + '"><td class="l">' + e(r.label) + '</td>'
            +  '<td>' + kindTh(r.kind) + '</td><td>' + (r.amount ? N(r.amount) : '—') + '</td>'
            +  '<td>' + (r.vat_amount ? N(r.vat_amount) : '—') + '</td><td>' + (r.net ? N(r.net) : '—') + '</td><td></td></tr>';
      });
    });
    var costTbl = '<table class="fs-t"><thead><tr><th class="l">รายการ</th><th>ชนิด</th><th>จำนวนเงิน</th>'
      + '<th>VAT ซื้อ</th><th>สุทธิ</th><th>สัดส่วน</th></tr></thead><tbody>' + ctr
      + '<tr class="sum"><td class="l">รวมต้นทุน · ที่ ' + pax + ' คน</td><td></td><td>' + N(K.cost.gross)
      + '</td><td>' + N(S.vat.input) + '</td><td>' + N(K.cost.net) + '</td><td>100%</td></tr></tbody></table>';

    /* per-head economics */
    var Z = S.economics, vs = Z.vs_break_even;
    var econ = '<div class="fs-g" style="grid-template-columns:repeat(3,1fr)">'
      + '<div><span>รายได้สุทธิ/หัว</span><b>' + N(Z.revenue_per_head) + '</b></div>'
      + '<div><span>ต้นทุนผันแปร/หัว</span><b>−' + N(Z.variable_per_head) + '</b></div>'
      + '<div><span>ส่วนเกิน/หัว</span><b>' + N(Z.margin_per_head) + '</b></div>'
      + '<div><span>ต้นทุนคงที่/ทริป</span><b>' + N(Z.fixed_per_trip) + '</b></div>'
      + '<div><span>คงที่ ÷ ส่วนเกิน</span><b>' + (Z.fixed_over_margin != null ? (Z.fixed_over_margin + ' คน') : 'ไม่คุ้ม') + '</b></div>'
      + '<div><span>จุดคุ้มทุนที่ระบบไล่จริง</span><b>' + (Z.break_even ? (Z.break_even + ' คน') : 'ไม่ถึง') + '</b></div>'
      + '<div><span>ห่างจุดคุ้มทุน</span><b>' + (vs.state === 'never' ? 'เต็มลำยังไม่คุ้ม'
          : (vs.state === 'over' ? ('เกินมา ' + vs.pax + ' คน') : ('ขาดอีก ' + vs.pax + ' คน'))) + '</b></div>'
      + '<div><span>ราคาต่ำสุดที่ไม่ขาดทุน · ที่ ' + pax + ' คน</span><b>'
          + (Z.min_price == null ? '—' : N(Z.min_price)) + '</b></div>'
      + '<div><span>ต้นทุนต่อหัว · ที่ ' + pax + ' คน</span><b>' + N(Z.cost_per_head) + '</b></div></div>'
      + '<div class="fs-note">สองช่องล่างขวาต่างกันได้ เพราะบางบรรทัดเป็น<b>ขั้นบันได</b> '
      + '(ไกด์ทุก 25 คน · เด็กเรือเพิ่มเมื่อเกิน 40) ต้นทุนจึงกระโดดเป็นช่วง ไม่ใช่เส้นตรง '
      + 'สูตรหารตรง ๆ ใช้ไม่ได้ · ระบบจึงไล่ทีละคนจาก 1 จนกำไรเป็นบวกครั้งแรก</div>';

    /* profit by head count */
    var curveRows = (S.curve || []).map(function(X){
      return '<tr class="' + (X.is_break_even ? 'be' : '') + '"><td class="l">' + X.pax + ' คน'
        + (X.is_break_even ? ' <span class="fs-tag">จุดคุ้มทุน</span>' : '')
        + (X.is_current ? ' <span class="fs-tag">ที่ตั้งไว้</span>' : '')
        + (X.is_full ? ' <span class="fs-tag">เต็มลำ</span>' : '') + '</td>'
        + '<td>' + X.load_pct + '%</td>'
        + '<td>' + N(X.revenue) + '</td><td>' + N(X.cost) + '</td>'
        + '<td>' + signed(X.profit) + '</td>'
        + '<td>' + signed(X.profit_per_head) + '</td></tr>';
    }).join('');
    var curve = '<table class="fs-t"><thead><tr><th class="l">จำนวนคน</th><th>อัตราบรรทุก</th>'
      + '<th>รายได้สุทธิ</th><th>ต้นทุนสุทธิ</th><th>กำไร/ขาดทุน</th><th>ต่อหัว</th></tr></thead>'
      + '<tbody>' + curveRows + '</tbody></table>';

    /* VAT */
    var vat = '<div class="fs-g" style="grid-template-columns:repeat(3,1fr)">'
      + '<div><span>ภาษีขาย</span><b>' + N(S.vat.output) + '</b></div>'
      + '<div><span>ภาษีซื้อที่ขอคืนได้</span><b>−' + N(S.vat.input) + '</b></div>'
      + '<div><span>ต้องนำส่ง</span><b>' + N(S.vat.payable) + '</b></div></div>';

    /* itinerary: the rows are the plan's own text; the kilometres total is the server's */
    var IA = (typeof window.ctItin === 'function') ? window.ctItin(pl) : [], itin = '';
    if(IA.length){
      itin = '<div class="fs-h2">รายละเอียดเส้นทาง</div><table class="fs-t">'
        + '<thead><tr><th class="l">เวลา</th><th class="l">กิจกรรม</th><th>กม.</th></tr></thead><tbody>'
        + IA.map(function(r){ return '<tr><td class="l">' + e(r.t || '') + '</td><td class="l">'
            + e(r.a || '') + '</td><td>' + e(r.k || '—') + '</td></tr>'; }).join('')
        + '<tr class="sum"><td class="l">รวมระยะทาง</td><td></td><td>'
        + (S.itinerary_km == null ? '—' : (S.itinerary_km.toLocaleString() + ' กม.')) + '</td></tr></tbody></table>';
    }

    /* what customers order extra */
    var od = '';
    if(S.on_demand){
      var odRows = S.on_demand.lines.map(function(l){
        var u1 = l.per === 'head' ? 'คน' : 'ลำ';
        return '<tr class="' + (l.off ? 'dim' : '') + '"><td class="l">' + e(l.label)
          + (l.off ? ' <span class="fs-tag">ปิดอยู่</span>' : '') + '</td>'
          + '<td>' + N(l.unit_cost) + '/' + u1 + '</td><td>' + l.expected_qty + ' ' + u1 + '</td>'
          + '<td>' + N(l.agent_rev) + '</td><td>' + N(l.upsell_rev) + '</td></tr>';
      }).join('');
      od = '<div class="fs-h2">ของที่ลูกค้าสั่งเพิ่ม <em>คิดตามที่สั่งจริง ไม่ใช่ทุกหัวบนเรือ</em></div>'
        + '<table class="fs-t"><thead><tr><th class="l">รายการ</th><th>ทุน/หน่วย</th><th>คาดว่าสั่ง</th>'
        + '<th>บริษัทได้ · เอเจนต์</th><th>บริษัทได้ · ขายเพิ่ม</th></tr></thead><tbody>' + odRows
        + '<tr class="sum"><td class="l">รายได้ส่วนนี้ที่รวมอยู่ในกำไรข้างบนแล้ว</td><td></td><td></td>'
        + '<td colspan="2">' + N(S.on_demand.kept_revenue) + '</td></tr></tbody></table>';
    }

    /* the five price levels */
    var tierRows = (S.price_levels || []).map(function(x){
      var lv = LEVEL[x.key] || { l: x.key, why: function(){ return ''; } };
      return '<tr class="' + (x.below_cost ? 'dim' : (x.is_current ? 'be' : '')) + '">'
        + '<td class="l">' + e(lv.l) + (x.is_current ? ' <span class="fs-tag">ตอนนี้</span>' : '')
          + '<div style="font-size:9.5px;color:#a39c93">' + e(lv.why(S, x)) + '</div></td>'
        + '<td>' + N(x.price_adult) + '</td><td>' + N(x.price_child) + '</td>'
        + '<td>' + (x.break_even ? (x.break_even + ' คน') : 'ไม่ถึง') + '</td>'
        + '<td>' + signed(x.profit) + '</td>'
        + '<td>' + x.margin_pct + '%</td>'
        + '<td>' + (rentOn ? (x.rent_days_needed == null ? 'ไม่คุ้ม' : (x.rent_days_needed + ' วัน')) : '—') + '</td></tr>';
    }).join('');
    var tier = '<div class="fs-h2">ราคา 5 ระดับ <em>ที่ ' + pax + ' คน/ทริป · ราคาเด็กขยับตามสัดส่วนเดิม</em></div>'
      + '<table class="fs-t"><thead><tr><th class="l">ระดับ</th><th>ผู้ใหญ่</th><th>เด็ก</th>'
      + '<th>จุดคุ้มทุน</th><th>กำไร/ทริป</th><th>Margin</th>'
      + '<th>' + (rentOn ? 'ต้องวิ่ง/งวด' : '—') + '</th></tr></thead><tbody>' + tierRows
      + '</tbody></table>'
      + '<div class="fs-note">แถวที่<b>ซีด</b>คือราคาที่ต่ำกว่าจุดเท่าทุนที่ ' + pax + ' คน · '
      + 'รับได้เฉพาะตอนที่มั่นใจว่าจะได้คนมากกว่านี้'
      + (rentOn ? ' · ช่องขวาสุดคือจำนวนวันที่ต้องวิ่งในหนึ่งงวดเพื่อคืนค่าเช่าทั้งก้อน' : '')
      + '</div>';

    /* the contract: by month, and best / base / worst */
    var longMon = '', longSc = '', C = S.contract;
    if(C && C.state === 'dated'){
      var T0 = C.total;
      var monRows = C.rows.map(function(m){
        var sea = SEASON[m.season];
        return '<tr class="' + (m.within_run_days ? '' : 'dim') + '"><td class="l">' + e(window.ctMonLabel(m.month))
          + ' <span class="fs-tag' + (sea === 'lo' ? ' lo' : ' hi') + '">' + window.CT_SEASON_TXT[sea] + '</span>'
          + (m.partial ? ' <span class="fs-tag">' + m.cal_days + '/' + m.month_days + ' วัน</span>' : '') + '</td>'
          + '<td>' + m.run_days + '</td><td>' + N(m.rent_due) + '</td>'
          + '<td>' + (m.days_needed == null ? 'ไม่คุ้ม' : (m.days_needed + ' วัน')) + '</td>'
          + '<td>' + (m.heads_needed == null ? '—' : N(m.heads_needed)) + '</td>'
          + '<td>' + (m.days_needed == null ? '—' : (m.within_run_days ? ('เหลือ ' + m.spare_days + ' วัน') : ('เกิน ' + m.over_days + ' วัน'))) + '</td></tr>';
      }).join('');
      var monTbl = '<table class="fs-t"><thead><tr><th class="l">เดือน</th><th>วันที่วิ่งได้</th>'
        + '<th>ค่าเช่าที่ต้องจ่าย</th><th>ต้องวิ่ง</th><th>ต้องหาลูกค้า</th><th>เหลือ/เกิน</th></tr></thead>'
        + '<tbody>' + monRows
        + '<tr class="sum"><td class="l">รวมทั้งสัญญา · ' + C.months_in_contract + ' เดือน (' + T0.cal_days + ' วัน)</td>'
        + '<td>' + T0.run_days + '</td><td>' + N(T0.rent_due) + '</td>'
        + '<td>' + (T0.days_needed == null ? 'ไม่คุ้ม' : (T0.days_needed + ' วัน')) + '</td>'
        + '<td>' + (T0.heads_needed == null ? '—' : N(T0.heads_needed)) + '</td>'
        + '<td>' + (T0.days_needed == null ? '—' : (T0.within_run_days ? ('เหลือ ' + T0.spare_days + ' วัน') : ('เกิน ' + T0.over_days + ' วัน'))) + '</td></tr>'
        + '</tbody></table>';

      var cfgTxt = function(s){
        return (s.load_factor != null ? (Math.round(s.load_factor * 100) + '% ของความจุ')
              : ((s.pax_multiplier != null && s.pax_multiplier !== 1) ? (Math.round(s.pax_multiplier * 100) + '% ของคนตามแผน') : 'คนตามแผน'))
          + ' · วิ่ง ' + Math.round(s.run_share * 100) + '%';
      };
      var scRows = C.scenarios.map(function(x){
        var meta = SC_META[x.key] || { l: x.key, c: '#14100C' }, sub = '';
        x.seasons.forEach(function(s){
          var k = SEASON[s.season];
          sub += '<tr class="' + (k === 'lo' ? 'dim' : '') + '">'
            + (k === 'hi' ? ('<td class="l" rowspan="3"><b style="color:' + meta.c + '">' + meta.l + '</b></td>') : '')
            + '<td class="l">' + window.CT_SEASON_TXT[k] + ' <span class="fs-tag">' + s.months + ' เดือน</span>'
            + '<div style="font-size:9.5px;color:#a39c93">' + cfgTxt(s) + '</div></td>'
            + '<td>' + s.pax_per_trip + ' คน</td><td>' + s.run_days + ' วัน</td><td>' + N(s.heads) + '</td>'
            + '<td>' + signed(s.profit_before_rent) + '</td>'
            + '<td>−' + N(s.rent) + '</td>'
            + '<td><b style="color:' + (s.net < 0 ? '#9f1239' : '#0F6E56') + '">' + signed(s.net) + '</b></td></tr>';
        });
        var t = x.total;
        sub += '<tr class="be"><td class="l">ทั้งปี</td><td></td><td>' + t.run_days + ' วัน</td>'
          + '<td>' + N(t.heads) + '</td>'
          + '<td>' + signed(t.profit_before_rent) + '</td>'
          + '<td>−' + N(t.rent) + '</td>'
          + '<td><b style="color:' + (t.net < 0 ? '#9f1239' : '#0F6E56') + '">' + signed(t.net) + '</b></td></tr>';
        return sub;
      }).join('');
      var scTbl = '<table class="fs-t"><thead><tr><th class="l">ฉาก</th><th class="l">ฤดู · สมมติฐาน</th>'
        + '<th>คน/ทริป</th><th>วันวิ่ง</th><th>ลูกค้า</th><th>กำไรก่อนค่าเช่า</th><th>ค่าเช่า</th>'
        + '<th>สุทธิ</th></tr></thead><tbody>' + scRows + '</tbody></table>'
        + '<div class="fs-note"><b>โลว์ซีซั่นคือเดือนที่ต้องเมเนจ</b> · ค่าเช่าเดินเท่ากันทุกเดือน '
        + 'แต่คนไม่ได้มาเท่ากัน · ' + C.season_months.low + ' เดือนโลว์กินค่าเช่าไป ' + B(C.low_season_rent)
        + ' ซึ่งต้องเอากำไรจาก ' + C.season_months.high + ' เดือนไฮมาโปะ<br>'
        + 'ทางลดแรงกระแทก · ต่อสัญญาให้จบก่อนเข้าโลว์ · ขอหยุดเพิ่มช่วงโลว์ · '
        + 'หาเช่าเฉพาะไฮซีซั่น · หรือย้ายลำไปเส้นทางที่ยังวิ่งได้ช่วงมรสุม</div>';

      longMon = '<div class="fs-h2">ต้องหาลูกค้าเดือนละเท่าไหร่ <em>ที่ ' + pax
        + ' คน/ทริป · ' + e(C.from) + ' → ' + e(C.to) + '</em></div>' + monTbl
        + '<div class="fs-note"><b>ค่าเช่าคิดเป็นรายวัน</b> · ' + B(RN.total) + ' ÷ ' + RN.days + ' วัน = '
        + B(C.per_calendar_day) + '/วันตามปฏิทิน · เดือน 31 วันจึงเป็น ' + B(C.per_calendar_day * 31)
        + ' และเดือน 28 วันเป็น ' + B(C.per_calendar_day * 28)
        + ' — ถ้าสัญญาเขียนว่า "เดือนละ ' + B(RN.total) + '" เท่ากันทุกเดือนไม่ว่าเดือนสั้นเดือนยาว '
        + 'ยอดรวมทั้งสัญญาจะเป็น ' + B(RN.total * C.months_in_contract) + ' ไม่ใช่ ' + B(T0.rent_due) + '<br>'
        + 'เดือนที่<b>ซีด</b>คือเดือนที่ต้องวิ่งเกินจำนวนวันที่มี = ที่ราคาและจำนวนคนชุดนี้ '
        + 'เดือนนั้นไม่มีทางคืนค่าเช่าได้ ต้องขึ้นราคา เพิ่มคนต่อรอบ หรือเพิ่มรอบต่อวัน<br>'
        + 'เดือนที่มีป้าย <b>x/y วัน</b> คือเดือนที่สัญญาไม่ได้กินทั้งเดือน ค่าเช่าคิดตามวันที่ครอบคลุมจริง</div>';
      longSc = '<div class="fs-h2">Best / Base / Worst case <em>ทั้งสัญญา ' + C.months_in_contract
        + ' เดือน · ' + e(C.from) + ' → ' + e(C.to) + '</em></div>' + scTbl
        + '<div class="fs-note">สามฉากนี้เป็น<b>สมมติฐาน</b>ที่เขียนกำกับไว้ในตาราง ไม่ใช่ตัวเลขที่ระบบรู้ '
        + 'ระบบไม่รู้ว่าเดือนไหนไฮซีซั่น · ถ้าไม่เห็นด้วยกับฉากไหน ให้เถียงที่สมมติฐานในช่องซ้าย<br>'
        + 'ค่าเช่าหักเต็มก้อนทุกฉาก เพราะจ่ายเท่ากันไม่ว่าเรือจะวิ่งหรือไม่ — นั่นคือประเด็นทั้งหมดของการเช่า</div>';
    } else if(rentOn){
      longSc = '<div class="fs-h2">ทั้งสัญญา</div><div class="fs-note">'
        + 'ยังไม่ได้ใส่<b>ช่วงสัญญา</b> (วันเริ่ม–วันจบ) ในหน้าแผนคำนวณ · '
        + 'ใส่แล้วใบนี้จะมีตารางรายเดือนว่าต้องหาลูกค้าเดือนละกี่หัว และฉาก Best/Base/Worst ทั้งสัญญาให้</div>';
    }

    var now = new Date();
    var stamp = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-'
              + String(now.getDate()).padStart(2, '0') + ' '
              + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    var who = ''; try{ who = (typeof window.ckMe === 'function') ? String(window.ckMe() || '') : ''; }catch(_){}
    if(who === '-' || who === '—') who = '';

    return '<div class="fs">'
      + '<div class="fs-hd"><div><h1>' + e(pl.name || 'แผนคำนวณ') + '</h1>'
        + '<div class="sub">' + (S.route_name ? ('เส้นทาง ' + e(S.route_name) + ' · ') : 'ยังไม่ผูกเส้นทาง · ')
        + e(P.engines || '') + ' · ' + boats + ' ลำ · ' + seats + ' ที่นั่ง/ลำ'
        + (RN ? ' · เรือเช่า ' + e(RN.name) : (pl.boatId ? ' · ' + e(boatName) : ''))
        + '</div></div>'
        + '<div class="co">LOVE ANDAMAN<u>ต้นทุน &amp; จุดคุ้มทุน · Fact Sheet<br>ออกเมื่อ ' + e(stamp)
        + (who ? (' · ' + e(who)) : '') + '</u></div></div>'
      + kpiHtml
      + '<div class="fs-band"><i>1</i><b>ตัดสินใจ</b><s>'
        + (longSc ? 'เช่าคุ้มไหม · ตั้งราคาเท่าไหร่' : 'ตั้งราคาเท่าไหร่') + '</s></div>'
      + longSc + tier
      + '<div class="fs-band"><i>2</i><b>วางแผน</b><s>'
        + (longMon ? 'ต้องหาลูกค้าเท่าไหร่ · ได้กี่คนถึงเริ่มกำไร' : 'ได้กี่คนถึงเริ่มกำไร') + '</s></div>'
      + longMon
      + '<div class="fs-h2">กำไรตามจำนวนคน</div>' + curve
      + '<div class="fs-h2">ต่อหัว &amp; ที่มาของจุดคุ้มทุน</div>' + econ
      + '<div class="fs-band ref"><i>3</i><b>ที่มาของตัวเลข</b><s>ไว้ตรวจย้อน · คำนวณซ้ำเองได้ทุกช่อง</s></div>'
      + rent
      + '<div class="fs-h2">ต้นทุนต่อทริป <em>ที่ ' + pax + ' คน · สุทธิคือหลังหัก VAT ซื้อที่ขอคืนได้แล้ว</em></div>' + costTbl
      + od
      + '<div class="fs-h2">VAT ต่อทริป</div>' + vat
      + '<div class="fs-h2">พารามิเตอร์ที่ใช้คำนวณ</div>' + params
      + itin
      + '<div class="fs-foot"><span>ตัวเลขคิดสดจากสูตรกลาง ณ เวลาที่พิมพ์ · '
        + 'สูตรกลางแก้เมื่อไหร่ ใบนี้จะไม่ตรงกับหน้าจออีก</span>'
        + '<span>' + e(stamp) + '</span></div></div>';
  }

  /* ── ctFactSheet: the server's sheet when it has answered for this plan, legacy's own drawing before that ── */
  var CP = window.laOps.costingPL;
  var origSheet = window.ctFactSheet;
  if(typeof origSheet === 'function' && !origSheet.__opsSheet && CP && typeof CP.answer === 'function'){
    var w = function(pl){
      if(!enabled()) return origSheet.apply(this, arguments);
      var res = null;
      try{ res = CP.answer(pl); }catch(_){}
      if(res && res.sheet && res.sheet.pax != null){
        try{ return fromServer(pl, res); }catch(err){ try{ console.warn('[ops] fact sheet: redraw from the server failed, legacy drawing used · ' + ((err && err.message) || err)); }catch(_){} }
      }
      return origSheet.apply(this, arguments);
    };
    w.__opsSheet = true; w.__orig = origSheet; window.ctFactSheet = w;
  }

  /* ── ctFactPrint: ask first when the answer is not here (the window is opened on the click) ── */
  var origPrint = window.ctFactPrint;
  if(typeof origPrint === 'function' && !origPrint.__opsSheet && CP && typeof CP.askNow === 'function'){
    var wp = function(){
      if(!enabled()) return origPrint.apply(this, arguments);
      var pl = null;
      try{ pl = window.ctPlan(window._ct.pid); }catch(_){}
      if(!pl || CP.answer(pl)) return origPrint.apply(this, arguments);
      var w0 = window.open('', '_blank');
      if(!w0) return origPrint.apply(this, arguments);       // legacy shows its own pop-up alert
      var self = this, args = arguments, realOpen = window.open;
      CP.askNow(pl).then(function(){
        window.open = function(){ window.open = realOpen; return w0; };
        try{ origPrint.apply(self, args); } finally { window.open = realOpen; }
      });
    };
    wp.__opsSheet = true; wp.__orig = origPrint; window.ctFactPrint = wp;
  }

  /* ── ctPlanSet: the plan tab's pax / paxTH are clamped while typing, as the column header's ctPlanSetOn does ──
     The server keeps pax >= 1 and pax_th <= pax on every write (planRules); the screen shows the same number at once
     instead of leaving the typed one until the answer. Other fields, and non-ops mode, are legacy's. */
  var origSet = window.ctPlanSet;
  if(typeof origSet === 'function' && !origSet.__opsClamp && typeof window.ctPlanSetOn === 'function'){
    var ws = function(k, v){
      if(enabled() && (k === 'pax' || k === 'paxTH') && window._ct && window._ct.pid) return window.ctPlanSetOn(window._ct.pid, k, v);
      return origSet.apply(this, arguments);
    };
    ws.__opsClamp = true; ws.__orig = origSet; window.ctPlanSet = ws;
  }

  window.laOps.costingSheet = { fromServer: fromServer };
})();
