function bookingV2Tab2SetLk(lockId){
  var L=(typeof SB_SEAT_LOCKS!=='undefined')?SB_SEAT_LOCKS:[];
  var l=null; for(var i=0;i<L.length;i++){ if(L[i] && L[i].id===lockId){ l=L[i]; break; } }
  var nm=l?((typeof bookingV2LockHolderName==='function')?bookingV2LockHolderName(l):String(l.holderId||'')):'';
  _bkV2T2Lk = (_bkV2T2Lk===nm) ? '' : nm;
  bookingV2Render();
}
