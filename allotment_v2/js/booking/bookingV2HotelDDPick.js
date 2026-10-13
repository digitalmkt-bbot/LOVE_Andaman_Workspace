function bookingV2HotelDDPick(label, isNew){
  var inp=document.getElementById('bkv2-hotel-input');
  if(inp) inp.value=label;
  bookingV2SetBookingField('hotelName', label);
  // §hotelDedupe · กด "เพิ่มโรงแรมใหม่" = ยืนยันแล้วว่าตั้งใจ · ตอนบันทึกจะไม่ถามซ้ำ
  try{ if(_bkV2&&_bkV2.newBooking) _bkV2.newBooking.hotelConfirmedNew = isNew?String(label||''):''; }catch(_){}
  bookingV2HotelDDHide();
}
