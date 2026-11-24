function bookingV2SelfPkCell(bk,date){
  var E=function(x){ return String(x||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };
  var top='<span class="t2-pickcell" style="color:#5B289A;font-weight:700" title="ขาไปลูกค้ามาเองที่ท่าเรือ · ไม่มีรถไปรับ">&#128694; มาเองที่ท่าเรือ</span>';
  if(bookingV2SelfRetToo(bk,date)) return top;
  var ri={}; try{ ri=(typeof bookingV2RetInfo==='function')?(bookingV2RetInfo(bk,date)||{}):{}; }catch(_){}
  var back=(ri.sep&&ri.drop)?ri.drop:(bk.hotelName||bk.pickup||'');
  return top+(back?('<div style="font-size:10px;color:#8a8a82;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="ขากลับรถส่งที่ '+E(back)+'">&#8617; ส่งกลับ: '+E(back)+'</div>'):'');
}
