function bookingV2SetSearch(v){
  _bkV2.search = v;
  _bkV2.page = 1;           // §bkPage · a new search must land on page 1, not page 47 of the old result set
  bookingV2Render();
  const inp = document.getElementById('bkv2-search-input');
  if(inp){ inp.focus(); inp.setSelectionRange(v.length, v.length); }
}
