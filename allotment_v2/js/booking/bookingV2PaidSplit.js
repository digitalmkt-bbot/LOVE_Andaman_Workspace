/* §mfPaid · ช่องยอดเงินบน Manifest บอกด้วยว่า "จ่ายแล้วเท่าไร · ค้างเท่าไร" (เดิมเห็นแต่ยอดรวม + ป้าย Awaiting)
   แหล่งเงิน: ใบแจ้งหนี้ (SB_PAYMENTS ผ่าน acctInvoicePaid) · B2C = paymentSnapshot.paid/balance ที่ sync มา
   (ระดับออเดอร์ ติดบรรทัดแรกบรรทัดเดียว — บรรทัดอื่นของออเดอร์เดียวกันไม่แสดง กันนับเงินซ้ำ)
   PFM ที่ยังไม่ออกใบ = ยังไม่ได้รับ → ค้างเต็มยอด · agent เครดิตที่ยังไม่วางบิล/COT = ยังไม่ถึงรอบเก็บ → ไม่แสดง
   ใบรวมหลาย booking ที่จ่ายบางส่วน แบ่งเงินลงรายใบไม่ได้ → แสดงยอดค้างของทั้งใบ พร้อมบอกว่าเป็นใบรวม */
function bookingV2PaidSplit(bk){
  if(!bk) return null;
  const inv=(typeof acctBookingInvoice==='function')?acctBookingInvoice(bk.id):null;
  if(inv){
    const paid=acctInvoicePaid(inv), bal=acctInvoiceBalance(inv);
    const n=(inv.bookingIds||[]).length;
    if(n<=1) return {paid, bal};
    const tot=acctBookingTotal(bk);
    if(bal<=0) return {paid:tot, bal:0};
    if(paid<=0) return {paid:0, bal:tot};
    return {paid, bal, multi:n, invNo:inv.number||''};
  }
  if(bk.agentId==='a_b2c'){
    // ps.balance is NOT trusted: B2C does not re-stamp it after a payment (LOV-8193989 on prod: paid 1,699 but
    // balance still 4,198 = total). Derive it as order total − paid. Lines of one order are b2c_<ref>_<n>;
    // the order-level paid sits on the lowest <n>, so only that line shows the split.
    const m=String(bk.id||'').match(/^(.*)_(\d+)$/); if(!m) return null;
    const lines=(SB_BOOKINGS||[]).filter(x=>{ const k=String(x.id||'').match(/^(.*)_(\d+)$/); return k&&k[1]===m[1]; });
    const first=lines.reduce((lo,x)=>(+x.id.match(/_(\d+)$/)[1] < +lo.id.match(/_(\d+)$/)[1] ? x : lo), lines[0]||bk);
    if(first.id!==bk.id) return null;
    const live=lines.filter(x=>!['cancelled','cancelled_weather','rejected'].includes(x.status));
    const tot=live.reduce((s2,x)=>s2+acctBookingTotal(x),0); if(tot<=0) return null;
    const paid=lines.reduce((s2,x)=>s2+(Number(x.paymentSnapshot&&x.paymentSnapshot.paid)||0),0);
    return {paid, bal:Math.max(0,tot-paid), order:live.length>1?live.length:0};
  }
  const a=(typeof sbGetAgent==='function')?sbGetAgent(bk.agentId):null;
  if(a && a.payType==='proforma'){ const tot=acctBookingTotal(bk); if(tot>0) return {paid:0, bal:tot}; }
  return null;
}
