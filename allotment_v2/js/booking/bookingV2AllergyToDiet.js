function bookingV2AllergyToDiet(i){ const sm=_bkV2.newBooking&&_bkV2.newBooking.specialMeals; if(!sm||!Array.isArray(sm.allergyList)||!sm.allergyList[i]) return;
  const a=sm.allergyList[i], k=bookingV2DietKeyOf(a.name); if(!k) return; sm.allergyList.splice(i,1); bookingV2DietFromText(k,a.name,a.qty); }
