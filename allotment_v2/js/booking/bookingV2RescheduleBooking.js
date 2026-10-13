function bookingV2RescheduleBooking(bookingId, opts){
  if(!bookingId || typeof SB_BOOKINGS==='undefined') return false;
  const bk=SB_BOOKINGS.find(b=>b.id===bookingId); if(!bk) return false;
  opts=opts||{};
  const dates=[...new Set((bk.trips||[]).map(t=>t.date).filter(Boolean))].sort();
  const from=opts.fromDate||dates[0]||''; const to=opts.newDate||'';
  if(!to) return false;
  const _reason=(opts.reason||'').trim();
  const _ctype=opts.chargeType||'none';
  const _total=(typeof acctBookingTotal==='function')?acctBookingTotal(bk):(bk.total||0);
  const _charge=_ctype==='full'?_total:(_ctype==='partial'?Math.max(0,Number(opts.chargeAmount)||0):0);
  const _collect=opts.collect||'invoice';
  // Move trips on `from` date → `to`; carry charter TRIPS locks with them
  let moved=0, lockMoved=0, lockFreed=0, lockFreedIds=[];
  (bk.trips||[]).forEach(t=>{
    if(t.date!==from) return;
    /* §lkResched · ที่นั่งที่กันไว้ของวันเดิมต้องคืนก่อนย้าย
       ไม่คืน = ล็อคของวันเดิมยังนับว่าใช้ไปแล้ว ที่นั่งกลายเป็นที่นั่งผี ขายไม่ได้อีกเลย
       และตัวตรวจก็ไม่ร้อง เพราะใบจองยังไม่ถูกยกเลิก แค่ย้ายวัน */
    if(Array.isArray(t.lockDraws) && t.lockDraws.length && typeof SB_SEAT_LOCKS!=='undefined'){
      t.lockDraws.forEach(x=>{
        const q=Number(x&&x.qty)||0; if(!q) return;
        const L=SB_SEAT_LOCKS.find(y=>y.id===(x&&x.lockId)); if(!L) return;
        if(typeof bookingV2LockSpansDays==='function' && bookingV2LockSpansDays(L)){
          /* ล็อคแบบช่วง · ยอดเก็บเป็นรายวัน ต้องหักเฉพาะวันที่ย้ายออก */
          const m=L.usedBy||(L.usedBy={});
          m[from]=Math.max(0,(Number(m[from])||0)-q);
          if(!m[from]) delete m[from];
          L.used=Object.keys(m).reduce((a,k)=>a+(Number(m[k])||0),0);
        } else {
          L.used=Math.max(0,(Number(L.used)||0)-q);
        }
        if(L.status==='depleted' && typeof bookingV2LockDrawable==='function' && bookingV2LockDrawable(L)>0) L.status='active';
        (L.log=L.log||[]).push({date:from, at:new Date().toISOString(), type:'resched-return',
          qty:-q, note:'\u0e04\u0e37\u0e19\u0e08\u0e32\u0e01\u0e01\u0e32\u0e23\u0e40\u0e25\u0e37\u0e48\u0e2d\u0e19\u0e27\u0e31\u0e19 '+from+' \u2192 '+to, by:laBy()});
        lockFreed+=q; if(lockFreedIds.indexOf(L.id)<0) lockFreedIds.push(L.id);
      });
      t.lockDraws=[];
    }
    if(t.bookingMode==='charter' && t.charterBoatId && typeof TRIPS!=='undefined'){
      const op=(TRIPS[from]||{})[t.charterBoatId];
      if(op && op.charterBookingId===bookingId){
        if(!TRIPS[to]) TRIPS[to]={};
        if(!TRIPS[to][t.charterBoatId]){ TRIPS[to][t.charterBoatId]=op; delete TRIPS[from][t.charterBoatId]; lockMoved++; }
      }
    }
    t.date=to; moved++;
  });
  // New day → the OLD boat/van assignment no longer applies · clear it so dispatch re-arranges on the new date.
  // (Charter keeps its boat: the TRIPS lock + t.charterBoatId are carried above.)
  /* §strandMove · ถ่ายภาพการจัดการของวันเดิมไว้ก่อน แล้วค่อยล้าง
     ต้องอยู่เหนือบล็อกล้างเสมอ · ทำทีหลังจะไม่เหลืออะไรให้ถ่าย */
  if(bk.ops && moved>0 && typeof ckStrandSnap==='function'){
    try{ ckStrandSnap(bk, from, bk.ops,
      (bk.trips||[]).filter(t=>t && t.date===to)[0]||null, to, 'reschedule'); }catch(_){}
  }
  if(bk.ops && moved>0){
    const _isCharterBk=(bk.trips||[]).some(t=>t.bookingMode==='charter');
    if(!_isCharterBk) bk.ops.boatId=null;
    bk.ops.vanId=null; bk.ops.vanReturnId=null; bk.ops.vanGroup=0; bk.ops.vanSeq=0;
    if(Array.isArray(bk.ops.vanSplits)) bk.ops.vanSplits=[];
    bk.ops.pickupTimeFinal='';   // per-day pickup time also resets
    delete bk.ops.vanCheckin; delete bk.ops.pierCheckin;   // §เลื่อนวันแล้ว → ล้างผลเช็คอินของวันเดิม
    // §per-trip ops · วันที่ 2 ขึ้นไป (OVN / บุ๊กกิ้งหลายวัน) เก็บเรือ-รถไว้บน trip ไม่ใช่บน booking
    // ถ้าไม่ล้างตรงนี้ด้วย ย้ายวันแล้ววันที่ 2 จะยังติดเรือ-รถของวันเดิม
    (bk.trips||[]).forEach(t=>{
      if(!t || !t.ops) return;
      if(!_isCharterBk) t.ops.boatId=null;
      t.ops.vanId=null; t.ops.vanReturnId=null; t.ops.vanGroup=0; t.ops.vanSeq=0;
      if(Array.isArray(t.ops.vanSplits)) t.ops.vanSplits=[];
      t.ops.pickupTimeFinal='';
      delete t.ops.vanCheckin; delete t.ops.pierCheckin;   // §เลื่อนวันแล้ว → ล้างผลเช็คอินของวันเดิม
    });
  }
  if(lockFreed>0 && typeof sbSeatLocksPersist==='function') sbSeatLocksPersist();
  bk.reschedule={ fromDate:from, toDate:to, reason:_reason, chargeType:_ctype, chargeAmount:_charge, collect:(_charge>0?_collect:'none'), at:new Date().toISOString(), by:laBy() };
  bk.rebook={ from, to, reason:'manual', at:bk.reschedule.at };
  // Accounting: trip continues → its own price stands. The reschedule fee is attached to THIS booking's
  // invoice as a labelled line (not a separate invoice). 'separate' = customer pays directly, no invoice.
  let billedTo='';
  try{
    if(_charge>0 && _collect==='invoice'){
      const feeLabel='Reschedule fee · '+from+' → '+to+(_reason?' · '+_reason:'');
      (bk.feeItems=bk.feeItems||[]).push({type:'reschedule', label:feeLabel, amount:_charge, at:new Date().toISOString()});
      const iv=(typeof acctBookingInvoice==='function')?acctBookingInvoice(bookingId):null;
      if(iv){
        // Booking already invoiced → top up that same invoice so the fee becomes due on it
        iv.subtotal=(iv.subtotal||0)+_charge; iv.netAmount=(iv.netAmount||0)+_charge; iv.total=(iv.total||0)+_charge;
        (iv.lineItems=iv.lineItems||[]).push({label:feeLabel, amount:_charge});
        if(typeof sbInvoicesPersist==='function') sbInvoicesPersist();
        billedTo=iv.number;
      }
    }
    // _collect==='separate' → fee recorded on bk.reschedule only · no invoice line
  }catch(e){ console.warn('[bookingV2RescheduleBooking] accounting step failed:', e); }
  const _chargeLbl=_ctype==='full'?('Full charge ฿'+Math.round(_charge).toLocaleString()):_ctype==='partial'?('Charge ฿'+Math.round(_charge).toLocaleString()):'No charge';
  const _collLbl=_charge>0?(_collect==='invoice'?(billedTo?(' · on invoice '+billedTo):' · on booking invoice (pending)'):' · paid separately'):'';
  if(typeof bookingV2AddHistory==='function') bookingV2AddHistory(bk,'reschedule','Rescheduled '+from+' → '+to+' · '+_chargeLbl+_collLbl
    +(lockFreed?(' · คืนที่นั่งล็อค '+lockFreed+' ที่'):'')+(_reason?' · '+_reason:''),'Reschedule');
  // Persist (mirror cancel: manual write sb_bookings + trips when locks moved)
  try{
    const lsKey=(typeof LS_KEY!=='undefined'?LS_KEY:'loveandaman_v2');
    const obj=JSON.parse(localStorage.getItem(lsKey)||'{}');
    obj.sb_bookings=SB_BOOKINGS;
    if(lockMoved>0 && typeof TRIPS!=='undefined') obj.trips=TRIPS;
    localStorage.setItem(lsKey, JSON.stringify(obj));
  }catch(e){ console.warn('[bookingV2RescheduleBooking] save failed:', e); }
  console.log('[bookingV2RescheduleBooking] '+bookingId+' '+from+' → '+to+' · '+moved+' trip(s), '+lockMoved
    +' charter lock(s) moved, '+lockFreed+' seat-lock seat(s) returned to '+lockFreedIds.length+' lock(s) · fee '+_charge+' ('+_collect+')');
  return true;
}
