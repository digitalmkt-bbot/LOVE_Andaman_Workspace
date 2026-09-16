// Aggregate family pax for a specific date (sum across sub-routes)
function bookingV2FamilyAggregate(familyId, dateStr, agg){
  const day = agg.byDate[dateStr];
  if(!day) return { total:0, ad:0, chd:0, inf:0, foc:0, pk:0, kl:0, nt:0, hasFocPending:false, subCount:0 };
  const subRoutes = bookingV2FamilyRoutes(familyId);
  let total=0, ad=0, chd=0, inf=0, foc=0, pk=0, kl=0, nt=0, hasFocPending=false, subCount=0;
  subRoutes.forEach(r => {
    const cell = day.routes[r.id];
    if(!cell) return;
    subCount++;
    total += cell.total; ad += cell.ad; chd += cell.chd; inf += cell.inf; foc += cell.foc;
    pk += cell.pk; kl += cell.kl; nt += cell.nt;
    if(cell.hasFocPending) hasFocPending = true;
  });
  return { total, ad, chd, inf, foc, pk, kl, nt, hasFocPending, subCount };
}
