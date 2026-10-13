function bookingV2SplitSet(k, v){
  if(!_bkSplitM || PAX_K.indexOf(k)<0) return;
  _bkSplitM[k] = Math.max(0, Math.min(+_bkSplitM.pool[k]||0, parseInt(v)||0));
  bookingV2SplitRender();
}
