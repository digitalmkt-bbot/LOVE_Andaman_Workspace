function bookingV2PaySlipList(bkId){
  const L=_bkV2PaySlips[bkId]||[]; if(!L.length) return 'ยังไม่ได้แนบ';
  return L.map(function(x){ return '&#10003; '+String(x.name||'slip').replace(/[<>&"]/g,''); }).join(' · ');
}
