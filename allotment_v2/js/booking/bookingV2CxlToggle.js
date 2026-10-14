// §cxlFold · กาง/พับ รายการยกเลิกของทริปหนึ่ง · แก้ที่หน้าจอตรง ๆ ไม่วาดใหม่ทั้งหน้า
function bookingV2CxlToggle(el, key){
  var sec = el && el.closest ? el.closest('.t2-cxl-sec') : null; if(!sec) return;
  var on = !sec.classList.contains('open');
  sec.classList.toggle('open', on);
  window._bkV2CxlOpen = window._bkV2CxlOpen || {};
  if(on) window._bkV2CxlOpen[key] = 1; else delete window._bkV2CxlOpen[key];
}
