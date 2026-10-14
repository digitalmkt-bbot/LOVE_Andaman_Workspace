/* ══ §btBoatPick (2026-10-13) · เลือกเรือได้จากหน้า By trip date โดยไม่ต้องเปิดโหมดเรือ ══════
   ที่มา · owner "สามารถให้เลือกเรือในหน้า By trip date ได้โดยไม่ต้องเปิดโหมดเรือแล้วได้ไหม"
   ช่อง Boat ของแถวกลายเป็นปุ่ม · กดแล้วเปิดตัวเลือกเรือตัวเดียวกับโหมดเรือ (bookingV2BoatPicker)
   บันทึกผ่าน bookingV2AssignBoat ตัวเดิม · ด่าน cap / เรือเหมาลำ / บุคกิ้งแยกลำ ทำงานเหมือนเดิมทุกอย่าง
   ไม่เปิดให้กด: ไม่มีสิทธิ์แก้ใบจอง · ใบยกเลิก · เหมาลำ (เรือผูกตอนจอง)
   §bpk2 · Upgrade / แยกลงหลายลำ อยู่ท้ายตัวเลือกเรือแล้ว · ติ๊กหลายแถวแล้วจัดทีเดียวยังอยู่ในโหมดเรือ */
function bookingV2BoatPickWrap(bk, rid, a, r, has, inner){
  try{
    if(!bk || !r || r.cxl || r.charter || r.charterBoatId) return inner;   /* §bpk2 · แถวแยกลงหลายลำก็กดได้แล้ว (ในตัวเลือกมีปุ่มแก้การแยก) */
    if(typeof acctCanEditBookings === 'function' && !acctCanEditBookings()) return inner;
    if(typeof bookingV2BoatPicker !== 'function') return inner;
    var q = function(v){ return String(v==null?'':v).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;'); };
    var on = 'event.stopPropagation();bookingV2BoatPicker(this,\''+q(bk.id)+'\',\''+q(rid)+'\')';
    return has
      ? '<button type="button" class="t2-bpk" onclick="'+on+'" title="'+q(laT('กดเพื่อเปลี่ยนเรือ'))+'">'+inner+'</button>'
      : '<button type="button" class="t2-bpk add" onclick="'+on+'" title="'+q(laT('กดเพื่อเลือกเรือ'))+'" aria-label="'+q(laT('เลือกเรือ'))+'">+</button>'   /* §btBoatPick · owner "เลือกเรือ ให้เป็นปุ่ม + พอ" */;
  }catch(_){ return inner; }
}
