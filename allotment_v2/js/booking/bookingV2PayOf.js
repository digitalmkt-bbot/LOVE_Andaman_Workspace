function bookingV2PayOf(bk){
  var out={tot:0, paid:0, bal:0, over:0, inv:null, shared:0, bkTot:0, state:'noinv', cot:null, billable:0};
  try{
    out.cot=bookingV2CotOf(bk);
    out.bkTot=(typeof acctBookingTotal==='function')?acctBookingTotal(bk):(+bk.total||0);
    out.tot=out.bkTot;
    /* §vcCot · ที่เหลือวางบิล agent · เงินที่เก็บหน้างานแล้วหักออกไม่ต้องเก็บซ้ำ
       ข้อมูลจริงมี 11 ใบที่เงินหน้างานมากกว่ายอดทัวร์ (มีค่าอุทยาน/ของเพิ่มปนมา
       หรือกรอกผิด) · clamp ที่ 0 แล้วเงียบไม่ได้ ต้องเก็บส่วนเกินไว้บอก */
    out.billable=Math.max(0, out.bkTot-((out.cot&&out.cot.use)||0));
    if(out.cot) out.cot.over=Math.max(0, ((out.cot.use||0)-out.bkTot));
    var inv=(typeof acctBookingInvoice==='function')?acctBookingInvoice(bk.id):null;
    if(!inv){ out.bal=out.billable; return out; }
    out.inv=inv;
    out.shared=((inv.bookingIds||[]).length>1)?(inv.bookingIds||[]).length:0;
    out.tot=(+inv.total||0);
    out.bal=(typeof acctInvoiceBalance==='function')?acctInvoiceBalance(inv):0;
    out.paid=Math.max(0,(typeof acctInvoicePaid==='function')?acctInvoicePaid(inv):(out.tot-out.bal));
    /* จ่ายเกินยอดบิล · acctInvoiceBalance ตัดที่ 0 ให้ ส่วนเกินจึงหายไปเงียบ ๆ
       ข้อมูลจริงมี 3 ใบเป็นแบบนี้ (เช่น ออกบิล 6,000 แต่มีรายการจ่าย 11,200)
       จะโยนทิ้งไม่ได้ · ไม่งั้น TOTAL ไม่เท่ากับ PAID + BALANCE แล้วคนอ่านงง */
    out.over=Math.max(0, out.paid-out.tot);
    out.state=(out.bal<=0)?'paid':(out.paid>0?'partial':'due');
  }catch(_){}
  return out;
}
