// Return-trip state for a booking: separate drop-off location + whether a return van is arranged.
// alert = customer returns to a DIFFERENT place than pickup (dropoffSame===false) but no return van assigned yet.
function bookingV2RetInfo(bk, date){ const o=((typeof bkOpsRead==='function')?bkOpsRead(bk,date):((bk&&bk.ops)||{}))||{};   /* §per-trip ops · สถานะ "จัดรถกลับแล้วยัง" ต้องดูของวันนั้น */
  const sep=bk.dropoffSame===false && !!(bk.dropoffHotelName||bk.dropoffArea||bk.dropoffAreaId); const drop=sep?(bk.dropoffHotelName||bk.dropoffArea||''):''; let retId=null,arranged=false;
  // self-return: drop-off is a self-arrive / No-Transfer pier (or text says self-arrive) → customer goes back on their own · no return van needed
  let selfRet=false;
  if(sep){ const aid=bk.dropoffAreaId||bk.dropoffArea; const ar=(aid&&typeof bookingV2GetArea==='function')?bookingV2GetArea(aid):null; const nm=((ar&&ar.name)||bk.dropoffHotelName||String(aid||'')); if((ar&&(ar.zone==='NoTransfer'||ar.zone==='NT')) || /self-?arrive|กลับเอง|self[\s-]?return/i.test(nm)) selfRet=true; }
  if(Array.isArray(o.vanSplits)&&o.vanSplits.length){ const rs=o.vanSplits.map(s=>s.vanReturnId).filter(Boolean); arranged=rs.length>0&&rs.length===o.vanSplits.length; retId=rs[0]||null; }
  else { retId=o.vanReturnId||null; arranged=!!retId; }
  const sameVan=!!o.returnSameVan;   // dispatcher confirmed "กลับคันเดิม" (รถขาไปพากลับ · ส่งจุดใหม่) → clears the alert
  /* §ovnOutNoRet (2026-11-06) · owner: "ของวันที่ 6 ไม่ควรจะขึ้นว่ามีรถกลับ แต่ขึ้นป้าย OVN ถูกแล้ว"
     วันขาไปของใบค้างคืน ลูกค้าไม่กลับวันนี้ · รถไปส่งจุดใหม่เป็นงานของวันขากลับ (ovnLeg) ไม่ใช่วันนี้ */
  const _tD=(bk.trips||[]).filter(t=>t&&t.date===date), ovnOut=_tD.length>0 && _tD.every(t=>t.ovn && !t.ovnLeg);
  const ovnRetDate=ovnOut?String((_tD.find(t=>t.ovnReturnDate)||{}).ovnReturnDate||''):'';
  /* §ovnLegVan (2026-11-06) · owner: "ทำไมอีกวัน (ขากลับ) ถึงย้ายมาอยู่ในแถบรถรับด้วย" (E58480 · 7 พ.ย. · TRANSFER จับเข้ากรุ๊ป VAN12)
     ขากลับค้างคืนไม่มีขารับ · รถคันเดียวที่เกี่ยวคือคันที่พาจากท่าไปส่งโรงแรม · ทีมรถจับใบเข้ากรุ๊ป/เลือกรถในช่องรับ (vanId) ซึ่งเป็นช่องเดียวที่มีให้กด
     → สำหรับขากลับ ถือว่ารถในช่องรับ = รถส่งกลับ · ป้าย ⚠ หาย · ใบงานรถคันนั้นเห็นว่าต้องไปส่งที่ไหน */
  const ovnLeg=_tD.length>0 && _tD.every(t=>t.ovnLeg);
  if(ovnLeg && !retId && !selfRet){ const _pv=(Array.isArray(o.vanSplits)&&o.vanSplits.length)?(o.vanSplits[0].vanId||null):(o.vanId||null); if(_pv){ retId=_pv; arranged=true; } }
  return {sep, drop, retId, arranged, selfRet, sameVan, ovnOut, ovnRetDate, ovnLeg, alert: sep&&!arranged&&!selfRet&&!sameVan&&!ovnOut}; }
