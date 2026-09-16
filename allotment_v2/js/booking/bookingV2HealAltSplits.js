function bookingV2HealAltSplits(date){
  let changed=false;
  (SB_BOOKINGS||[]).forEach(b=>{ if(['cancelled','rejected','cancelled_weather'].includes(b.status)) return;
    if(date && !(b.trips||[]).some(t=>t.date===date)) return;
    // สร้าง/รีเฟรช auto split จากจุดรับ — เฉพาะบุ๊กกิ้งที่มีจุดรับเพิ่ม
    if(Array.isArray(b.altPickups) && b.altPickups.length){
      if(bookingV2SyncAltPickupSplits(b)) changed=true;
    }
    // ...แต่การซ่อม headcount↔breakdown ต้องวิ่งกับ *ทุก* บุ๊กกิ้งที่มี split (รวม manual split ด้วย —
    // ของเสียจากบั๊ก "แยกซ้ำ" อยู่ในบุ๊กกิ้งที่ไม่มี altPickups เลย ซึ่งเงื่อนไขเดิมข้ามทิ้งพอดี)
    if(b.ops && Array.isArray(b.ops.vanSplits) && b.ops.vanSplits.length){
      if(bookingV2HealSplitPax(b, b.ops)) changed=true;
    }
    /* §per-trip ops · split ของวันที่ 2+ (OVN) อยู่บน trip.ops — เดิมไม่เคยถูกซ่อมเลย */
    (b.trips||[]).forEach(t=>{ if(!t||!t.ops||bkIsFirstDay(b,t.date))return; if(!Array.isArray(t.ops.vanSplits)||!t.ops.vanSplits.length)return; if(bookingV2HealSplitPax(b, t.ops)) changed=true; });
  });
  if(changed && typeof acctPersistBookings==='function') acctPersistBookings();
  return changed;
}
