function bookingV2NbRefreshSide(){
  if(_bkV2NbSideRaf) return;
  var go=function(){ _bkV2NbSideRaf=0; try{
    if(!_bkV2.newBooking) return;
    var c=document.getElementById('nbf-checks-slot');
    if(c && typeof bkNbfChecksHtml==='function') c.innerHTML=bkNbfChecksHtml();
    var b=document.getElementById('nbf-submit-slot');
    if(b && typeof bookingV2RenderSubmitButton==='function') b.innerHTML=bookingV2RenderSubmitButton();
    var st=document.querySelector('.nbf-steps');
    if(st && typeof bkNbfStepsHtml==='function') st.innerHTML=bkNbfStepsHtml();
  }catch(e){ console.warn('nbSideLive refresh failed', e); } };
  try{ _bkV2NbSideRaf=requestAnimationFrame(go); }catch(_){ go(); }
}
