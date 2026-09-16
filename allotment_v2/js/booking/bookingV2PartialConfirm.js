function bookingV2PartialConfirm(bookingId, tripIdx){
  const bk=SB_BOOKINGS.find(b=>b.id===bookingId); if(!bk) return;
  const t=bk.trips[tripIdx]; if(!t){ acctModalClose(); return; }
  const category=(document.getElementById('bkp-cat')||{}).value||'';
  if(!category){ alert('กรุณาเลือกประเภทการยกเลิก'); return; }
  const note=((document.getElementById('bkp-note')||{}).value||'').trim();
  if(category==='other' && !note){ alert('กรุณาระบุรายละเอียดสำหรับ "อื่นๆ"'); return; }
  const removed={}; let totalRem=0;
  BKV2_PAX_KEYS.forEach(([k])=>{
    const el=document.getElementById('bkp-rm-'+k); if(!el) return;
    let n=Math.max(0,Math.min(parseInt(el.value)||0,t.pax[k]||0));
    if(n>0){ removed[k]=n; totalRem+=n; }
  });
  if(!totalRem){ alert('กรุณาระบุจำนวนผู้โดยสารที่จะลด'); return; }
  // charge / waive split
  let chargedCount=Math.max(0,Math.min(parseInt((document.getElementById('bkp-chg-cnt')||{}).value)||0,totalRem));
  const waivedCount=Math.max(0,totalRem-chargedCount);
  const chargeAmt=Math.max(0,Number((document.getElementById('bkp-chg-amt')||{}).value)||0);
  const waiveAmt=Math.max(0,Number((document.getElementById('bkp-waive-amt')||{}).value)||0);  // = refund (only the not-charged)
  const refund=waiveAmt;
  const refundMode=refund>0?'refund':'none';
  acctModalClose();
  bookingV2PartialCancel(bookingId, tripIdx, { removed, totalRem, category, note, refundMode, refund,
    charged:{count:chargedCount, amount:chargeAmt}, waived:{count:waivedCount, amount:waiveAmt} });
  if(typeof bookingV2Render==='function') bookingV2Render();
}
