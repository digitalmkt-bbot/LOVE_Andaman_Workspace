function bookingV2AllergyRemove(i){ const sm=_bkV2.newBooking&&_bkV2.newBooking.specialMeals; if(!sm||!Array.isArray(sm.allergyList))return; sm.allergyList.splice(i,1); bookingV2Render(); }
