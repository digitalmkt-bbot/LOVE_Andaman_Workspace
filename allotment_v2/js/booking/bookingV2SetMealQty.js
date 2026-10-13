function bookingV2SetMealQty(key, elOrVal){
  if(!_bkV2.newBooking) return;
  if(!_bkV2.newBooking.specialMeals) _bkV2.newBooking.specialMeals = { veg:0, vegan:0, halal:0, allergies:'' };
  const el=(elOrVal&&typeof elOrVal==='object')?elOrVal:null;
  const raw=el?el.value:elOrVal;
  const room=_bkV2MealRoom(key);
  const v=Math.min(Math.max(0, Math.floor(Number(raw)||0)), room);   // cap at booking pax (headcount − other diets)
  _bkV2.newBooking.specialMeals[key]=v;
  if(el){ if(String(v)!==String(el.value)) el.value=v; el.setAttribute('max', room); el.title='สูงสุด '+room+' (ตามจำนวนที่จอง)'; }
}
