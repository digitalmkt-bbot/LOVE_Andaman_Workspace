/* เรือที่เลือกได้ของวันนั้น · พร้อมเหตุผลว่าทำไมบางลำเลือกไม่ได้ */
function bookingV2BoatLockPickList(date, routeId, exceptId){
  const out=[];
  /* §bkLock · เรือต้องอยู่ท่าเดียวกับเส้นทาง · เอาเรือพันวาไปวิ่งเส้นทางทับละมุไม่ได้
     ถามท่าตามวันที่ (§boatPierDate) ไม่ใช่ท่าวันนี้ · เรือเข้าอู่แล้วกลับมาคนละท่าได้ */
  const _r=(typeof ROUTES!=='undefined'?ROUTES:[]).find(x=>x&&x.id===routeId);
  const _rp=_r?(_r.pier||''):'';
  /* §bkLockEdit · ลำที่ใบนี้ถืออยู่แล้วในวันเดิม ต้องอยู่ในรายการเสมอ และเลือกได้เสมอ
     เจอตอนลองเอง · เปิดฟอร์มแก้แล้วลำของตัวเองไม่อยู่ในรายการ (ถูกกรองด้วยท่า/สถานะ)
     ปุ่มบันทึกจึงเทาตลอด แก้แค่หมายเหตุก็ไม่ได้ · การแก้หมายเหตุไม่ควรต้องผ่านด่านเลือกเรือใหม่ */
  const _own=exceptId?bookingV2BoatLockById(exceptId):null;
  (typeof BOATS!=='undefined'?BOATS:[]).forEach(b=>{
    if(!b||!b.id) return;
    const isOwn=!!(_own && _own.boatId===b.id && _own.date===date);
    if(_rp && !isOwn){
      const bp=(typeof getBoatCurrentPier==='function')?getBoatCurrentPier(b,date):(b.pier||'');
      if(bp && bp!==_rp) return;
    }
    const st=(typeof getCurStatus==='function')?(getCurStatus(b,date)||{}).s:'available';
    const B=bookingV2BoatLockBlockers(date,b.id,undefined,exceptId);
    let why='';
    if(isOwn) why='';
    else if(st && st!=='available') why='ไม่พร้อมใช้งาน · '+st;
    else if(B.charterOf) why='เหมาลำอยู่แล้ว · '+B.charterOf;
    else if(B.holdOf) why='ถูกกันทั้งลำไว้แล้ว';
    else if(B.pax>0) why='มีใบจองแล้ว '+B.pax+' ที่';
    else if(B.cellBooked>0) why='มีที่นั่งขายแล้ว '+B.cellBooked+' ที่';
    else if(B.short>0) why='ทริปขายไปแล้ว '+B.sold+' ที่ · เอาลำนี้ออกจะขาด '+B.short+' ที่';
    out.push({ id:b.id, name:b.name||b.id, cap:bookingV2BoatCapOn(b.id,date), pier:b.pier||'', ok:!why, why:why, blockers:B, own:isOwn });
  });
  out.sort((a,b)=> ((a.own?0:1)-(b.own?0:1)) || (a.ok===b.ok ? (b.cap-a.cap) : (a.ok?-1:1)));
  return out;
}
