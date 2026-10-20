function bookingV2FamCxlSplit(famId, ds, agg){
  const F=['total','ad','chd','inf','foc','pk','kl','nt'], out={closed:[], cut:{}, all:false, lbl:'', R:null};
  F.forEach(k=>{ out.cut[k]=0; });
  const day=agg && agg.byDate && agg.byDate[ds];
  let boats={}; try{ const T=(typeof TRIPS!=='undefined' && TRIPS[ds])||{}; Object.keys(T).forEach(b=>{ const o=T[b]; if(o && o.route) boats[o.route]=1; }); }catch(_){}
  let n=0, nC=0; const ks={};
  (bookingV2FamilyRoutes(famId)||[]).forEach(rd=>{ const rid=rd.id||rd, cell=day && day.routes && day.routes[rid], C=bookingV2CxlInfo(rid, ds);
    if(!cell && !boats[rid] && !C) return;   /* รอบที่วันนั้นไม่มีใคร ไม่มีเรือ = ไม่นับ */
    n++; if(!C) return; nC++; out.closed.push(rid); ks[C.k]=C; if(cell) F.forEach(k=>{ out.cut[k]+=(+cell[k]||0); }); });
  out.all = n>0 && nC===n;
  const kk=Object.keys(ks);
  if(kk.length){ out.R = kk.length===1 ? ks[kk[0]].R : ((typeof TCX_R!=='undefined' && TCX_R.other) || ks[kk[0]].R); out.lbl = kk.length===1 ? ks[kk[0]].lbl : 'Cancelled'; }
  return out;
}
