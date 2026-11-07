/* §goBk (2026-11-04) · owner: "ลค B2B เลื่อนวัน แล้วกดปุ่ม ไปดูบุคกิ้งที่เลื่อนวัน ไปหน้านั้นจริง แต่ต้องเลื่อนหาอีก · ควรไปแล้วเด้งเจอบุคกิ้งนั้นเลย"
   ไปวันนั้น → รอหน้าวาดเสร็จ → เลื่อนแถวของใบนั้นมากลางจอ + กระพริบเหลือง
   หาไม่เจอเพราะตัวกรองท่า/กลุ่มเส้นทางซ่อนอยู่ = ล้างตัวกรองให้แล้วหาอีกรอบ · ยังไม่เจอก็บอก (ไม่เงียบ) */
function bookingV2GoBooking(date, bkId){
  if(typeof bookingV2Tab2PickDay!=='function') return;
  if(!document.getElementById('t2-goflash-css')){ var st=document.createElement('style'); st.id='t2-goflash-css';
    st.textContent='@keyframes t2GoFlash{0%,35%{background:#FFE58A}100%{background:transparent}}tr.t2-goflash>td{animation:t2GoFlash 2.6s ease}tr.t2-goflash{outline:2px solid #E0A800;outline-offset:-2px}';
    document.head.appendChild(st); }
  bookingV2Tab2PickDay(date);
  var id=String(bkId||''), q=(window.CSS&&CSS.escape)?CSS.escape(id):id.replace(/"/g,'\\"'), n=0, cleared=false;
  (function seek(){
    var tr=document.querySelector('tr.t2-row[data-al="'+q+'"]')||document.querySelector('tr.t2-row[data-al^="'+q+'#"]');
    if(tr){
      /* หน้าเพิ่งวาด · ตัวคืนตำแหน่งเลื่อน (bookingV2KeepScroll) อาจดึงกลับในเฟรมถัดไป → เลื่อนซ้ำอีกครั้ง */
      var go=function(){ try{ var t2=document.querySelector('tr.t2-row[data-al="'+q+'"]')||document.querySelector('tr.t2-row[data-al^="'+q+'#"]')||tr; t2.scrollIntoView({block:'center'}); }catch(_){} };
      go(); setTimeout(go, 250); setTimeout(go, 700);
      tr.classList.add('t2-goflash'); setTimeout(function(){ var t3=document.querySelector('tr.t2-goflash'); if(t3) t3.classList.remove('t2-goflash'); }, 3000);
      return;
    }
    if(n===4 && !cleared && ((typeof _bkV2T2Pier!=='undefined' && _bkV2T2Pier!=='all') || (typeof _bkV2T2Family!=='undefined' && _bkV2T2Family))){
      cleared=true; try{ _bkV2T2Pier='all'; _bkV2T2Family=''; }catch(_){} if(typeof bookingV2RenderKeep==='function') bookingV2RenderKeep();
    }
    if(++n<25){ setTimeout(seek, 120); return; }
    try{ if(typeof laSaveToast==='function') laSaveToast({kind:'neutral', title:'Booking not on this page', sub:id+' · '+date}); }catch(_){}
  })();
}
