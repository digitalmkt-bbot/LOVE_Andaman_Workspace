function bookingV2AgentDDKey(e){
  const dd = document.getElementById('bkv2-agent-dd');
  if(!dd) return;
  if(e.key === 'ArrowDown'){
    e.preventDefault();
    if(!dd.classList.contains('open')) bookingV2AgentDDShow();
    const items = dd.querySelectorAll('.bkv2-nb-dd-item');
    _bkV2AgentDDActive = Math.min((_bkV2AgentDDActive < 0 ? -1 : _bkV2AgentDDActive) + 1, items.length - 1);
    items.forEach((el, i) => el.classList.toggle('active', i === _bkV2AgentDDActive));
    if(items[_bkV2AgentDDActive]) items[_bkV2AgentDDActive].scrollIntoView({block:'nearest'});
  } else if(e.key === 'ArrowUp'){
    e.preventDefault();
    const items = dd.querySelectorAll('.bkv2-nb-dd-item');
    _bkV2AgentDDActive = Math.max(_bkV2AgentDDActive - 1, 0);
    items.forEach((el, i) => el.classList.toggle('active', i === _bkV2AgentDDActive));
    if(items[_bkV2AgentDDActive]) items[_bkV2AgentDDActive].scrollIntoView({block:'nearest'});
  } else if(e.key === 'Enter'){
    e.preventDefault();
    const items = dd.querySelectorAll('.bkv2-nb-dd-item');
    const target = items[_bkV2AgentDDActive] || items[0];
    if(target) bookingV2AgentDDPick(target.dataset.label);
  } else if(e.key === 'Escape'){
    bookingV2AgentDDHide();
  }
}
