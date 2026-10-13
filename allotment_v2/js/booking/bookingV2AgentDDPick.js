function bookingV2AgentDDPick(label){
  const inp = document.getElementById('bkv2-agent-input');
  if(inp) inp.value = label;
  bookingV2AgentDDHide();
  bookingV2PickAgentByText(label);
}
