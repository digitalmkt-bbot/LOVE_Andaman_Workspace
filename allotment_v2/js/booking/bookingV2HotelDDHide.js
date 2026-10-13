function bookingV2HotelDDHide(){
  var dd=document.getElementById('bkv2-hotel-dd'); if(dd) dd.classList.remove('open');
  _bkV2HotelDDOn=false; document.removeEventListener('mousedown', bookingV2HotelDDOutside);
}
