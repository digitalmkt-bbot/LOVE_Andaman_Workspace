/* §lkRelClose (2026-11-20) · ล็อกรายวันที่ปล่อยรอบของตัวเองแล้ว = ไม่เหลืออะไรให้กัน · ปิดสถานะไปด้วย
   เดิมปล่อยแล้วสถานะยังเป็น active · หน้าจอนี้รู้ว่าปล่อยแล้ว (อ่าน releasedDates) แต่ระบบขาย B2C อ่านตาราง
   สรุปในฐานข้อมูลที่ดูแค่ status จึงยังเห็นที่นั่งถูกกันอยู่ (Surin 21 พ.ย. · ออฟฟิศปล่อย 2 ที่ 16:17 · B2C ยังขึ้นเต็ม)
   และไม่มีปุ่มไหนในหน้านี้ปิดใบแบบนี้ได้ (แก้ที่นั่งเป็น 0 ก็ไม่ให้บันทึก)
   ล็อกแบบช่วงวันที่ไม่แตะ · รอบอื่นของมันยังกันอยู่ · ใบชนิดเรือไม่แตะ · มีทางปล่อยของมันเอง
   คืน true เมื่อมีการเปลี่ยนสถานะ */
function bookingV2LockCloseIfReleased(l, by){
  if(!l || l.status!=='active' || bookingV2LockSpansDays(l)) return false;
  if(typeof bookingV2IsBoatLock==='function' && bookingV2IsBoatLock(l)) return false;
  if(l.parentId || !l.date || !bookingV2LockRoundReleased(l, l.date)) return false;
  const today = (typeof bookingV2LocalYMD==='function') ? bookingV2LocalYMD(new Date()) : new Date().toISOString().slice(0,10);
  const who = by || ((typeof laBy==='function')?laBy():'');
  l.status = 'released';
  (l.log = l.log||[]).push({ date:today, at:new Date().toISOString(), type:'release', note:'ปิดใบ · ปล่อยรอบแล้ว', by:who });
  SB_SEAT_LOCKS.forEach(k => {
    if(k && k.parentId===l.id && k.status==='active'){
      k.status = 'released';
      (k.log = k.log||[]).push({ date:today, at:new Date().toISOString(), type:'release', note:'ปิดพร้อมล็อกแม่ · ปล่อยรอบแล้ว', by:who });
    }
  });
  return true;
}
