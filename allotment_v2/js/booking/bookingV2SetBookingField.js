function bookingV2SetBookingField(key, val){
  if(!_bkV2.newBooking) return;
  _bkV2.newBooking[key] = val;
  // When agent changes · auto-fill rate type ref from agent
  if(key === 'agentId'){
    const a = val ? sbGetAgent(val) : null;
    _bkV2.newBooking.rateTypeRef = a?.rateTypeId || null;
    // House accounts: walk-in keeps manual option · staff → free/manual; real agent → lock Rate type
    const isWk = a && (a.code==='WALKIN' || a.id==='a_walkin');
    const isSt = a && (a.code==='STAFF'  || a.id==='a_staff');
    if(isSt){ _bkV2.newBooking.soldBy=''; const insp=_bkV2.newBooking.staffPurpose==='inspection'; _bkV2.newBooking.priceMode = insp?'manual':'rate'; if(insp) _bkV2.newBooking.manualTotal=0; }   // welfare → Staff Welfare rate (FOC free, over-quota priced) · inspection → ฿0
    else if(isWk){ _bkV2.newBooking.staffId=''; }
    else { _bkV2.newBooking.priceMode='rate'; _bkV2.newBooking.soldBy=''; _bkV2.newBooking.staffId=''; }
  }
  // Staff trip purpose toggle · inspection = always ฿0 (manual 0) · welfare = Staff Welfare rate
  if(key === 'staffPurpose'){
    if(val === 'inspection'){ _bkV2.newBooking.priceMode='manual'; _bkV2.newBooking.manualTotal=0; }
    else { _bkV2.newBooking.priceMode='rate'; }
  }
  // Auto-guess lead nationality from lead pax name (only if not already set)
  if(key === 'leadPax' && !_bkV2.newBooking.leadNationality){
    const guess = bookingV2GuessNationality(val);
    if(guess) _bkV2.newBooking.leadNationality = guess;
  }
  // Text-input keys · update state but don't re-render (preserves focus)
  if(_BKV2_NO_RENDER_KEYS.has(key)) return;
  bookingV2Render();
}
