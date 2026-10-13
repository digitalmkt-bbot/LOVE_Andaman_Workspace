function bookingV2AgentDDHide(){
  const dd = document.getElementById('bkv2-agent-dd');
  if(dd) dd.classList.remove('open');
  document.removeEventListener('mousedown', bookingV2AgentDDOutside);
}
