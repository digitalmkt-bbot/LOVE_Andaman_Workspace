// ── Rate/Contract model · Phase 2: resolve the rate type PER TRIP (promo overlay) ──
// A time-boxed 'promo' contract (per-route, by TRAVEL date) overrides the agent's base rate for that trip.
// Returns a PROMO rateTypeId only when an active promo contract covers (route, travelDate); else null → base.
// No promo contracts exist yet (Phase 3 creates them), so today this always returns null → identical pricing.
function bookingV2ResolveRateType(agentId, routeId, travelDate){
  if(!agentId || !routeId || !travelDate || typeof SB_CONTRACTS==='undefined' || !Array.isArray(SB_CONTRACTS)) return null;
  const promos = SB_CONTRACTS.filter(c => c && c.agentId===agentId && c.kind==='promo'
    && c.status!=='void' && c.status!=='cancelled' && c.status!=='expired'
    && (!c.activeFrom || travelDate>=c.activeFrom) && (!c.activeTo || travelDate<=c.activeTo)
    && (c.programPeriods||[]).some(p => p.routeId===routeId
         && (!p.travelFrom || travelDate>=p.travelFrom) && (!p.travelTo || travelDate<=p.travelTo)));
  if(!promos.length) return null;
  promos.sort((a,b) => (Number(b.priority||0)-Number(a.priority||0)) || String(b.activeFrom||'').localeCompare(String(a.activeFrom||'')));
  return promos[0].rateTypeId || null;
}
