// Click a van card in the VANS strip → scroll to that van's group rows below + brief highlight
function bookingV2ScrollToVan(rid, vid){
  if(!rid || !vid) return;
  try{
    const el=document.getElementById('vg-'+rid+'-'+vid);
    if(!el) return;
    el.scrollIntoView({behavior:'smooth', block:'center'});
    const td=el.querySelector('td'); if(td){ const o=td.style.boxShadow; td.style.transition='box-shadow .15s'; td.style.boxShadow='inset 0 0 0 2px #185FA5, '+(o||'inset 4px 0 0 #185FA5'); setTimeout(()=>{ td.style.boxShadow=o; }, 1300); }
  }catch(e){}
}
