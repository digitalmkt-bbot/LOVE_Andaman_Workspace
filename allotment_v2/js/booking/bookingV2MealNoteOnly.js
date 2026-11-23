function bookingV2MealNoteOnly(sm){ if(!sm) return ''; var t=String(sm.allergies||'').trim(); return (t && !bookingV2MealNoteIsAl(sm)) ? t : ''; }
