function bookingV2SetSort(k){ _bkV2.sort = k; _bkV2.page = 1; try{ localStorage.setItem('la_bkSort', k); }catch(_){} bookingV2Render(); }
