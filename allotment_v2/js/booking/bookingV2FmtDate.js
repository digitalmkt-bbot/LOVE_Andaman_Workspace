function bookingV2FmtDate(d){
  if(!d) return '—';
  const dt = typeof d === 'string' ? new Date(d.length <= 10 ? d + 'T00:00' : d) : d;
  if(isNaN(dt)) return '—';
  return dt.toLocaleDateString('en-GB', {day:'2-digit', month:'short'}).replace('.', '');
}
