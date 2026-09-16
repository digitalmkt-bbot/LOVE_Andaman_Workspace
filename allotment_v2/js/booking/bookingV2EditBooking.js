function bookingV2EditBooking(bookingId){
  const bk = SB_BOOKINGS.find(b => b.id === bookingId);
  if(!bk){ alert('Booking not found'); return; }
  if(bk.schemaVer !== 2){ alert('Legacy bookings cannot be edited · please cancel and recreate'); return; }
  if(['cancelled','completed','rejected'].includes(bk.status)){
    if(!confirm(`This booking is ${bk.status}. Edit anyway?`)) return;
  }
  const _lk = bookingV2EditLockActive(bk);
  if(_lk && !confirm('⚠ '+_lk.by+' กำลังแก้ไข booking นี้อยู่ (เปิดเมื่อ ~'+_lk.mins+' นาทีที่แล้ว)\n\nถ้าแก้พร้อมกัน คนที่บันทึกทีหลังจะทับงานของอีกคน\n\nเปิดแก้ไขต่อหรือไม่?')) return;
  // Deep-clone bk into _bkV2.newBooking shape
  const clone = JSON.parse(JSON.stringify(bk));
  delete clone.editLock;
  // Normalize arrays the relational backend drops when empty ([] → 0 child rows → key missing on
  // reload). Form renderers/calc read these without guards → "reading 'forEach'" crash on edit.
  ['addOns','passengers','adjustments','feeItems','altPickups'].forEach(k => { if(!Array.isArray(clone[k])) clone[k] = []; });
  // §b2cEdit · ใบจาก B2C ไม่มีและไม่ควรมี Rate Type · ยอดเงินคือของจริงจากต้นทาง
  //   ใส่เป็นราคาตายตัวเท่ากับยอดของ B2C เพื่อไม่ให้เครื่องคิดเรทคิดใหม่เป็น ฿0
  //   แล้วจำค่าตั้งต้นของช่องที่ B2C เป็นเจ้าของไว้ เทียบตอนบันทึกว่า ops แตะช่องไหนบ้าง
  if(bookingV2IsB2CBk(clone)){
    clone.priceMode = 'manual';
    clone.manualTotal = Number(clone.total || (clone.priceBreakdown && clone.priceBreakdown.total) || 0);
    clone._b2cSnap = bookingV2B2CSnap(clone);
  }
  _bkV2.newBooking = clone;
  _bkV2.editingId = bk.id;
  _bkV2.detailId = null;
  bookingV2SetEditLock(bk.id);   // stamp + sync so others see "being edited"
  bookingV2Render();
  try { document.querySelector('main')?.scrollTo({top:0,behavior:'instant'}); } catch(e){}
  window.scrollTo({top:0});
}
