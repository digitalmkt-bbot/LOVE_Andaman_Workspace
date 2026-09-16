// OVN · auto-create the return-leg trip (reserves seats on the return day · price 0 · charge sits on ovnCharge)
function bookingV2CreateOvnReturnLeg(idx){
  if(!_bkV2.newBooking) return;
  const d = _bkV2.newBooking;
  const t = d.trips[idx];
  if(!t || t.ovn!=='return') return;
  if(!t.date){ alert('เลือกวันเดินทาง (DATE) ของทริปก่อน'); return; }
  if(!t.ovnReturnDate){ alert('เลือก "วันกลับ (OVN)" ก่อน'); return; }
  if(t.ovnReturnDate < t.date){ alert('วันกลับต้องไม่ก่อนวันเดินทาง (' + t.date + ')'); return; }
  if(d.trips.some(x => x.ovnLeg && x.routeId===t.routeId && x.date===t.ovnReturnDate)){ alert('สร้าง trip ขากลับของวันนี้ไว้แล้ว'); return; }
  const leg = bookingV2NewTrip();
  leg.routeId = t.routeId;
  leg.date = t.ovnReturnDate;
  // §OVN · ขากลับ "ไม่มีขารับที่โรงแรม" แต่ยังต้องมีรถ *ไปส่ง* จากท่าเรือกลับโรงแรม
  // เดิมตั้ง NoTransfer ซึ่งในระบบนี้แปลว่า "ไม่ใช้รถเลย" → bookingV2VanCellHTML คืน self-arrive
  // ทันที ช่องติ๊ก/กรุ๊ป/เลือกรถหายหมด · เก็บโซนจริงไว้ ใบงานจัดการเรื่องจุดรับเอง (bkIsOvnReturn)
  leg.zone = t.zone || '';         // โซนปลายทางที่ต้องไปส่ง (ไม่มีรถไปรับ (รถกลับ pier→โรงแรม จัดในแมนิเฟสต์)
  leg.pax = { ...t.pax };          // กันที่นั่งจำนวนเดียวกับขาไป
  /* §ovnRet · ใบเหมาลำ · ขากลับคือเรือลำเดิมของใบนั้น ไม่ใช่การจอยเรือรอบปกติ
     "เหมาลำ คนละเคสกับจอย" · ของเดิมตั้ง 'seat' ตายตัวไม่ดูขาไป ใบเหมาจึงแตกเป็น
     สองสถานะในใบเดียว — ขาไปเป็นเหมา ขากลับไปโผล่ในกลุ่มที่นั่งของเรือรอบปกติ
     ราคายังเป็น 0 เหมือนเดิม · ทุกจุดที่คิดเงินเช็ค ovnLeg ก่อน bookingMode */
  const _ovIsCharter = (t.bookingMode === 'charter');
  leg.bookingMode = _ovIsCharter ? 'charter' : 'seat';
  if(_ovIsCharter) leg.charterBoatId = t.charterBoatId || null;
  leg.ovnLeg = true;               // ขากลับค้างคืน · ราคา 0
  leg.ovnOf = idx;
  d.trips.push(leg);
  t.ovnLegCreated = true;
  bookingV2Render();
}
