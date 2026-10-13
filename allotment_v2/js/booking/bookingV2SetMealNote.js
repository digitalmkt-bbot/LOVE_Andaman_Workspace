/* §bkAlFree · เขียนลง draft ทันทีที่พิมพ์ · ไม่ต้องกดปุ่มอะไรเพิ่ม
   ไม่เรียก bookingV2Render เพราะจะทำให้เคอร์เซอร์กระเด็นออกจากช่องกลางคัน */
function bookingV2SetMealNote(v){
  const d=_bkV2.newBooking; if(!d) return;
  const sm=d.specialMeals||(d.specialMeals={veg:0,vegan:0,halal:0,allergies:''});
  sm.allergies=String(v==null?'':v);
}
