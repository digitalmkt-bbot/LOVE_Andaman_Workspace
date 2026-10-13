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
  return {sep, drop, retId, arranged, selfRet, sameVan, alert: sep&&!arranged&&!selfRet&&!sameVan}; }
