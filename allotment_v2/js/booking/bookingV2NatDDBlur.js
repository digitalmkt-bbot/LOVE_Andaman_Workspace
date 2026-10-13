// On blur · auto-match typed text to a code OR restore to saved value
function bookingV2NatDDBlur(key){
  // Defer so pick (mousedown on item) wins
  setTimeout(() => {
    const ids = bookingV2NatDDIds(key);
    const inp = document.getElementById(ids.inp);
    if(!inp) return;
    const typed = String(inp.value||'').trim().toLowerCase();
    let savedCode = null;
    if(key === 'lead'){
      savedCode = _bkV2.newBooking?.leadNationality||'';
    } else if(/^p\d+$/.test(key)){
      const i = parseInt(key.slice(1), 10);
      savedCode = _bkV2.newBooking?.passengers?.[i]?.nationality||'';
    }
    if(!typed){
      // Cleared · save empty
      if(savedCode){
        if(key === 'lead') bookingV2SetBookingField('leadNationality', '');
        else if(/^p\d+$/.test(key)) bookingV2SetPassenger(parseInt(key.slice(1),10), 'nationality', '');
      }
      return;
    }
    // Try exact match (built-in + custom)
    const match = bookingV2AllNats().find(n =>
      (n.name + ' · ' + n.code).toLowerCase() === typed ||
      n.name.toLowerCase() === typed ||
      n.code.toLowerCase() === typed
    );
    if(match){
      if(match.code !== savedCode) bookingV2NatDDPick(key, match.code);
    } else {
      // Not in list → DO NOT auto-create. Revert to saved value.
      // To add a new nationality, user must click the "+ Add ..." row in the dropdown.
      if(savedCode) inp.value = bookingV2NatDDLabel(savedCode);
      else inp.value = '';
    }
  }, 180);
}
