/* ══ §btTickScroll (2026-09-05) · ติ๊กเลือกแถวแล้วตารางเด้งกลับหัว ═════════════
   ติ๊กหนึ่งครั้ง = bookingV2Render() วาดใหม่ทั้งหน้า · innerHTML ใหม่ทำให้ .t2-wrap
   (กล่องเลื่อนของตาราง By-trip) เป็นคนละตัว scrollTop จึงกลับเป็น 0 ทุกครั้ง
   ติ๊กหลายแถวที่อยู่ท้ายตารางแทบไม่ได้ ต้องเลื่อนลงมาใหม่ทุกครั้ง
   เก็บตำแหน่งไว้ก่อนวาด แล้วคืนหลังวาดเสร็จ · ต้องคืนใน rAF ต่ออีกสองชั้น
   เพราะ bookingV2Render ตั้งความสูงกล่อง (--bt-wraph) และดึง margin ล่างใน rAF ของมันเอง
   ถ้าคืนก่อนหน้านั้น กล่องยังเตี้ยอยู่ เบราว์เซอร์จะตัดค่าที่คืนทิ้ง */
function bookingV2KeepScroll(fn){
  const _wrap=()=>{ const h=document.getElementById('bkv2-host'); return h?h.querySelector('.t2-wrap'):null; };
  const w=_wrap();
  const t=w?w.scrollTop:0, l=w?w.scrollLeft:0, y=window.scrollY||0;
  fn();
  const put=()=>{ try{
    const w2=_wrap();
    if(w2){ if(t) w2.scrollTop=t; if(l) w2.scrollLeft=l; }
    if(y) window.scrollTo(0,y);
  }catch(_){} };
  put();
  requestAnimationFrame(()=>{ put(); requestAnimationFrame(put); });
}
