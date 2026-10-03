function bookingV2GrpDrop(ev){
  var tr=ev.currentTarget;
  if(!_grpDrag || !tr || (tr.getAttribute('data-gk')||'')!==_grpDrag.key) return;
  ev.preventDefault(); ev.stopPropagation();
  var key=_grpDrag.key, from=_grpDrag.g, to=+tr.getAttribute('data-grp')||0;
  bookingV2GrpDragEnd();
  bookingV2GrpMove(key, from, to);
}
