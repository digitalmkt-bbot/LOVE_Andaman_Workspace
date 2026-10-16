// True if the current rate type offers any add-ons applicable to the trips
function bookingV2HasAvailableAddOns(){
  const d = _bkV2.newBooking;
  const rt = bookingV2AddOnRT();   /* §aoRT */
  if(!rt) return false;
  const tripRoutes = d.trips.map(t => t.routeId).filter(Boolean);
  if(tripRoutes.length === 0) return false;
  // Longtail · only if at least one trip route is in applies[] (or applies undefined = legacy)
  const lt = rt.addOns?.longtail;
  if(lt){
    const ltn = (typeof _rtNormalizeLongtail==='function') ? _rtNormalizeLongtail(lt) : null;
    if(ltn){
      const ids = ltn.applies.length ? tripRoutes.filter(r=>ltn.applies.includes(r)) : tripRoutes;
      const ok = ids.some(r=>{ const e=ltn.byRoute[r]||{join:ltn.join,charter:ltn.charter}; return (e.join&&(e.join.adult||e.join.child))||(e.charter&&e.charter.price); });
      if(ok) return true;
    }
  }
  /* §nbVanKeep (2026-10-16) · owner "ใน Rate type ก็มี ตอนเลือกก็มี แต่พอกดเพิ่ม เด้งหาย"
     เดิมเช็คเหมารถเฉพาะโซนของที่นั่ง และไม่นับที่นั่ง No-Transfer · แต่ bookingV2RenderAddOnsSection เสนอเหมารถ
     "ทุกโซนที่เรทตั้งราคาไว้ ไม่ขึ้นกับโซนที่นั่ง" และ bookingV2ToggleAddOn ย้ายที่นั่งไป No-Transfer ทันทีที่ติ๊กเหมารถ
     ผล: ติ๊กปุ๊บ ตัวนี้ตอบ false · การ์ด Add-ons หายทั้งการ์ด · เอาติ๊กออกก็ไม่ได้ (ราคาเหมารถยังค้างในใบ)
     เส้นทางที่ไม่มีหางยาวโดนเต็ม ๆ (เช่น Similan Catamaran) · เส้นที่มีหางยาวรอดเพราะคืน true ตั้งแต่ข้างบน
     ตอนนี้ใช้เงื่อนไขเดียวกับตัววาด: เส้นทางนั้นมีราคาเหมารถโซนไหนก็ได้ · และมี add-on ติ๊กค้างอยู่ก็ต้องโชว์ให้เอาออกได้ */
  const ptMap = rt.addOns?.privateTransfer || {};
  const vanOk = d.trips.some(t => {
    if(!t.routeId) return false;
    const routePt = ptMap[t.routeId];
    if(!routePt || typeof routePt !== 'object') return false;
    return Object.values(routePt).some(z => z && typeof z === 'object' && Object.values(z).some(v => v));
  });
  return vanOk || (Array.isArray(d.addOns) && d.addOns.length > 0);
}
