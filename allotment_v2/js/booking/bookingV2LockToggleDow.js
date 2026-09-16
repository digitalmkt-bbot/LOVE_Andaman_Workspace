function bookingV2LockToggleDow(i){
  const f=_bkV2LockForm; if(!Array.isArray(f.dow)) f.dow=[];
  const k=f.dow.indexOf(i); if(k>=0) f.dow.splice(k,1); else f.dow.push(i);
  bookingV2Render();
}
