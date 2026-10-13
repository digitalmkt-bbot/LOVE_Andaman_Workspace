function bookingV2AgentDDShow(){
  const dd = document.getElementById('bkv2-agent-dd');
  const inp = document.getElementById('bkv2-agent-input');
  if(!dd || !inp) return;
  _bkV2AgentDDActive = -1;
  bookingV2AgentDDRender(inp.value);
  dd.classList.add('open');
  setTimeout(() => document.addEventListener('mousedown', bookingV2AgentDDOutside), 0);
}
