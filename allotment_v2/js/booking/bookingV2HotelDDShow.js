function bookingV2HotelDDShow(){
  _bkV2HotelDDActive=-1; _bkV2HotelDDOn=true;
  var inp=document.getElementById('bkv2-hotel-input');
  bookingV2HotelDDRender(inp?inp.value:'');
  setTimeout(function(){ document.addEventListener('mousedown', bookingV2HotelDDOutside); },0);
}
