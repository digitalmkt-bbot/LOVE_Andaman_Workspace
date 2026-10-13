function bookingV2PartialCancel(bookingId, tripIdx, opts){
  const bk=SB_BOOKINGS.find(b=>b.id===bookingId); if(!bk) return false;
  const t=bk.trips[tripIdx]; if(!t||!t.pax) return false;
  opts=opts||{};
  // decrement pax keys (release seats automatically via getSeatsConsumed)
  Object.entries(opts.removed||{}).forEach(([k,n])=>{ t.pax[k]=Math.max(0,(t.pax[k]||0)-n); });
  // reduce stored price by the refund / price reduction
  const refund=Math.max(0,Number(opts.refund)||0);
  if(refund>0){
    if(bk.priceBreakdown && typeof bk.priceBreakdown.total==='number') bk.priceBreakdown.total=Math.max(0,bk.priceBreakdown.total-refund);
    if(typeof bk.total==='number') bk.total=Math.max(0,bk.total-refund);
  }
  const REASONS=(typeof BKV2_CANCEL_REASONS!=='undefined')?BKV2_CANCEL_REASONS:[];
  const catObj=REASONS.find(x=>x.code===opts.category);
  const catLbl=(typeof bookingV2CancelLabel==='function' && opts.category)?bookingV2CancelLabel(opts.category):(catObj?catObj.en:(opts.category||''));
  const refundMode=opts.refundMode||(refund>0?'refund':'none');
  const charged=opts.charged||{count:0,amount:0};
  const waived=opts.waived||{count:(opts.totalRem||0), amount:refund};
  (bk.partialCancels=bk.partialCancels||[]).push({
    date:t.date||'', tripIdx, paxRemoved:opts.removed||{}, count:opts.totalRem||0,
    category:opts.category||'', categoryLabel:catLbl, group:(catObj?catObj.group:''),
    note:opts.note||'', refundMode, refund,
    charged:{count:charged.count||0, amount:Math.round(charged.amount||0)},
    waived:{count:waived.count||0, amount:Math.round(waived.amount||0)},
    at:new Date().toISOString(), by:laBy()
  });
  const moneyLbl = `charge ${charged.count||0} (฿${Math.round(charged.amount||0).toLocaleString()}) · waive ${waived.count||0} (฿${Math.round(refund).toLocaleString()})`;
  if(typeof bookingV2AddHistory==='function') bookingV2AddHistory(bk,'cancel',`Partial cancel · −${opts.totalRem} pax · ${catLbl} · ${moneyLbl}${opts.note?' · '+opts.note:''}`,'Cancel');
  /* §lkReturn(partial) · trips[].lockDraws is the source of truth for lock usage (not `used`) — a
     partial cancel that only decrements pax leaves the removed seats permanently drawn against the
     lock, so they never come back to getAllotment. Return up to totalRem seats from THIS trip's
     lockDraws (capped at what was actually drawn); any remainder of totalRem was general pool and
     is already freed because getSeatsConsumed reads the now-lower t.pax live. */
  let _lkBack=0;
  try{
    const totalRem=Math.max(0,Number(opts.totalRem)||0);
    if(totalRem>0 && Array.isArray(t.lockDraws) && t.lockDraws.length && typeof bookingV2ReturnLock==='function'){
      let need=totalRem; const kept=[];
      t.lockDraws.forEach(d=>{
        const qty=Number(d.qty)||0;
        if(need<=0 || qty<=0){ if(qty>0) kept.push(d); return; }
        const take=Math.min(need, qty);
        const got=bookingV2ReturnLock(d.lockId, take, bk.id, t.date, 'partial cancel');
        _lkBack+=got; need-=got;
        const remain=qty-got;
        if(remain>0) kept.push({lockId:d.lockId, qty:remain});
      });
      t.lockDraws=kept;
      if(t.seatSource) t.seatSource.locked=Math.max(0,(Number(t.seatSource.locked)||0)-_lkBack);
    }
  }catch(e){ console.warn('[bookingV2PartialCancel] return lock draws failed:',e); }
  if(_lkBack>0 && typeof bookingV2AddHistory==='function')
    bookingV2AddHistory(bk,'cancel',`คืนที่นั่งเข้า seat lock ${_lkBack} ที่ (partial cancel)`,'Cancel');
  /* Invoice was raised on the pre-reduction pax/total — flag it for manual review instead of
     silently rewriting a number a human already sent to the agent. Money is NOT auto-adjusted. */
  try{
    const _iv=(typeof acctBookingInvoice==='function')?acctBookingInvoice(bookingId):null;
    if(_iv){
      _iv.needsAdjustment=true;
      (_iv.adjustmentFlags=_iv.adjustmentFlags||[]).push({
        reason:'partial_cancel', bookingId, tripIdx, removed:opts.removed||{}, count:opts.totalRem||0,
        refund, at:new Date().toISOString(), by:laBy()
      });
      if(typeof sbInvoicesPersist==='function') sbInvoicesPersist();
    }
  }catch(e){ console.warn('[bookingV2PartialCancel] flag invoice failed:',e); }
  // persist
  try{ const lsKey=(typeof LS_KEY!=='undefined'?LS_KEY:'loveandaman_v2'); const obj=JSON.parse(localStorage.getItem(lsKey)||'{}'); obj.sb_bookings=SB_BOOKINGS; localStorage.setItem(lsKey,JSON.stringify(obj)); }catch(e){ console.warn('[bookingV2PartialCancel] save failed:',e); }
  return true;
}
