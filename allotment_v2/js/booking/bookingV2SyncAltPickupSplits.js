// §altPickups phase-2 · auto-build vanSplits from altPickups so each pickup point becomes its own
// allocation (same booking · can ride a DIFFERENT van). Split[0] = main pickup (Lead), split[i] = each
// alt pickup carrying its own pickup location (pickAreaId/pickHotel/pickZone/altWho). Van/group assignments
// are preserved across edits by index. Only manages AUTO splits (ops.altSplitAuto) — never touches a manual
// split. Returns true if it changed b.ops. Does NOT persist/re-render (caller does).
function bookingV2SyncAltPickupSplits(b){
  if(!b) return false; b.ops = b.ops || {};
  /* §altDrop · รายการที่ "รับที่เดิมแต่ส่งคนละที่" ไม่มีจุดรับของตัวเอง
     เงื่อนไขเดิมจะคัดทิ้ง ต้องรับเข้ามาด้วย ไม่งั้นแยกส่งอย่างเดียวไม่ได้เลย */
  const alt = Array.isArray(b.altPickups) ? b.altPickups.filter(a=>a && bkPaxSum(bkAltPax(a))>0
      && ((a.place||'').trim()||a.areaId||(a.who||'').trim()||bkAltHasDrop(a))) : [];
  const hc = (b.trips||[]).reduce((m,t)=>Math.max(m,(typeof bookingV2PaxAllTot==='function'?bookingV2PaxAllTot(t.pax||{}):0)),0);
  const altTot = alt.reduce((s,a)=>s+bkPaxSum(bkAltPax(a)),0);
  // ยอดของบุ๊กกิ้งแยกตามประเภท (เอาทริปที่คนเยอะสุด — แขกกลุ่มเดียวกันทุกทริป)
  let _bkPax={ad:0,chd:0,inf:0,foc:0};
  (b.trips||[]).forEach(t=>{ const p=bkPaxOfTrip(t); if(bkPaxSum(p)>bkPaxSum(_bkPax)) _bkPax=p; });
  const cur = Array.isArray(b.ops.vanSplits) ? b.ops.vanSplits : [];
  // respect a MANUAL split (not auto) — leave it alone
  if(cur.length && !_bkV2IsAltAutoSplit(b)) return false;   // ops.altSplitAuto ไม่ถูก map ลง DB — ต้องดูจาก marker ใน vanSplits
  // no usable alt pickups (or they overflow the group) → collapse any auto split back to a single row
  if(!alt.length || altTot>=hc || hc<2){
    if(cur.length && _bkV2IsAltAutoSplit(b)){
      const f=cur[0]||{}; b.ops.vanGroup=+f.vanGroup||0; b.ops.vanId=f.vanId||null; b.ops.vanReturnId=f.vanReturnId||null;
      delete b.ops.vanSplits; delete b.ops.altSplitAuto; return true;
    }
    return false;
  }
  const mainQty = hc - altTot;
  // seed van assignments: from existing splits (by index) else from the flat ops fields (main)
  const old = cur.length ? cur : [{vanGroup:+b.ops.vanGroup||0, vanId:b.ops.vanId||null, vanReturnId:b.ops.vanReturnId||null, vanSeq:+b.ops.vanSeq||0}];
  const o0 = old[0]||{};
  // จุดรับหลัก = ยอดบุ๊กกิ้ง ลบ ทุกจุดรับเพิ่ม · หักทีละประเภท เด็ก/ทารกจึงไม่ถูกแปลงเป็นผู้ใหญ่
  const _altSum = alt.reduce((acc,a)=>bkPaxAdd(acc, bkAltPax(a)), {ad:0,chd:0,inf:0,foc:0});
  const _mainPax = bkPaxSub(_bkPax, _altSum);
  const splits = [Object.assign({ pax:mainQty, vanGroup:+o0.vanGroup||0, vanId:o0.vanId||null, vanReturnId:o0.vanReturnId||null, vanSeq:+o0.vanSeq||0, main:true }, _mainPax)];
  alt.forEach((a,i)=>{ const _p=bkAltPax(a);
    /* §altDrop · แถวที่ "รับที่เดิม แต่ส่งคนละที่" ขาไปนั่งรถคันเดียวกับกลุ่มหลักแน่นอน
       ต้องสืบรถ/กลุ่ม/ลำดับจากกลุ่มหลักให้เลย ไม่งั้นตกจากใบงานขาไปทั้งแถว
       ส่วนแถวที่รับคนละที่จริง ปล่อยว่างไว้เหมือนเดิม · คนจัดรถต้องเป็นคนเลือกเอง */
    const _ownPick = !!((a.place||'').trim() || a.areaId);
    const o = old[i+1] || (_ownPick ? {} : {
      vanGroup:+o0.vanGroup||0, vanId:o0.vanId||null,
      vanReturnId:o0.vanReturnId||null, vanSeq:+o0.vanSeq||0 });
    /* §altDrop · จุดส่งของแถวนี้ · ใส่เฉพาะตอนตั้งเอง เพื่อให้ bkDropOf ถอยไปใช้ของทั้งใบได้ */
    const _d = bkAltHasDrop(a)
      ? { dropAreaId:a.dropAreaId||'', dropHotel:(a.dropPlace||'').trim(), dropZone:a.dropZone||'' }
      : {};
    splits.push(Object.assign({ pax:Math.max(1,bkPaxSum(_p)), vanGroup:+o.vanGroup||0, vanId:o.vanId||null, vanReturnId:o.vanReturnId||null, vanSeq:+o.vanSeq||0, fromAlt:true, pickAreaId:a.areaId||'', pickHotel:(a.place||'').trim(), pickZone:a.zone||'', altWho:(a.who||'').trim() }, _d, _p)); });
  b.ops.vanSplits = splits; b.ops.altSplitAuto = true;
  delete b.ops.vanGroup; delete b.ops.vanId;   // main now lives in split[0]
  return true;
}
