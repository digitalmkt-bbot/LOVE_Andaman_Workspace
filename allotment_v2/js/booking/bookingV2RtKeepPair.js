/* ชุดเดิมของใบ กับชุดปัจจุบันของเอเยนต์ ณ วันเดินทางของทริปแรก · คนละชุดเมื่อไหร่ต้องบอก */
function bookingV2RtKeepPair(){
  const d = _bkV2 && _bkV2.newBooking, K = d && d._rtKeep;
  if(!K || !d.agentId) return null;
  const t = (d.trips||[]).find(function(x){ return x && x.routeId && x.date; });
  if(!t) return null;
  const kept = bookingV2RtKeptFor(t, true);
  let cur = null; try{ cur = (typeof laMainRtFor==='function') ? laMainRtFor(d.agentId, t.date) : null; }catch(_){}
  return { kept:kept, cur:cur, differ:!!(kept && cur && kept.id!==cur.id) };
}
