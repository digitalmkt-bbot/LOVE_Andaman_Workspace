/* รอบที่ล็อก (ตามที่กรอก) จะครอบ · วันนี้เป็นต้นไป */
function bookingV2LockSpecDates(sp){
  const today = (typeof bookingV2LocalYMD==='function') ? bookingV2LocalYMD(new Date()) : new Date().toISOString().slice(0,10);
  if(sp.scope!=='bulk') return (sp.date && sp.date>=today) ? [sp.date] : [];
  const out=[]; if(!sp.dateFrom || !sp.dateTo) return out;
  const d=new Date(sp.dateFrom+'T00:00:00'), end=new Date(sp.dateTo+'T00:00:00'); let guard=0;
  const dowL={dow:Array.isArray(sp.dow)?sp.dow:[]};
  while(d<=end && guard++<800){
    const ds=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    if(ds>=today && bookingV2LockDowOk(dowL, ds) && ((typeof bookingV2IsRouteOpenOn!=='function') || bookingV2IsRouteOpenOn(sp.routeId, ds))) out.push(ds);
    d.setDate(d.getDate()+1);
  }
  return out;
}
