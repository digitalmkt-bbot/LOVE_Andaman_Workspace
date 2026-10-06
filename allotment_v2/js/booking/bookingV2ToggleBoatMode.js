/* §vanBoatBoth · ผู้ใช้แจ้ง 6 ต.ค. · เรือหลายลำจัดยาก ติ๊กรถแล้วจัดเรือไม่ได้ ติ๊กเรือแล้วรถไม่เรียงคัน
   Van กับ Boat เปิดพร้อมกันได้แล้ว · แถวยังเรียงตามกรุ๊ปรถ (_boatCluster ปิดเมื่อมี vanMode)
   Re-confirm ยังเป็นโหมดเดี่ยวเหมือนเดิม */
function bookingV2ToggleBoatMode(){ _bkV2.boatAssignMode=!_bkV2.boatAssignMode; if(_bkV2.boatAssignMode) _bkV2.reconfirmMode=false; bookingV2Render(); }
