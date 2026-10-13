// ชื่อเดิมที่ใกล้ที่สุด · คืน null ถ้าไม่มีอะไรใกล้พอ
//   §hotelArea · ถ้าบอกพื้นที่รับมาด้วย ให้หาในพื้นที่นั้นก่อน
//   เชนเดียวกันคนละสาขาชื่อคล้ายกันมาก — เทียบข้ามพื้นที่จะแนะนำผิดสาขา
function bookingV2HotelNear(name, minScore, areaId, zone){
  var s=String(name||'').trim(); if(!s) return null;
  var lim=(minScore==null)?0.82:minScore;
  var list=null;
  if(areaId){ var la=bookingV2HotelNameList(null, areaId); if(la && la.length) list=la; }
  if(!list && zone && zone!=='NoTransfer' && zone!=='NT'){ var lz=bookingV2HotelNameList(zone); if(lz && lz.length) list=lz; }
  if(!list) list=bookingV2HotelNameList();
  var best=null, bs=0;
  for(var i=0;i<list.length;i++){
    var sc=bookingV2HotelSim(s, list[i]);
    if(sc>bs){ bs=sc; best=list[i]; }
  }
  if(!best || bs<lim) return null;
  if(bookingV2HotelKey(best)===bookingV2HotelKey(s) && best===s) return null;   // เหมือนเดิมเป๊ะ ไม่ต้องถาม
  return {name:best, score:bs};
}
