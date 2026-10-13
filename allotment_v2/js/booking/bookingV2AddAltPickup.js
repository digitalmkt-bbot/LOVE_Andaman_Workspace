// §altPickups · รับหลายจุดในบุคกิ้งเดียว
function bookingV2AddAltPickup(){
  if(!_bkV2.newBooking) return;
  if(!Array.isArray(_bkV2.newBooking.altPickups)) _bkV2.newBooking.altPickups = [];
  _bkV2.newBooking.altPickups.push({who:'', qty:1, ad:1, chd:0, inf:0, foc:0, areaId:'', zone:'', place:'', dropSame:true, dropAreaId:'', dropZone:'', dropPlace:''});
  bookingV2Render();
}
