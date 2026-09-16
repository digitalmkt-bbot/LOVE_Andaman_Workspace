function bookingV2SaveDraft(){
  if(!_bkV2.newBooking) return;
  const d = _bkV2.newBooking;
  if(!d.agentId){ alert('Please pick an agent first'); return; }
  // §down · แก้ใบที่ยืนยันแล้วแล้วกด Save Draft = ลดสถานะกลับเป็นใบเสนอราคา
  //   ใบจะหลุดจากใบงานรถ ใบงานเรือ และยอดของทริปทันทีโดยไม่มีอะไรเตือน
  //   เคยเกิดกับใบ B2C เพราะปุ่ม Update ถูกปิดอยู่ (ดู §rate) เหลือปุ่มนี้ปุ่มเดียว
  if(_bkV2.editingId){
    const _cur = (typeof SB_BOOKINGS!=='undefined'?SB_BOOKINGS:[]).find(function(b){ return b.id===_bkV2.editingId; });
    const _st = _cur && _cur.status;
    if(_st && _st!=='quote' && _st!=='draft'){
      if(!confirm('booking นี้สถานะ "'+_st+'" อยู่\n\nกด Save Draft จะเปลี่ยนกลับเป็นใบเสนอราคา (quote)\n'
        +'ใบจะหลุดจากใบงานรถ ใบงานเรือ และยอดของทริป\n\n'
        +'ถ้าแค่ต้องการบันทึกการแก้ไข ให้กด Cancel แล้วใช้ปุ่มบันทึกด้านบนแทน\n\nยืนยันลดสถานะเป็น quote?')) return;
    }
  }
  bookingV2CommitBooking('quote');
}
