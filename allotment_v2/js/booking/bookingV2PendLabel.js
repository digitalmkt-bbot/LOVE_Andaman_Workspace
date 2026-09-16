function bookingV2PendLabel(reason){
  return reason==='closed_day' ? 'ทริปไม่ออกวันนั้น'
       : reason==='b2c_hold'   ? 'B2C · ระบบพักไว้'
       : 'เกิน capacity';
}
