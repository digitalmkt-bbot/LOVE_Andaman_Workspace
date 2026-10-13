/* §bkRouteSrc · "ใบนี้จองเส้นทางไหนได้" มีสองแหล่ง และไม่เท่ากันเสมอ
     1) โปรแกรมในสัญญาของเอเยนต์ (programPeriods) — ถ้ามี ตัวนี้คุม
     2) เส้นทางใน Rate Type — ใช้เมื่อเอเยนต์ยังไม่มีสัญญา
   ของเดิมกฎนี้ซ่อนอยู่ใน dropdown ที่เดียว ส่วนป้ายน้ำเงินไปนับจาก Rate Type
   เพิ่มเส้นทางใน Rate Type แล้ว dropdown ไม่ขึ้น จึงดูเหมือนระบบพัง
   ทั้งที่เป็นคนละแหล่ง · ยกออกมาไว้ตรงนี้ให้ทั้งสองที่ใช้ร่วมกัน */
function bookingV2BookableRoutes(){
  const d = (typeof _bkV2!=='undefined' && _bkV2) ? _bkV2.newBooking : null;
  const agent = (d && d.agentId && typeof sbGetAgent === 'function') ? sbGetAgent(d.agentId) : null;
  const rt = (typeof bookingV2GetRT === 'function') ? bookingV2GetRT() : null;
  const rtIds = (rt && Array.isArray(rt.routes)) ? rt.routes.slice() : [];
  /* §internal · ใบของบริษัทไม่ติดสัญญาโปรแกรม · เปิดทุกเส้นทางที่ยังใช้งาน
     ต้องดักที่นี่ด้วย ไม่ใช่ที่ bookingV2GetRT ที่เดียว · เพราะบรรทัดข้างล่างดู programPeriods
     ก่อน rate type เสมอ · ถ้าไม่ดัก ใครไปตั้งโปรแกรมให้บัญชีบ้านในหน้า Agent List
     รายการก็จะถูกจำกัดกลับมาอีก · migration ที่ล้าง programs กันได้แค่เครื่องที่ยังไม่มีคนแก้ */
  if(typeof laIsCompanyBk==='function' && laIsCompanyBk(d)) return { ids: rtIds, src:'house', rtIds: rtIds };
  if(agent && agent.programPeriods && agent.programPeriods.length){
    const ids = [...new Set(agent.programPeriods.map(p => p && p.routeId).filter(Boolean))];
    return { ids: ids, src: 'contract', rtIds: rtIds };
  }
  return { ids: rtIds, src: 'ratetype', rtIds: rtIds };
}
