function bookingV2DisplayCode(bk){
  if(!bk||!bk.id) return '';
  if(bk.id.indexOf('b2c_')!==0) return bk.id;
  /* §opsDisplayCode · ops mode: the server's display_code (the booking itself, or the raw booking behind a list row) */
  if(bk.displayCode) return bk.displayCode;
  const _raw = (window.LA_LEGACY_UNAVAILABLE && typeof SB_BOOKINGS!=='undefined' && Array.isArray(SB_BOOKINGS)) ? SB_BOOKINGS.find(x=>x&&x.id===bk.id&&x.displayCode) : null;
  if(_raw) return _raw.displayCode;
  const m = bk.id.match(/^b2c_(.+)_(\d+)$/);
  if(!m) return bk.voucherRef || bk.id;
  const oid = m[1];
  const base = bk.voucherRef || oid;
  const pref = 'b2c_'+oid+'_';
  const sibs = (typeof SB_BOOKINGS!=='undefined'?SB_BOOKINGS:[])
    .filter(x=>x&&x.id&&x.id.indexOf(pref)===0)
    .map(x=>{ const mm=x.id.match(/_(\d+)$/); return {id:x.id, ln:mm?Number(mm[1]):0}; })
    .sort((a,b)=>a.ln-b.ln);
  if(sibs.length<=1) return base;
  const ord = sibs.findIndex(s=>s.id===bk.id)+1;
  return base + '-' + (ord||1);
}
