// ช่วงวันที่ของล็อก · month ของเก่าแปลงเป็นวันที่ 1 ของเดือนแรก → วันสุดท้ายของเดือนสุดท้าย
function bookingV2LockRange(l){
  if(!l) return {from:'',to:''};
  if(l.scope==='bulk') return {from:l.dateFrom||'', to:l.dateTo||l.dateFrom||''};
  if(l.scope==='month'){
    const fr=l.monthFrom||l.month, to=l.monthTo||l.monthFrom||l.month;
    if(!fr) return {from:'',to:''};
    const [y,m]=String(to).split('-').map(Number);
    const last=new Date(y, m, 0).getDate();
    return {from:fr+'-01', to:to+'-'+String(last).padStart(2,'0')};
  }
  return {from:l.date||'', to:l.date||''};
}
