/* ป้ายท่าเรือหน้ารายการ · ของเดิมเขียนว่า "ไม่ใช่ท้ายเหมือง = VP"
   เส้นระนองจึงติดป้าย VP (Visit Panwa) ทั้งที่ออกจากท่าระนอง */
function bookingV2PierTag(pier){
  return ({ tublamu:'TL', panwa:'VP', ranong:'RN' })[pier]
      || (pier ? String(pier).slice(0,2).toUpperCase() : '\u2014');
}
