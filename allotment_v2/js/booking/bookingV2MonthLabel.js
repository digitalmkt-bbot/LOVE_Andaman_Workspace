function bookingV2MonthLabel(k, short){
  if(k === 'all') return 'All time';
  const p = String(k||'').split('-');
  const M = (typeof MONTHS_EN !== 'undefined') ? MONTHS_EN : ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const name = M[(+p[1]||1)-1] || p[1] || '';
  return short ? `${name.slice(0,3)} ${String(p[0]||'').slice(2)}` : `${name} ${p[0]||''}`;
}
