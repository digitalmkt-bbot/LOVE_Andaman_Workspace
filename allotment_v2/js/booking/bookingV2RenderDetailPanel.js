// ── Tab 1 · shared detail panel ──
function bookingV2RenderDetailPanel(){
  const sel = _bkV2.selected;
  if(!sel){
    return `<div class="bkv2-detail" style="border-color:var(--border);background:var(--sand-mid);text-align:center"><div style="font-size:12px;color:var(--ink-soft);padding:14px 0">Click a cell to see breakdown &middot; AD &middot; CHD &middot; INF &middot; FOC + PK &middot; KL &middot; NT</div></div>`;
  }
  const agg = bookingV2Aggregate();
  const x = agg.byDate[sel.date];
  if(!x){
    return `<div class="bkv2-detail" style="border-color:var(--border);background:var(--sand-mid);text-align:center"><div style="font-size:12px;color:var(--ink-soft);padding:14px 0">No bookings for ${bookingV2FmtDate(sel.date)}</div></div>`;
  }
  const dt = new Date(sel.date + 'T00:00');
  const dateLbl = dt.toLocaleDateString('en-US', { weekday:'short', day:'2-digit', month:'short', year:'numeric' });
  const hasFoc = sel.routeId ? x.routes[sel.routeId]?.hasFocPending : x.hasFocPending;
  const subTitle = sel.routeId ? `${bookingV2Route(sel.routeId)?.full || sel.routeId} &middot; ${dateLbl}` : `${dateLbl} &middot; all routes`;

  const fmtStats = r => `
    <div class="bkv2-detail-stats">
      <span><span class="lab">Total</span> <span class="val big">${r.total}</span></span>
      <span class="sep">|</span>
      <span><span class="lab">AD</span> ${r.ad} &middot; <span class="lab">CHD</span> ${r.chd} &middot; <span class="lab">INF</span> ${r.inf} &middot; ${r.foc?`<span class="lab" style="color:#ba7517">FOC</span> <span class="val foc">${r.foc}</span>`:`<span class="lab">FOC</span> 0`}</span>
      <span class="sep">|</span>
      <span><span class="lab">PK</span> ${r.pk} &middot; <span class="lab">KL</span> ${r.kl} &middot; <span class="lab">NT</span> ${r.nt}</span>
    </div>
  `;

  let rowsHtml;
  if(sel.routeId){
    const r = x.routes[sel.routeId];
    rowsHtml = `
      <div class="bkv2-detail-row first">
        <div class="bkv2-detail-rname">${bookingV2Route(sel.routeId)?.full || sel.routeId}</div>
        ${fmtStats(r)}
      </div>
    `;
  } else {
    rowsHtml = bookingV2Routes().map((rDef, i) => {
      const r = x.routes[rDef.id];
      if(!r) return `
        <div class="bkv2-detail-row ${i===0?'first':''}">
          <div class="bkv2-detail-rname muted">${rDef.full}</div>
          <div class="bkv2-detail-stats"><span style="color:var(--ink-soft);font-style:italic">no trip &middot; route closed</span></div>
        </div>
      `;
      return `
        <div class="bkv2-detail-row ${i===0?'first':''}">
          <div class="bkv2-detail-rname">${rDef.full}</div>
          ${fmtStats(r)}
        </div>
      `;
    }).join('');
  }

  return `
    <div class="bkv2-detail">
      <div class="bkv2-detail-hd">
        <div>
          <div class="bkv2-detail-lab">Selected</div>
          <div class="bkv2-detail-ttl">${subTitle}</div>
        </div>
        ${hasFoc ? `<div class="bkv2-detail-chip"><span class="dot"></span>FOC pending</div>` : ''}
        <button class="bkv2-detail-open" style="margin-left:auto" onclick="bookingV2OpenFiltered('${sel.routeId||''}','${sel.date}')">Open ${sel.routeId?'bookings':"day's bookings"} &rarr;</button>
      </div>
      ${rowsHtml}
      <div class="bkv2-detail-foot">
        <div class="lab">Day total</div>
        <div class="stats">
          <span>Pax <span style="font-size:16px">${x.total}</span></span>
          <span class="sep">|</span>
          <span>Revenue &#3647;${bookingV2FmtTHB(x.revenue)}</span>
          <span class="sep">|</span>
          <span>${x.bookings.length} booking${x.bookings.length===1?'':'s'}</span>
        </div>
      </div>
    </div>
  `;
}
