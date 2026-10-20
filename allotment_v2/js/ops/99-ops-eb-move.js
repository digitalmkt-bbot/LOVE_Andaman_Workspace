/* ════════════════════════════════════════════════════════════════════════
   §opsEbMove (2026-10-20) · FE-3e · Executive Board · มูฟเมนต์ (boat board) on the server's answer
   GET /v1/exec-board/movement?date=&pier=     (date default = tomorrow, Bangkok; pier '' = all)
   Ports legacy viewMove / mvRow / mvVarTable / zgChips (11-exec-board.js §execMove): the boat cards of the day, the AD/CHD/INF/FOC
   variant table, Booking Movement · Today, the next 7 days and "boats to help". Every figure is the answer's (rows[], totals, summary,
   variants[], today, next7, help[]). The fold state of the variant table stays in this browser (localStorage eb_mv_fold), as legacy.
   Replaces window.ebMvFold / ebMvFoldAll. Classic script · after 99-ops-exec-board.js.
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O || !O.eb) return;
  var X = O.eb, E = X.E, num = X.num, baht = X.baht, thD = X.thD, thDow = X.thDow, hhmm = X.hhmm, src = X.src, liveTag = X.liveTag;
  var EB = window._eb;
  var L0 = { ebMvFold: window.ebMvFold, ebMvFoldAll: window.ebMvFoldAll };
  var ZG_LBL = { PK: 'Phuket', KL: 'Khao Lak', RN: 'Ranong', NT: 'Own transport', O: 'Other' };
  var ZG_COL = { PK: '#1683C7', KL: '#2BB673', RN: '#7C3AED', NT: '#C9CFD9', O: '#9CA3AF' };
  var MVC_KEY = 'eb_mv_fold';

  function zgChips(z){
    var ks = ['PK', 'KL', 'RN', 'NT', 'O'].filter(function(k){ return z && z[k] > 0; });
    if(!ks.length) return '';
    return ks.map(function(k){ return '<span style="color:' + (k === 'NT' || k === 'O' ? 'var(--eb-mut)' : ZG_COL[k]) + ';font-weight:600">' + E(ZG_LBL[k]) + ' ' + num(z[k]) + '</span>'; }).join(' · ');
  }
  function mvFold(){ if(!EB.mvc){ var o = {}; try{ o = JSON.parse(localStorage.getItem(MVC_KEY) || '{}') || {}; }catch(_){ o = {}; } EB.mvc = o; } return EB.mvc; }
  function mvFoldSave(){ try{ localStorage.setItem(MVC_KEY, JSON.stringify(EB.mvc || {})); }catch(_){} }
  window.ebMvFold = function(fid){
    if(!O.enabled()) return L0.ebMvFold ? L0.ebMvFold.apply(this, arguments) : undefined;
    var F = mvFold(); if(F[fid]) delete F[fid]; else F[fid] = 1; mvFoldSave(); X.keepRender(true);
  };
  window.ebMvFoldAll = function(fold){
    if(!O.enabled()) return L0.ebMvFoldAll ? L0.ebMvFoldAll.apply(this, arguments) : undefined;
    var F = mvFold(); Object.keys(F).forEach(function(k){ delete F[k]; }); if(fold) (EB._mvFams || []).forEach(function(k){ F[k] = 1; }); mvFoldSave(); X.keepRender(true);
  };
  function mvTint(hex, a){ var h = String(hex || '#8b909c').replace('#', ''); if(h.length === 3) h = h.replace(/(.)/g, '$1$1'); var n = parseInt(h, 16); if(isNaN(n)) n = 0x8b909c;
    var c = [n >> 16 & 255, n >> 8 & 255, n & 255].map(function(x){ return Math.round(x + (255 - x) * a); }); return 'rgb(' + c.join(',') + ')'; }
  function mvShade(hex, a){ var h = String(hex || '#8b909c').replace('#', ''); if(h.length === 3) h = h.replace(/(.)/g, '$1$1'); var n = parseInt(h, 16); if(isNaN(n)) n = 0x8b909c;
    var c = [n >> 16 & 255, n >> 8 & 255, n & 255].map(function(x){ return Math.round(x * a); }); return 'rgb(' + c.join(',') + ')'; }
  function tsAgo(ts){ var m = Math.round((Date.now() - ts) / 60000); if(m < 60) return m + ' นาที'; var h = Math.round(m / 60); if(h < 24) return h + ' ชม.'; return Math.round(h / 24) + ' วัน'; }
  var MON_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function dateLblEn(ds){ var t0 = X.today(); if(ds === t0) return 'Today'; if(ds === X.addDays(t0, 1)) return 'Tomorrow'; var d = X.dt(ds); return d.getDate() + ' ' + MON_EN[d.getMonth()]; }
  function nameOf(o){ return o.family + (o.variant ? ' ' + o.variant : ''); }

  function mvVarTable(V, totals){
    var K = ['ad', 'chd', 'inf', 'foc'], sum = function(P){ return P.ad + P.chd + P.inf + P.foc; };
    if(!V.length) return '';
    var FD = mvFold(), multi = V.filter(function(A){ return A.variants.length > 1; }).map(function(A){ return A.family_id; }); EB._mvFams = multi;
    var anyOpen = multi.some(function(k){ return !FD[k]; });
    var cells = function(P, add){ return K.map(function(k){ return '<td class="' + (P[k] ? '' : 'z') + '">' + num(P[k]) + '</td>'; }).join('')
      + '<td class="sum">' + num(sum(P)) + '</td><td class="add' + (add ? '' : ' z') + '">' + (add ? '+' + num(add) : '0') + '</td>'; };
    var nV = 0;
    var body = V.map(function(A){ var c = A.color || '#8b909c', one = A.variants.length === 1, fold = !one && !!FD[A.family_id]; nV += A.variants.length;
      var o0 = A.variants[0], sub = one ? ((o0.label || '') + (o0.departure ? ' · ' + o0.departure : '') + (o0.charter ? ' · เหมาลำ' : '')) : (A.variants.length + ' variant');
      if(one && o0.label === A.name) sub = (o0.departure || '') + (o0.charter ? ' · เหมาลำ' : '');
      var h = '<tr class="fam' + (one ? '' : ' tg') + (fold ? ' fold' : '') + '" data-fam="' + E(A.family_id) + '" style="background:' + mvTint(c, .9) + ';color:' + mvShade(c, .62) + '"'
        + (one ? '' : ' onclick="ebMvFold(\'' + E(A.family_id) + '\')" title="' + (fold ? 'กางดู variant' : 'ยุบ') + '"') + '>'
        + '<td>' + (one ? '<span class="cv"></span>' : '<span class="cv">' + (fold ? '▸' : '▾') + '</span>') + '<span class="sw" style="background:' + E(c) + '"></span>' + E(A.name) + (sub ? '<span class="vn">' + E(sub) + '</span>' : '') + '</td>' + cells(A.px, A.added) + '</tr>';
      if(!one && !fold) h += A.variants.map(function(o){
        return '<tr class="var" data-rid="' + E(o.route_id) + '"><td>' + E(o.label) + (o.departure ? '<span class="dep">' + E(o.departure) + '</span>' : '') + (o.charter ? '<span class="tag">เหมาลำ</span>' : '') + '</td>' + cells(o.px, o.added) + '</tr>'; }).join('');
      return h + '<tr class="gap"><td colspan="7"></td></tr>'; }).join('');
    var tAdd = sum(totals.added_px);
    return '<div class="ebm-vt"><div class="hh"><b>ผู้โดยสารแยก Variant</b><span>ตามใบจอง · ' + num(V.length) + ' โปรแกรม · ' + num(nV) + ' variant</span><i></i>'
      + (multi.length ? '<button onclick="ebMvFoldAll(' + (anyOpen ? 1 : 0) + ')">' + (anyOpen ? 'ยุบทั้งหมด' : 'กางทั้งหมด') + '</button>' : '') + '</div>'
      + '<table><thead><tr><th>โปรแกรม · variant</th><th>AD</th><th>CHD</th><th>INF</th><th>FOC</th><th class="sum">รวม</th><th class="add">+วันนี้</th></tr></thead><tbody>' + body
      + '<tr class="tot"><td>รวมทุกโปรแกรม</td>' + cells(totals.px, tAdd) + '</tr></tbody></table></div>';
  }

  function mvRow(o, now){
    var fillPct = o.capacity ? Math.min(100, o.booked * 100 / o.capacity) : 0, st = o.state;
    var col = (st === 'full' || st === 'ch') ? '#047857' : (st === 'be' ? '#DC2626' : (st === 'open' ? '#F59E0B' : '#9CA3AF'));
    var lastTs = o.last ? Date.parse(o.last.at) : 0, anyTs = o.last_booking_at ? Date.parse(o.last_booking_at) : 0;
    var hot = !!(lastTs && (now - lastTs) < 3600000);
    var liveCls = ((st === 'open' || st === 'be') && hot) ? ' ebm-live' : '';
    var bar = st === 'ch' ? '<div class="ebm-fill"><i style="width:100%;background:#047857"></i><em style="color:#fff">' + num(o.booked) + ' คน · เหมาลำ ' + num(o.charter_boats) + ' ลำ</em><b style="color:#fff">' + (o.charter_capacity ? ('จุ ' + num(o.charter_capacity)) : 'เหมา') + '</b></div>'
      : !o.capacity ? '<div class="ebm-fill na"><em>' + num(o.booked) + ' · ไม่จำกัดที่นั่ง</em></div>'
      : '<div class="ebm-fill"><i class="' + liveCls.trim() + '" style="width:' + fillPct + '%;background:' + col + '"></i>' + (liveCls ? '<span class="ebm-scan"></span>' : '') + (o.break_even > 0 && o.capacity ? '<s style="left:' + Math.min(100, o.break_even * 100 / o.capacity) + '%"></s>' : '')
        + '<em style="color:' + (fillPct >= 30 ? '#fff' : '#334155') + '">' + num(o.booked) + ' / ' + num(o.capacity) + '</em><b style="color:' + (fillPct > 88 ? '#fff' : '#334155') + '">' + (o.full ? 'เต็ม' : 'ว่าง ' + num(o.free)) + '</b></div>';
    var boats = o.boats.length ? o.boats.map(function(x){ var c = ''; try{ c = (typeof bookingV2BoatAvatarColor === 'function') ? bookingV2BoatAvatarColor(x.boat_id) : ''; }catch(_){}
      return '<span class="bt"><i style="background:' + (c || o.color || '#8b909c') + '"></i>' + E(x.name) + (x.charter ? ' <small>เหมา</small>' : (o.boats.length > 1 && x.pax ? ' <small>' + num(x.pax) + '</small>' : '')) + '</span>'; }).join('') : '<span class="eb-mut">ยังไม่วางเรือ</span>';
    var last = '';
    if(o.last && lastTs){ var fresh = (now - lastTs) < 3600000;
      last = '<span class="' + (fresh ? 'ebm-new' : 'ebm-old') + '" title="' + E(o.last.agent) + '">' + (fresh ? '<i class="ebm-dot"></i>' : '') + '+' + num(o.last.pax) + ' · ' + hhmm(lastTs) + '</span><small>วันนี้ +' + num(o.added) + ' · ' + num(o.added_agents) + ' เอเยนต์</small>'; }
    else if(st === 'full' || st === 'ch') last = '<span class="ebm-old">—</span><small>' + (anyTs ? 'เต็มแล้ว · ใบล่าสุด ' + thD(X.ymd(new Date(anyTs))) : 'เต็มแล้ว') + '</small>';
    else last = '<span class="ebm-old">—</span><small style="color:' + ((st === 'be' || st === 'open') && anyTs && (now - anyTs) > 4 * 3600000 ? 'var(--eb-bad)' : 'var(--eb-mut)') + '">' + (anyTs ? 'เงียบมา ' + tsAgo(anyTs) : 'ยังไม่มีใบจอง') + '</small>';
    var stH = st === 'ch' ? '<span class="eb-st g">เหมาลำ</span>' : st === 'full' ? '<span class="eb-st g">เต็ม</span>' : (st === 'be' ? '<span class="eb-st b">ต่ำกว่าคุ้มทุน</span>' : (st === 'open' ? '<span class="eb-st w">ยังว่าง</span>' : '<span class="eb-st">ไม่จำกัด</span>'));
    var be = o.break_even > 0 ? ('<span class="eb-num">' + num(o.break_even) + '</span> · ' + (o.booked >= o.break_even ? 'ผ่านแล้ว ✓' : 'ขาดอีก <b style="color:var(--eb-bad)">' + num(o.break_even - o.booked) + '</b>')) : '<span class="eb-mut">—</span>';
    return '<div class="ebm-row' + (st === 'be' ? ' be' : '') + '" data-rid="' + E(o.route_id) + '" data-st="' + st + '">'
      + '<div class="rt" title="' + E((o.departure ? o.departure + ' · ' : '') + String(zgChips(o.zones)).replace(/<[^>]+>/g, '')) + '"><b>' + E(nameOf(o)) + '</b></div>'
      + '<div class="bts">' + boats + '</div>' + bar + '<div class="lst">' + last + '</div><div>' + stH + '</div><div class="bec">' + be + '</div></div>';
  }

  function viewMove(D, EBs){
    var ds = D.date, t0 = X.today(), T = D.totals, S = D.summary, lb = D.label, now = Date.now();
    X.last.moveDate = ds;
    var moodBe = !T.capacity ? '' : (T.below_break_even > 0 ? ('<span style="color:var(--eb-bad);font-weight:700">' + num(T.below_break_even) + ' โปรแกรมต่ำกว่าคุ้มทุน</span>') : (S.all_pass_break_even ? 'ทุกลำผ่านจุดคุ้มทุน' : 'ยังไม่มีข้อมูลจุดคุ้มทุน'));
    var ring = '<div class="ebm-ring" style="background:conic-gradient(#16A34A 0 ' + D.pct + '%, #E5E7EB ' + D.pct + '% 100%)"><div><b>' + (T.capacity ? D.pct + '%' : '—') + '</b><small>ขายได้</small></div></div>';
    var vy = S.vs_yesterday;
    var head = '<div class="ebm-head">'
      + '<div class="ebm-date"><div class="k"><span>' + E(String(lb.th).toUpperCase()) + '</span>' + liveTag() + '</div><div class="big">' + E(lb.full_th) + '</div><div class="sub">' + E(lb.full_en) + ' · ' + num(S.boats) + ' ลำออก · ' + num(D.piers.length) + ' ท่า</div>'
      + '<div class="nav"><button onclick="ebSet(\'mvd\',\'prev\')" aria-label="วันก่อนหน้า">‹</button><button onclick="ebSet(\'mvd\',\'next\')" aria-label="วันถัดไป">›</button>'
      + (lb.key !== 'tomorrow' ? '<button onclick="ebSet(\'mvd\',\'tm\')">พรุ่งนี้</button>' : '') + (lb.key !== 'today' ? '<button onclick="ebSet(\'mvd\',\'td\')">วันนี้</button>' : '') + '</div></div>'
      + '<div class="ebm-mid"><div class="ebm-mood">' + ring + '<div><div class="n"><b>' + num(S.boats_full) + '</b><span> / ' + num(S.boats) + ' ลำเต็ม</span></div><div class="s">' + E(S.mood) + (S.mood && moodBe ? ' · ' : '') + moodBe + '</div>'
      + (vy ? '<div class="c ' + (vy.up ? 'up' : 'dn') + '">' + (vy.up ? '▲' : '▼') + ' เมื่อวานเวลาเดียวกัน ' + vy.pct + '%</div>' : '')
      + '</div></div>'
      + '<div class="ebm-stats">'
      + '<div><div class="l">เข้ามาวันนี้</div><div class="v" style="color:#15803D">+' + num(T.added) + '</div><div class="d">' + num(T.added_bookings) + ' ใบ · ' + baht(T.added_value) + '</div><div class="d">' + (zgChips(T.added_zones) || '<span class="eb-mut">ยังไม่มี</span>') + '</div></div>'
      + '<div><div class="l">ยกเลิก / เลื่อนออก</div><div class="v" style="color:' + (T.cancelled_pax ? 'var(--eb-bad)' : 'var(--eb-ink)') + '">' + (T.cancelled_pax ? '−' + num(T.cancelled_pax) : '0') + '</div><div class="d">' + num(T.cancelled_bookings) + ' ใบ วันนี้</div></div>'
      + '<div><div class="l">รายได้ยืนยันแล้ว</div><div class="v">' + baht(T.revenue) + '</div><div class="d">' + (T.added_value ? '<span style="color:#15803D;font-weight:600">▲ ' + baht(T.added_value) + '</span> วันนี้' : '') + (T.break_even ? ' · คุ้มทุน ' + baht(T.break_even) : '') + '</div></div>'
      + '</div></div>'
      + '<div class="ebm-side">' + (mvVarTable(D.variants, T) || '<div class="eb-none">ยังไม่มีใบจอง</div>') + '</div></div>';
    var byPier = {}, pierOrd = []; D.rows.forEach(function(o){ var p = o.pier || 'other'; if(!byPier[p]){ byPier[p] = []; pierOrd.push(p); } byPier[p].push(o); });
    var pierNm = function(p){ try{ return (typeof laPierName === 'function' && laPierName(p)) || p; }catch(_){ return p; } };
    var cols = '<div class="ebm-cols"><div>เส้นทาง</div><div>เรือ</div><div><span>ที่นั่ง (ขีด = จุดคุ้มทุน)</span><span class="ebm-livek"><i class="ebm-dot"></i>มีใบเข้าใน 1 ชม.</span></div><div>ล่าสุด</div><div>สถานะ</div><div>คุ้มทุน</div></div>';
    var body = pierOrd.map(function(p){ var L = byPier[p], f = L.reduce(function(s, o){ return s + o.boats_full; }, 0), n = L.reduce(function(s, o){ return s + o.boats_total; }, 0);
      return '<div class="ebm-pier"><span>' + E(String(pierNm(p)).toUpperCase()) + '</span><span class="eb-st ' + (f === n ? 'g' : 'w') + '">เต็ม ' + num(f) + '/' + num(n) + '</span></div>'
        + L.map(function(o){ return mvRow(o, now); }).join(''); }).join('');
    if(!D.rows.length) body = '<div class="eb-none">ไม่มีเรือออกวันนี้' + (EBs.pier ? ' ที่ท่านี้' : '') + '</div>';
    var legend = '<div class="eb-foot" style="padding:8px 26px 14px">เขียว = เต็ม · เหลือง = ยังว่างแต่ผ่านคุ้มทุน · แดง = ยังไม่ถึงจุดคุ้มทุน · ลายวิ่ง = มีใบจองเข้าภายใน 1 ชม. · ขีดดำในแถบ = จุดคุ้มทุนของโปรแกรม (จาก Trip P&amp;L · เฉพาะ 7 วันข้างหน้า)</div>';
    var boat = '<div class="eb-card ebm-card" id="ebm-boats">' + head + cols + body + legend + '</div>';

    /* Booking Movement · Today (EN) */
    var M = D.today, z = M.zones;
    var hrsAll = M.hours, mx = Math.max.apply(null, [1].concat(hrsAll.map(function(h){ return h.pax; })));
    var H = hrsAll.slice(6, 23), nowH = M.now_hour;
    var bars = '<div class="ebm-hrs">' + H.map(function(h){ var tot = h.pax; var sg = ['PK', 'KL', 'RN', 'NT', 'O'].filter(function(k){ return h[k] > 0; });
        return '<div class="' + (h.hour === nowH ? 'on' : '') + '" title="' + E(String(h.hour).padStart(2, '0') + ':00 · ' + tot + ' seats') + '">' + (tot ? '<b>' + tot + '</b>' : '') + sg.map(function(k){ return '<i style="height:' + Math.max(2, Math.round(h[k] * 88 / mx)) + 'px;background:' + ZG_COL[k] + '"></i>'; }).join('') + '</div>'; }).join('') + '</div>'
      + '<div class="ebm-hx">' + H.map(function(h){ return '<span>' + String(h.hour).padStart(2, '0') + '</span>'; }).join('') + '</div>'
      + '<div class="ebm-lg">' + ['PK', 'KL', 'NT'].map(function(k){ return '<span><i style="background:' + ZG_COL[k] + '"></i>' + ZG_LBL[k] + '</span>'; }).join('') + (z.RN ? '<span><i style="background:' + ZG_COL.RN + '"></i>Ranong</span>' : '') + '</div>';
    var feed = M.feed.length ? '<div class="ebm-feed">' + M.feed.slice(0, 8).map(function(x){
        return '<div class="r"><span class="t">' + (x.time || '—') + '</span><span class="w"><b>' + E(x.agent) + '</b><span> · ' + E(x.family + (x.variant ? ' ' + x.variant : '')) + (x.kind === 'cancelled' ? ' · <span style="color:var(--eb-bad);font-weight:600">cancelled</span>' : '') + ' · <span style="color:' + (x.zone === 'NT' || x.zone === 'O' ? 'var(--eb-mut)' : ZG_COL[x.zone]) + ';font-weight:600">' + E(ZG_LBL[x.zone]) + '</span></span>'
          + '<span class="' + (x.b2c ? 'sl on' : 'sl') + '">' + (x.b2c ? 'Online' : 'Sales · ' + E(x.sales_name || '—')) + '</span></span>'
          + '<span class="p" style="color:' + (x.kind === 'cancelled' ? 'var(--eb-bad)' : '#15803D') + '">' + (x.kind === 'cancelled' ? '−' : '+') + num(x.pax) + '</span><span class="d">' + E(dateLblEn(x.service_date)) + '</span></div>'; }).join('') + '</div>'
      : '<div class="eb-none">No bookings received today yet</div>';
    var move = '<div class="eb-card" id="ebm-move"><h2>Booking Movement · Today <span class="eb-tag">bookings received today · all travel dates</span>' + src(num(M.bookings) + ' bookings · ' + num(M.pax) + ' seats · ' + baht(M.value)) + '</h2>'
      + '<div class="ebm-zt"><span><b style="color:' + ZG_COL.PK + '">' + num(z.PK) + '</b> Phuket</span><span><b style="color:' + ZG_COL.KL + '">' + num(z.KL) + '</b> Khao Lak</span>' + (z.RN ? '<span><b style="color:' + ZG_COL.RN + '">' + num(z.RN) + '</b> Ranong</span>' : '') + '<span><b style="color:var(--eb-mut)">' + num(z.NT + z.O) + '</b> Own transport</span><span class="eb-sp"></span>'
      + (M.pax ? '<span class="eb-mut">Phuket share ' + M.pk_share + '%' + (M.week_has_data ? ' · last week ' + M.pk_share_week + '%' : '') + '</span>' : '') + '</div>' + bars + feed + '</div>';

    /* 7 วัน */
    var days = '<div class="eb-card" id="ebm-7"><h2>7 วันข้างหน้า <span class="eb-tag">ที่นั่งขายได้</span>' + src('เป้า 90%') + '</h2><div class="ebm-days">'
      + D.next7.map(function(d){ var c = d.capacity ? (d.pct >= 85 ? 'g' : (d.pct >= 60 ? 'w' : 'b')) : 'n';
        return '<button class="d ' + c + (d.date === ds ? ' cur' : '') + '" onclick="ebSet(\'mvd\',\'' + d.date + '\')" title="' + E(thDow(d.date) + ' ' + X.dt(d.date).getDate()) + '"><span class="dw">' + E(thDow(d.date).replace('วัน', '')) + '</span><span class="dd">' + X.dt(d.date).getDate() + '</span><span class="pc">' + (d.capacity ? d.pct + '%' : '—') + '</span><span class="br"><i style="width:' + (d.capacity ? d.pct : 0) + '%"></i></span><span class="m">' + (d.boats ? num(d.boats) + ' ลำ · เต็ม ' + num(d.boats_full) : 'ไม่มีเรือ') + '</span></button>'; }).join('') + '</div></div>';
    var HC = { below_break_even: 'b', open: 'w', weak_days: 'w' };
    var helpH = '<div class="eb-card" id="ebm-help"><h2>ลำที่ต้องช่วย <span class="eb-tag">ก่อนเรือออก</span></h2>'
      + (D.help.length ? D.help.map(function(h){ return '<div class="ebm-hr"><i class="' + (HC[h.kind] || 'w') + '"></i><span><b>' + E(h.title) + '</b><small>' + E(h.detail) + '</small></span><button onclick="ebSet(\'tab\',\'gap\')">Gap to Target →</button></div>'; }).join('') : '<div class="eb-none">ไม่มี · ทุกลำเต็มหรือผ่านคุ้มทุนแล้ว</div>') + '</div>';
    return boat + '<div class="eb-grid eb-r3">' + move + '<div style="display:flex;flex-direction:column;gap:12px;min-width:0">' + days + helpH + '</div></div>';
  }

  O.eb.views.move = {
    path: function(EBs){ return ['/v1/exec-board/movement', { date: EBs.mvd && /^\d{4}-\d{2}-\d{2}$/.test(String(EBs.mvd)) ? EBs.mvd : '', pier: EBs.pier || '' }]; },
    draw: viewMove
  };
})();
