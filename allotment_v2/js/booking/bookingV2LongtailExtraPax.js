function bookingV2LongtailExtraPax(bkId, date){
  let n=0;
  if(date) n+=bkB2CAddonLt(bkId, date).join;   /* §b2cAddon */
  (typeof bookingV2ExtrasFor==='function'?bookingV2ExtrasFor(bkId):[]).forEach(e=>{
    const nm=String(e.service||'');
    if(!/longtail|หางยาว/i.test(nm)) return;
    if(/เหมา|charter|private|ไพรเวท|ส่วนตัว/i.test(nm)) return;  // private/charter longtail = whole boat, not join pax
    if(date && e.tripDate && e.tripDate!==date) return;  // scope to this trip date when the extra is dated
    n += (+e.qty||1);
  });
  return n;
}
