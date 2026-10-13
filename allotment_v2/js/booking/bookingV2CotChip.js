// Cash-on-Tour chip for the Pay column · from structured cashOnTour OR a "cash on tour ..." line in notes
function bookingV2CotChip(bk, noteTxt){
  let amt=null, cur='THB', found=false, cleaned=noteTxt||'';
  if(bk.cashOnTour && (bk.cashOnTour.amount||0)>0){ amt=bk.cashOnTour.amount; cur=bk.cashOnTour.currency||'THB'; found=true; }
  else if(noteTxt && /cash\s*on\s*tour|(^|\s)cot(\s|$|\b)/i.test(noteTxt)){
    found=true;
    const parts=String(noteTxt).split(/\s*(?:·|\n|;|\|)\s*/).filter(Boolean);
    const keep=[]; let cotPart='';
    parts.forEach(p=>{ if(/cash\s*on\s*tour|(^|\s)cot(\s|$|\b)/i.test(p)) cotPart=p; else keep.push(p); });
    cleaned=keep.join(' · ');
    const mm=(cotPart.match(/([\d,]+(?:\.\d+)?)/)||[])[1]; if(mm) amt=parseFloat(mm.replace(/,/g,''));
  }
  if(!found) return {chip:'', note:noteTxt||''};
  const sym = (cur==='THB'||cur==='฿') ? '฿' : (cur+' ');
  const label = (amt!=null) ? `COT ${sym}${Number(amt).toLocaleString()}` : 'COT';
  return {chip:`<span class="t2-cot" title="Cash on tour · เก็บเงินสดวันเดินทาง">${label}</span>`, note:cleaned};
}
