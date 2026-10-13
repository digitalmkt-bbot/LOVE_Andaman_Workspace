// Total pax of a van-group (date|route|zone|gid) · split parts use their own pax, non-split use the matching trip's pax
function bookingV2VanGroupPax(date, routeId, zone, gid){
  let tot=0;
  _bkV2GrpApply(date,routeId,zone,gid,(b,s)=>{
    if(s){ tot += (+s.pax||0); return; }
    let n=0;
    (b.trips||[]).forEach(t=>{ if((t.date||'')!==date||(t.routeId||'')!==routeId) return; const z=(t.bookingMode==='charter')?'__CHARTER__':(t.zone||b.pickupZone||''); if(z!==zone) return; const p=(typeof bookingV2PaxAllTot==='function')?bookingV2PaxAllTot(t.pax||{}):0; if(p>n)n=p; });
    tot += n;
  });
  /* §vanStop · คนที่ติดรถไปด้วย (ไกด์ · สตาฟ) กินที่นั่งจริง ต้องนับที่นี่ตัวเดียว
     ตรงนี้คือที่ที่ bookingV2VanGroupSetVan ใช้ตัดสิน "ที่นั่งไม่พอ" · ไม่นับ = รถ 10 ที่โดนจัด 11 คน
     จุดแวะผูกกับ (วัน · โปรแกรม · รถ · กรุ๊ป) ไม่ผูกกับโซน · โซนเป็นเรื่องของจุดรับลูกค้า
     จึงนับเข้ากรุ๊ปที่ถือรถคันนั้นอยู่ · ก่อนมีรถ ยังไม่มีกรุ๊ปให้นับ จึงยังไม่เข้ายอดใคร */
  try{
    const vid=(typeof bookingV2VanGroupVan==='function')?bookingV2VanGroupVan(date,routeId,zone,gid):null;
    if(vid && typeof vsSeatsOfVan==='function') tot += vsSeatsOfVan(date, routeId, vid, gid);
  }catch(_){}
  return tot;
}
