// ── Tab 3 · All bookings (existing Linear list) ──
function bookingV2RenderTab3(){
  const escapeHTML = s => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  // §cityTourView · a booking that mixes trip types is shown on BOTH pages (marine page: any trip is marine · land page: any trip is land) — intentional simplification, not a bug. No trips at all → treated as marine (matches this booking's behavior before this filter existed).
  const _srcBookings = (typeof laIsLandRoute!=='function') ? SB_BOOKINGS : SB_BOOKINGS.filter(bk => (bk.schemaVer===2 ? ((bk.trips&&bk.trips.length) ? bk.trips.some(t=>laIsLandRoute(t&&t.routeId)===_bkV2CityTourOnly) : !_bkV2CityTourOnly) : (laIsLandRoute(bk.programId)===_bkV2CityTourOnly)));
  const all = _srcBookings.map(bookingV2Norm).sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||'') || String(b.id||'').localeCompare(String(a.id||'')));   // newest first · tiebreak by BK number (running counter) so same-day bookings show latest on top
  const kCount = all.length;
  const kConfirmed = all.filter(b=>b.status==='confirmed').length;
  // Pending FOC = any OPEN booking (quote/pending) that has FOC seats and isn't FOC-approved yet · "awaiting approval"
  const isPendingFoc = b => b.focCount>0 && !b.focApproved && ['quote','pending','pending_foc'].includes(b.status);
  const kPendingFoc = all.filter(isPendingFoc).length;
  const kQuote = all.filter(b=>b.status==='quote').length;
  const kConfirmedRev = all.filter(b=>b.status==='confirmed').reduce((s,b)=>s+b.total,0);
  const q = (_bkV2.search||'').toLowerCase().trim();
  const kB2C = all.filter(b=>b.id.startsWith('b2c_')).length;
  // §bkMonthPage · everything EXCEPT the month cut · the month chips count these, so their numbers always
  // reflect the status pill you are actually on rather than an all-time total.
  const preMonth = all.filter(b => {
    if(_bkV2.statusFilter === 'pending_foc'){ if(!isPendingFoc(b)) return false; }
    else if(_bkV2.statusFilter === 'b2c'){ if(!b.id.startsWith('b2c_')) return false; }
    else if(_bkV2.statusFilter !== 'all' && b.status !== _bkV2.statusFilter) return false;
    if(q){
      const blob = `${b.id} ${b.voucherRef} ${b.leadPax} ${b.leadPhone} ${b.agentName} ${b.agentSub} ${b.tripSummary}`.toLowerCase();
      if(!blob.includes(q)) return false;
    }
    return true;
  });
  const pills = [
    {k:'all', label:'All', n:all.length},
    {k:'b2c', label:'B2C', n:kB2C},
    {k:'quote', label:'Quote', n:kQuote},
    {k:'pending_foc', label:'Pending FOC', n:kPendingFoc},
    {k:'confirmed', label:'Confirmed', n:kConfirmed},
    {k:'completed', label:'Completed', n:all.filter(b=>b.status==='completed').length},
    {k:'rejected', label:'Rejected', n:all.filter(b=>b.status==='rejected').length}
  ];

  // §bkMonthPage (2026-09-03) · the list is paginated by TRAVEL MONTH, not by page number — "‹ September 2026 ›"
  // is what staff actually think in, and it survives new bookings landing at the top (a numbered page silently
  // reshuffles under you when the data grows; a month does not).
  const monthCounts = new Map();
  for(const b of preMonth){ const k = bookingV2MonthKey(b.travelDate); if(k) monthCounts.set(k, (monthCounts.get(k)||0)+1); }
  const months = [...monthCounts.keys()].sort().reverse();            // newest month first · drives the chip strip
  // Calendar span of ALL data (not just months that survived the filter) so ‹ › can step across a quiet month.
  const spanMonths = [...new Set(all.map(b => bookingV2MonthKey(b.travelDate)).filter(Boolean))].sort();
  const monthMin = spanMonths[0] || '', monthMax = spanMonths[spanMonths.length-1] || '';
  const thisMonth = bookingV2MonthKey(bookingV2LocalYMD(new Date()));
  let month = _bkV2.month || (monthCounts.has(thisMonth) ? thisMonth : (months[0] || thisMonth));
  if(!q) _bkV2.month = month;    // remember the browsed month — but never let a search overwrite it
  if(q) month = 'all';           // a search has to reach every month, not only the one you happen to be sitting on
  const monthRows = month === 'all' ? preMonth : preMonth.filter(b => bookingV2MonthKey(b.travelDate) === month);
  // Travel-date order, now that a "page" IS a travel month · newest trip first, tiebreak by booking recency.
  const filtered = monthRows.slice().sort((a,b) =>
    String(b.travelDate||'').localeCompare(String(a.travelDate||'')) ||
    String(b.createdAt||'').localeCompare(String(a.createdAt||'')));

  // §bkPage · safety net only · a normal month is well under pageSize so no pager shows at all. 'All time'
  // and freak months still get sliced, because the row template below does O(SB_BOOKINGS) work per row.
  const pageSize = _bkV2.pageSize === 'all' ? Math.max(filtered.length, 1) : _bkV2.pageSize;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(Math.max(1, _bkV2.page || 1), pageCount);   // clamp · a filter change can shrink the list under the current page
  _bkV2.page = page;
  const from = (page - 1) * pageSize;
  const pageRows = filtered.slice(from, from + pageSize);
  // One id→record map instead of an SB_BOOKINGS.find() per row (that find was O(n) inside an O(n) map).
  const rawById = new Map((SB_BOOKINGS||[]).map(b => [b.id, b]));

  return `
    <div class="bkv2-kpis">
      <div class="bkv2-kpi"><div class="bkv2-kpi-lab">Total</div><div class="bkv2-kpi-val">${kCount}</div><div class="bkv2-kpi-foot">all time</div></div>
      <div class="bkv2-kpi"><div class="bkv2-kpi-lab">Confirmed</div><div class="bkv2-kpi-val" style="color:#0f6e56">${kConfirmed}</div><div class="bkv2-kpi-foot">&#3647;${bookingV2FmtTHB(kConfirmedRev)} booked</div></div>
      <div class="bkv2-kpi warn"><div class="bkv2-kpi-lab">Pending FOC</div><div class="bkv2-kpi-val">${kPendingFoc}</div><div class="bkv2-kpi-foot">awaiting approval</div></div>
      <div class="bkv2-kpi"><div class="bkv2-kpi-lab">Quote</div><div class="bkv2-kpi-val" style="color:var(--ink-soft)">${kQuote}</div><div class="bkv2-kpi-foot">not yet confirmed</div></div>
    </div>
    <div class="bkv2-filterbar">
      ${pills.map(p => `<span class="bkv2-pill ${_bkV2.statusFilter===p.k?'on':''}" data-st="${p.k}" onclick="bookingV2SetFilter('${p.k}')"><span class="dot"></span>${p.label} &middot; ${p.n}</span>`).join('')}
      <input class="bkv2-search" id="bkv2-search-input" placeholder="ค้นหา &middot; VC &middot; ชื่อลูกค้า &middot; เบอร์ &middot; BK &middot; agent &middot; trip" value="${escapeHTML(_bkV2.search)}" oninput="bookingV2SetSearch(this.value)">
    </div>
    ${bookingV2MonthBarHtml({month, months, monthCounts, monthMin, monthMax, allTotal: preMonth.length, searching: !!q})}
    ${filtered.length === 0 ? `
      <div class="bkv2-empty">
        <div class="ttl">${q ? 'No bookings match' : `No trips in ${bookingV2MonthLabel(month)}`}</div>
        <div class="sub">${_bkV2.search?`Nothing for &quot;${escapeHTML(_bkV2.search)}&quot;`:'Step to another month above, or pick All time'}</div>
        <button class="bkv2-newbtn" onclick="bookingV2NewBooking()" style="display:inline-flex">+ New booking</button>
      </div>
    ` : `
      <table class="bkv2-tbl">
        <thead><tr><th style="width:120px">BOOKING</th><th>AGENT</th><th>TRIP</th><th>TRAVEL</th><th class="num">PAX</th><th class="num">TOTAL</th><th>STATUS</th></tr></thead>
        <tbody>
          ${pageRows.map(b => `
            <tr onclick="bookingV2OpenDetail('${b.id}')">
              <td><div class="bk-id">${b.id.startsWith('b2c_') ? escapeHTML(bookingV2DisplayCode(b)) : b.id}</div><div class="trip-date">created ${bookingV2FmtDate(b.createdAt)}</div>${b.id.startsWith('b2c_')?'<span style="display:inline-block;margin-top:3px;background:#E6F7F9;color:#0E7D8A;font-size:9px;font-weight:700;padding:1px 6px;border-radius:4px;letter-spacing:.03em">'+bookingV2B2CMark(11)+'Love Andaman</span>':''}${(function(){ const _o=rawById.get(b.id); if(!_o||['cancelled','rejected','cancelled_weather'].includes(_o.status)||typeof bookingV2FindDuplicateBookings!=='function')return''; const _dd=bookingV2FindDuplicateBookings(_o,_o.id); if(!_dd.length)return''; const _vc=_dd.map(x=>x.bk.voucherRef||x.bk.code||x.bk.id).slice(0,3).join(', '); const _rs=[...new Set(_dd.reduce((a,x)=>a.concat(x.reasons),[]))].join(' · '); return `<div title="อาจซ้ำกับ: ${escapeHTML(_vc)} (${escapeHTML(_rs)})" style="display:inline-block;margin-top:3px;background:#FBE9D6;color:#9A5B00;font-size:9px;font-weight:700;padding:1px 6px;border-radius:4px;cursor:help">&#9888; อาจซ้ำ</div>`; })()}</td>
              <td><div class="agent-name">${escapeHTML(b.agentName)}</div><div class="agent-rt">${escapeHTML(b.agentSub)}</div></td>
              <td><div class="trip-name">${escapeHTML(b.tripSummary)}</div></td>
              <td><div class="trip-date">${bookingV2FmtDate(b.travelDate)}</div></td>
              <td class="num"><div class="pax-total">${b.paxTotal}</div><div class="pax-break">${b.paxBreak}</div></td>
              <td class="num"><div class="price">&#3647;${bookingV2FmtTHB(b.total)}</div></td>
              <td><span class="bkv2-chip ${b.status}"><span class="dot"></span>${bookingV2StatusLabel(b.status)}</span>${b.focCount > 0 ? `<span class="bkv2-foc-flag">FOC ${b.focCount}</span>` : ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `}
    ${pageCount <= 1 ? '' : bookingV2PagerHtml(page, pageCount, from, pageRows.length, filtered.length)}
    <div class="bkv2-foot-hints">
      <span class="gp"><span class="bkv2-kbd">${'⌘'}K</span>commands</span>
      <span class="gp"><span class="bkv2-kbd">C</span>new booking</span>
      <span class="gp"><span class="bkv2-kbd">/</span>search</span>
      <span style="margin-left:auto;font-style:italic">Showing ${filtered.length} of ${kCount}${month==='all'||q?'':` &middot; ${bookingV2MonthLabel(month)}`}</span>
    </div>
  `;
}
