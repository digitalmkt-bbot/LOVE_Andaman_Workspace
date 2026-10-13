// §apprCap · ผลต่อที่นั่งถ้าอนุมัติใบนี้ · หักที่นั่งของใบเองออกก่อน จะได้เป็น "หลังอนุมัติ" ไม่ใช่ "ตอนนี้"
function bookingV2ApprovalImpact(b){
  var out=[];
  if(!b || typeof getAllotment!=='function' || typeof bookingV2PaxAllTot!=='function') return out;
  (b.trips||[]).forEach(function(t){
    if(!t || t.bookingMode==='charter' || !t.routeId || !t.date) return;
    var al=getAllotment(t.routeId, t.date, b.id);   // ไม่นับที่นั่งของใบนี้
    if(!al || !al.hasAllotment) return;
    var pax=bookingV2PaxAllTot(t.pax);
    var need=pax - Math.min(Number(t.lockUse)||0, pax);
    var physFree=(al.seatsAvailable||0) + (al.lockedSeats||0);          // เพดานบริษัท ไม่สนล็อก
    var licFree=(al.licenseAvailable!=null)?al.licenseAvailable:physFree; // ที่นั่งจริงตามทะเบียนเรือ
    var r=(typeof ROUTES!=='undefined')?ROUTES.find(function(x){return x.id===t.routeId;}):null;
    out.push({ name:(r&&r.name)||t.routeId, date:t.date, need:need,
      sellable:(al.seatsAvailable||0), overCap:Math.max(0, need-physFree),
      overLic:al.isLand ? 0 : Math.max(0, need-licFree) });   // §otherPier · โปรแกรมบกไม่มีทะเบียนที่นั่ง
  });
  return out;
}
