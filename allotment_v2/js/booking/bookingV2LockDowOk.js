// วันในสัปดาห์ที่ล็อกนี้กินที่นั่ง · ว่าง = ทุกวัน
function bookingV2LockDowOk(l, date){
  const d=Array.isArray(l&&l.dow)?l.dow:[];
  if(!d.length) return true;
  const dt=new Date(String(date)+'T00:00:00'); if(isNaN(dt.getTime())) return true;
  return d.indexOf(dt.getDay())>=0;
}
