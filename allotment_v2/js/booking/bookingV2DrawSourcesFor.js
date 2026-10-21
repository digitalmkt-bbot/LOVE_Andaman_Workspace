/* §lkStaleDraw (2026-10-20) · ใบจองที่ดึงจากล็อกที่ถูกปล่อย/เต็มไปแล้ว · หน้าแก้ไขไม่ขึ้นกล่องล็อก (ไม่มีที่เหลือให้ดึง)
   จึงลดการดึงเป็น 0 ไม่ได้ · Upgrade ก็ติด "Release the lock draw first" ตลอด
   ใส่ล็อกที่ใบนี้เลือกดึงไว้แล้ว (lockDrawSel) กลับเข้ารายการด้วย · ลดได้อย่างเดียว ไม่เพิ่มเกินที่เคยดึง */
function bookingV2DrawSourcesFor(t, agentId){
  const srcs = bookingV2DrawSources(t.routeId, t.date, agentId);
  const sel = t.lockDrawSel || {};
  /* ใบที่บันทึกแล้ว: ที่นั่งที่ใบนี้ดึงไว้ยังนับเป็น "ใช้แล้ว" ระหว่างแก้ (คืนตอนกดบันทึก) → บวกกลับให้ปรับได้เต็มจำนวน */
  const own = {}; (Array.isArray(t.lockDraws)?t.lockDraws:[]).forEach(x=>{ if(x && x.lockId) own[x.lockId]=(own[x.lockId]||0)+(Number(x.qty)||0); });
  Object.keys(sel).forEach(id=>{ const q = Math.max(own[id]||0, Number(sel[id])||0); if(!((Number(sel[id])||0)>0)) return;
    const s = srcs.find(x=>x.lockId===id);
    if(s){ s.remaining += (own[id]||0); return; }
    const l = SB_SEAT_LOCKS.find(x=>x.id===id);
    const p = l && l.parentId ? SB_SEAT_LOCKS.find(x=>x.id===l.parentId) : null;
    const nm = l ? (bookingV2LockHolderName(p||l)+(l.parentId?(' · '+(l.subName||'ย่อย')):'')) : id;
    srcs.push({lockId:id, label:nm+' · ดึงไว้เดิม', remaining:q, held:true}); });
  return srcs;
}
