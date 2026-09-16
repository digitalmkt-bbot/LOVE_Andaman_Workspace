function bookingV2NatDDAddNew(key){
  const inp = document.getElementById(bookingV2NatDDIds(key).inp);
  if(!inp) return;
  const code = bookingV2AddCustomNat(String(inp.value||'').trim());
  if(code){ bookingV2NatDDPick(key, code); }
  else { alert('Nationality name too short - type at least 2 letters'); }
}
