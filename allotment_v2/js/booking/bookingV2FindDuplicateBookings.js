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
    const bt=(b.trips||[]).filter(t=>t.routeId&&t.date);
    const sharedDR=bt.some(t=>myDR.has(t.date+'|'+t.routeId));
    /* §tripNext · ใบ B2C ในออเดอร์เดียวกัน (b2c_<ref>_1, _2) ใช้เลข voucher เดียวกันอยู่แล้ว
       คนละทริป = ซื้อหลายทริป · บรรทัดที่มีแต่บริการเสริม = ของเสริมของทริปนี้ · ทั้งสองแบบไม่ใช่ลงซ้ำ
       สองบรรทัดที่เป็นทริปเดียวกันวันเดียวกันและมีคนทั้งคู่ ยังเตือนตามเดิม */
    const _ord=x=>{ const k=String(x||'').match(/^(b2c_.*)_\d+$/); return k?k[1]:''; };
    if(_ord(d.id) && _ord(d.id)===_ord(b.id)){
      const _ao=x=>(typeof bkB2CAddonOnly==='function')&&bkB2CAddonOnly(x);
      if(!sharedDR || _ao(b) || _ao(d)) return;   /* อีกทริปของออเดอร์ หรือบรรทัดบริการเสริมของทริปนี้ */
    }
    if(vref && bv && bv===vref) reasons.push('เลข Voucher ตรงกัน ('+(b.voucherRef||b.code)+')');
    if(lead && norm(b.leadPax||b.customerName)===lead && sharedDR) reasons.push('ชื่อลูกค้า + วัน + ทริป ตรงกัน');
    if(reasons.length) out.push({bk:b, reasons});
  });
  return out;
}
