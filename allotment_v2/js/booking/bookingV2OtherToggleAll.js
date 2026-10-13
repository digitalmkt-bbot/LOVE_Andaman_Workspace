/* สลับระหว่าง "เฉพาะใบจากเว็บ" กับ "ทุกใบ" · เก็บบน window ไม่ใช่ _bkV2
   เพราะเป็นสถานะการมองอย่างเดียว ไม่ต้องติดไปกับตัวกรองอื่นของแท็บ */
function bookingV2OtherToggleAll(){
  window._btOtherShowAll = !window._btOtherShowAll;
  if(typeof bookingV2Render==='function') bookingV2Render();
}
