/* ย้ายเข้าช่อง Diet · จำนวนไม่เกินหัวที่จอง · ส่วนที่เกินชื่อประเภทอาหาร (เช่น "+ไข่") เก็บลงโน้ตให้ครัวอ่าน */
function bookingV2DietFromText(key,name,qty){ const sm=_bkV2EnsureSM(); if(!sm||!key) return;
  const room=(typeof _bkV2MealRoom==='function')?_bkV2MealRoom(key):99;
  let _v=(+sm[key]||0)+Math.max(1,Math.floor(+qty||1)); if(room>0) _v=Math.min(_v,room);   /* ยังไม่ใส่จำนวนคน (room 0) · เก็บตามที่พิมพ์ ไม่ทิ้ง */
  sm[key]=_v;
  const rem=String(name||'').replace(/มังสวิรัติ|มังฯ|มัง|vegetarian|veggie|vegan|veg|วีแกน|ฮาลาล|halal|มุสลิม|อิสลาม|muslim|ทาน|กิน|อาหาร|เจ|คน|ท่าน|[\s\d×x+\-·,.]/gi,'');
  if(rem){ const cur=String(sm.allergies||'').trim(); const nm=String(name).trim(); if(cur.indexOf(nm)<0) sm.allergies=[cur,nm].filter(Boolean).join(' \u00b7 '); }
  const ne=document.getElementById('bkv2-allerg-name'); if(ne) ne.value='';
  bookingV2Render(); }
