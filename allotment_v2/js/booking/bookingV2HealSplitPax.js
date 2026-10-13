// §self-heal · split ที่ headcount กับ breakdown ไม่ตรงกัน (ของเสียจากบั๊ก "แยกซ้ำ" ก่อนหน้า)
// กติกา: เชื่อ headcount (pax) ของแต่ละก้อน — เป็นตัวเลขที่คนจัดรถตั้งใจใส่ — แล้วแจก
// ประเภทใหม่จากยอดจริงของบุ๊กกิ้ง โดยไล่ผู้ใหญ่ให้ก้อนที่แยกออกไปก่อน เด็ก/ทารกจึงเกาะกลุ่มหลักไว้
/* §per-trip ops · รับ ops block มาตรงๆ (ค่าเริ่มต้น = b.ops = วันแรก) เพื่อให้ซ่อม split ของวันที่ 2 ได้ด้วย */
function bookingV2HealSplitPax(b, ops){
  const _o = ops || (b && b.ops);
  const sp = (_o && Array.isArray(_o.vanSplits)) ? _o.vanSplits : null;
  if(!sp || !sp.length) return false;
  let pool={ad:0,chd:0,inf:0,foc:0};
  (b.trips||[]).forEach(t=>{ const p=bkPaxOfTrip(t); if(bkPaxSum(p)>bkPaxSum(pool)) pool=p; });
  if(!bkPaxSum(pool)) return false;
  const sum = sp.reduce((a,s)=>bkPaxAdd(a,bkSplitPax(s)), {ad:0,chd:0,inf:0,foc:0});
  if(PAX_K.every(k=>sum[k]===pool[k])) return false;          // ตรงอยู่แล้ว ไม่ต้องยุ่ง
  let left = Object.assign({}, pool);
  for(let i=sp.length-1; i>=1; i--){                          // ก้อนที่แยกออกไป: ผู้ใหญ่ก่อน
    const take = bkPaxTake(left, Math.max(0, parseInt(sp[i].pax)||0));
    Object.assign(sp[i], take); sp[i].pax = bkPaxSum(take);
    left = bkPaxSub(left, take);
  }
  Object.assign(sp[0], left); sp[0].pax = bkPaxSum(left);     // ก้อนหลักรับส่วนที่เหลือทั้งหมด
  // ...แล้วเกลี่ยไม่ให้มีคันไหนมีเด็ก/ทารกแต่ไม่มีผู้ใหญ่เลย · สลับ 1:1 กับคันที่มีผู้ใหญ่เหลือ
  // (headcount ของทุกก้อนไม่เปลี่ยน — แค่สลับประเภทกัน)
  for(let i=0;i<sp.length;i++){
    let guard=0;
    while(guard++ < 20){
      const a=bkSplitPax(sp[i]);
      if(!((a.chd+a.inf)>0 && a.ad===0)) break;
      const j=sp.findIndex((s,k)=>k!==i && bkSplitPax(s).ad>=2);
      if(j<0) break;                                          // ไม่มีผู้ใหญ่ให้ยืม — เตือนไว้ในใบงานแทน
      const d=bkSplitPax(sp[j]); const kind = a.chd>0 ? 'chd' : 'inf';
      a.ad++; a[kind]--; d.ad--; d[kind]++;
      Object.assign(sp[i], a); Object.assign(sp[j], d);
    }
  }
  return true;
}
