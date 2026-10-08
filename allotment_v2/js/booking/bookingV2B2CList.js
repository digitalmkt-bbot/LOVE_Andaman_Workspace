// รายการที่ยังไม่มีคนรับทราบ · นับเฉพาะใบที่ยังไม่เดินทาง
function bookingV2B2CList(){
  const today=(typeof bookingV2LocalYMD==='function')?bookingV2LocalYMD(new Date()):new Date().toISOString().slice(0,10);
  const out=[];
  (typeof SB_BOOKINGS!=='undefined'?SB_BOOKINGS:[]).forEach(bk=>{
    if(!bk || !/^b2c_/.test(String(bk.id||''))) return;
    const p=bookingV2B2CPending(bk); if(!p) return;
    const d=bookingV2B2CTripDate(bk); if(!d || d<today) return;
    out.push({bk, p, date:d});
  });
  return out;
}
