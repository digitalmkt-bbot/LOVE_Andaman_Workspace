function bookingV2SetPageSize(v){
  _bkV2.pageSize = (v === 'all') ? 'all' : (parseInt(v,10) || 50);
  _bkV2.page = 1;
  bookingV2Render();
}
