// Find existing bookings that look like duplicates of form data `d` (exclude the one being edited).
// Match flags it: (A) same voucher/ref · (B) same lead name + a shared trip date+route.
// NOTE: a 3rd criterion "same agent + same date + same pax" was dropped — in real data it flagged 362/654
// bookings (OTAs routinely send many same-size groups on the same day) → useless noise. Voucher + name are reliable.
function bookingV2FindDuplicateBookings(d, excludeId){
  if(!d) return [];
  const norm=s=>String(s||'').trim().toLowerCase().replace(/\s+/g,' ');
  const vref=norm(d.voucherRef||d.code);
  const lead=norm(d.leadPax||d.customerName);
  const myTrips=(d.trips||[]).filter(t=>t.routeId&&t.date);
  const myDR=new Set(myTrips.map(t=>t.date+'|'+t.routeId));
  const out=[];
  (SB_BOOKINGS||[]).forEach(b=>{
    if(b.id===excludeId) return;
    if(['cancelled','rejected','cancelled_weather'].includes(b.status)) return;
    const reasons=[];
    const bv=norm(b.voucherRef||b.code);
    if(vref && bv && bv===vref) reasons.push('เลข Voucher ตรงกัน ('+(b.voucherRef||b.code)+')');
    const bt=(b.trips||[]).filter(t=>t.routeId&&t.date);
    const sharedDR=bt.some(t=>myDR.has(t.date+'|'+t.routeId));
    if(lead && norm(b.leadPax||b.customerName)===lead && sharedDR) reasons.push('ชื่อลูกค้า + วัน + ทริป ตรงกัน');
    if(reasons.length) out.push({bk:b, reasons});
  });
  return out;
}
