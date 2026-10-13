function bookingV2CreateLock(o){
  const today = (typeof bookingV2LocalYMD==='function') ? bookingV2LocalYMD(new Date()) : new Date().toISOString().slice(0,10);
  const nowTs = new Date().toISOString();
  const mFrom = o.monthFrom||o.month||'';
  const l = { id:LA_UID('lk'), scope:o.scope||'day', routeId:o.routeId, date:o.date||'',
    monthFrom:mFrom, monthTo:o.monthTo||mFrom, month:mFrom, boatId:o.boatId||null,
    holderType:o.holderType||'office', holderId:o.holderId||null, qty:Number(o.qty)||0, used:0,
    reason:o.reason||'', expiry:o.expiry||'',
    dateFrom:o.dateFrom||'', dateTo:o.dateTo||'', dow:Array.isArray(o.dow)?o.dow.slice():[],   // §lkBulk · ช่วงวันที่ + วันในสัปดาห์
    usedBy:{},
    releaseDaysBefore:(o.releaseDaysBefore!=null&&o.releaseDaysBefore!=='')?Math.max(0,parseInt(o.releaseDaysBefore,10)||0):null,   // rolling per-trip cutoff (esp. bulk locks)
    releaseTime:o.releaseTime||'',
    status:'active', createdAt:nowTs, createdBy:laBy(),
    log:[{date:today,at:nowTs,type:'create',qty:Number(o.qty)||0,by:laBy()}] };
  SB_SEAT_LOCKS.push(l); sbSeatLocksPersist(); return l;
}
