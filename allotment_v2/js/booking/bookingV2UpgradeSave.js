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
    /* §exDupPier · ยังไม่ติ๊กเก็บ และหน้าท่าเก็บเงินก้อนนี้ไปแล้ว → ห้ามติ๊กเก็บซ้ำ ไม่งั้นนับสองรอบ */
    if(u && !u.collected && collected){
      var _d=(typeof bookingV2ExtraDayOf==='function')?bookingV2ExtraDayOf(bk):(((bk.trips||[])[0]||{}).date||'');
      var _paid=(typeof pckPaidSum==='function')?pckPaidSum(bk,_d):0;
      if(_paid>0 && pckN(_paid) >= pckN(bkxExNeed(bk,_d)) - 0.005){
        alert('เงินของอัปเกรดนี้บันทึกไว้ที่หน้าท่าแล้ว (ปุ่มเก็บเงินในหน้า Pier check-in)\n\nไม่ต้องติ๊ก "เก็บแล้ว" ซ้ำ · ระบบนับจากแถวเงินหน้าท่าอยู่แล้ว\nถ้าวิธี/ค่าธรรมเนียมไม่ตรง ให้แก้ที่รายการเงินหน้าท่าแทน');
        return;
      }
    }
    if(u){ Object.assign(u,{label,sellPrice,toCompany,commission,collected,note,seller}, _upay); }
    if(typeof bookingV2AddHistory==='function') bookingV2AddHistory(bk,'extra','Edited upgrade · '+label+' · ขาย ฿'+pckNum(sellPrice)+' · คอม ฿'+pckNum(commission)+(seller?' · '+seller:''),'Extra');
    _bkUpgEditId=null;
  } else {
    bk.upgrades.push(Object.assign({id:'up_'+Date.now(), label, sellPrice, toCompany, commission, collected, note, seller, settle:'pending', at:new Date().toISOString()}, _upay));
    if(typeof bookingV2AddHistory==='function') bookingV2AddHistory(bk,'extra','Upgrade · '+label+' · ขาย ฿'+pckNum(sellPrice)+' · บริษัท ฿'+pckNum(toCompany)+' · คอม ฿'+pckNum(commission)+(seller?' · '+seller:''),'Extra');
  }
  /* operation-backend is on: the upgrade list goes to the server with the booking (PATCH). Off: the legacy save. */
  var _upSync=(typeof bookingV2SyncToOpsBackend==='function')?bookingV2SyncToOpsBackend(bk):null;
  if(_upSync && _upSync.catch) _upSync.catch(function(e){ if(window.laOps && window.laOps.fail) window.laOps.fail('Upgrade not saved', e); });
  else if(typeof acctPersistBookings==='function') acctPersistBookings();
  if(typeof _bkUpgPayInit==='function') _bkUpgPayInit(null);   // §upgPay · ล้างบล็อกรับเงินกลับเป็นค่าตั้งต้น
  bookingV2Render(); bookingV2UpgradeRender();
}
