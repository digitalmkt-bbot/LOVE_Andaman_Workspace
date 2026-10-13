function bookingV2BumpSpecialMeal(key, delta){
  if(!_bkV2.newBooking) return;
  if(!_bkV2.newBooking.specialMeals) _bkV2.newBooking.specialMeals = { veg:0, vegan:0, halal:0, allergies:'' };
  const room=_bkV2MealRoom(key);
  const next=Math.max(0, (_bkV2.newBooking.specialMeals[key]||0) + delta);
  _bkV2.newBooking.specialMeals[key] = Math.min(next, room);   // cannot exceed booking pax
  bookingV2Render();
}
