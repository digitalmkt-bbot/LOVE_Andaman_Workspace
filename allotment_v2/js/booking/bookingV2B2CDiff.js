function bookingV2B2CDiff(snap, now){
  var out=[]; if(!snap) return out;
  Object.keys(BKV2_B2C_OWN).forEach(function(k){
    var a=snap[k], b=now?now[k]:undefined;
    if(String(a==null?'':a) !== String(b==null?'':b)) out.push(BKV2_B2C_OWN[k]);
  });
  return out;
}
