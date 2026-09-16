function bookingV2NavMonth(delta){
  _bkV2.cursor = new Date(_bkV2.cursor.getFullYear(), _bkV2.cursor.getMonth() + delta, 1);
  _bkV2.selected = null;
  bookingV2Render();
}
