function bookingV2FmtFullDate(d){
  if(!d) return '—';
  const dt = typeof d === 'string' ? new Date(d.length > 10 ? d : d + 'T00:00') : d;
  if(isNaN(dt)) return d;
  return dt.toLocaleDateString('en-GB', {weekday:'short', day:'2-digit', month:'short', year:'numeric'});
}
