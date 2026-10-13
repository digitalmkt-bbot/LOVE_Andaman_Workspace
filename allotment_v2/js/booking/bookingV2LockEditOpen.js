/* ══ §lkEdit (2026-09-29) · แก้รายละเอียดล็อกได้ ════════════════════════
   ที่มา · ผู้ใช้ขอเอง หลังเจอเคส Panorama
   ล็อก bulk ตั้งวันเริ่ม 31 ต.ค. 2026 ไว้ แต่ไม่ได้ใส่วันจบ (เขียน "TBA" ไว้ในโน้ต)
   bookingV2LockRange เติมให้เป็น to = dateTo || dateFrom · ช่วงจึงยุบเหลือวันเดียว
   และวันนั้นเป็นวันเสาร์ ส่วนล็อกติ๊กไว้เฉพาะอังคาร/พฤหัส · ไม่ตรงสักวัน
   ผลคือ "ผ่านมา 0/0 รอบ" และไม่ขึ้น manifest วันไหนเลย
   ของเดิมไม่มีทางแก้ · ต้องลบแล้วสร้างใหม่ ซึ่งทิ้งประวัติทั้งใบ

   แก้ได้เฉพาะเท่าที่ไม่ทำให้ใบจองที่ดึงไปแล้วเคว้ง
   ขายไปแล้ว = ห้ามย้ายเส้นทาง ย้ายวัน เปลี่ยนแบบ และลดที่นั่งต่ำกว่าที่ขายไป */
function bookingV2LockEditOpen(id){
  const l = SB_SEAT_LOCKS.find(x=>x.id===id); if(!l) return;
  const nm = (typeof bookingV2LockHolderName==='function') ? bookingV2LockHolderName(l) : '';
  _bkV2LockForm = { ..._bkV2LockForm,
    scope: bookingV2LockSpansDays(l) ? 'bulk' : 'day',
    routeId: l.routeId||'', date: l.date||'',
    dateFrom: l.dateFrom||'', dateTo: l.dateTo||'',
    dow: Array.isArray(l.dow)?l.dow.slice():[],
    holderType: l.holderType||'office',
    holderId: l.holderId||'', holderName: (l.holderType==='agent')?nm:'',
    qty: String(l.qty||''), reason: l.reason||'', expiry: l.expiry||'',
    releaseDaysBefore: (l.releaseDaysBefore==null?'':String(l.releaseDaysBefore)),
    releaseTime: l.releaseTime||'' };
  _bkV2LockEditId = id;
  _bkV2LockModalOpen = true;
  bookingV2Render();
}
