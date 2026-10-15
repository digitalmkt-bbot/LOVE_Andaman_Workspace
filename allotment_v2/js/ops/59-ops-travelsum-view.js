/* ══════════════════════════════════════════════════════════════════════════
   §opsTravelView · Travel Summary (สรุปการเดินทางประจำวัน) drawn from operation-backend
   ──────────────────────────────────────────────────────────────────────────
   The screen looks and reads like legacy renderTravelSum (§tsV6): the navy bar with
   VAT tabs, day navigation, calendar, print and the pier › route chips; the headline
   card with its checklist; 01 ภาพรวมของวัน · 02 ตัดสินค่าปรับ · 03 เงินที่เก็บหน้างาน ·
   04 Manifest. The legacy builders that only lay out numbers they are given
   (tsV6Head, tsV6Overview, tsV6Money, tsCSS, tsCSSv6, tsManColsHtml, tsManApply,
   tsPrintSheet's tsDocCompose) are reused as they are, so the skins and the print
   sheet keep working. Every figure comes from the server:

     GET /v1/reports/travel-summary?date=D   day totals + money rows   (33 loads it, laOps.moneyReports.loadTravel)
     GET /v1/bookings?service_date=D         the roster, scope, pax grid, pickup, boat, documents
     GET /v1/after-trip?date=D               per booking: trip price, COT + no-show decisions, version
                                             (both read by 57, laOps.travelRows)

   The browser only counts and groups server rows. Where the server gives the whole
   day only (head counts per pier / route / VAT, which bookings are no-show cases,
   moved-out bookings), the screen says so instead of guessing; see NEEDS-SERVER-WORK
   in the 2026-10-15 travelsum-parity report (HANDOFF-BACKEND B17).
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var last = {};                                  // date -> the summary last drawn (cleared on any write)

  function text(v){ return v == null ? '' : String(v); }
  function esc(v){ return text(v).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function n(v){ return Number.isFinite(+v) ? +v : 0; }
  function money(v){ return '฿' + Number(v || 0).toLocaleString('en-US'); }
  function g(name){ return typeof window[name] === 'function' ? window[name] : null; }
  function call(name, args, dflt){ var f = g(name); try{ return f ? f.apply(null, args || []) : dflt; }catch(_){ return dflt; } }
  function q(v){ return text(v).replace(/[^A-Za-z0-9_\-]/g, ''); }
  function sortAZ(a, b){ return text(a).localeCompare(text(b), 'en', { numeric: true, sensitivity: 'base' }); }
  function dateOf(){ var d = text(window._tsDate); return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : O.today(); }

  /* ── small lookups into what the app already holds (routes, boats, agents: all server-mapped) ── */
  function routeName(id){ return call('tsRouteName', [id], id || '—'); }
  function routeColor(id){ return call('tsRouteColor', [id], '#8b909c'); }
  function pierOf(id){ return call('tsPierOf', [id], 'other'); }
  function agent(id){ return id ? call('sbGetAgent', [id], null) : null; }
  function agName(b){ var a = agent(b.agent_id); return a ? (a.name || a.code || '—') : text(b.source === 'b2c' ? 'B2C' : (b.channel || 'walk-in')); }
  function agChip(b){
    var legacy = { id: b.external_id || b.id, agentId: b.agent_id || '', channel: b.channel || '' };
    var mark = call('laAgencyMark', [legacy, 16, { pad: '5px 7px', margin: false }], '');
    if(mark) return mark;
    var col = b.agent_id ? call('bookingV2AgentColor', [b.agent_id], '#64748B') : '#64748B';
    var ink = call('bookingV2ContrastInk', [col], '#fff');
    return '<span class="ts-ag" style="background:' + esc(col) + ';color:' + esc(ink) + '" title="' + esc(agName(b)) + '">' + esc(agName(b)) + '</span>';
  }
  function boatName(id){ var bt = id ? call('getBoat', [id], null) : null; return id ? ((bt && bt.name) || id) : ''; }
  var VANS = {};                                  // van id -> name, from GET /operations/vans (57)
  function vanName(id){ if(!id) return ''; if(VANS[id]) return VANS[id]; var v = call('vehGet', [id], null); return (v && v.name) || id; }
  function vanOf(t){
    var ops = (t && t.operations) || {}, parts = ops.van_parts || [], p = parts[0] || null, gr = p && p.group;
    if(t && t.ovn_leg) return (p && p.return_van_id) || (gr && (gr.return_van_id || gr.van_id)) || '';
    return (gr && gr.van_id) || '';
  }
  function boatOf(t){ var ops = (t && t.operations) || {}; return ops.boat_id || (t && t.charter_boat_id) || ''; }
  /* The booked pax grid by category (ad_fr + ad_th → AD …): a display grouping of the server's own grid. */
  function paxBreak(pax){
    var out = { ad: 0, chd: 0, inf: 0, foc: 0 };
    Object.keys(pax || {}).forEach(function(k){ var c = k.split('_')[0]; if(out[c] != null) out[c] += n(pax[k]); });
    return out;
  }
  function who(pb){
    return [['ad','AD'],['chd','CHD'],['inf','INF'],['foc','FOC']].filter(function(k){ return n(pb && pb[k[0]]) > 0; }).map(function(k){ return n(pb[k[0]]) + ' ' + k[1]; }).join(' · ');
  }
  /* The live (not undone) no-show / on-site cancel events the van and the pier recorded on the trip. */
  function liveEvents(t){
    var ck = (t && t.operations && t.operations.checkins) || {}, out = [];
    ['van', 'pier'].forEach(function(k){ (ck[k] || []).forEach(function(r){ (r && r.events || []).forEach(function(x){ if(x && !x.undone && n(x.pax) > 0) out.push(x); }); }); });
    return out;
  }
  function shortCount(t){
    var ck = (t && t.operations && t.operations.checkins) || {};
    return ['van', 'pier'].some(function(k){ return (ck[k] || []).some(function(r){ return r && r.checked_in_at && r.actual_pax != null && n(r.actual_pax) < n(r.expected != null ? r.expected : t.pax_total); }); });
  }
  function docSt(b){ var s = b.doc_check_status || (b.doc_check && b.doc_check.status) || ''; return s || ((b.attachments || []).length ? 'pending' : 'nofiles'); }

  /* ── one row per live booking of the day, joined to its money row and its decisions ── */
  function rowsOf(S, V){
    var cMap = {}; (S.collect_rows || []).forEach(function(c){ cMap[c.booking_id] = c; });
    // Whole day travelled = booked with no no-show or on-site cancel: then every booking travelled in full.
    var clean = n(S.no_show) + n(S.cxl) === 0 && n(S.travelled) === n(S.booked);
    var anyCase = n(S.noshow && S.noshow.cases) > 0;
    function mk(r, cxlRow){
      var a = V.after ? (V.after[r.id] || null) : null, cot = a && a.cot, dec = cot && cot.decision || null, ns = a && a.noshow || null;
      var c = cxlRow ? null : (cMap[r.id] || null), booked = n(r.t.pax_total), ev = cxlRow ? [] : liveEvents(r.t);
      var isCase = !cxlRow && anyCase && (!!ns || ev.length > 0 || shortCount(r.t));
      return {
        id: r.id, b: r.b, t: r.t, routeId: r.routeId, voucher: r.b.voucher_ref || '—', a: a, c: c, dec: dec, ns: ns, ev: ev, cxlRow: !!cxlRow,
        booked: booked, trav: cxlRow ? 0 : (clean ? booked : null), pb: paxBreak(r.t.pax), clean: clean,
        amount: a ? n(a.trip_amount) : null, isCase: isCase,
        pend: isCase && !ns,
        due: !!(c && !c.not_counted && n(c.due) > 0),
        cotOpen: !!(c && n(c.cot) > 0 && (!dec || dec.over))
      };
    }
    var cmp = function(x, y){ return sortAZ(routeName(x.routeId), routeName(y.routeId)) || ((x.cxlRow ? 1 : 0) - (y.cxlRow ? 1 : 0)) || sortAZ(agName(x.b), agName(y.b)) || sortAZ(x.b.voucher_ref || '', y.b.voucher_ref || ''); };
    /* Legacy tsMvRows: a booking moved off the day, as it left (route, pax). Counts nothing; its money went with it. */
    function mv(m){
      var b = { id: m.booking_id, external_id: m.code, code: m.code, voucher_ref: m.voucher_ref, agent_id: m.agent_id || '', lead_pax: m.lead_pax, lead_phone: m.lead_phone };
      var why = [m.to_date ? 'เลื่อนไป ' + call('ckDayShortTh', [m.to_date], m.to_date) : 'ย้ายวันออกไป', call('ckShortDay', [m.at], ''), m.by || ''].filter(Boolean).join(' · ');
      return { id: m.booking_id, b: b, t: { route_id: m.route_id || '', pax: m.pax || {}, pax_total: n(m.pax_total), operations: {} }, routeId: m.route_id || '', voucher: m.voucher_ref || '—',
        a: null, c: null, dec: null, ns: null, ev: [], cxlRow: true, mvRow: true, booked: n(m.pax_total), trav: 0, pb: paxBreak(m.pax), clean: clean,
        amount: null, isCase: false, pend: false, due: false, cotOpen: false, mvTo: m.to_date || '', mvWhy: why };
    }
    return { all: V.inScope.map(function(r){ return mk(r, false); }).sort(cmp), cxl: V.cancelled.map(function(r){ return mk(r, true); }),
      mv: (V.moved || []).map(mv), movedListed: !!V.movedListed, cmp: cmp, clean: clean };
  }

  /* ── the figures of the selection: the server's own when the whole day is shown,
        a count / sum of its rows when a pier, route or VAT is chosen ── */
  function figures(S, rows, scoped, clean){
    var m = S.money || {}, cot = S.cot || {}, ns = S.noshow || {};
    if(!scoped) return {
      known: true, nBk: n(S.bookings), booked: n(S.booked), trav: n(S.travelled), ns: n(S.no_show), cxl: n(S.cxl),
      pend: n(ns.pending), charge: n(ns.charged), nPostpone: n(ns.postponed), decided: n(ns.decided), cases: n(ns.cases),
      target: n(m.to_collect), nCollect: n(m.to_collect_bookings), due: n(m.due),
      cotAll: n(cot.total), cotLeft: n(cot.undecided_bookings), cotNo: n(cot.not_collected), nCotNo: n(cot.not_collected_bookings),
      cash: n(m.cash), tf: n(m.transfer), card: n(m.card), tin: n(m.received), fee: n(m.fees), out: n(cot.payout), deduct: n(cot.deduct),
      net: n(m.net), saleDue: n(m.sales_due), sales: n(m.sales), nSale: n(m.sales_count), comm: n(m.commission)
    };
    var F = { known: clean, nBk: rows.length, booked: 0, trav: null, ns: null, cxl: null, pend: 0, charge: 0, nPostpone: 0, decided: 0, cases: 0,
      target: 0, nCollect: 0, due: 0, cotAll: 0, cotLeft: 0, cotNo: 0, nCotNo: 0, cash: 0, tf: 0, card: 0, tin: 0, fee: 0, out: 0, deduct: 0, net: 0, saleDue: 0, sales: 0, nSale: 0, comm: 0 };
    rows.forEach(function(r){
      F.booked += r.booked;
      if(r.isCase){ F.cases++; if(r.ns){ F.decided++; if(r.ns.decision === 'postpone') F.nPostpone++; else F.charge += n(r.ns.amount); } else F.pend++; }
      var c = r.c; if(!c) return;
      var rc = c.received || {};
      F.cash += n(rc.cash); F.tf += n(rc.transfer); F.card += n(rc.card); F.fee += n(c.fees);
      var sl = c.sales || {}; F.saleDue += n(sl.due); F.sales += n(sl.total); F.nSale += n(sl.count); F.comm += n(sl.commission);
      if(!c.not_counted){ F.target += n(c.target); F.due += n(c.due); F.nCollect++; }
      if(n(c.cot) > 0){
        F.cotAll += n(c.cot);
        if(!r.dec || r.dec.over) F.cotLeft++;
        else if(r.dec.mode === 'nocol'){ F.cotNo += n(c.cot); F.nCotNo++; }
        else { F.deduct += n(r.dec.deduct); F.out += n(r.dec.payout); }
      }
    });
    if(clean){ F.trav = F.booked; F.ns = 0; F.cxl = 0; }
    F.tin = F.cash + F.tf + F.card; F.net = Math.max(0, F.tin - F.out);
    return F;
  }

  /* ── the navy bar, the chips and the headline card: legacy tsV6Head on server numbers ── */
  function headHtml(S, V, R, F, date){
    var st = V.state, pMap = {}, pOrder = [], rMap = {}, rOrder = [], clean = R.clean;
    var dayRows = rowsOf(S, { after: V.after, inScope: V.allRows || V.inScope, cancelled: [] }).all;
    dayRows.forEach(function(r){
      var k = r.routeId || '', pk = pierOf(k);
      if(!rMap[k]){ rMap[k] = { n: 0, pax: 0, bk: 0, w: 0 }; rOrder.push(k); }
      if(!pMap[pk]){ pMap[pk] = { n: 0, pax: 0, rt: {}, w: 0 }; pOrder.push(pk); }
      var hv = V.hasVat({ agentId: r.b.agent_id || '' });
      if(st.vat && !(st.vat === 'vat' ? hv : !hv)) return;
      var w = (r.pend || r.due || r.cotOpen) ? 1 : 0;
      rMap[k].n++; rMap[k].bk += r.booked; rMap[k].pax += r.booked; rMap[k].w += w;
      pMap[pk].n++; pMap[pk].pax += r.booked; pMap[pk].rt[k] = 1; pMap[pk].w += w;
    });
    // Travelled per pier / route is known only when the whole day travelled in full (B17 otherwise).
    if(!clean){ Object.keys(pMap).forEach(function(p){ pMap[p].pax = 'จอง ' + pMap[p].pax; }); Object.keys(rMap).forEach(function(k){ rMap[k].pax = '?'; }); }
    var ORDER = ['panwa','tublamu','ranong'], ix = function(p){ var i = ORDER.indexOf(p); return i < 0 ? (p === 'other' ? 9 : 8) : i; };
    pOrder.sort(function(a, b){ return ix(a) - ix(b); });
    var rTotN = rOrder.reduce(function(a, k){ return a + rMap[k].n; }, 0);
    var doc = { verified: 0, issue: 0, pending: 0, nofiles: 0 };
    R.all.forEach(function(r){ var s = docSt(r.b); doc[s] = (doc[s] || 0) + 1; });
    var H = {
      date: date, vat: st.vat, nAll: V.inScope.length, nVat: V.nVat, nNoVat: V.nNoVat, vgap: V.vatGap,
      pOrder: pOrder, pMap: pMap, rOrder: rOrder, rMap: rMap, rTotN: rTotN,
      dayW: { pend: n(S.noshow && S.noshow.pending), due: n(S.money && S.money.due) > 0 ? 1 : 0, cot: n(S.cot && S.cot.undecided_bookings) },
      nBk: F.nBk, booked: F.booked, trav: F.known ? F.trav : F.booked, ns: F.known ? F.ns : 0, cxl: F.known ? F.cxl : 0,
      pend: F.pend, charge: F.charge, target: F.target, nCollect: F.nCollect, due: F.due,
      cotAll: F.cotAll, cotLeft: F.cotLeft, cotNo: F.cotNo, nCotNo: F.nCotNo, doc: doc,
      stamp: call('_tsStamp', [], ''), by: call('laBy', [], '')
    };
    var html = call('tsV6Head', [H, money], '');
    if(!F.known){
      // Head counts of a pier / route / VAT selection on a day with no-shows: the server has them for the whole day only.
      html = html.replace(/(<div class="h4-count" data-tsv6="count">)[\s\S]*?(<\/div>)/, '$1จอง <em>' + F.booked + '</em> คน <small data-ops-ts-needs="b17" style="font-size:12px;font-weight:600;color:#8a6d1a">· เดินทางจริงของชุดนี้ยังไม่มีจากเซิร์ฟเวอร์</small>$2')
        .replace(/(<li data-tschk="bk"[^>]*>)[\s\S]*?(<\/li>)/, '$1<span class="h4-ic">&#10003;</span><span>Booking <b>' + F.nBk + '</b> ใบ &middot; จอง <b>' + F.booked + '</b> คน</span>$2')
        .replace(/(<li data-tschk="ns"[^>]*>)[\s\S]*?(<\/li>)/, '$1<span class="h4-ic warn">!</span><span>No-show &middot; ยกเลิกหน้างาน ของชุดนี้: เซิร์ฟเวอร์ให้เฉพาะทั้งวัน (No-show <b>' + n(S.no_show) + '</b> &middot; ยกเลิก <b>' + n(S.cxl) + '</b>)</span>$2');
    }
    // Pack actions sit beside print, as legacy printed them behind the sheet.
    var packs = '<button class="h4-gh" data-ops-ts-refpack="1" onclick="laOps.travelRows.printPack(\'ref\')" title="พิมพ์เอกสารประกอบของชุดนี้ · ' + V.ref.length + ' ใบ">เอกสาร <b>' + V.nRefFiles + '</b></button>'
      + (V.slipPending
        ? '<button class="h4-gh" data-ops-ts-slippack="1" onclick="laOps.travelRows.slipsLoad()" title="อ่านสลิปของ ' + V.slipPending + ' ใบที่มีเงินเข้า">โหลดสลิป <b>' + V.slipPending + '</b></button>'
        : '<button class="h4-gh" data-ops-ts-slippack="1" onclick="laOps.travelRows.printPack(\'slip\')" title="พิมพ์สลิปการชำระเงินของชุดนี้' + (V.noSlipRows ? ' · ' + V.noSlipRows + ' ใบยังไม่มีสลิป' : '') + '">สลิป <b>' + V.nSlipFiles + '</b></button>');
    html = html.replace('<button class="h4-pri"', packs + '<button class="h4-pri"');
    return html;
  }

  /* ── 01 ภาพรวมของวัน ── */
  function s01Html(F, S){
    var html = call('tsV6Overview', [{ nBk: F.nBk, booked: F.booked, trav: F.known ? F.trav : F.booked, ns: F.known ? F.ns : 0, cxl: F.known ? F.cxl : 0,
      pend: F.pend, charge: F.charge, nPostpone: F.nPostpone, target: F.target, nCollect: F.nCollect }, money], '');
    if(!F.known) html = html.replace(/(data-tsv6="s01"><div>)[\s\S]*?(<\/div><div class="s5-tiles">)/,
      '$1<div class="s5-lb">ผู้โดยสาร &middot; จอง</div><div class="s5-hero"><b>' + F.booked + '</b><span>คนที่จอง</span></div>'
      + '<div class="s5-lg" data-ops-ts-needs="b17"><span>เดินทางจริง · No-show · ยกเลิกหน้างาน ของชุดที่เลือก: เซิร์ฟเวอร์ให้เฉพาะทั้งวัน (เดินทางจริง <b>' + n(S.travelled) + '</b> / ' + n(S.booked) + ')</span></div>$2');
    return '<div class="ts-sec ts-s01"><div class="ts-sech"><div>'
      + '<div class="ts-sect"><span class="ts-sn">01</span>ภาพรวมของวัน</div>'
      + '<div class="ts-secd">ยอดรวมทุกเส้นทางของวันนี้ · ตัวเลขทั้งหมดคิดจากผู้โดยสารที่เดินทางจริงหลังหักคนที่ไม่มา</div></div></div>'
      + html + '</div>';
  }

  /* ── 02 ตัดสินค่าปรับ · ยกเลิก / เลื่อนวัน ── */
  var DEC = { full: ['เก็บเต็ม','g'], partial: ['เก็บบางส่วน','a'], none: ['ไม่ชาร์จ','n'], postpone: ['เลื่อนวัน','p'] };
  function evChips(r){
    var T = window.CK_EVENT_TYPES || {};
    return r.ev.map(function(x){
      var lb = (T[x.type] || T.no_show || { label: x.type === 'cxl' ? 'CXL' : 'No-show' }).label;
      var w = who(x);
      var why = call('ckReasonLabel', [x.reason_code], text(x.reason_code));
      return '<span class="ts-chip ' + (x.type === 'cxl' ? 'a' : 'r') + '" title="' + esc((x.at ? x.at + ' · ' : '') + why + (x.note ? ' · ' + x.note : '')) + '">' + esc(lb) + ' ' + n(x.pax) + (w ? ' · ' + esc(w) : '') + '</span>';
    }).join('') || '<span class="ts-chip r">ไม่ระบุเหตุ</span>';
  }
  function s02Html(R, F, S, V, date, onlyIssue){
    var e = esc, body = '', cases = R.all.filter(function(r){ return r.isCase; });
    cases.slice().sort(function(x, y){ return (x.ns ? 1 : 0) - (y.ns ? 1 : 0); }).forEach(function(r){
      var b = r.b, id = q(r.id), d = q(date), dec = r.ns, amt = r.amount, half = Math.round(n(amt) / 2);
      var why = r.ev.map(function(x){ return call('ckReasonLabel', [x.reason_code], text(x.reason_code)) + (x.note ? ' · ' + x.note : ''); }).filter(Boolean).join(' · ');
      var btn = function(k, lbl, a, fn, cls){ var on = dec && dec.decision === k;
        return '<button class="ts-db ' + (cls || '') + (on ? ' on' : '') + '" data-ops-ts-ns="' + k + '" onclick="' + (fn || ("tsPick('" + id + "','" + d + "','" + k + "'," + a + ")")) + '">' + lbl + '</button>'; };
      body += '<tr class="' + (dec ? '' : 'need') + '">'
        + '<td><span class="ts-vch">' + e(r.voucher) + '</span></td>'
        + '<td>' + agChip(b) + '</td>'
        + '<td><div class="ts-lead">' + e(b.lead_pax || '—') + '</div><div class="ts-tel">' + e(b.lead_phone || '') + '</div></td>'
        + '<td>' + evChips(r) + '</td>'
        + '<td style="max-width:210px;color:var(--zn700)">' + (e(why) || '<span style="color:var(--zn400)">—</span>') + '</td>'
        + '<td class="r ts-mono" style="font-weight:800">' + (amt == null ? '—' : money(amt)) + '<div class="ts-tel" style="font-weight:400;margin-top:3px">จอง ' + e(who(r.pb)) + '</div></td>'
        + '<td class="ts-noprint"><div style="display:flex;flex-wrap:wrap;max-width:310px">'
          + (amt == null ? '' : btn('full', 'เก็บเต็ม ' + money(amt), amt) + btn('partial', '50%', half, null, 'warn'))
          + btn('none', 'ไม่ชาร์จ', 0, null, 'mut')
          + btn('partial', 'ระบุเอง', 0, "tsCustom('" + id + "','" + d + "')", 'warn')
          + btn('postpone', 'เลื่อนวัน', 0, "tsPostpone('" + id + "','" + d + "')", 'pp')
          + (dec ? '<button class="ts-db del" onclick="tsClear(\'' + id + '\',\'' + d + '\')">ล้าง</button>' : '')
          + '</div><input id="ts-note-' + e(r.id) + '" class="ts-note" type="text" value="' + e(dec ? dec.note : '') + '" placeholder="หมายเหตุ / เลขอ้างอิง"></td>'
        + '<td class="c">' + (dec
          ? '<span class="ts-chip ' + (DEC[dec.decision] || DEC.none)[1] + '">' + (DEC[dec.decision] || DEC.none)[0] + (dec.decision === 'postpone' ? '' : ' · ' + money(dec.amount)) + '</span>'
            + '<div class="ts-tel" style="margin-top:3px">' + e(dec.by || '') + (dec.at ? ' · ' + e(text(dec.at).slice(0, 16).replace('T', ' ')) : '') + '</div>'
          : '<span class="ts-chip r">รอตัดสิน</span>') + '</td></tr>';
    });
    // Moved-out bookings (server moved_rows, legacy §tsStrand): appended faded, in the same pier/route/VAT scope.
    var nMoved = R.movedListed ? R.mv.length : n(S.moved_trips);
    R.mv.forEach(function(r){
      body += '<tr class="ts-moved" data-ops-ts-moved="' + e(r.id) + '">'
        + '<td><span class="ts-vch">' + e(r.voucher) + '</span></td>'
        + '<td>' + agChip(r.b) + '</td>'
        + '<td><div class="ts-lead">' + e(r.b.lead_pax || '—') + '</div><div class="ts-tel">' + e(r.b.lead_phone || '') + '</div></td>'
        + '<td><span class="ts-chip p">&#10007; เลื่อนวัน ' + r.booked + '</span></td>'
        + '<td style="max-width:230px;color:var(--zn700)">' + e(r.mvWhy) + (r.routeId ? '<div class="ts-tel">' + e(routeName(r.routeId)) + '</div>' : '') + '</td>'
        + '<td class="r ts-mono" style="font-weight:800">&mdash;<div class="ts-tel" style="font-weight:400;margin-top:3px">ยอดเงินไปอยู่กับวันใหม่แล้ว</div></td>'
        + '<td class="ts-noprint"></td>'
        + '<td class="c"><span class="ts-chip p">เลื่อนวันแล้ว</span></td></tr>';
    });
    if(!R.movedListed && nMoved) body += '<tr class="ts-moved" data-ops-ts-needs="moved"><td colspan="8" style="color:var(--zn700)"><span class="ts-chip p">&#10007; เลื่อนวัน ' + nMoved + ' ใบ</span> '
      + 'ทั้งวัน &middot; รายชื่อใบที่เลื่อนออกไปยังไม่มีจากเซิร์ฟเวอร์</td></tr>';
    var pendList = (F.cases > cases.length) ? '<tr data-ops-ts-needs="cases"><td colspan="8" style="color:var(--am700)">เซิร์ฟเวอร์นับ ' + F.cases + ' เคส · ระบุใบได้ ' + cases.length + ' ใบ</td></tr>' : '';
    return '<div class="ts-sec ts-s02"><div class="ts-sech"><div>'
      + '<div class="ts-sect"><span class="ts-sn">02</span>ตัดสินค่าปรับ &middot; ยกเลิก / เลื่อนวัน'
        + (nMoved ? '<span class="ts-chip p" style="margin-left:9px;vertical-align:middle" title="ทั้งวัน">เลื่อนวันไปแล้ว ' + nMoved + '</span>' : '') + '</div>'
      + '<div class="ts-secd">เคสที่คนไม่ครบต้องตัดสินก่อนปิดวัน — เก็บเต็ม · เก็บบางส่วน · ไม่ชาร์จ · เลื่อนวัน</div></div>'
      + '<div class="ts-noprint s5-hd">'
        + (F.cases ? '<span class="ts-scr s5-cnt ' + (F.pend ? 'warn' : 'ok') + '" data-ts02="pend">รอตัดสิน ' + F.pend + '</span>'
          + '<span class="ts-scr s5-cnt" data-ts02="done">ตัดสินแล้ว ' + F.decided + '</span>'
          + '<span class="ts-scr s5-cnt" data-ts02="fine">เก็บค่าปรับได้ ' + money(F.charge) + '</span>' : '')
        + '<button class="ts-btn' + (onlyIssue ? ' on' : '') + '" onclick="tsToggleFilter()">' + (onlyIssue ? 'กำลังดูเฉพาะเคสมีปัญหา' : 'ดูเฉพาะเคสมีปัญหา') + '</button></div></div>'
      + '<div class="ts-card"><div class="ts-scroll"><table class="ts-tbl"><thead><tr>'
      + '<th>Voucher</th><th>Agency</th><th>ลูกค้า (lead)</th><th>เกิดอะไรหน้างาน</th><th>เหตุผล</th>'
      + '<th class="r">ราคาเต็ม</th><th class="ts-noprint">ตัดสิน</th><th class="c">ผล</th></tr></thead><tbody>'
      + (body + pendList || '<tr><td colspan="8" class="ts-empty">วันนี้ทุก booking เดินทางครบ · ไม่มีเคสต้องตัดสิน</td></tr>')
      + '</tbody></table></div></div></div>';
  }

  /* ── 03 เงินที่เก็บหน้างาน ── */
  var PM = { cash: ['เงินสด','e'], transfer: ['โอนเงิน','b'], card: ['บัตรเครดิต','p'] };
  function payChips(c){
    var rc = c.received || {}, out = '';
    ['cash','transfer','card'].forEach(function(k){ if(n(rc[k]) > 0) out += '<span class="ts-chip ' + PM[k][1] + '">' + PM[k][0] + ' ' + money(rc[k]) + '</span>'; });
    return out;
  }
  function cotCell(r){
    var c = r.c, cot = n(c && c.cot);
    if(!(cot > 0)) return '<span style="color:var(--zn400)">&mdash;</span>';
    var e = esc, id = q(r.id), dec = r.dec, mode = dec ? dec.mode : '', a = r.a && r.a.cot;
    var sug = c.not_counted ? 'nocol' : ((a && a.suggested_mode) || 'full');
    var MODES = [['full','หักทั้งก้อน'],['part','บางส่วน'],['none','ไม่หัก'],['payout','โอนออก'],['nocol','เก็บไม่ได้']];
    var h = MODES.map(function(mm){
      var on = mode === mm[0], isSug = !mode && mm[0] === sug;
      return '<button class="ts-db' + (on ? ' pick' : '') + (isSug ? ' sug' : '') + (mm[0] === 'nocol' ? ' nocol' : '') + '" data-ops-ts-cotmode="' + mm[0] + '"'
        + ' onclick="laOps.travelRows.cotPick(\'' + id + '\',\'' + mm[0] + '\')">' + mm[1] + '</button>';
    }).join('');
    var by = dec ? ' <span style="color:var(--zn400)">&middot; ' + e(dec.by || '') + (dec.at ? ' ' + e(text(dec.at).slice(5, 10)) : '') + '</span>'
      + ' <a onclick="laOps.travelRows.cotClear(\'' + id + '\')" style="color:var(--rs700);cursor:pointer;margin-left:5px">ล้าง</a>' : '';
    if(mode === 'part') h += '<div class="ts-cotp"><span>หัก</span><input id="ts-cotd-' + e(r.id) + '" class="ts-cotamt" value="' + n(dec.deduct) + '" onchange="laOps.travelRows.cotAmt(\'' + id + '\')">'
      + '<span>โอนออก</span><input id="ts-cotp-' + e(r.id) + '" class="ts-cotamt" value="' + n(dec.payout) + '" onchange="laOps.travelRows.cotAmt(\'' + id + '\')"></div>';
    if(mode === 'nocol' || (!mode && sug === 'nocol')){
      var why = mode === 'nocol' ? text(dec.ref) : (O.travelRows ? O.travelRows.whySuggestion(r) : '');
      h += '<input id="ts-cotr-' + e(r.id) + '" data-ops-ts-cotreason="1" class="ts-note" type="text" value="' + e(why) + '" placeholder="เก็บไม่ได้เพราะอะไร"'
        + (mode ? ' onchange="laOps.travelRows.cotRef(\'' + id + '\')"' : '') + '>';
    } else if(mode) h += '<input id="ts-cotr-' + e(r.id) + '" class="ts-note" type="text" value="' + e(dec.ref || '') + '" placeholder="เลขอ้างอิงการโอน" onchange="laOps.travelRows.cotRef(\'' + id + '\')">';
    if(mode === 'nocol') h += '<div class="ts-cotsum"><b style="color:var(--rs700)">&#10007; เก็บไม่ได้ ' + money(cot) + '</b>'
      + (dec.ref ? ' <span style="color:var(--zn700)">&middot; ' + e(dec.ref) + '</span>' : ' <span style="color:var(--am700);font-weight:700">&middot; ยังไม่ระบุเหตุผล</span>') + by + '</div>';
    else if(mode){
      var L = [], keep = n(dec.kept != null ? dec.kept : cot - n(dec.deduct) - n(dec.payout));
      if(n(dec.deduct) > 0) L.push('<b style="color:var(--bl700)">หักบิล ' + money(dec.deduct) + '</b>');
      if(n(dec.payout) > 0) L.push('<b style="color:var(--pu700)">โอนออก ' + money(dec.payout) + '</b>');
      if(keep > 0) L.push('บริษัทรับไว้ ' + money(keep));
      h += '<div class="ts-cotsum">' + (dec.over ? '<span style="color:var(--rs700);font-weight:800">&#9888; หัก+โอนออก เกินยอด COT</span>' + by : (L.join(' &middot; ') || 'ไม่หักจากบิล') + by) + '</div>';
    } else h += '<div class="ts-cotsum" style="color:var(--am700);font-weight:700">&#9888; ' + (c.not_counted ? 'ลูกค้าไม่ได้เดินทาง · ต้องระบุว่าเก็บไม่ได้เพราะอะไร' : 'ยังไม่ตัดสิน') + '</div>';
    return h;
  }
  function s03Html(R, F, S){
    var e = esc, rows = R.all.filter(function(r){ return !!r.c; }), mbody = '', cotNoList = [];
    rows.forEach(function(r){
      var b = r.b, c = r.c, t = r.t, van = vanOf(t), boat = boatOf(t), dec = r.dec;
      var noCol = dec && dec.mode === 'nocol';
      if(noCol) cotNoList.push({ code: r.voucher, amt: n(c.cot), why: dec.ref || '' });
      var chips = payChips(c) || (n(c.billed) > 0 ? '<span class="ts-chip g">&#10003; จ่ายผ่านบิล</span>' : '<span class="ts-chip n">ยังไม่เก็บ</span>');
      if(n(c.no_slip) > 0) chips += '<span class="ts-chip a" title="โอน/บัตรที่ยังไม่แนบสลิป · รวมของที่ขายเพิ่ม">ขาดสลิป ' + n(c.no_slip) + '</span>';
      var parts = []; if(n(c.cot) > 0) parts.push('COT ' + money(c.cot)); if(n(c.b2c_balance) > 0) parts.push('ค้าง ' + money(c.b2c_balance)); if(n(c.upgrades_due) > 0) parts.push('upgrade ' + money(c.upgrades_due));
      var sl = c.sales || {}, sale = n(sl.total) > 0 ? '<span class="ts-ao ao-ex">ขายเพิ่ม ' + n(sl.count) + ' รายการ <b>+' + money(sl.total) + '</b></span>' + (n(sl.due) > 0 ? '<div class="ts-tel">รอเก็บ ' + money(sl.due) + '</div>' : '') : '<span style="color:var(--zn400)">&mdash;</span>';
      var cx = !!c.not_counted;
      mbody += '<tr class="' + (cx ? 'ts-cxl' : (n(c.due) > 0 ? 'need' : '')) + '" data-ops-ts-collect="' + e(r.id) + '">'
        + '<td><span class="ts-vch">' + e(r.voucher) + '</span></td>'
        + '<td>' + agChip(b) + '</td>'
        + '<td><div class="ts-lead">' + e(b.lead_pax || '—') + '</div><div class="ts-tel">' + e(b.lead_phone || '') + '</div></td>'
        + '<td><div style="font-size:11px">' + e(b.hotel_name || '—') + '</div><div class="ts-tel">' + (van ? e(vanName(van)) : 'มาเอง') + (boat ? ' · ' + e(boatName(boat)) : '') + '</div></td>'
        + '<td class="ts-aocol">' + sale + '</td>'
        + '<td class="ts-mono" style="font-size:10.5px"><span style="color:var(--zn400)">&mdash;</span></td>'
        + '<td>' + chips + '</td>'
        + '<td class="r ts-mono" style="font-weight:800">' + (cx ? '<span style="text-decoration:line-through;opacity:.45">' + money(c.target) + '</span>' : money(c.target))
          + '<div class="ts-tel">' + (cx ? 'ไม่นับ · เก็บไม่ได้' : e(parts.join(' · '))) + '</div></td>'
        + '<td>' + (n(c.cot) > 0 ? (text(b.cash_on_tour_note).trim() ? '<div class="ts-cotn">' + e(text(b.cash_on_tour_note).trim()) + '</div>' : '<div class="ts-cotn empty">ไม่มีโน้ต</div>') : '<span style="color:var(--zn400)">—</span>') + '</td>'
        + '<td class="ts-cotcol">' + cotCell(r) + '</td>'
        + '<td class="c">' + (cx
          ? '<span class="ts-chip r">' + (c.not_counted === 'cxl' ? 'ยกเลิกหน้างาน' : 'ไม่มา') + '</span><div class="ts-tel" style="margin-top:3px">ไม่นับเข้ายอดวันนี้</div>'
          : n(c.due) > 0 ? '<span class="ts-chip a">รอเก็บ ' + money(c.due) + '</span>'
          : noCol ? '<span class="ts-chip r">เก็บไม่ได้ ' + money(c.cot) + '</span>'
          : (n(c.target) <= 0 && n(c.paid) <= 0 && n(sl.got) > 0) ? '<span class="ts-chip g">ขายเพิ่ม ' + money(sl.got) + '</span>'
          : (n(c.target) <= 0 && n(c.paid) <= 0 && n(sl.due) > 0) ? ''
          : '<span class="ts-chip g">เก็บครบ ' + money(c.paid) + '</span>')
          + (n(sl.due) > 0 ? '<div style="margin-top:3px"><span class="ts-chip a">ขายเพิ่ม รอเก็บ ' + money(sl.due) + '</span></div>' : '') + '</td></tr>';
    });
    var M = { cash: F.cash, tf: F.tf, card: F.card, tin: F.tin, comm: F.comm, out: F.out, net: F.net, due: F.due, saleDue: F.saleDue, fee: F.fee, deduct: F.deduct,
      cotAll: F.cotAll, cotLeft: F.cotLeft, cotNo: F.cotNo, nCotNo: F.nCotNo, cotNoList: cotNoList, nRows: rows.length };
    return '<div class="ts-sec ts-s03"><div class="ts-sech"><div>'
      + '<div class="ts-sect"><span class="ts-sn">03</span>เงินที่เก็บหน้างาน &middot; แยกตามวิธีรับเงิน</div>'
      + '<div class="ts-secd">รวมทุกยอดที่ต้องเก็บวันนี้ — Cash on Tour · ยอดค้าง · upgrade — และของที่ขายเพิ่มหน้างาน</div></div>'
      + '<div class="ts-scr ts-noprint s5-hd"><span class="s5-cnt">ต้องเก็บวันนี้ ' + money(F.target) + '</span>'
        + (F.nSale ? '<span class="s5-cnt">ขายเพิ่ม ' + money(F.sales) + ' · ' + F.nSale + ' รายการ</span>' : '') + '</div></div>'
      + call('tsV6Money', [M, money], '')
      + '<div class="ts-card"><div class="ts-scroll"><table class="ts-tbl"><thead><tr>'
      + '<th>Voucher</th><th>Agency</th><th>ลูกค้า (lead)</th><th>จุดรับ · รถ/เรือ</th><th>ขายเพิ่มหน้างาน</th><th>คนเก็บ</th>'
      + '<th>วิธีรับเงิน</th><th class="r">ต้องเก็บ</th><th>โน้ต COT</th><th>จัดการเงิน COT<span class="ts-thsub">หักบิล / โอนออก</span></th><th class="c">สถานะ</th></tr></thead><tbody>'
      + (mbody || '<tr><td colspan="11" class="ts-empty">วันนี้ไม่มียอดที่ต้องเก็บหน้างานและไม่มีของขายเพิ่ม</td></tr>')
      + '</tbody></table></div></div></div>';
  }

  /* ── 04 Manifest ประจำวัน ── */
  var PT = { invoice: ['Invoice','n'], credit: ['Invoice','n'], proforma: ['Proforma','e'], prepaid: ['Proforma','e'], cot: ['COT','a'], bt: ['โอนล่วงหน้า','e'] };
  function payCell(r){
    var b = r.b, c = r.c, L = [], e = esc;
    var B2C = { paid: ['&#10003; Paid','g'], deposit: ['Deposit','b'], unpaid: ['Unpaid','r'] }[text(b.payment_paid_status)] || null;
    // Legacy pckMoney's term: the B2C booking's own payment method, else the agent's pay type.
    var ag = agent(b.agent_id), term = (b.agent_id === 'a_b2c' && b.payment_method) || (ag && ag.payType) || '';
    var pt = PT[text(term)] || null;
    if(B2C && b.payment_paid_status === 'paid') L.push('<span class="ts-chip g" data-tspay="paid">' + B2C[0] + '</span>');
    else if(pt) L.push('<span class="ts-chip ' + pt[1] + '">' + pt[0] + '</span>');
    else if(!b.agent_id) L.push('<span class="ts-chip n">Walk-in</span>');
    if(B2C && b.payment_paid_status !== 'paid') L.push('<span class="ts-chip ' + B2C[1] + '">' + B2C[0] + '</span>');
    if(b.invoice && b.invoice.status === 'paid') L.push('<span class="ts-chip g">&#10003; จ่ายผ่านบิลแล้ว</span>');
    if(r.cxlRow){
      var cc = b.cancellation || {};
      L.push('<span class="ts-pyd">' + (n(cc.charge_amount) > 0 ? 'ค่าปรับ ' + money(cc.charge_amount) : 'ไม่มียอดเก็บ') + '</span>');
      return '<div class="ts-payc">' + L.join('') + '</div>';
    }
    if(c && c.not_counted){
      if(n(c.due) > 0) L.push('<span class="ts-pyd" style="opacity:.55;text-decoration:line-through">ต้องเก็บ ' + money(c.due) + '</span>');
      L.push('<span class="ts-pyn">' + (c.not_counted === 'cxl' ? 'ยกเลิกหน้างาน' : 'ไม่มา') + ' &middot; ไม่นับเข้ายอดวันนี้</span>');
      return '<div class="ts-payc">' + L.join('') + '</div>';
    }
    if(c && n(c.due) > 0){
      var parts = [];
      if(n(c.cot) > 0) parts.push('COT ' + money(c.cot)); if(n(c.b2c_balance) > 0) parts.push('ค้าง ' + money(c.b2c_balance));
      if(n(c.upgrades_due) > 0) parts.push('upgrade ' + money(c.upgrades_due)); if(n(c.billed) > 0) parts.push('จ่ายผ่านบิล ' + money(c.billed)); if(n(c.paid) > 0) parts.push('เก็บแล้ว ' + money(c.paid));
      L.push('<span class="ts-pyd">ต้องเก็บ ' + money(c.due) + '</span>'); if(parts.length) L.push('<span class="ts-pyn">' + e(parts.join(' · ')) + '</span>');
    } else if(c && n(c.paid) > 0) L.push('<span class="ts-pyg">&#10003; เก็บครบ ' + money(c.paid) + '</span>');
    else if(term === 'cot' && b.payment_paid_status !== 'paid' && !(b.invoice && b.invoice.status === 'paid')) L.push('<span class="ts-pyn">COT · ยังไม่ระบุยอด</span>');
    // The cash on tour as the server counts it: the money row's, else the after-trip row's (a COT kept apart from the bill has no money row).
    var cotV = c ? n(c.cot) : n(r.a && r.a.cot && r.a.cot.amount);
    if(cotV > 0){
      var d = r.dec, lb, cls;
      if(d){ var P = []; if(n(d.deduct) > 0) P.push('หักบิล ' + money(d.deduct)); if(n(d.payout) > 0) P.push('โอนออก ' + money(d.payout));
        if(n(d.kept) > 0) P.push('บริษัทรับไว้ ' + money(d.kept)); if(d.mode === 'nocol') P = ['เก็บไม่ได้'];
        lb = P.join(' &middot; ') || 'ไม่หักบิล'; cls = n(d.payout) > 0 ? 'p' : (n(d.deduct) > 0 ? 'b' : 'e'); }
      else { lb = 'ตั้งไว้ ' + (b.cash_on_tour_handling === 'separate' ? 'แยกจากบิล' : 'หักจากบิล'); cls = b.cash_on_tour_handling === 'separate' ? 'a' : 'n'; }
      L.push('<span class="ts-chip ' + cls + '">COT ' + money(cotV) + ' &middot; ' + lb + '</span>');
      if(!d || d.over) L.push('<span class="ts-pyw">&#9888; ยังไม่ตัดสินการหักบิล</span>');
      if(text(b.cash_on_tour_note).trim()) L.push('<span class="ts-pyn2" title="' + e(b.cash_on_tour_note) + '">&#128221; ' + e(b.cash_on_tour_note) + '</span>');
    }
    if(c){ var pc = payChips(c); if(pc) L.push('<span class="ts-pyms">' + pc + '</span>'); if(n(c.no_slip) > 0) L.push('<span class="ts-pyw">&#9888; รอสลิป ' + n(c.no_slip) + '</span>'); if(n(c.fees) > 0) L.push('<span class="ts-pyn2">ค่าธรรมเนียม ' + money(c.fees) + '</span>'); }
    return '<div class="ts-payc">' + L.join('') + '</div>';
  }
  function addonCell(r){
    var b = r.b, e = esc, L = [];
    var shaped = { id: b.external_id || b.id, agentId: b.agent_id || '', rateTypeRef: b.rate_type_ref || null,
      addOns: (b.add_ons || []).map(function(a){ return { type: a.type, label: a.label, note: a.note || '', jAd: a.join_adults, jChd: a.join_children }; }),
      trips: [{ routeId: r.routeId, bookingMode: r.t.booking_mode, bundle: r.t.bundle || null, longtailManual: r.t.longtail_manual || false }] };
    var pre = r.t.ovn_leg ? [] : g('ckAddonList') ? call('ckAddonList', [shaped, r.routeId], []) : (b.add_ons || []).map(function(a){ return { label: a.label || a.type }; });
    (pre || []).forEach(function(a){ L.push('<span class="ts-ao ao-bk" title="จองมาแต่แรก' + (a.note ? ' · ' + e(a.note) : '') + '">' + e(a.label) + '</span>'); });
    (b.upgrades || []).forEach(function(u){ L.push('<span class="ts-ao ao-up' + (u.collected ? '' : ' due') + '" title="อัปเกรด">' + e(u.label || u.name || 'Upgrade') + (n(u.sell_price) ? ' <b>+' + money(u.sell_price) + '</b>' : '') + '</span>'); });
    var sl = r.c && r.c.sales, nUp = (b.upgrades || []).length;
    if(sl && n(sl.count) > nUp) L.push('<span class="ts-ao ao-ex" title="ขายเพิ่มหน้างาน">ขายเพิ่ม ' + (n(sl.count) - nUp) + ' รายการ</span>');
    var ml = []; if(n(b.special_meals_veg)) ml.push('มังสวิรัติ ' + n(b.special_meals_veg)); if(n(b.special_meals_vegan)) ml.push('วีแกน ' + n(b.special_meals_vegan));
    if(n(b.special_meals_halal)) ml.push('ฮาลาล ' + n(b.special_meals_halal)); if(text(b.special_meals_allergies).trim()) ml.push('แพ้: ' + text(b.special_meals_allergies).trim());
    if(ml.length) L.push('<span class="ts-ao ao-bk" title="มากับใบจอง">' + e(ml.join(' · ')) + '</span>');
    return L.length ? '<div class="ts-aos">' + L.join('') + '</div>' : '<span style="color:var(--zn400)">—</span>';
  }
  function sreqOf(b, t){
    var up = t && t.operations && t.operations.upgrade, u = Array.isArray(up) ? up[up.length - 1] : up, bits = [];
    if(u && u.from_route_id) bits.push('\u2934 Upgrade จาก ' + routeName(u.from_route_id) + (u.reason ? ' \u00b7 ' + u.reason : '') + (n(u.charge) > 0 ? ' \u00b7 +\u0e3f' + n(u.charge).toLocaleString() : ''));
    var note = text(b.special_request || b.notes || b.note).trim(); if(note) bits.push(note);
    return bits.join(' \u00b7 ');
  }
  /* Drop-off (legacy tsSendBack): the same point unless the booking names another; then its return van. */
  function dropCell(r){
    var b = r.b, e = esc, t = r.t, ops = (t && t.operations) || {}, p = (ops.van_parts || [])[0] || {}, gr = p.group || {};
    if(b.dropoff_same !== false) return '<span style="color:var(--zn400)">จุดเดิม</span>';
    var drop = b.dropoff_hotel_name || b.dropoff_area || '—', ret = p.return_van_id || gr.return_van_id;
    var tag = ret ? ['\u21a9 ' + vanName(ret), 'g'] : ops.return_same_van ? ['\u21a9 กลับคันเดิม', 'e'] : ['\u26a0 ยังไม่จัดรถกลับ', 'r'];
    return '<div class="ts-sbk">' + e(drop) + '</div><span class="ts-chip ' + tag[1] + '">' + e(tag[0]) + '</span>';
  }
  function s04Html(R, F, date, onlyIssue){
    var e = esc, rows = (onlyIssue ? R.all.filter(function(r){ return r.isCase; }) : R.all).concat(R.cxl).concat(R.mv).sort(R.cmp);
    var body = '', prev = null, mn = 0, gS = null, dS = { ad: 0, chd: 0, inf: 0, foc: 0, t: 0, b: 0, m: 0, n: 0, unk: false }, mc = { pier: 0, addon: 0, sq: 0, warn: 0, cxl: 0 };
    var pxTd = function(v, col){ return '<td data-col="' + col + '" class="c ts-px' + (v ? '' : ' zero') + '">' + (v || '·') + '</td>'; };
    var sumRow = function(cls, label, S){
      return '<tr class="' + cls + ' ts-scr ts-noprint"><td class="ts-rn"></td><td colspan="3" data-span="1-3">' + label + '</td>'
        + pxTd(S.ad, 4) + pxTd(S.chd, 5) + pxTd(S.inf, 6) + pxTd(S.foc, 7)
        + '<td class="c ts-mono" data-col="8" style="font-weight:800">' + (S.unk ? '?' : S.t) + ' / ' + S.b + '</td><td colspan="6" data-span="9-14"></td>'
        + '<td class="r ts-mono ts-totc" data-col="15" style="font-weight:800">' + money(S.m) + '</td><td colspan="2" data-span="16-17"></td></tr>';
    };
    var gClose = function(){ if(gS){ body += sumRow('ts-gsum', 'รวม ' + e(gS.name) + ' · ' + gS.n + ' ใบ', gS); gS = null; } };
    rows.forEach(function(r){
      var b = r.b, t = r.t;
      if(r.routeId !== prev){
        prev = r.routeId;
        var grp = rows.filter(function(x){ return x.routeId === r.routeId && !x.cxlRow; }), gX = rows.filter(function(x){ return x.routeId === r.routeId && x.cxlRow && !x.mvRow; }), gM = rows.filter(function(x){ return x.routeId === r.routeId && x.mvRow; });
        var gB = grp.reduce(function(a, x){ return a + x.booked; }, 0), gT = R.clean ? gB : null, col = routeColor(r.routeId);
        var boats = []; grp.forEach(function(x){ var nm = boatName(boatOf(x.t)); if(nm && boats.indexOf(nm) < 0) boats.push(nm); });
        gClose();
        gS = { name: routeName(r.routeId), ad: 0, chd: 0, inf: 0, foc: 0, t: 0, b: 0, m: 0, n: 0, unk: !R.clean };
        body += '<tr class="ts-grow" style="--rc:' + e(col) + '"><td class="ts-rn ts-scr ts-noprint"></td><td colspan="17" data-span="1-17" style="padding:7px 11px"><div class="ts-gw">'
          + '<span style="display:inline-flex;align-items:center;gap:7px;font-size:12px;color:' + e(col) + '"><i class="ts-dot" style="border-radius:50%;background:' + e(col) + '"></i>' + e(routeName(r.routeId)) + '</span>'
          + (boats.length ? '<span class="ts-scr ts-noprint ts-gboat">' + e(boats.join(' · ')) + '</span>' : '')
          + '<span style="float:right" class="ts-tel">' + grp.length + ' booking · จอง ' + gB + ' → เดินทางจริง ' + (gT == null ? '?' : gT) + (gT != null && gB - gT > 0 ? ' · หาย ' + (gB - gT) : '')
          + (gX.length ? ' · <b style="color:var(--rs700)">ยกเลิกทั้งใบ ' + gX.length + ' ใบ</b>' : '')
          + (gM.length ? ' · <b style="color:var(--pu700)">เลื่อนวันไปแล้ว ' + gM.length + ' ใบ</b>' : '') + '</span></div></td></tr>';
      }
      var c = r.c, van = vanOf(t), boat = boatOf(t), pb = r.pb;
      var total = r.amount == null ? null : r.amount + n(c && c.sales && c.sales.total), site = n(c && c.sales && c.sales.total);
      if(r.cxlRow) total = r.mvRow ? null : n(b.total);
      if(!r.cxlRow && gS){
        ['ad','chd','inf','foc'].forEach(function(k){ gS[k] += pb[k]; dS[k] += pb[k]; });
        gS.t += r.booked; gS.b += r.booked; gS.m += n(total); gS.n++; dS.t += r.booked; dS.b += r.booked; dS.m += n(total); dS.n++;
        if(!R.clean) dS.unk = true;
      }
      // §tsManMv · the money moved with the booking to its new day: shown here it would read as today's.
      var payH = r.mvRow ? '<span style="color:var(--zn400);font-size:10.5px">ยอดเงินไปอยู่กับวันใหม่แล้ว</span>' : payCell(r), aoH = addonCell(r), sq = sreqOf(b, t), tags = [];
      if(r.cxlRow) tags.push('cxl');
      if(!r.cxlRow && c && (n(c.target) > 0 || n(c.paid) > 0)) tags.push('pier');
      if(aoH.indexOf('ts-ao ') >= 0) tags.push('addon');
      if(sq) tags.push('sq');
      if(payH.indexOf('ยังไม่ตัดสิน') >= 0) tags.push('warn');
      tags.forEach(function(k){ mc[k]++; });
      mn++;
      var px = function(k){
        var v = pb[k];
        if(!v) return '<td class="c ts-px zero">·</td>';
        if(r.cxlRow) return '<td class="c ts-px zero" title="' + (r.mvRow ? 'เลื่อนวันออกไปแล้ว' : 'ยกเลิกทั้งใบ') + ' · จอง ' + v + '">' + v + '</td>';
        return '<td class="c ts-px"' + (R.clean ? '' : ' title="จอง ' + v + ' · ไปจริงแยกประเภทยังไม่มีจากเซิร์ฟเวอร์"') + '>' + v + '</td>';
      };
      var stat = r.mvRow ? '<span class="ts-chip p">&#10007; เลื่อนวัน</span>' + (r.mvTo ? '<div class="ts-tel" style="margin-top:3px">ไป ' + e(call('ckDayShortTh', [r.mvTo], r.mvTo)) + '</div>' : '')
        : r.cxlRow ? '<span class="ts-chip r">CXL &middot; ยกเลิก</span>'
        : r.isCase ? (r.ns ? '<span class="ts-chip ' + (DEC[r.ns.decision] || DEC.none)[1] + '">' + (DEC[r.ns.decision] || DEC.none)[0] + (r.ns.decision === 'postpone' ? '' : ' · ' + money(r.ns.amount)) + '</span>' : '<span class="ts-chip r">รอตัดสิน</span>')
        : (c && !c.not_counted && n(c.due) > 0 ? '<span class="ts-chip a">รอเก็บ ' + money(c.due) + '</span>' : '<span class="ts-chip g">&#10003; เรียบร้อย</span>');
      var cxlCell;
      if(r.mvRow) cxlCell = '<span class="ts-chip p">เลื่อนวันแล้ว</span>' + (r.mvWhy ? '<div class="ts-tel" style="margin-top:3px">' + e(r.mvWhy) + '</div>' : '');
      else if(r.cxlRow){
        var cc = b.cancellation || {}, ct = cc.charge_type || cc.chargeType;
        var lbl = ct === 'full' ? 'เก็บเต็ม ' + money(cc.charge_amount) : ct === 'partial' ? 'เก็บบางส่วน ' + money(cc.charge_amount) : b.cancellation ? 'ไม่ชาร์จ' : (b.status === 'cancelled_weather' ? 'ยกเลิกเพราะอากาศ' : 'ยกเลิก');   // legacy tsCxlCell: no cancel record = the status
        var why = text(b.cancellation_reason).trim() || text(cc.note).trim();
        cxlCell = '<div class="ts-dcell"><span class="ts-chip r">ยกเลิกทั้งใบ</span><span class="ts-cxc">' + e(lbl) + '</span>' + (why ? '<span class="ts-cxr" title="' + e(why) + '">' + e(why) + '</span>' : '') + '</div>';
      } else if(r.isCase){
        var tally = { no_show: 0, cxl: 0 }; r.ev.forEach(function(x){ tally[x.type === 'cxl' ? 'cxl' : 'no_show'] += n(x.pax); });
        var w = []; if(tally.no_show) w.push('No-show ' + tally.no_show); if(tally.cxl) w.push('CXL หน้างาน ' + tally.cxl);
        cxlCell = '<div class="ts-dcell"><span class="ts-chip r">' + e(w.join(' · ') || 'คนไม่ครบ') + (w.length ? ' คน' : '') + '</span>'
          + (r.ns ? '<span class="ts-chip ' + (DEC[r.ns.decision] || DEC.none)[1] + '">' + (DEC[r.ns.decision] || DEC.none)[0] + (r.ns.decision === 'postpone' ? '' : ' · ' + money(r.ns.amount)) + '</span>' + (r.ns.note ? '<span class="ts-cxr">' + e(r.ns.note) + '</span>' : '')
            : '<span class="ts-cxr">รอตัดสินค่าปรับ</span>') + '</div>';
      } else cxlCell = '<span style="color:var(--zn400)">—</span>';
      var room = text(b.room_number);
      body += '<tr data-tsman="' + tags.join(' ') + '"' + (r.mvRow ? ' class="ts-cxlrow ts-mvrow"' : r.cxlRow ? ' class="ts-cxlrow"' : '') + ' data-ops-ts-man="' + e(r.id) + '">'
        + '<td class="ts-rn ts-scr ts-noprint">' + mn + '</td>'
        + '<td><span class="ts-vch">' + e(r.voucher) + '</span></td>'
        + '<td>' + agChip(b) + '</td>'
        + '<td><div class="ts-lead">' + e(b.lead_pax || '—') + '</div><div class="ts-tel">' + e(b.lead_phone || '') + '</div></td>'
        + px('ad') + px('chd') + px('inf') + px('foc')
        + '<td class="c ts-mono" style="font-weight:800">' + (r.cxlRow ? '<span style="color:var(--rs700)">0</span> / ' + r.booked : ((r.trav == null ? '?' : r.trav) + ' / ' + r.booked)) + '</td>'
        + '<td style="max-width:168px">' + (t.ovn_leg ? '<div><span class="ts-chip" style="background:#EDE7FB;color:#5B289A;font-weight:800" title="ขากลับค้างคืน">&#8617; OVN ขากลับ</span></div>' : '')
          + (r.mvRow && !b.hotel_name ? '<span style="color:var(--zn400)">&mdash;</span>' : b.hotel_name ? e(b.hotel_name) + (room ? '<span class="ts-room">ห้อง ' + e(room) + '</span>' : '')
            : '<span class="ts-chip n" title="ใบนี้ไม่มีจุดรับ · ลูกค้ามาเองที่ท่า">No pickup</span>') + '</td>'
        + '<td style="max-width:150px">' + (r.cxlRow ? '<span style="color:var(--zn400)">จุดเดิม</span>' : dropCell(r)) + '</td>'
        + '<td class="ts-aocol">' + aoH + '</td>'
        + '<td>' + (van ? '<span class="ts-chip n">&#128656; ' + e(vanName(van)) + '</span>' : (r.cxlRow ? '' : '<span class="ts-chip p">มาเอง</span>'))
          + (boat ? '<span class="ts-chip g">&#128676; ' + e(boatName(boat)) + '</span>' : (r.cxlRow ? '' : '<span class="ts-chip r">ยังไม่จัดเรือ</span>'))
          + (r.cxlRow && !van && !boat ? '<span style="color:var(--zn400)">—</span>' : '') + '</td>'
        + '<td class="ts-sqcol">' + (sq ? '<span class="ts-sqtx" title="' + e(sq) + '">' + e(sq) + '</span>' : '<span style="color:var(--zn400)">&mdash;</span>') + '</td>'
        + '<td class="ts-paycol">' + payH + '</td>'
        + '<td class="r ts-mono ts-totc" style="font-weight:800' + (r.mvRow ? ';color:var(--zn400)' : '') + '">' + (total == null ? '&mdash;' : money(total)) + (site > 0 && !r.cxlRow ? '<span class="ts-totb">' + money(r.amount) + '<em>+' + money(site) + '</em></span>' : '') + '</td>'
        + '<td style="max-width:170px">' + cxlCell + '</td>'
        + '<td class="c">' + stat + '</td></tr>';
    });
    gClose();
    if(mn) body += sumRow('ts-gtot', 'รวมทั้งวัน · ' + dS.n + ' ใบ (ไม่นับใบที่ยกเลิก/เลื่อนวัน)', dS);
    var chip = function(f, lbl, cnt){ var F = text(window._tsManF); return '<button type="button" class="ts-mf' + (f === F ? ' on' : '') + '" data-tsmanf="' + f + '" onclick="tsManPick(\'' + f + '\')">' + lbl + (cnt != null ? '<i>' + cnt + '</i>' : '') + '</button>'; };
    var tools = '<div class="ts-scr ts-noprint ts-mtools">'
      + '<label class="ts-msrch"><span>&#128269;</span><input type="text" value="' + e(text(window._tsManQ)) + '" placeholder="ค้นหา voucher · ชื่อลูกค้า · agent · โรงแรม" oninput="tsManQ(this.value)"></label>'
      + chip('', 'ทั้งหมด', mn) + chip('pier', 'มีเงินเก็บหน้าท่า', mc.pier) + chip('addon', 'มี Add-on / อาหาร', mc.addon)
      + chip('sq', 'คำขอพิเศษ', mc.sq) + chip('warn', 'ยังไม่ตัดสินหักบิล', mc.warn) + chip('cxl', 'ยกเลิก / เลื่อนวัน', mc.cxl)
      + call('tsManColsHtml', [], '') + '</div>';
    return '<div class="ts-sec ts-s04"><div class="ts-sech"><div>'
      + '<div class="ts-sect"><span class="ts-sn">04</span>Manifest ประจำวัน</div>'
      + '<div class="ts-secd">รายการทั้งหมดของวันเรียงตามเส้นทาง (Agency A-Z)</div>'
      + '<div class="ts-aokey"><span class="ts-ao ao-bk">จองมาแต่แรก</span><span class="ts-ao ao-ex">ขายเพิ่มหน้างาน</span><span class="ts-ao ao-up">อัปเกรด</span><span class="ts-ao ao-pier">สั่งหน้าท่า</span></div></div></div>'
      + tools
      + '<div class="ts-card"><div class="ts-scroll"><table class="ts-tbl ts-man"><thead><tr>'
      + '<th class="ts-rn ts-scr ts-noprint">#</th><th>Voucher</th><th>Agency</th><th>Customer (lead)</th>'
      + '<th class="c ts-px">AD</th><th class="c ts-px">CHD</th><th class="c ts-px">INF</th><th class="c ts-px">FOC</th>'
      + '<th class="c">Actual<br>/ Booked</th><th>Pickup point &middot; Room</th><th>Drop-off</th>'
      + '<th>Add-on &middot; Upsell</th><th>Van &middot; Boat</th><th>คำขอพิเศษ<span class="ts-thsub">Special request</span></th><th>Pay</th><th class="r">Total</th>'
      + '<th>Cancel &middot; Charge</th><th class="c">Status</th></tr></thead><tbody>'
      + (body || '<tr><td colspan="18" class="ts-empty">' + (onlyIssue ? 'ไม่มีเคสที่ต้องตัดสินในวันนี้' : 'ไม่มี booking ในวันนี้') + '</td></tr>')
      + '</tbody></table></div><div class="ts-scr ts-noprint ts-mnone" data-tsman-none style="display:none">ไม่พบใบที่ตรงกับที่ค้นหา</div></div>'
      + '<div class="ts-sign"><div class="ts-sg"><i></i><b>ผู้จัดทำ · Operations</b><span>เจ้าหน้าที่ปฏิบัติการ</span></div>'
      + '<div class="ts-sg"><i></i><b>ผู้ตรวจสอบ · Finance</b><span>เจ้าหน้าที่การเงิน / แคชเชียร์</span></div>'
      + '<div class="ts-sg"><i></i><b>ผู้อนุมัติ · Management</b><span>ผู้จัดการฝ่ายปฏิบัติการ</span></div></div>'
      + '<div class="ts-foot"><span>LOVE ANDAMAN &middot; OPERATIONS</span><span>' + e(date) + '</span></div></div>';
  }

  /* ── the whole screen ── */
  function html(d){
    var TR = O.travelRows, date = d.date;
    var V = TR && TR.model ? TR.model(d) : null;
    if(!V){
      // No roster (its read failed): the day's own totals and money rows still show; scope and manifest wait for it.
      V = { state: { pier: '', route: '', vat: '' }, scoped: false, docNo: TR ? TR.docNo(date, { pier: '', route: '', vat: '' }) : '', keep: {}, inScope: [], kept: [], cancelled: [],
        nVat: 0, nNoVat: 0, vatGap: [], after: null, moved: d.moved_rows || [], movedListed: Array.isArray(d.moved_rows), ref: [], nRefFiles: 0, slips: [], nSlipFiles: 0, slipPending: 0, noSlipRows: 0, noRoster: true };
      (d.collect_rows || []).forEach(function(c){ V.inScope.push({ id: c.booking_id, voucher: c.voucher_ref || c.booking_id, agentId: '', routeId: c.route_id, b: { id: c.booking_id, voucher_ref: c.voucher_ref || c.booking_id }, t: { pax_total: 0 } }); });
      V.kept = V.inScope;
    }
    V.hasVat = TR && TR.hasVat ? TR.hasVat : function(){ return false; };
    VANS = V.vans || {};
    var allRows = d._roster ? d._roster.rows : V.inScope;
    var R = rowsOf(d, { after: V.after, inScope: V.kept, cancelled: V.cancelled, moved: V.moved, movedListed: V.movedListed });
    var F = figures(d, R.all, V.scoped, R.clean);
    var onlyIssue = !!window._tsOnlyIssue;
    var empty = (!n(d.bookings) && !(d.collect_rows || []).length)
      ? '<div data-ops-ts-empty="1" class="ts-scr ts-noprint" style="margin:12px 0;padding:12px 15px;background:#fdf8ee;border:0.5px solid #e8dcc0;border-radius:12px;font-size:12px;color:#8a6d1a">operation-backend reports no bookings for ' + esc(date) + '. The sheet below is genuinely empty, not still loading.</div>' : '';
    var noRoster = V.noRoster ? '<div data-ops-ts-noroster="1" class="ts-scr ts-noprint" style="margin:12px 0;padding:12px 15px;background:#fdf1f1;border:0.5px solid #e6c9c3;border-radius:12px;font-size:12px;color:#A32D2D">The day\'s booking list did not load: the totals below are the server\'s whole-day figures; scope, cases and the manifest need the list.</div>' : '';
    V.allRows = allRows;
    return '<style id="ts-style">' + call('tsCSS', [], '') + call('tsCSSv6', [], '') + '</style>'
      + '<div class="ts-wrap" data-ops-ts-view="1" data-ops-ts-docno="' + esc(V.docNo) + '">' + headHtml(d, V, R, F, date) + empty + noRoster
      + s01Html(F, d) + s02Html(R, F, d, V, date, onlyIssue) + s03Html(R, F, d) + s04Html(R, F, date, onlyIssue) + '</div>';
  }
  function paint(host, d){
    host.innerHTML = html(d);
    call('tsV6Bleed', [], null);
    call('tsManApply', [], null);
  }

  /* ── wiring ── */
  function wrap(name, fn){
    var orig = window[name]; if(typeof orig !== 'function' || orig.__opsTsView) return;
    var w = function(){ if(!O.enabled()) return orig.apply(this, arguments); return fn.apply(this, [orig].concat([].slice.call(arguments))); };
    w.__opsTsView = true; window[name] = w;
  }
  function load(date){
    var MR = O.moneyReports;
    if(!MR || !MR.loadTravel) return Promise.reject(new Error('travel summary loader missing'));
    return MR.loadTravel(date).then(function(d){ last[date] = d; return d; });
  }
  wrap('renderTravelSum', function(){
    var host = document.getElementById('travelsum-host'), date = dateOf();
    if(!host) return;
    if(last[date]){ paint(host, last[date]); return Promise.resolve(); }
    host.innerHTML = O.loadingHtml('Loading Travel Summary…');
    return load(date).then(function(d){ if(dateOf() === date) paint(host, d); }, function(e){
      O.fail('Travel Summary did not load', e);
      host.innerHTML = '<div style="padding:32px;text-align:center;color:#A32D2D">Travel Summary did not load from operation-backend.</div>';
    });
  });
  // The print window carries the sheet itself; the document and slip packs print from the bar (their files are on the server).
  wrap('tsRefPackList', function(){ return []; });
  wrap('tsSlipPackList', function(){ return []; });
  // Section 02 buttons: the no-show decision goes to the server.
  function T(){ return O.travelRows; }
  wrap('tsPick', function(orig, bkId, date, kind, amt){ return T().nsPick(bkId, kind, amt); });
  wrap('tsClear', function(orig, bkId){ return T().nsClear(bkId); });
  wrap('tsCustom', function(orig, bkId){
    var v = typeof window.prompt === 'function' ? window.prompt('ยอดที่จะเก็บ (บาท)', '0') : null;
    if(v == null) return Promise.resolve();
    return T().nsPick(bkId, 'partial', Math.max(0, Math.round(parseFloat(String(v).replace(/[^0-9.]/g, '')) || 0)));
  });
  wrap('tsPostpone', function(orig, bkId){
    return T().nsPick(bkId, 'postpone').then(function(){
      // The new date is set through the booking's own reschedule flow (client ids are the server's external id).
      var row = (last[dateOf()] && last[dateOf()]._roster && last[dateOf()]._roster.rows || []).filter(function(r){ return r.id === bkId; })[0];
      var cid = row ? (row.b.external_id || row.id) : bkId;
      var have = (window.SB_BOOKINGS || []).some(function(b){ return b && (b.id === cid || b.opsId === bkId); });
      if(have && g('bookingV2RescheduleModal')) window.bookingV2RescheduleModal(cid);
      else if(O.toast) O.toast({ kind: 'info', title: 'Saved as postponed', sub: 'Set the new date on the booking page.', dur: 6000 });
    });
  });
  O.onWrite(function(){ last = {}; });
  window.laOps.travelView = { html: html, figures: figures, clear: function(){ last = {}; } };
})();
