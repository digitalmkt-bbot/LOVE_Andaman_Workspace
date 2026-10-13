function bookingV2SetBookingField(key, val){
  if(!_bkV2.newBooking) return;
  _bkV2.newBooking[key] = val;
  // When agent changes · auto-fill rate type ref from agent
  if(key === 'agentId'){ bookingV2ApplyAgentRules(val ? sbGetAgent(val) : null); }
  /* §internal · ใบของบริษัทเองเป็น Manual อย่างเดียว · ไม่มีเรทให้อ้าง
     ถ้าหลุดไปเป็น rate ยอดจะกลายเป็น ฿0 แบบเงียบ ๆ (ชุดราคาสังเคราะห์ไม่มีตารางราคา) */
  if(key === 'priceMode' && val !== 'manual'){
    var _ca = _bkV2.newBooking.agentId ? sbGetAgent(_bkV2.newBooking.agentId) : null;
    if(_ca && (_ca.code==='COMPANY' || _ca.id==='a_company')) _bkV2.newBooking.priceMode='manual';
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
  if(_BKV2_NO_RENDER_KEYS.has(key)){ bookingV2NbRefreshSide(); return; }   /* §nbSideLive · ชื่อลูกค้าก็เป็นเงื่อนไขของปุ่ม */
  bookingV2Render();
}
