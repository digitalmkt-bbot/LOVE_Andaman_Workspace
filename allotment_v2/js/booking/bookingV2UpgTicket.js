function bookingV2UpgTicket(){ var U=_bkUpg; if(!U) return; var el=document.getElementById('bkupg-tkm'); if(!el) return;
  var amt=Math.max(0, parseFloat(String(U.charge||'').replace(/[^0-9.]/g,''))||0);
  el.textContent=(U.chargeOn && amt>0)?(laT('เก็บเพิ่ม')+' ฿'+amt.toLocaleString()+' '+laT('ที่หน้าท่า')):(laT('ยึดราคาที่จอง')+' · '+laT('ไม่เก็บเพิ่ม'));
}
