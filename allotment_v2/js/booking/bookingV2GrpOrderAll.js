function bookingV2GrpOrderAll(){
  try{
    var raw=(laBlob()||{}).bkv2_grp_order;
    if(raw===_grpOrdSrc && _grpOrdCache) return _grpOrdCache;
    var o=raw; if(typeof o==='string') o=JSON.parse(o||'{}');
    _grpOrdSrc=raw; _grpOrdCache=(o&&typeof o==='object')?o:{};
    return _grpOrdCache;
  }catch(e){ return {}; }
}
