function bookingV2GetAgentDDOptions(){
  // Build flat list of {id, market, code, name, label}
  if(typeof SB_AGENTS === 'undefined') return [];
  const mkt = mid => (typeof SB_MARKETS !== 'undefined' && SB_MARKETS.find(m => m.id === mid)?.name) || mid || '';
  return SB_AGENTS.filter(a => a.active !== false).map(a => ({
    id: a.id,
    market: mkt(a.market),
    code: a.code || '',
    name: a.name || '',
    label: `[${mkt(a.market)}] ${a.code} · ${a.name}`
  })).sort((a,b) => a.market.localeCompare(b.market) || a.code.localeCompare(b.code));
}
