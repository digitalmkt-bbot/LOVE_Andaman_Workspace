function bookingV2B2CPending(bk){
  const h=(bk && Array.isArray(bk.history)) ? bk.history : null;
  if(!h || !h.length) return null;
  let from=0;
  for(let i=h.length-1;i>=0;i--){ if(h[i] && h[i].kind==='b2c_seen'){ from=i+1; break; } }
  const ents=h.slice(from).filter(e=>e && (e.kind==='b2c' || e.kind==='b2c_new'));
  if(!ents.length) return null;
  const order=[], chains={}, extras=[];
  let isNew=false, newText='';
  ents.forEach(e=>{
    if(e.kind==='b2c_new'){
      const td=bookingV2B2CTripDate(bk), at=String(e.at||'').slice(0,10);
      const gap=(td && at) ? Math.round((new Date(td+'T00:00')-new Date(at+'T00:00'))/86400000) : 99;
      if(gap<=B2C_CHG_NEW_DAYS){ isNew=true; newText=String(e.text||''); }
      return;
    }
    String(e.text||'').split(' · ').forEach(seg=>{
      const m=/^([^:]+): (.*) → (.*)$/.exec(seg);
      if(!m){ const x=seg.trim(); if(x && extras.indexOf(x)<0) extras.push(x); return; }
      const L=m[1];
      if(!chains[L]){ chains[L]=[m[2]]; order.push(L); }
      const c=chains[L];
      if(c[c.length-1]!==m[2]) c.push(m[2]);
      if(c[c.length-1]!==m[3]) c.push(m[3]);
    });
  });
  const segs=order.map(L=>({label:L, vals:chains[L]})).filter(s=>s.vals.length>1 && s.vals[0]!==s.vals[s.vals.length-1]);
  if(!segs.length && !isNew && !extras.length) return null;
  const last=ents[ents.length-1];
  const st=segs.find(s=>s.label==='Status');
  const cancelled=!!(st && /^Cancel/.test(st.vals[st.vals.length-1]));
  const moved=segs.some(s=>/^Date\b/.test(s.label));
  return {at:last.at||'', segs, extras, isNew:isNew && !segs.length, newText, cancelled, moved, n:ents.length};
}
