function bookingV2BoatSplit(bkId, date){
  const b=(typeof SB_BOOKINGS!=='undefined'?SB_BOOKINGS:[]).find(x=>x.id===bkId); if(!b) return;
  const _d=(typeof bkOpsDate==='function')?bkOpsDate(b,date):date;
  const pool=bkBoatPoolOn(b,_d);
  if(bkPaxSum(pool)<2){ alert('บุคกิ้งนี้มีคนเดียว แยกลงหลายลำไม่ได้'); return; }
  const ex=bkBoatSplits(b,_d);
  let parts;
  if(ex){ parts=ex.map(s=>Object.assign({boatId:s.boatId||''}, bkSplitPax(s))); }
  else { parts=[Object.assign({boatId:bkBoatIdOf(b,_d)||''}, pool), {boatId:'',ad:0,chd:0,inf:0,foc:0}]; }
  _bkBoatM={bkId:bkId, date:_d, pool:pool, parts:parts};
  bookingV2BoatSplitRender();
}
