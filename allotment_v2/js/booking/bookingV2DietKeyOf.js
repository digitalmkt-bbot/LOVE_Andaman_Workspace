/* ชื่อที่พิมพ์ในช่อง "สิ่งที่แพ้" แต่จริง ๆ เป็นประเภทอาหาร · คืน veg / vegan / halal หรือ '' */
function bookingV2DietKeyOf(name){ var t=String(name||''); if(!t.trim()) return ''; if(/แพ้|allerg/i.test(t)) return '';
  if(/วีแกน|vegan/i.test(t)) return 'vegan';
  if(/ฮาลาล|halal|มุสลิม|อิสลาม|muslim/i.test(t)) return 'halal';
  if(/มังสวิรัติ|มังฯ|ทานมัง|กินมัง|^มัง|vegetarian|veggie|(^|[^a-z])veg([^a-z]|$)|อาหารเจ|กินเจ|ทานเจ/i.test(t)) return 'veg';
  return ''; }
