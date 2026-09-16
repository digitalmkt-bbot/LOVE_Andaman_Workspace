function bookingV2RenderSubmitButton(){
  const d = _bkV2.newBooking;
  if(!d) return '';
  const q = bookingV2CalcQuote();
  const hasTrips = d.trips.some(t => t.routeId && t.date);
  const hasFoc = q.totalFoc > 0;
  const focOk = !hasFoc || (d.focReason||'').trim().length > 0;
  // Block save if any trip has no rate for its route×zone combo
  const noRateTrips = bookingV2NoRateTrips();
  const ratesOk = noRateTrips.length === 0;
  // §rate · ใบที่ราคามาจากต้นทาง (B2C) หรือตั้งราคาเอง ไม่มีและไม่ต้องมี Rate Type
  //   ของเดิมบังคับ rateTypeRef ทุกใบ → ปุ่มนี้ปิดตายกับใบ B2C ทั้งหมด
  //   เหลือทางเดียวคือ Save Draft ที่เขียนสถานะเป็น quote (ดู §down)
  const _mnPrice = (d.priceMode==='manual') || ((typeof bookingV2IsB2CBk==='function') && bookingV2IsB2CBk(d));
  const ready = d.agentId && d.leadPax && (d.rateTypeRef || _mnPrice) && hasTrips && focOk && ratesOk;
  if(!ratesOk){
    return `<button class="bkv2-nb-btn" disabled title="Some trips have no rate · fix Rate Type or change route/zone" style="cursor:not-allowed;color:#A32D2D;border-color:#F5B5B5;background:#FDECEA">⚠ No rate · ${noRateTrips.length} trip${noRateTrips.length===1?'':'s'} · cannot save</button>`;
  }
  const isEdit = !!_bkV2.editingId;
  if(hasFoc){
    return `<button class="bkv2-nb-btn ${ready?'pri':''}" ${!ready?'disabled':''} onclick="bookingV2SubmitBooking()" style="${ready?'background:#BA7517;border-color:#BA7517':''}">${isEdit?'Update · FOC review':'Submit · FOC review'}</button>`;
  }
  return `<button class="bkv2-nb-btn pri" ${!ready?'disabled':''} onclick="bookingV2SubmitBooking()">${isEdit?'Update Booking':'Confirm Booking'} &check;</button>`;
}
