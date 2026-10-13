function bookingV2RenderTabBody(){
  if(_bkV2.tab === 'cal'){
    return _bkV2.view === 'cal' ? bookingV2RenderCalendar() : bookingV2RenderMatrix();
  } else if(_bkV2.tab === 'bytrip'){
    return bookingV2RenderTab2();
  } else if(_bkV2.tab === 'locks'){
    return bookingV2RenderLocks();
  } else if(_bkV2.tab === 'approvals'){
    return bookingV2RenderApprovals();
  } else if(_bkV2.tab === 'cancel'){
    return bookingV2RenderCancelReport();
  } else {
    return bookingV2RenderTab3();
  }
}
