function bookingV2AllNats(){ return BKV2_NATIONALITIES.filter(n=>n.code!=='OTHER').concat(SB_CUSTOM_NATIONALITIES, [{code:'OTHER',name:'Other'}]); }
