// §bkPage (2026-09-03) · All-bookings pager. The tab rendered every matching booking in one pass —
// at 3,355 rows that is ~70k DOM nodes, and worse, two O(n) scans PER ROW inside the row template
// (an SB_BOOKINGS.find for the raw record + bookingV2FindDuplicateBookings over the whole list), so the
// tab cost ~22M iterations to draw. Paging cuts both, because both live inside the row map.
function bookingV2SetPage(n){
  _bkV2.page = Math.max(1, n|0);
  bookingV2Render();
  // Land at the top of the list, not wherever the old page left the scroll.
  const tbl = document.querySelector('.bkv2-tbl');
  if(tbl && tbl.scrollIntoView) tbl.scrollIntoView({block:'start'});
}
