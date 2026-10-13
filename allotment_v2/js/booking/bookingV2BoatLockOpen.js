function bookingV2BoatLockOpen(preset){
  if(typeof window.laGuardEdit==='function' && !window.laGuardEdit('operations')) return;
  const t=new Date(Date.now()+864e5);
  const tmr=(typeof bookingV2LocalYMD==='function')?bookingV2LocalYMD(t):t.toISOString().slice(0,10);
  _bkBoatForm = Object.assign({ routeId:'', date:tmr, boatId:'', holderType:'agent', holderName:'',
    fixed:true, minCap:0, capTouched:false, expiry:'', reason:'' }, preset||{});
  if(typeof bookingV2Render==='function') bookingV2Render();
}
