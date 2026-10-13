function bookingV2AgentNm(id){
  const a=(typeof SB_AGENTS!=='undefined'?SB_AGENTS:[]).find(x=>x&&x.id===id);
  return a?(a.name||id):(id||'');
}
