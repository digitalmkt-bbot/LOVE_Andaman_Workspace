// วันที่ที่กำลังดูในตาราง "ล็อกของวันนี้" · offset จากวันนี้
function bookingV2LockDayStr(){
  const base=(typeof bookingV2LocalYMD==='function')?bookingV2LocalYMD(new Date()):new Date().toISOString().slice(0,10);
  const off=_bkV2LockUI.dayOff||0;
  if(!off) return base;
  const d=new Date(base+'T00:00:00'); d.setDate(d.getDate()+off);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
