function bookingV2LockClaims(lockId, idx){
  const out = [];
  const _L=idx ? (idx.lockOf.get(lockId)||null) : ((typeof SB_SEAT_LOCKS!=='undefined')?SB_SEAT_LOCKS.find(y=>y.id===lockId):null);
  const _ld=bookingV2LockDateOf(_L);   /* ว่าง = ล็อคแบบช่วง ข้ามการเช็ควัน */
  const _src = idx ? [null] : (typeof SB_BOOKINGS!=='undefined'?SB_BOOKINGS:[]);
  const _hits = idx ? (idx.by.get(lockId)||[]) : null;
  _src.forEach(b0 => {
    const _trips = idx ? _hits : (b0.trips||[]);
    _trips.forEach(t0 => { const b = idx ? t0.b : b0, t = idx ? t0.t : t0;
     const gone = ['cancelled','rejected','cancelled_weather'].indexOf(b.status)>=0;
     (idx ? [t0.x] : (t.lockDraws||[])).forEach(x => {
      if(x.lockId!==lockId) return;
      /* §lkStale · ใบย้ายวันไปแล้ว แต่ที่นั่งยังชี้ล็อคของวันเดิม
         ไม่ใช่ใบจองของวันนี้แล้ว จึงไม่ใช่ของจริงเท่ากับใบที่ยกเลิก */
      const moved = !!(_ld && t.date && t.date!==_ld);
      out.push({ id:b.id, vc:(b.voucherRef||b.code||b.id||''), lead:String(b.leadPax||'').trim(),
                 qty:Number(x.qty)||0, date:t.date||'', moved:moved,
                 status:(moved&&!gone)?('ย้ายวันไป '+t.date):(b.status||''), dead:(gone||moved) });
    }); });
  });
  return out.sort((a,b)=> String(a.date).localeCompare(String(b.date)) || String(a.vc).localeCompare(String(b.vc)));
}
