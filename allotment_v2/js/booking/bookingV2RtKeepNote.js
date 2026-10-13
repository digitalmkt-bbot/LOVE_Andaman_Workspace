function bookingV2RtKeepNote(){
  const d = _bkV2 && _bkV2.newBooking, K = d && d._rtKeep; if(!K) return '';
  const E = function(x){ return String(x==null?'':x).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  const B = function(n){ return '&#3647;'+Math.round(Number(n)||0).toLocaleString(); };
  const nm = function(r){ return '<b>'+E(r.code)+' &middot; '+E(r.name)+'</b>'; };
  const btn = 'font-family:inherit;font-size:10.5px;font-weight:700;border-radius:7px;padding:3px 9px;cursor:pointer;margin-left:6px';
  let out = '';
  const P = bookingV2RtKeepPair();
  if(P && P.differ){
    let now = 0; try{ now = bookingV2CalcQuote().grandTotal; }catch(_){}
    out += (K.mode==='keep')
      ? '<div class="meta bkv2-rtkeep" data-rtkeep="keep" style="color:#0E5E80;margin-top:5px;line-height:1.6">&#128274; '+laT('ใบนี้ยึดเรทเดิมตอนจอง')+' &middot; '+nm(P.kept)
        +'<br>'+laT('ตอนนี้เอเยนต์ใช้ชุด')+' '+nm(P.cur)
        +'<button data-rtuse="now" onclick="bookingV2RtKeepUse(\'now\')" style="'+btn+';color:#fff;background:#0E5E80;border:1px solid #0E5E80">'+laT('เปลี่ยนไปใช้เรทใหม่')+'</button></div>'
      : '<div class="meta bkv2-rtkeep" data-rtkeep="now" style="color:#8A5A0B;margin-top:5px;line-height:1.6">&#8594; '+laT('ใบนี้เปลี่ยนมาคิดจากเรทใหม่')+' &middot; '+nm(P.cur)
        +'<br>'+laT('ยอดที่บันทึกไว้')+' '+B(K.total)+' &rarr; '+laT('ยอดตามเรทใหม่')+' <b>'+B(now)+'</b> &middot; '+laT('เรทเดิม')+' '+E(P.kept.code)
        +'<button data-rtuse="keep" onclick="bookingV2RtKeepUse(\'keep\')" style="'+btn+';color:#8A5A0B;background:#fff;border:1px solid #E2C99A">'+laT('กลับไปใช้เรทเดิม')+'</button></div>';
  }
  if(K.drift && K.mode==='keep'){
    out += '<div class="meta bkv2-rtdrift" data-rtdrift="1" style="color:#A32D2D;background:#FDECEA;border-radius:7px;padding:6px 9px;margin-top:6px;line-height:1.55">&#9888; '
      +laT('ยอดที่บันทึกไว้')+' <b>'+B(K.drift.was)+'</b> '+laT('ไม่ตรงกับยอดที่คิดจากเรทตอนนี้')+' <b>'+B(K.drift.now)+'</b>'
      +'<br>'+laT('ราคาในชุดนี้ถูกแก้หลังจากใบนี้บันทึก · ถ้ากดบันทึก ใบนี้จะเปลี่ยนเป็นยอดใหม่')+'</div>';
  }
  return out;
}
