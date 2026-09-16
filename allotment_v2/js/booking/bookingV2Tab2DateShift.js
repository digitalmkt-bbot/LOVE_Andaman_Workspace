function bookingV2Tab2DateShift(n){ _bkV2T2Q=''; _bkV2T2Lk='';
  const cur = bookingV2Tab2ActiveDate();
  const dt = new Date(cur + 'T00:00'); dt.setDate(dt.getDate() + n);
  _bkV2.filterDate = bookingV2LocalYMD(dt);
  _bkV2.filterRoute = null;
  bookingV2Render();
}
