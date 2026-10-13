function bookingV2ExpandAllFamilies(){
  bookingV2Families().forEach(f => _bkV2.expanded.add(f.id));
  bookingV2Render();
}
