/* §upgRoute · ตัวคิดราคาอ่านเส้นทางที่ขาย ไม่ใช่เส้นทางที่ upgrade ไปวิ่ง · ราคายึดที่จองไว้ */
function bookingV2CalcQuote(){ const d=_bkV2&&_bkV2.newBooking; return bookingV2WithSold(d&&d.trips, ()=>_bkV2CalcQuoteRun.apply(this, arguments)); }
