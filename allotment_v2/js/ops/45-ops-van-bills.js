/* ══════════════════════════════════════════════════════════════════════════
   §opsVanBills · partner-van bills (วางบิลรถร่วม) ⇄ operation-backend
   ──────────────────────────────────────────────────────────────────────────
   The server works out the rows of a period, the rates, the totals, the profit/loss and the
   draft / sent / paid state. renderVanBill() is replaced by a display of that view, laid out as
   legacy's §vanBill screen (vbRenderOv / renderVanBill, styled by legacy vbCss(), printed by
   legacy vbPrint()). The browser keeps only the inputs (rate, extra, deduction, per-pax sale) and
   sends them back; no amount is added up here and nothing is written to the legacy blob
   (vbPersist is silenced).

   Display-only derivations (no money, no totals across lines): the fill pill of one owner
   (missing_rate vs trips), "booked − aboard" under a pax figure, pax ÷ trips of one line, and the
   "extra − deduction" / "van cost" formula lines of ONE server totals object. A total the overview
   does not send (vans, booked pax, rows without a rate, extra/deduction, per-code cards) is shown
   as "—" or left out; it is read the moment the server adds it under `totals`.

   GET   /v1/van-bills?month=YYYY-MM&period=1|2|3                     overview
   GET   /v1/van-bills/:partner/:month/:period[?van_id=]              one partner
   PATCH /v1/van-bills/:partner/:month/:period                        inputs (+ mark_seen)
   POST  …/pull-rates      409 no_van_rates
   POST  …/send  …/unsend  …/pay {via,ref,paid_on}  …/unpay
   GET   /operations/vans                                             van names for the overview

   Edit lock (legacy §vbFill / §vbEdit): an empty field takes a value at once; a field that has one
   is read-only until ✎ แก้ไข. Every change is saved on the server as it is made; ✓ บันทึก marks the
   rows seen (§vbSeen); ยกเลิก puts back the inputs as they were when ✎ แก้ไข was pressed.

   w5c (2026-10-18): the screens are legacy's current ones (lk-inbox 9882365, §vbx): the overview by pier (vbRenderOv2) and the owner's
   spreadsheet of one pier (vbRenderSheet), drawn from the server's pier answers (piers[] / tabs[] / idle_partners[], ?pier=). A write
   builds its body from the WHOLE bill read just before, never from the part on screen. See docs/walk/w5-c.md.

   The period/partner controls reuse the legacy vbShiftMonth / vbPick / vbMode / vbOpenSup, which
   only set _vb and call renderVanBill(). Load order: after 34-ops-vans.js, before 90-ops-boot.js.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  var cache = {};          // url -> { at, view }
  var inflight = {};
  var bills = {};          // bill address -> the latest partner view of it (what a write builds on)
  var TTL = 20000;
  var originals = {};
  var vanNames = null, vanNamesLoading = null;   // van id -> name (overview vehicle list)
  var snap = null;         // { addr, body }: the inputs when ✎ แก้ไข was pressed
  var wroteKey = '';       // the field just sent: its typed text is not put back over the answer

  function enabled(){ return !!(O.enabled && O.enabled()); }
  function enc(v){ return encodeURIComponent(v == null ? '' : String(v)); }
  function n(v){ var x = Number(v); return Number.isFinite(x) ? x : 0; }
  function text(v){ return v == null ? '' : String(v); }
  function esc(v){ return text(v).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  /* legacy §vbMinus: a negative amount reads −฿150, not ฿-150 */
  function B(v){ var x = Math.round(n(v)); return (x < 0 ? '−฿' : '฿') + Math.abs(x).toLocaleString('en-US'); }
  function N(v){ return Math.round(n(v)).toLocaleString('en-US'); }
  /* legacy vbSet/vbSetRow: "-100" and "100" are the same deduction; empty clears the field */
  function amountIn(val){
    var s = text(val).replace(/[^0-9.]/g, ''); if(s === '') return null;
    var x = parseFloat(s); return Number.isFinite(x) ? Math.max(0, x) : null;
  }
  function per(){ return +_vb.per || 1; }
  function opened(){ if(!_vb.open || typeof _vb.open !== 'object') _vb.open = {}; return _vb.open; }

  function address(){ return '/v1/van-bills/' + enc(_vb.sup) + '/' + enc(_vb.ym) + '/' + enc(_vb.per); }
  function overviewKey(){ return '/v1/van-bills?month=' + enc(_vb.ym) + '&period=' + enc(_vb.per); }
  /* w5c: the pier is part of what is asked (the overview by pier, the owner's sheet of one pier), so it is part of the key */
  function viewKey(){
    if(_vb.mode === 'ov') return overviewKey() + (_vb.pier ? '&pier=' + enc(_vb.pier) : '');
    var q = [];
    if(_vb.pier) q.push('pier=' + enc(_vb.pier));
    if(_vb.van) q.push('van_id=' + enc(_vb.van));
    return address() + (q.length ? '?' + q.join('&') : '');
  }
  /* The van owners of this period, as the server's overview lists them. Not vbSuppliers(): that reads
     SB_VEHICLES, which nothing fills in ops mode, so it answers with 08-app.js's demo vehicles. */
  function partnerNames(){
    var hit = cache[overviewKey()];
    return hit ? (hit.view.partners || []).map(function(p){ return text(p.partner); }).filter(Boolean) : [];
  }
  function host(){ return document.getElementById('vanbill-host'); }
  function addrOf(v){ return '/v1/van-bills/' + enc(v.partner) + '/' + enc(v.month) + '/' + enc(v.period); }
  function put(key, view){
    cache[key] = { at: Date.now(), view: view };
    /* what a write builds on is the WHOLE bill: a pier's or a van's answer lacks the other piers' extra lines */
    if(view && view.partner && Array.isArray(view.rows) && !view.pier && !view.van_id) bills[addrOf(view)] = view;
  }
  function drop(){ cache = {}; }

  /* ── load ── */
  function load(key){
    if(inflight[key]) return inflight[key];
    var p = O.call('GET', key).then(function(v){ put(key, v); delete inflight[key]; return v; },
      function(e){ delete inflight[key]; throw e; });
    inflight[key] = p;
    return p;
  }
  function loadVanNames(){
    if(vanNames || vanNamesLoading) return;
    vanNamesLoading = O.call('GET', '/operations/vans').then(function(j){
      var m = {}, list = (j && j.vans) || (Array.isArray(j) ? j : []);
      list.forEach(function(x){ if(x && x.id) m[x.id] = text(x.name) || x.id; });
      vanNames = m; vanNamesLoading = null;
      if(_vb.mode === 'ov' && cache[overviewKey()]) draw(cache[overviewKey()].view);
    }, function(){ vanNames = {}; vanNamesLoading = null; });
  }
  function vanName(id){ return vanNames ? (vanNames[id] || id) : ''; }

  /* ── legacy display lookups (globals of 08-app.js; absent → plain text) ── */
  var CODE_COL = { PP: '#C0392B', PB: '#1C7A4E', MT: '#BA7517', SM: '#185FA5', SR: '#5B289A' };   // legacy VB_CODE colours
  function codeCol(c){ return CODE_COL[c] || '#8B96A0'; }
  function codeTh(c){ try{ return (typeof VB_CODE_TH !== 'undefined' && VB_CODE_TH[c]) || c; }catch(_){ return c; } }
  function route(id){ try{ return typeof getRoute === 'function' ? (getRoute(id) || null) : null; }catch(_){ return null; } }
  function pierBadge(id){
    var r = route(id), p = r && r.pier ? String(r.pier) : '', pc = null, th = p;
    try{ pc = typeof VB_PIER_COL !== 'undefined' ? VB_PIER_COL[p] : null; th = (typeof VB_PIER_TH !== 'undefined' && VB_PIER_TH[p]) || p; }catch(_){}
    return pc ? '<span class="vb-pier" style="background:' + pc.bg + ';color:' + pc.c + '">' + esc(th) + '</span>' : '';
  }
  function area(a){ try{ return typeof vbArea === 'function' ? text(vbArea(a)) : text(a); }catch(_){ return text(a); } }
  function far(a){ try{ return typeof vbIsFar === 'function' && !!vbIsFar(a); }catch(_){ return false; } }
  function monthTh(){
    var y = +text(_vb.ym).slice(0, 4), m = +text(_vb.ym).slice(5, 7);
    try{ return new Date(y, m - 1, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' }); }catch(_){ return _vb.ym; }
  }
  function css(){ try{ return typeof vbCss === 'function' ? vbCss() : ''; }catch(_){ return ''; } }

  /* ── shared pieces ── */
  function modeTabs(){
    return '<span class="vb-mode"><button class="' + (_vb.mode === 'ov' ? 'on' : '') + '" onclick="vbMode(\'ov\')">ภาพรวม</button>'
      + '<button class="' + (_vb.mode === 'ov' ? '' : 'on') + '" onclick="vbMode(\'one\')">รายเจ้า</button></span>';
  }
  function segs(){
    var s = function(p, l){ return '<button onclick="vbPick(\'per\',' + p + ')" class="vb-seg' + (per() === p ? ' on' : '') + '">' + l + '</button>'; };
    return '<span class="vb-segwrap">' + s(1, '1–10') + s(2, '11–20') + s(3, '21–สิ้นเดือน') + '</span>';
  }
  function monthNav(){
    return '<span class="vb-mo"><button onclick="vbShiftMonth(-1)">&lsaquo;</button><b>' + esc(monthTh()) + '</b><button onclick="vbShiftMonth(1)">&rsaquo;</button></span>';
  }
  function partnerSel(){
    var sups = partnerNames();
    if(_vb.sup && sups.indexOf(_vb.sup) < 0) sups = [_vb.sup].concat(sups);
    return '<select onchange="vbPick(\'sup\',this.value)" class="vb-sel">'
      + sups.map(function(s){ return '<option value="' + esc(s) + '"' + (s === _vb.sup ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select>';
  }
  function title(sub){
    return '<div class="vb-h1">&#128656; วางบิลรถร่วม · Van Supplier Billing</div>'
      + '<div class="vb-sub2"><span class="vb-k1">พื้นขาว = ระบบดึงให้เอง</span> &nbsp;·&nbsp; <span class="vb-k2">ช่องเส้นประฟ้า = กรอกเอง</span> &nbsp;·&nbsp; ' + sub + '</div>';
  }
  function shell(inner){ return css() + '<div class="vb" data-ops-van-bills="1">' + inner + '</div>'; }
  function plainBar(){ return '<div class="vb-bar">' + modeTabs() + (_vb.mode === 'ov' ? '' : partnerSel()) + segs() + monthNav() + '</div>'; }
  function statePill(state, quiet){
    if(state === 'paid') return '<span class="vb-pill ok" style="margin-left:4px">จ่ายแล้ว</span>';
    if(state === 'sent') return '<span class="vb-pill part" style="margin-left:4px">ส่งแล้ว</span>';
    return quiet ? '' : '<span class="vb-pill none">ร่าง</span>';
  }
  /* ══ The screens legacy draws today (lk-inbox 9882365, §vbx): the overview by pier (vbRenderOv2) and the owner's sheet of one
     pier (vbRenderSheet), drawn from the server's pier answers (todo/van-bill-pier-model.md):
       overview   GET /v1/van-bills?month&period[&pier]   piers[] · tabs[] · totals · idle_partners[]
       sheet      GET /v1/van-bills/{partner}/{month}/{period}?pier=[&van_id=]   rows · extra_lines · totals · by_code · by_pier[]
     Nothing is added up across lines here. Display-only derivations of ONE server object: "ค่ารถ" = bill − extra + deduction of a
     line the overview sends (the print summary sends it as car_cost), the page's hover formula, a bar's width. ══ */
  var PIERS = ['panwa', 'tublamu', 'ranong', 'other'];   // legacy VB_PIER_ORD
  function pierL(p){ try{ return VB_PIER_LBL[p] || p; }catch(_){ return p; } }
  function pierS(p){ try{ return VB_PIER_SH[p] || p; }catch(_){ return p; } }
  function pierA(p){ try{ return VB_PIER_AB[p] || p; }catch(_){ return p; } }
  function pierC(p){ try{ return VB_PIER_C[p] || '#5B6570'; }catch(_){ return '#5B6570'; } }
  function periodLast(){ try{ return vbPeriod().last; }catch(_){ return ''; } }
  function periodLabel(){ try{ return vbPeriod().label; }catch(_){ return ''; } }
  function ovView(){ var h = cache[overviewKey()]; return h ? h.view : null; }
  function ovTabs(){ var v = ovView(); return v ? (v.tabs || []) : []; }
  function carCost(x){ return x && x.car_cost != null ? n(x.car_cost) : n(x.bill) - n(x.ex) + n(x.cut); }   /* §w7c · the server's car_cost; the subtraction only for an answer without it */
  function shellV2(inner){ return css() + (function(){ try{ return typeof vbxCss === 'function' ? vbxCss() : ''; }catch(_){ return ''; } })() + '<div class="vbx" data-ops-van-bills="1">' + inner + '</div>'; }

  function tabHtml(t){
    var p = t.pier, all = p == null, col = all ? '#16265C' : pierC(p), on = (_vb.pier || '') === (all ? '' : p);
    return '<button class="vbx-pt' + (on ? ' on' : '') + '" style="color:' + col + '" onclick="vbSetPier(\'' + (all ? '' : p) + '\')">'
      + '<i style="background:' + col + '">' + (all ? '∑' : esc(pierA(p))) + '</i>' + (all ? 'ทั้งหมด' : esc(pierL(p))) + '<em>' + n(t.owners) + ' เจ้า · ' + B(t.bill) + '</em></button>';
  }
  function topV2(tabs, bigN, bigT, bigS, right){
    var segBtn = function(k, l){ return '<button onclick="vbPick(\'per\',' + k + ')" class="' + (per() === k ? 'on' : '') + '">' + l + '</button>'; };
    var t = (tabs || []).filter(function(x){ return _vb.mode === 'ov' || x.pier != null; }).map(tabHtml).join('');
    return '<div class="vbx-top"><div class="vbx-big"><b>' + bigN + '</b><span>' + bigT + '<i>' + bigS + '</i></span></div>'
      + '<div class="vbx-ttl"><i>LOVE ANDAMAN</i>VAN SUPPLIER BILLING</div>'
      + '<div class="vbx-acts">' + right + '</div></div>'
      + '<div class="vbx-bar"><span class="vbx-seg">'
      + '<button class="' + (_vb.mode === 'ov' ? 'on' : '') + '" onclick="vbMode(\'ov\')">ภาพรวม</button>'
      + '<button class="' + (_vb.mode === 'ov' ? '' : 'on') + '" onclick="vbMode(\'one\')">รายเจ้า</button></span>'
      + '<span class="vbx-seg">' + segBtn(1, '1–10') + segBtn(2, '11–20') + segBtn(3, '21–' + periodLast()) + '</span>'
      + '<span class="vbx-mo"><button onclick="vbShiftMonth(-1)">&lsaquo;</button><b>' + esc(monthTh()) + '</b><button onclick="vbShiftMonth(1)">&rsaquo;</button></span>'
      + '<span style="flex:1"></span>' + t + '</div>';
  }
  /* the codes of one line, as little chips with their money (legacy: the line's code map; "นอก" for the typed lines) */
  function codeChips(g){
    var out = (g.by_code || []).map(function(c){
      return '<span class="vbx-cd" style="background:' + codeCol(c.code) + '">' + esc(c.code) + '</span>' + (n(c.bill) ? ('<span class="vbx-cdv">' + N(c.bill) + '</span>') : '');
    });
    if(g.extra_totals && n(g.extra_totals.vans)) out.push('<span class="vbx-cd" style="background:#5B6570">นอก</span>' + (n(g.extra_totals.bill) ? ('<span class="vbx-cdv">' + N(g.extra_totals.bill) + '</span>') : ''));
    return out.join(' ');
  }

  /* ── overview by pier (legacy vbRenderOv2) ── */
  function overviewV2(v){
    var blocks = v.piers || [], T = v.totals || {}, pl = n(T.pl), miss = n(T.missing_rate);
    var owners = _vb.pier ? n(blocks[0] && blocks[0].totals && blocks[0].totals.owners) : n(((v.tabs || [])[0] || {}).owners);
    var kpi = '<div class="vbx-kp">'
      + '<div class="k"><i>เจ้าของรถ</i><b>' + owners + '<small>เจ้า</small></b></div>'
      + '<div class="k"><i>เที่ยว</i><b>' + n(T.trips) + '<small>คัน</small></b></div>'
      + '<div class="k"><i>ลูกค้า</i><b>' + n(T.pax) + '<small>คน · เฉลี่ย ' + n(T.avg_pax_per_trip).toFixed(2) + '</small></b></div>'
      + blocks.map(function(b){ return '<div class="k" style="border-color:' + pierC(b.pier) + '"><i style="color:' + pierC(b.pier) + '">' + esc(pierS(b.pier)) + '</i><b>' + B(b.totals.bill) + '</b></div>'; }).join('')
      + '<div class="k nv"><i>รวมเรียกเก็บ</i><b>' + B(T.bill) + '</b></div>'
      + '<div class="k ' + (pl < 0 ? 'neg' : 'pos') + '"><i>กำไร / ขาดทุน</i><b>' + B(pl) + '</b></div>'
      + '<div class="k ' + (miss ? 'todo' : 'ok') + '"><i>ยังไม่ใส่เรต</i><b>' + (miss ? (miss + '<small>แถว</small>') : '&#10003;<small>ครบ</small>') + '</b></div>'
      + '</div>';
    var blk = function(b){
      var p = b.pier, S = b.totals || {}, col = pierC(p), spl = n(S.pl);
      var body = (b.partners || []).map(function(g){
        var nv = (g.van_ids || []).length, none = n(g.trips) > 0 && n(g.missing_rate) === n(g.trips), gp = n(g.pl);
        var other = (g.also_at || []);
        var vn = (g.vans || []).map(function(x){ return x.name || x.id; });
        var pill = !n(g.missing_rate) ? '<span class="vbx-st ok">&#10003; ใส่เรตครบ</span>'
          : (none ? '<span class="vbx-st no">ยังไม่ใส่เรต · ' + n(g.trips) + ' แถว</span>'
            : '<span class="vbx-st wait"><u><s style="width:' + Math.round((n(g.trips) - n(g.missing_rate)) * 100 / n(g.trips)) + '%"></s></u>' + (n(g.trips) - n(g.missing_rate)) + '/' + n(g.trips) + ' แถว</span>');
        var M = function(x){ return none ? '<span class="vbx-mut">·</span>' : B(x); };
        return '<tr class="vbx-clk" data-sup="' + esc(g.partner) + '" onclick="vbOpenSupP(this.dataset.sup,\'' + p + '\')">'
          + '<td class="l"><div class="vbx-sup"><span class="av" style="background:' + col + '">' + esc(text(g.partner).slice(0, 6)) + '</span><span><b>' + esc(g.partner)
          + (other.length ? ('<span class="vbx-both">มีงานที่' + esc(other.map(pierS).join(',')) + 'ด้วย</span>') : '') + '</b>'
          + '<i>' + esc(vn.join(' · ')) + '</i></span></div></td>'
          + '<td>' + nv + '</td><td>' + n(g.trips) + '</td>'
          + '<td><b>' + n(g.pax) + '</b>' + ((n(g.booked_pax) > n(g.pax)) ? ('<div class="vbx-cxl">จอง ' + n(g.booked_pax) + ' · −' + (n(g.booked_pax) - n(g.pax)) + '</div>') : '') + '</td>'
          + '<td class="m">' + n(g.avg_pax_per_trip).toFixed(2) + '</td>'
          + '<td class="l">' + codeChips(g) + '</td>'
          + '<td>' + M(carCost(g)) + '</td><td class="m">' + (n(g.ex) ? ('+' + N(g.ex)) : '—') + '</td>'
          + '<td class="m">' + (n(g.cut) ? ('−' + N(g.cut)) : '—') + '</td>'
          + '<td><b>' + M(g.bill) + '</b></td><td class="m">' + M(g.sale) + '</td>'
          + '<td style="font-weight:800;color:' + (none ? '#B6BCC3' : (gp < 0 ? '#B42318' : '#0F7A4E')) + '">' + M(gp) + '</td>'
          + '<td class="l">' + pill + statePill(g.state, true) + '</td><td class="vbx-go">&rsaquo;</td></tr>';
      }).join('');
      return '<div class="vbx-pb"><div class="vbx-pbh" style="background:' + col + '"><span>' + esc(pierL(p)) + '</span>'
        + '<em>' + n(S.owners) + ' เจ้า · ' + n(S.trips) + ' เที่ยว · ' + n(S.pax) + ' คน</em><span style="flex:1"></span><em>เรียกเก็บ</em><b>' + B(S.bill) + '</b></div>'
        + '<div class="vbx-card"><table class="vbx-t"><thead><tr><th class="l">เจ้าของรถ</th><th>คัน</th><th>เที่ยว</th><th>คน</th><th>คน/คัน</th>'
        + '<th class="l">รหัส</th><th>ค่ารถ</th><th>Extra</th><th>หัก</th><th>เรียกเก็บ</th><th>ราคาขาย</th><th>กำไร/ขาดทุน</th><th class="l">เรต</th><th></th></tr></thead>'
        + '<tbody>' + body + '</tbody><tfoot><tr><td class="l">รวม' + esc(pierS(p)) + ' · ' + n(S.owners) + ' เจ้า</td><td>' + n(S.vans) + '</td><td>' + n(S.trips) + '</td><td>' + n(S.pax) + '</td>'
        + '<td>' + n(S.avg_pax_per_trip).toFixed(2) + '</td><td></td><td>' + B(carCost(S)) + '</td><td>' + B(S.ex) + '</td><td>' + (n(S.cut) ? ('−' + B(S.cut)) : '฿0') + '</td>'
        + '<td>' + B(S.bill) + '</td><td>' + B(S.sale) + '</td><td style="color:' + (spl < 0 ? '#FCA5A5' : '#86EFAC') + '">' + B(spl) + '</td>'
        + '<td class="l" colspan="2" style="color:' + (n(S.missing_rate) ? '#FCD34D' : '#86EFAC') + '">' + (n(S.missing_rate) ? ('ยังไม่ใส่เรต ' + n(S.missing_rate) + ' แถว') : 'ครบทุกเจ้า') + '</td></tr></tfoot></table></div></div>';
    };
    var idle = (v.idle_partners || []).map(function(x){ return text(x && x.partner != null ? x.partner : x); });
    return topV2(v.tabs, esc(periodLabel()), esc(monthTh()), (_vb.pier ? esc(pierL(_vb.pier)) : 'ทุกท่า') + ' · ' + owners + ' เจ้ามีงาน',
        '<button class="vbx-btn pri" onclick="vbPrint()">&#128424; พิมพ์สรุปรอบบิล' + (_vb.pier ? (' · ' + esc(pierS(_vb.pier))) : '') + '</button>')
      + kpi
      + (blocks.length ? blocks.map(blk).join('') : '<div class="vbx-card" style="padding:30px;text-align:center;color:#98A2AD;margin-top:10px">ไม่มีงานรถร่วมในรอบบิลนี้</div>')
      + (idle.length ? ('<div class="vbx-idle">อีก ' + idle.length + ' เจ้าไม่มีงานรอบนี้ · ' + esc(idle.join(' · ')) + '</div>') : '');
  }

  /* ── an owner's sheet of one pier (legacy vbRenderSheet) ── */
  function sheetV2(v, allView){
    var pier = _vb.pier || v.pier || 'panwa', col = pierC(pier), ro = v.state === 'paid', ED = !!_vb.edit && !ro, T = v.totals || {}, open = opened();
    var rows = v.rows || [], extras = v.extra_lines || [], pl = n(T.pl);
    var vans = v.vans || [];
    var vName = function(id){ var x = vans.filter(function(q){ return q.id === id; })[0]; return (x && x.name) || id; };
    var vanOf = function(id){ return vans.filter(function(q){ return q.id === id; })[0] || {}; };
    var ov = ovView(), here = ((ov && ov.piers) || []).filter(function(b){ return b.pier === pier; })[0];
    var supsHere = here ? here.partners : [];
    var mine = function(p){ return (v.by_pier || []).filter(function(x){ return x.pier === p && n(x.trips) > 0; })[0]; };
    var IN = function(fn, val, k, ri, c, neg, data){
      var has = (val || val === 0), txt = has ? ((neg ? '-' : '') + val) : '';
      var isOpen = !ro && (ED || !has || (k && open[k]));
      if(!isOpen) return '<span class="vbx-ro' + (neg ? ' neg' : '') + '" data-r="' + ri + '" data-c="' + c + '" title="มีตัวเลขแล้ว · กด แก้ไข ก่อนถึงจะเปลี่ยนได้">' + esc((neg ? '-' : '') + Math.round(+val).toLocaleString('en-US')) + '</span>';
      return '<input value="' + esc(txt) + '" onchange="' + fn + '" ' + (data || '') + ' data-vbk="' + esc(k) + '" data-r="' + ri + '" data-c="' + c + '" class="vbx-in' + (neg ? ' neg' : '') + '" inputmode="numeric">';
    };
    var dayLbl = function(ds){ try{ return new Date(ds + 'T00:00:00').toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' }); }catch(_){ return ds; } };
    var body = '', last = '', ri = 0;
    rows.forEach(function(r){
      if(r.date !== last){
        var nd = rows.filter(function(y){ return y.date === r.date; }).length;
        body += '<tr class="vbx-day"><td class="rn"></td><td colspan="14">' + esc(dayLbl(r.date)) + ' · ' + nd + ' คัน</td></tr>';
        last = r.date;
      }
      var rt = route(r.route_id), rn = (rt && rt.name) || r.route_id || '—', ov0 = r.override || {};
      var aH = (r.pickups || []).length ? r.pickups.map(function(a){ return '<span class="vbx-a' + (far(a) ? ' far' : '') + '">' + esc(area(a)) + '</span>'; }).join('') : '<span class="vbx-mut">—</span>';
      var dH = (r.drops || []).length ? r.drops.map(function(d){
          return '<span class="vbx-a' + (d.changed ? ' alt' : (far(d.name) ? ' far' : '')) + '" title="' + (d.changed ? 'ใบนี้ตั้งจุดส่งใหม่ ไม่ใช่ส่งกลับที่รับ' : 'ส่งกลับที่เดิมของกรุ๊ปนั้น') + '">' + esc(area(d.name)) + (d.changed ? ' · จุดใหม่' : '') + '</span>'; }).join('')
        : '<span class="vbx-mut">' + ((!r.return_only && !n(r.return_bookings) && !n(r.return_same_van)) ? 'จบที่ท่า' : '—') + '</span>';
      var tags = (r.return_only ? '<span class="vbx-tg ret">&#8629; ขากลับอย่างเดียว · ' + n(r.return_pax) + ' คน</span>' : '')
        + ((!r.return_only && n(r.return_bookings)) ? ('<span class="vbx-tg">&#8629; รับกลับให้อีก ' + n(r.return_bookings) + ' ใบ · ' + n(r.return_pax) + ' คน (ไม่คิดเพิ่ม)</span>') : '')
        + ((!r.return_only && n(r.return_same_van)) ? ('<span class="vbx-tg">&#8629; พาคนของตัวเองกลับ ' + n(r.return_same_van) + ' ใบ</span>') : '');
      var f = 'เรียกเก็บ = ' + N(r.rate) + ' + ' + N(r.ex) + ' − ' + N(r.cut) + ' = ' + N(r.bill) + (r.return_only ? '' : (' · ขาย = ' + n(r.pax) + ' × ' + n(r.per_pax) + ' = ' + N(r.sale)));
      var vv = vanOf(r.van_id);
      var set = function(fld){ return 'laOpsVanBills.setRow(this.getAttribute(\'data-rk\'),\'' + fld + '\',this.value)'; };
      var dk = 'data-rk="' + esc(r.key) + '"';
      var hasMoney = n(r.rate) > 0 || n(r.ex) || n(r.cut);
      body += '<tr data-f="' + esc(f) + '"' + (r['new'] ? ' data-new="1" style="background:#FFF8EC"' : '') + '><td class="rn">' + (ri + 1) + '</td>'
        + '<td class="s c">' + esc(r.date.slice(8, 10) + '/' + r.date.slice(5, 7)) + '</td>'
        + '<td class="s c"><span class="vbx-cd" style="background:' + codeCol(r.code) + '" title="' + esc(codeTh(r.code)) + '">' + esc(r.code) + '</span></td>'
        + '<td class="s w"><b>' + esc(rn) + '</b>' + tags + '</td>'
        + '<td class="s w">' + esc(vv.name || r.van_id) + (vv.plate ? ('<div class="vbx-sub">' + esc(vv.plate) + '</div>') : '') + '</td>'
        + '<td class="s w">' + aH + '</td><td class="s w">' + dH + '</td>'
        + '<td class="s n">' + (r.return_only ? ('<span class="vbx-mut">—</span><div class="vbx-sub">' + n(r.return_pax) + ' คนกลับ</div>')
            : ('<b>' + n(r.pax) + '</b><div class="vbx-sub">' + [n(r.ad) ? (n(r.ad) + ' AD') : '', n(r.chd) ? (n(r.chd) + ' CHD') : '', n(r.inf) ? (n(r.inf) + ' INF') : '', n(r.foc) ? (n(r.foc) + ' FOC') : ''].filter(Boolean).join(' · ') + '</div>'
              + ((n(r.booked_pax) > n(r.pax)) ? ('<div class="vbx-cxl">จอง ' + n(r.booked_pax) + ' · ไม่ขึ้น ' + (n(r.booked_pax) - n(r.pax)) + '</div>') : ''))) + '</td>'
        + '<td class="i n">' + IN(set('rate'), ov0.rate != null ? ov0.rate : '', r.key + '|rate', ri, 'rate', 0, dk)
          + ((ov0.rate == null && n(r.rate)) ? '<div class="vbx-sub">' + N(r.rate) + ' ตามรหัส</div>' : '') + '</td>'
        + '<td class="i n">' + IN(set('ex'), n(r.ex) || '', r.key + '|ex', ri, 'ex', 0, dk) + '</td>'
        + '<td class="i n">' + IN(set('cut'), n(r.cut) || '', r.key + '|cut', ri, 'cut', 1, dk) + '</td>'
        + '<td class="s n bill">' + (hasMoney ? N(r.bill) : '<span class="vbx-mut">ยังไม่มีเรต</span>') + '</td>'
        + '<td class="i n">' + IN(set('per'), ov0.per != null ? ov0.per : '', r.key + '|per', ri, 'per', 0, dk)
          + ((ov0.per == null && n(r.per_pax)) ? '<div class="vbx-sub">' + n(r.per_pax) + ' ทั้งรอบ</div>' : '') + '</td>'
        + '<td class="s n">' + (r.return_only ? '<span class="vbx-mut">ค่ารถอย่างเดียว</span>' : (n(r.sale) ? N(r.sale) : '<span class="vbx-mut">·</span>')) + '</td>'
        + '<td class="s n" style="font-weight:800;color:' + (n(r.pl) < 0 ? '#B42318' : '#0F7A4E') + '">' + ((n(r.sale) || n(r.bill)) ? B(r.pl).replace('฿', '') : '<span class="vbx-mut">·</span>') + '</td></tr>';
      ri++;
    });
    extras.forEach(function(x){
      var k = function(fld){ return 'x' + x.id + '|' + fld; };
      var dx = 'data-x="' + esc(x.id) + '"';
      var fn = function(fld){ return 'laOpsVanBills.setExtra(this.getAttribute(\'data-x\'),\'' + fld + '\',this.value)'; };
      var o = function(fld){ return !ro && (ED || open[k(fld)]); };
      body += '<tr class="vbx-xr" data-f="' + esc('รถนอก · เรียกเก็บ = ' + n(x.vans) + ' คัน × ' + n(x.rate) + ' + ' + n(x.ex) + ' − ' + n(x.cut) + ' = ' + n(x.bill)) + '"><td class="rn">' + (ri + 1) + '</td>'
        + '<td class="i c">' + (o('date') ? ('<input type="date" value="' + esc(x.date || '') + '" onchange="' + fn('date') + '" ' + dx + ' data-vbk="' + esc(k('date')) + '" class="vbx-in t">')
            : esc(x.date ? (x.date.slice(8, 10) + '/' + x.date.slice(5, 7)) : '—')) + '</td>'
        + '<td class="s c"><span class="vbx-cd" style="background:#5B6570">นอก</span></td>'
        + '<td class="i w" colspan="4">' + (o('note') ? ('<input value="' + esc(x.note || '') + '" onchange="' + fn('note') + '" ' + dx + ' data-vbk="' + esc(k('note')) + '" class="vbx-in t" placeholder="รถนอก · งานที่ไม่ได้ผ่านใบงาน · รายละเอียด">')
            : ('<b>' + esc(x.note || 'รถนอก') + '</b>')) + '</td>'
        + '<td class="i n"><span class="vbx-sub">คัน</span>' + IN(fn('vans'), x.vans || '', k('vans'), ri, 'van', 0, dx) + '<span class="vbx-sub">คน</span>' + IN(fn('pax'), x.pax || '', k('pax'), ri, 'pax', 0, dx) + '</td>'
        + '<td class="i n">' + IN(fn('rate'), x.rate || '', k('rate'), ri, 'rate', 0, dx) + '</td>'
        + '<td class="i n">' + IN(fn('ex'), x.ex || '', k('ex'), ri, 'ex', 0, dx) + '</td>'
        + '<td class="i n">' + IN(fn('cut'), x.cut || '', k('cut'), ri, 'cut', 1, dx) + '</td>'
        + '<td class="s n bill">' + N(x.bill) + '</td>'
        + '<td class="i n">' + IN(fn('per_pax'), x.per_pax || '', k('per_pax'), ri, 'per', 0, dx) + '</td>'
        + '<td class="s n">' + N(x.sale) + '</td>'
        + '<td class="s n">' + (ED ? ('<a onclick="laOpsVanBills.delExtra(this.getAttribute(\'data-x\'))" ' + dx + ' style="color:#B42318;cursor:pointer;font-weight:700">ลบแถว</a>') : '') + '</td></tr>';
      ri++;
    });
    var L = 'ABCDEFGHIJKLMN';
    var H = ['วันที่', 'รหัส', 'งาน', 'รถ', 'จุดรับ', 'จุดส่ง (ขากลับ)', 'คน', 'เรต/คัน', 'Extra', 'หัก', 'เรียกเก็บ', 'ขาย/คน', 'ราคาขาย', 'กำไร'];
    var MAN = { 7: 1, 8: 1, 9: 1, 11: 1 };
    var thead = '<thead><tr class="lt"><th></th>' + H.map(function(_, i){ return '<th>' + L[i] + '</th>'; }).join('') + '</tr>'
      + '<tr><th style="width:30px">#</th>' + H.map(function(h, i){ return '<th class="' + (MAN[i] ? 'man' : '') + '">' + h + '</th>'; }).join('') + '</tr></thead>';
    var foot = (ro ? '' : '<tr class="vbx-add"><td class="rn">' + (ri + 1) + '</td><td colspan="14"><a onclick="laOpsVanBills.addExtra()">+ เพิ่มแถว · รถนอก / งานที่ไม่ได้ผ่านใบงาน (' + esc(pierS(pier)) + ')</a></td></tr>')
      + '<tr class="vbx-tot"><td class="rn">&Sigma;</td><td colspan="6">รวม ' + n(T.vans) + ' เที่ยว · ' + esc(pierL(pier)) + '</td>'
      + '<td class="n">' + n(T.pax) + '<div style="font-size:9.5px;font-weight:600;opacity:.75;white-space:normal">' + n(T.ad) + ' AD · ' + n(T.chd) + ' CHD · ' + n(T.inf) + ' INF · ' + n(T.foc) + ' FOC</div></td>'
      + '<td class="n">' + N(carCost(T)) + '</td><td class="n">' + N(T.ex) + '</td>'
      + '<td class="n">' + (n(T.cut) ? ('-' + N(T.cut)) : '0') + '</td><td class="n">' + N(T.bill) + '</td>'
      + '<td></td><td class="n">' + N(T.sale) + '</td><td class="n" style="color:' + (pl < 0 ? '#FCA5A5' : '#86EFAC') + '">' + B(pl).replace('฿', '') + '</td></tr>';
    var table = '<div class="vbx-fx"><span class="ref" id="vbx-ref">—</span><span class="f">fx</span><span class="v" id="vbx-fv">คลิกช่องในตารางเพื่อดูสูตรของแถวนั้น</span>'
      + '<span class="h">Enter/↓ ลงล่าง · ↑ ขึ้น · Tab ไปขวา · Ctrl+D เติมจากแถวบน · วางช่วงจาก Excel ได้</span></div>'
      + '<div class="vbx-xlw"><table class="vbx-xl">' + thead + '<tbody>'
      + (body || '<tr><td class="rn"></td><td colspan="14" style="padding:22px;text-align:center;color:#98A2AD">ไม่มีงานของเจ้านี้ที่' + esc(pierS(pier)) + 'ในรอบบิลนี้</td></tr>')
      + foot + '</tbody></table></div>'
      + '<div class="vbx-sheets">' + PIERS.filter(function(p){ return p === pier || mine(p) || p === 'panwa' || p === 'tublamu'; }).map(function(p){
          var g = mine(p);
          return '<button class="' + (p === pier ? 'on' : '') + '" onclick="vbSetPier(\'' + p + '\')">' + esc(pierL(p)) + (g ? (' · ' + n(g.trips)) : '') + '</button>'; }).join('') + '</div>'
      + '<div class="vbx-leg"><span><i></i>ระบบดึงจากใบงานรถ (แก้ที่ใบงาน)</span><span><i class="w"></i>ช่องกรอกเอง · ว่าง = พิมพ์ได้เลย บันทึกทันที</span>'
      + '<span><i class="ro"></i>มีตัวเลขแล้ว · กด แก้ไข ก่อน</span><span><i class="sel"></i>ช่องที่เลือก</span></div>';
    var sups = partnerNames();
    var chips = '<div class="vbx-sb">' + supsHere.map(function(g){
        return '<button class="' + (g.partner === _vb.sup ? 'on' : '') + '" data-sup="' + esc(g.partner) + '" onclick="vbOpenSupP(this.dataset.sup,\'' + pier + '\')">'
          + '<span class="d" style="background:' + (!n(g.missing_rate) ? '#0F7A4E' : (n(g.missing_rate) === n(g.trips) ? '#B6BCC3' : '#C98A1B')) + '"></span>' + esc(g.partner) + '<em>' + n(g.trips) + ' · ' + B(g.bill) + '</em></button>'; }).join('')
      + '<select onchange="if(this.value)vbOpenSupP(this.value,\'' + pier + '\')" class="vbx-oth"><option value="">เจ้าอื่น…</option>'
      + sups.filter(function(s){ return !supsHere.some(function(g){ return g.partner === s; }); }).map(function(s){
          return '<option value="' + esc(s) + '"' + (s === _vb.sup ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select></div>';
    var vc = {}; ((allView && allView.rows) || rows).forEach(function(r){ vc[r.van_id] = (vc[r.van_id] || 0) + 1; });
    var allN = ((allView && allView.rows) || rows).length;
    var vchips = '<button class="' + (_vb.van ? '' : 'on') + '" onclick="vbPick(\'van\',\'\')">ทุกคัน <em>' + allN + '</em></button>'
      + vans.map(function(x){ var k = vc[x.id] || 0;
          return '<button class="' + (_vb.van === x.id ? 'on' : '') + (k ? '' : ' dim') + '" onclick="vbPick(\'van\',\'' + esc(x.id) + '\')" title="' + esc([x.plate, x.driver, x.zone_base ? ('โซน ' + x.zone_base) : ''].filter(Boolean).join(' · ')) + '">' + esc(x.name || x.id) + (k ? (' <em>' + k + '</em>') : '') + '</button>'; }).join('');
    var zones = {}; vans.forEach(function(x){ if(x.zone_base) zones[x.zone_base] = 1; });
    var miss = n(v.missing_rate);
    var stPill = !rows.length ? '' : (miss === 0 ? '<span class="vbx-st ok">&#10003; ใส่เรตครบ</span>' : '<span class="vbx-st wait">ยังไม่มีเรต ' + miss + ' แถว</span>');
    var perV = (v.per_pax_by_pier && v.per_pax_by_pier[pier] != null) ? v.per_pax_by_pier[pier] : (v.per_pax || '');
    var rateStrip = '<div class="vbx-rate"><span class="lab">ขาย / คน · ' + esc(pierS(pier)) + '</span>'
      + (function(){ var kk = '@per:' + pier, has = (perV || perV === 0), isOpen = !ro && (ED || !has || open[kk]);
          return isOpen ? ('<input value="' + esc(perV) + '" onchange="vbSetPer(this.value)" data-vbk="' + kk + '" class="vbx-in box" inputmode="numeric">') : ('<span class="vbx-ro box">' + esc(perV) + '</span>'); })()
      + '<span class="hint">ระบบคูณคนที่ขึ้นรถจริงให้ · แถวไหนคิดต่างแก้ช่อง ขาย/คน ของแถวนั้น</span><span style="flex:1"></span>'
      + '<span class="lab">เรต / คัน</span>'
      + ((v.codes || []).length ? v.codes.map(function(C){
          var kk = '@rate:' + C.code;
          var val = (v.route_rates && v.route_rates[C.code] != null && v.route_rates[C.code] !== '') ? v.route_rates[C.code] : (v.rate || '');
          var has = (val || val === 0), isOpen = !ro && (ED || !has || open[kk]);
          return '<span class="vbx-rc" title="' + esc(codeTh(C.code)) + ' · ' + n(C.rows) + ' เที่ยว"><span class="vbx-cd" style="background:' + codeCol(C.code) + '">' + esc(C.code) + '</span>'
            + (isOpen ? ('<input value="' + esc(val) + '" onchange="laOpsVanBills.setCodeRate(this.getAttribute(\'data-code\'),this.value)" data-code="' + esc(C.code) + '" data-vbk="' + kk + '" class="vbx-in box" inputmode="numeric">')
                      : ('<span class="vbx-ro box">' + esc(N(val)) + '</span>')) + '</span>'; }).join('')
         : '<span class="vbx-mut">ไม่มีงาน</span>')
      + (Object.keys(zones).length ? ('<span class="vbx-zn" title="เรตที่ดึงจาก Transfer Fleet ใช้โซนของรถเจ้านี้">โซนรถ ' + esc(Object.keys(zones).join('/')) + '</span>') : '')
      + (ro ? '' : '<button class="vbx-btn sm" onclick="laOpsVanBills.pullRates()" title="เติมเรตจากที่ตั้งไว้ในหน้า Transfer Fleet · แก้ทับได้">&#8681; ดึงจากเรตรถ</button>') + '</div>';
    var kpi = '<div class="vbx-kp">'
      + '<div class="k"><i>ลูกค้า</i><b>' + n(T.pax) + '<small>คน' + (n(T.booked_pax) > n(T.pax) ? (' · จอง ' + n(T.booked_pax)) : '') + '</small></b></div>'
      + '<div class="k"><i>เที่ยว</i><b>' + n(T.vans) + '<small>คัน</small></b></div>'
      + '<div class="k"><i>เฉลี่ย</i><b>' + n(T.avg_pax_per_van).toFixed(2) + '<small>คน/คัน</small></b></div>'
      + '<div class="k nv" style="background:' + col + ';border-color:' + col + '"><i>เรียกเก็บ · ' + esc(pierS(pier)) + '</i><b>' + B(T.bill) + '</b></div>'
      + '<div class="k"><i>ราคาขาย</i><b>' + B(T.sale) + '</b></div>'
      + '<div class="k ' + (pl < 0 ? 'neg' : 'pos') + '"><i>กำไร / ขาดทุน</i><b>' + B(pl) + '</b></div></div>';
    var cards = (v.by_code || []).map(function(g){
      return '<div class="vbx-cc"><div class="t"><span class="vbx-cd" style="background:' + codeCol(g.code) + '">' + esc(g.code) + '</span> ' + esc(codeTh(g.code)) + '</div>'
        + '<div class="b">' + B(g.bill) + '</div><div class="s">' + n(g.vans) + ' คัน · ' + n(g.pax) + ' คน</div>' + mixHtml(g) + '</div>'; }).join('');
    var xt = v.extra_totals;
    var sum = '<div class="vbx-sum">' + cards
      + (xt ? ('<div class="vbx-cc"><div class="t"><span class="vbx-cd" style="background:#5B6570">นอก</span> รถนอก</div><div class="b">' + B(xt.bill) + '</div><div class="s">' + n(xt.lines) + ' แถว</div></div>') : '')
      + '<div class="vbx-cc dark" style="background:' + col + ';border-color:' + col + '"><div class="t">เรียกเก็บ · ' + esc(_vb.sup) + ' · ' + esc(pierS(pier)) + '</div>'
      + '<div class="eq"><span>ค่ารถ ' + n(T.vans) + ' เที่ยว</span><b>' + B(carCost(T)) + '</b><span>+ Extra</span><b>' + B(T.ex) + '</b><span>− หัก</span><b>' + B(T.cut) + '</b></div>'
      + '<div class="eq t"><span>รวม</span><b>' + B(T.bill) + '</b></div>'
      + '<div class="s">' + (v.updated_by ? ('แก้ล่าสุด ' + esc(v.updated_by) + (v.updated_at ? (' · ' + esc(text(v.updated_at).slice(0, 10))) : '')) : 'ยังไม่มีใครกรอก') + '</div></div></div>';
    var acts;
    if(ED) acts = '<span class="vbx-dirty">&#9679; กำลังแก้ไข · ยังไม่บันทึก</span><button class="vbx-btn" onclick="vbCancel()">ยกเลิก</button><button class="vbx-btn ok" onclick="vbSave()">&#10003; บันทึก</button>';
    else acts = statePill(v.state)
      + (ro ? '<button class="vbx-btn" onclick="laOpsVanBills.unpay()">ยกเลิกการจ่าย</button>'
        : (v.sent ? '<button class="vbx-btn" onclick="laOpsVanBills.unsend()">ดึงกลับเป็นร่าง</button><button class="vbx-btn ok" onclick="laOpsVanBills.pay()">บันทึกว่าจ่ายแล้ว</button>'
          : '<button class="vbx-btn" onclick="laOpsVanBills.send()">ส่งให้เจ้าของรถ</button>')
          + '<button class="vbx-btn" onclick="vbEdit()">&#9998; แก้ไขช่องที่กรอกแล้ว</button>')
      + '<button class="vbx-btn" onclick="vbPrint(1)" title="มีราคาขายและกำไร · ใช้ภายใน ห้ามส่งให้เจ้าของรถ">ฉบับภายใน</button>'
      + '<button class="vbx-btn pri" onclick="vbPrint()">&#128424; พิมพ์ใบวางบิล · ' + esc(pierS(pier)) + '</button>';
    var settle = '';
    if(v.sent) settle += '<div style="font-size:11px;color:#185FA5;margin-top:3px">ส่งแล้ว ' + esc(text(v.sent.at).slice(0, 10)) + ' · ' + B(v.sent.bill)
      + (v.sent.changed_since_sent ? ' · <b style="color:#A32D2D">ยอดเปลี่ยนหลังส่ง</b>' : '') + '</div>';
    if(v.paid) settle += '<div style="font-size:11px;color:#0F6E56;margin-top:3px">จ่ายแล้ว ' + esc(v.paid.on) + ' · ' + esc(v.paid.via) + (v.paid.ref ? ' · ' + esc(v.paid.ref) : '') + ' · ' + B(v.paid.amount) + '</div>';
    var fresh = rows.filter(function(r){ return r['new']; });
    var warn = fresh.length ? ('<div class="vb-newrow">&#9888;&#65039; <b>มี ' + fresh.length + ' แถวที่เพิ่งโผล่หลังจากกรอกบิลใบนี้ไปแล้ว</b><span>('
      + esc(fresh.slice(0, 4).map(function(r){ return r.date.slice(8, 10) + '/' + (+r.date.slice(5, 7)) + ' ' + vName(r.van_id) + (r.return_only ? ' ขากลับ' : ''); }).join(' · '))
      + (fresh.length > 4 ? (' และอีก ' + (fresh.length - 4)) : '') + ')</span><span class="m">ยอดเรียกเก็บจึงต่างจากตอนที่บันทึกไว้ · ตรวจก่อนส่งให้เจ้าของรถ</span></div>') : '';
    return topV2(ovTabs(), N(T.bill), esc(_vb.sup), 'รอบ ' + esc(periodLabel()) + ' ' + esc(monthTh()) + ' · ' + esc(pierL(pier)), acts)
      + chips + warn
      + '<div class="vbx-hd" style="background:' + col + '14;border-color:' + col + '40"><span class="av" style="background:' + col + '">' + esc(text(_vb.sup).slice(0, 6)) + '</span>'
      + '<div style="flex:1;min-width:0"><div class="n">' + esc(_vb.sup) + ' <span class="vbx-pp" style="color:' + col + '">' + esc(pierL(pier)) + '</span>'
      + '<span class="by">' + (v.updated_by ? (' · แก้ล่าสุด ' + esc(v.updated_by) + (v.updated_at ? (' ' + esc(text(v.updated_at).slice(0, 10))) : '')) : '') + '</span></div>'
      + '<div class="vbx-vc">' + vchips + '</div>' + settle + '</div>' + stPill + '</div>'
      + rateStrip + kpi + table + sum;
  }
  /* legacy §vbMix lines of one code, from the server's mix */
  function mixHtml(c){
    var mix = c.mix || [], lines = '', zero = '';
    mix.forEach(function(m){
      if(!n(m.rate) && !n(m.ex) && !n(m.cut)){ zero += '<div class="ln z"><span class="f">ยังไม่ใส่เรต</span><span class="x">× ' + n(m.vans) + '</span><span class="a">—</span></div>'; return; }
      var f = N(m.rate) + (n(m.ex) ? ' + ' + N(m.ex) : '') + (n(m.cut) ? ' − ' + N(m.cut) : '') + ((n(m.ex) || n(m.cut)) ? ' = ' + N(m.per_van) : '');
      lines += '<div class="ln"><span class="f">' + f + '</span><span class="x">× ' + n(m.vans) + '</span><span class="a">' + B(m.amount) + '</span></div>';
    });
    if(!lines && !zero) return '';
    return '<div class="vb-mix">' + lines + zero + '<div class="ln t"><span class="f">รวม</span><span class="x">' + n(c.vans) + ' คัน</span><span class="a">' + B(c.bill) + '</span></div></div>';
  }

  /* Replace the screen, keeping the field the person is in (legacy §vbFocus) and the scroll. A
     pointer still held down waits for its release (legacy _vbPD → vbRenderSoon → renderVanBill). */
  function paint(html){
    var h = host(); if(!h) return;
    if(window._vbPD){ window._vbWait = true; return; }
    var ae = document.activeElement, k = '', val = null, sel = null;
    if(ae && ae !== document.body && h.contains && h.contains(ae) && ae.getAttribute){
      k = ae.getAttribute('data-vbk') || '';
      if(k){ val = ae.value; try{ sel = [ae.selectionStart, ae.selectionEnd]; }catch(_){ sel = null; } }
      try{ ae.blur(); }catch(_){}
    }
    var se = document.scrollingElement, main = h.closest ? h.closest('.main') : null;
    var y1 = se ? se.scrollTop : 0, y2 = main ? main.scrollTop : 0;
    h.innerHTML = html;
    if(se) se.scrollTop = y1; if(main) main.scrollTop = y2;
    var keep = k && k !== wroteKey;
    wroteKey = '';
    if(!k || !h.querySelector) return;
    try{
      var el = h.querySelector('[data-vbk="' + String(k).replace(/["\\]/g, '\\$&') + '"]');
      if(!el) return;
      el.focus({ preventScroll: true });
      if(keep && val != null && String(val) !== String(el.value)){
        el.value = val;
        if(sel && el.setSelectionRange){ try{ el.setSelectionRange(sel[0], sel[1]); }catch(_){} }
      } else if(el.select) el.select();
    }catch(_){}
  }
  function draw(v){
    if(_vb.mode === 'ov') paint(shellV2(overviewV2(v)));
    else paint(shellV2(sheetV2(v, _vb.van ? ((cache[address() + '?pier=' + enc(_vb.pier)] || {}).view || null) : v)));
    try{ if(_vb.mode !== 'ov' && typeof vbxBind === 'function') vbxBind(host()); }catch(_){}
  }
  function drawError(e){
    paint(shell(title('') + plainBar() + '<div style="padding:32px;text-align:center;color:#A32D2D">' + esc(e && e.message || 'Van bills could not load') + '</div>'));
  }
  function drawLoading(){ paint(shell(title('') + plainBar() + O.loadingHtml('Loading van bills…'))); }
  function render(){
    var h = host(); if(!h) return;
    if(!_vb.ym){
      var t = O.today(); _vb.ym = t.slice(0, 7); var dd = +t.slice(8, 10); _vb.per = dd <= 10 ? 1 : (dd <= 20 ? 2 : 3);
    }
    if(_vb.mode !== 'ov'){
      if(!cache[overviewKey()]){
        drawLoading();
        load(overviewKey()).then(function(){ render(); }, drawError);
        return;
      }
      var sups = partnerNames();
      if(!_vb.sup || sups.indexOf(_vb.sup) < 0) _vb.sup = sups[0] || '';
      if(!_vb.sup){ paint(shell(title('') + plainBar() + '<div style="padding:40px;text-align:center;color:#8B96A0;font-size:13px">ไม่มีงานรถร่วมในรอบบิลนี้</div>')); return; }
    }
    if(_vb.pier == null) _vb.pier = '';
    /* the owner's sheet is the sheet of ONE pier (legacy: the first pier this owner works at) */
    if(_vb.mode !== 'ov' && !_vb.pier){
      var wk = address(), whole = cache[wk];
      if(!whole){ drawLoading(); load(wk).then(function(){ render(); }, drawError); return; }
      var parts = (whole.view.by_pier || []).filter(function(x){ return n(x.trips) > 0; });
      _vb.pier = (parts[0] && parts[0].pier) || ((ovTabs().filter(function(t){ return t.pier; })[0] || {}).pier) || 'panwa';
    }
    var key = viewKey(), hit = cache[key];
    if(hit){ draw(hit.view); if(_vb.mode === 'ov') loadVanNames(); if(Date.now() - hit.at < TTL) return; }
    else drawLoading();
    /* with one van picked the sheet shows that van's rows; the chips count every van's rows of the pier, from the pier's whole read */
    if(_vb.mode !== 'ov' && _vb.van){ var sib = address() + '?pier=' + enc(_vb.pier); if(!cache[sib]) load(sib).then(function(){ if(viewKey() === key) render(); }, function(){}); }
    load(key).then(function(v){
      if(viewKey() !== key) return;
      // the overview by pier: a pier with no work this round is not a tab any more: back to all of them
      if(_vb.mode === 'ov' && _vb.pier && !(v.tabs || []).some(function(t){ return t.pier === _vb.pier; })){ _vb.pier = ''; render(); return; }
      if(!hit || JSON.stringify(hit.view) !== JSON.stringify(v)) draw(v);
    }, function(e){ if(viewKey() === key && !hit) drawError(e); else O.fail('Van bills could not refresh', e); });
    if(_vb.mode === 'ov') loadVanNames();
  }

  /* ── writes · server first: the screen shows the server's answer, or goes back ── */
  function current(){ var h = cache[viewKey()]; return h ? h.view : null; }
  function drop2(){ Object.keys(cache).forEach(function(k){ if(k.indexOf('/v1/van-bills?') === 0) cache[k].at = 0; }); }   // the overviews are old now: kept on screen until the new ones land
  /* The answer of a write is the WHOLE bill of that address. What is on screen may be one pier's (or one van's) part of it, so the screen's
     own read is asked again (kept on screen until it lands, so a field being typed in does not lose its place) and only then drawn. */
  function answered(addr, onOk){
    return function(v){
      if(v && v.partner) bills[addr] = v;
      drop2();
      Object.keys(cache).forEach(function(k){ if(k === addr || k.indexOf(addr + '?') === 0) delete cache[k]; });
      var key = viewKey();
      var go = (key === addr) ? (put(addr, v), Promise.resolve()) : load(key).catch(function(){});
      var sib = (_vb.mode !== 'ov' && _vb.van) ? load(address() + '?pier=' + enc(_vb.pier)).catch(function(){}) : null;
      var ovp = (_vb.mode !== 'ov') ? load(overviewKey()).catch(function(){}) : null;      // the owner chips of the sheet show the overview's figures
      return Promise.all([go, sib, ovp]).then(function(){ if(onOk) onOk(v); render(); return v; });
    };
  }
  function refused(title){ return function(e){ O.fail(title, e); render(); return null; }; }
  /* body(view) is built when the write runs, from the latest answer, so two quick edits both land */
  function patch(body, title, addr, onOk){
    addr = addr || address();
    return O.queue(function(){
      if(typeof body !== 'function') return O.patch(addr, body);
      // the body is built from the WHOLE bill as the server has it now (never from a pier's or a van's part of it)
      return O.get(addr).then(function(whole){ bills[addr] = whole; return O.patch(addr, body(whole)); });
    }).then(answered(addr, onOk), refused(title || 'Van bill was not saved'));
  }
  function clone(x){ return O.clone(x) || {}; }
  function mark(k){ opened()[k] = 1; wroteKey = k; }
  function setRow(key, field, val){
    if(!current()) return;
    mark(key + '|' + field);
    return patch(function(v){
      var map = clone(v.row_overrides), o = map[key] || { rate: null, ex: null, cut: null, per: null };
      o[field] = amountIn(val); map[key] = o;
      return { row_overrides: map };
    });
  }
  function setCodeRate(code, val){
    if(!current()) return;
    mark('@rate:' + code);
    return patch(function(v){
      var map = clone(v.route_rates), x = amountIn(val);
      if(x == null) delete map[code]; else map[code] = x;
      return { route_rates: map };
    });
  }
  function setRate(val){ return patch({ rate: amountIn(val) || 0 }); }
  function setPerPax(val){ mark('@perPax'); return patch({ per_pax: amountIn(val) || 0 }); }
  /* legacy vbSetPer: the sale price per person of the pier on screen (per_pax_by_pier; sent whole, one pier changed) */
  function setPerPier(val){
    var pier = _vb.pier || 'panwa';
    mark('@per:' + pier);
    return patch(function(v){ var m = clone(v.per_pax_by_pier); m[pier] = amountIn(val) || 0; return { per_pax_by_pier: m }; });
  }
  /* the typed fields of the extra lines only: bill and sale are the server's */
  function lines(v){ return ((v && v.extra_lines) || []).map(function(x){ return { id: x.id, date: x.date, note: x.note, vans: x.vans, pax: x.pax, rate: x.rate, ex: x.ex, cut: x.cut, per_pax: x.per_pax, pier: x.pier }; }); }
  function addExtra(){
    var cur = bills[address()] || current(); if(!cur) return;
    var before = {}; (cur.extra_lines || []).forEach(function(x){ before[x.id] = 1; });
    // legacy vbAddExtra: dated the first day of the period, noted "รถนอก", one van
    return patch(function(v){
      var l = lines(v); l.push({ date: v.from || null, note: 'รถนอก', vans: 1, pax: 0, rate: 0, ex: 0, cut: 0, per_pax: 0, pier: _vb.pier || 'panwa' });   // the line belongs to the sheet it was added on (legacy vbAddExtra)
      return { extra_lines: l };
    }, 'Extra line was not added', null, function(v){
      // a new line is open to type in, every field (legacy opens them, else it locks at once)
      ((v && v.extra_lines) || []).forEach(function(x){
        if(!before[x.id]) ['date', 'note', 'vans', 'pax', 'rate', 'ex', 'cut', 'per_pax'].forEach(function(f){ opened()['x' + x.id + '|' + f] = 1; });
      });
    });
  }
  function setExtra(id, field, val){
    mark('x' + id + '|' + field);
    return patch(function(v){
      var l = lines(v);
      l.forEach(function(x){
        if(x.id !== id) return;
        if(field === 'note') x.note = text(val).trim() || null;
        else if(field === 'date') x.date = text(val) || null;
        else if(field === 'vans' || field === 'pax') x[field] = Math.round(amountIn(val) || 0);
        else x[field] = amountIn(val) || 0;
      });
      return { extra_lines: l };
    });
  }
  function delExtra(id){
    if(!confirm('Remove this extra line?')) return;
    return patch(function(v){ return { extra_lines: lines(v).filter(function(x){ return x.id !== id; }) }; });
  }
  function save(onOk){ return patch({ mark_seen: true }, 'Van bill was not saved', null, onOk); }
  function action(path, body, title){
    var addr = address();
    return O.queue(function(){ return O.post(addr + '/' + path, body); })
      .then(answered(addr), refused(title));
  }
  function pullRates(){
    var addr = address();
    return O.queue(function(){ return O.post(addr + '/pull-rates'); }).then(function(v){
      var got = (v.pulled && v.pulled.got) || [], none = (v.pulled && v.pulled.none) || [];
      got.forEach(function(g){ opened()['@rate:' + g.code] = 1; });
      answered(addr)(v);
      var gen = got.filter(function(g){ return g.generic; }).map(function(g){ return g.code; });
      O.toast({ kind: 'success', title: 'Rates pulled', status: 'OK', dur: 7000,
        sub: 'ดึงเรตมาแล้ว · ' + got.map(function(g){ return g.code + ' ' + N(g.rate) + (g.generic ? ' *' : ''); }).join(' · ')
          + (none.length ? ' · ยังไม่มีเรตของ ' + none.join(', ') : '')
          + (gen.length ? ' · * ' + gen.join(', ') + ' ยังไม่ได้ตั้งเรตของเส้นทางนี้ ใช้เรตกลางของเจ้านี้ไปก่อน — ตรวจก่อนวางบิล' : '') });
    }, refused('Rates were not pulled'));
  }
  function send(){ return action('send', {}, 'Bill was not sent'); }
  function unsend(){ if(!confirm('Take this bill back to draft?')) return; return action('unsend', {}, 'Bill was not unsent'); }
  function unpay(){ if(!confirm('Undo the payment of this bill?')) return; return action('unpay', {}, 'Payment was not undone'); }
  function pay(){
    var via = prompt('Paid via (transfer / cash / cheque)', 'transfer'); if(via == null) return;
    var ref = prompt('Reference (optional)', ''); if(ref == null) return;
    return action('pay', { via: String(via).trim().toLowerCase(), ref: ref.trim() || null }, 'Payment was not recorded');
  }

  /* ── edit mode (legacy vbEdit / vbSave / vbCancel / vbLeave) ── */
  function inputs(v){
    return { per_pax: n(v.per_pax), rate: n(v.rate), route_rates: clone(v.route_rates), row_overrides: clone(v.row_overrides),
      per_pax_by_pier: clone(v.per_pax_by_pier), extra_lines: lines(v) };
  }
  function endEdit(){ _vb.edit = 0; _vb.snap = null; snap = null; _vb.open = {}; _vb.foc = ''; }
  function edit(){
    var addr = address(), v = bills[addr]; if(v && v.state === 'paid') return;
    // the inputs to put back are the WHOLE bill's: read it now (what is drawn may be one pier of it)
    O.get(addr).then(function(whole){
      if(!whole || !whole.rows || whole.state === 'paid') return;
      bills[addr] = whole; snap = { addr: addr, body: inputs(whole) };
      _vb.edit = 1; _vb.open = {}; _vb.foc = ''; render();
    }, function(e){ O.fail('Van bill could not be opened for editing', e); });
  }
  function saveEdit(){
    return save(function(){ endEdit(); O.toast({ kind: 'success', title: 'บันทึกใบวางบิลแล้ว', status: 'OK', dur: 3000 }); });
  }
  function cancelEdit(quiet){
    if(!quiet && !confirm('Put back the figures from before this edit?')) return;
    var s = snap, v = s && bills[s.addr];
    endEdit();
    if(s && v && JSON.stringify(inputs(v)) !== JSON.stringify(s.body)) return patch(s.body, 'Van bill was not put back', s.addr);
    render();
  }
  /* changing period / owner / mode while editing: what was typed is already saved, so just leave edit mode */
  function leave(){ if(_vb.edit) endEdit(); return true; }

  /* ── wiring ── */
  function wrap(name, fn){
    var orig = window[name];
    originals[name] = orig;
    var w = function(){
      if(!enabled()) return typeof orig === 'function' ? orig.apply(this, arguments) : undefined;
      return fn.apply(this, [orig].concat([].slice.call(arguments)));
    };
    w.__opsVanBills = true;
    window[name] = w;
  }
  wrap('renderVanBill', function(){ render(); });
  wrap('vbPersist', function(){ return; });          // the bill lives on the server, not in the blob
  wrap('vbEdit', function(){ edit(); });
  wrap('vbSave', function(){ return saveEdit(); });
  wrap('vbCancel', function(orig, quiet){ return cancelEdit(quiet); });
  wrap('vbLeave', function(){ return leave(); });
  /* w5c: the pier tabs and the sale price per person of a pier (legacy vbSetPier / vbOpenSupP / vbSetPer walked the browser's own bookings) */
  wrap('vbSetPier', function(orig, p){
    if(!leave()) return;
    _vb.pier = String(p || ''); _vb.van = ''; _vb.open = {}; _vb.foc = '';
    if(_vb.mode !== 'ov' && _vb.pier){
      var ov = cache[overviewKey()], blk = ov && (ov.view.piers || []).filter(function(b){ return b.pier === _vb.pier; })[0];
      if(blk && blk.partners.length && !blk.partners.some(function(g){ return g.partner === _vb.sup; })) _vb.sup = blk.partners[0].partner;
    }
    render();
  });
  wrap('vbOpenSupP', function(orig, sup, p){
    if(!leave()) return;
    _vb.sup = String(sup || ''); _vb.pier = String(p || ''); _vb.van = ''; _vb.mode = 'one'; _vb.open = {}; _vb.foc = '';
    render();
  });
  wrap('vbSetPer', function(orig, val){ return setPerPier(val); });
  O.onChange(function(){ drop(); });

  /* Transfer Fleet's van_rates blob is a server-backed cell map. */
  var vr = { loaded: false, loading: null, rates: {}, known: {}, pending: 0, failed: false };
  function vrFlat(R){
    var out = {};
    Object.keys(R || {}).forEach(function(g){
      var G = R[g] || {};
      if(G.base != null) out[JSON.stringify([g, null, 'base'])] = n(G.base);
      Object.keys(G.rt || {}).forEach(function(r){
        ['base', 'PK', 'KL'].forEach(function(f){
          if(G.rt[r][f] != null) out[JSON.stringify([g, r, f])] = n(G.rt[r][f]);
        });
      });
    });
    return out;
  }
  function vrApply(view){
    var R = {};
    (view.rates || []).forEach(function(c){
      var G = R[c.group_key] = R[c.group_key] || {};
      if(c.route_id == null) G.base = n(c.rate);
      else { G.rt = G.rt || {}; (G.rt[c.route_id] = G.rt[c.route_id] || {})[c.field] = n(c.rate); }
    });
    vr.rates = R; vr.known = vrFlat(R); vr.loaded = true;
  }
  /* Readers of vanRates() outside the Costing screen get {} until the first load lands. After that first
     successful load, redraw the active one (unless someone is typing). costing repaints itself (ctRender/ctRead).
     In ops mode renderDailyReport / renderTripPL draw the server's own figures and never read vanRates();
     they are listed only so a local-fallback draw cannot stay stale. The pick-up "fill rates" action (08-app 7890)
     reads vanRate() on click, so it needs no redraw. */
  var READERS = { dailyreport: 'renderDailyReport', trippl: 'renderTripPL', dailypfm: 'renderDailyPfm' };
  function vrRefreshReaders(){
    try{
      if(O.busy && O.busy()) return;
      var fn = READERS[O.activeView ? O.activeView() : ''];
      if(fn && typeof window[fn] === 'function') window[fn]();
    }catch(_){}
  }
  function vrLoad(force){
    if(vr.loading) return vr.loading;
    if(vr.loaded && !force) return Promise.resolve();
    var first = !vr.loaded;
    vr.loading = O.get('/v1/van-rates').then(vrApply).then(function(){ if(first) vrRefreshReaders(); });
    return vr.loading.then(function(){ vr.loading = null; }, function(e){ vr.loading = null; throw e; });
  }
  function vrRepaint(){ if(typeof window.ctRender === 'function') window.ctRender(); }
  function vrWrite(val){
    if(!vr.loaded) { O.fail('Van rates were not saved', new Error('Wait for van rates to load')); return; }
    var next = vrFlat(val), jobs = Object.keys(next).filter(function(k){ return next[k] !== vr.known[k]; });
    Object.keys(vr.known).forEach(function(k){ if(!(k in next)) jobs.push(k); });
    if(!jobs.length) return Promise.resolve();
    // Keep successive edits while queued; only the final server answer replaces this draft.
    // Snapshot first: a refusal puts the pre-edit state back at once (server-first), then reloads.
    var snap = { rates: vr.rates, known: vr.known };
    vr.rates = O.clone(val); vr.known = next; vr.pending++;
    return O.queue(function(){
      var last;
      return jobs.reduce(function(p, k){ return p.then(function(){
        var a = JSON.parse(k);
        return O.call('PUT', '/v1/van-rates', { group: a[0], route_id: a[1], field: a[2], rate: k in next ? next[k] : null })
          .then(function(v){ last = v; });
      }); }, Promise.resolve()).then(function(){ return last; });
    }).then(function(v){ return v; }, function(e){
      vr.failed = true; vr.rates = snap.rates; vr.known = snap.known; vrRepaint();
      O.fail('Van rates were not saved', e);
    })
      .then(function(v){
        vr.pending--; drop();
        if(vr.pending) return;
        if(vr.failed){ vr.failed = false; return vrLoad(true).then(vrRepaint, function(e){ vr.loaded = false; O.fail('Van rates could not reload', e); }); }
        vrApply(v); vrRepaint();
      });
  }
  wrap('ctRender', function(orig){
    var self = this, args = [].slice.call(arguments, 1);
    if(vr.loaded) return orig.apply(self, args);
    return vrLoad().then(function(){ return orig.apply(self, args); }, function(e){
      O.fail('Van rates could not load', e);
      var host = document.getElementById('ct-body'); if(!host) return;
      host.innerHTML = '<div data-van-rates-unavailable="1" style="padding:32px;text-align:center;color:#A32D2D">'
        + 'Van rates are unavailable (they did not load from operation-backend), so Costing is not shown. '
        + '<button onclick="ctRender()">Retry</button></div>';
    });
  });
  wrap('ctRead', function(orig, key){
    if(key !== 'van_rates') return orig.apply(this, [].slice.call(arguments, 1));
    if(!vr.loaded){ vrLoad().then(vrRepaint, function(e){ O.fail('Van rates could not load', e); }); return null; }
    return O.clone(vr.rates);
  });
  wrap('ctWrite', function(orig, key, val){
    return key === 'van_rates' ? vrWrite(val) : orig.apply(this, [].slice.call(arguments, 1));
  });

  /* ── print (legacy vbPrint) ──
     The paper is made by the server and only laid out here with legacy's print CSS:
       GET /v1/van-bills/summary?month=&period=&pier=                         the round summary (internal)
       GET /v1/van-bills/{partner}/{month}/{period}/billing-note?pier=&copy=  one owner's note, one pier
     The supplier copy has no sale / profit. Nothing is added up here; the Thai words of the bill total stay
     the client's (pcBahtText). The window opens first (a popup blocker only allows it inside the click). */
  var VB_PRINT_CSS = '*{box-sizing:border-box}body{font-family:Sarabun,"IBM Plex Sans Thai","DM Sans",sans-serif;margin:0;color:#111827;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
    + '.ph{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #16265C;padding-bottom:9px}'
    + '.co b{display:block;font-size:15px;font-weight:800;color:#16265C}.co i{font-style:normal;display:block;font-size:10px;color:#4B5563;line-height:1.5}'
    + '.doc{text-align:right}.doc b{display:block;font-size:20px;font-weight:800;color:#16265C}.doc i{font-style:normal;display:block;font-size:9px;letter-spacing:.2em;color:#6B7280;font-weight:700}'
    + '.tag{display:inline-block;margin-top:4px;background:#B45309;color:#fff;font-size:9.5px;font-weight:800;letter-spacing:.08em;padding:2px 8px;border-radius:5px}'
    + '.tag.in{background:#B42318}'
    + '.meta{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;border:1px solid #D1D5DB;border-radius:6px;margin-top:9px}'
    + '.meta div{padding:5px 9px;border-right:1px solid #E5E7EB;font-size:11px}.meta div:last-child{border-right:0}'
    + '.meta i{font-style:normal;display:block;font-size:8.5px;font-weight:700;letter-spacing:.12em;color:#6B7280}.meta b{font-size:12px}'
    + 'table{width:100%;border-collapse:collapse;font-size:10.5px;margin-top:9px}'
    + 'th{background:#16265C;color:#fff;font-size:8.5px;letter-spacing:.06em;font-weight:700;padding:5px 6px;text-align:right;white-space:nowrap}'
    + 'th.l,td.l{text-align:left}td{padding:4px 6px;border-bottom:1px solid #E5E7EB;text-align:right;vertical-align:top}'
    + 'tr.z td{background:#F9FAFB}tr.tot td{border-top:1.5px solid #16265C;border-bottom:1.5px solid #16265C;font-weight:800;font-size:11px}'
    + 'tr.day td{background:#EEF1F6;font-weight:800;font-size:9.5px;color:#374151}'
    + '.pier{margin-top:12px;font-size:12px;font-weight:800;padding:5px 9px;color:#fff;border-radius:5px}'
    + '.cd{display:inline-block;font-size:8.5px;font-weight:800;color:#fff;border-radius:3px;padding:0 4px;margin-right:4px}'
    + '.sub{font-size:9px;color:#6B7280}.neg{color:#B42318}.pos{color:#0F7A4E}'
    + '.grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:10px;align-items:start}'
    + '.words{margin-top:8px;padding:7px 10px;border:1px solid #D1D5DB;border-radius:6px;font-size:11px}'
    + '.note{font-size:9.5px;color:#4B5563;line-height:1.6;margin-top:7px}'
    + '.sig{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;margin-top:30px;page-break-inside:avoid}'
    + '.sig div{text-align:center;font-size:10.5px;color:#374151}.sig div:before{content:"";display:block;border-bottom:1px dotted #6B7280;height:30px;margin-bottom:6px}'
    + '.sig i{font-style:normal;display:block;font-size:9px;color:#6B7280;margin-top:3px}'
    + '.foot{margin-top:14px;display:flex;justify-content:space-between;font-size:8.5px;color:#9CA3AF;border-top:1px solid #E5E7EB;padding-top:5px}';
  function printCodeCol(code){
    if(code === '+') return '#5B6570';
    var m = typeof VB_CODE !== 'undefined' ? VB_CODE : {}, k;
    for(k in m) if(m[k] && m[k].c === code) return m[k].col;
    return '#8B96A0';
  }
  function printHead(title, en, tag){
    return '<div class="ph"><div class="co"><b>LOVE ANDAMAN</b><i>บริษัท เลิฟ ไอส์แลนด์ จำกัด (Love Island Co., Ltd.)<br>ภูเก็ต · ฝ่ายปฏิบัติการ</i></div>'
      + '<div class="doc"><i>' + en + '</i><b>' + title + '</b>' + (tag || '') + '</div></div>';
  }
  function printSig(a, b, c){
    return '<div class="sig"><div>' + a[0] + '<i>' + a[1] + ' · วันที่ ____/____/____</i></div><div>' + b[0] + '<i>' + b[1] + ' · วันที่ ____/____/____</i></div><div>' + c[0] + '<i>' + c[1] + 'วันที่ ____/____/____</i></div></div>';
  }
  function printStamp(doc){
    var d = doc && doc.printed_at ? new Date(doc.printed_at) : new Date();
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ' · ' + text(doc && doc.printed_by);
  }
  function printWords(v){ return esc(typeof pcBahtText === 'function' ? pcBahtText(v) : ''); }
  function printSummary(doc, stamp){
    var rnd = vbPeriod().label + ' ' + vbMoLbl(), T = doc.totals || {};
    var sec = (doc.piers || []).map(function(P){
      var CL = (P.code_columns || []).slice(); if(P.extra_column) CL.push('+');
      var S = P.totals || {}, cT = {};
      (S.by_code || []).forEach(function(c){ cT[c.code] = c.bill; }); cT['+'] = S.extra_bill;
      var spl = n(S.pl);
      var body = (P.owners || []).map(function(g, i){
        var vn = (g.van_ids || []).map(vanName);
        var bc = {}; (g.by_code || []).forEach(function(c){ bc[c.code] = c.bill; });
        return '<tr class="' + (i % 2 ? 'z' : '') + '"><td class="l">' + (i + 1) + '</td><td class="l"><b>' + esc(g.partner) + '</b><div class="sub">' + esc(vn.join(' · ')) + '</div></td>'
          + '<td>' + n(g.trips) + '</td><td>' + n(g.pax) + '</td><td>' + (n(g.trips) ? n(g.avg_pax_per_trip).toFixed(2) : '—') + '</td>'
          + CL.map(function(c){ var v = c === '+' ? g.extra_bill : bc[c]; return '<td>' + (v != null && (c !== '+' || n(v)) ? N(v) : '—') + '</td>'; }).join('')
          + '<td>' + (n(g.ex) ? N(g.ex) : '—') + '</td><td>' + (n(g.cut) ? ('-' + N(g.cut)) : '—') + '</td><td><b>' + N(g.bill) + '</b>' + (n(g.missing_rate) ? '<div class="sub neg">ไม่มีเรต ' + n(g.missing_rate) + '</div>' : '') + '</td>'
          + '<td>' + N(g.sale) + '</td><td class="' + (n(g.pl) < 0 ? 'neg' : 'pos') + '">' + (n(g.pl) < 0 ? '-' : '') + N(Math.abs(n(g.pl))) + '</td><td class="l">&#9744;</td></tr>';
      }).join('');
      return '<div class="pier" style="background:' + (VB_PIER_C[P.pier] || '#5B6570') + '">' + esc(VB_PIER_LBL[P.pier] || P.pier) + ' · ' + n(S.owners) + ' เจ้า · ' + n(S.trips) + ' เที่ยว · ' + n(S.pax) + ' คน</div>'
        + '<table style="margin-top:4px"><tr><th class="l">#</th><th class="l">เจ้าของรถ / คัน</th><th>เที่ยว</th><th>คน</th><th>คน/คัน</th>'
        + CL.map(function(c){ return '<th>' + (c === '+' ? 'รถนอก' : esc(c)) + '</th>'; }).join('')
        + '<th>Extra</th><th>หัก</th><th>เรียกเก็บ</th><th>ราคาขาย</th><th>กำไร/ขาดทุน</th><th class="l">จ่าย</th></tr>' + body
        + '<tr class="tot"><td></td><td class="l">รวม' + esc(VB_PIER_SH[P.pier] || P.pier) + '</td><td>' + n(S.trips) + '</td><td>' + n(S.pax) + '</td><td>' + (n(S.trips) ? n(S.avg_pax_per_trip).toFixed(2) : '—') + '</td>'
        + CL.map(function(c){ return '<td>' + N(cT[c]) + '</td>'; }).join('')
        + '<td>' + N(S.ex) + '</td><td>' + (n(S.cut) ? ('-' + N(S.cut)) : '0') + '</td><td>' + N(S.bill) + '</td><td>' + N(S.sale) + '</td><td class="' + (spl < 0 ? 'neg' : 'pos') + '">' + (spl < 0 ? '-' : '') + N(Math.abs(spl)) + '</td><td></td></tr></table>';
    }).join('');
    var gpl = n(T.pl);
    return printHead('สรุปรอบบิลรถร่วม', 'VAN SUPPLIER BILLING SUMMARY', '<div class="tag in">เอกสารภายใน</div>')
      + '<div class="meta"><div><i>รอบบิล</i><b>' + esc(rnd) + '</b></div><div><i>ท่า</i><b>' + esc(doc.pier ? (VB_PIER_LBL[doc.pier] || doc.pier) : 'ทุกท่า') + '</b></div>'
      + '<div><i>เลขที่</i><b>' + esc(doc.doc_no) + '</b></div>'
      + '<div><i>จำนวน</i><b>' + n(T.owners) + ' เจ้า · ' + n(T.trips) + ' เที่ยว · ' + n(T.pax) + ' คน</b></div><div><i>พิมพ์เมื่อ</i><b>' + esc(stamp) + '</b></div></div>'
      + (sec || '<p style="margin:30px;text-align:center;color:#6B7280">ไม่มีงานรถร่วมในรอบบิลนี้</p>')
      + '<div class="grid2"><div class="note"><b>หมายเหตุ</b><br>· คน = ลูกค้าที่ขึ้นรถจริง (ไม่ใช่ยอดจอง) · ขากลับคิดค่ารถ ไม่คิดราคาขาย<br>· รายละเอียดรายเที่ยวอยู่ในใบวางบิลของแต่ละเจ้า แยกตามท่า</div>'
      + '<table style="margin:0"><tr><th class="l">สรุป' + ((doc.piers || []).length > 1 ? 'ทุกท่า' : '') + '</th><th>บาท</th></tr><tr><td class="l">ค่ารถ</td><td>' + N(T.car_cost) + '</td></tr>'
      + '<tr><td class="l">+ Extra</td><td>' + N(T.ex) + '</td></tr><tr><td class="l">− หัก</td><td>' + N(T.cut) + '</td></tr>'
      + '<tr class="tot"><td class="l">รวมเรียกเก็บ</td><td>' + N(T.bill) + '</td></tr>'
      + '<tr><td class="l" colspan="2" class="sub">(' + printWords(T.bill) + ') · กำไร/ขาดทุน ' + (gpl < 0 ? '-' : '') + N(Math.abs(gpl)) + '</td></tr></table></div>'
      + printSig(['ผู้จัดทำ', 'ฝ่ายปฏิบัติการ'], ['ผู้ตรวจสอบ', 'ฝ่ายบัญชี'], ['ผู้อนุมัติจ่าย', ''])
      + '<div class="foot"><span>พิมพ์ ' + esc(stamp) + '</span><span>LOVE ANDAMAN · สรุปรอบบิลรถร่วม</span></div>';
  }
  function printNote(doc, stamp){
    var IN2 = !!doc.internal, pier = doc.pier, rnd = vbPeriod().label + ' ' + vbMoLbl(), cols = IN2 ? 11 : 9, T = doc.totals || {};
    var last = '', i = 0;
    var body = (doc.rows || []).map(function(r){
      var dh = '', ret = !!r.return_only;
      if(r.date !== last){ last = r.date; dh = '<tr class="day"><td class="l" colspan="' + cols + '">' + esc(new Date(r.date + 'T00:00:00').toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long' })) + '</td></tr>'; }
      i++;
      var pk = (r.pickups || []).join(', ') || '—', dp = (r.drops || []).map(function(d){ return d.name; }).join(', ');
      return dh + '<tr class="' + (i % 2 ? '' : 'z') + '"><td class="l">' + i + '</td><td class="l">' + esc(r.date.slice(8, 10) + '/' + r.date.slice(5, 7)) + '</td>'
        + '<td class="l"><span class="cd" style="background:' + printCodeCol(r.code) + '">' + esc(r.code) + '</span><b>' + esc(r.route_name) + '</b>' + (ret ? ' <b style="color:#9A5B00">(ขากลับ)</b>' : '')
        + '<div class="sub">รับ: ' + esc(ret ? '—' : pk) + (dp ? (' · ส่ง: ' + esc(dp)) : '') + ((!ret && n(r.return_bookings)) ? (' · รับกลับให้อีก ' + n(r.return_bookings) + ' ใบ') : '') + '</div></td>'
        + '<td class="l">' + esc(r.van_name) + '</td><td>' + (ret ? (n(r.return_pax) + ' กลับ') : n(r.pax)) + '</td>'
        + '<td>' + (n(r.rate) ? N(r.rate) : '<span class="neg">ไม่มีเรต</span>') + '</td><td>' + (n(r.ex) ? N(r.ex) : '—') + '</td><td>' + (n(r.cut) ? ('-' + N(r.cut)) : '—') + '</td><td><b>' + N(r.bill) + '</b></td>'
        + (IN2 ? ('<td>' + (ret ? '—' : N(r.sale)) + '</td><td class="' + (n(r.pl) < 0 ? 'neg' : 'pos') + '">' + (n(r.pl) < 0 ? '-' : '') + N(Math.abs(n(r.pl))) + '</td>') : '') + '</tr>';
    }).join('');
    (doc.extra_lines || []).forEach(function(x){
      i++;
      body += '<tr class="' + (i % 2 ? '' : 'z') + '"><td class="l">' + i + '</td><td class="l">' + esc(x.date ? (x.date.slice(8, 10) + '/' + x.date.slice(5, 7)) : '—') + '</td>'
        + '<td class="l"><span class="cd" style="background:#5B6570">นอก</span><b>' + esc(x.note || 'รถนอก') + '</b></td><td class="l">' + n(x.vans) + ' คัน</td><td>' + n(x.pax) + '</td>'
        + '<td>' + N(x.rate) + (n(x.vans) > 1 ? (' ×' + n(x.vans)) : '') + '</td><td>' + (n(x.ex) ? N(x.ex) : '—') + '</td><td>' + (n(x.cut) ? ('-' + N(x.cut)) : '—') + '</td><td><b>' + N(x.bill) + '</b></td>'
        + (IN2 ? ('<td>' + N(x.sale) + '</td><td class="' + (n(x.pl) < 0 ? 'neg' : 'pos') + '">' + (n(x.pl) < 0 ? '-' : '') + N(Math.abs(n(x.pl))) + '</td>') : '') + '</tr>';
    });
    var cards = (doc.by_code || []).slice();
    if(doc.extra_totals) cards.push({ code: '+', vans: doc.extra_totals.vans, pax: doc.extra_totals.pax, bill: doc.extra_totals.bill, mix: doc.extra_totals.mix });
    var pl = n(T.pl);
    return printHead('ใบวางบิลค่ารถร่วม', 'BILLING NOTE · VAN SUPPLIER', IN2 ? '<div class="tag in">ฉบับภายใน · ห้ามส่งให้เจ้าของรถ</div>' : '<div class="tag">ฉบับเจ้าของรถ</div>')
      + '<div class="meta"><div style="grid-column:span 2"><i>ผู้วางบิล (เจ้าของรถ)</i><b>' + esc(doc.partner) + '</b><div class="sub">รถที่วิ่ง ' + esc((doc.van_names || []).join(' · ') || '—') + '</div></div>'
      + '<div><i>ท่า</i><b>' + esc(VB_PIER_LBL[pier] || pier) + '</b></div><div><i>รอบบิล</i><b>' + esc(rnd) + '</b></div>'
      + '<div><i>เลขที่</i><b>' + esc(doc.doc_no) + '</b></div></div>'
      + '<table><tr><th class="l">#</th><th class="l">วันที่</th><th class="l">งาน · รับ → ส่ง</th><th class="l">รถ</th><th>คน</th><th>ค่ารถ</th><th>Extra</th><th>หัก</th><th>รวม</th>'
      + (IN2 ? '<th>ราคาขาย</th><th>กำไร</th>' : '') + '</tr>'
      + (body || '<tr><td colspan="' + cols + '" style="text-align:center;padding:20px;color:#6B7280">ไม่มีงานในรอบนี้</td></tr>')
      + '<tr class="tot"><td></td><td class="l" colspan="3">รวม ' + n(T.items) + ' รายการ</td><td>' + n(T.pax) + '</td><td>' + N(T.car_cost) + '</td><td>' + N(T.ex) + '</td><td>' + (n(T.cut) ? ('-' + N(T.cut)) : '0') + '</td><td>' + N(T.bill) + '</td>'
      + (IN2 ? ('<td>' + N(T.sale) + '</td><td class="' + (pl < 0 ? 'neg' : 'pos') + '">' + (pl < 0 ? '-' : '') + N(Math.abs(pl)) + '</td>') : '') + '</tr></table>'
      + '<div class="grid2"><table style="margin:0"><tr><th class="l">ตามรหัส · ที่มาของยอด</th><th>คัน</th><th>บาท</th></tr>'
      + cards.map(function(X){
          return '<tr class="z"><td class="l"><span class="cd" style="background:' + printCodeCol(X.code) + '">' + (X.code === '+' ? 'นอก' : esc(X.code)) + '</span><b>' + esc(X.code === '+' ? 'รถนอก' : (VB_CODE_TH[X.code] || X.code)) + '</b>'
            + ' <span class="sub">' + n(X.vans) + ' คัน · ' + n(X.pax) + ' คน</span></td><td></td><td><b>' + N(X.bill) + '</b></td></tr>'
            + (X.mix || []).map(function(m){
                var f = N(m.rate) + (n(m.ex) ? (' + ' + N(m.ex)) : '') + (n(m.cut) ? (' − ' + N(m.cut)) : '') + ((n(m.ex) || n(m.cut)) ? (' = ' + N(m.per_van)) : '');
                return '<tr><td class="l" style="padding-left:18px;color:#4B5563">' + (n(m.rate) > 0 || n(m.ex) || n(m.cut) ? f : '<span class="neg">ยังไม่มีเรต</span>') + '</td>'
                  + '<td style="color:#6B7280">× ' + n(m.vans) + '</td><td>' + N(m.amount) + '</td></tr>'; }).join('');
        }).join('')
      + '</table>'
      + '<table style="margin:0"><tr><th class="l">สรุป</th><th>บาท</th></tr><tr><td class="l">ค่ารถ ' + n(T.items) + ' เที่ยว</td><td>' + N(T.car_cost) + '</td></tr><tr><td class="l">+ Extra</td><td>' + N(T.ex) + '</td></tr>'
      + '<tr><td class="l">− หัก</td><td>' + N(T.cut) + '</td></tr><tr class="tot"><td class="l">ยอดวางบิล</td><td>' + N(T.bill) + '</td></tr></table></div>'
      + '<div class="words"><b>จำนวนเงิน (ตัวอักษร)</b> &nbsp; ' + printWords(T.bill) + '</div>'
      + '<div class="note">คน = ลูกค้าที่ขึ้นรถจริง · ขากลับ = เที่ยวรับกลับจากท่า · โปรดตรวจและเซ็นรับรองยอด แล้วส่งคืนฝ่ายปฏิบัติการ</div>'
      + printSig(['ผู้วางบิล', 'เจ้าของรถ'], ['ผู้รับวางบิล', 'LOVE ANDAMAN'], ['ผู้อนุมัติจ่าย', ''])
      + '<div class="foot"><span>พิมพ์ ' + esc(stamp) + '</span><span>' + esc(doc.partner) + ' · ' + esc(VB_PIER_LBL[pier] || pier) + ' · ' + esc(rnd) + '</span></div>';
  }
  wrap('vbPrint', function(orig, internal){
    var ov = _vb.mode === 'ov', pier = _vb.pier || 'panwa';
    var url = ov
      ? '/v1/van-bills/summary?month=' + enc(_vb.ym) + '&period=' + enc(_vb.per) + (_vb.pier ? '&pier=' + enc(_vb.pier) : '')
      : address() + '/billing-note?pier=' + enc(pier) + '&copy=' + (internal ? 'internal' : 'supplier');
    var w = window.open('', '_blank'); if(!w) return;
    return O.get(url).then(function(doc){
      var stamp = printStamp(doc);
      var css = '@page{size:A4 ' + (ov ? 'landscape' : 'portrait') + ';margin:11mm}' + VB_PRINT_CSS;
      w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + (ov ? 'สรุปรอบบิลรถร่วม' : ('ใบวางบิล ' + esc(_vb.sup))) + '</title>'
        + '<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800&display=swap" rel="stylesheet">'
        + '<style>' + css + '</style></head><body>' + (ov ? printSummary(doc, stamp) : printNote(doc, stamp)) + '</body></html>');
      w.document.close(); w.focus(); setTimeout(function(){ try{ w.print(); }catch(_){} }, 600);
    }, function(e){ try{ w.close(); }catch(_){} O.fail('Van bill could not be printed', e); return null; });
  });

  window.laOpsVanBills = { render: render, setRow: setRow, setCodeRate: setCodeRate, setRate: setRate, setPerPax: setPerPax,
    setPerPier: setPerPier, addExtra: addExtra, setExtra: setExtra, delExtra: delExtra, save: save, pullRates: pullRates, send: send, unsend: unsend,
    pay: pay, unpay: unpay, originals: originals };
})();
