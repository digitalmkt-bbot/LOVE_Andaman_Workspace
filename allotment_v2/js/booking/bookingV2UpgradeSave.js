function bookingV2UpgradeSave(bkId){
  const bk=(SB_BOOKINGS||[]).find(x=>x.id===bkId); if(!bk) return;
  if(!Array.isArray(bk.upgrades)) bk.upgrades=[];
  const label=((document.getElementById('bku-label')||{}).value||'Upgrade').trim();
  const sellPrice=Math.max(0,pckN((document.getElementById('bku-sell')||{}).value));
  const toCompany=Math.max(0,pckN((document.getElementById('bku-company')||{}).value));
  const commission=Math.max(0,pckN(sellPrice-toCompany));
  const collected=!!(document.getElementById('bku-coll')||{}).checked;
  const note=((document.getElementById('bku-note')||{}).value||'').trim();
  const seller=((document.getElementById('bku-seller')||{}).value||'').trim();
  if(sellPrice<=0){ alert('ใส่ราคาขาย'); return; }
  // §upgPay · ชุดเดียวกับที่ Extra บันทึก · ลูกค้าจ่ายจริง = ราคาขาย + ค่าธรรมเนียมบัตร
  const _upm=_bkExtraPay.m||'cash';
  const _ufee=(typeof bookingV2ExtraFee==='function')?bookingV2ExtraFee():0;
  const _uslips=(_bkExtraPay.slips||[]).slice();
  const _upay={ method:_upm, feePct:(_upm==='card'?(+_bkExtraPay.feePct||0):0),
                fee:_ufee, customerPaid:pckN(sellPrice+_ufee), slips:_uslips };
  if(_bkUpgEditId){
    const u=bk.upgrades.find(x=>x.id===_bkUpgEditId);
    if(u){ Object.assign(u,{label,sellPrice,toCompany,commission,collected,note,seller}, _upay); }
    if(typeof bookingV2AddHistory==='function') bookingV2AddHistory(bk,'extra','Edited upgrade · '+label+' · ขาย ฿'+pckNum(sellPrice)+' · คอม ฿'+pckNum(commission)+(seller?' · '+seller:''),'Extra');
    _bkUpgEditId=null;
  } else {
    bk.upgrades.push(Object.assign({id:'up_'+Date.now(), label, sellPrice, toCompany, commission, collected, note, seller, settle:'pending', at:new Date().toISOString()}, _upay));
    if(typeof bookingV2AddHistory==='function') bookingV2AddHistory(bk,'extra','Upgrade · '+label+' · ขาย ฿'+pckNum(sellPrice)+' · บริษัท ฿'+pckNum(toCompany)+' · คอม ฿'+pckNum(commission)+(seller?' · '+seller:''),'Extra');
  }
  if(typeof acctPersistBookings==='function') acctPersistBookings();
  if(typeof _bkUpgPayInit==='function') _bkUpgPayInit(null);   // §upgPay · ล้างบล็อกรับเงินกลับเป็นค่าตั้งต้น
  bookingV2Render(); bookingV2UpgradeRender();
}
