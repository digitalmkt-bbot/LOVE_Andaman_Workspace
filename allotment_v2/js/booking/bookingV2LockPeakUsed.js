// จำนวนที่ดึงไปมากที่สุดในรอบเดียว · ใช้เป็นพื้นเวลาลดจำนวน (ห้ามลดต่ำกว่าที่ขายไปแล้ว)
function bookingV2LockPeakUsed(l){
  if(!l) return 0;
  if(!bookingV2LockSpansDays(l)) return Number(l.used)||0;
  const m=l.usedBy||{}; let mx=0;
  Object.keys(m).forEach(k=>{ const v=Number(m[k])||0; if(v>mx) mx=v; });
  return mx;
}
