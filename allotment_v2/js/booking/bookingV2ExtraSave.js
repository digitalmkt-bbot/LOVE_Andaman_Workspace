function bookingV2ExtraSave(bkId){
  const name=((document.getElementById('bkx-name')||{}).value||'Extra').trim();
  const qty=Math.max(1,+(document.getElementById('bkx-qty')||{}).value||1);
  const price=Math.max(0,pckN((document.getElementById('bkx-price')||{}).value));
  if(price<=0){ alert('ใส่ราคา'); return; }
  const total=pckN(qty*price);
  const toCompany=Math.min(total,Math.max(0,pckN((document.getElementById('bkx-company')||{}).value)));
  const commission=pckN(Math.max(0,total-toCompany));
  const seller=((document.getElementById('bkx-seller')||{}).value||'').trim();
  const _pm=_bkExtraPay.m||'cash';
  const _fee=bookingV2ExtraFee();
  const _slips=(_bkExtraPay.slips||[]).slice();
  if(_pm!=='cash' && _pm!=='cot' && !_slips.length && !confirm('ยังไม่ได้แนบสลิป\n\nบันทึกก่อนแล้วแนบทีหลังได้ · กด OK เพื่อบันทึกเลย')) return;
  const bk=(SB_BOOKINGS||[]).find(x=>x.id===bkId);
  if(_bkExtraEditId){
    // update existing record (no duplicate)
    const e=SB_EXTRAS.find(x=>x.id===_bkExtraEditId);
    if(e){ e.service=name; e.qty=qty; e.unitPrice=price; e.total=total; e.toCompany=toCompany; e.commission=commission; e.seller=seller;
           e.method=_pm; e.feePct=(_pm==='card'?(+_bkExtraPay.feePct||0):0); e.fee=_fee; e.customerPaid=pckN(total+_fee);
           e.slips=(_pm==='cot'?[]:_slips);
           /* §exCot · เก็บเงินวันเดินทาง = ยังไม่ปิดยอด · เปลี่ยนเป็นวิธีอื่นเมื่อไหร่ = เก็บแล้ว */
           e.settle=(_pm==='cot'?'pending':'done');
           if(_pm==='cot') e.collectedAt=''; else if(!e.collectedAt) e.collectedAt=new Date().toISOString(); }
    if(bk && typeof bookingV2AddHistory==='function'){ bookingV2AddHistory(bk,'extra','Edited extra · '+name+(qty>1?' ×'+qty:'')+' · ฿'+pckNum(total)+(commission?' · คอม ฿'+pckNum(commission):''),'Extra'); if(typeof acctPersistBookings==='function') acctPersistBookings(); }
    _bkExtraEditId=null;
  } else {
    SB_EXTRAS.push({id:LA_UID('ex_'), bookingId:bkId, tripDate:(typeof bookingV2ExtraDayOf==='function'?bookingV2ExtraDayOf(bk):((bk&&bk.trips&&bk.trips[0]&&bk.trips[0].date)||'')), service:name, qty, unitPrice:price, total, toCompany, commission, seller,
      method:_pm, feePct:(_pm==='card'?(+_bkExtraPay.feePct||0):0), fee:_fee, customerPaid:pckN(total+_fee),
      slips:(_pm==='cot'?[]:_slips),
      settle:(_pm==='cot'?'pending':'done'), collectedAt:(_pm==='cot'?'':new Date().toISOString()),
      date:new Date().toISOString()});
    if(bk && typeof bookingV2AddHistory==='function'){ bookingV2AddHistory(bk,'extra','Day-of extra · '+name+(qty>1?' ×'+qty:'')+' · ฿'+pckNum(total)+(commission?' · คอม ฿'+pckNum(commission):'')+' ('+_pm+(_fee?(' · fee ฿'+pckNum(_fee)):'')+')','Extra'); if(typeof acctPersistBookings==='function') acctPersistBookings(); }
  }
  _bkxPayReset(null);
  sbExtrasPersist(); bookingV2Render(); bookingV2ExtraRender();
}
