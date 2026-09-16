// §bkMonthPage · travel month of a booking as 'YYYY-MM'. A plain 'YYYY-MM-DD' is sliced as text on purpose —
// new Date('2026-09-01') is parsed as UTC and would land in August for us at +07:00.
function bookingV2MonthKey(d){
  if(!d) return '';
  const s = String(d);
  if(/^\d{4}-\d{2}/.test(s) && s.length <= 10) return s.slice(0,7);
  const dt = new Date(s);
  return isNaN(dt) ? s.slice(0,7) : `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;
}
