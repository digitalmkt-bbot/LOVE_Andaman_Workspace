// Prefill the lock form from Calendar (selected day · optional route) and open inline modal
function bookingV2LockFromCalendar(routeId, date){
  _bkV2LockForm = { ..._bkV2LockForm, scope:'day', routeId:routeId||'', date:date||'', dateFrom:'', dateTo:'', dow:[], qty:'', reason:'' };
  _bkV2LockModalOpen = true;
  bookingV2Render();
}
