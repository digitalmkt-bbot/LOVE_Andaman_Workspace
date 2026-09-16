function bookingV2ToggleMealOn(key, on){
  if(!_bkV2.newBooking) return;
  if(!_bkV2.newBooking.specialMeals) _bkV2.newBooking.specialMeals = { veg:0, vegan:0, halal:0, allergies:'' };
  const room=_bkV2MealRoom(key);
  _bkV2.newBooking.specialMeals[key] = on ? Math.min(Math.max(1, _bkV2.newBooking.specialMeals[key] || 0), room) : 0;
  bookingV2Render();
}
