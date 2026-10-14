/* ป้ายกลุ่มวัน · relative=true → วันนี้/เมื่อวาน ก่อน แล้วค่อยเป็นวันที่ */
function bookingV2DayLabel(k, relative){
  if(!k) return '<i>ไม่ระบุวัน</i>';
  const today = bookingV2LocalYMD(new Date()), yest = bookingV2LocalYMD(new Date(Date.now() - 86400000));
  const base = (relative && k === today) ? 'วันนี้' : (relative && k === yest) ? 'เมื่อวาน' : bookingV2FmtDate(k);
  return `${base} <i>&middot; ${bookingV2Dow(k)}${(relative && (k===today||k===yest)) ? ' ' + bookingV2FmtDate(k) : ''}</i>`;
}
