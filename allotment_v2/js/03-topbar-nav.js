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
/* §localDemo · reveal the "Local Demo" corner ribbon on local/LAN hosts only.
   The class goes on <html>, not on the ribbon itself, because this file is loaded from <head> —
   document.body does not exist yet, but documentElement always does, so there is nothing to wait
   for and the ribbon is painted with the first frame rather than flashing in later.
   Deliberately a hostname allowlist, not a "not production" check: anything unrecognised is
   treated as production and shows nothing. Getting it wrong in that direction is harmless; the
   other direction puts "Local Demo" across the top of rsvn.loveandaman.com. */
(function(){
  try{
    var h=String(location.hostname||'').toLowerCase();
    /* The private-range test matches a WHOLE IPv4 address, not a prefix. A bare /^192\.168\./
       also matches "192.168.1.50.evil.com", which is a hostname anyone can point at anything. */
    var m=/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h), priv=false;
    if(m){
      var a=+m[1], b=+m[2];
      priv = a===10 || a===127 || (a===192&&b===168) || (a===172&&b>=16&&b<=31) || (a===0&&b===0);
    }
    if(priv || h==='localhost' || h==='::1' || h==='' || /\.local$/.test(h))
      document.documentElement.classList.add('la-local');
  }catch(_){}
})();
