function bookingV2FmtDateTime(d){
  if(!d) return '—';
  const dt = typeof d === 'string' ? new Date(d.length > 10 ? d : d + 'T00:00') : d;
  if(isNaN(dt)) return d;
  return dt.toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'}) + ' · ' +
         dt.toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'});
}
