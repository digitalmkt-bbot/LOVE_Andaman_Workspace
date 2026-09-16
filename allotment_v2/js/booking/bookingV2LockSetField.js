function bookingV2LockSetField(field, val){
  _bkV2LockForm[field] = val;
  if(field==='holderType' || field==='routeId' || field==='scope') bookingV2Render();
}
