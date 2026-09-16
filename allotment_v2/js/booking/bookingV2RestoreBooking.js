// Restore (un-cancel) a booking that was cancelled by mistake · reverts to confirmed,
// voids any cancellation-fee invoice, re-locks the charter boat where the slot is still free.
function bookingV2RestoreBooking(bookingId){
  if(!bookingId || typeof SB_BOOKINGS==='undefined') return false;
  const bk = SB_BOOKINGS.find(b=>b.id===bookingId);
  if(!bk){ console.warn('[bookingV2RestoreBooking] not found:', bookingId); return false; }
  if(!['cancelled','cancelled_weather','rejected'].includes(bk.status)){ alert('Booking is not cancelled'); return false; }
  if(!confirm('Restore (un-cancel) booking '+(bk.voucherRef||bk.code||bk.id)+' back to Confirmed?')) return false;
  // Void any cancellation-fee invoice raised at cancel time
  try{
    (typeof SB_INVOICES!=='undefined'?SB_INVOICES:[]).filter(i=>i.feeType==='cancellation' && (i.bookingIds||[]).includes(bookingId) && i.status!=='void').forEach(i=>{ if(typeof acctVoidInvoice==='function') acctVoidInvoice(i.id); });
  }catch(e){ console.warn('[bookingV2RestoreBooking] void fee failed:', e); }
  // Clear cancellation state
  bk.status='confirmed';
  delete bk.cancellation; delete bk.cancelCategory; delete bk.cancelReason; delete bk.cancelledAt; delete bk.weatherResolve;
  /* §lkReturn · กู้ใบจองกลับ = ต้องไปดึงที่นั่งจากล็อกเดิมคืนมาด้วย
     ล็อกอาจถูกคนอื่นใช้ไปแล้วระหว่างนั้น · ดึงได้ไม่ครบก็บันทึกไว้ให้เห็น ไม่เงียบ */
  try{
    if(typeof bookingV2DrawLock==='function' && Array.isArray(bk.trips)){
      let want=0, got=0;
      bk.trips.forEach(t=>{ (t.lockDraws||[]).forEach(x=>{
        want += Number(x.qty)||0; got += bookingV2DrawLock(x.lockId, Number(x.qty)||0, bk.id, t.date); }); });
      if(want>0 && typeof bookingV2AddHistory==='function')
        bookingV2AddHistory(bk,'edit','\u0e14\u0e36\u0e07\u0e17\u0e35\u0e48\u0e19\u0e31\u0e48\u0e07\u0e08\u0e32\u0e01 seat lock \u0e01\u0e25\u0e31\u0e1a\u0e21\u0e32 '+got+'/'+want+' \u0e17\u0e35\u0e48'
          +(got<want?' \u00b7 \u0e17\u0e35\u0e48\u0e40\u0e2b\u0e25\u0e37\u0e2d\u0e16\u0e39\u0e01\u0e43\u0e0a\u0e49\u0e44\u0e1b\u0e41\u0e25\u0e49\u0e27 \u0e15\u0e49\u0e2d\u0e07\u0e40\u0e0a\u0e47\u0e04\u0e17\u0e35\u0e48\u0e19\u0e31\u0e48\u0e07\u0e14\u0e49\u0e27\u0e22\u0e21\u0e37\u0e2d':''),'Edit');
    }
  }catch(e){ console.warn('[restore] redraw locks failed', e); }
  // Re-apply charter lock in Boat Operation where that boat/day is still free
  let relocked=0, blocked=0;
  if(typeof TRIPS!=='undefined' && Array.isArray(bk.trips)){
    bk.trips.forEach(t=>{ if(t.bookingMode!=='charter' || !t.charterBoatId) return;
      TRIPS[t.date]=TRIPS[t.date]||{};
      const op=TRIPS[t.date][t.charterBoatId];
      if(op && op.charterBookingId && op.charterBookingId!==bookingId){ blocked++; return; }   // taken by someone else now
      TRIPS[t.date][t.charterBoatId]=Object.assign({}, op||{}, {route:t.routeId, charterBookingId:bookingId, type:'charter'});
      relocked++;
    });
  }
  if(typeof bookingV2AddHistory==='function') bookingV2AddHistory(bk,'edit','Restored · ยกเลิกการยกเลิก (กู้คืน)'+(blocked?(' · เรือเหมา '+blocked+' วันถูกจองแล้ว ต้องจัดใหม่'):''),'Confirmed');
  if(typeof acctPersistBookings==='function') acctPersistBookings();
  try{ const k=(typeof LS_KEY!=='undefined'?LS_KEY:'loveandaman_v2'); const o=JSON.parse(localStorage.getItem(k)||'{}'); o.sb_bookings=SB_BOOKINGS; if(relocked||blocked) o.trips=TRIPS; localStorage.setItem(k, JSON.stringify(o)); }catch(e){ console.warn('[bookingV2RestoreBooking] save failed:', e); }
  if(typeof bookingV2Render==='function') bookingV2Render();
  if(typeof laSaveToast==='function') laSaveToast({kind:'success', title:'กู้คืน booking แล้ว', id:bk.id, status:'RESTORED',
    sub:(blocked?('⚠ เรือเหมา '+blocked+' วันถูกจองซ้ำ — จัดเรือใหม่ · '):'')+'ใบแจ้งหนี้เดิมถูกยกเลิก · ออกใหม่ที่ปุ่ม Pay ถ้าต้องใช้', dur:5200});
  return true;
}
