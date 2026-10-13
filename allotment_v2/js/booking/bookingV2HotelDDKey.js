function bookingV2HotelDDKey(e){
  var dd=document.getElementById('bkv2-hotel-dd'); if(!dd) return;
  if(e.key==='ArrowDown'){ e.preventDefault(); if(!dd.classList.contains('open')) bookingV2HotelDDShow(); var it=dd.querySelectorAll('.bkv2-nb-dd-item'); _bkV2HotelDDActive=Math.min(_bkV2HotelDDActive+1, it.length-1); it.forEach(function(el,i){el.classList.toggle('active',i===_bkV2HotelDDActive);}); if(it[_bkV2HotelDDActive]) it[_bkV2HotelDDActive].scrollIntoView({block:'nearest'}); }
  else if(e.key==='ArrowUp'){ e.preventDefault(); var it=dd.querySelectorAll('.bkv2-nb-dd-item'); _bkV2HotelDDActive=Math.max(_bkV2HotelDDActive-1,0); it.forEach(function(el,i){el.classList.toggle('active',i===_bkV2HotelDDActive);}); if(it[_bkV2HotelDDActive]) it[_bkV2HotelDDActive].scrollIntoView({block:'nearest'}); }
  else if(e.key==='Enter'){ var it=dd.querySelectorAll('.bkv2-nb-dd-item'); var t=it[_bkV2HotelDDActive]; if(t){ e.preventDefault(); bookingV2HotelDDPick(t.dataset.label); } }
  else if(e.key==='Escape'){ bookingV2HotelDDHide(); }
}
