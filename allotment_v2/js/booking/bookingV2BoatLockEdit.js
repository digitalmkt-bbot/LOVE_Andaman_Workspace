/* ══ §bkLockEdit (2026-10-02) · แก้ใบล็อกเรือทั้งลำ ═══════════════════════════════
   ที่มา · ผู้ใช้ขอเอง · "สามารถแก้ไขได้ + มีรายละเอียดที่ใส่หมายเหตุได้ แต่ไม่โชว์"
   ของเดิมสร้างแล้วแก้ไม่ได้เลย พิมพ์ชื่อเอเยนต์ผิดหรือเลื่อนวันหมดอายุ ต้องปล่อยลำแล้วสร้างใหม่
   ซึ่งระหว่างนั้นเรือกลับเข้าพูลขายที่นั่ง · คนอื่นจองแทรกได้ในช่องว่างนั้น

   ด่านอยู่ชั้นนี้ทั้งหมด ไม่ใช่ชั้นฟอร์ม · เหตุผลเดียวกับตอนสร้าง
   ย้ายวัน/ย้ายลำ = ช่องเดิมกลับเป็นรอบปกติ ช่องใหม่ถูกจับ ในจังหวะเดียว
   ถ้าช่องใหม่จับไม่ได้ ต้องคืนช่องเดิมให้ครบ ห้ามจบแบบใบลอยไม่มีช่อง              */
function bookingV2BoatLockEdit(id, p){
  const l = bookingV2BoatLockById(id);
  if(!l || l.status!=='active') return { ok:false, why:'inactive' };
  p = p || {};
  const nRoute = (p.routeId!=null && p.routeId!=='') ? p.routeId : l.routeId;
  const nDate  = p.date   || l.date;
  const nBoat  = p.boatId || l.boatId;
  const nExp   = (p.expiry!=null) ? p.expiry : (l.expiry||'');
  const nMin   = (p.minCap!=null) ? Math.max(0, parseInt(p.minCap,10)||0) : bookingV2BoatLockMinCap(l);
  const nFixed = (p.fixed!=null) ? (p.fixed!==false) : bookingV2BoatLockFixed(l);
  const nHT    = p.holderType || l.holderType || 'office';
  const nHI    = (p.holderType!=null) ? (nHT==='agent' ? (p.holderId||null) : null) : (l.holderId||null);
  const nNote  = (p.reason!=null) ? String(p.reason) : (l.reason||'');
  if(typeof laIsLandRoute==='function' && laIsLandRoute(nRoute)) return { ok:false, why:'land' };
  if(!nExp) return { ok:false, why:'expiry' };
  if(nExp > nDate) return { ok:false, why:'expiry-late' };
  if(nMin<=0) return { ok:false, why:'min' };
  if(nHT==='agent' && !nHI) return { ok:false, why:'holder' };
  const moved = (nDate!==l.date) || (nBoat!==l.boatId);
  if(moved && !bookingV2BoatLockCanTake(nDate, nBoat, nRoute, l.id)) return { ok:false, why:'taken' };
  /* สัญญา "เรือ 1 ลำ ไม่น้อยกว่า X ที่" · ลำที่ถืออยู่ต้องไม่เล็กกว่าที่รับปาก */
  if(!nFixed && bookingV2BoatCapOn(nBoat, nDate) < nMin) return { ok:false, why:'small' };
  const ch = [];
  const note = (k,a,b)=>{ if(String(a==null?'':a)!==String(b==null?'':b)) ch.push(k+': '+(a==null||a===''?'-':a)+' → '+(b==null||b===''?'-':b)); };
  note('route', l.routeId, nRoute); note('date', l.date, nDate);
  note('boat', bookingV2BoatNameOf(l.boatId), bookingV2BoatNameOf(nBoat));
  note('expiry', l.expiry, nExp); note('min', bookingV2BoatLockMinCap(l), nMin);
  note('deal', bookingV2BoatLockFixed(l)?'fixed':'any', nFixed?'fixed':'any');
  note('holder', (l.holderType||'')+':'+(l.holderId||''), nHT+':'+(nHI||''));
  note('note', l.reason, nNote);
  if(!ch.length) return { ok:true, changed:[] };
  if(moved || nRoute!==l.routeId){
    const was = { routeId:l.routeId, date:l.date, boatId:l.boatId };
    bookingV2BoatLockCellClear(l);
    l.routeId = nRoute; l.date = nDate; l.boatId = nBoat;
    if(!bookingV2BoatLockCellSet(l)){
      l.routeId = was.routeId; l.date = was.date; l.boatId = was.boatId;
      bookingV2BoatLockCellSet(l);
      return { ok:false, why:'taken' };
    }
  }
  l.expiry = nExp; l.qty = nMin; l.subName = nFixed ? 'fixed' : 'any';
  l.holderType = nHT; l.holderId = nHI; l.reason = nNote;
  const today=(typeof bookingV2LocalYMD==='function')?bookingV2LocalYMD(new Date()):new Date().toISOString().slice(0,10);
  (l.log=l.log||[]).push({date:today, at:new Date().toISOString(), type:'edit', note:ch.join(' · '), by:laBy()});
  sbSeatLocksPersist(); _bkLockSaveOps();
  return { ok:true, changed:ch };
}
