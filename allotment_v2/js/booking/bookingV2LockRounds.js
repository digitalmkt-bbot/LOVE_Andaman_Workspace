// §lkBulk · จำนวนรอบในช่วง (นับเฉพาะวันที่เส้นทางออกจริง) · ใช้โชว์ "ผ่านมา x/y รอบ"
function bookingV2LockRounds(l){
  if(!l || !bookingV2LockSpansDays(l)) return {total:1, past:0};
  const {from,to}=bookingV2LockRange(l); if(!from||!to) return {total:0, past:0};
  const today=(typeof bookingV2LocalYMD==='function')?bookingV2LocalYMD(new Date()):new Date().toISOString().slice(0,10);
  let total=0, past=0, guard=0;
  const d=new Date(from+'T00:00:00'), end=new Date(to+'T00:00:00');
  while(d<=end && guard++<800){
    const ds=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    if(bookingV2LockDowOk(l,ds)){
      const open=(typeof bookingV2IsRouteOpenOn==='function') ? bookingV2IsRouteOpenOn(l.routeId, ds) : true;
      if(open){ total++; if(ds<today) past++; }
    }
    d.setDate(d.getDate()+1);
  }
  return {total, past};
}
