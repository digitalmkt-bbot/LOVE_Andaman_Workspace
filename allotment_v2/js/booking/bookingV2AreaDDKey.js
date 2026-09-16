function bookingV2AreaDDKey(e, kind){
  const dd = document.getElementById('bkv2-area-dd-' + kind);
  if(!dd) return;
  if(e.key === 'ArrowDown'){ e.preventDefault(); if(!dd.classList.contains('open')) bookingV2AreaDDShow(kind); const items = dd.querySelectorAll('.bkv2-nb-dd-item'); _bkV2AreaDDActive = Math.min(_bkV2AreaDDActive + 1, items.length - 1); items.forEach((el, i) => el.classList.toggle('active', i === _bkV2AreaDDActive)); items[_bkV2AreaDDActive]?.scrollIntoView({block:'nearest'}); }
  else if(e.key === 'ArrowUp'){ e.preventDefault(); const items = dd.querySelectorAll('.bkv2-nb-dd-item'); _bkV2AreaDDActive = Math.max(_bkV2AreaDDActive - 1, 0); items.forEach((el, i) => el.classList.toggle('active', i === _bkV2AreaDDActive)); items[_bkV2AreaDDActive]?.scrollIntoView({block:'nearest'}); }
  else if(e.key === 'Enter'){ e.preventDefault(); const items = dd.querySelectorAll('.bkv2-nb-dd-item'); const target = items[_bkV2AreaDDActive] || items[0]; if(target) bookingV2AreaDDPick(kind, target.dataset.label); }
  else if(e.key === 'Escape'){ bookingV2AreaDDHide(); }
}
