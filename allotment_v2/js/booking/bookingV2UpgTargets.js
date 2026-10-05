/* โปรแกรมปลายทางที่เลือกได้ · มีเรือวิ่งวันนั้น · เปิดขายวันนั้น · ไม่ใช่โปรแกรมเดิม */
function bookingV2UpgTargets(date, fromRid, bkId){
  var seen={}, out=[];
  ((typeof baDayBoats==='function')?baDayBoats(date):[]).forEach(function(x){
    var rid=x.routeId; if(!rid || rid===fromRid || seen[rid]) return; seen[rid]=1;
    if(typeof bookingV2IsRouteOpenOn==='function' && !bookingV2IsRouteOpenOn(rid, date)) return;
    var al=(typeof getAllotment==='function')?getAllotment(rid, date, null):null;
    out.push({ rid:rid, name:bkUpgRouteName(rid), pier:bkUpgPierOf(rid), free:(al&&al.hasAllotment)?al.seatsAvailable:null });
  });
  if(typeof laRouteOrdCmp==='function') out.sort(function(a,c){ return laRouteOrdCmp(a.rid,c.rid); });
  return out;
}
