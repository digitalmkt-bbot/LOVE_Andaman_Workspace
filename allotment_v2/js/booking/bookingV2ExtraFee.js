// ค่าธรรมเนียมบัตรคิดบนยอดขาย · ลูกค้าจ่ายจริง = ยอดขาย + ค่าธรรมเนียม (กติกาเดียวกับหน้าเก็บเงิน)
// §pierDecimal · เศษสตางค์อยู่ครบ (650 x 3% = 19.50) · เดิมปัดเป็น 20 แล้วยอดไม่ตรงสลิปเครื่องรูด
function bookingV2ExtraFee(){
  var pct=(+_bkExtraPay.feePct||0), base=_bkxPayBase();
  if(bkxPaySplitOn()){ var P=bkxPayParts(base), f=0; P.forEach(function(q){ if(q.method==='card') f+=pckN(q.amount*pct/100); }); return pckN(f); }   /* §exSplitPay */
  if(_bkExtraPay.m!=='card') return 0;
  return pckN(base*pct/100);
}
