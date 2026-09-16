function bookingV2HotelDDFilter(val){
  _bkV2HotelDDActive=-1; _bkV2HotelDDOn=true;
  bookingV2SetBookingField('hotelName', val);
  try{ if(_bkV2&&_bkV2.newBooking && _bkV2.newBooking.hotelConfirmedNew!==val) _bkV2.newBooking.hotelConfirmedNew=''; }catch(_){}
  bookingV2HotelDDRender(val);
}
