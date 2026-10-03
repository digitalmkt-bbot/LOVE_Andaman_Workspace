function bookingV2GrpDragStart(ev){
  var tr=_grpRowOf(ev.target); if(!tr) return;
  _grpDrag={ key:tr.getAttribute('data-gk')||'', g:+tr.getAttribute('data-grp')||0 };
  try{ ev.dataTransfer.effectAllowed='move'; ev.dataTransfer.setData('text/plain', String(_grpDrag.g)); }catch(_){}
  tr.classList.add('grp-dragging');
}
