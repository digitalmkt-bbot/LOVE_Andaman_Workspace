function bookingV2GrpDragOver(ev){
  var tr=ev.currentTarget;
  /* ข้ามโซน/ข้ามโปรแกรมไม่ได้ · เลขกรุ๊ปเริ่มใหม่ทุกโซน ลากข้ามแล้วจะทับกันมั่ว */
  if(!_grpDrag || !tr || (tr.getAttribute('data-gk')||'')!==_grpDrag.key) return;
  ev.preventDefault(); try{ ev.dataTransfer.dropEffect='move'; }catch(_){}
  if(!tr.classList.contains('grp-dragging')) tr.classList.add('grp-dropinto');
}
