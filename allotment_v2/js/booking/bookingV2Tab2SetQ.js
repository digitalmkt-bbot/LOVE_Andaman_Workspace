function bookingV2Tab2SetQ(v){ _bkV2T2Q = String(v||''); bookingV2Render();
  try{ var el=document.getElementById('bt-q'); if(el){ el.focus(); el.setSelectionRange(el.value.length,el.value.length); } }catch(_){}
}
