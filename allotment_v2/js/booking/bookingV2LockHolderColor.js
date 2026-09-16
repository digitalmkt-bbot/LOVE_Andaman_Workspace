// §lkOverview · สีประจำผู้ถือล็อก · เอเจ้นใช้สีเดียวกับหน้าอื่นทั้งระบบ
function bookingV2LockHolderColor(l){
  if(!l) return '#9C9C95';
  if(l.holderType==='agent' && l.holderId && typeof bookingV2AgentColor==='function') return bookingV2AgentColor(l.holderId);
  if(l.holderType==='office') return '#64748B';
  if(l.holderType==='global') return '#8A6A0B';
  return '#9C9C95';
}
