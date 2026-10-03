function bookingV2AssignBoat(bkId, boatId, date){
  const b=SB_BOOKINGS.find(x=>x.id===bkId); if(!b) return;
  const _d = bkOpsDate(b, date);   // which travel day this assignment belongs to
  // §boatSplit · เลือกเรือลำเดียวทั้งที่บุคกิ้งแยกลงหลายลำอยู่ → ต้องยืนยันก่อน ไม่งั้นการแยกหายเงียบ
  const _sp0=(typeof bkBoatSplits==='function')?bkBoatSplits(b,_d):null;
  if(_sp0){ if(!confirm('บุคกิ้งนี้แยกลง '+_sp0.length+' ลำอยู่\nเลือกลำเดียวจะยกเลิกการแยกทั้งหมด — ยืนยันไหม')) return; delete bkOpsFor(b,_d).boatSplits; }
  if(boatId){
    const _chDates=[...new Set((b.trips||[]).map(t=>t.date).filter(Boolean))];
    for(let ci=0; ci<_chDates.length; ci++){ if(baCharterBoatIds(_chDates[ci]).has(boatId)){ const _bo=(BOATS||[]).find(x=>x.id===boatId); alert('เรือ '+((_bo&&_bo.name)||boatId)+' ถูกใช้เป็นเหมาลำ (Charter) วันที่ '+_chDates[ci]+' · เลือกให้ลูกค้า seat ไม่ได้'); return; } }
    const bo=(BOATS||[]).find(x=>x.id===boatId);
    const cap=(typeof boatCapFor==='function')?boatCapFor(boatId,_d):(bo?(+bo.cap||0):0);   // §cap override รายวัน
    if(cap>0){
      // The boat is being assigned for ONE travel day — only that day's load can overflow it.
      // (It used to loop every date of the booking, which was right when one boat served all days.)
      const dates=[_d].filter(Boolean);
      for(let di=0; di<dates.length; di++){ const d=dates[di];
        const myPax=(b.trips||[]).filter(t=>(t.date||'')===d).reduce((s,t)=>s+((typeof bookingV2PaxAllTot==='function')?bookingV2PaxAllTot(t.pax||{}):0),0);
        const cur=(typeof baAssignedPax==='function')?baAssignedPax(d,boatId):0;     // bookings already on this boat that date
        const already=(bkOpsRead(b,d).boatId===boatId)?myPax:0;                       // subtract self if already on this boat
        const next=cur-already+myPax;
        if(next>cap+BA_CAP_TOL){
          /* §baCapGate (2026-10-03) · เรือเต็มแล้วแต่ยังมีคนที่รับจองไปแล้วค้างอยู่ (เคสจริง 4 ต.ค. Hermetis 65 ที่ · จอย 69 คน
             จากล็อกเกินของเดิม) · ของเดิมบอกแค่ "ใส่ไม่ได้" แล้วจบ ผู้ใช้ไม่รู้ว่าต้องไปปลดที่ไหน
             ยังบล็อกเหมือนเดิม · แต่พาไปหน้าปรับ cap เฉพาะวันนั้นได้เลย ซึ่งเป็นด่านปลดที่มีอยู่แล้ว:
             ต้องใส่เหตุผล บันทึกชื่อคนปรับ และไม่เกินที่นั่งจดทะเบียน · ปรับแล้วใส่เรือให้ต่อเอง
             เกินทะเบียนแล้วไม่มีทางปลด ต้องเพิ่มเรือ */
          const nm=((bo&&bo.name)||boatId), lic=(typeof boatCapLicense==='function')?boatCapLicense(boatId):0;
          if(typeof boatCapModalOpen!=='function' || (lic>0 && next-BA_CAP_TOL>lic)){
            alert('Cannot assign to '+nm+'.\nThis boat would have '+next+' pax on '+d+' (cap '+cap+', max allowed '+(cap+BA_CAP_TOL)+(lic>0?(', licensed seats '+lic):'')+').\nThe licensed seats cannot be exceeded. Assign another boat, or add a boat in Boat Operation.');
            return;
          }
          if(!confirm('Cannot assign to '+nm+'.\nThis boat would have '+next+' pax on '+d+' (cap '+cap+', max allowed '+(cap+BA_CAP_TOL)+').\n\nEMERGENCY ONLY: raise the capacity of '+nm+' for this day?\nA reason is required and your name is recorded. Licensed seats: '+(lic||'-')+'.\n\nOK = open the day-capacity setting   Cancel = leave unassigned')) return;
          boatCapModalOpen(boatId, d, function(){
            const c2=boatCapFor(boatId,d);
            if(c2+BA_CAP_TOL>=next) bookingV2AssignBoat(bkId, boatId, date);
            else if(_bkV2 && _bkV2.boatAssignMode && typeof bookingV2Render==='function') bookingV2Render();
          }, Math.min(lic>0?lic:next, next));
          return;
        }
      }
    }
  }
  bkOpsFor(b, _d).boatId = boatId || null;
  acctPersistBookings();
  // re-render whichever surface is showing
  if(_bkV2 && _bkV2.boatAssignMode && typeof bookingV2Render==='function') bookingV2Render(); else renderBoatAssign();
}
