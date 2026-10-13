function bookingV2AgentDDFilter(val){
  _bkV2AgentDDActive = -1;
  bookingV2AgentDDRender(val);
  const dd = document.getElementById('bkv2-agent-dd');
  if(dd) dd.classList.add('open');
}
