function bookingV2ToggleGuide(lang, on){
  if(!_bkV2.newBooking) return;
  if(!_bkV2.newBooking.guides) _bkV2.newBooking.guides = { english:false, russian:false, chinese:false, otherLang:'' };
  _bkV2.newBooking.guides[lang] = !!on;
  bookingV2Render();
}
