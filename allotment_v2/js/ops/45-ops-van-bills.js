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
  function viewKey(){
    if(_vb.mode === 'ov') return overviewKey();
    return address() + (_vb.van ? '?van_id=' + enc(_vb.van) : '');
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
    if(view && view.partner && Array.isArray(view.rows)) bills[addrOf(view)] = view;
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
  function short(a){ a = text(a); return a.length > 20 ? a.slice(0, 19) + '…' : a; }
  function dmy(d){ d = text(d); return d.length >= 10 ? d.slice(8, 10) + '/' + (+d.slice(5, 7)) + '/' + d.slice(2, 4) : (d || '—'); }
  function monthTh(){
    var y = +text(_vb.ym).slice(0, 4), m = +text(_vb.ym).slice(5, 7);
    try{ return new Date(y, m - 1, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' }); }catch(_){ return _vb.ym; }
  }
  function css(){ try{ return typeof vbCss === 'function' ? vbCss() : ''; }catch(_){ return ''; } }
  function avg(pax, trips){ return n(trips) ? (n(pax) / n(trips)).toFixed(2) : '0.00'; }   // one line's ratio, for display
  function booked(pax, bk, light){
    if(!(n(bk) > n(pax))) return '';
    return '<div class="vb-cxl"' + (light ? ' style="color:#FFD79A"' : '') + ' title="ใบจองรวม ' + n(bk) + ' คน · ไม่ได้ขึ้นรถ ' + (n(bk) - n(pax)) + ' คน">จอง ' + n(bk) + ' · −' + (n(bk) - n(pax)) + '</div>';
  }
  var MUT = '<span class="vb-mut">·</span>';
  var NOT_SENT = '<span class="vb-mut" title="operation-backend does not send this total yet">—</span>';

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
  /* legacy §vbMix: one line per price a van, then the code's total · all figures are the server's */
  function codeCard(c){
    var mix = c.mix || [], lines = '', zero = '';
    mix.forEach(function(m){
      if(!n(m.rate) && !n(m.ex) && !n(m.cut)){
        zero += '<div class="ln z"><span class="f">ยังไม่ใส่เรต</span><span class="x">× ' + n(m.vans) + '</span><span class="a">—</span></div>';
        return;
      }
      var f = N(m.rate) + (n(m.ex) ? ' + ' + N(m.ex) : '') + (n(m.cut) ? ' − ' + N(m.cut) : '') + ((n(m.ex) || n(m.cut)) ? ' = ' + N(m.per_van) : '');
      lines += '<div class="ln"><span class="f">' + f + '</span><span class="x">× ' + n(m.vans) + '</span><span class="a">' + B(m.amount) + '</span></div>';
    });
    var calc = n(c.vans) ? '<div class="vb-mix">' + lines + zero
      + '<div class="ln t"><span class="f">รวม</span><span class="x">' + n(c.vans) + ' คัน</span><span class="a">' + B(c.bill) + '</span></div></div>' : '';
    return '<div class="vb-sb" data-code="' + esc(c.code) + '"><div class="t"><span class="vb-lg" style="background:' + codeCol(c.code) + '"></span>' + esc(c.code) + '</div>'
      + '<div class="b">' + B(c.bill) + '</div><div class="s">' + (n(c.vans) ? (n(c.vans) + ' คัน · ' + n(c.pax) + ' คน') : 'ไม่มีงานรอบนี้') + '</div>' + calc + '</div>';
  }
  /* PP / PB / MT always (as legacy), then any other code the server reports work for */
  function codeCards(list){
    var byCode = {}; (list || []).forEach(function(c){ byCode[c.code] = c; });
    var codes = ['PP', 'PB', 'MT'].concat((list || []).map(function(c){ return c.code; }).filter(function(c){ return ['PP', 'PB', 'MT'].indexOf(c) < 0; }));
    return codes.map(function(c){ return codeCard(byCode[c] || { code: c, vans: 0, pax: 0, bill: 0, mix: [] }); }).join('');
  }
  function extraCard(t){
    return '<div class="vb-sb"><div class="t">EXTRA − หัก</div><div class="b">' + B(n(t.ex) - n(t.cut)) + '</div>'
      + '<div class="s">extra +' + N(t.ex) + ' · หัก <b style="color:#A32D2D">' + (n(t.cut) > 0 ? '−' + N(t.cut) : '0') + '</b></div>'
      + '<div class="s2">' + B(t.ex) + '  −  ' + B(t.cut) + '  =  ' + B(n(t.ex) - n(t.cut)) + '</div></div>';
  }
  function formula(t){
    return '<div class="s2">ค่ารถ ' + B(n(t.bill) - n(t.ex) + n(t.cut)) + '  +  extra ' + B(t.ex) + '  −  หัก ' + B(t.cut) + '  =  ' + B(t.bill) + '</div>';
  }

  /* ── overview (legacy vbRenderOv) ── */
  function overviewHtml(v){
    var P = v.partners || [], t = v.totals || {};
    var has = function(k){ return typeof t[k] === 'number'; };
    var done = P.filter(function(p){ return !n(p.missing_rate); }).length;
    var body = P.map(function(p){
      var none = n(p.trips) > 0 && n(p.missing_rate) >= n(p.trips);
      var M = function(x){ return none ? MUT : B(x); };
      var pill = !n(p.missing_rate) ? '<span class="vb-pill ok">&#10003; กรอกครบ</span>'
        : (none ? '<span class="vb-pill none">ยังไม่เริ่ม · ' + n(p.trips) + ' รายการ</span>' : '<span class="vb-pill part">ขาด ' + n(p.missing_rate) + ' รายการ</span>');
      var ids = p.van_ids || [];
      var names = ids.map(vanName).filter(Boolean).join(' · ');
      return '<tr class="vb-clk" data-p="' + esc(p.partner) + '" onclick="vbOpenSup(this.getAttribute(\'data-p\'))">'
        + '<td class="l"><span class="vb-av">' + esc(text(p.partner).slice(0, 6)) + '</span><span class="vb-supn">' + esc(p.partner) + '</span>'
        + '<div class="vb-supm">' + esc(names || '—') + '</div></td>'
        + '<td><b>' + ids.length + '</b></td><td><b>' + n(p.trips) + '</b></td>'
        + '<td><b>' + n(p.pax) + '</b>' + booked(p.pax, p.booked_pax) + '</td>'
        + '<td>' + avg(p.pax, p.trips) + '</td>'
        + '<td class="r"><b>' + M(p.bill) + '</b></td><td class="r">' + M(p.sale) + '</td>'
        + '<td class="r" style="font-weight:800;color:' + (none ? '#B6BCC3' : (n(p.pl) < 0 ? '#A32D2D' : '#0F6E56')) + '">' + M(p.pl) + '</td>'
        + '<td>' + pill + statePill(p.state, true) + '</td><td class="vb-go">&rsaquo;</td></tr>';
    }).join('');
    var pl = n(t.pl), miss = has('missing_rate') ? n(t.missing_rate) : null;
    return title('<span style="color:#98A2AD">ภาพรวมทุกเจ้าในรอบบิลนี้ · กดที่แถวเพื่อเปิดใบของเจ้านั้น · ยอดคน = คนที่ขึ้นรถจริง</span>')
      + '<div class="vb-bar">' + modeTabs() + segs() + monthNav() + '<span style="flex:1"></span>'
      + '<button class="vb-btn pri" onclick="vbPrint()">&#128424; พิมพ์สรุปรอบบิล</button></div>'
      + '<div class="vb-kpi">'
      + '<div class="k"><div class="l">เจ้าของรถ</div><div class="v">' + P.length + ' <s>เจ้า</s></div></div>'
      + '<div class="k"><div class="l">เที่ยวรวม</div><div class="v">' + n(t.trips) + ' <s>คัน</s></div></div>'
      + '<div class="k"><div class="l">ลูกค้ารวม</div><div class="v">' + n(t.pax) + ' <s>คน</s></div></div>'
      + '<div class="k bill"><div class="l">ราคาเรียกเก็บ</div><div class="v">' + B(t.bill) + '</div></div>'
      + '<div class="k ' + (pl < 0 ? 'loss' : 'gain') + '"><div class="l">กำไร / ขาดทุน</div><div class="v">' + B(pl) + '</div></div>'
      + '<div class="k' + (miss ? ' todo' : '') + '" data-kpi="missing"><div class="l">ยังไม่ได้กรอก</div><div class="v">'
      + (miss == null ? NOT_SENT : (miss ? miss + ' <s>รายการ</s>' : '&#10003; <s>ครบแล้ว</s>')) + '</div></div>'
      + '</div>'
      + '<div class="vb-card"><table class="vb-t vb-ovt"><thead><tr>'
      + '<th class="l" style="min-width:230px">เจ้าของรถ</th>'
      + '<th style="width:60px">รถ</th><th style="width:70px">เที่ยว</th><th style="width:70px">คน</th>'
      + '<th style="width:86px">เฉลี่ย</th><th style="width:108px">ราคาเรียกเก็บ</th>'
      + '<th style="width:98px">ราคาขาย</th><th style="width:108px">กำไร/ขาดทุน</th>'
      + '<th style="width:136px">สถานะการกรอก</th><th style="width:40px"></th></tr></thead>'
      + '<tbody>' + (body || '<tr><td colspan="10" style="padding:26px;text-align:center;color:#98A2AD">ไม่มีงานรถร่วมในรอบบิลนี้</td></tr>') + '</tbody>'
      + '<tfoot><tr><td class="l">รวม ' + P.length + ' เจ้า</td>'
      + '<td>' + (has('vans') ? n(t.vans) : NOT_SENT) + '</td><td>' + n(t.trips) + '</td>'
      + '<td>' + n(t.pax) + (has('booked_pax') ? booked(t.pax, t.booked_pax, true) : '') + '</td>'
      + '<td>' + avg(t.pax, t.trips) + '</td>'
      + '<td class="r">' + B(t.bill) + '</td><td class="r">' + B(t.sale) + '</td>'
      + '<td class="r" style="color:' + (pl < 0 ? '#FF9E9E' : '#9BE6BC') + '">' + B(pl) + '</td>'
      + '<td colspan="2" style="color:' + (miss ? '#FFD79A' : '#9BE6BC') + '">'
      + (miss == null ? (done + ' เจ้ากรอกครบ') : (miss ? 'ยังไม่ได้กรอก ' + miss + ' รายการ' : 'กรอกครบทุกเจ้า')) + '</td></tr></tfoot></table></div>'
      + '<div class="vb-sum">'
      + (Array.isArray(t.by_code) ? codeCards(t.by_code) : '')
      + (has('ex') && has('cut') ? extraCard(t) : '')
      + '<div class="vb-sb dark"><div class="t">รวมเรียกเก็บ</div><div class="b">' + B(t.bill) + '</div>'
      + '<div class="s">' + done + ' เจ้าครบแล้ว · ' + (P.length - done) + ' เจ้ายังไม่ครบ</div>'
      + (has('ex') && has('cut') ? formula(t) : '') + '</div>'
      + '</div>';
  }

  /* ── one partner's bill (legacy renderVanBill) ── */
  function partnerHtml(v){
    var ro = v.state === 'paid', ED = !!_vb.edit && !ro, t = v.totals || {}, open = opened();
    var vans = v.vans || [];
    var vanOf = function(id){ return vans.filter(function(q){ return q.id === id; })[0] || null; };
    var vname = function(id){ var x = vanOf(id); return (x && x.name) || id; };
    /* legacy IN(): empty → type at once · has a figure → read-only until ✎ แก้ไข · paid → read-only */
    var IN = function(call, data, val, w, neg, k){
      var has = val != null && val !== '' && n(val) !== 0, txt = has ? ((neg ? '-' : '') + val) : '';
      if(ro || !(ED || !has || open[k])) return '<span class="vb-ro' + (neg ? ' neg' : '') + '" style="min-width:' + w + 'px">' + esc(txt) + '</span>';
      return '<input value="' + esc(txt) + '" onchange="' + call + '" ' + data + ' data-vbk="' + esc(k) + '" class="vb-in' + (neg ? ' neg' : '') + '" style="width:' + w + 'px">';
    };
    var head = _vb.van ? vanOf(_vb.van) : null;
    var whoName = head ? (head.driver || '—') : 'ทุกคันของ ' + v.partner;
    var whoMeta = head ? [head.name || head.id, head.plate || '', (head.capacity || '?') + ' ที่นั่ง', 'โซน ' + (head.zone_base || '-'), head.driver_phone || ''].filter(Boolean).join(' · ')
      : (vans.map(function(x){ return x.name || x.id; }).join(' · ') || '—');
    var vanSel = '<select onchange="vbPick(\'van\',this.value)" class="vb-sel"><option value="">ทุกคันของเจ้านี้ (' + vans.length + ')</option>'
      + vans.map(function(x){ return '<option value="' + esc(x.id) + '"' + (x.id === _vb.van ? ' selected' : '') + '>' + esc(x.name || x.id) + (x.plate ? ' · ' + esc(x.plate) : '') + '</option>'; }).join('') + '</select>';

    var acts;
    if(ED) acts = '<span class="vb-dirty">&#9679; กำลังแก้ไข</span><button class="vb-btn" onclick="vbCancel()">ยกเลิก</button><button class="vb-btn ok" onclick="vbSave()">&#10003; บันทึก</button>';
    else {
      acts = statePill(v.state)
        + (ro ? '<button class="vb-btn" onclick="laOpsVanBills.unpay()">ยกเลิกการจ่าย</button>'
          : (v.sent ? '<button class="vb-btn" onclick="laOpsVanBills.unsend()">ดึงกลับเป็นร่าง</button><button class="vb-btn ok" onclick="laOpsVanBills.pay()">บันทึกว่าจ่ายแล้ว</button>'
            : '<button class="vb-btn" onclick="laOpsVanBills.send()">ส่งให้เจ้าของรถ</button>')
            + '<button class="vb-btn" onclick="vbEdit()">&#9998; แก้ไข</button>')
        + '<button class="vb-btn pri" onclick="vbPrint()">&#128424; พิมพ์ใบวางบิล</button>';
    }
    var sub = ro ? '<b style="color:#0F6E56">บิลนี้จ่ายแล้ว · แก้ไม่ได้จนกว่าจะยกเลิกการจ่าย</b>'
      : (ED ? '<b style="color:#0E6AA8">แก้ได้ทุกช่อง · ทุกช่องบันทึกทันที · กดบันทึกเมื่อตรวจครบ</b>'
        : '<span style="color:#98A2AD">ช่องที่ยังว่าง คีย์ได้เลย บันทึกให้ทันที · ช่องที่มีตัวเลขแล้วกด “แก้ไข” ก่อน</span>');

    var fresh = (v.rows || []).filter(function(r){ return r['new']; });
    var warn = fresh.length ? ('<div class="vb-newrow">&#9888;&#65039; <b>มี ' + fresh.length + ' แถวที่เพิ่งโผล่หลังจากกรอกบิลใบนี้ไปแล้ว</b>'
      + '<span>(' + esc(fresh.slice(0, 4).map(function(r){ return dmy(r.date).slice(0, -3) + ' ' + vname(r.van_id) + (r.return_only ? ' ขากลับ' : ''); }).join(' · '))
      + (fresh.length > 4 ? ' และอีก ' + (fresh.length - 4) : '') + ')</span>'
      + '<span class="m">ยอดเรียกเก็บจึงต่างจากตอนที่บันทึกไว้ · ตรวจก่อนส่งให้เจ้าของรถ</span></div>') : '';

    var settle = '';
    if(v.sent) settle += '<div style="font-size:11px;color:#185FA5;margin-top:3px">ส่งแล้ว ' + esc(text(v.sent.at).slice(0, 10)) + ' · ' + B(v.sent.bill)
      + (v.sent.changed_since_sent ? ' · <b style="color:#A32D2D">ยอดเปลี่ยนหลังส่ง</b>' : '') + '</div>';
    if(v.paid) settle += '<div style="font-size:11px;color:#0F6E56;margin-top:3px">จ่ายแล้ว ' + esc(v.paid.on) + ' · ' + esc(v.paid.via) + (v.paid.ref ? ' · ' + esc(v.paid.ref) : '') + ' · ' + B(v.paid.amount) + '</div>';

    var codes = v.codes || [];
    var setPanel = '<div class="vb-set"><span>ตั้ง <b>ราคาขาย / คน</b> ทั้งรอบ</span>'
      + IN('laOpsVanBills.setPerPax(this.value)', '', v.per_pax, 66, 0, '@perPax') + '<span>บาท</span>'
      + '<span class="vb-hint">→ ระบบคูณจำนวนคนของแต่ละวันให้เอง · แถวไหนคิดต่างแก้เฉพาะแถวได้</span>'
      + '<span style="flex:1"></span><span>เรต / คัน</span>'
      + (codes.length ? codes.map(function(c){
          return '<span class="vb-rt" title="' + esc(codeTh(c.code)) + ' · ' + n(c.rows) + ' เที่ยวในรอบนี้"><span class="c" style="background:' + codeCol(c.code) + '">' + esc(c.code) + '</span>'
            + IN('laOpsVanBills.setCodeRate(this.getAttribute(\'data-code\'),this.value)', 'data-code="' + esc(c.code) + '"', c.rate, 58, 0, '@rate:' + c.code) + '</span>';
        }).join('') : '<span class="vb-mut">ไม่มีงานในรอบนี้</span>')
      + (ro ? '' : '<button class="vb-btn sm" onclick="laOpsVanBills.pullRates()" title="เติมเรตจากที่ตั้งไว้ในหน้า Transfer Fleet · แก้ทับได้">&#8681; ดึงจากเรตรถ</button>')
      + '</div>';

    var body = (v.rows || []).map(function(r){ return rowHtml(r, IN, vname); }).join('');
    var exBody = (v.extra_lines || []).map(function(x){ return extraHtml(x, IN, ED, ro); }).join('');
    var pl = n(t.pl);
    return title(sub)
      + '<div class="vb-bar">' + modeTabs() + partnerSel() + vanSel + segs() + monthNav() + '<span style="flex:1"></span>' + acts + '</div>'
      + warn
      + '<div class="vb-who"><div class="av">' + esc(text((head && head.name) || v.partner).slice(0, 7)) + '</div>'
      + '<div style="flex:1"><div class="n">' + esc(whoName) + ' <span style="font-weight:600;color:#6B7280">(' + esc(v.partner) + ')</span></div>'
      + '<div class="m">' + esc(whoMeta) + '</div></div>'
      + '<div style="text-align:right"><div class="vb-lab">รอบบิล</div>'
      + '<div style="font:800 13.5px \'DM Mono\',monospace">' + esc(v.label) + ' ' + esc(monthTh()) + '</div>' + settle + '</div></div>'
      + setPanel
      + '<div class="vb-kpi">'
      + '<div class="k"><div class="l">จำนวนลูกค้า</div><div class="v">' + n(t.pax) + ' <s>คน</s></div></div>'
      + '<div class="k"><div class="l">จำนวนรถ</div><div class="v">' + n(t.vans) + ' <s>คัน</s></div></div>'
      + '<div class="k"><div class="l">เฉลี่ย</div><div class="v">' + n(t.avg_pax_per_van).toFixed(2) + ' <s>คน/คัน</s></div></div>'
      + '<div class="k bill"><div class="l">ราคาเรียกเก็บ</div><div class="v">' + B(t.bill) + '</div></div>'
      + '<div class="k"><div class="l">ราคาขาย</div><div class="v">' + B(t.sale) + '</div></div>'
      + '<div class="k ' + (pl < 0 ? 'loss' : 'gain') + '"><div class="l">กำไร / ขาดทุน</div><div class="v">' + B(pl) + '</div></div>'
      + '</div>'
      + '<div class="vb-card"><table class="vb-t"><thead><tr>'
      + '<th class="l" style="width:78px">วันที่</th><th class="l" style="min-width:200px">เส้นทาง</th>'
      + '<th class="l" style="min-width:120px">จุดรับ</th><th class="l" style="min-width:110px">จุดส่ง</th>'
      + '<th>AD</th><th>CHD</th><th>INF</th><th>FOC</th><th>คัน</th><th>คน</th>'
      + '<th class="man">เรต/คัน</th><th class="man">EXTRA</th><th class="man">หัก</th>'
      + '<th style="width:92px">ราคาเรียกเก็บ</th><th class="man">ขาย/คน</th>'
      + '<th style="width:86px">ราคาขาย</th><th style="width:92px">กำไร/ขาดทุน</th></tr></thead>'
      + '<tbody>' + (body || '<tr><td colspan="17" style="padding:26px;text-align:center;color:#98A2AD">ไม่มีงานของเจ้านี้ในรอบบิลนี้</td></tr>') + exBody
      + (ro ? '' : '<tr><td colspan="17" class="l" style="padding:9px 8px;background:#F7F8FB">'
        + '<a onclick="laOpsVanBills.addExtra()" style="font-size:11.5px;color:#0E6AA8;font-weight:700;cursor:pointer">+ เพิ่มแถว (รถนอก · งานที่ไม่ได้ผ่านใบงาน)</a></td></tr>')
      + '</tbody>'
      + '<tfoot><tr><td class="l" colspan="4">รวม ' + n(t.vans) + ' เที่ยว</td>'
      + '<td>' + n(t.ad) + '</td><td>' + n(t.chd) + '</td><td>' + n(t.inf) + '</td><td>' + n(t.foc) + '</td>'
      + '<td>' + n(t.vans) + '</td><td>' + n(t.pax) + booked(t.pax, t.booked_pax, true) + '</td>'
      + '<td>—</td><td>' + N(t.ex) + '</td>'
      + '<td style="color:' + (n(t.cut) ? '#FFB4B4' : '#9FB3D8') + '">' + (n(t.cut) > 0 ? '−' + N(t.cut) : '0') + '</td>'
      + '<td class="r">' + B(t.bill) + '</td><td>—</td><td class="r">' + B(t.sale) + '</td>'
      + '<td class="r" style="color:' + (pl < 0 ? '#FF9E9E' : '#9BE6BC') + '">' + B(pl) + '</td></tr></tfoot></table></div>'
      + '<div class="vb-sum">' + codeCards(v.by_code) + extraCard(t)
      + '<div class="vb-sb dark"><div class="t">รวมเรียกเก็บ</div><div class="b">' + B(t.bill) + '</div>'
      + '<div class="s">' + (v.updated_by ? 'แก้ล่าสุด ' + esc(v.updated_by) + (v.updated_at ? ' · ' + esc(text(v.updated_at).slice(0, 10)) : '') : 'ยังไม่ได้กรอก') + '</div>'
      + formula(t) + '</div></div>';
  }
  function rowHtml(r, IN, vname){
    var chips = (r.pickups || []).length ? r.pickups.map(function(a){ return '<span class="vb-area' + (far(a) ? ' far' : '') + '">' + esc(area(a)) + '</span>'; }).join('')
      : '<span class="vb-area">—</span>';
    var drops = (r.drops || []).length ? r.drops.map(function(d){
        var nm = area(d.name), cls = d.changed ? ' alt' : (far(d.name) ? ' far' : '');
        return '<span class="vb-area' + cls + '" title="' + esc(nm) + (d.changed ? ' · ใบนี้ตั้งจุดส่งใหม่ ไม่ใช่ส่งกลับที่รับ' : ' · ส่งกลับที่เดิมของกรุ๊ปนั้น') + '">' + esc(short(nm)) + '</span>';
      }).join('')
      : '<span class="vb-area"' + ((!r.return_only && !n(r.return_bookings) && !n(r.return_same_van)) ? ' title="ไม่ได้รับขากลับ · จบที่ท่าเรือ"' : '') + '>—</span>';
    var dot = function(x){ return n(x) ? n(x) : MUT; };
    var data = 'data-rk="' + esc(r.key) + '"';
    var set = function(f){ return 'laOpsVanBills.setRow(this.getAttribute(\'data-rk\'),\'' + f + '\',this.value)'; };
    var rt = route(r.route_id);
    return '<tr' + (r['new'] ? ' data-new="1" style="background:#FFF8EC"' : '') + '>'
      + '<td class="l vb-mono">' + esc(dmy(r.date)) + '</td>'
      + '<td class="l"><span class="vb-code" style="background:' + codeCol(r.code) + '">' + esc(r.code) + '</span><span class="vb-rn">' + esc((rt && rt.name) || r.route_id || '—') + '</span>'
      + pierBadge(r.route_id)
      + (r.return_only ? '<span class="vb-pier" style="background:#FFF1E0;color:#9A5B00">&#8629; ขากลับ</span>' : '')
      + ((!r.return_only && n(r.return_bookings)) ? '<span class="vb-pier" style="background:#EEF4F9;color:#4A6274" title="คันนี้รับขากลับให้อีก ' + n(r.return_bookings) + ' ใบด้วย · เป็นรอบเดียวกัน ไม่คิดเพิ่ม">&#8629; รับกลับด้วย ' + n(r.return_pax) + ' คน</span>' : '')
      + ((!r.return_only && n(r.return_same_van)) ? '<span class="vb-pier" style="background:#F1F4F7;color:#5B6570" title="ใบนี้ติ๊ก \'กลับคันเดิม\' ' + n(r.return_same_van) + ' ใบ · รถคันเดิมพาคนของตัวเองกลับ ไม่คิดเพิ่ม">&#8629; พากลับเอง</span>' : '')
      + (_vb.van ? '' : '<div style="font-size:10px;color:#98A2AD;margin-top:2px">' + esc(vname(r.van_id)) + '</div>') + '</td>'
      + '<td class="l">' + chips + '</td><td class="l">' + drops + '</td>'
      + '<td><b>' + n(r.ad) + '</b></td><td>' + dot(r.chd) + '</td><td>' + dot(r.inf) + '</td><td>' + dot(r.foc) + '</td>'
      + '<td><b>1</b></td>'
      + (r.return_only
        ? '<td><span class="vb-mut">—</span><div class="vb-sub" title="ลูกค้ากลุ่มเดิมจากขาไป · คิดเฉพาะค่ารถ ไม่คิดฝั่งขายซ้ำ">' + n(r.return_pax) + ' คนกลับ</div></td>'
        : '<td><b>' + n(r.pax) + '</b>' + booked(r.pax, r.booked_pax) + '</td>')
      + '<td>' + IN(set('rate'), data, r.rate, 58, 0, r.key + '|rate') + '</td>'
      + '<td>' + IN(set('ex'), data, r.ex, 50, 0, r.key + '|ex') + '</td>'
      + '<td>' + IN(set('cut'), data, r.cut, 52, 1, r.key + '|cut') + '</td>'
      + '<td class="r"><b>' + B(r.bill) + '</b></td>'
      + '<td>' + IN(set('per'), data, r.per_pax, 50, 0, r.key + '|per') + '</td>'
      + '<td class="r">' + (r.return_only ? '<span class="vb-mut">—</span><div class="vb-sub">ค่ารถอย่างเดียว</div>'
        : '<b>' + B(r.sale) + '</b><div class="vb-sub">' + n(r.pax) + ' × ' + N(r.per_pax) + '</div>') + '</td>'
      + '<td class="r" style="font-weight:800;color:' + (n(r.pl) < 0 ? '#A32D2D' : '#0F6E56') + '">' + B(r.pl) + '</td></tr>';
  }
  function extraHtml(x, IN, ED, ro){
    var k = function(f){ return 'x' + x.id + '|' + f; };
    var data = 'data-x="' + esc(x.id) + '"';
    var set = function(f){ return 'laOpsVanBills.setExtra(this.getAttribute(\'data-x\'),\'' + f + '\',this.value)'; };
    var free = function(f){ return !ro && (ED || !!opened()[k(f)]); };
    return '<tr class="vb-ex">'
      + '<td class="l">' + (free('date') ? '<input type="date" value="' + esc(x.date || '') + '" onchange="' + set('date') + '" ' + data + ' data-vbk="' + esc(k('date')) + '" class="vb-din">'
        : '<span class="vb-mono">' + esc(x.date ? dmy(x.date) : '—') + '</span>') + '</td>'
      + '<td class="l" colspan="3">' + (free('note') ? '<input value="' + esc(x.note || '') + '" onchange="' + set('note') + '" ' + data + ' data-vbk="' + esc(k('note')) + '" class="vb-tin" placeholder="รถนอก · งานที่ไม่ได้ผ่านใบงาน">'
        : '<span class="vb-rn">' + esc(x.note || 'รถนอก') + '</span>') + '</td>'
      + '<td colspan="4" class="vb-mut">กรอกเอง</td>'
      + '<td>' + IN(set('vans'), data, x.vans, 40, 0, k('vans')) + '</td>'
      + '<td>' + IN(set('pax'), data, x.pax, 44, 0, k('pax')) + '</td>'
      + '<td>' + IN(set('rate'), data, x.rate, 58, 0, k('rate')) + '</td>'
      + '<td>' + IN(set('ex'), data, x.ex, 50, 0, k('ex')) + '</td>'
      + '<td>' + IN(set('cut'), data, x.cut, 52, 1, k('cut')) + '</td>'
      + '<td class="r"><b>' + B(x.bill) + '</b></td>'
      + '<td>' + IN(set('per_pax'), data, x.per_pax, 50, 0, k('per_pax')) + '</td>'
      + '<td class="r"><b>' + B(x.sale) + '</b></td>'
      + '<td class="r">' + (ED ? '<a onclick="laOpsVanBills.delExtra(this.getAttribute(\'data-x\'))" ' + data + ' style="color:#A32D2D;cursor:pointer;font-weight:700">ลบ</a>' : '') + '</td></tr>';
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
  function draw(v){ paint(shell(_vb.mode === 'ov' ? overviewHtml(v) : partnerHtml(v))); }
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
    var key = viewKey(), hit = cache[key];
    if(hit){ draw(hit.view); if(_vb.mode === 'ov') loadVanNames(); if(Date.now() - hit.at < TTL) return; }
    else drawLoading();
    load(key).then(function(v){
      if(viewKey() === key && (!hit || JSON.stringify(hit.view) !== JSON.stringify(v))) draw(v);
    }, function(e){ if(viewKey() === key && !hit) drawError(e); else O.fail('Van bills could not refresh', e); });
    if(_vb.mode === 'ov') loadVanNames();
  }

  /* ── writes · server first: the screen shows the server's answer, or goes back ── */
  function current(){ var h = cache[viewKey()]; return h ? h.view : null; }
  function drop2(){ Object.keys(cache).forEach(function(k){ if(k.indexOf('/v1/van-bills?') === 0) delete cache[k]; }); }   // overview is stale now
  /* the answer is the whole bill of that address; a one-van filter is not what a write answers: refetch */
  function answered(addr, onOk){
    return function(v){
      if(_vb.van || addr !== address()){ drop(); if(v && v.partner) bills[addr] = v; } else { drop2(); put(addr, v); }
      if(onOk) onOk(v);
      render(); return v;
    };
  }
  function refused(title){ return function(e){ O.fail(title, e); render(); return null; }; }
  /* body(view) is built when the write runs, from the latest answer, so two quick edits both land */
  function patch(body, title, addr, onOk){
    addr = addr || address();
    return O.queue(function(){
      return O.patch(addr, typeof body === 'function' ? body(bills[addr] || current() || {}) : body);
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
  function lines(v){ return ((v && v.extra_lines) || []).map(function(x){ return clone(x); }); }
  function addExtra(){
    var cur = current(); if(!cur) return;
    var before = {}; (cur.extra_lines || []).forEach(function(x){ before[x.id] = 1; });
    // legacy vbAddExtra: dated the first day of the period, noted "รถนอก", one van
    return patch(function(v){
      var l = lines(v); l.push({ date: v.from || null, note: 'รถนอก', vans: 1, pax: 0, rate: 0, ex: 0, cut: 0, per_pax: 0 });
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
      extra_lines: lines(v).map(function(x){ return { id: x.id, date: x.date, note: x.note, vans: x.vans, pax: x.pax, rate: x.rate, ex: x.ex, cut: x.cut, per_pax: x.per_pax }; }) };
  }
  function endEdit(){ _vb.edit = 0; _vb.snap = null; snap = null; _vb.open = {}; _vb.foc = ''; }
  function edit(){
    var addr = address(), v = bills[addr] || current(); if(!v || !v.rows || v.state === 'paid') return;
    snap = { addr: addr, body: inputs(v) };
    _vb.edit = 1; _vb.open = {}; _vb.foc = ''; render();
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

  window.laOpsVanBills = { render: render, setRow: setRow, setCodeRate: setCodeRate, setRate: setRate, setPerPax: setPerPax,
    addExtra: addExtra, setExtra: setExtra, delExtra: delExtra, save: save, pullRates: pullRates, send: send, unsend: unsend,
    pay: pay, unpay: unpay, originals: originals };
})();
