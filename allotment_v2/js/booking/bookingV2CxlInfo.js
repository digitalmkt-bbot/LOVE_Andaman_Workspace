// Aggregate family pax for a specific date (sum across sub-routes)
/* §calCxlSplit (2026-10-19) · owner "หน้านี้น่าจะอ่านค่าผิดนะ เพราะยกเลิกบางเส้นทาง เพราะไม่ถึงยอด"
   ปฏิทิน Booking (ชิปในช่องวัน + แผงขวา) ขีดฆ่าทั้งโปรแกรมและเขียน "Cancelled (weather)" ทันทีที่ variant ใด variant หนึ่งถูกยกเลิก
   ทั้งที่อีกหลายรอบยังออก (Similan 217 คน ขีดทั้งก้อนเพราะ Early 07.00 ยกเลิก 2 คน) และไม่สนเหตุผลที่บันทึกไว้ (§tripCxl · TCX_R)
   ตอนนี้: ขีดทั้งโปรแกรมเฉพาะเมื่อทุกรอบที่มีของวันนั้นถูกยกเลิก · ไม่งั้นนับเฉพาะรอบที่ยังออก + ป้ายเล็ก "รอบที่ยกเลิก −N"
   ป้ายใช้เหตุผลจริง (Weather / Below break-even / No boat / Other) · ยอดรวมของวันไม่รวมคนในรอบที่ยกเลิก */
function bookingV2CxlInfo(rid, ds){
  if(typeof bookingV2IsWeatherClosed!=='function' || !bookingV2IsWeatherClosed(rid, ds)) return null;
  const k=(typeof tcxReason==='function')?tcxReason(rid,ds):'weather';
  const R=(typeof TCX_R!=='undefined' && TCX_R[k]) || {en:'Weather', th:'อากาศ', ic:'\u2601', fg:'#A32D2D', bg:'#FCEBEB', bd:'#E89A92'};
  return {k, R, lbl:'Cancelled ('+R.en+')'};
}
