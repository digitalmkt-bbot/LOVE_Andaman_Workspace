function bookingV2HotelDDOutside(e){
  if(!_bkV2HotelDDOn) return;
  var dd=document.getElementById('bkv2-hotel-dd'), inp=document.getElementById('bkv2-hotel-input');
  if(!dd) return;
  if(dd.contains(e.target)||inp===e.target) return;
  bookingV2HotelDDHide();
}
