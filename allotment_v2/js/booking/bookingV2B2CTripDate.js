function bookingV2B2CTripDate(bk){
  const ds=(bk&&Array.isArray(bk.trips)?bk.trips:[]).map(t=>t&&t.date).filter(Boolean).sort();
  if(!ds.length) return '';
  const today=(typeof bookingV2LocalYMD==='function')?bookingV2LocalYMD(new Date()):new Date().toISOString().slice(0,10);
  return ds.find(d=>d>=today) || ds[ds.length-1];
}
