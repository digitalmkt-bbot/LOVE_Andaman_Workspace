/* §b2bPromo · ตัวเดิม · ตอนนี้ไม่มีใครในโค้ดเรียกแล้ว (bookingV2GetRTForTrip กับ tsNetOf
   ย้ายไปใช้ laPromoRateFor หมด) แต่คงชื่อไว้เผื่อสคริปต์ตรวจ/คอนโซลที่เคยเรียก
   ให้เดินผ่านตัวใหม่ จะได้ไม่มีสองกติกาให้เพี้ยนกันทีหลัง
   ⚠ คืนได้แต่ rateTypeId · ใบโปรที่กรอกราคาเองไม่มี id ให้คืน จึงคืน null
     ห้ามเอาตัวนี้ไปใช้ตัดสินราคาอีก · ใช้ laPromoRateFor แทน */
function bookingV2ResolveRateType(agentId, routeId, travelDate, bookDate){
  var c = laPromoFor(agentId, routeId, travelDate, bookDate || '');
  if(!c || (c.priceMode || 'rate') === 'own') return null;
  return c.rateTypeId || null;
}
