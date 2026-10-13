function bookingV2PickAgentByText(txt){
  if(!_bkV2.newBooking) return;
  const d = _bkV2.newBooking;
  const prevAgentId = d.agentId;
  const trimmed = String(txt||'').trim();
  if(!trimmed){
    d.agentId = null;
    bookingV2ApplyAgentRules(null);   /* §agentOne */
    if(prevAgentId) bookingV2ResetAgentScopedData();
    bookingV2Render(); return;
  }
  const norm = trimmed.toLowerCase();
  const a = (SB_AGENTS||[]).find(x => {
    if(x.active === false) return false;
    const mkt = (typeof SB_MARKETS!=='undefined' && SB_MARKETS.find(m=>m.id===x.market)?.name) || x.market || '';
    const full = `[${mkt}] ${x.code} · ${x.name}`.toLowerCase();
    const short = `${x.code} · ${x.name}`.toLowerCase();
    return full === norm || short === norm
        || (x.code||'').toLowerCase() === norm
        || (x.name||'').toLowerCase() === norm;
  });
  if(a){
    const isNewAgent = prevAgentId !== a.id;
    d.agentId = a.id;
    bookingV2ApplyAgentRules(a);      /* §agentOne · เดิมที่นี่ตั้งแค่ rateTypeRef · priceMode จึงค้าง */
    if(isNewAgent) bookingV2ResetAgentScopedData();
    bookingV2Render();
  }
}
