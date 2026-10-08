function bookingV2B2CAfter(){
  try{ if(typeof _bkV2!=='undefined' && _bkV2 && _bkV2.tab==='bytrip' && document.getElementById('bkv2-host')) bookingV2RenderKeep(); }catch(e){}
  if(document.getElementById('b2cchg-drw')) bookingV2B2COpen();
}
