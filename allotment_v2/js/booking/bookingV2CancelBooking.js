// Cancel a booking · marks status='cancelled' · releases charter locks in TRIPS
function bookingV2CancelBooking(bookingId, opts){
  if(!bookingId) return false;
  if(typeof SB_BOOKINGS === 'undefined') return false;
  const bk = SB_BOOKINGS.find(b => b.id === bookingId);
  if(!bk){ console.warn('[bookingV2CancelBooking] not found:', bookingId); return false; }
  opts = opts || {};
  bk.status = 'cancelled';
  bk.cancelledAt = new Date().toISOString();
  // ── Cancellation category + charge + note (normal cancel · not weather) ──
  const _cat    = opts.category || '';
  const _note   = (opts.note||opts.reason||'').trim();
  const _catObj = (typeof BKV2_CANCEL_REASONS!=='undefined') ? BKV2_CANCEL_REASONS.find(x=>x.code===_cat) : null;
  const _catLbl = (typeof bookingV2CancelLabel==='function' && _cat) ? bookingV2CancelLabel(_cat) : (_catObj ? _catObj.en : (_cat||''));
  const _reason = _catLbl ? (_catLbl + (_note ? ' · '+_note : '')) : _note;   // display string (category + note)
  const _ctype  = opts.chargeType || 'none';   // 'none' | 'full' | 'partial'
  const _total  = (typeof acctBookingTotal==='function') ? acctBookingTotal(bk) : (bk.total||0);
  const _charge = _ctype==='full' ? _total : (_ctype==='partial' ? Math.max(0, Number(opts.chargeAmount)||0) : 0);
  bk.cancellation = { category:_cat, categoryLabel:_catLbl, group:(_catObj?_catObj.group:''), note:_note, reason:_reason, chargeType:_ctype, chargeAmount:_charge, at:bk.cancelledAt, by:laBy() };
  bk.cancelCategory = _cat;
  bk.cancelReason = _reason;
  // Accounting: clean prior invoice, then bill the cancellation fee if any (becomes a real receivable)
  try{
    const _prev = (typeof acctBookingInvoice==='function') ? acctBookingInvoice(bookingId) : null;
    if(_prev && typeof acctVoidInvoice==='function') acctVoidInvoice(_prev.id);
    if(_charge > 0 && bk.agentId && typeof acctCreateFeeInvoice==='function') acctCreateFeeInvoice(bk.agentId, bookingId, _charge, 'Cancellation fee'+(_reason?' · '+_reason:''));
  }catch(e){ console.warn('[bookingV2CancelBooking] accounting step failed:', e); }
  const _chargeLbl = _ctype==='full' ? ('Full charge ฿'+Math.round(_charge).toLocaleString()) : _ctype==='partial' ? ('Charge ฿'+Math.round(_charge).toLocaleString()) : 'No charge';
  if(typeof bookingV2AddHistory==='function') bookingV2AddHistory(bk,'cancel','Cancelled · '+_chargeLbl+(_reason?' · '+_reason:''),'Cancel');
  /* §lkReturn · ที่นั่งที่ดึงจาก seat lock ต้องกลับเข้าล็อก ไม่ใช่หายไปเฉย ๆ
     เดิมยกเลิกแล้วล็อกยังนับว่าใช้ไป · เอเยนต์เสียโควตาฟรีทุกครั้งที่ลูกค้ายกเลิก */
  let _lkBack = 0;
  try{ if(typeof bookingV2ReturnBookingDraws==='function') _lkBack = bookingV2ReturnBookingDraws(bk, 'cancel'); }catch(e){ console.warn('[cancel] return locks failed', e); }
  if(_lkBack > 0 && typeof bookingV2AddHistory==='function')
    bookingV2AddHistory(bk,'cancel','\u0e04\u0e37\u0e19\u0e17\u0e35\u0e48\u0e19\u0e31\u0e48\u0e07\u0e40\u0e02\u0e49\u0e32 seat lock '+_lkBack+' \u0e17\u0e35\u0e48','Cancel');
  // Release any charter locks in TRIPS for this booking
  let released = 0;
  if(typeof TRIPS !== 'undefined' && Array.isArray(bk.trips)){
    bk.trips.forEach(t => {
      if(t.bookingMode !== 'charter' || !t.charterBoatId) return;
      const op = TRIPS[t.date]?.[t.charterBoatId];
      if(op && op.charterBookingId === bookingId){
        delete op.charterBookingId;
        op.type = 'normal';  // revert to seat-bookable
        released++;
      }
    });
  }
  // Persist
  try {
    const lsKey = (typeof LS_KEY !== 'undefined' ? LS_KEY : 'loveandaman_v2');
    const raw = localStorage.getItem(lsKey) || '{}';
    const obj = JSON.parse(raw);
    obj.sb_bookings = SB_BOOKINGS;
    if(released > 0) obj.trips = TRIPS;
    localStorage.setItem(lsKey, JSON.stringify(obj));
  } catch(e){ console.warn('[bookingV2CancelBooking] save failed:', e); }
  console.log(`[bookingV2CancelBooking] ${bookingId} cancelled · ${released} charter lock(s) released`);
  return true;
}
