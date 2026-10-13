function bookingV2RemoveAltPickup(i){
  if(!_bkV2.newBooking || !Array.isArray(_bkV2.newBooking.altPickups)) return;
  _bkV2.newBooking.altPickups.splice(i,1);
  // ลบจุดรับออกแล้ว split ที่สร้างไว้อัตโนมัติต้องยุบคืนด้วย — ไม่งั้นบุ๊กกิ้งยังถูกหั่นเป็นหลายก้อน
  // ทั้งที่ไม่มีจุดรับเพิ่มแล้ว (คนหายไปจากใบงาน) · bookingV2SyncAltPickupSplits ยุบให้เองเมื่อ altPickups ว่าง
  const _id=_bkV2.newBooking.id;
  if(_id && typeof SB_BOOKINGS!=='undefined'){
    const b=SB_BOOKINGS.find(x=>x.id===_id);
    if(b){ b.altPickups = _bkV2.newBooking.altPickups.slice();
           if(typeof bookingV2SyncAltPickupSplits==='function') bookingV2SyncAltPickupSplits(b); }
  }
  bookingV2Render();
}
