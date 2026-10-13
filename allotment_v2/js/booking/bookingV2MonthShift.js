function bookingV2MonthShift(k, delta){
  const p = String(k||'').split('-');
  const d = new Date(+p[0]||2000, (+p[1]||1)-1+delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
