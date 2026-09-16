/* §per-trip ops · เดิมไม่รับ date เลย → ลำดับรับ (vanSeq) ของวันที่ 2 ไปเขียนทับวันที่ 1 · ตัวเรียกส่ง date มาแล้ว */
function bookingV2VanGroupSave(date){
  // if rows are currently ticked, re-order their pickup sequence by the order they were ticked (per group)
  const sel=Object.keys(window._bkV2VanSel||{}).filter(k=>window._bkV2VanSel[k]);
  if(sel.length){
    const ordered=sel.slice().sort((a,b)=>(window._bkV2VanSel[a]||0)-(window._bkV2VanSel[b]||0));
    const perG={};
    ordered.forEach(key=>{ const p=String(key).split('@'); const b=SB_BOOKINGS.find(x=>x.id===p[0]); if(!b)return; const o=bkOpsRead(b,date); if(!o)return; let tgt,g; if(p.length>1 && Array.isArray(o.vanSplits) && o.vanSplits[+p[1]]){ tgt=o.vanSplits[+p[1]]; g=+tgt.vanGroup||0; } else { tgt=o; g=+o.vanGroup||0; } perG[g]=(perG[g]||0)+1; tgt.vanSeq=perG[g]; });
    window._bkV2VanSel={};
  }
  acctPersistBookings(); if(typeof bookingV2Render==='function') bookingV2Render();
}
