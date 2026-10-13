// ── Structured food allergies · specialMeals.allergyList = [{name, qty}] (qty = number of people) ──
// `allergies` free-text is kept for un-counted notes (e.g. "no shellfish"). bookingV2AllergyCount = Σ qty (people); legacy text-only = counts 1.
function bookingV2AllergyCount(sm){ if(!sm) return 0; let n=0; if(Array.isArray(sm.allergyList)) sm.allergyList.forEach(a=>{ n+=Math.max(0,Math.floor(+a.qty||0)); }); if(!n && (sm.allergies||'').trim()) n=1; return n; }
