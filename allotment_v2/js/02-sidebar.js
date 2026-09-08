
(function(){
  function esc(x){ return String(x==null?'':x).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function initGlassSidebar(){
    var sb=document.querySelector('.sidebar'); if(!sb || sb.querySelector('.sb-profile')) return;
    var me=(window.LA_ME||{}); var nm=(me.name||me.username||'LOVE Andaman');
    var parts=String(nm).trim().split(/\s+/); var initials=((parts[0]||'')[0]||'')+((parts[1]||'')[0]||''); initials=(initials||nm.slice(0,2)||'LA').toUpperCase();
    var hd=document.createElement('div'); hd.className='sb-profile';
    hd.innerHTML='<div class="sb-avatar">'+esc(initials)+'</div><div style="flex:1;min-width:0"><div class="sb-greet">Good day</div><div class="sb-name">'+esc(nm)+'</div></div><button class="sb-toggle" title="\u0e22\u0e48\u0e2d/\u0e01\u0e32\u0e07 sidebar" aria-label="Toggle sidebar"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M15 6l-6 6 6 6"/></svg></button>';
    sb.insertBefore(hd, sb.firstChild);
    var dv=document.createElement('div'); dv.className='sb-divider'; sb.insertBefore(dv, hd.nextSibling);
    function setC(c){ document.body.classList.toggle('sb-collapsed', c); sb.classList.toggle('sb-collapsed', c); try{localStorage.setItem('sb_collapsed', c?'1':'0');}catch(e){} var p=hd.querySelector('.sb-toggle path'); if(p) p.setAttribute('d', c?'M9 6l6 6-6 6':'M15 6l-6 6 6 6'); }
    hd.querySelector('.sb-toggle').onclick=function(){ setC(!sb.classList.contains('sb-collapsed')); };
    var saved=false; try{ saved=localStorage.getItem('sb_collapsed')==='1'; }catch(e){}
    if(saved) setC(true);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', initGlassSidebar); else setTimeout(initGlassSidebar,0);
})();
