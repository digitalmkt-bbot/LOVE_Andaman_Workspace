function toggleTopbarTools(){var t=document.querySelector('.topbar');if(t)t.classList.toggle('tools-open');}
/* §mobile · ลิ้นชักเมนู · ล็อกไม่ให้พื้นหลังเลื่อนตามตอนเปิด (iOS ชอบเลื่อนทะลุ) */
function laNavOpen(){ document.body.classList.add('la-nav-open'); }
function laNavClose(){ document.body.classList.remove('la-nav-open'); }
function laNavToggle(){ document.body.classList.toggle('la-nav-open'); }
/* §mobUser · จอเล็ก · ป้ายผู้ใช้ + ปุ่มออก ต้องอยู่ในลิ้นชัก ไม่ใช่ลอยทับเนื้อหา
   กล่องลอยที่มุมซ้ายล่างบนมือถือมีสองปัญหาพร้อมกัน
     · ทับเนื้อหาของทุกหน้า เพราะ sidebar ที่มันเคยเกาะอยู่เลื่อนออกไปนอกจอแล้ว
     · ปุ่มไปอยู่ใต้แถบเครื่องมือของ Safari · กดไม่โดน = ออกจากระบบไม่ได้ */
function laUbPlace(){
  try{
    var b=document.getElementById('la-userbadge'); if(!b) return;
    var sb=document.querySelector('.sidebar'); if(!sb) return;
    var small=(window.innerWidth<=820);
    if(small){
      if(b.parentNode!==sb){ sb.appendChild(b); b.classList.add('la-ub-inside'); }
    }else if(b.parentNode!==document.body){
      document.body.appendChild(b); b.classList.remove('la-ub-inside');
    }
  }catch(_){}
}
(function(){ var n=0;
  (function go(){ laUbPlace(); if(!document.getElementById('la-userbadge') && n++<40) setTimeout(go,180); })();
  window.addEventListener('resize', laUbPlace);
})();
document.addEventListener('keydown',function(e){ if(e.key==='Escape') laNavClose(); });
window.addEventListener('resize',function(){ if(window.innerWidth>820) laNavClose(); });