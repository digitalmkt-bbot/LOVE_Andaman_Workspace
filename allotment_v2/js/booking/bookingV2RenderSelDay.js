// Selected Day panel (right side · matches Calendar page SELECTED DAY panel)
function bookingV2RenderSelDay(){
  const sel = _bkV2.selected;
  if(!sel){
    return `
      <div class="bkv2-selday">
        <div class="bkv2-selday-lab">Selected Day<button class="bkv2-selhide" onclick="bookingV2TogglePanel()" title="พับแผงนี้">&rsaquo;&rsaquo;</button></div>
        <div class="bkv2-selday-ttl">No day selected</div>
        <div class="bkv2-selday-empty">Click a day in the calendar to see breakdown<br>AD &middot; CHD &middot; INF &middot; FOC + PK &middot; KL &middot; NT</div>
      </div>
    `;
  }

  const agg = bookingV2Aggregate();
  const x = agg.byDate[sel.date];
  const dt = new Date(sel.date + 'T00:00');
  const dateLbl = dt.toLocaleDateString('en-US', { weekday:'long', day:'numeric', month:'long' });
  const todayKey = bookingV2DateKey(new Date());
  const isToday = sel.date === todayKey;

  // Seat-locks block · show ONLY routes that already have a lock · one "Lock seats" button to create (route picked in modal)
  const _escR = s => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const _lockedRts = (typeof ROUTES!=='undefined'?ROUTES:[]).filter(r => (typeof bookingV2LockedTotal==='function' ? bookingV2LockedTotal(r.id, sel.date) : 0) > 0);
  const lockRouteSection = `
    <div style="margin-top:14px">
      <div class="bkv2-selday-lab" style="margin-bottom:6px">&#128274; Seat locks</div>
      ${_lockedRts.length ? _lockedRts.map(r => {
        const lk = bookingV2LockedTotal(r.id, sel.date);
        return `<div onclick="bookingV2SwitchTab('locks')" title="Manage in Seat Locks tab" style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f5f3ef;cursor:pointer">
          <span style="width:3px;height:18px;border-radius:3px;background:${r.color||'#ccc'};flex:none"></span>
          <span style="flex:1;min-width:0;font-size:12px;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${_escR(r.name)}">${_escR(r.name)}</span>
          <span style="font-size:11px;color:#C0392B;font-weight:700;font-family:'DM Mono',monospace">&#128274; ${lk}</span>
        </div>`;
      }).join('') : '<div style="font-size:11px;color:var(--ink-soft);font-style:italic;margin-bottom:4px">No seat locks on this day</div>'}
      <button onclick="bookingV2LockFromCalendar('','${sel.date}')" style="margin-top:10px;width:100%;border:1px solid #EAC6BF;background:#FBEAE6;color:#C0392B;border-radius:8px;font-size:12px;font-weight:700;padding:8px;cursor:pointer;font-family:inherit">&#128274; Lock seats</button>
    </div>`;

  if(!x){
    return `
      <div class="bkv2-selday">
        <div class="bkv2-selday-lab">Selected Day<button class="bkv2-selhide" onclick="bookingV2TogglePanel()" title="พับแผงนี้">&rsaquo;&rsaquo;</button></div>
        <div class="bkv2-selday-ttl">${dateLbl}${isToday?'<span class="bkv2-selday-today">Today</span>':''}</div>
        <div class="bkv2-selday-empty">No bookings on this day</div>
        ${lockRouteSection}
      </div>
    `;
  }

  // Week context (Sun-Sat) — find week range and aggregate
  const dayDow = dt.getDay();
  const weekStart = new Date(dt); weekStart.setDate(dt.getDate() - dayDow);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
  let weekPax = 0, weekTrips = 0;
  for(let i=0; i<7; i++){
    const dd = new Date(weekStart); dd.setDate(weekStart.getDate() + i);
    const k = bookingV2DateKey(dd);
    if(agg.byDate[k]){ weekPax += agg.byDate[k].total; weekTrips += Object.keys(agg.byDate[k].routes).length; }
  }
  const weekStartLbl = weekStart.toLocaleDateString('en-US', { day:'numeric', month:'short' });
  const weekEndLbl = weekEnd.toLocaleDateString('en-US', { day:'numeric', month:'short' });
  const avgPerDay = Math.round(weekPax / 7);

  const routeColor = (rid) => {
    const r = (typeof ROUTES !== 'undefined') ? ROUTES.find(rr => rr.id === rid) : null;
    return r?.color || '#9C9C95';
  };

  // Build family cards · each card = 1 program family with sub-route breakdown
  // Sorted by family pax desc · only families with data this day
  // §cityTourView · Transfer/City Tour are real families (§routeKind) · marine page (flag off)
  //   excludes them · land page (flag on) shows only them
  const famsWithData = bookingV2Families()
    .filter(fam => (typeof laIsLandRoute!=='function') || (bookingV2FamilyRoutes(fam.id)||[]).some(rd => laIsLandRoute(rd.id)) === _bkV2CityTourOnly)
    .map(fam => ({ fam, agg: bookingV2FamilyAggregate(fam.id, sel.date, agg) }))
    .filter(o => o.agg.total > 0 || ((typeof bookingV2IsWeatherClosed==='function') && bookingV2FamilyRoutes(o.fam.id).some(rd => bookingV2IsWeatherClosed(rd.id, sel.date))))
    .sort((a, b) => b.agg.total - a.agg.total);

  const routesHtml = famsWithData.map(({ fam, agg: famAgg }) => {
    // Sub-route breakdown (sorted by pax desc)
    const subRoutes = bookingV2FamilyRoutes(fam.id);
    const subs = subRoutes
      .map(rd => ({ rd, data: x.routes[rd.id] }))
      .filter(s => s.data)
      .sort((a, b) => b.data.total - a.data.total);

    // Compact pax breakdown · order: Total · A · C · I · F (skip zeros)
    const fmtCompact = (r) => {
      const parts = [];
      if(r.ad)  parts.push(`<span style="color:var(--ink);font-weight:600">${r.ad}A</span>`);
      if(r.chd) parts.push(`<span style="color:var(--ink);font-weight:600">${r.chd}C</span>`);
      if(r.inf) parts.push(`<span style="color:var(--ink);font-weight:600">${r.inf}I</span>`);
      if(r.foc) parts.push(`<span style="color:#ba7517;font-weight:700">${r.foc}F</span>`);
      return parts.join(' <span style="color:var(--ink-soft)">&middot;</span> ');
    };

    // Sub-variant rows · compact · indent + name + (total · A·C·I·F) + capacity bar
    const subsHtml = subs.map(s => {
      const r = s.data;
      const breakdown = fmtCompact(r);
      const _swx = (typeof bookingV2IsWeatherClosed==='function') && bookingV2IsWeatherClosed(s.rd.id, sel.date);
      // Capacity meter (Phase 8)
      let capBarHtml = '';
      if(typeof getAllotment === 'function'){
        const al = getAllotment(s.rd.id, sel.date);
        if(al.hasAllotment){
          const usedPct = al.availableCapacity > 0 ? Math.min(100, Math.round(al.seatsConsumed / al.availableCapacity * 100)) : 0;
          const charterPct = al.totalCapacity > 0 ? Math.round(al.charterCapacity / al.totalCapacity * 100) : 0;
          const barColor = al.state === 'full' || al.state === 'all-chartered' ? '#a32d2d' : usedPct >= 70 ? '#A05A1A' : '#0F6E56';
          capBarHtml = `
            <div style="padding:2px 12px 5px 22px;font-size:9px;color:var(--ink-soft);font-family:'Manrope',sans-serif;font-variant-numeric:tabular-nums;display:flex;align-items:center;gap:6px">
              <div style="flex:1;height:5px;background:#f5f3ef;border-radius:3px;overflow:hidden;display:flex">
                ${al.charterCapacity > 0 ? `<div style="width:${charterPct}%;background:#6B289A" title="Charter ${al.charterCapacity}"></div>` : ''}
                <div style="width:${Math.max(0, 100 - charterPct) * usedPct / 100}%;background:${barColor}" title="${al.seatsConsumed} booked"></div>
              </div>
              <span style="white-space:nowrap">${al.seatsConsumed}/${al.availableCapacity}${al.charterCapacity>0?` +${al.charterCapacity}⚓`:''}</span>
            </div>
          `;
        } else {
          capBarHtml = ((typeof laIsLandRoute==='function') && laIsLandRoute(s.rd.id))   // §otherPier
            ? `<div style="padding:2px 12px 5px 22px;font-size:9px;color:#5B289A;font-style:italic">• no daily quota · not limited</div>`
            : `<div style="padding:2px 12px 5px 22px;font-size:9px;color:#A05A1A;font-style:italic">⚠ no boat assigned</div>`;
        }
      }
      if(_swx){
        const wc=(typeof bookingV2WeatherCountsFor==='function')?bookingV2WeatherCountsFor(s.rd.id,sel.date):{cancelled:0,rescheduled:0,pending:0};
        capBarHtml = `<div style="padding:2px 12px 6px 22px;font-size:9px;font-weight:700;color:#A32D2D">&#9928; Cancelled (weather) · &#8635; ${wc.rescheduled} resched · &#10005; ${wc.cancelled} cxl${wc.pending>0?` · &#8230; ${wc.pending} pending`:''}</div>`;
      }
      return `
        <div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:5px 12px 1px 22px;border-bottom:0;font-size:11px;line-height:1.4">
          <span style="font-family:'DM Sans',sans-serif;color:${_swx?'#A32D2D':'var(--ink-soft)'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0" title="${s.rd.full}">${_swx?'&#9928; ':''}${s.rd.full}</span>
          <span style="font-family:'DM Mono',monospace;color:var(--ink-soft);font-size:10.5px;flex-shrink:0;letter-spacing:-.01em"><span style="color:${_swx?'#A32D2D':'var(--ink)'};font-weight:700;font-size:12px;${_swx?'text-decoration:line-through':''}">${r.total}</span>${breakdown?` <span style="color:var(--ink-soft)">&middot;</span> ${breakdown}`:''}${(typeof bookingV2LockedTotal==='function' && bookingV2LockedTotal(s.rd.id, sel.date)>0)?` <span style="color:#C0392B;font-weight:700">&#128274;${bookingV2LockedTotal(s.rd.id, sel.date)}</span>`:''}</span>
        </div>
        ${capBarHtml}
        <div style="border-bottom:1px solid #f5f3ef"></div>
      `;
    }).join('');

    // Weather-cancelled family → summary card (Original / Rescheduled / Cancelled / Pending) · like By-trip-date
    const famWxRoutes = subRoutes.filter(rd => (typeof bookingV2IsWeatherClosed==='function') && bookingV2IsWeatherClosed(rd.id, sel.date));
    if(famWxRoutes.length){
      const wcF={cancelled:0,rescheduled:0,pending:0,total:0};
      famWxRoutes.forEach(rd=>{ const c=(typeof bookingV2WeatherCountsFor==='function')?bookingV2WeatherCountsFor(rd.id,sel.date):{cancelled:0,rescheduled:0,pending:0,total:0}; wcF.cancelled+=c.cancelled; wcF.rescheduled+=c.rescheduled; wcF.pending+=c.pending; wcF.total+=c.total; });
      return `
        <div style="border:1px solid #E89A92;border-left:3px solid #A32D2D;border-radius:var(--r-sm);margin-bottom:8px;overflow:hidden">
          <div style="background:#FDEEEC;padding:7px 12px;display:flex;align-items:baseline;justify-content:space-between;gap:8px">
            <div style="flex:1;min-width:0">
              <div style="font-family:'DM Sans',sans-serif;font-size:13px;font-weight:700;color:#A32D2D;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${fam.name}">&#9928; ${fam.name}</div>
              <div style="font-size:9.5px;color:#9a3b30;margin-top:1px">Cancelled (weather)</div>
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-family:'DM Mono',monospace;font-weight:700;font-size:18px;color:#A32D2D;letter-spacing:-.02em">${wcF.total}</div>
              <div style="font-size:8px;color:#9a3b30;text-transform:uppercase;letter-spacing:.04em">original</div>
            </div>
          </div>
          <div style="display:flex;gap:5px;flex-wrap:wrap;padding:7px 12px;background:#fff">
            <span style="font-size:10px;font-weight:600;background:#E6F1FB;color:#185FA5;padding:2px 8px;border-radius:6px">&#8635; Rescheduled ${wcF.rescheduled}</span>
            <span style="font-size:10px;font-weight:600;background:#FCEBEB;color:#A32D2D;padding:2px 8px;border-radius:6px">&#10005; Cancelled ${wcF.cancelled}</span>
            ${wcF.pending>0?`<span style="font-size:10px;font-weight:600;background:#FBF0DD;color:#7A4A00;padding:2px 8px;border-radius:6px">&#8230; Pending ${wcF.pending}</span>`:''}
          </div>
          ${subsHtml}
        </div>
      `;
    }
    return `
      <div style="border:1px solid var(--border);border-left:3px solid ${fam.color};border-radius:var(--r-sm);margin-bottom:8px;overflow:hidden">
        <div style="background:#f5f3ef;padding:7px 12px;display:flex;align-items:baseline;justify-content:space-between;gap:8px">
          <div style="flex:1;min-width:0">
            <div style="font-family:'DM Sans',sans-serif;font-size:13px;font-weight:700;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${fam.name}">${fam.name}${famAgg.hasFocPending?` <span class="bkv2-rd-foc">FOC ${famAgg.foc}</span>`:''}</div>
            <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--ink-soft);margin-top:2px;line-height:1.5">${fmtCompact(famAgg) || '<span style="font-style:italic">no pax</span>'}${famAgg.pk||famAgg.kl||famAgg.nt?' <span>&middot;</span> ':''}${famAgg.pk?`<span>PK ${famAgg.pk}</span>`:''}${famAgg.kl?` <span>KL ${famAgg.kl}</span>`:''}${famAgg.nt?` <span>NT ${famAgg.nt}</span>`:''}</div>
          </div>
          <div style="font-family:'DM Mono',monospace;font-weight:700;font-size:18px;color:var(--ink);flex-shrink:0;letter-spacing:-.02em">${famAgg.total}</div>
        </div>
        ${subsHtml}
      </div>
    `;
  }).join('');

  return `
    <div class="bkv2-selday">
      <div class="bkv2-selday-lab">Selected Day<button class="bkv2-selhide" onclick="bookingV2TogglePanel()" title="พับแผงนี้">&rsaquo;&rsaquo;</button></div>
      <div class="bkv2-selday-ttl">${dateLbl}${isToday?'<span class="bkv2-selday-today">Today</span>':''}</div>
      <div class="bkv2-week-summary">
        <div>
          <div class="ws-lab">This week (${weekStartLbl}–${weekEndLbl})</div>
          <div class="ws-meta">Avg ${avgPerDay} pax/day &middot; ${weekTrips} trips</div>
        </div>
        <div style="text-align:right">
          <div class="ws-total">${weekPax}</div>
          <div class="ws-totlab">Week total</div>
        </div>
      </div>
      ${routesHtml || '<div class="bkv2-rd-empty-msg">No routes ran on this day</div>'}
      ${lockRouteSection}
      <div class="bkv2-rd-actions">
        <button onclick="bookingV2OpenFiltered('','${sel.date}')" class="pri">Open day's bookings &rarr;</button>
      </div>
    </div>
  `;
}
