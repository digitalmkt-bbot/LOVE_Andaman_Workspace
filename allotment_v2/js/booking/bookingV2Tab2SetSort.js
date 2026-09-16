function bookingV2Tab2SetSort(col){ if(_bkV2T2Sort.col===col){ _bkV2T2Sort.dir = _bkV2T2Sort.dir==='asc'?'desc':'asc'; } else { _bkV2T2Sort = {col, dir:'asc'}; } bookingV2Render(); }
