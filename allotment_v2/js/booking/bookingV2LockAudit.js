/* ตัวนับของล็อก vs ใบจองที่อ้างถึงจริง · diff > 0 = ล็อกกันที่ไว้เกินความจริง (ขายได้น้อยกว่าที่ควร) */
function bookingV2LockAudit(l){
  if(!l) return {used:0, live:0, dead:0, diff:0, claims:[]};
  const cl = bookingV2LockClaims(l.id);
  const live = cl.filter(c=>!c.dead).reduce((s,c)=>s+c.qty,0);
  const dead = cl.filter(c=> c.dead).reduce((s,c)=>s+c.qty,0);
  return { used:Number(l.used)||0, live:live, dead:dead, diff:(Number(l.used)||0)-live, claims:cl };
}
