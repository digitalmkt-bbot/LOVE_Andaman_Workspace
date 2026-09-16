// §extraDay · วันที่ของรายการขายเพิ่ม
//   เดิมยัด trips[0].date เสมอ · บุ๊กกิ้งหลายวัน (โดยเฉพาะค้างคืน) ขายวันไหนก็ไปเกาะวันแรกหมด
//   เลือกวันจากหน้าที่กำลังเปิดอยู่ ถ้าวันนั้นเป็นวันเดินทางของใบนี้จริง · ไม่ตรงค่อยถอยไปวันแรก
function bookingV2ExtraDayOf(bk){
  var days=(((bk&&bk.trips)||[]).map(function(t){ return (t&&t.date)||''; })).filter(Boolean);
  if(!days.length) return '';
  var cand=[];
  try{ if(typeof _pckDate!=='undefined' && _pckDate) cand.push(_pckDate); }catch(_){}
  try{ if(typeof _vanCkDate!=='undefined' && _vanCkDate) cand.push(_vanCkDate); }catch(_){}
  try{ if(typeof bookingV2Tab2ActiveDate==='function'){ var d=bookingV2Tab2ActiveDate(); if(d) cand.push(d); } }catch(_){}
  for(var i=0;i<cand.length;i++){ if(days.indexOf(cand[i])>=0) return cand[i]; }
  return days[0];
}
