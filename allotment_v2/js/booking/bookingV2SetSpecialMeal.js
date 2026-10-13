function bookingV2SetSpecialMeal(key, val){
  if(!_bkV2.newBooking) return;
  if(!_bkV2.newBooking.specialMeals) _bkV2.newBooking.specialMeals = { veg:0, vegan:0, halal:0, allergies:'' };
  _bkV2.newBooking.specialMeals[key] = val;
  if(key === 'allergies') return; // text · skip re-render
  bookingV2Render();
}
