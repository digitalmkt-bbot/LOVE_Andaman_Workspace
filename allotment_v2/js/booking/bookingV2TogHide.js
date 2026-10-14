function bookingV2TogHide(force){
  var pop = document.getElementById('t2-tog-pop'); if(!pop) return;
  clearTimeout(_bkV2TogT);
  if(force){ _bkV2TogPin = false; pop.style.display = 'none'; return; }
  if(_bkV2TogPin) return;
  _bkV2TogT = setTimeout(function(){ pop.style.display = 'none'; }, 180);
}
