/* §agentOne · กติกาที่ต้องเกิดขึ้นทุกครั้งที่ agent ของใบเปลี่ยน · เขียนไว้ที่เดียว
   เดิมกติกาชุดนี้อยู่ใน bookingV2SetBookingField อย่างเดียว แต่หน้าจอจริงเลือก agent
   ผ่านช่องค้นหา ซึ่งเข้า bookingV2PickAgentByText ที่ไม่เคยเรียกฟังก์ชันนั้นเลย
   ใบของบริษัทจึงค้างเป็น priceMode='rate' ทั้งที่ชิปบนจอเขียนว่า Manual
   — จอบอกอย่าง ระบบคิดอีกอย่าง แล้วโซนกับปุ่มบันทึกก็ถูกล็อกตามกัน */
function bookingV2ApplyAgentRules(a){
  const d = _bkV2 && _bkV2.newBooking; if(!d) return;
  if(d._rtKeep && ((a && a.id) || null) !== ((_bkV2.editingId && (SB_BOOKINGS.find(b=>b.id===_bkV2.editingId)||{}).agentId) || null)) delete d._rtKeep;   /* §rtKeep · เปลี่ยนเอเยนต์ = ไม่มีเรทเดิมให้ยึด */
  d.rateTypeRef = a?.rateTypeId || null;
  // House accounts: walk-in keeps manual option · staff → free/manual; real agent → lock Rate type
  const isWk = a && (a.code==='WALKIN' || a.id==='a_walkin');
  const isSt = a && (a.code==='STAFF'  || a.id==='a_staff');
  if(isSt){ d.soldBy=''; const insp=d.staffPurpose==='inspection'; d.priceMode = insp?'manual':'rate'; if(insp) d.manualTotal=0; }   // welfare → Staff Welfare rate (FOC free, over-quota priced) · inspection → ฿0
  else if(isWk){ d.staffId=''; }
  /* §internal · ใบบริษัทตั้งราคาเองเสมอ · ไม่มี rate type ให้อ้าง (ฟรีก็ได้ พิเศษก็ได้) */
  else if(a && (a.code==='COMPANY' || a.id==='a_company')){
    d.staffId=''; d.priceMode='manual';
    if(d.manualTotal==null) d.manualTotal=0;
  }
  else { d.priceMode='rate'; d.soldBy=''; d.staffId=''; d.companyPurpose=''; }
}
