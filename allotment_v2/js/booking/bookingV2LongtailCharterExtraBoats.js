// Private/charter longtail BOATS sold day-of via "+ extra" (qty = boats). Same product as the
// "Longtail เหมา" add-on → counted together in the trip prep summary. Optionally scoped to a date.
function bookingV2LongtailCharterExtraBoats(bkId, date){
  let n=0;
  (typeof bookingV2ExtrasFor==='function'?bookingV2ExtrasFor(bkId):[]).forEach(e=>{
    const nm=String(e.service||'');
    if(!/longtail|หางยาว/i.test(nm)) return;
    if(!/เหมา|charter|private|ไพรเวท|ส่วนตัว/i.test(nm)) return;  // only private/charter (whole boat)
    if(date && e.tripDate && e.tripDate!==date) return;
    n += (+e.qty||1);   // qty = boats
  });
  return n;
}
