function bookingV2PendLabel(reason){
  return reason==='closed_day' ? laT('ทริปไม่ออกวันนั้น')
       : reason==='b2c_hold'   ? 'B2C · '+laT('ระบบพักไว้')
       : laT('เกิน capacity');
}
