function bookingV2ZonePickZone(z){
  const st=window._bkV2ZonePick; if(!st) return;
  st.zone=z||'';
  document.querySelectorAll('#bkv2-zonepick-chips .zpk-chip').forEach(b=>{
    const on=b.dataset.z===st.zone, c=b.dataset.c;
    b.style.background=on?c:'#fff'; b.style.color=on?'#fff':c;
  });
  bookingV2ZonePickFilter();
}
