// ── Conflict detector · "รถปนกันในกรุ๊ป" ── a van-group (date|route|zone|gid) must use exactly ONE van.
// If members carry 2+ different vanIds the job order routes them to different vans while the group header shows one → wrong sheet / dropped pickup.
// This should be impossible after bookingV2VanGroupSelected/SetVan always write the group's van, but we scan EVERY group on EVERY render as a safety net (legacy data / future code paths). NO auto-pick (per user: ห้ามเดา) — surfaced as a warning to resolve by re-selecting the group van.
// Returns [{date,routeId,zone,gid,routeName,vans:{vanId:count},pax}] · pass a date to scope, omit for all.
function bookingV2VanGroupConflicts(date){
  const isC=b=>['cancelled','rejected','cancelled_weather'].includes(b.status);
  const G={};
  (SB_BOOKINGS||[]).forEach(b=>{ if(isC(b))return; (b.trips||[]).forEach(t=>{ if(date&&(t.date||'')!==date)return; const o=bkOpsRead(b,t.date||''); if(!o)return; const z=(t.bookingMode==='charter')?'__CHARTER__':((typeof bookingV2EffZone==='function'?bookingV2EffZone(b,t):(t.zone||b.pickupZone))||''); if(z==='NoTransfer'||z==='NT')return;   // §per-trip ops · เดิมอ่าน b.ops ทุกวัน → เตือน "รถปนกันในกรุ๊ป" ผิดวัน
    const add=(g,van,pax)=>{ if(!g)return; const k=(t.date||'')+'|'+(t.routeId||'')+'|'+z+'|'+g; const e=G[k]=G[k]||{date:t.date,routeId:t.routeId,zone:z,gid:+g,vans:{},pax:0}; e.pax+=pax||0; if(van){ e.vans[van]=(e.vans[van]||0)+1; } };
    const tp=(typeof bookingV2PaxAllTot==='function')?bookingV2PaxAllTot(t.pax||{}):0;
    if(Array.isArray(o.vanSplits)&&o.vanSplits.length) o.vanSplits.forEach(s=>add(+s.vanGroup||0,s.vanId,+s.pax||0)); else add(+o.vanGroup||0,o.vanId,tp);
  }); });
  const out=[]; Object.keys(G).forEach(k=>{ const e=G[k]; if(Object.keys(e.vans).length>1){ e.routeName=((typeof getRoute==='function'?getRoute(e.routeId):null)||{}).name||e.routeId; out.push(e); } });
  return out;
}
