function bookingV2PaySlipBtn(bkId){
  const b=(SB_BOOKINGS||[]).find(x=>x.id===bkId); const n=laPaySlips(b).length;   /* §tsPenFile · ไม่นับหลักฐานค่าปรับ */
  return `<button onclick="bookingV2PaySlipsOpen('${bkId}')" title="ดู / แนบ / ลบสลิปการชำระของใบนี้" style="background:${n?'#fff':'#F6FAFE'};border:1px solid ${n?'var(--fd-line)':'#CFE0EF'};color:${n?'var(--fd-ink)':'#185FA5'};font-family:inherit;font-size:12px;font-weight:600;padding:9px 14px;border-radius:9px;cursor:pointer">&#128206; สลิป${n?(' ('+n+')'):' · แนบ'}</button>`;
}
