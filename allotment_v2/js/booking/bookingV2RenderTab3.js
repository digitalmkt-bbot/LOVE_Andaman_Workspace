// ── Tab 3 · All bookings (existing Linear list) ──
function bookingV2RenderTab3(){
  // The list is travel-month scoped in operation-backend mode. Its former
  // all-history source was the boot preload; request only the month staff open.
  const _initialMonth=_bkV2.month || bookingV2MonthKey(bookingV2LocalYMD(new Date()));
  if(_initialMonth!=='all' && typeof bookingV2OpsEnsureMonth==='function'){
    const _monthLoad=bookingV2OpsEnsureMonth(_initialMonth);
    if(_monthLoad) _monthLoad.then(function(j){
      if(j && _bkV2.tab==='all' && _bkV2.month===_initialMonth && !_bkV2.newBooking) bookingV2Render();
    });
  }
  // In operation-backend mode, ensure summary (stats + month-counts) is requested so
  // KPIs, pills, and the month strip reflect all bookings, matching legacy behavior.
  if(typeof bookingV2OpsEnsureSummary==='function'){
    const _sumLoad=bookingV2OpsEnsureSummary();
    if(_sumLoad) _sumLoad.then(function(j){
      if(j && _bkV2.tab==='all' && !_bkV2.newBooking) bookingV2Render();
    });
  }
  if(_initialMonth==='all' && typeof bookingV2OpsEnsureAll==='function'){
    const _allLoad=bookingV2OpsEnsureAll();
    if(_allLoad) _allLoad.then(function(j){
      if(j && _bkV2.tab==='all' && _bkV2.month==='all' && !_bkV2.newBooking) bookingV2Render();
    });
  }
  const escapeHTML = s => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  // §cityTourView · a booking that mixes trip types is shown on BOTH pages (marine page: any trip is marine · land page: any trip is land) — intentional simplification, not a bug. No trips at all → treated as marine (matches this booking's behavior before this filter existed).
  const _srcBookings = (typeof laIsLandRoute!=='function') ? SB_BOOKINGS : SB_BOOKINGS.filter(bk => (bk.schemaVer===2 ? ((bk.trips&&bk.trips.length) ? bk.trips.some(t=>laIsLandRoute(t&&t.routeId)===_bkV2CityTourOnly) : !_bkV2CityTourOnly) : (laIsLandRoute(bk.programId)===_bkV2CityTourOnly)));
  let all = _srcBookings.map(bookingV2Norm).sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||'') || String(b.id||'').localeCompare(String(a.id||'')));   // newest first · tiebreak by BK number (running counter) so same-day bookings show latest on top

  // In ops mode, all-time aggregate stats come from /v1/bookings/stats.
  const _opsActive = !!(window.laOps && window.laOps.enabled && window.laOps.enabled());
  const _Stats = _opsActive ? window._opsAllStats : null;
  const _opsStatsLoading = _opsActive && !_Stats;
  const _opsAllLoadingDisplay = _opsStatsLoading ? '\u2026' : null;

  const kCount = _opsAllLoadingDisplay ? _opsAllLoadingDisplay : (_Stats ? _Stats.total : all.length);
  const kConfirmed = _Stats ? ((_Stats.by_status||{}).confirmed||0) : all.filter(b=>b.status==='confirmed').length;
  // Pending FOC = any OPEN booking (quote/pending) that has FOC seats and isn't FOC-approved yet · "awaiting approval"
  /* w6-a: the list row's own flag from the server (GET /v1/bookings pending_foc) wins; a row without it keeps the browser's test */
  const isPendingFoc = b => { const _pf=window.laOpsRowPendingFoc?window.laOpsRowPendingFoc(b.id):null; return _pf!=null ? _pf : (b.focCount>0 && !b.focApproved && ['quote','pending','pending_foc'].includes(b.status)); };
  const kPendingFoc = (_Stats && _Stats.pending_foc_count != null) ? _Stats.pending_foc_count : (_Stats ? ((_Stats.by_status||{}).pending_foc||0) : all.filter(isPendingFoc).length);   /* §opsBookingList · the server's own count of the rule (quote/pending/pending_foc with FOC seats not yet approved), not the status count */
  const kQuote = _Stats ? ((_Stats.by_status||{}).quote||0) : all.filter(b=>b.status==='quote').length;
  const kConfirmedRev = _Stats ? (_Stats.confirmed_revenue||0) : all.filter(b=>b.status==='confirmed').reduce((s,b)=>s+b.total,0);
  const q = (_bkV2.search||'').toLowerCase().trim();
  const kB2C = _Stats ? (_Stats.b2c_count||0) : all.filter(b=>b.id.startsWith('b2c_')).length;
  const kCompleted = _Stats ? ((_Stats.by_status||{}).completed||0) : all.filter(b=>b.status==='completed').length;
  const kRejected = _Stats ? ((_Stats.by_status||{}).rejected||0) : all.filter(b=>b.status==='rejected').length;
  // Legacy foot is always 'all time'
  const _opsAllLabel = _opsStatsLoading ? 'Loading\u2026' : 'all time';

  // §bkMonthPage · everything EXCEPT the month cut · the month chips count these, so their numbers always
  // reflect the status pill you are actually on rather than an all-time total.
  /* §opsBookingList · who matches the Pending-FOC pill and the search is the server's answer (GET /v1/bookings?pending_foc=true / ?q=); null = not here yet, legacy's own test runs */
  const _srvPF = (_bkV2.statusFilter === 'pending_foc' && window.laOpsListSet) ? window.laOpsListSet('pending_foc') : null;
  const _srvQ = (q && window.laOpsListSet) ? window.laOpsListSet('q', q) : null;
  const preMonth = all.filter(b => {
    if(_bkV2.statusFilter === 'pending_foc'){ if(_srvPF ? !_srvPF.has(b.id) : !isPendingFoc(b)) return false; }
    else if(_bkV2.statusFilter === 'b2c'){ if(!b.id.startsWith('b2c_')) return false; }
    else if(_bkV2.statusFilter !== 'all' && b.status !== _bkV2.statusFilter) return false;
    if(q && _srvQ){ if(!_srvQ.has(b.id)) return false; }
    else if(q){
      const blob = `${b.id} ${b.voucherRef} ${b.leadPax} ${b.leadPhone} ${b.agentName} ${b.agentSub} ${b.tripSummary}`.toLowerCase();
      if(!blob.includes(q)) return false;
    }
    return true;
  });
  const pills = [
    {k:'all', label:'All', n:_opsStatsLoading ? '\u2026' : (_Stats ? _Stats.total : all.length)},
    {k:'b2c', label:'B2C', n:_opsStatsLoading ? '\u2026' : kB2C},
    {k:'quote', label:'Quote', n:_opsStatsLoading ? '\u2026' : kQuote},
    {k:'pending_foc', label:'Pending FOC', n:_opsStatsLoading ? '\u2026' : kPendingFoc},
    {k:'confirmed', label:'Confirmed', n:_opsStatsLoading ? '\u2026' : kConfirmed},
    {k:'completed', label:'Completed', n:_opsStatsLoading ? '\u2026' : kCompleted},
    {k:'rejected', label:'Rejected', n:_opsStatsLoading ? '\u2026' : kRejected}
  ];

  // §bkMonthPage (2026-09-03) · the list is paginated by TRAVEL MONTH, not by page number — "‹ September 2026 ›"
  // is what staff actually think in, and it survives new bookings landing at the top (a numbered page silently
  // reshuffles under you when the data grows; a month does not).
  // In ops mode, month counts come from GET /v1/bookings/month-counts so the strip shows all months.
  const _ApiMonths = (_opsActive && window._opsAllMonthCounts) ? window._opsAllMonthCounts.months : null;
  var monthCounts, months, spanMonths, monthMin, monthMax;
  if(_ApiMonths && _ApiMonths.length){
    monthCounts = new Map(); _ApiMonths.forEach(function(m){ monthCounts.set(m.month, m.count); });
    months = _ApiMonths.map(m=>m.month).sort().reverse();
    spanMonths = _ApiMonths.map(m=>m.month).filter(Boolean).sort();
  }else{
    monthCounts = new Map();
    for(const b of preMonth){ var k=bookingV2MonthKey(b.travelDate); if(k) monthCounts.set(k, (monthCounts.get(k)||0)+1); }
    months = [...monthCounts.keys()].sort().reverse();
    spanMonths = [...new Set(all.map(b => bookingV2MonthKey(b.travelDate)).filter(Boolean))].sort();
  }
  monthMin = spanMonths[0] || ''; monthMax = spanMonths[spanMonths.length-1] || '';
  const thisMonth = bookingV2MonthKey(bookingV2LocalYMD(new Date()));
  let month = _bkV2.month || (monthCounts.has(thisMonth) ? thisMonth : (months[0] || thisMonth));
  if(!q) _bkV2.month = month;    // remember the browsed month — but never let a search overwrite it
  if(q) month = 'all';           // a search has to reach every month, not only the one you happen to be sitting on
  const monthRows = month === 'all' ? preMonth : preMonth.filter(b => bookingV2MonthKey(b.travelDate) === month);
  // One id→record map instead of an SB_BOOKINGS.find() per row (that find was O(n) inside an O(n) map).
  const rawById = new Map((SB_BOOKINGS||[]).map(b => [b.id, b]));
  /* §bkActivity (2026-10-14) · owner "ขอให้ไล่เรียงแบบล่าสุด กรณีที่มีแก้ไขให้ขึ้นอัพเดทด้วย" · design A
     เรียงได้สามแบบ · ค่าเริ่มต้น "ความเคลื่อนไหวล่าสุด" = ใบที่เพิ่งสร้าง/แก้/ยกเลิก/FOC ขึ้นบนสุด
     อ่านจาก history[] (บันทึกทุกครั้งที่สร้าง แก้ ยกเลิก) + updatedAt + createdAt ที่มีอยู่แล้ว ไม่แตะฐานข้อมูล
     ยังกรองตามเดือนเดินทางที่เลือกเหมือนเดิม · "All time" คือทุกใบ */
  const sortMode = bookingV2SortMode();
  const actOf = new Map();
  for(const b of monthRows) actOf.set(b.id, bookingV2LastAct(rawById.get(b.id), b));
  const _actAt = b => String((actOf.get(b.id)||{}).at||'');
  const filtered = monthRows.slice().sort((a,b) =>
    sortMode === 'travel'
      ? (String(b.travelDate||'').localeCompare(String(a.travelDate||'')) || String(b.createdAt||'').localeCompare(String(a.createdAt||'')))
    : sortMode === 'created'
      ? (String(b.createdAt||'').localeCompare(String(a.createdAt||'')) || String(b.id||'').localeCompare(String(a.id||'')))
      : (_actAt(b).localeCompare(_actAt(a)) || String(b.createdAt||'').localeCompare(String(a.createdAt||''))));

  // §bkPage · safety net only · a normal month is well under pageSize so no pager shows at all. 'All time'
  // and freak months still get sliced, because the row template below does O(SB_BOOKINGS) work per row.
  const pageSize = _bkV2.pageSize === 'all' ? Math.max(filtered.length, 1) : _bkV2.pageSize;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(Math.max(1, _bkV2.page || 1), pageCount);   // clamp · a filter change can shrink the list under the current page
  _bkV2.page = page;
  const from = (page - 1) * pageSize;
  const pageRows = filtered.slice(from, from + pageSize);
  /* §bkActivity · คีย์สำหรับจัดกลุ่มเป็นวัน · โหมดวันเดินทางใช้วันเดินทาง · อีกสองโหมดใช้วันตามเวลาท้องถิ่น */
  const _dayKeyOf = b => sortMode === 'travel' ? String(b.travelDate||'').slice(0,10)
    : bookingV2LocalDayKey(sortMode === 'created' ? b.createdAt : (actOf.get(b.id)||{}).at);
  const _CXL = ['cancelled','cancelled_weather','rejected'];
  const _todayK = bookingV2LocalYMD(new Date());
  const _soonK = bookingV2LocalYMD(new Date(Date.now() + 2*86400000));
  const _rowHtml = (b, i) => {
    const act = actOf.get(b.id) || {};
    const dk = _dayKeyOf(b), pk = i ? _dayKeyOf(pageRows[i-1]) : null;
    const dayRow = dk !== pk ? `<tr class="bkv2-day"><td colspan="8">${sortMode==='travel'?'เดินทาง ':''}${bookingV2DayLabel(dk, sortMode!=='travel')}</td></tr>` : '';
    const _sl = window.laOpsListFlags ? window.laOpsListFlags(rawById.get(b.id)) : null;   /* §opsBookingList · the server's chips for this row, or null */
    const fresh = _sl ? _sl.isNew : (!!b.createdAt && (Date.now() - new Date(b.createdAt).getTime()) < 86400000 && !_CXL.includes(b.status));
    const isCxl = _CXL.includes(b.status);
    const edited = !!act.kind && act.kind !== 'create';
    const tags = (fresh ? '<span class="bkv2-tag new">ใหม่</span>' : '')
      + (isCxl ? `<span class="bkv2-tag cxl">ยกเลิก ${bookingV2FmtDate(act.at)}</span>`
        : edited ? `<span class="bkv2-tag upd">แก้ไข ${bookingV2FmtDate(act.at)}</span>`
        : `<span>created ${bookingV2FmtDate(b.createdAt)}</span>`)
      + (b.id.startsWith('b2c_') ? '<span class="bkv2-tag b2c">'+bookingV2B2CMark(10)+'B2C</span>' : '')
      + (function(){ /* ป้าย "อาจซ้ำ" ของเดิม · คงไว้ */
          const _o=rawById.get(b.id); if(!_o||_CXL.includes(_o.status)||typeof bookingV2FindDuplicateBookings!=='function') return '';
          /* §opsBookingList · ops mode: the server's duplicates for this row (same rule, its reasons in legacy's Thai) */
          const _dd=_sl ? (_sl.duplicates||[]).map(x=>({bk:{voucherRef:x.voucher_ref,code:x.code,id:x.booking_id},reasons:x.reasons||[]})) : bookingV2FindDuplicateBookings(_o,_o.id); if(!_dd.length) return '';
          const _vc=_dd.map(x=>x.bk.voucherRef||x.bk.code||x.bk.id).slice(0,3).join(', ');
          const _rs=[...new Set(_dd.reduce((a,x)=>a.concat(x.reasons),[]))].join(' · ');
          return `<span class="bkv2-tag dup" title="อาจซ้ำกับ: ${escapeHTML(_vc)} (${escapeHTML(_rs)})">&#9888; อาจซ้ำ</span>`; })();
    const tvK = String(b.travelDate||'').slice(0,10);
    const soon = _sl ? _sl.isSoon : (!isCxl && tvK >= _todayK && tvK <= _soonK);   /* §opsBookingList */
    const actTxt = act.kind === 'create' ? 'สร้างใบจอง' : (act.text || bookingV2ActKindLabel(act.kind));
    return dayRow + `
            <tr class="bkr ${b.status}${fresh?' fresh':''}" data-id="${escapeHTML(b.id)}" onclick="bookingV2OpenDetail('${b.id}')">
              <td><div class="bk-id">${b.id.startsWith('b2c_') ? escapeHTML(bookingV2DisplayCode(b)) : b.id}</div><div class="bk-sub">${tags}</div></td>
              <td><div class="agent-name">${escapeHTML(b.agentName)}</div><div class="agent-rt">${escapeHTML(b.agentSub)}</div></td>
              <td><div class="trip-name">${escapeHTML(b.tripSummary)}</div><div class="trip-pax">${b.paxBreak}</div></td>
              <td><div class="tv-date${soon?' soon':''}">${bookingV2FmtDate(b.travelDate)}<span class="dow">${bookingV2Dow(b.travelDate)}</span></div>${soon?`<div class="tv-soon">${(_sl ? _sl.isToday : tvK===_todayK)?'วันนี้':'ใกล้ถึง'}</div>`:''}</td>
              <td class="num"><div class="pax-total">${b.paxTotal}</div></td>
              <td class="num"><div class="price${b.total?'':' zero'}">&#3647;${bookingV2FmtTHB(b.total)}</div></td>
              <td><span class="bkv2-chip ${b.status}"><span class="dot"></span>${bookingV2StatusLabel(b.status)}</span>${b.focCount > 0 ? `<span class="bkv2-foc-flag">FOC ${b.focCount}</span>` : ''}</td>
              <td><div class="act" title="${escapeHTML(actTxt)}"><b><span class="ic ${escapeHTML(act.kind||'note')}">${bookingV2ActIcon(act.kind)}</span>${escapeHTML(actTxt)}</b>${bookingV2RelTime(act.at)}${act.at?' · '+bookingV2FmtClock(act.at):''}${act.by?` <span class="by">· ${escapeHTML(act.by)}</span>`:''}</div></td>
            </tr>`;
  };

  return `
    <div class="bkv2-kpis">
      <div class="bkv2-kpi"><div class="bkv2-kpi-lab">Total</div><div class="bkv2-kpi-val">${kCount}</div><div class="bkv2-kpi-foot">${_opsAllLabel}</div></div>
      <div class="bkv2-kpi"><div class="bkv2-kpi-lab">Confirmed</div><div class="bkv2-kpi-val" style="color:#0f6e56">${kConfirmed}</div><div class="bkv2-kpi-foot">&#3647;${bookingV2FmtTHB(kConfirmedRev)} booked</div></div>
      <div class="bkv2-kpi warn"><div class="bkv2-kpi-lab">Pending FOC</div><div class="bkv2-kpi-val">${kPendingFoc}</div><div class="bkv2-kpi-foot">awaiting approval</div></div>
      <div class="bkv2-kpi"><div class="bkv2-kpi-lab">Quote</div><div class="bkv2-kpi-val" style="color:var(--ink-soft)">${kQuote}</div><div class="bkv2-kpi-foot">not yet confirmed</div></div>
    </div>
    <div class="bkv2-filterbar">
      ${pills.map(p => `<span class="bkv2-pill ${_bkV2.statusFilter===p.k?'on':''}" data-st="${p.k}" onclick="bookingV2SetFilter('${p.k}')"><span class="dot"></span>${p.label} &middot; ${p.n}</span>`).join('')}
      <input class="bkv2-search" id="bkv2-search-input" placeholder="ค้นหา &middot; VC &middot; ชื่อลูกค้า &middot; เบอร์ &middot; BK &middot; agent &middot; trip" value="${escapeHTML(_bkV2.search)}" oninput="bookingV2SetSearch(this.value)">
    </div>
    <div class="bkv2-sortbar">
      <span class="lb">เรียงตาม</span>
      <div class="bkv2-seg">
        <button class="${sortMode==='activity'?'on':''}" onclick="bookingV2SetSort('activity')">&#9889; ความเคลื่อนไหวล่าสุด</button>
        <button class="${sortMode==='travel'?'on':''}" onclick="bookingV2SetSort('travel')">&#128197; วันเดินทาง</button>
        <button class="${sortMode==='created'?'on':''}" onclick="bookingV2SetSort('created')">&#127381; วันที่สร้าง</button>
      </div>
      <span class="hint">${sortMode==='activity'?'ใบที่เพิ่งสร้าง แก้ไข หรือยกเลิก ขึ้นบนสุด · จัดกลุ่มเป็นวัน':sortMode==='travel'?'ทริปใกล้สุดขึ้นก่อน · จัดกลุ่มเป็นวันเดินทาง':'ใบที่สร้างล่าสุดขึ้นก่อน · ไม่สนว่าแก้ไขเมื่อไหร่'}</span>
    </div>
    ${bookingV2MonthBarHtml({month, months, monthCounts, monthMin, monthMax, allTotal: _Stats ? _Stats.total : preMonth.length, searching: !!q})}
    ${filtered.length === 0 ? `
      <div class="bkv2-empty">
        <div class="ttl">${q ? 'No bookings match' : `No trips in ${bookingV2MonthLabel(month)}`}</div>
        <div class="sub">${_bkV2.search?`Nothing for &quot;${escapeHTML(_bkV2.search)}&quot;`:'Step to another month above, or pick All time'}</div>
        <button class="bkv2-newbtn" onclick="bookingV2NewBooking()" style="display:inline-flex">+ New booking</button>
      </div>
    ` : `
      <table class="bkv2-tbl">
        <thead><tr><th style="width:168px">BOOKING</th><th>AGENT</th><th>TRIP</th><th style="width:110px">TRAVEL</th><th class="num" style="width:60px">PAX</th><th class="num" style="width:100px">TOTAL</th><th style="width:150px">STATUS</th><th style="width:240px">ACTIVITY &middot; ล่าสุด</th></tr></thead>
        <tbody>
          ${pageRows.map(_rowHtml).join('')}
        </tbody>
      </table>
    `}
    ${pageCount <= 1 ? '' : bookingV2PagerHtml(page, pageCount, from, pageRows.length, filtered.length)}
    <div class="bkv2-foot-hints">
      <span class="gp"><span class="bkv2-kbd">${'⌘'}K</span>commands</span>
      <span class="gp"><span class="bkv2-kbd">C</span>new booking</span>
      <span class="gp"><span class="bkv2-kbd">/</span>search</span>
      <span style="margin-left:auto;font-style:italic">Showing ${filtered.length} of ${kCount}${_opsStatsLoading||month==='all'||q?'':` &middot; ${bookingV2MonthLabel(month)}`}</span>
    </div>
  `;
}
