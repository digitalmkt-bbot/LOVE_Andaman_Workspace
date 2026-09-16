// Longtail-Join pax sold day-of via "+ extra" (SB_EXTRAS · qty = people). Optionally scoped to a trip date.
// "Longtail Join" preset counts as Join · "Private Longtail" / เหมา = a whole boat, NOT per-person join.
function bookingV2LongtailExtraPax(bkId, date){
  let n=0;
  (typeof bookingV2ExtrasFor==='function'?bookingV2ExtrasFor(bkId):[]).forEach(e=>{
    const nm=String(e.service||'');
    if(!/longtail|หางยาว/i.test(nm)) return;
    if(/เหมา|charter|private|ไพรเวท|ส่วนตัว/i.test(nm)) return;  // private/charter longtail = whole boat, not join pax
    if(date && e.tripDate && e.tripDate!==date) return;  // scope to this trip date when the extra is dated
    n += (+e.qty||1);
  });
  return n;
}
