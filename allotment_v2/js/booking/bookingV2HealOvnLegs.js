function bookingV2HealOvnLegs(){
  if(typeof SB_BOOKINGS==='undefined' || !Array.isArray(SB_BOOKINGS)) return 0;
  let fixed=0;
  SB_BOOKINGS.forEach(b=>{
    (b.trips||[]).forEach(t=>{
      if(!t || !t.ovnLeg) return;
      let ch=false;
      // ovnLeg ต้อง "ไม่มีเวลารับ" (ไม่ได้ไปรับที่โรงแรม) — แต่ต้องมีโซน เพราะยังต้องจัดรถไปส่ง
      if(t.pickupTime){ t.pickupTime=''; ch=true; }
      if(!t.zone || t.zone==='NoTransfer'){                    // ของเก่าถูกตั้งเป็น NoTransfer ไว้ → กู้คืน
        const out = (b.trips||[]).find(x=>x && !x.ovnLeg && x.routeId===t.routeId && x.zone && x.zone!=='NoTransfer');
        const z = (out && out.zone) || b.pickupZone || '';
        if(z && z!==t.zone){ t.zone=z; ch=true; }
      }
      if(ch) fixed++;
    });
  });
  if(fixed){
    try{ acctPersistBookings(); }catch(e){ console.warn('[ovn heal] persist failed', e); }
    console.log('[ovn heal] '+fixed+' return leg(s) cleared of their inherited pickup');
  }
  return fixed;
}
