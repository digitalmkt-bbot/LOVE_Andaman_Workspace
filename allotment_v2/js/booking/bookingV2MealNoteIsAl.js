function bookingV2MealNoteIsAl(sm){ if(!sm) return false; var t=String(sm.allergies||'').trim(); if(!t) return false; if(sm.pierAt||sm.pierBy) return true; return BKV2_AL_RE.test(t); }
