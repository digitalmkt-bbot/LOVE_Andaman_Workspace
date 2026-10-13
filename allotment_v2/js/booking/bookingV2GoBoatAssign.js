function bookingV2GoBoatAssign(){
  const bnav=[...document.querySelectorAll('.nav-item')].find(n=>n.dataset.view==='booking');
  if(bnav && typeof nav==='function') nav(bnav);
  _bkV2.tab='bytrip'; _bkV2.boatAssignMode=true; _bkV2.vanAssignMode=false; if(typeof bookingV2Render==='function') bookingV2Render();
}
