function bookingV2BoatLockSet(f,v){
  if(!_bkBoatForm) return;
  _bkBoatForm[f]=v;
  /* เลือกลำแล้วเติมที่นั่งขั้นต่ำให้เท่าความจุลำนั้น · คนส่วนใหญ่สัญญาเท่าลำที่เลือก
     แต่ถ้าแก้เองแล้วห้ามทับ (capTouched) ไม่งั้นตัวเลขที่ตั้งใจพิมพ์หายตอนสลับลำ */
  if(f==='boatId' && !_bkBoatForm.capTouched) _bkBoatForm.minCap = bookingV2BoatCapOn(v,_bkBoatForm.date);
  /* ตอนแก้ใบ ไม่ล้างลำทิ้ง · ลำเดิมมักยังใช้ได้ในวันใหม่ ถ้าไม่ได้รายการข้างล่างจะบอกเอง */
  if(f==='date' && !_bkBoatForm.editId) _bkBoatForm.boatId='';
  if(typeof bookingV2Render==='function') bookingV2Render();
}
