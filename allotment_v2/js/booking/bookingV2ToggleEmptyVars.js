/* variant ที่ไม่มีคนทั้งเดือน · พับเก็บไว้ กดกางดูได้ */
function bookingV2ToggleEmptyVars(famId){
  if(!_bkV2.mxEmpty) _bkV2.mxEmpty = new Set();
  if(_bkV2.mxEmpty.has(famId)) _bkV2.mxEmpty.delete(famId); else _bkV2.mxEmpty.add(famId);
  bookingV2Render();
}
