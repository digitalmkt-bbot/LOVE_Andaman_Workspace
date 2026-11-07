function bookingV2ExtraSetSplit(on){
  _bkExtraPay.split=!!on; _bkExtraPay.amts=_bkExtraPay.amts||{cash:'',transfer:'',card:''};
  /* เปิดแบ่งจ่าย · ยกยอดทั้งก้อนไปไว้ที่วิธีที่เลือกอยู่ก่อน ผู้ใช้ค่อยแบ่งออก */
  if(on){ var b=_bkxPayBase(), m=(_bkExtraPay.m==='cot')?'cash':(_bkExtraPay.m||'cash'); _bkExtraPay.amts={cash:'',transfer:'',card:''}; _bkExtraPay.amts[m]=b?String(b):''; }
  bookingV2ExtraPayRender();
}
