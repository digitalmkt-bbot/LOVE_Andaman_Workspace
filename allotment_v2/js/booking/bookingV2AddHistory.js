function bookingV2AddHistory(bk, kind, text, tag){
  if(!bk) return;
  if(!Array.isArray(bk.history)) bk.history=[];
  bk.history.push({at:new Date().toISOString(), kind:kind||'note', text:text||'', tag:tag||'', by:laBy()});
}
