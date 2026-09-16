// ── Safety net · reconcile vanGroup → vanId so a grouped booking can never silently lack a van ──
// For each van-group (date|route|zone|gid), if ANY member has a vanId but others don't, the others inherit it.
// Prevents "ตกบุคกิ้ง" (a booking added to a van-group but missing the van → not shown for pickup). Idempotent.
function bookingV2VanGroupHeal(date){
  const isC=b=>['cancelled','rejected','cancelled_weather'].includes(b.status);
  const grp={};   // key → {van, ret}
  /* §per-trip ops · เดิมวน trips แต่หยิบ b.ops (วันแรก) มาใช้ทุกวัน → กรุ๊ปวันที่ 2 ถูก "ซ่อม" ด้วยรถของวันที่ 1
     ทับของที่เพิ่งจัดไปทุกครั้งที่เปิดใบงาน · ตอนนี้ ops ตามวันของ trip นั้นๆ */
  const walk=(fn)=>{ (SB_BOOKINGS||[]).forEach(b=>{ if(isC(b))return; (b.trips||[]).forEach(t=>{ if(date&&(t.date||'')!==date)return; const o=bkOpsRead(b,t.date||''); if(!o)return; const z=(t.bookingMode==='charter')?'__CHARTER__':((typeof bookingV2EffZone==='function'?bookingV2EffZone(b,t):(t.zone||b.pickupZone))||''); const k=(t.date||'')+'|'+(t.routeId||'')+'|'+z; if(Array.isArray(o.vanSplits)&&o.vanSplits.length){ o.vanSplits.forEach(s=>fn(b,k,s,o)); } else { fn(b,k,null,o); } }); }); };
  walk((b,k,s,o)=>{ const g=s?+s.vanGroup||0:+(o.vanGroup)||0; if(!g)return; const van=s?s.vanId:o.vanId; const e=grp[k+'|'+g]=grp[k+'|'+g]||{van:null}; if(van&&!e.van)e.van=van; });
  let healed=0;
  // heal ONLY the outbound van (ป้องกันตกบุคกิ้ง) · vanReturnId เป็น per-booking (ว่าง = กลับคันเดิม) → ไม่กระจายทั้งกรุ๊ป
  walk((b,k,s,o)=>{ const g=s?+s.vanGroup||0:+(o.vanGroup)||0; if(!g)return; const e=grp[k+'|'+g]; if(!e||!e.van)return; if(s){ if(!s.vanId){s.vanId=e.van;healed++;} } else { if(!o.vanId){o.vanId=e.van;healed++;} } });
  if(healed && typeof acctPersistBookings==='function') acctPersistBookings();
  return healed;
}
