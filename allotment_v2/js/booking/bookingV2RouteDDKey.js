function bookingV2RouteDDKey(e, idx){
  const dd = document.getElementById('bkv2-route-dd-' + idx);
  if(!dd) return;
  if(e.key === 'ArrowDown'){ e.preventDefault(); if(!dd.classList.contains('open')) bookingV2RouteDDShow(idx); const items = dd.querySelectorAll('.bkv2-nb-dd-item'); _bkV2RouteDDActive = Math.min(_bkV2RouteDDActive + 1, items.length - 1); items.forEach((el, i) => el.classList.toggle('active', i === _bkV2RouteDDActive)); items[_bkV2RouteDDActive]?.scrollIntoView({block:'nearest'}); }
  else if(e.key === 'ArrowUp'){ e.preventDefault(); const items = dd.querySelectorAll('.bkv2-nb-dd-item'); _bkV2RouteDDActive = Math.max(_bkV2RouteDDActive - 1, 0); items.forEach((el, i) => el.classList.toggle('active', i === _bkV2RouteDDActive)); items[_bkV2RouteDDActive]?.scrollIntoView({block:'nearest'}); }
  else if(e.key === 'Enter'){ e.preventDefault(); const items = dd.querySelectorAll('.bkv2-nb-dd-item'); const target = items[_bkV2RouteDDActive] || items[0]; if(target) bookingV2RouteDDPick(idx, target.dataset.label); }
  else if(e.key === 'Escape'){ bookingV2RouteDDHide(); }
}
