function bookingV2LkPendAskGo(mode){
  const a = _bkV2LkPendAsk; _bkV2LkPendAsk = null;
  if(a && mode && mode!=='cancel' && typeof a.run==='function') a.run(mode);
  else bookingV2Render();
}
