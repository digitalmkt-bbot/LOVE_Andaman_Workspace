// ── Tab 1 · Calendar view (matches sidebar Calendar layout) ──
function bookingV2RenderCalendar(){
  const cur = _bkV2.cursor;
  const year = cur.getFullYear();
  const month = cur.getMonth();
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

    // Build chips for ALL families that are OPEN on this day (any sub-route open)
    // Chip shows family name + total pax (sum across sub-variants) · "empty" if no bookings
    let chipsHtml = '';
    let dayHasFoc = false;
    const openFams = activeFams
      .map(fam => ({ fam, agg: bookingV2FamilyAggregate(fam.id, dateKey, agg), open: bookingV2IsFamilyOpenOn(fam.id, dateKey) }))
      .filter(o => o.open && (!calSel || calSel.has(o.fam.id)));
    // Day total pax across the visible (filtered) programs
    const dayTotal = openFams.reduce((s, o) => s + (o.agg.total || 0), 0);
    if(openFams.length){
      openFams.sort((a, b) => b.agg.total - a.agg.total);
      const visible = openFams.slice(0, 5);
      const overflow = openFams.length - visible.length;
      chipsHtml = visible.map(({ fam, agg: famAgg }) => {
        const col = fam.color;
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

  return `
    ${bookingV2RenderStats()}
    ${bookingV2RenderRouteAvgs()}
    <div class="bkv2-split">
      <div class="bkv2-cal">
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
      ${bookingV2RenderSelDay()}
    </div>
    ${bookingV2RenderFooterHints('cal')}
  `;
}
