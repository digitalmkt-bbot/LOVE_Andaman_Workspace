/* หัวกรุ๊ปรถ · ถ้าสองขาไม่เท่ากัน (มีคนมาเอง) แยกยอดขาไป/ขากลับ ให้ตรงกับใบงานรถ */
function bookingV2SelfHead(mem,gseat,date){
  var sN=0,sP=0,rN=0,rP=0;
  (mem||[]).forEach(function(a){ var bk=a&&a.r&&a.r.bk; if(!bk||!bk.pickupSelf) return; sN++; sP+=(+a.head||0); if(bookingV2SelfRetToo(bk,date)){ rN++; rP+=(+a.head||0); } });
  if(!sN) return mem.length+' ราย · '+gseat+' pax';
  return '<span title="มีลูกค้ามาเอง '+sN+' ราย '+sP+' pax · ไม่นับในขาไป">ขาไป '+(mem.length-sN)+' ราย '+(gseat-sP)+' pax · ขากลับ '+(mem.length-rN)+' ราย '+(gseat-rP)+' pax</span>';
}
