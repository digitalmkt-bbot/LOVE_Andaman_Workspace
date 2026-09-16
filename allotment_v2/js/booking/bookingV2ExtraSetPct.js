// §pierDecimal · เก็บสตริงที่พิมพ์ · เกิน 5% ค่อยตัดลงเป็น 5 (กติกาเดิม)
function bookingV2ExtraSetPct(v){
  var t=(typeof pckNumStr==='function')?pckNumStr(v):String(v||'');
  _bkExtraPay.feePct = ((+t||0)>5) ? '5' : t;
  bookingV2ExtraPayRender();
}
