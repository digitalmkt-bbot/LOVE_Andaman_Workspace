/* เลยกำหนดแล้วแต่ยังไม่มีใครกดปล่อย · ตัวนี้คือตัวที่ต้องเตือน */
function bookingV2LockOverdue(l, tripDate){
  return bookingV2LockCutoffPassed(l, tripDate) && !bookingV2LockRoundReleased(l, tripDate);
}
