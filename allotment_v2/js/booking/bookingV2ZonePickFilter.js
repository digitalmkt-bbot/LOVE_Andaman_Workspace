function bookingV2ZonePickFilter(){
  const st=window._bkV2ZonePick||{};
  const q=String((document.getElementById('bkv2-zonepick-q')||{}).value||'').trim().toLowerCase();
  document.querySelectorAll('#bkv2-zonepick-list .zpk-grp').forEach(g=>{
    let any=false;
    if(st.zone && g.dataset.z!==st.zone){ g.style.display='none'; return; }
    g.querySelectorAll('.zpk-row').forEach(r=>{ const ok=!q||r.dataset.n.indexOf(q)>=0; r.style.display=ok?'flex':'none'; if(ok) any=true; });
    g.style.display=any?'':'none';
  });
}
