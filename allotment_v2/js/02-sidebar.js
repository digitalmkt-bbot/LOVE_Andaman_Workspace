
(function(){
  /* §sbTheme · โหมดสว่าง/มืดของ sidebar
     เป็นความชอบของคนใช้เครื่องนี้ ไม่ใช่ข้อมูลที่ต้องแชร์ · เก็บใน localStorage พอ
     ⚠ ทาตั้งแต่สคริปต์เริ่มรัน ไม่รอ DOMContentLoaded · ถ้ารอจะเห็นสว่างแวบหนึ่ง
       ก่อนเปลี่ยนเป็นมืด ทุกครั้งที่โหลดหน้า */
  var SB_THEME_KEY='sb_theme';
  function sbThemeGet(){ try{ return localStorage.getItem(SB_THEME_KEY)==='dark'?'dark':'light'; }catch(e){ return 'light'; } }
  function sbThemeApply(t){ document.documentElement.setAttribute('data-sb-theme', t==='dark'?'dark':'light'); }
  sbThemeApply(sbThemeGet());
  /* §sbPill · ทรงของพิลเมนูที่เปิดอยู่ · เลือกได้แยกจากธีม
       cyan (ค่าตั้งต้น) = พื้น ci-cyan ตัวหนังสือ ci-navy
       navy             = พื้น ci-navy ตัวหนังสือขาว
     ทำไมต้องแยก · ci-cyan บนพื้นสว่างเด่นเรื่องสีแต่ขอบพิลแยกจากพื้นได้แค่ 2.17
     บางคนอยากได้ขอบที่อ่านขาด (navy ได้ 17.3) จึงให้เลือกเอง ไม่ตัดสินแทน */
  var SB_PILL_KEY='sb_pill';
  function sbPillGet(){ try{ return localStorage.getItem(SB_PILL_KEY)==='navy'?'navy':'cyan'; }catch(e){ return 'cyan'; } }
  function sbPillApply(p){ document.documentElement.setAttribute('data-sb-pill', p==='navy'?'navy':'cyan'); }
  sbPillApply(sbPillGet());
  window.sbPillToggle=function(){
    var p=sbPillGet()==='navy'?'cyan':'navy';
    try{ localStorage.setItem(SB_PILL_KEY,p); }catch(e){}
    sbPillApply(p); sbPillIcon();
  };
  function sbPillIcon(){
    var b=document.querySelector('.sb-pill'); if(!b) return;
    var navy=sbPillGet()==='navy';
    /* วงกลมทึบบอกสีที่ "จะได้ถ้ากด" แบบเดียวกับปุ่มธีม */
    b.innerHTML='<span class="sb-pill-dot" style="background:'+(navy?'#00BCDF':'#000F4C')+'"></span>';
    b.setAttribute('title', navy
      ? '\u0e40\u0e1b\u0e25\u0e35\u0e48\u0e22\u0e19\u0e1e\u0e34\u0e25\u0e40\u0e21\u0e19\u0e39\u0e40\u0e1b\u0e47\u0e19\u0e2a\u0e35\u0e1f\u0e49\u0e32'
      : '\u0e40\u0e1b\u0e25\u0e35\u0e48\u0e22\u0e19\u0e1e\u0e34\u0e25\u0e40\u0e21\u0e19\u0e39\u0e40\u0e1b\u0e47\u0e19\u0e2a\u0e35\u0e01\u0e23\u0e21\u0e17\u0e48\u0e32');
  }
  /* §i18n · ปุ่มสลับภาษา ไทย/อังกฤษ · ตัวจริงอยู่ใน 04-data-core (laLangToggle)
     ไฟล์นี้โหลดก่อน 04 จึงเรียกผ่าน window ตอนกด ไม่ใช่ตอนแปลไฟล์
     ปุ่มบอก "ภาษาที่ใช้อยู่ตอนนี้" ไม่ใช่ "กดแล้วจะได้อะไร" · ต่างจากปุ่มธีมข้างๆ
     เพราะภาษาเป็นสิ่งที่คนอ่านจากหน้าจอได้อยู่แล้ว บอกปลายทางซ้ำกลับสับสน */
  window.sbLangToggle=function(){
    if(typeof window.laLangToggle==='function') window.laLangToggle();
    sbLangIcon();
  };
  function sbLangIcon(){
    var b=document.querySelector('.sb-lang'); if(!b) return;
    var en=(typeof window.laLangGet==='function') ? (window.laLangGet()==='en') : false;
    b.textContent = en ? 'EN' : 'TH';
    b.setAttribute('title', en ? 'English · click for Thai' : 'ภาษาไทย · กดเพื่อเปลี่ยนเป็นอังกฤษ');
  }
  window.sbLangIcon=sbLangIcon;
  window.sbThemeToggle=function(){
    var t=sbThemeGet()==='dark'?'light':'dark';
    try{ localStorage.setItem(SB_THEME_KEY,t); }catch(e){}
    sbThemeApply(t); sbThemeIcon();
  };
  function sbThemeIcon(){
    var b=document.querySelector('.sb-theme'); if(!b) return;
    var dark=sbThemeGet()==='dark';
    /* ไอคอนบอก "กดแล้วจะได้อะไร" ไม่ใช่ "ตอนนี้เป็นอะไร" · มืดอยู่ให้เห็นดวงอาทิตย์ */
    b.innerHTML = dark
      ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4"/></svg>'
      : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 14.5A8.2 8.2 0 019.5 4 8.6 8.6 0 1020 14.5z"/></svg>';
    b.setAttribute('title', dark?'\u0e2a\u0e25\u0e31\u0e1a\u0e40\u0e1b\u0e47\u0e19\u0e42\u0e2b\u0e21\u0e14\u0e2a\u0e27\u0e48\u0e32\u0e07':'\u0e2a\u0e25\u0e31\u0e1a\u0e40\u0e1b\u0e47\u0e19\u0e42\u0e2b\u0e21\u0e14\u0e21\u0e37\u0e14');
  }
  function esc(x){ return String(x==null?'':x).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function initGlassSidebar(){
    var sb=document.querySelector('.sidebar'); if(!sb || sb.querySelector('.sb-profile')) return;
    var me=(window.LA_ME||{}); var nm=(me.name||me.username||'LOVE Andaman');
    var parts=String(nm).trim().split(/\s+/); var initials=((parts[0]||'')[0]||'')+((parts[1]||'')[0]||''); initials=(initials||nm.slice(0,2)||'LA').toUpperCase();
    var hd=document.createElement('div'); hd.className='sb-profile';
    hd.innerHTML='<div class="sb-avatar">'+esc(initials)+'</div><div style="flex:1;min-width:0"><div class="sb-greet">Good day</div><div class="sb-name">'+esc(nm)+'</div></div><button class="sb-lang" onclick="sbLangToggle()" aria-label="Switch language"></button><button class="sb-pill" onclick="sbPillToggle()" aria-label="Toggle pill colour"></button><button class="sb-theme" onclick="sbThemeToggle()" aria-label="Toggle light/dark"></button><button class="sb-toggle" title="\u0e22\u0e48\u0e2d/\u0e01\u0e32\u0e07 sidebar" aria-label="Toggle sidebar"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M15 6l-6 6 6 6"/></svg></button>';
    sb.insertBefore(hd, sb.firstChild);
    var dv=document.createElement('div'); dv.className='sb-divider'; sb.insertBefore(dv, hd.nextSibling);
    function setC(c){ document.body.classList.toggle('sb-collapsed', c); sb.classList.toggle('sb-collapsed', c); try{localStorage.setItem('sb_collapsed', c?'1':'0');}catch(e){} var p=hd.querySelector('.sb-toggle path'); if(p) p.setAttribute('d', c?'M9 6l6 6-6 6':'M15 6l-6 6 6 6'); }
    hd.querySelector('.sb-toggle').onclick=function(){ setC(!sb.classList.contains('sb-collapsed')); };
    sbThemeIcon(); sbPillIcon(); sbLangIcon();
    try{ if(typeof window.laLangApplyNav==='function') window.laLangApplyNav(); }catch(e){}
    var saved=false; try{ saved=localStorage.getItem('sb_collapsed')==='1'; }catch(e){}
    if(saved) setC(true);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', initGlassSidebar); else setTimeout(initGlassSidebar,0);
})();
