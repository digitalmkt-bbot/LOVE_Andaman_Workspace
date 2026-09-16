function bookingV2CommitBooking(status){
  if(typeof window.laGuardEdit==='function' && !window.laGuardEdit('operations')) return;
  if(!_bkV2.newBooking) return;
  const d = _bkV2.newBooking;
  /* §bkAlFlush (2026-09-14) · "โน๊ตรายละเอียดไว้ แต่รายละเอียดหาย · เรื่องอาหาร"

     ช่อง "เพิ่มสิ่งที่แพ้" เป็นช่องพิมพ์ที่ต้องกด + เพิ่ม (หรือ Enter) ถึงจะเข้า allergyList
     ตอนบันทึก ระบบสร้างใบใหม่จาก _bkV2.newBooking ล้วน ๆ ไม่เคยอ่านช่องนี้เลย
     คนที่พิมพ์แล้วกด Save ต่อเลย · ข้อความหายเงียบ ไม่มีเตือนสักตัว
     วัดแล้ว พิมพ์ "แพ้กุ้ง 2 คน ..." แล้วกด Save · allergyList ว่าง allergies ว่าง

     ที่นี่เก็บของที่ยังค้างในช่องให้ก่อน เหมือนคนกด + เพิ่ม เอง
     เป็นข้อความที่เขาพิมพ์เองและยังเห็นอยู่ตรงหน้า การเก็บให้จึงตรงกับเจตนา
     ปลอดภัยกว่าทิ้ง · เรื่องแพ้อาหารพลาดแล้วเป็นเรื่องความปลอดภัยของลูกค้า */
  try{
    var _alN=document.getElementById('bkv2-allerg-name');
    var _alWas=_alN?String(_alN.value||'').trim():'';
    if(_alWas){
      /* ช่องนี้เป็นช่อง "ชื่อสิ่งที่แพ้" (placeholder บอกว่า เช่น Peanut) ชิปจะถูกนับเป็นจำนวนคน
         แต่คนมักพิมพ์เป็นประโยคยาวลงไปด้วย · ประโยคยาวทำชิปพัง และนับเป็น "1 ราย" ไม่ได้ความ
         ยาวเกินชื่อวัตถุดิบ หรือมีตัวคั่นประโยค → ลงช่องรายละเอียด ซึ่งพิมพ์ออกใบเหมือนกัน
         สั้นแบบชื่อวัตถุดิบ → เข้าชิปเหมือนกดปุ่ม + เพิ่ม เพื่อให้ยังนับจำนวนคนได้
         ทั้งสองทางถูกพิมพ์ลงใบและถูกนับโดย bookingV2AllergyText/Count · ไม่มีทางไหนที่ข้อความหาย */
      var _alLong = _alWas.length>28 || _alWas.indexOf('\u00b7')>=0 || /[.\n]/.test(_alWas);
      if(_alLong){
        var _sm=d.specialMeals||(d.specialMeals={veg:0,vegan:0,halal:0,allergies:''});
        _sm.allergies=[String(_sm.allergies||'').trim(), _alWas].filter(Boolean).join(' \u00b7 ');
      } else if(typeof bookingV2AllergyAdd==='function'){
        bookingV2AllergyAdd();
      }
      _alN=document.getElementById('bkv2-allerg-name');
      if(_alN) _alN.value='';
      if(typeof bookingV2AddHistory==='function')
        bookingV2AddHistory(d,'edit','เก็บข้อความเรื่องอาหารที่ยังค้างในช่องพิมพ์ตอนกดบันทึก'
          +(_alLong?' (ลงช่องรายละเอียด)':' (ลงเป็นรายการที่แพ้)')+': '+_alWas,'Edited');
    }
  }catch(_e){}
  // Normalize hotel names against existing spellings so typos/spacing don't spawn duplicates
  if(typeof bookingV2CanonicalHotel==='function'){
    if(d.hotelName) d.hotelName = bookingV2CanonicalHotel(d.hotelName);
    if(d.dropoffHotelName) d.dropoffHotelName = bookingV2CanonicalHotel(d.dropoffHotelName);
  }
  // §hotelDedupe · ชื่อใหม่ที่ใกล้กับของเดิมมาก · ถามก่อนหนึ่งครั้ง ไม่ตัดสินใจแทน
  if(typeof bookingV2HotelNear==='function' && d.hotelName && d.hotelConfirmedNew!==d.hotelName){
    var _near=bookingV2HotelNear(d.hotelName, null, d.pickupAreaId||'', d.pickupZoneFilter||'');
    if(_near){
      var _pc=Math.round(_near.score*100);
      if(confirm('ชื่อโรงแรมที่พิมพ์คล้ายกับที่มีอยู่แล้ว ('+_pc+'%)\n\n'
        +'พิมพ์: '+d.hotelName+'\n'
        +'มีอยู่: '+_near.name+'\n\n'
        +'กด OK = ใช้ชื่อเดิม "'+_near.name+'"\n'
        +'กด Cancel = เก็บชื่อที่พิมพ์ไว้เป็นโรงแรมใหม่')){
        d.hotelName=_near.name;
      }
      d.hotelConfirmedNew=d.hotelName;   // ถามครั้งเดียวพอ
    }
  }
  // (Lead-count guard removed 2026-06-10 — Lead now occupies a real seat of its own type
  //  via bookingV2SyncPassengers (AD if any adult, else FOC/CHD/INF), so an all-FOC group of N
  //  is exactly N heads / N names · no +1 prompt.)
  // ── Staff welfare guard: require staff member · warn if free (FOC) seats exceed the yearly quota ──
  {
    const _ag = d.agentId ? sbGetAgent(d.agentId) : null;
    const _isStaff = !!(_ag && (_ag.code==='STAFF' || _ag.id==='a_staff'));
    if(_isStaff){
      if(!d.staffId){ alert('Please choose a Staff member for this booking'); return; }
    }
    if(_isStaff && (d.staffPurpose||'welfare')==='welfare'){
      const exclId = _bkV2.editingId || null;
      const usedExcl = (year)=>{ let n=0; (SB_BOOKINGS||[]).forEach(b=>{ if(b.id===exclId||b.staffId!==d.staffId) return; if(['cancelled','rejected','cancelled_weather'].includes(b.status)) return; (b.trips||[]).forEach(t=>{ if((t.date||'').slice(0,4)===String(year)) n += bookingV2PaxTot(t.pax||{},'foc'); }); }); return n; };
      const reqByYear={}; (d.trips||[]).forEach(t=>{ const y=(t.date||'').slice(0,4); if(!y) return; reqByYear[y]=(reqByYear[y]||0)+bookingV2PaxTot(t.pax||{},'foc'); });
      let over='';
      Object.keys(reqByYear).forEach(y=>{ const rem=(typeof staffQuota==='function'?staffQuota(d.staffId,y):0)-usedExcl(y); const req=reqByYear[y]; if(req>rem) over += 'Year '+y+': '+rem+' free seats left, '+req+' requested -> over by '+(req-rem)+'\n'; });
      if(over && !confirm('Free welfare seats exceed the quota:\n'+over+'\nThe over-quota people should be Adult (charged at staff rate), not FOC.\nSave anyway?')) return;
    }
  }
  // ── Required-field validation (hard block) + soft warnings (allow save · ⚠ flag) ──
  {
    const validTrips = (d.trips||[]).filter(t => t.routeId && t.date);
    const totalPax   = (d.trips||[]).reduce((s,t)=> s + bookingV2PaxAllTot(t.pax||{}), 0);
    const missHard = [];
    if(!d.agentId && !d.b2cChannel)          missHard.push('Agent / B2C channel');
    if(!validTrips.length)                   missHard.push('Trip (route + date)');
    if(totalPax <= 0)                        missHard.push('Pax (at least 1)');
    if(!(d.leadPax||'').trim())              missHard.push('Lead passenger name');
    // §b2cSave · ราคาไม่ได้มาจากเรท (B2C ส่งยอดมาเอง / walk-in ตั้งราคาเอง) ก็ไม่ต้องมีเรท
    const _extPrice = (typeof bookingV2IsB2CBk==='function') && bookingV2IsB2CBk(d);
    if(!d.rateTypeRef && d.priceMode!=='manual') missHard.push('Rate Type');
    // Nationality required (needed for market/demand analytics) · auto-guess from lead name when blank
    if(!d.leadNationality && typeof bookingV2GuessNationality==='function'){ const _gn=bookingV2GuessNationality(d.leadPax||''); if(_gn) d.leadNationality=_gn; }
    if(!d.leadNationality)                   missHard.push('Lead nationality (cannot auto-detect — please pick)');
    // Named passengers must have a nationality too (same rule as the lead · for insurance) · auto-guess from
    // each name first; UN-named passengers stay optional (dropped at save · fast lead+counts entry preserved).
    if(typeof bookingV2SyncPassengers==='function') bookingV2SyncPassengers();
    const _paxNoNat=[];
    if(Array.isArray(d.passengers)){
      d.passengers.forEach((p,i)=>{ const nm=((p&&p.name)||'').trim(); if(!nm) return;
        if(!p.nationality && typeof bookingV2GuessNationality==='function'){ const _pg=bookingV2GuessNationality(nm); if(_pg) p.nationality=_pg; }
        if(!p.nationality) _paxNoNat.push('#'+(i+2)+' '+nm);
      });
    }
    if(_paxNoNat.length) missHard.push('Passenger nationality — '+_paxNoNat.join(', ')+' (cannot auto-detect · please pick)');
    const _g = d.guides||{};
    // §b2cSave · ใบ B2C ไม่ได้ถามภาษาไกด์มา · บังคับตรงนี้จะได้ข้อมูลที่ ops เดาเอา
    const _noLang = !(_g.english||_g.russian||_g.chinese||(_g.otherLang||'').trim());
    if(_noLang && !_extPrice) missHard.push('Guide language');
    // If a pickup area/zone is chosen, the specific Hotel / pickup location is required — EXCEPT No Transfer (self-arrival · field becomes an optional note)
    const _pa = (typeof bookingV2GetArea==='function') ? bookingV2GetArea(d.pickupAreaId) : null;
    const _zoneNT = (_pa && (_pa.zone==='NoTransfer'||_pa.zone==='NT')) || d.pickupZoneFilter==='NoTransfer' || (d.trips||[]).some(t=>t.zone==='NoTransfer'||t.zone==='NT');
    if(d.pickupAreaId && !(d.hotelName||'').trim() && !_zoneNT) missHard.push('Hotel / pickup location (pickup area selected)');
    // §pickup guard (2026-07-11 · closes the "confirmed with no pickup" hole): the old rule only fired when a
    // pickup AREA had been chosen, so a booking with NOTHING filled in sailed straight through to CONFIRMED.
    // Now a pickup point is required to CONFIRM. Quotes/drafts ('quote') can still be saved without one.
    if(status !== 'quote'){
      const _hasPickup = (d.hotelName||'').trim() || (d.pickup||'').trim();
      if(!_hasPickup && !_zoneNT) missHard.push('จุดรับ (Hotel / pickup location) — ต้องระบุก่อนคอนเฟิร์ม\n    ถ้าลูกค้ามาเองที่ท่าเรือ ให้เลือกโซน "No Transfer" (self-arrive)\n    ถ้ายังไม่รู้ที่รับ ให้กดบันทึกเป็น Quote ไว้ก่อน');
    }
    // §non-operating guard (hard block · a trip cannot be booked on a day its route does not run · closed/off-season/weather)
    if(typeof bookingV2IsRouteOpenOn==='function'){
      const _closedTrips = validTrips.filter(t=>!bookingV2IsRouteOpenOn(t.routeId, t.date)).map(t=>{ const _rn=(typeof ROUTES!=='undefined' && (ROUTES.find(r=>r.id===t.routeId)||{}).name)||t.routeId; return _rn+' · '+t.date+' (ทริปไม่ออกวันนี้)'; });
      // §b2cSave · ใบ B2C ทริป/วันที่เป็นของต้นทางและแก้ที่นี่ไม่ได้ · บล็อกไว้ = ใบนั้นแก้อะไรไม่ได้เลย
      if(_closedTrips.length && !_extPrice) missHard.push('ทริปไม่ออกวันที่เลือก · route not running that day:\n    - '+_closedTrips.join('\n    - '));
      else if(_closedTrips.length) _bkV2._b2cClosedWarn = _closedTrips;
    }
    if(missHard.length){
      alert('Cannot save — please complete:\n\n· ' + missHard.join('\n· '));
      return;
    }
    // §contract-scope guard (Option A · 2026-07-22) — an agent's "Programs in Contract" act as a WHITELIST of
    // sellable routes ONLY WHEN populated. Booking a route outside it → warn + confirm (override allowed).
    // Empty programs = no restriction (backward-compatible · เอเยนต์ที่ยังไม่กรอกโปรแกรมยังจองได้ตามเดิม).
    {
      const _scAg = d.agentId ? (typeof sbGetAgent==='function'?sbGetAgent(d.agentId):null) : null;
      // same source of truth as the route picker (bookingV2RouteDDOpts): contract programPeriods first, then programs[]
      const _scPP = (_scAg && Array.isArray(_scAg.programPeriods) && _scAg.programPeriods.length) ? [...new Set(_scAg.programPeriods.map(p=>p.routeId).filter(Boolean))] : null;
      const _scAllow = _scPP || ((_scAg && Array.isArray(_scAg.programs) && _scAg.programs.length) ? _scAg.programs : null);
      if(_scAllow){
        const _scOut = [...new Set(validTrips.filter(t=>!_scAllow.includes(t.routeId)).map(t=>t.routeId))];
        if(_scOut.length){
          const _scNm = rid => (typeof ROUTES!=='undefined' && (ROUTES.find(r=>r.id===rid)||{}).name) || rid;
          if(!confirm('เส้นทางนอกสัญญาของ '+(_scAg.name||'เอเยนต์นี้')+':\n\n· '+_scOut.map(_scNm).join('\n· ')+'\n\nเอเยนต์นี้ระบุในสัญญาไว้ '+_scAllow.length+' เส้นทาง — เส้นทางข้างบนไม่อยู่ในนั้น\n(ถ้าจะขายจริง ควรเพิ่มเข้าสัญญาก่อน)\n\nยืนยันบันทึกต่อไหม?')) return;
        }
      }
    }
    // Train the nationality guesser from what staff entered/confirmed → future auto-detect gets smarter
    if(typeof natLearnRecord==='function'){
      if(d.leadPax && d.leadNationality) natLearnRecord(d.leadPax, d.leadNationality);
      (d.passengers||[]).forEach(p=>{ if(p && p.name && p.nationality) natLearnRecord(p.name, p.nationality); });
    }
    // ── Duplicate-booking guard (soft · warn, allow proceed) ──
    if(typeof bookingV2FindDuplicateBookings==='function'){
      const _dups=bookingV2FindDuplicateBookings(d, _bkV2.editingId||null);
      if(_dups.length){
        const _lines=_dups.slice(0,6).map(x=>{ const b=x.bk; const _vc=b.voucherRef||b.code||b.id; const _t0=(b.trips||[])[0]||{}; const _rn=((typeof getRoute==='function'&&getRoute(_t0.routeId))||{}).name||''; return '• '+_vc+' · '+(b.leadPax||'-')+' · '+(_t0.date||'')+(_rn?(' · '+_rn):'')+'\n   ('+x.reasons.join(' · ')+')'; }).join('\n');
        if(!confirm('⚠ พบ booking ที่อาจซ้ำ '+_dups.length+' รายการ:\n\n'+_lines+(_dups.length>6?'\n…':'')+'\n\nบันทึกเป็น booking ใหม่ต่อไปหรือไม่?')) return;
      }
    }
    // Soft: self-arrive ticked but a hotel pickup was entered → likely a mis-tick (booking gets dropped from the outbound van sheet)
    if(d.pickupSelf && (d.hotelName||'').trim()){
      if(!confirm('⚠ ติ๊ก "ลูกค้ามาเอง (self-arrive)" แต่กรอกโรงแรม "'+(d.hotelName||'').trim()+'" ไว้\n\nbooking นี้จะไม่ขึ้นในใบงานรถขาไป (ถือว่าลูกค้าไปเองที่ท่า)\nถ้าลูกค้าให้ไปรับที่โรงแรม กด Cancel แล้วเอาติ๊กออก\n\nยืนยันเป็น self-arrive ต่อไปหรือไม่?')) return;
    }
    // Soft: pickup (hotel / area) — OTA bookings may not have it yet → warn + flag, don't block
    const _missSoft = [];
    if(!d.pickupAreaId && !(d.hotelName||'').trim()) _missSoft.push('pickup');
    // §b2cSave · สิ่งที่ยกเว้นให้ใบ B2C ต้องไม่หายไปเฉย ๆ · ติดธงไว้บนใบให้ตามเก็บ
    if(_extPrice && _noLang) _missSoft.push('guide-lang');
    if(_extPrice && Array.isArray(_bkV2._b2cClosedWarn) && _bkV2._b2cClosedWarn.length) _missSoft.push('route-closed');
    // §eat · ห้ามล้าง _b2cClosedWarn ตรงนี้ · ถ้าล้างก่อนถาม พอกด Cancel แล้วกดใหม่
    //        คำเตือนจะหายไปและบันทึกเงียบ ๆ · ล้างหลังบันทึกสำเร็จเท่านั้น
    if(_missSoft.length){
      // §msg · บอกให้ตรงกับธงที่เกิดขึ้นจริง · ของเดิมเขียนตายตัวว่าไม่มีจุดรับ
      const _softLbl = { 'pickup':'ยังไม่ได้ระบุจุดรับ (pickup)',
                         'guide-lang':'ยังไม่ได้ระบุภาษาไกด์',
                         'route-closed':'เส้นทางปิดในวันที่เลือก' };
      const _lines = _missSoft.map(function(k){ return '\u00b7 '+(_softLbl[k]||k); }).join('\n');
      if(!confirm(_missSoft.length>1?('ยังขาดข้อมูลนี้:\n'+_lines+'\n\nบันทึกต่อโดยติดธง \u26a0 ให้ตามเก็บภายหลังไหม?')
                                    :((_softLbl[_missSoft[0]]||_missSoft[0])+'\nบันทึกต่อโดยติดธง \u26a0 ให้ตามเก็บภายหลังไหม?'))) return;
    }
    _bkV2._missSoft = _missSoft;   // consumed below when building newBk
  }
  // Step 3c · confirm seat-lock draw before committing (ask every time)
  const totalLockUse = (d.trips||[]).reduce((s,t)=> s + (t.bookingMode==='charter' ? 0 : Math.min(Number(t.lockUse)||0, bookingV2PaxAllTot(t.pax))), 0);
  if(totalLockUse > 0){
    if(!confirm('Draw ' + totalLockUse + ' locked seat(s) for this booking?\n\nThey will be taken from the held locks (own agent first, then office/global).')) return;
  }
  // ── Reminder safety-net: agent HAS lock seats on a trip but none were drawn → don't silently eat the general pool ──
  if(typeof bookingV2DrawSources==='function' && d.agentId){
    const missed = [];
    (d.trips||[]).forEach(t=>{
      if(t.bookingMode==='charter') return;
      const paxT = bookingV2PaxAllTot(t.pax); if(paxT<=0) return;
      const drew = Object.values(t.lockDrawSel||{}).reduce((a,b)=>a+(Number(b)||0),0);
      if(drew>0) return;                                   // already using the lock → fine
      const rem = bookingV2DrawSources(t.routeId, t.date, d.agentId).reduce((s,x)=>s+x.remaining,0);
      if(rem>0){ const rn=((typeof getRoute==='function'?(getRoute(t.routeId)||{}).name:'')||t.routeId); missed.push('• '+rn+' · '+t.date+' — มี lock ว่าง '+rem+' ที่'); }
    });
    if(missed.length){
      if(!confirm('⚠ เอเจนต์นี้มี seat lock ที่ยังไม่ได้ใช้:\n\n'+missed.join('\n')+'\n\nจะจองจาก pool ทั่วไปโดยไม่ใช้ lock ใช่ไหม?\n(กด Cancel เพื่อกลับไปกด "ใช้ lock ก่อน")')) return;
    }
  }
  // ── Anti-overbook guard (tiered) ──
  //  lockViolation   = would take LOCKED seats it didn't draw → HARD BLOCK
  //  overCapApproval = over the COMPANY cap but within the boat's LICENSED (registered) seats → MANAGER APPROVAL (saved as Pending)
  //  licenseBlock    = over the LICENSED seats (no real seat left) → HARD BLOCK · must add a boat
  const lockViolation = [], overCapApproval = [], licenseBlock = [];
  // When EDITING, the booking already legitimately holds its current seats. Only guard the INCREASE:
  // an edit that doesn't raise a trip's general-seat need (e.g. changing hotel/notes on a now-full or
  // now-locked day) must still save. oldNeed = what this trip already consumed on the same route+date.
  const _origBk = _bkV2.editingId ? (typeof SB_BOOKINGS!=='undefined'?SB_BOOKINGS:[]).find(b=>b.id===_bkV2.editingId) : null;
  (d.trips||[]).forEach(t => {
    if(t.bookingMode==='charter' || !t.routeId || !t.date) return;
    const al = (typeof getAllotment==='function') ? getAllotment(t.routeId, t.date, _bkV2.editingId || null) : null;   // exclude own seats when editing
    if(!al || !al.hasAllotment) return;
    const pax = bookingV2PaxAllTot(t.pax);
    const need = pax - Math.min(Number(t.lockUse)||0, pax);           // general seats needed (after own lock draw)
    let oldNeed = 0;
    if(_origBk){
      const _ot = (_origBk.trips||[]).find(x=>x.routeId===t.routeId && x.date===t.date && x.bookingMode!=='charter');
      if(_ot){ const _op = bookingV2PaxAllTot(_ot.pax); oldNeed = _op - Math.min(Number(_ot.lockUse)||0, _op); }
    }
    if(need > al.seatsAvailable && need > oldNeed){                   // block only a genuine INCREASE that no longer fits
      const r = (typeof ROUTES!=='undefined') ? ROUTES.find(x=>x.id===t.routeId) : null;
      const nm = (r?r.name:t.routeId);
      const physicalFree = al.seatsAvailable + (al.lockedSeats||0);   // cap − consumed (ignoring locks)
      if(need <= physicalFree){
        lockViolation.push(`${nm} ${t.date}: needs ${need} seats but only ${al.seatsAvailable} sellable · ${al.lockedSeats} are LOCKED`);
      } else {
        const licFree = (al.licenseAvailable!=null) ? al.licenseAvailable : physicalFree;
        /* §otherPier · โปรแกรมบกไม่มีเพดานตามทะเบียนเหมือนเรือ · เกินโควตาคือเข้าคิวอนุมัติ
           ห้ามบล็อกตาย เพราะรถเช่าเพิ่มคันได้เสมอ ไม่เหมือนที่นั่งตามใบอนุญาตใช้เรือ */
        if(al.isLand || need <= licFree){
          overCapApproval.push({routeId:t.routeId, date:t.date, name:nm, need, capFree:physicalFree, overBy:(need-physicalFree), licFree});
        } else {
          licenseBlock.push(`${nm} ${t.date}: needs ${need} but only ${licFree} real (license) seat(s)`);
        }
      }
    }
  });
  if(lockViolation.length){
    alert('Cannot save - this booking would take LOCKED seats:\n\n' + lockViolation.join('\n') + '\n\nIncrease "Use locked", add a boat in Boat Operation, or release the lock in Seat Locks.');
    return;   // hard block · no override
  }
  if(licenseBlock.length){
    alert('Cannot save - exceeds the LICENSED (registered) seats of the boat:\n\n' + licenseBlock.join('\n') + '\n\nThe real seats are full. Add a boat in Boat Operation first.');
    return;   // hard block · physically no seat
  }
  let _approvalReq = null;
  if(overCapApproval.length){
    const totOver = overCapApproval.reduce((s,o)=>s+o.overBy,0);
    if(!confirm('⚠ เกินจำนวนที่นั่งที่บริษัทกำหนด (Allotment) +' + totOver + ' ที่นั่ง\n\n' + overCapApproval.map(o=>`${o.name} ${o.date}: เกิน cap +${o.overBy} (ยังไม่เกินทะเบียนเรือ)`).join('\n') + '\n\nบุคกิ้งนี้จะ "ยังไม่คอนเฟิร์ม" — ระบบจะบันทึกเป็น "รออนุมัติ" ให้ผู้จัดการอนุมัติก่อน\n\nดำเนินการต่อ?')) return;
    _approvalReq = { reason:'over_capacity', over: overCapApproval, totOver };
  }
  const quote = bookingV2CalcQuote();
  // ── Discount → must be confirmed by the responsible salesperson first → save as Pending approval ──
  const _discAmt = Math.round((quote && (quote.totalDiscount!=null?quote.totalDiscount:quote.discount)) || 0);
  if(status==='confirmed' && _discAmt>0){
    const _ag=d.agentId?sbGetAgent(d.agentId):null;
    const _saleId=(_ag&&_ag.sales)||''; const _sale=(typeof SB_SALES!=='undefined')?(SB_SALES||[]).find(s=>s.id===_saleId):null;
    const _saleNm=_sale?(_sale.name||'').replace(/^Khun\s+/,''):'เซลล์ที่ดูแล';
    alert('⚠ บุคกิ้งนี้มีส่วนลด ฿' + _discAmt.toLocaleString() + '\n\nจะ "ยังไม่คอนเฟิร์ม" — ต้องให้ ' + _saleNm + ' (เซลล์ที่ดูแล) ยืนยันส่วนลดก่อน\nระบบจะบันทึกเป็น "รออนุมัติ (ส่วนลด)"');
    if(_approvalReq){ _approvalReq.reason = _approvalReq.reason + '+discount'; _approvalReq.discount = _discAmt; }
    else { _approvalReq = { reason:'discount', discount:_discAmt, over:[], totOver:0 }; }
    _approvalReq.saleName = _saleNm;
  }
  const agent = sbGetAgent(d.agentId);
  const rt = d.rateTypeRef ? (SB_RATE_TYPES||[]).find(r => r.id === d.rateTypeRef) : null;

  // P3d · Edit mode · preserve original id + createdAt
  const editing = _bkV2.editingId ? SB_BOOKINGS.find(b => b.id === _bkV2.editingId) : null;
  const bookingId = editing ? editing.id : d.code;
  const createdAt = editing?.createdAt || new Date().toISOString().slice(0,10);
  const createdBy = (d.createdBy||'').trim() || editing?.createdBy || '';

  // Release existing charter locks for this booking before re-applying (edit case)
  if(editing && typeof TRIPS !== 'undefined' && Array.isArray(editing.trips)){
    editing.trips.forEach(t => {
      if(t.bookingMode !== 'charter' || !t.charterBoatId) return;
      /* §ovnSpan · ต้องคืนทั้งช่วงเดิม ไม่ใช่แค่วันแรก · ไม่งั้นแก้วันกลับให้สั้นลง
         แล้ววันที่หลุดออกจากช่วงยังถูกจองค้างไว้ตลอดไป */
      bkOvnSpanDates(t).forEach(ds => {
        const op = TRIPS[ds]?.[t.charterBoatId];
        if(op && op.charterBookingId === editing.id){
          delete op.charterBookingId;
          op.type = 'normal';
        }
      });
    });
  }

  const pickupArea = bookingV2GetArea(d.pickupAreaId);
  const dropoffArea = bookingV2GetArea(d.dropoffAreaId);
  const newBk = {
    id: bookingId,
    schemaVer: 2,
    createdAt: createdAt,
    createdBy: createdBy,
    ...(editing ? { updatedAt: new Date().toISOString(), updatedBy: 'RM' } : {}),
    voucherRef: d.voucherRef || '',
    agentId: d.agentId,
    rateTypeRef: d.rateTypeRef,
    leadPax: d.leadPax,
    leadNationality: d.leadNationality || '',
    leadType: d.leadType || 'AD',
    leadFoc: !!d.leadFoc,
    leadPhone: d.leadPhone,
    leadEmail: d.leadEmail,
    attachments: Array.isArray(d.attachments) ? d.attachments : [],   // document files (refs · data on server) · §doc-check
    docCheck: d.docCheck || null,                                      // verification state (set in Document Check view)
    pickupAreaId: d.pickupAreaId,
    pickupSelf: !!d.pickupSelf,
    pickupArea: pickupArea?.name || '',  // denormalized for easy display
    pickupZone: pickupArea?.zone || 'PK',
    hotelName: d.hotelName || '',
    roomNumber: d.roomNumber || '',
    dropoffSame: d.dropoffSame,
    dropoffAreaId: d.dropoffSame ? d.pickupAreaId : d.dropoffAreaId,
    dropoffArea: d.dropoffSame ? (pickupArea?.name || '') : (dropoffArea?.name || ''),
    dropoffHotelName: d.dropoffSame ? (d.hotelName || '') : (d.dropoffHotelName || ''),
    /* §altDropFix · ฝั่งจุดส่งต้องถูกเก็บด้วย · เดิมประกอบใหม่จากรายชื่อช่องตายตัว
       ซึ่งมีแต่ฝั่งรับ · ตั้งจุดส่งขากลับไว้แล้วกดบันทึก ค่าหายทุกครั้ง */
    altPickups: Array.isArray(d.altPickups) ? d.altPickups.map(a=>{
      const _ar=(a.areaId&&typeof bookingV2GetArea==='function')?bookingV2GetArea(a.areaId):null;
      const _p=bkAltPax(a);
      const _same=(a.dropSame!==false);
      const _dar=(!_same && a.dropAreaId && typeof bookingV2GetArea==='function')?bookingV2GetArea(a.dropAreaId):null;
      return Object.assign({who:(a.who||'').trim(), qty:Math.max(1,bkPaxSum(_p)), areaId:a.areaId||'',
        area:_ar?_ar.name:'', zone:_ar?_ar.zone:((a.zone||'').trim()), place:(a.place||'').trim(),
        dropSame:_same,
        dropAreaId:_same?'':(a.dropAreaId||''),
        dropArea:_dar?_dar.name:'',
        dropZone:_same?'':(_dar?_dar.zone:((a.dropZone||'').trim())),
        dropPlace:_same?'':((a.dropPlace||'').trim())}, _p);
    }).filter(a=>(a.who||a.place||a.areaId) && bkPaxSum(bkAltPax(a))>0) : [],   // §altPickups · บางคนรับคนละที่ · zone auto จาก area
    guides: d.guides ? { english:!!d.guides.english, russian:!!d.guides.russian, chinese:!!d.guides.chinese, otherLang: d.guides.otherLang || '' } : { english:false, russian:false, chinese:false, otherLang:'' },
    notes: d.notes || '',
    paxType: d.paxType,
    passengers: Array.isArray(d.passengers) ? d.passengers.filter(p => (p.name||'').trim()).map(p => ({ name: p.name, nationality: p.nationality||'', type: p.type||'AD', foc: !!p.foc })) : [],
    /* §bkAlKeep · pierAt/pierBy = หน้าท่าเป็นคนบันทึกเรื่องอาหารไว้ ตอนกี่โมง
       ของเดิมสร้าง specialMeals ใหม่จาก 5 ช่อง · สองช่องนี้หายทุกครั้งที่มีคนกดบันทึกใบ
       ข้อความยังอยู่แต่ไม่เหลือว่าใครแจ้ง · เรื่องแพ้อาหารต้องตามคนแจ้งได้ */
    specialMeals: { veg: d.specialMeals?.veg||0, vegan: d.specialMeals?.vegan||0, halal: d.specialMeals?.halal||0, allergies: d.specialMeals?.allergies||'', allergyList: Array.isArray(d.specialMeals?.allergyList) ? d.specialMeals.allergyList.filter(a=>a&&a.name).map(a=>({name:String(a.name), qty:Math.max(1,Math.floor(+a.qty||1))})) : [],
      pierAt: d.specialMeals?.pierAt||undefined, pierBy: d.specialMeals?.pierBy||undefined },
    largeLuggage: d.largeLuggage || 0,
    cashOnTour: d.cashOnTour ? { amount: d.cashOnTour.amount||0, currency: d.cashOnTour.currency||'THB', handling: d.cashOnTour.handling||'deduct', note: (d.cashOnTour.note||'').trim() } : null,
    trips: d.trips.filter(t => t.routeId && t.date).map(t => ({
      routeId: t.routeId,
      date: t.date,
      // §OVN return leg — the customer boards at the island pier, so there is NO pickup zone. Left on the
      // outbound zone, the van sheet sent a driver to their (already checked-out) hotel to collect someone
      // who was at that moment on a boat.
      zone: t.zone,   // §OVN · เดิมเขียนทับ ovnLeg เป็น 'NoTransfer' ทำให้จัดรถขาส่งไม่ได้
      pax: { ...t.pax },
      /* §pkNat · สัญชาติจริงของ นทท. · ไม่ใส่คีย์เลยถ้าไม่มีใครระบุ
         คอลัมน์ NULL ทั้งสี่ = os_repo ไม่สร้าง nat กลับมาตอนโหลด = ถอยไปใช้ช่องราคาเหมือนเดิม */
      nat: bkNatHas(t) ? { ad:+t.nat.ad||0, chd:+t.nat.chd||0, inf:+t.nat.inf||0, foc:+t.nat.foc||0 } : undefined,
      pickupTime: t.pickupTime || bookingV2GetPickupTime(t.routeId, d.pickupAreaId, t.date) || '',
      bookingMode: t.bookingMode || 'seat',
      charterBoatId: t.charterBoatId || null,
      charterPriceMode: t.charterPriceMode || 'rate',
      charterPriceManual: t.charterPriceMode === 'manual' ? (Number(t.charterPriceManual)||0) : 0,
      charterPriceNote: t.charterPriceMode === 'manual' ? (t.charterPriceNote||'') : '',
      charterDisplacementAck: !!t.charterDisplacementAck,
      ovn: t.ovn || null,
      ovnReturnDate: t.ovn==='return' ? (t.ovnReturnDate||'') : '',
      ovnCharge: t.ovn ? Math.max(0, Number(t.ovnCharge)||0) : 0,
      ovnLeg: !!t.ovnLeg,
      ovnOf: (t.ovnOf!=null) ? t.ovnOf : null,
      seatSource: (() => {
        const paxT = bookingV2PaxAllTot(t.pax);
        const lu = (t.bookingMode==='charter') ? 0 : Math.min(Number(t.lockUse)||0, paxT);
        return { locked: lu, general: Math.max(0, paxT - lu) };
      })(),
      lockDrawSel: (t.bookingMode==='charter') ? {} : { ...(t.lockDrawSel||{}) },   // staff-picked draw sources {lockId:qty} (Option A sub-groups)
      ops: t.ops || undefined,   // §b2cEdit/§ops · การจัดเรือ-รถ + ผลเช็คอินของ "วันนั้น" · เดิมสร้างทริปใหม่โดยไม่คัดมา = แก้ booking ทีเดียวหายทุกวัน
      lockDraws: [],   // filled after save · [{lockId, qty}]
      subtotal: bookingV2TripSubtotal(t).total
    })),
    addOns: d.addOns.map(a => {
      const info = bookingV2AddOnInfo(a.type);
      const q = a.qty||1;
      return { type: a.type, label: info.label + (a.type==='longtail-charter'&&q>1?(' × '+q+' ลำ'):''), amount: info.total*q, qty: q, note: (a.note||'').trim() };
    }),
    adjustments: Array.isArray(d.adjustments)
      ? d.adjustments.filter(a => (Number(a.value)||0) > 0)
          .map(a => ({ kind:a.kind, mode:a.mode||'amount', value:Number(a.value)||0, label:a.label||'', note:a.note||'' }))
      : [],
    focApproval: quote.totalFoc > 0 ? {
      count: quote.totalFoc,
      reason: d.focReason,
      status: status === 'pending_foc' ? 'pending' : (status === 'confirmed' ? 'approved' : 'pending'),
      requestedAt: new Date().toISOString(),
      requestedBy: 'RM'
    } : null,
    paymentSnapshot: {
      method: agent?.payType === 'invoice' ? 'credit' : 'prepaid',
      netDays: agent?.creditDays || 0,
      source: 'contract',
      contractVersion: agent?.contractVersion || ''
    },
    priceBreakdown: {
      seat: quote.totalSeat,
      addOn: quote.totalAddOn,
      focDiscount: -quote.focDiscount,
      discount: -(quote.totalDiscount||0),
      extra: (quote.totalExtra||0),
      total: quote.grandTotal
    },
    status: status,
    total: quote.grandTotal,
    soldBy: d.soldBy || null,   // salesperson credit override (walk-in/direct sale)
    priceMode: d.priceMode || 'rate',
    manualTotal: d.priceMode==='manual' ? (Math.max(0,Number(d.manualTotal)||0)) : null,
    purpose: (function(){ const _a=d.agentId?sbGetAgent(d.agentId):null; if(_a&&(_a.code==='STAFF'||_a.id==='a_staff')) return (d.staffPurpose==='inspection')?'staff_inspection':'staff_welfare'; return 'sale'; })(),
    staffId: d.staffId || null,   // staff member for welfare/inspection bookings
    staffPurpose: d.staffPurpose || null,
    note: d.note || ''
  };

  /* §ovnSync · ขากลับค้างคืนต้องผูกกับ "วันกลับ" ของขาไปเสมอ
     ของเดิม commit เขียน trips ตามที่ฟอร์มส่งมาดิบ ๆ ไม่มีใครเช็คว่าสองอย่างนี้ตรงกัน
     พอแก้ใบจาก 16–19 เป็น 16–18 ขากลับวัน 19 ยังค้างอยู่ในใบ → หน้า By trip
     ยังขึ้นแถวลูกค้าวันที่ 19 พร้อมยอดเงิน ทั้งที่ทริปนั้นไม่มีแล้ว
     กติกา: ขาไปที่ยังเป็น ovn==='return' และมีวันกลับ → ย้ายขากลับของมันมาที่วันนั้น
             ขาไปที่เลิกเป็น OVN แล้ว (หรือไม่มีวันกลับ) → ขากลับของมันถูกตัดทิ้ง
             ขากลับที่ไม่มีขาไปเป็นเจ้าของ → ตัดทิ้ง (เศษจากการแก้ครั้งก่อน) */
  (function(){
    var T=newBk.trips||[]; if(!T.length) return;
    var outs=T.filter(function(x){ return x && !x.ovnLeg && x.ovn==='return' && x.ovnReturnDate && x.ovnReturnDate>x.date; });
    var keep=[], moved=[], dropped=[];
    T.forEach(function(x){
      if(!x || !x.ovnLeg){ keep.push(x); return; }
      var own=outs.find(function(o){ return (o.routeId||'')===(x.routeId||''); });
      if(!own){ dropped.push(x.date||'?'); return; }
      if((x.date||'')!==own.ovnReturnDate){ moved.push((x.date||'?')+'→'+own.ovnReturnDate); x.date=own.ovnReturnDate; }
      keep.push(x);
    });
    /* กันขากลับซ้ำวันเดียวกัน/เส้นทางเดียวกัน หลังย้ายวันแล้ว */
    var seen={};
    keep=keep.filter(function(x){
      if(!x || !x.ovnLeg) return true;
      var k=(x.routeId||'')+'|'+(x.date||'');
      if(seen[k]){ dropped.push(x.date||'?'); return false; }
      seen[k]=1; return true;
    });
    if(moved.length || dropped.length){
      newBk.trips=keep;
      var msg='ปรับขากลับค้างคืนให้ตรงกับวันกลับ'
        +(moved.length?(' · ย้าย '+moved.join(', ')):'')
        +(dropped.length?(' · ตัดขากลับที่ไม่มีขาไป '+dropped.join(', ')):'');
      try{ bookingV2AddHistory(newBk,'edit',msg,'Edited'); }catch(_){}
    }
  })();

  newBk.incomplete = _bkV2._missSoft || [];   // soft-missing fields (e.g. pickup) · ⚠ in manifest
  _bkV2._b2cClosedWarn = null;   // §eat · ผู้ใช้ตัดสินใจแล้วและกำลังบันทึกจริง · ล้างได้ตรงนี้
  // ── Over-capacity → Pending manager approval (saved + holds seats, but NOT confirmed until a manager approves) ──
  if(_approvalReq){
    newBk.status = 'pending_approval';
    newBk.approval = {
      status:'pending', reason:_approvalReq.reason, targetStatus: status,
      over:_approvalReq.over||[], totOver:_approvalReq.totOver||0,
      discount:_approvalReq.discount||0, saleName:_approvalReq.saleName||'',
      requestedBy: ((createdBy||d.submittedBy||'').trim())||'', requestedAt: new Date().toISOString(),
      approvedBy:'', approvedAt:'', note:''
    };
  } else if(editing && editing.approval && editing.approval.status!=='pending'){
    newBk.approval = editing.approval;   // keep resolved approval record on later edits (audit)
  }
  // ── Booking-date record + market snapshot · for future demand/market forecasting (stable even if agent changes market later) ──
  newBk.bookedAt    = (editing && editing.bookedAt) || new Date().toISOString();                              // exact create timestamp
  newBk.bookingDate = d.bookingDate || (editing && (editing.bookingDate || editing.createdAt)) || new Date().toISOString().slice(0,10); // booking date · from form (default today) · editable
  newBk.marketSnapshot = (editing && editing.marketSnapshot) || { market:(agent&&agent.market)||null, sub:(agent&&agent.sub)||null, agentId:d.agentId||null, at:new Date().toISOString().slice(0,10) };
  // Submitted by (ผู้ส่ง = createdBy above) + Confirmed by (ผู้คอนเฟิร์ม · stamped when confirmed)
  if(status==='confirmed'){
    newBk.confirmedBy = (d.confirmedBy||'').trim() || (editing && editing.confirmedBy) || bookingV2LoginUser() || '';
    newBk.confirmedAt = (editing && editing.confirmedAt) || new Date().toISOString();
  } else {
    newBk.confirmedBy = (editing && editing.confirmedBy) || (d.confirmedBy||'').trim() || '';
    newBk.confirmedAt = (editing && editing.confirmedAt) || null;
  }
  // Preserve audit trail + weather/invoice state across edits, then log this action
  if(editing){
    if(Array.isArray(editing.history)) newBk.history = editing.history;
    if(editing.weatherResolve) newBk.weatherResolve = editing.weatherResolve;
    if(editing.rebook) newBk.rebook = editing.rebook;
    if(editing.invoiceId) newBk.invoiceId = editing.invoiceId;
    if(editing.paymentStatus) newBk.paymentStatus = editing.paymentStatus;
    // §opsSync · id of this booking's mirror on operation-backend, if it has one — carry it over
    //   so an edit PATCHes the same record instead of creating a duplicate every save.
    if(editing.opsId) newBk.opsId = editing.opsId;
    // ⚠ Preserve operational assignments across edits — boat assign (ops.boatId), van group/van/return,
    //   reconfirm, final pickup time, upgrade, etc. were being WIPED on every edit (data-loss bug 2026-06-14).
    if(editing.ops) newBk.ops = editing.ops;
    // §b2cEdit · เงิน · ทริป · ผู้โดยสาร · add-on เป็นของ B2C ทั้งชุด · คัดของเดิมกลับ
    //   ไม่ให้เครื่องคิดเรทของเราเขียนทับ (ใบที่ไม่มีเรทจะถูกคิดใหม่เป็น ฿0)
    //   แล้วจดว่า ops แตะช่องไหนบ้าง เพื่อให้ sync ข้ามเฉพาะช่องนั้น (server.js §b2cOwn)
    if(bookingV2IsB2CBk(editing)){
      newBk.total = editing.total;
      newBk.priceBreakdown = JSON.parse(JSON.stringify(editing.priceBreakdown || {}));
      newBk.priceMode = editing.priceMode || 'rate';
      newBk.manualTotal = (editing.manualTotal != null) ? editing.manualTotal : null;
      newBk.trips = JSON.parse(JSON.stringify(editing.trips || []));
      newBk.passengers = JSON.parse(JSON.stringify(editing.passengers || []));
      newBk.addOns = JSON.parse(JSON.stringify(editing.addOns || []));
      var _prevOv = Array.isArray(editing.b2cOverride) ? editing.b2cOverride : [];
      var _newOv  = bookingV2B2CDiff(d._b2cSnap, newBk);
      newBk.b2cOverride = _prevOv.concat(_newOv).filter(function(v,i,a){ return v && a.indexOf(v)===i; });
      if(_newOv.length) bookingV2AddHistory(newBk,'edit','แก้ช่องของ B2C: '+_newOv.join(', ')+' · จากนี้ sync จะไม่ทับช่องเหล่านี้','Edited');
    } else if(Array.isArray(editing.b2cOverride)){ newBk.b2cOverride = editing.b2cOverride; }
    // …but a NEW travel day means the old day's boat and van no longer apply. Preserving them blindly is how
    // a booking moved from the 12th to the 15th kept the 12th's boat and van (and its pickup time).
    // Charter keeps its boat — the charter lock travels with the trip.
    {
      const _oldD=[...new Set((editing.trips||[]).map(t=>t.date).filter(Boolean))].sort().join(',');
      const _newD=[...new Set((newBk.trips||[]).map(t=>t.date).filter(Boolean))].sort().join(',');
      if(_oldD && _newD && _oldD!==_newD && newBk.ops){
        /* §strandMove · ถ่ายภาพก่อนล้าง · ใช้ trips ของใบเดิม เพราะ newBk ย้ายวันไปแล้ว */
        if(typeof ckStrandSnap==='function'){
          try{ ckStrandSnap(newBk, _oldD.split(',')[0], newBk.ops,
            (editing.trips||[]).filter(t=>t && t.date===_oldD.split(',')[0])[0]||null,
            _newD.split(',')[0], 'edit'); }catch(_){}
        }
        const _isCharter=(newBk.trips||[]).some(t=>t.bookingMode==='charter');
        if(!_isCharter) newBk.ops.boatId=null;
        newBk.ops.vanId=null; newBk.ops.vanReturnId=null; newBk.ops.returnSameVan=false;
        newBk.ops.vanGroup=0; newBk.ops.vanSeq=0;
        if(Array.isArray(newBk.ops.vanSplits)) newBk.ops.vanSplits=[];
        newBk.ops.pickupTimeFinal='';
        (newBk.trips||[]).forEach(t=>{ if(t.ops) t.ops=undefined; });   // later days lose theirs too
        bookingV2AddHistory(newBk,'edit','วันเดินทางเปลี่ยน ('+_oldD+' → '+_newD+') · ล้างการจัดเรือ/รถของวันเดิม','Edited');
      }
    }
    // §bug1 · ยกเลิกรถรับ (แก้เป็น "มาเอง" / โซน NoTransfer) แต่ ops.van ขารับเดิมถูก carry มา →
    //   ยังโผล่ในใบงานรถว่าต้องมีรถ · เคลียร์เฉพาะรถ "ขารับ" (คง vanReturnId ขาส่งไว้ เพราะมาเองไม่ได้แปลว่าไม่ต้องส่ง)
    //   กันพลาด: ถ้ามี alt-pickup จุดไหนยังต้องใช้รถ (zone != NoTransfer) จะไม่แตะ
    if(newBk.ops){
      const _noOut = newBk.pickupSelf===true || newBk.pickupZone==='NoTransfer' || newBk.pickupZone==='NT';
      const _altOut = (newBk.altPickups||[]).some(a=>a.zone && a.zone!=='NoTransfer' && a.zone!=='NT');
      if(_noOut && !_altOut){
        const _o=newBk.ops; let _cl=false;
        if(_o.vanId){_o.vanId=null;_cl=true;}
        if(_o.vanGroup){_o.vanGroup=0;_cl=true;}
        if(_o.vanSeq)_o.vanSeq=0;
        if(Array.isArray(_o.vanSplits)) _o.vanSplits.forEach(s=>{ if(s.vanId){s.vanId=null;_cl=true;} if(s.vanGroup)s.vanGroup=0; if(s.vanSeq)s.vanSeq=0; });
        if(_cl) bookingV2AddHistory(newBk,'edit','ยกเลิกรถรับ (ลูกค้ามาเอง/NoTransfer) · ล้างการจัดรถขารับ','Edited');
      }
    }
    // Day-of records that live on the booking but aren't rebuilt from the form
    if(Array.isArray(editing.upgrades)) newBk.upgrades = editing.upgrades;
    if(Array.isArray(editing.feeItems)) newBk.feeItems = editing.feeItems;
    if(editing.reschedule) newBk.reschedule = editing.reschedule;
    if(Array.isArray(editing.partialCancels)) newBk.partialCancels = editing.partialCancels;
    if(editing.cancellation) newBk.cancellation = editing.cancellation;
    if(editing.cancelCategory) newBk.cancelCategory = editing.cancelCategory;
    bookingV2AddHistory(newBk,'edit','Edited booking details','Edited');
  } else {
    const _nt=(newBk.trips||[]).length;
    bookingV2AddHistory(newBk,'create','Created booking · '+_nt+' trip(s) · ฿'+Math.round(newBk.total||0).toLocaleString()+(status==='confirmed'?' · confirmed':status==='pending_foc'?' · awaiting FOC':''),'Created');
  }
  /* §chOpsSync (2026-09-14) · "Booking นี้มีการแก้ไขเปลี่ยนเรือ ใบ Edit ที่หน้า manifest ไม่เปลี่ยน"

     ใบเหมาลำเก็บชื่อเรือไว้สองที่
       t.charterBoatId · ฝั่งขาย · คนเลือกตอนจองและตอนแก้ใบ
       ops.boatId      · ฝั่งปฏิบัติการ · ช่องที่ bkBoatIdOf อ่าน และทั้งแอปอ่านต่อจากนั้น

     ตอนบันทึกแก้ไข ops ถูกคัดของเดิมมาทั้งก้อน (กันการจัดเรือ-รถหายตอนแก้ใบ)
     และมีแต่ตอน "เปลี่ยนวันเดินทาง" เท่านั้นที่ล้าง boatId ให้
     เปลี่ยนแค่ "ลำ" จึงไม่มีใครตามแก้

     ผล · TRIPS ย้ายไปล็อกลำใหม่แล้ว แถบ CHARTER ก็ขึ้นลำใหม่ (สองที่นี้อ่าน charterBoatId)
     แต่ ops.boatId ยังเป็นลำเก่า · ช่อง BOAT ในตาราง · Boat Operation · เช็คอินหน้าท่า
     · ใบงานเรือ · Daily Fleet Log จึงยังส่งคนไปลำที่ไม่ได้ออก

     ใบเหมาเปลี่ยนลำได้ทางเดียวคือแก้ที่ใบ (ช่องเรือในตารางถูกล็อกไว้)
     charterBoatId จึงเป็นตัวจริง · ตรงนี้ทำให้ ops.boatId ตามเสมอ
     ใบที่แยกคนลงหลายลำ (boatSplits) ไม่แตะ · ลำของมันอยู่ใน splits ไม่ใช่ boatId */
  (function(){
    try{
      var _chMoved=[];
      (newBk.trips||[]).forEach(function(t){
        if(!t || t.bookingMode!=='charter' || !t.charterBoatId) return;
        var O=(typeof bkOpsFor==='function')?bkOpsFor(newBk, t.date):null;
        if(!O) return;
        if(Array.isArray(O.boatSplits) && O.boatSplits.length) return;
        if((O.boatId||'')===t.charterBoatId) return;
        var was=O.boatId||'';
        O.boatId=t.charterBoatId;
        if(was) _chMoved.push({d:t.date, was:was, now:t.charterBoatId});
      });
      if(_chMoved.length){
        var _bn=function(id){ var o=(typeof BOATS!=='undefined'?BOATS:[]).find(function(x){ return x.id===id; }); return (o&&o.name)||id; };
        bookingV2AddHistory(newBk,'edit','เปลี่ยนเรือเหมาลำ · '
          +_chMoved.map(function(m){ return m.d+' '+_bn(m.was)+' → '+_bn(m.now); }).join(' · ')
          +' · ย้ายการจัดเรือตามไปด้วย','Edited');
      }
    }catch(_e){}
  })();
  if(_approvalReq){ bookingV2AddHistory(newBk,'edit','Over company capacity +'+_approvalReq.totOver+' seat(s) → submitted for manager approval','Approval'); }

  // §altPickups phase-2 · auto-build/refresh van splits so each alt pickup point rides its own allocation
  // (same booking · can be a different van) · preserves van assignments by index across edits.
  if(typeof bookingV2SyncAltPickupSplits==='function') bookingV2SyncAltPickupSplits(newBk);

  // Persist to SB_BOOKINGS · then localStorage (read-modify-write)
  if(editing){
    // P3d · replace existing entry in place (preserve list position)
    const idx = SB_BOOKINGS.findIndex(b => b.id === editing.id);
    if(idx >= 0){
      // Preserve focApproval state from existing booking if it was already decided
      if(editing.focApproval && editing.focApproval.status && editing.focApproval.status !== 'pending' && newBk.focApproval){
        newBk.focApproval = { ...newBk.focApproval, status: editing.focApproval.status, approvedAt: editing.focApproval.approvedAt, approvedBy: editing.focApproval.approvedBy, rejectReason: editing.focApproval.rejectReason };
        // FOC already approved → keep the booking Confirmed (don't downgrade to Pending FOC just because it was re-submitted)
        if(newBk.focApproval.status==='approved' && newBk.status==='pending_foc'){
          newBk.status='confirmed';
          if(!newBk.confirmedAt) newBk.confirmedAt = editing.confirmedAt || new Date().toISOString();
        }
      }
      SB_BOOKINGS[idx] = newBk;
    } else {
      SB_BOOKINGS.unshift(newBk);
    }
  } else {
    SB_BOOKINGS.unshift(newBk);
  }

  // ── Step 3c · draw locked seats from the STAFF-PICKED sources (sub-groups A/B/C or parent-unalloc) ──
  if(typeof bookingV2DrawLock === 'function'){
    /* §lkReturn · แก้ใบจอง = คืนของเดิมก่อน แล้วค่อยดึงใหม่ตามที่เลือกไว้ตอนนี้
       เดิมข้ามขั้นคืน · กดแก้ใบเดิมสิบครั้ง ล็อกก็นับว่าถูกใช้ไปสิบเท่า */
    if(editing && typeof bookingV2ReturnBookingDraws==='function'){
      bookingV2ReturnBookingDraws(editing, 'edit \u00b7 \u0e04\u0e37\u0e19\u0e01\u0e48\u0e2d\u0e19\u0e14\u0e36\u0e07\u0e43\u0e2b\u0e21\u0e48');
    }
    const rank = l => l.holderType==='agent' ? 0 : (l.holderType==='office' ? 1 : 2);
    newBk.trips.forEach((nt) => {
      if(nt.bookingMode==='charter'){ nt.lockDraws=[]; return; }
      const draws = [];
      const sel = nt.lockDrawSel || {};
      const picked = Object.keys(sel).filter(id => (Number(sel[id])||0) > 0);
      if(picked.length){
        // explicit picks (Option A) · draw exactly what the user chose, per source
        picked.forEach(id => { const n = bookingV2DrawLock(id, Number(sel[id])||0, newBk.id, nt.date); if(n>0) draws.push({ lockId:id, qty:n }); });
      } else {
        // fallback (no explicit pick · legacy) · draw seatSource.locked by priority
        let need = Number((nt.seatSource||{}).locked)||0;
        if(need > 0 && typeof bookingV2DrawSources==='function'){
          const srcs = bookingV2DrawSources(nt.routeId, nt.date, newBk.agentId).sort((a,b)=>{ const la=SB_SEAT_LOCKS.find(x=>x.id===a.lockId)||{}, lb=SB_SEAT_LOCKS.find(x=>x.id===b.lockId)||{}; return rank(la)-rank(lb); });
          for(const s of srcs){ if(need<=0) break; const n = bookingV2DrawLock(s.lockId, Math.min(need, s.remaining), newBk.id, nt.date); if(n>0){ draws.push({ lockId:s.lockId, qty:n }); need -= n; } }
        }
      }
      nt.lockDraws = draws;
      const drawn = draws.reduce((s,x)=>s+x.qty,0);
      const paxT = bookingV2PaxAllTot(nt.pax);
      nt.seatSource = { locked: drawn, general: Math.max(0, paxT - drawn) };
    });
  }

  // ── Train nationality learning system · record name→code from this booking ──
  if(d.leadPax && d.leadNationality) natLearnRecord(d.leadPax, d.leadNationality);
  (newBk.passengers || []).forEach(p => {
    if(p.name && p.nationality) natLearnRecord(p.name, p.nationality);
  });

  // ── Wire charter → TRIPS · lock boats for chartered trips ──
  /* §ovnSpan · ของเดิมจองเรือให้ "วันของ trip" วันเดียว · ใบค้างเกาะ 16→19
     จึงจองแค่วันที่ 16 · วันที่ 17-18 เรือว่างให้จ่ายงานอื่นทับได้ทั้งที่อยู่ที่เกาะ
     เลือกเรือ + ช่วงวัน = เรือถูกหยิบไปใช้ทั้งช่วง · จองให้ครบทุกวัน
     วันไหนมีใบเหมาอื่นจองไว้แล้ว ไม่แย่ง · นับไว้เตือนตอนบันทึก */
  let tripsModified = false, spanBlocked = [];
  if(typeof TRIPS !== 'undefined' && status !== 'quote'){
    newBk.trips.forEach(t => {
      if(t.bookingMode !== 'charter' || !t.charterBoatId) return;
      bkOvnSpanDates(t).forEach(ds => {
        if(!TRIPS[ds]) TRIPS[ds] = {};
        const cur = TRIPS[ds][t.charterBoatId];
        if(cur && cur.charterBookingId && cur.charterBookingId !== newBk.id){ spanBlocked.push(ds); return; }
        if(!cur) TRIPS[ds][t.charterBoatId] = { route: t.routeId, type: 'charter', booked: 0 };
        TRIPS[ds][t.charterBoatId].type = 'charter';
        TRIPS[ds][t.charterBoatId].charterBookingId = newBk.id;
        TRIPS[ds][t.charterBoatId].route = t.routeId;
        tripsModified = true;
      });
    });
  }

  try {
    const lsKey = (typeof LS_KEY !== 'undefined' ? LS_KEY : 'loveandaman_v2');
    const raw = localStorage.getItem(lsKey) || '{}';
    const obj = JSON.parse(raw);
    obj.sb_bookings = SB_BOOKINGS;
    if(tripsModified) obj.trips = TRIPS;
    localStorage.setItem(lsKey, JSON.stringify(obj));
  } catch(e){ console.warn('Save failed', e); }
  // §opsSync · mirror onto operation-backend, best-effort — see bookingV2SyncToOpsBackend
  try{ bookingV2SyncToOpsBackend(newBk); }catch(e){}

  // Close form · go to detail page if editing · else All bookings tab
  const wasEditing = !!_bkV2.editingId;
  _bkV2.newBooking = null;
  _bkV2.editingId = null;
  if(_approvalReq){
    _bkV2.tab = 'approvals';   // over-capacity → land on the Pending-approval tab
  } else if(wasEditing){
    _bkV2.detailId = newBk.id;
  } else {
    // Land on "By trip · date" at the booking's (earliest) trip date
    const firstDate = (newBk.trips||[]).map(t=>t.date).filter(Boolean).sort()[0] || '';
    _bkV2.filterDate = firstDate || null;
    _bkV2.filterRoute = null;
    _bkV2T2Cursor = firstDate ? firstDate.slice(0,7) : null;
    _bkV2.tab = 'bytrip';
  }
  bookingV2Render();
  if(_approvalReq){
    laSaveToast({kind:'pending', title:'บันทึกแล้ว · รออนุมัติ', id:newBk.id, status:'PENDING APPROVAL',
      sub:`เกิน capacity ${_approvalReq.totOver} ที่นั่ง — ผจก.ต้องอนุมัติในแท็บ "รออนุมัติ"`});
  } else {
    const _st = (newBk.status||status).toUpperCase();
    const _k = _st.indexOf('PENDING')>=0 ? 'pending' : (_st.indexOf('REJECT')>=0 ? 'error' : 'success');
    const _n = (newBk.trips||[]).filter(t=>t.bookingMode==='charter').length;
    laSaveToast({kind:_k, title:(wasEditing?'อัปเดต booking แล้ว':'บันทึก booking แล้ว'), id:newBk.id, status:_st,
      sub: tripsModified ? `🚤 ล็อกเหมาลำ · ${_n} ลำ` : ''});
  }
}
