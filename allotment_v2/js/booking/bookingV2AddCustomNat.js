function bookingV2AddCustomNat(name){
  name = _bkNatClean(name);
  if(!name) return '';
  // Guard: reject names with fewer than 2 letters (e.g. a stray "Q") — prevents junk entries
  if(name.replace(/[^A-Za-z฀-๿]/g,'').length < 2) return '';
  const k = _bkNatNorm(name);
  const ex = bookingV2AllNats().find(n => _bkNatNorm(n.name)===k || n.code.toLowerCase()===name.toLowerCase());
  if(ex) return ex.code;
  let base = (name.replace(/[^A-Za-z]/g,'').toUpperCase().slice(0,3)) || 'CUS';
  let code = base, i=1; const used = new Set(bookingV2AllNats().map(n=>n.code));
  while(used.has(code)){ code = base + (++i); }
  SB_CUSTOM_NATIONALITIES.push({code, name, custom:true});
  sbNationalitiesPersist();
  return code;
}
