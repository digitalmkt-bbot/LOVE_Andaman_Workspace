function bookingV2DisplayCode(bk){
  if(!bk||!bk.id) return '';
  if(bk.id.indexOf('b2c_')!==0) return bk.id;
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
