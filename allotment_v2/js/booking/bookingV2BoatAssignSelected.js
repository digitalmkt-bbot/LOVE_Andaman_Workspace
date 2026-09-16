// Assign every ticked booking (that belongs to this trip) to one boat · respects the cap+TOL guard · skips + reports the ones that would overflow
function bookingV2BoatAssignSelected(date, routeId, boatId){
  if(!boatId) return;
  if(baCharterBoatIds(date).has(boatId)){ const _bo=(BOATS||[]).find(x=>x.id===boatId); alert('เรือ '+((_bo&&_bo.name)||boatId)+' ถูกใช้เป็นเหมาลำ (Charter) วันนี้ · เลือกให้ลูกค้า seat ไม่ได้'); return; }
  const sel=window._bkV2BoatSel||{}; const ids=Object.keys(sel).filter(k=>sel[k]);
  if(!ids.length){ alert('Tick at least one row first.'); return; }
  const bo=(BOATS||[]).find(x=>x.id===boatId); const cap=(typeof boatCapFor==='function')?boatCapFor(boatId,date):(bo?(+bo.cap||0):0);   // §cap override รายวัน
  const TOL=(typeof BA_CAP_TOL!=='undefined')?BA_CAP_TOL:2;
  let done=0; const skipped=[];
  ids.forEach(id=>{
    const b=SB_BOOKINGS.find(x=>x.id===id); if(!b) return;
    if(!(b.trips||[]).some(t=>t.routeId===routeId && (t.date||'')===date)) return;   // only rows on this trip
    let ok=true;
    const dates=[...new Set((b.trips||[]).map(t=>t.date).filter(Boolean))];
    for(let di=0; di<dates.length; di++){ const d=dates[di];
      const myPax=(b.trips||[]).filter(t=>(t.date||'')===d).reduce((s,t)=>s+((typeof bookingV2PaxAllTot==='function')?bookingV2PaxAllTot(t.pax||{}):0),0);
      const cur=(typeof baAssignedPax==='function')?baAssignedPax(d,boatId):0;
      const already=(bkOpsRead(b,date).boatId===boatId)?myPax:0;
      if(cap>0 && (cur-already+myPax)>cap+TOL){ ok=false; break; }
    }
    if(ok){ bkOpsFor(b, date).boatId=boatId; delete sel[id]; done++; }   // baAssignedPax sees the mutation on the next loop iteration
    else skipped.push(b.leadPax||b.customerName||id);
  });
  acctPersistBookings();
  if(skipped.length) alert('Assigned '+done+' booking(s) to '+((bo&&bo.name)||boatId)+'.\nSkipped '+skipped.length+' — would exceed cap '+cap+' (+'+TOL+'): '+skipped.join(', '));
  if(typeof bookingV2Render==='function') bookingV2Render();
}
