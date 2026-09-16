function bookingV2BoatSplitSet(i, k, v){
  if(!_bkBoatM||!_bkBoatM.parts[i]||PAX_K.indexOf(k)<0) return;
  const cap=+_bkBoatM.pool[k]||0;
  const other=_bkBoatM.parts.reduce((s,p,j)=>s+(j===i?0:(+p[k]||0)),0);
  _bkBoatM.parts[i][k]=Math.max(0, Math.min(Math.max(0,cap-other), parseInt(v)||0));
  bookingV2BoatSplitRender();
}
