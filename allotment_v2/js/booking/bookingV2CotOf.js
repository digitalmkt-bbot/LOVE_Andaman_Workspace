/* ยอดของใบนี้
   ⚠ อย่าคิด PAID จาก "ยอด booking ลบยอดค้างของใบแจ้งหนี้" แบบที่หน้า PFM ทำ
     สูตรนั้นเดาว่าส่วนที่ไม่ได้อยู่บนใบแจ้งหนี้คือจ่ายแล้ว · ในข้อมูลจริงมี 5 ใบ
     จาก 304 ที่ยอดบน booking ไม่เท่ายอดบนใบแจ้งหนี้ (ใบมัดจำ / ออกบิลบางส่วน)
     แล้วมันโชว์ PAID 4,400 ทั้งที่ยังไม่มีใครจ่ายสักบาท
   ตรงนี้ยึดตัวใบแจ้งหนี้เป็นหลัก · TOTAL = PAID + BALANCE เสมอ
   แล้วถ้ายอด booking ไม่ตรงกับยอดที่ออกบิล ก็บอกไว้เป็นบรรทัดต่างหาก
   ใบแจ้งหนี้หนึ่งใบคลุมได้หลาย booking (ตอนนี้ 1:1 ทั้ง 330 ใบ แต่โครงสร้างเปิดทางไว้)
   ถ้าวันไหนคลุมหลายใบ ห้ามหารเดาให้ · บอกไปตรง ๆ */
/* §vcCot · เงินเก็บหน้างาน (Cash on Tour)
   bk.cashOnTour = แผนที่ตั้งไว้ตอนเปิดใบ · handling 'deduct' = หักจากใบแจ้งหนี้ของ agent
     (agent ค้างเราน้อยลงเท่านั้น) · 'separate' = เก็บแยก ใบแจ้งหนี้ไม่เกี่ยว
   TS_COT = คำตัดสินจริงหลังจบทริปที่หน้า Travel Summary · deduct / payout เท่าไร
   ต้องแยกสองอันนี้ให้ชัด · แผนไม่ใช่ของจริง ตราบใดที่ยังไม่มีใครตัดสิน */
function bookingV2CotOf(bk){
  var o={amt:0, cur:'THB', handling:'', use:0, settled:null, deduct:0, payout:0};
  try{
    var C=bk && bk.cashOnTour;
    if(!C || !(+C.amount>0)) return o;
    o.amt=+C.amount||0; o.cur=C.currency||'THB'; o.handling=C.handling||'deduct';
    if(typeof tsCotGet==='function'){
      var any=null, dd=0, pp=0;
      (bk.trips||[]).forEach(function(t){
        var k=t&&t.date; if(!k) return;
        var st=tsCotGet(bk.id,k); if(!st) return;
        any=st; dd+=(+st.deduct||0); pp+=(+st.payout||0);
      });
      if(any){ o.settled=any; o.deduct=dd; o.payout=pp; }
    }
    /* ตัดสินแล้วใช้ของจริง · ยังไม่ตัดสินก็ใช้แผน แต่ต้องบอกว่ายังเป็นแผน */
    o.use = o.settled ? o.deduct : (o.handling==='deduct' ? o.amt : 0);
    o.mode = o.settled ? (o.settled.mode||'') : '';
  }catch(_){}
  return o;
}
