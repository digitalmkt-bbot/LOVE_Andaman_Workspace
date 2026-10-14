function bookingV2RelTime(iso){
  if(!iso) return '';
  const t = new Date(iso).getTime(); if(isNaN(t)) return '';
  const m = Math.round((Date.now() - t) / 60000);
  if(m < 1) return 'เมื่อกี้'; if(m < 60) return m + ' นาทีที่แล้ว';
  const h = Math.round(m / 60); if(h < 24) return h + ' ชม. ที่แล้ว';
  const d = Math.round(h / 24); if(d === 1) return 'เมื่อวาน'; if(d < 30) return d + ' วันก่อน';
  return bookingV2FmtDate(iso);
}
