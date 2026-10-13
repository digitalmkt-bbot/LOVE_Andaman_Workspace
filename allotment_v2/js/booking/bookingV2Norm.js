// Normalize any v1 or v2 booking into a common shape for list rendering
function bookingV2Norm(bk){
  if(bk.schemaVer === 2){
    // v2 native — handle both old (ad/chd) and new mixed (ad_fr/ad_th) shapes
    const totPax = (bk.trips||[]).reduce((s,t)=> s + bookingV2PaxAllTot(t.pax||{}), 0);
    const foc = (bk.trips||[]).reduce((s,t)=> s + bookingV2PaxTot(t.pax||{},'foc'), 0);
    const _isB2C = !!(bk.id && bk.id.indexOf('b2c_')===0);
    return {
      id: bk.id,
      schemaVer: 2,
      createdAt: bk.createdAt,
      agentName: bk.agentId ? (sbGetAgent(bk.agentId)?.name || (_isB2C?'B2C':bk.agentId)) : (_isB2C ? 'B2C' : (bk.b2cChannel ? (sbGetB2C(bk.b2cChannel)?.name || 'Direct') : '—')),
      agentSub: bk.rateTypeRef ? (SB_RATE_TYPES.find(r=>r.id===bk.rateTypeRef)?.code || bk.rateTypeRef) : ((_isB2C || bk.b2cChannel) ? 'B2C · Direct' : '—'),
      tripSummary: (bk.trips||[]).length === 1
        ? (ROUTES.find(r=>r.id===bk.trips[0].routeId)?.name || bk.trips[0].routeId)
        : `${(bk.trips||[]).length} trips · ${(bk.trips||[]).map(t=>(ROUTES.find(r=>r.id===t.routeId)?.name||'').split(' ')[0]).filter(Boolean).join(' + ')}`,
      travelDate: (bk.trips||[])[0]?.date || bk.createdAt || '',   // fall back to created date when a trip has no travel date (e.g. B2C rows missing travel_date)
      paxTotal: totPax,
      paxBreak: (function(){
        const ad = (bk.trips||[]).reduce((s,t)=>s+bookingV2PaxTot(t.pax||{},'ad'),0);
        const chd = (bk.trips||[]).reduce((s,t)=>s+bookingV2PaxTot(t.pax||{},'chd'),0);
        const inf = (bk.trips||[]).reduce((s,t)=>s+bookingV2PaxTot(t.pax||{},'inf'),0);
        return `${ad}A · ${chd}C · ${inf}I` + (foc?` · ${foc} FOC`:'');
      })(),
      focCount: foc,
      focApproved: !!(bk.focApproval && bk.focApproval.status==='approved'),
      total: bk.total || bk.priceBreakdown?.total || 0,
      status: bk.status,
      payment: bk.paymentSnapshot?.method || '—',
      voucherRef: bk.voucherRef || '',
      leadPax: bk.leadPax || '',
      leadPhone: bk.leadPhone || ''
    };
  } else {
    // v1 legacy — best effort mapping
    let agentName = '—', agentSub = '—';
    if(bk.channelType === 'b2b'){
      const a = sbGetAgent(bk.channel);
      agentName = a?.name || bk.channel;
      agentSub = a?.rateTypeId ? (SB_RATE_TYPES.find(r=>r.id===a.rateTypeId)?.code || '') : 'B2B';
    } else {
      const c = sbGetB2C(bk.channel);
      agentName = bk.customerName || '—';
      agentSub = c?.name?.split('(')[0]?.trim() || 'B2C';
    }
    const tot = (bk.pax?.adult||0)+(bk.pax?.child||0)+(bk.pax?.infant||0);
    return {
      id: bk.id,
      schemaVer: 1,
      createdAt: bk.dateCreated,
      agentName: agentName,
      agentSub: agentSub,
      tripSummary: ROUTES.find(r=>r.id===bk.programId)?.name || bk.programId,
      travelDate: bk.travelDate,
      paxTotal: tot,
      paxBreak: `${bk.pax?.adult||0}A · ${bk.pax?.child||0}C · ${bk.pax?.infant||0}I`,
      focCount: 0,
      total: bk.total || 0,
      status: bk.status === 'pending' ? 'quote' : (bk.status || 'confirmed'),
      payment: bk.payment || '—',
      voucherRef: bk.voucherRef || '',
      leadPax: bk.customerName || '',
      leadPhone: bk.phone || bk.customerPhone || ''
    };
  }
}
