// ── Tab 1 · Calendar view (matches sidebar Calendar layout) ──
function bookingV2RenderCalendar(){
  const cur = _bkV2.cursor;
  const year = cur.getFullYear();
  const month = cur.getMonth();
  const monthKey = `${year}-${String(month+1).padStart(2,'0')}`;
  // Page-owned data: only the month currently on screen is requested.
  /* §calSkel (2026-10-15) · a month that has never loaded draws as shimmer, not as "0 pax":
     SB_BOOKINGS only holds what other pages happened to load. A failed month stops auto-retrying
     (every redraw would refetch) and shows a Retry bar over whatever is cached. */
  const monthStatus = typeof bookingV2OpsMonthStatus==='function' ? bookingV2OpsMonthStatus : function(){ return ''; };
  const monthFailed = monthStatus(monthKey)==='failed';
  const monthLoad=(!monthFailed && typeof bookingV2OpsEnsureMonth==='function') ? bookingV2OpsEnsureMonth(monthKey) : null;
  const skel = !!monthLoad && monthStatus(monthKey)==='loading';
  if(monthLoad) monthLoad.then(function(j){
    if((j || skel) && _bkV2.tab==='cal' && !_bkV2.newBooking) bookingV2Render();
  });
  const sk = (w, h, more) => `<span class="la-skel" style="width:${w};height:${h}px${more?';'+more:''}"></span>`;
  const agg = bookingV2Aggregate();
  const first = new Date(year, month, 1);
  // Sun-first grid (matches sidebar Calendar): Sun=0 ... Sat=6
  const dowFirst = first.getDay();
  const lastDay = new Date(year, month+1, 0).getDate();
  const todayKey = bookingV2DateKey(new Date());

  const routeColor = (rid) => {
    const r = (typeof ROUTES !== 'undefined') ? ROUTES.find(rr => rr.id === rid) : null;
    return r?.color || '#9C9C95';
  };

  // Active families for the visible month (consults Programs · seasons)
  // §cityTourView · Transfer/City Tour are real families (§routeKind) · marine page (flag off)
  //   excludes them · land page (flag on) shows only them
  const activeFams = bookingV2Families().filter(fam => {
    if(typeof laIsLandRoute!=='function') return true;
    const _famIsLand = (bookingV2FamilyRoutes(fam.id)||[]).some(rd => laIsLandRoute(rd.id));
    return _famIsLand === _bkV2CityTourOnly;
  });
  // Program filter (multi-select) · empty/none = show ALL
  const calSelArr = Array.isArray(_bkV2.calFams) ? _bkV2.calFams : [];
  const calSel = calSelArr.length ? new Set(calSelArr) : null;

  const cells = [];
  for(let i = 0; i < dowFirst; i++) cells.push(`<div class="bkv2-cal-cell empty"></div>`);
  for(let d = 1; d <= lastDay; d++){
    const dateKey = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const x = agg.byDate[dateKey];
    const sel = _bkV2.selected?.date === dateKey && !_bkV2.selected?.routeId && !_bkV2.selected?.familyId;
    const isToday = dateKey === todayKey;
    const dow = new Date(year, month, d).getDay();
    const weekend = dow === 0 || dow === 6;
    // §bkCalPast · อดีต = ก่อนวันนี้ · วันนี้ยังรับจองได้ ไม่นับ
    const isPast = dateKey < todayKey;
    const cls = ['bkv2-cal-cell', sel?'sel':'', weekend?'weekend':'', isToday?'today':'', isPast?'past':''].filter(Boolean).join(' ');
    if(skel){
      const bars = (d % 3 === 0 ? ['80%'] : ['82%', d % 2 ? '58%' : '68%']).map(w => sk(w, 15, 'margin-bottom:3px;border-radius:3px')).join('');
      cells.push(`<div class="${cls}" onclick="bookingV2SelectDay('${dateKey}')"><div class="bkv2-cal-daynum"><span>${String(d).padStart(2,'0')}</span></div>${bars}</div>`);
      continue;
    }

    // Build chips for ALL families that are OPEN on this day (any sub-route open)
    // Chip shows family name + total pax (sum across sub-variants) · "empty" if no bookings
    let chipsHtml = '';
    let dayHasFoc = false;
    /* §bkCalOrphan · โปรแกรมที่ปิดวันนั้นไปแล้วแต่ยังมีคนจองค้างอยู่
       ของเดิมกรองด้วย open อย่างเดียว · พอตารางออกเรือเปลี่ยนแล้ววันนั้นกลายเป็นวันปิด
       เซลล์จะไม่วาดชิปเลย ทั้งที่ pax ถูกคิดไว้แล้ว (bookingV2FamilyAggregate อ่านจากใบจอง
       ไม่ได้อ่านจากตาราง) ใบจองพวกนั้นจึงหายไปจากจอทั้งที่ยังอยู่ในระบบ
       ต้องเห็นเสมอ ไม่สนตัวกรองโปรแกรม เพราะมันคือของที่ต้องไปจัดการ ไม่ใช่ของที่เลือกดู
       คิดสดทุกครั้งที่วาด · ย้าย/ยกเลิกเสร็จเมื่อไร ป้ายหายเอง ไม่ต้องมีใครมากดเคลียร์ */
    const famRows = activeFams
      .map(fam => ({ fam, agg: bookingV2FamilyAggregate(fam.id, dateKey, agg), open: bookingV2IsFamilyOpenOn(fam.id, dateKey) }))
      .map(o => ({ ...o, orphan: !o.open && (o.agg.total || 0) > 0 }));
    const openFams = famRows.filter(o => o.orphan || (o.open && (!calSel || calSel.has(o.fam.id))));
    /* ยอดรวมข้างเลขวันคือ "วันนี้มีคนออกกี่คน" · คนที่ค้างอยู่คือคนที่ตารางตอนนี้ไม่ได้พาออก
       เอามารวมกันแล้วเลขหัวเซลล์จะอ่านผิด · ตัวเลขของคนค้างอยู่บนชิปแดงของมันเอง */
    const dayTotal = openFams.reduce((s, o) => s + (o.orphan ? 0 : (o.agg.total || 0)), 0);
    if(openFams.length){
      /* §bkCalOrphan · ของค้างขึ้นบนสุดเสมอ · ถ้าวันนั้นมีหลายโปรแกรมจนชิปล้น
         ตัวที่ต้องไปจัดการต้องไม่ใช่ตัวที่ถูกยุบไปอยู่ใน "+N more" */
      openFams.sort((a, b) => (b.orphan?1:0) - (a.orphan?1:0) || b.agg.total - a.agg.total);
      const visible = openFams.slice(0, 5);
      const overflow = openFams.length - visible.length;
      chipsHtml = visible.map(({ fam, agg: famAgg, orphan }) => {
        const col = fam.color;
        /* §bkCalOrphan · ชิปแดงพร้อมจำนวน · ไม่ขีดฆ่าเหมือนชิปอากาศปิด
           เพราะคนกลุ่มนี้ยังไม่ถูกจัดการ ตัวเลขยังมีผลอยู่ ไม่ใช่ตัวเลขที่ตายแล้ว */
        if(orphan){
          return `<div class="bkv2-cal-chip orphan" style="border-left-color:#B4560A" title="${fam.name} · วันนี้ปิดไปแล้ว แต่ยังมี booking ค้างอยู่ ${famAgg.total} คน · ต้องย้ายวัน ย้ายโปรแกรม หรือยกเลิกก่อน"><span class="bkv2-cal-chip-name">&#9888; ${fam.name}</span><span class="bkv2-cal-chip-pax">${famAgg.total}</span></div>`;
        }
        const pax = famAgg.total;
        const focCls = famAgg.hasFocPending ? ' foc' : '';
        const emptyCls = pax === 0 ? ' empty' : '';
        if(famAgg.hasFocPending) dayHasFoc = true;
        const famWx = (typeof bookingV2IsWeatherClosed==='function') && (bookingV2FamilyRoutes(fam.id)||[]).some(rd => bookingV2IsWeatherClosed((rd.id||rd), dateKey));
        if(famWx){
          return `<div class="bkv2-cal-chip${emptyCls}" style="border-left-color:#A32D2D" title="${fam.name} · Cancelled (weather)"><span class="bkv2-cal-chip-name" style="color:#A32D2D">&#9928; ${fam.name}</span>${pax > 0 ? `<span class="bkv2-cal-chip-pax" style="color:#A32D2D;text-decoration:line-through">${pax}</span>` : ''}</div>`;
        }
        return `<div class="bkv2-cal-chip${focCls}${emptyCls}" style="border-left-color:${col}" title="${fam.name}"><span class="bkv2-cal-chip-name" style="color:${col}">${fam.name}</span>${pax > 0 ? `<span class="bkv2-cal-chip-pax" style="color:${col}">${pax}</span>` : ''}</div>`;
      }).join('');
      if(overflow > 0) chipsHtml += `<div class="bkv2-cal-more">+${overflow} more</div>`;
    }
    const showFocDot = x?.hasFocPending || dayHasFoc;

    const lockedDay = (typeof bookingV2DayLockedExact==='function') ? bookingV2DayLockedExact(dateKey) : 0;
    const lockBadge = lockedDay>0 ? `<div class="bkv2-cal-lock" title="${lockedDay} seat(s) locked this day">&#128274; ${lockedDay}</div>` : '';
    const dayTotBadge = dayTotal > 0 ? `<span class="bkv2-cal-daytot" title="${dayTotal} pax total this day">${dayTotal}</span>` : '';
    cells.push(`<div class="${cls}" onclick="bookingV2SelectDay('${dateKey}')" ondblclick="bookingV2OpenFiltered('','${dateKey}')" title="Click to preview · double-click to open By trip date"><div class="bkv2-cal-daynum"><span>${String(d).padStart(2,'0')}</span>${showFocDot?'<span class="bkv2-cal-foc"></span>':''}${dayTotBadge}</div>${chipsHtml}${lockBadge}</div>`);
  }

  // §calSkel · the stats row, avg cards and a selected day's breakdown all sum this month's bookings too
  const skStats = () => `<div class="bkv2-stats" role="status" aria-label="Loading bookings">${[0,1,2,3].map(() =>
    `<div class="bkv2-stat">${sk('44%', 9)}${sk('58%', 24, 'margin-top:10px')}${sk('70%', 9, 'margin-top:auto')}</div>`).join('')}</div>`;
  const skRoutes = () => `<div class="bkv2-routes"><div class="bkv2-routes-hd">${sk('160px', 12)}</div><div class="bkv2-routes-grid">${
    activeFams.slice(0, 6).map(f => `<div class="bkv2-route-card" style="border-left-color:${f.color};gap:8px">${sk('62%', 11)}${sk('80%', 9)}${sk('40%', 18)}</div>`).join('')}</div></div>`;
  const skSelDay = () => `<div class="bkv2-selday"><div class="bkv2-selday-lab">Selected Day<button class="bkv2-selhide" onclick="bookingV2TogglePanel()" title="พับแผงนี้">&rsaquo;&rsaquo;</button></div>${
    sk('60%', 18, 'margin:6px 0 16px')}${[0,1,2,3,4].map(i => sk(i % 2 ? '72%' : '88%', 12, 'margin-bottom:10px')).join('')}</div>`;
  const monthLbl = cur.toLocaleDateString('en-US', { month:'long', year:'numeric' });
  const failBar = monthFailed ? `<div style="display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:0 0 8px;padding:8px 12px;border:1px solid #F1C9C9;background:#FDF3F3;border-radius:8px;color:#A32D2D;font-size:12px">Bookings for ${monthLbl} did not load from operation-backend · the numbers below may be incomplete<button onclick="bookingV2OpsRetryMonth('${monthKey}')" style="border:1px solid #E3AFAF;background:#fff;color:#A32D2D;border-radius:6px;padding:3px 10px;font:600 11px inherit;cursor:pointer">Retry</button></div>` : '';

  return `
    ${skel ? skStats() : bookingV2RenderStats()}
    ${skel ? skRoutes() : bookingV2RenderRouteAvgs()}
    <div class="bkv2-split">
      <div class="bkv2-cal">
        ${failBar}
        <div class="bkv2-cal-filter">
          <span class="bkv2-cal-filter-lab">Programs</span>
          <button class="bkv2-cal-fpill${!calSel?' on':''}" onclick="bookingV2CalAllFamilies()">All</button>
          ${activeFams.map(f => `<button class="bkv2-cal-fpill${calSel&&calSel.has(f.id)?' on':''}" style="--fc:${f.color}" onclick="bookingV2CalToggleFamily('${f.id}')"><span class="dot" style="background:${f.color}"></span>${f.name}</button>`).join('')}
        </div>
        <div class="bkv2-cal-wdrow">
          <div class="bkv2-cal-wd" style="opacity:.7">Sun</div>
          <div class="bkv2-cal-wd">Mon</div><div class="bkv2-cal-wd">Tue</div><div class="bkv2-cal-wd">Wed</div>
          <div class="bkv2-cal-wd">Thu</div><div class="bkv2-cal-wd">Fri</div>
          <div class="bkv2-cal-wd" style="opacity:.7">Sat</div>
        </div>
        <div class="bkv2-cal-grid">${cells.join('')}</div>
      </div>
      ${skel && _bkV2.selected ? skSelDay() : bookingV2RenderSelDay()}
    </div>
    ${bookingV2RenderFooterHints('cal')}
  `;
}
