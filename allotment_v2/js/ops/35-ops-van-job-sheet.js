/* ════════════════════════════════════════════════════════════════════════
   §opsVanJobSheet (2026-10-17) · ใบงานรถ (Van Job Order sheet) drawn from the server's sheet · Q41
   ────────────────────────────────────────────────────────────────────────
   Reads:  GET /operations/van-jobs/{date}/{key}   (one sheet: job, out, ret, ret_on_round_1, unassigned_on_route)
           the day read kept by 35-ops-van-jobs.js (rounds of the other jobs, ret_pax of round 1)
   Writes: none.

   In ops mode `vanJobsOrderInner` (08-app.js) is replaced by a drawing of the server's rows: no booking is
   read, counted, grouped, ordered or merged in the browser. The markup, columns, colours, Thai/English texts and
   print classes are legacy's, copied as they are; only where a value comes from has changed.

   Wrapped (legacy mode, !O.enabled(): every wrapped function delegates to the original):
     vanJobsOrderInner     the sheet (drawer preview, full screen, print window and "save as image" all call it)
     vjRoundOf             the round of one group: from the day read's `round` (title of the drawer, print window, file name)
     bookingV2VanJobOrder  print window: the sheet is loaded first when it is not in hand
     vanJobsSaveImage      save as image: the same
   Not wrapped (see docs/walk/vanjobs-sheet.md): renderVanJobs' list band, vjRoundAll, vehDayRoundN,
   vanJobsBookingsFor, _ovnOutDate.

   A sheet is fetched on first draw (the screen shows "Loading…" and redraws when it lands), is asked for again when
   it is older than 1.5 s at the next draw or when this tab wrote something, and a redraw happens only when the
   answer changed. Classic script · loads after 35-ops-van-jobs.js.
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O || !O.vanJobs || !O.vanJobs.jobKey) return;
  var V = O.vanJobs;

  var STALE_MS = 1500;       // a drawn sheet older than this is asked for again
  var PRINT_FRESH_MS = 30000; // print/save at once from a sheet this young; older is fetched first
  var originals = {};
  ['vanJobsOrderInner', 'vjRoundOf', 'bookingV2VanJobOrder', 'vanJobsSaveImage'].forEach(function(n){
    if(typeof window[n] === 'function') originals[n] = window[n];
  });
  function wrap(name, opsFn){
    var orig = originals[name];
    window[name] = function(){
      if(!O.enabled()) return orig ? orig.apply(this, arguments) : undefined;
      return opsFn.apply(this, [orig].concat([].slice.call(arguments)));
    };
  }
  function enc(x){ return encodeURIComponent(x == null ? '' : String(x)); }
  function e(s){ return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function allBookings(){ return (typeof SB_BOOKINGS !== 'undefined' && Array.isArray(SB_BOOKINGS)) ? SB_BOOKINGS : []; }
  /* a server booking id → the screen's booking (only for ids in buttons, highlight keys and two text lookups) */
  function localBooking(serverId){ return allBookings().find(function(b){ return b && (b.opsId === serverId || b.id === serverId); }) || null; }
  function clientId(serverId){ var b = localBooking(serverId); return b && b.id ? b.id : serverId; }
  function vanName(id){ var v = (typeof vehGet === 'function' ? vehGet(id) : null) || {}; return v.name || id; }

  /* ════ the sheets in hand ════ */
  var cache = {};   // 'date::serverKey' -> { s: sheet|null, json, at, busy, gone }
  function slot(date, sk){ var k = date + '::' + sk; return cache[k] || (cache[k] = { s: null, json: '', at: 0, busy: null, gone: false }); }
  function fetchSheet(date, sk){
    var c = slot(date, sk);
    if(c.busy) return c.busy;
    c.busy = O.get('/operations/van-jobs/' + enc(date) + '/' + enc(sk)).then(function(s){
      var js = JSON.stringify(s), changed = js !== c.json || c.gone;
      c.s = s; c.json = js; c.at = Date.now(); c.busy = null; c.gone = false; c.err = null; return changed;
    }, function(err){
      c.busy = null; c.at = Date.now();
      if(err && err.status === 404){ var was = c.gone; c.s = null; c.json = ''; c.gone = true; return !was; }   // the job is gone: the day read is stale too
      console.warn('[ops] van job sheet did not load · ' + (err && err.message));
      var first = !c.err; c.err = (err && err.message) || 'error';
      return first && !c.s;                                        // a first failure redraws once, to say so
    });
    return c.busy;
  }
  function serverKeyFor(date, vanId, routeId, grp){
    return V.jobKey(date, vanId + '~' + (routeId || '') + (+grp ? '~' + (+grp) : ''));
  }
  /* the sheet's server key, loading the day's job list first when it is not in hand */
  function ensure(date, vanId, routeId, grp, fresh){
    var go = V.dayRead(date) ? Promise.resolve() : V.loadJobs(date);
    return go.then(function(){
      var sk = serverKeyFor(date, vanId, routeId, grp); if(!sk) return null;
      var c = slot(date, sk);
      if(c.s && !fresh && Date.now() - c.at <= PRINT_FRESH_MS) return sk;
      return fetchSheet(date, sk).then(function(){ return sk; });
    });
  }
  if(O.onWrite) O.onWrite(function(){ Object.keys(cache).forEach(function(k){ cache[k].at = 0; }); });
  if(O.onChange) O.onChange(function(){ Object.keys(cache).forEach(function(k){ cache[k].at = 0; }); });

  /* ════ rounds · the day read says them ════ */
  wrap('vjRoundOf', function(orig, date, vid, routeId, g){
    var day = V.dayRead(date);
    if(!day) return orig ? orig(date, vid, routeId, g) : null;
    if(!g) return null;
    var job = (day.jobs || []).find(function(j){ return j.van_id === vid && j.route_id === (routeId || '') && j.group_number === (+g); });
    var r = job && job.round;
    return r ? { no: r.no, tot: r.of, tm: r.time || '' } : null;
  });

  /* ════ the drawing ════ */
  var PX_C = 'text-align:center;font-size:16.5px;font-weight:700;color:#15396B';
  var PX_SPLIT = PX_C + ';color:#5B289A';
  var COLG = '<colgroup><col style="width:2.5%"><col style="width:11%"><col style="width:11%"><col style="width:3.3%"><col style="width:3.3%"><col style="width:3.3%"><col style="width:3.3%"><col style="width:8.5%"><col style="width:13.5%"><col style="width:4.5%"><col style="width:6%"><col style="width:14%"><col style="width:3.8%"><col style="width:8.5%"></colgroup>';
  var DASH = '<span style="color:#bbb">-</span>';

  function stopRowHtml(r){
    var K = (typeof VS_KIND !== 'undefined' && VS_KIND[r.stop_kind]) || { t: '', ic: '' };
    var seats = r.seats || 0;
    var lgK = r.leg || 'out';
    var lg = Object.assign({ both: lgK === 'both' }, (typeof VS_LEG !== 'undefined' && VS_LEG[lgK]) || { t: '' });
    return '<tr style="background:#F4FBFD">'
      + '<td style="text-align:center"><b style="color:#0E7490">' + r.no + '</b></td>'
      + '<td style="text-align:center;font-size:11px;font-weight:800;color:#0E7490;letter-spacing:.04em">' + e(laT('แวะ')) + '</td>'
      + '<td style="font-size:var(--vjt-name,15.5px);font-weight:700;color:#0A5468">' + K.ic + ' ' + e(r.label || '')
      + '<div class="ag" style="color:#0E7490;font-weight:700">' + e(K.t) + (seats ? (' · ' + e(laTp('{0} ที่นั่ง', seats))) : '') + (lg.both ? ' · ' + e(lg.t) : '') + '</div></td>'
      + '<td style="text-align:center">' + DASH + '</td><td style="text-align:center">' + DASH + '</td>'
      + '<td style="text-align:center">' + DASH + '</td><td style="text-align:center">' + DASH + '</td>'
      + '<td style="text-align:center;font-variant-numeric:tabular-nums;font-weight:800;font-size:var(--vjt-time,17px);color:#0E7490;white-space:nowrap">' + (e(r.time || '') || DASH) + '</td>'
      + '<td style="font-size:var(--vjt-loc,14.5px);font-weight:600;color:#0A5468">' + e(r.place || '') + (r.phone ? '<div class="ag" style="color:#0E7490">' + e(r.phone) + '</div>' : '') + '</td>'
      + '<td style="text-align:center">' + DASH + '</td>'
      + '<td>' + (r.zone ? '<div style="font-weight:600;line-height:1.25">' + e(r.zone) + '</div>' + (r.zone_th ? '<div style="font-size:11px;color:#185FA5;line-height:1.25">' + e(r.zone_th) + '</div>' : '') : DASH) + '</td>'
      + '<td style="font-size:var(--vjt-loc,14.5px)">' + DASH + '</td>'
      + '<td style="text-align:center">' + DASH + '</td>'
      + '<td style="font-size:12.5px;color:#57807F;font-style:italic">' + e(r.note || '') + '</td>'
      + '</tr>';
  }

  /* §vjRetNS · the tags a return row carries from the check-in: the server says what was lost (`loss`) */
  function checkinTag(r, date){
    var L = r.loss; if(!L) return '';
    var gone = (L.no_show || 0) + (L.cxl || 0);
    if(r.pax > 0 && gone >= r.pax){
      return '<div style="margin-top:3px"><span style="display:inline-block;background:#FBE3E1;color:#B5271F;font-weight:700;font-size:11px;border-radius:7px;padding:2px 8px;-webkit-print-color-adjust:exact;print-color-adjust:exact">&#10007; ไม่ได้เดินทาง · ไม่ต้องรอ</span></div>';
    }
    if(L.self_pier > 0){
      var why = '';
      try{   // the reason's label is not on the server's row: it is read from the check-in this screen already holds
        var b = localBooking(r.booking_id), sp = (b && typeof pckSelfPierNote === 'function') ? pckSelfPierNote(b, date) : null;
        why = sp ? ' (' + e(sp.label) + ')' : '';
      }catch(_){}
      return '<div style="margin-top:3px"><span style="display:inline-block;background:#F1E7FB;color:#5B289A;font-weight:700;font-size:11px;border-radius:7px;padding:2px 8px;-webkit-print-color-adjust:exact;print-color-adjust:exact">&#128694; เช้าไม่ได้ขึ้นรถ' + why + ' · ขากลับส่งตามปกติ</span></div>';
    }
    return '';
  }

  function bookingRowHtml(r, ctx){
    var isRet = ctx.isRet, date = ctx.date;
    var sx = !!r.struck, sxMv = r.struck === 'moved';
    var no = sx ? '&#10007;' : r.no;
    var cid = clientId(r.booking_id);
    var ovnOut = r.ovn === 'out', ovnRet = r.ovn === 'leg';
    var isSplit = !!r.split;
    var splitWho = (r.split && r.split.who) || '';
    var dropoff = r.drop_off || '';
    var retDiff = !isRet && !!r.return_van_id;
    var retName = retDiff ? vanName(r.return_van_id) : '';
    var retTag = isRet
      ? ((!r.from_van_id) ? '<span style="color:#9aa0aa;font-size:11px"> · กลับคันเดิม</span>'
        : ' <span style="color:#9aa0aa;font-size:11px">· มาจากรถอื่น (ขาไป ' + e(vanName(r.from_van_id)) + ')</span>')
      : '';
    var ovnDrop = ovnOut
      ? '<div style="color:#4A2E86;font-weight:700;font-size:12px;line-height:1.35">&#127765; ค้างคืนบนเกาะ</div><div style="color:#6b5a95;font-size:11px;line-height:1.35">ไม่ต้องรอส่งกลับวันนี้<br>กลับ ' + e(r.ovn_return_date || '') + '</div>'
      : ovnRet
        ? '<div style="font-weight:700;font-size:12px;line-height:1.35">' + e(dropoff || '—') + '</div><div style="color:#8a5500;font-size:11px;line-height:1.35">&#8617; ส่งกลับ · มาจากเกาะ</div>'
        : null;
    var dTag = r.drop_own
      ? '<div style="margin-top:3px"><span style="display:inline-block;background:#EDE7FB;color:#5B289A;font-weight:700;font-size:11px;border-radius:7px;padding:2px 8px;-webkit-print-color-adjust:exact;print-color-adjust:exact">&#9986; แยกส่ง' + (splitWho ? (' · ' + e(splitWho)) : '') + '</span></div>'
      : '';
    var dropCell = ovnDrop ? ovnDrop : (dropoff
      ? (isRet ? ('<b>' + e(dropoff) + '</b>' + retTag + dTag) : ((dropoff ? '<b style="color:#9A5B00">&#8617; กลับ:</b> ' : '') + e(dropoff) + dTag))
      : (isRet ? '<span style="color:#888">—</span>' : '<span style="color:#5a6b80">&#8594; ท่าเรือ</span>'));
    var ckTag = isRet ? checkinTag(r, date) : '';
    var hlKey = vjHlKey(date, ctx.vanId, ctx.routeId, isRet, cid);
    var hlCol = vjHlColor(vjHlOf(hlKey));
    var rowBg = hlCol
      ? ' style="background:' + hlCol + ';-webkit-print-color-adjust:exact;print-color-adjust:exact"'
      : (sx ? ' style="background:#F5F3F0;color:#9b9a93;-webkit-print-color-adjust:exact;print-color-adjust:exact"'
        : (r.extra ? ' style="background:var(--vjt-hlextra,#FFF6E6);-webkit-print-color-adjust:exact;print-color-adjust:exact"' : ''));
    var hlClick = _VJ_HL_ON ? ' onclick="vjHlClick(\'' + hlKey + '\')"' : '';
    var sxClr = (sx && r.booking_id)
      ? '<button class="vj-sxclr" onclick="event.stopPropagation();ckStrandClear(\'' + cid + '\',\'' + date + '\')" title="ล้างแถวค้างนี้ออกจากใบงานของวันนี้ · ใบจองไม่ถูกแตะ" style="margin-left:6px;background:#fff;border:1px solid #E4C0C0;color:#A32D2D;border-radius:6px;padding:1px 7px;font-size:10px;font-weight:700;cursor:pointer;font-family:inherit">ล้างออก</button>'
      : '';
    var movedWhy = sxMv ? (r.moved_to ? ('เลื่อนไป ' + (typeof ckDayShortTh === 'function' ? ckDayShortTh(r.moved_to) : r.moved_to)) : 'ย้ายวันออกไป') : '';
    var sxTag = sx
      ? '<div style="margin-top:3px"><span style="display:inline-block;background:' + (sxMv ? '#EDE3FB' : 'var(--vjt-hlcxl-bg,#FBE3E1)') + ';color:' + (sxMv ? '#5B289A' : 'var(--vjt-hlcxl,#B5271F)') + ';font-weight:700;font-size:11px;border-radius:7px;padding:2px 8px;-webkit-print-color-adjust:exact;print-color-adjust:exact">&#10007; ' + (sxMv ? ('เลื่อนวันแล้ว' + (movedWhy ? (' · ' + e(movedWhy)) : '')) : 'ยกเลิกแล้ว') + ' · ไม่ต้องไปรับ</span>' + sxClr + '</div>'
      : '';
    var others = (r.other_names || []);
    var otherHtml = others.slice(0, 2).map(function(n){ return '<div class="ag" style="font-weight:600;color:#3F4654">' + e(n) + '</div>'; }).join('') + (others.length > 2 ? '<div class="ag">+' + (others.length - 2) + ' more</div>' : '');
    var splitHtml = '';
    if(isSplit){
      var sk = r.split.kind;
      splitHtml = '<div class="ag" style="color:#5B289A">' + (sk === 'main' ? '&#128652; จุดหลัก' : ((sk === 'pickup' ? '&#128652; แยกรับ' : '&#9986; แยกส่ง') + (splitWho ? (' · ' + e(splitWho)) : ''))) + ' · เดียวกัน ' + e(r.voucher) + '</div>';
    }
    var mergedHtml = (r.merged_parts > 1) ? '<div class="ag" style="color:#0C6B47">&#128652; รับจุดเดียวกัน ' + r.merged_parts + ' กลุ่ม · ขากลับแยกส่ง</div>' : '';
    var ovnTag = (ovnRet || ovnOut)
      ? '<div style="margin-top:2px"><span style="display:inline-block;background:' + (ovnOut ? '#EDE7FB' : '#FBE4C9') + ';color:' + (ovnOut ? '#4A2E86' : '#8a5500') + ';font-weight:700;font-size:10px;border-radius:7px;padding:1px 7px;white-space:nowrap">' + (ovnOut ? '&#127765; OVN' : '&#8617; OVN') + '</span></div>'
      : '';
    /* the booking's own "more pick-up points" lines: not on the server's row, read from the booking this screen holds */
    var altHtml = '';
    if(!isRet){
      var lb = localBooking(r.booking_id);
      if(lb && Array.isArray(lb.altPickups) && lb.altPickups.some(function(a){ return (a.who || '').trim() || (a.place || '').trim(); })){
        altHtml = lb.altPickups.filter(function(a){ return (a.who || '').trim() || (a.place || '').trim() || a.area || a.areaId; }).map(function(a){
          return '<div style="color:#5B289A;font-size:11.5px;margin-top:2px">&#128652; <b>' + Math.max(1, parseInt(a.qty) || 1) + ' คน</b>' + ((a.who || '').trim() ? (' · ' + e((a.who || '').trim())) : '') + (a.zone ? (' [' + e(a.zone) + ']') : '') + ' @ ' + e((a.place || '').trim() || a.area || '?') + '</div>';
        }).join('');
      }
    }
    var cAd = isSplit ? PX_SPLIT : PX_C;
    var paxCells = '<td style="' + cAd + '">' + r.ad + '</td><td style="' + PX_C + '">' + r.chd + '</td><td style="' + PX_C + '">' + r.inf + '</td><td style="' + PX_C + '">' + r.foc + '</td>';
    var zoneCell = r.zone
      ? '<div style="font-weight:600;line-height:1.25">' + e(r.zone) + '</div>' + (r.zone_th ? '<div style="font-size:11px;color:#185FA5;line-height:1.25">' + e(r.zone_th) + '</div>' : '')
      : '-';
    var sreq = (r.special_request && String(r.special_request).trim()) ? e(r.special_request) : '<span style="color:#bbb">-</span>';
    return '<tr' + rowBg + hlClick + '>'
      + '<td style="text-align:center;' + (sx ? 'color:#B5271F;font-weight:700' : '') + '">' + no + '</td>'
      + '<td style="font-size:12.5px;word-break:break-all;font-variant-numeric:tabular-nums;color:#444">' + e(r.voucher) + '</td>'
      + '<td style="font-size:var(--vjt-name,15.5px);font-weight:700;color:' + (sx ? '#8f8e88' : '#1B2A55') + (sx ? ';text-decoration:line-through;text-decoration-thickness:1.5px' : '') + '">' + e(r.lead_pax || '-') + sxTag + ckTag + ovnTag + otherHtml + splitHtml + mergedHtml + '</td>'
      + paxCells
      + '<td style="text-align:center;font-variant-numeric:tabular-nums;font-weight:800;font-size:var(--vjt-time,17px);color:var(--vjt-hi,#C0271C);white-space:nowrap">' + (isRet ? '<span style="color:#aaa;font-weight:400;font-size:14px">—</span>' : (e(r.pickup_time || '') || '-')) + '</td>'
      + '<td style="font-size:var(--vjt-loc,14.5px);font-weight:600;color:#1B2A55">' + (e(r.pickup || '') || '<span style="color:#b00">— no pickup —</span>') + (r.pickup_th ? '<div class="ag pkth" style="color:var(--vjt-think,#185FA5);font-weight:600;line-height:1.3;margin-top:1px">' + e(r.pickup_th) + '</div>' : '') + altHtml + '</td>'
      + '<td style="text-align:center">' + (e(r.room || '') || '-') + '</td>'
      + '<td>' + zoneCell + '</td>'
      + '<td style="font-size:var(--vjt-loc,14.5px)">' + dropCell + (retDiff ? '<div style="margin-top:4px"><span style="display:inline-block;background:var(--vjt-hlret-bg,#FBE4C9);color:var(--vjt-hlret-ink,#8a5500);font-weight:700;font-size:12px;border-radius:7px;padding:3px 10px;-webkit-print-color-adjust:exact;print-color-adjust:exact">&#8617; ขากลับ โดย ' + e(retName) + '</span></div>' : '') + '</td>'
      + '<td style="text-align:center">' + (r.bags ? ('🧳 ' + r.bags) : '-') + '</td>'
      + '<td style="font-size:12.5px">' + sreq + '</td>'
      + '</tr>';
  }

  /* one table: the section's rows as the server numbered and ordered them, its totals as the server added them */
  function sectionHtml(sec, ctx){
    if(!sec || !sec.rows || !sec.rows.length) return '';
    var isRet = ctx.isRet, T = sec.totals || {};
    var tr = sec.rows.map(function(r){ return r.kind === 'stop' ? stopRowHtml(r) : bookingRowHtml(r, ctx); }).join('');
    var secHd = '<div style="display:flex;align-items:center;gap:9px;margin:0 0 7px"><span style="background:' + (isRet ? 'var(--vjt-secret,#B07A1F)' : 'var(--vjt-secout,#0F6E56)') + ';color:#fff;font-size:12.5px;font-weight:700;border-radius:7px;padding:4px 13px;-webkit-print-color-adjust:exact;print-color-adjust:exact">' + (isRet ? '② ขากลับ · RETURN' : '① ขาไป · OUTBOUND') + '</span><span style="font-size:11.5px;color:#6b7280">' + (isRet ? 'รับจากท่าเรือ → ส่งจุดหมาย' : 'รับจากโรงแรม → ส่งท่าเรือ') + '</span></div>';
    var table = '<table style="table-layout:fixed;width:100%">' + COLG + '<thead>'
      + '<tr><th rowspan="2">#</th><th rowspan="2">Voucher<small>VC</small></th><th rowspan="2">Lead name<small>ชื่อลูกค้า</small></th>'
      + '<th colspan="4" style="text-align:center">Pax<small>จำนวน (คน)</small></th>'
      + '<th rowspan="2">Pick-up time<small>เวลารับ</small></th><th rowspan="2">Pick-up location<small>จุดรับ</small></th>'
      + '<th rowspan="2">Room<small>ห้อง</small></th><th rowspan="2">Zone<small>โซน</small></th>'
      + '<th rowspan="2">Drop-off<small>จุดส่ง (ถ้าเปลี่ยน)</small></th><th rowspan="2">Bags<small>กระเป๋า</small></th>'
      + '<th rowspan="2">Special request<small>คำขอพิเศษ</small></th></tr>'
      + '<tr><th style="text-align:center">AD</th><th style="text-align:center">CHD</th><th style="text-align:center">INF</th><th style="text-align:center">FOC</th></tr>'
      + '</thead><tbody>' + tr + '</tbody>'
      + '<tfoot><tr style="font-weight:700;background:var(--vjt-thbg,#F4F8FC);color:var(--vjt-ink2,#15396B);-webkit-print-color-adjust:exact;print-color-adjust:exact">'
      + '<td colspan="3" style="text-align:right">รวม / Total</td>'
      + '<td style="text-align:center">' + T.ad + '</td><td style="text-align:center">' + T.chd + '</td><td style="text-align:center">' + T.inf + '</td><td style="text-align:center">' + T.foc + '</td>'
      + '<td colspan="7">' + T.pax + ' pax · ' + T.bookings + ' booking' + (T.separate_drops > 0 ? (' · แยกส่ง ' + T.separate_drops + ' จุด') : '')
      + (T.struck > 0 ? ' <span style="color:#B5271F">· ค้างจัดการ ' + T.struck + ' (ยกเลิก/เลื่อนวัน · ไม่นับ)</span>' : '')
      + (T.stops > 0 ? ' <span style="color:#0A5468">&middot; ' + laT('จุดแวะ') + ' ' + T.stops + (T.stop_seats > 0 ? (' &middot; ' + laTp('ลูกค้า {0} + ติดรถ {1} = {2} ที่นั่ง', T.pax, T.stop_seats, T.pax + T.stop_seats)) : '') + '</span>' : '')
      + '</td></tr></tfoot></table>';
    return secHd + table;
  }

  function sheetHtml(date, S, day){
    var job = S.job, van = job.van || {}, drv = job.driver || {};
    var vanId = job.van_id, routeId = job.route_id;
    var rnd = job.round ? { no: job.round.no, tot: job.round.of, tm: job.round.time || '' } : null;
    var out = S.out, ret = S.ret;
    var retSkip = !!(rnd && rnd.no > 1);
    var ctx = { date: date, vanId: vanId, routeId: routeId };
    var outHtml = sectionHtml(out, Object.assign({ isRet: false }, ctx));
    var retHtml = retSkip ? '' : sectionHtml(ret, Object.assign({ isRet: true }, ctx));
    var outPax = out ? out.totals.pax : 0, retPax = ret ? ret.totals.pax : 0;

    var una = S.unassigned_on_route || { bookings: 0, pax: 0 };
    var unaBanner = una.pax > 0
      ? '<div style="background:var(--vjt-hlwarn-bg,#FBE9E7);border:2px solid var(--vjt-hlwarn,#C0392B);border-radius:9px;padding:10px 15px;margin:0 0 13px;-webkit-print-color-adjust:exact;print-color-adjust:exact"><div style="font-size:14px;font-weight:800;color:var(--vjt-hlwarn-ink,#9B1B12)">&#9888; เส้นทางนี้ยังมี ' + una.bookings + ' booking (' + una.pax + ' คน) ที่ยังไม่ได้จัดรถ — อาจตกจากใบงานนี้</div><div style="font-size:12px;color:var(--vjt-hlwarn-ink,#8A1C1C);opacity:.85;margin-top:3px">' + e(job.route_name) + ' ' + una.pax + ' คน · ไปจัดรถที่ By trip date &rarr; โหมด Van แล้วพิมพ์ใบงานใหม่</div></div>'
      : '';

    var dlabel = date; try{ dlabel = new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }); }catch(_){}
    var hasRows = !!(out || ret || S.ret_on_round_1);
    var routesStr = (out || ret) ? e(job.route_name) : '—';
    var metaCounts = hasRows
      ? '<span style="font-size:15px;font-weight:700;color:#fff">ขาไป ' + outPax + ' คน' + (retSkip ? '' : (' · ขากลับ ' + retPax + ' คน')) + '</span>'
      : 'ไม่มี booking';
    /* later round: the return leg is on round 1's sheet; its head count is that job's `ret_pax` in the day read */
    var round1Ret = 0;
    if(S.ret_on_round_1 && day){
      var j1 = (day.jobs || []).find(function(j){ return j.van_id === vanId && j.route_id === routeId && j.round && j.round.no === 1; });
      round1Ret = j1 ? (j1.ret_pax || 0) : 0;
    }
    var retNote = (retSkip && S.ret_on_round_1)
      ? '<div style="background:#FBF3E6;border:2px solid #E3C489;border-radius:9px;padding:10px 15px;margin-top:16px;-webkit-print-color-adjust:exact;print-color-adjust:exact"><div style="font-size:14px;font-weight:800;color:#7A5200">&#8617; ขากลับไม่ได้อยู่ในใบนี้ — อยู่ในใบรอบ 1</div><div style="font-size:12px;color:#8A6200;margin-top:3px">ขากลับทุกคนลงเรือลำเดียวกลับมาพร้อมกัน รถวิ่งส่งเที่ยวเดียว (' + round1Ret + ' คน) จึงพิมพ์ไว้ใบเดียว ไม่ซ้ำทุกรอบ</div></div>'
      : '';
    var body = (outHtml || '') + (retHtml ? ((outHtml ? '<div style="height:16px"></div>' : '') + retHtml) : '') + retNote
      + ((!outHtml && !retHtml && !retNote) ? '<div style="text-align:center;padding:24px;color:#888">No bookings assigned to this van</div>' : '');
    var rndLbl = rnd ? vjRoundLbl(rnd) : '';

    return '<div class="hd" style="align-items:center;background:linear-gradient(100deg,var(--vjt-main,#0F6E56) 0%,var(--vjt-main2,#0b5443) 100%);color:#fff;border:none;border-radius:12px;padding:15px 22px;margin-bottom:14px;-webkit-print-color-adjust:exact;print-color-adjust:exact">'
      + '<div class="h1" style="flex:1;min-width:0;color:#fff">LOVE ANDAMAN · Van Job Order<small style="color:rgba(255,255,255,.72)">ใบงานรถรับ-ส่ง · ขาไป + ขากลับ ในใบเดียว</small></div>'
      + '<div style="flex:0 0 auto;text-align:center;padding:0 18px">'
      + '<div style="font-size:var(--vjt-van,32px);font-weight:800;color:#fff;line-height:1.05;letter-spacing:.01em">' + e(van.name || van.plate || vanId) + (drv.plate && drv.plate !== '-' ? ' <span style="font-size:19px;color:rgba(255,255,255,.80);font-weight:700;font-variant-numeric:tabular-nums">' + e(drv.plate) + (drv.plate_override ? ' <span style="font-size:11px;color:#FFE9A8">&#128204;</span>' : '') + '</span>' : '') + '</div>'
      + '<div style="font-size:16px;color:rgba(255,255,255,.92);margin-top:5px;font-weight:600">คนขับ <b style="color:#fff">' + e(drv.name || '-') + '</b>' + (drv.phone ? ' · <b style="font-variant-numeric:tabular-nums;color:#fff">' + e(drv.phone) + '</b>' : '') + (drv.override ? ' <span style="font-size:11px;font-weight:700;color:var(--vjt-hlupd-ink,#5a3b00);background:var(--vjt-hlupd,#FFE08A);border-radius:6px;padding:2px 8px;margin-left:6px;-webkit-print-color-adjust:exact;print-color-adjust:exact">&#128204; อัปเดตวันนี้</span>' : '') + '</div>'
      + '</div>'
      + '<div class="meta" style="flex:1;color:rgba(255,255,255,.92)">' + e(van.ownership === 'partner' ? ('รถร่วม ' + (van.partner_name || '')) : 'รถบริษัท') + ' · ' + e(van.zone_base || '') + '<br>' + e(dlabel) + '<br>' + metaCounts
      + (rnd ? '<br><span style="display:inline-block;background:rgba(255,255,255,.22);border:1px solid rgba(255,255,255,.5);border-radius:7px;padding:2px 10px;font-size:14px;font-weight:800;color:#fff;margin-top:4px;-webkit-print-color-adjust:exact;print-color-adjust:exact">&#8635; ' + e(rndLbl) + '</span>' : '') + '</div>'
      + '</div>'
      + '<div class="bighd"><div class="bh-lbl">Route / โปรแกรม</div>'
      + '<div class="bh-line"><span class="bh-route">' + routesStr + '</span><span class="bh-sep">·</span><span class="bh-date">' + e(dlabel) + '</span>'
      + (rnd ? '<span class="bh-sep">·</span><span class="bh-route" style="color:#5B289A">&#8635; ' + e(rndLbl) + (rnd.tm ? (' · ออก ' + e(rnd.tm)) : '') + '</span>' : '') + '</div></div>'
      + (rnd ? '<div style="background:#F4F2FB;border:2px solid #C9BCEA;border-radius:9px;padding:9px 15px;margin:0 0 13px;-webkit-print-color-adjust:exact;print-color-adjust:exact"><div style="font-size:14px;font-weight:800;color:#4A2E86">&#8635; ใบนี้คือ' + e(rndLbl) + ' ของรถคันนี้ในโปรแกรมนี้' + (rnd.tm ? (' · ออก ' + e(rnd.tm)) : '') + '</div><div style="font-size:12px;color:#5B4A8A;margin-top:3px">วันนี้รถคันนี้วิ่งโปรแกรมนี้ ' + rnd.tot + ' รอบ คนละเวลา — ' + (rnd.tot > 1 ? ('อีก ' + (rnd.tot - 1) + ' รอบอยู่คนละใบ ดูใบของรอบนั้นแยกต่างหาก') : '') + '</div></div>' : '')
      + unaBanner
      + body
      + '<div class="note">หมายเหตุ / Notes: ① ขาไป = รถคันนี้รับจากโรงแรมส่งท่าเรือ · ② ขากลับ = รถคันนี้รับจากท่าเรือส่งจุดหมาย · รายที่ป้าย "↩ ขากลับ โดย ‹รถ›" = ขากลับใช้รถคันอื่น (ดูใบงานของรถคันนั้น)</div>'
      + '<div class="callnote">&#9742; หาลูกค้าไม่เจอ ให้รอไม่เกิน <b>5 นาที</b> · มีปัญหาในการรับลูกค้า ติดต่อ <b>088-765-4678</b> · <b>081-970-9977</b> · <b>093-583-7962</b></div>';
  }

  function note(text){ return '<div style="text-align:center;padding:24px;color:#888">' + e(text) + '</div>'; }

  wrap('vanJobsOrderInner', function(orig, date, vanId, routeId, legIgnored, grp){
    if(!routeId) return orig ? orig(date, vanId, routeId, legIgnored, grp) : '';   // the server's sheets are one programme each
    var sk = serverKeyFor(date, vanId, routeId, grp);
    if(!sk){
      if(!V.dayRead(date)){ V.loadJobs(date).then(function(){ V.redraw(); }, function(){}); return note('Loading the job order from the server…'); }
      return note('The server has no job order for this van and programme on ' + date + ' (nothing to carry, or the van group changed): reload the day.');
    }
    var c = slot(date, sk);
    if(c.gone) return note('The server no longer has this job order: reload the day.');
    if(!c.s){
      if(!c.busy && (!c.err || Date.now() - c.at > 5000)) fetchSheet(date, sk).then(function(changed){ if(changed) V.redraw(); });
      return note(c.err ? ('The job order did not load (' + c.err + '): it is asked for again.') : 'Loading the job order from the server…');
    }
    if(!c.busy && Date.now() - c.at > STALE_MS) fetchSheet(date, sk).then(function(changed){ if(changed) V.redraw(); });
    return sheetHtml(date, c.s, V.dayRead(date));
  });

  /* print window and image are written at once from the sheet in hand; older than 30 s, or none: load it first */
  function sheetFirst(name){
    wrap(name, function(orig, date, vanId, routeId, leg, grp){
      var args = [date, vanId, routeId, leg, grp];
      if(!routeId || !orig) return orig ? orig.apply(this, args) : undefined;
      var sk = serverKeyFor(date, vanId, routeId, grp), c = sk ? slot(date, sk) : null;
      if(c && c.s && Date.now() - c.at <= PRINT_FRESH_MS) return orig.apply(this, args);
      return ensure(date, vanId, routeId, grp, true).then(function(){ return orig.apply(null, args); }, function(err){ O.fail('Job order not loaded', err); });
    });
  }
  sheetFirst('bookingV2VanJobOrder');
  sheetFirst('vanJobsSaveImage');

  V.sheet = { html: sheetHtml, cache: cache, ensure: ensure, legacy: originals.vanJobsOrderInner };   // legacy: the browser-built sheet, kept for comparing on paper (test/ui/make_vanjobs_pdf.mjs)
})();
