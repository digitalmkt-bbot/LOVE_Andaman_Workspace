function bookingV2GrpDragEnd(){
  _grpDrag=null;
  document.querySelectorAll('tr.grp-dragging,tr.grp-dropinto').forEach(function(t){
    t.classList.remove('grp-dragging'); t.classList.remove('grp-dropinto'); });
}
