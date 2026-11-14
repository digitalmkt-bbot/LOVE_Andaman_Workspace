// ── Manual van grouping · mark bookings that go together = 1 group · van assigned to the group later (optional) ──
/* §vanTickFast (2026-11-12) · owner "คลิกแล้วดีเลย์" (13 พ.ย. · โหมด Van · ติ๊กเลือกใบ 1 ครั้ง = วาดทั้งหน้าใหม่ 2–3 วินาที · วัดจริง 2,080–3,380 ms)
   ติ๊กแล้วเปลี่ยนสีช่องทันที · การวาดใหม่ทั้งหน้ารอ 350 ms หลังติ๊กครั้งสุดท้าย → ติ๊กหลายใบรัว ๆ ได้ วาดรอบเดียว
   สถานะที่เลือก (_bkV2VanSel) อัปเดตทันทีเหมือนเดิม · ปุ่มอื่นที่อ่านค่านี้จึงเห็นค่าล่าสุดเสมอ */
function bookingV2VanSelToggle(bkId, el){ window._bkV2VanSel=window._bkV2VanSel||{}; var on;
  if(window._bkV2VanSel[bkId]){ delete window._bkV2VanSel[bkId]; on=false; } else { window._bkV2VanSelN=(window._bkV2VanSelN||0)+1; window._bkV2VanSel[bkId]=window._bkV2VanSelN; on=true; }
  if(el && el.style){ try{ el.style.background=on?'#185FA5':'transparent'; el.style.color=on?'#fff':'transparent'; el.style.border=on?'1.5px solid #185FA5':'1.5px solid #C9CDD4'; }catch(_){ }
    clearTimeout(window._bkV2VanSelT); window._bkV2VanSelT=setTimeout(function(){ window._bkV2VanSelT=0; bookingV2RenderKeep(); }, 350); return; }
  bookingV2RenderKeep(); }
