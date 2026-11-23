function bookingV2EditDiffHtml(){
  try{
    if(!_bkV2 || !_bkV2.editingId || !_bkV2.newBooking) return '';
    var sn=_bkV2.editSnap; if(!sn || sn.id!==_bkV2.editingId) return '';
    var L=bookingV2EditDiff(sn.bk, _bkV2.newBooking);
    if(!L.length) return '<div style="display:flex;align-items:center;gap:8px;background:#F7F7F5;border:1px solid #ECEBE6;border-radius:10px;padding:9px 12px;margin-bottom:10px;font-size:12px;color:#7C8091"><span style="width:7px;height:7px;border-radius:50%;background:#B8BDC7;flex:none"></span>ยังไม่มีการแก้ไข</div>';
    return '<div style="background:#fff;border:1.5px solid #16265C;border-radius:12px;padding:12px 14px 8px;margin-bottom:10px">'
      +bookingV2EditDiffHead(L.length)+bookingV2EditDiffRows(L,_bkV2.newBooking)+bookingV2EditDiffMoney(L)+'</div>';
  }catch(err){ console.warn('nbDiff', err); return ''; }
}
