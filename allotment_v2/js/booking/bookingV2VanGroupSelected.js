function bookingV2VanGroupSelected(date, routeId, zone, groupId, _selfOk){
  const sel=Object.keys(window._bkV2VanSel||{}).filter(k=>window._bkV2VanSel[k]);
  const keys=sel.filter(key=>{ const b=SB_BOOKINGS.find(x=>x.id===String(key).split('@')[0]); return b && _bkV2InZone(b,date,routeId,zone); });
  if(!keys.length) return;
  /* §selfAsk · ผู้ใช้ถาม 19 พ.ย. "จะมีเตือน เผื่อ User เผลอกดผิดไหม" · เคส NMH507214: RSVN ติ๊กมาเอง แล้วคนจัดรถจับเข้ากรุ๊ปต่อ ไม่มีอะไรถาม
     จับบุคกิ้งที่ติ๊ก "มาเอง" เข้ากรุ๊ปรถ → ถามก่อนว่ารถคันนี้ส่งกลับอย่างเดียว หรือเอาติ๊กออกให้รถไปรับ */
  if(!_selfOk && typeof laAskSheet==='function'){
    const _sf=[]; keys.forEach(key=>{ const b=SB_BOOKINGS.find(x=>x.id===String(key).split('@')[0]); if(b && b.pickupSelf && _sf.indexOf(b)<0) _sf.push(b); });
    if(_sf.length){
      const _nm=_sf.map(b=>'• '+(b.leadPax||'-')+' ('+(b.voucherRef||b.id)+')'+((b.hotelName||'').trim()?(' · '+(b.hotelName||'').trim()):'')).join('\n');
      laAskSheet({ title:'มีลูกค้าติ๊ก "มาเอง" '+_sf.length+' ราย',
        body:_nm+'\n\nขาไปลูกค้ามาเองที่ท่าเรือ รถจะไม่ไปรับ และไม่ขึ้นในใบงานรถขาไป\nจับเข้ากรุ๊ปนี้ = ใช้รถคันนี้ส่งกลับอย่างเดียว\n\nถ้าต้องให้รถไปรับที่โรงแรมด้วย เลือก "เอาติ๊กออก"',
        okLabel:'ส่งกลับอย่างเดียว', color:'#5B289A', noLabel:'เอาติ๊กออก · ให้รถไปรับ', cancelLabel:'ยกเลิก ไม่จับกรุ๊ป',
        onYes:function(){ bookingV2VanGroupSelected(date, routeId, zone, groupId, true); },
        onNo:function(){ _sf.forEach(b=>{ b.pickupSelf=false; if(typeof bookingV2AddHistory==='function') bookingV2AddHistory(b,'edit','เอาติ๊ก "ลูกค้ามาเอง" ออกตอนจัดรถ · ให้รถไปรับที่จุดรับ','Edited'); }); bookingV2VanGroupSelected(date, routeId, zone, groupId, true); } });
      return;
    }
  }
  const gid=(groupId==='new')?_bkV2VanNextGroup(date,routeId,zone):(+groupId);
  // current max pickup-seq + the group's existing van/return-van (so rows added to a group that already has a van INHERIT it immediately)
  let _maxSeq=0, _gVan=null, _gRet=null;
  _bkV2GrpApply(date,routeId,zone,gid,(b,s,o)=>{ const sq=s?(+s.vanSeq||0):(+(o.vanSeq)||0); if(sq>_maxSeq)_maxSeq=sq; const v=s?s.vanId:o.vanId; const rv=s?s.vanReturnId:o.vanReturnId; if(v&&!_gVan)_gVan=v; if(rv&&!_gRet)_gRet=rv; });
  // assign by the order rows were ticked
  const ordered=keys.slice().sort((a,b)=>(window._bkV2VanSel[a]||0)-(window._bkV2VanSel[b]||0));
  // block adding rows to a group whose van can't seat them all
  if(_gVan){
    const v=(typeof vehGet==='function')?vehGet(_gVan):null; const cap=(v&&v.capacity)||0;
    if(cap){
      let addPax=0;
      ordered.forEach(key=>{ const p=String(key).split('@'); const b=SB_BOOKINGS.find(x=>x.id===p[0]); if(!b)return; const _o=bkOpsRead(b,date); if(p.length>1&&Array.isArray(_o.vanSplits)&&_o.vanSplits[+p[1]]){ addPax+=(+_o.vanSplits[+p[1]].pax||0); } else { let n=0;(b.trips||[]).forEach(t=>{ if((t.date||'')!==date||(t.routeId||'')!==routeId)return; const z=(t.bookingMode==='charter')?'__CHARTER__':(t.zone||b.pickupZone||''); if(z!==zone)return; const px=(typeof bookingV2PaxAllTot==='function')?bookingV2PaxAllTot(t.pax||{}):0; if(px>n)n=px; }); addPax+=n; } });
      const cur=bookingV2VanGroupPax(date,routeId,zone,gid);
      if(cur+addPax>cap){ alert('ที่นั่งไม่พอ · กรุ๊ป '+gid+' ใช้รถ '+((v&&v.name)||_gVan)+' ('+cap+' ที่นั่ง)\nมีอยู่ '+cur+' + เพิ่ม '+addPax+' = '+(cur+addPax)+' คน\n\nสร้างกรุ๊ปใหม่ · แยกคน (✂) · หรือเลือกรถใหญ่กว่า'); return; }
    }
  }
  // a group = ONE van by design → adding a booking to a group with a van OVERWRITES any van it carried in (else "รถปนกันในกรุ๊ป": booking keeps its old van → job order routes it to the wrong van while the group header shows the group's van). Return van stays per-booking (only fills if empty · §73).
  ordered.forEach((key,i)=>{ const p=String(key).split('@'); const b=SB_BOOKINGS.find(x=>x.id===p[0]); if(!b)return; const o=bkOpsFor(b, bkOpsDate(b,date)); if(p.length>1 && Array.isArray(o.vanSplits) && o.vanSplits[+p[1]]){ const s=o.vanSplits[+p[1]]; s.vanGroup=gid; s.vanSeq=_maxSeq+i+1; if(_gVan)s.vanId=_gVan; if(_gRet&&!s.vanReturnId)s.vanReturnId=_gRet; } else { o.vanGroup=gid; o.vanSeq=_maxSeq+i+1; if(_gVan)o.vanId=_gVan; if(_gRet&&!o.vanReturnId)o.vanReturnId=_gRet; } delete window._bkV2VanSel[key]; });
  acctPersistBookings(); bookingV2RenderKeep();
}
