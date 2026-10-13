function bookingV2B2CSnap(bk){
  var o={}; Object.keys(BKV2_B2C_OWN).forEach(function(k){ o[k]=(bk?bk[k]:undefined); }); return o;
}
