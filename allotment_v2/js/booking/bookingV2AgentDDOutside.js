function bookingV2AgentDDOutside(e){
  const dd = document.getElementById('bkv2-agent-dd');
  const inp = document.getElementById('bkv2-agent-input');
  if(!dd || !inp) return;
  if(dd.contains(e.target) || inp === e.target) return;
  bookingV2AgentDDHide();
}
