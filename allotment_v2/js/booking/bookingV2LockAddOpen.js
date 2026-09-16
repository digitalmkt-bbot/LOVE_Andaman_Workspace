// ── เพิ่มที่นั่งในล็อกเดิม ──
function bookingV2LockAddOpen(id){ const l=SB_SEAT_LOCKS.find(x=>x.id===id); if(!l) return; _bkV2AddModal={ lockId:id, add:'5', note:'' }; bookingV2Render(); }
