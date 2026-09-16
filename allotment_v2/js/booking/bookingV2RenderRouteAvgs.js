// Per-route avg cards row with Weekly/Daily/Total toggle
function bookingV2RenderRouteAvgs(){
  const cur = _bkV2.cursor;
  const ym = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}`;
  const agg = bookingV2Aggregate();
  const lastDay = new Date(cur.getFullYear(), cur.getMonth()+1, 0).getDate();
  const weeksInMonth = Math.max(1, Math.ceil(lastDay / 7));

  // Aggregate per route for the month
  const perRoute = {};
  bookingV2Routes().forEach(rd => { perRoute[rd.id] = { pax:0, daysRan:0, bookings:0 }; });
  Object.entries(agg.byDate).forEach(([d, day]) => {
    if(!d.startsWith(ym)) return;
    Object.entries(day.routes).forEach(([rid, r]) => {
      if(!perRoute[rid]) perRoute[rid] = { pax:0, daysRan:0, bookings:0 };
      perRoute[rid].pax += r.total;
      perRoute[rid].daysRan += (r.total > 0 ? 1 : 0);
    });
  });
  // bookings count per route this month
  const bkPerRoute = {};
  SB_BOOKINGS.forEach(bk => {
    if(bk.schemaVer === 2 && Array.isArray(bk.trips)){
      bk.trips.forEach(t => {
        if(t.date && t.date.startsWith(ym)){
          if(!bkPerRoute[t.routeId]) bkPerRoute[t.routeId] = new Set();
          bkPerRoute[t.routeId].add(bk.id);
        }
      });
    } else if(bk.travelDate && bk.travelDate.startsWith(ym) && bk.programId){
      if(!bkPerRoute[bk.programId]) bkPerRoute[bk.programId] = new Set();
      bkPerRoute[bk.programId].add(bk.id);
    }
  });
  Object.entries(bkPerRoute).forEach(([rid, set]) => {
    if(perRoute[rid]) perRoute[rid].bookings = set.size;
  });

  const mode = _bkV2.avgMode || 'week';
  const modeLab = { week:'pax /week', day:'pax /day', total:'pax total' }[mode];
  const sub = { week:'÷ weeks in month', day:'÷ days route ran', total:'sum of all pax' }[mode];

  const routeColor = (rid) => {
    const r = (typeof ROUTES !== 'undefined') ? ROUTES.find(rr => rr.id === rid) : null;
    return r?.color || '#9C9C95';
  };

  // Aggregate by family · sum sub-routes
  // §cityTourView · Transfer/City Tour are real families (§routeKind) · marine page (flag off)
  //   excludes them · land page (flag on) shows only them
  const cards = bookingV2Families().filter(fam => {
    if(typeof laIsLandRoute!=='function') return true;
    const _famIsLand = (bookingV2FamilyRoutes(fam.id)||[]).some(rd => laIsLandRoute(rd.id));
    return _famIsLand === _bkV2CityTourOnly;
  }).map(fam => {
    const subRoutes = bookingV2FamilyRoutes(fam.id);
    let pax = 0, daysRan = 0, bookings = 0;
    const dayRanSet = new Set();
    const bkSet = new Set();
    subRoutes.forEach(rd => {
      const p = perRoute[rd.id] || { pax:0, daysRan:0, bookings:0 };
      pax += p.pax;
    });
    // Recompute daysRan + bookings at family level (any sub-route running = family day)
    Object.entries(agg.byDate).forEach(([d, day]) => {
      if(!d.startsWith(ym)) return;
      const famHadActivity = subRoutes.some(rd => (day.routes[rd.id]?.total || 0) > 0);
      if(famHadActivity) dayRanSet.add(d);
    });
    daysRan = dayRanSet.size;
    SB_BOOKINGS.forEach(bk => {
      if(bk.schemaVer === 2 && Array.isArray(bk.trips)){
        bk.trips.forEach(t => {
          if(t.date && t.date.startsWith(ym) && bookingV2RouteFamily(t.routeId)?.id === fam.id){
            bkSet.add(bk.id);
          }
        });
      } else if(bk.travelDate && bk.travelDate.startsWith(ym) && bk.programId){
        if(bookingV2RouteFamily(bk.programId)?.id === fam.id) bkSet.add(bk.id);
      }
    });
    bookings = bkSet.size;

    let val = 0;
    if(mode === 'week') val = Math.round(pax / weeksInMonth);
    else if(mode === 'day') val = daysRan > 0 ? Math.round(pax / daysRan) : 0;
    else val = pax;

    return `
      <div class="bkv2-route-card" style="border-left-color:${fam.color}">
        <div class="rc-name">${fam.name}</div>
        <div class="rc-meta">${bookings} bookings &middot; ${daysRan} day${daysRan===1?'':'s'} ran &middot; ${subRoutes.length} variant${subRoutes.length===1?'':'s'}</div>
        <div class="rc-row">
          <div class="rc-unit">${modeLab}</div>
          <div class="rc-val">${val}</div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="bkv2-routes">
      <div class="bkv2-routes-hd">
        <span class="bkv2-routes-ttl">Avg pax &middot; per program</span>
        <span class="bkv2-routes-sub">${sub}</span>
        <div class="bkv2-mode">
          <button class="bkv2-mode-btn ${mode==='week'?'on':''}" onclick="bookingV2SetAvgMode('week')">Weekly</button>
          <button class="bkv2-mode-btn ${mode==='day'?'on':''}" onclick="bookingV2SetAvgMode('day')">Daily</button>
          <button class="bkv2-mode-btn ${mode==='total'?'on':''}" onclick="bookingV2SetAvgMode('total')">Total</button>
        </div>
      </div>
      <div class="bkv2-routes-grid">${cards}</div>
    </div>
  `;
}
