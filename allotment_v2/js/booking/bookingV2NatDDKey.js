function bookingV2NatDDKey(e, key){
  const ids = bookingV2NatDDIds(key);
  const dd  = document.getElementById(ids.dd);
  if(!dd) return;
  if(e.key === 'ArrowDown'){
    e.preventDefault();
    if(!dd.classList.contains('open')) bookingV2NatDDShow(key);
    const items = dd.querySelectorAll('.bkv2-nb-dd-item');
    _bkV2NatDDActive = Math.min(_bkV2NatDDActive + 1, items.length - 1);
    items.forEach((el, i) => el.classList.toggle('active', i === _bkV2NatDDActive));
    if(items[_bkV2NatDDActive]) items[_bkV2NatDDActive].scrollIntoView({block:'nearest'});
  } else if(e.key === 'ArrowUp'){
    e.preventDefault();
    const items = dd.querySelectorAll('.bkv2-nb-dd-item');
    _bkV2NatDDActive = Math.max(_bkV2NatDDActive - 1, 0);
    items.forEach((el, i) => el.classList.toggle('active', i === _bkV2NatDDActive));
    if(items[_bkV2NatDDActive]) items[_bkV2NatDDActive].scrollIntoView({block:'nearest'});
  } else if(e.key === 'Enter'){
    e.preventDefault();
    const items = dd.querySelectorAll('.bkv2-nb-dd-item');
    const target = items[_bkV2NatDDActive] || items[0];
    if(target) bookingV2NatDDPick(key, target.dataset.code);
  } else if(e.key === 'Escape'){
    bookingV2NatDDHide();
  }
}
