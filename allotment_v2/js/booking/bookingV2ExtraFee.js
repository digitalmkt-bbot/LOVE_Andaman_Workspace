// ค่าธรรมเนียมบัตรคิดบนยอดขาย · ลูกค้าจ่ายจริง = ยอดขาย + ค่าธรรมเนียม (กติกาเดียวกับหน้าเก็บเงิน)
// §pierDecimal · เศษสตางค์อยู่ครบ (650 x 3% = 19.50) · เดิมปัดเป็น 20 แล้วยอดไม่ตรงสลิปเครื่องรูด
function bookingV2ExtraFee(){
  if(_bkExtraPay.m!=='card') return 0;
  return pckN(_bkxPayBase()*(+_bkExtraPay.feePct||0)/100);
}
