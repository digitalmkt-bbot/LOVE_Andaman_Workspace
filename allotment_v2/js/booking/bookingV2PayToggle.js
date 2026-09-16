function bookingV2PayToggle(){
  if(typeof window.laCanEditArea==='function' && !window.laCanEditArea('operations')){
    alert('เปิด/ปิดแถบเงินเป็นค่าของทั้งระบบ · ต้องมีสิทธิ์แก้ไข Operations');
    return;
  }
  try{ var B=laBlob(); B.bk_cfg=B.bk_cfg||{}; B.bk_cfg.vcPay = bookingV2PayShow()?0:1; laBlobSave(); }catch(_){}
  /* วาดหน้า Booking ใหม่ · หน้ารายละเอียดใช้ตัววาดตัวเดียวกับหน้ารายการ */
  try{ if(typeof bookingV2Render==='function') bookingV2Render(); }catch(_){}
}
