/* ══ §btTickScroll (2026-09-05) · ติ๊กเลือกแถวแล้วตารางเด้งกลับหัว ═════════════
   ติ๊กหนึ่งครั้ง = bookingV2Render() วาดใหม่ทั้งหน้า · innerHTML ใหม่ทำให้ .t2-wrap
   (กล่องเลื่อนของตาราง By-trip) เป็นคนละตัว scrollTop จึงกลับเป็น 0 ทุกครั้ง
   ติ๊กหลายแถวที่อยู่ท้ายตารางแทบไม่ได้ ต้องเลื่อนลงมาใหม่ทุกครั้ง
   เก็บตำแหน่งไว้ก่อนวาด แล้วคืนหลังวาดเสร็จ · ต้องคืนใน rAF ต่ออีกสองชั้น
   เพราะ bookingV2Render ตั้งความสูงกล่อง (--bt-wraph) และดึง margin ล่างใน rAF ของมันเอง
   ถ้าคืนก่อนหน้านั้น กล่องยังเตี้ยอยู่ เบราว์เซอร์จะตัดค่าที่คืนทิ้ง */
function bookingV2KeepScroll(fn){
  const _wrap=()=>{ const h=document.getElementById('bkv2-host'); return h?h.querySelector('.t2-wrap'):null; };
  /* §btInScroll (2026-10-08) · "ช่อง Programmes เลื่อนลงไปคลิกอันที่อยู่ล่าง ๆ คลิกเสร็จแล้วเด้ง"
     รายการโปรแกรม (.bt-pgbody) และรายการเรือ (.bt-blist) บนหัว By trip เป็นกล่องเลื่อนของตัวเอง
     (สูงสุด ~200px) · กดแล้ววาดหัวใหม่ทั้งก้อน กล่องใหม่เริ่มที่ 0 · ของเดิมจำแค่ .t2-wrap กับหน้าจอ
     จำตำแหน่งเลื่อนของกล่องพวกนี้ด้วย คืนตามลำดับที่เจอ */
  const _IN=['.bt-pgbody','.bt-blist'];
  const _inner=()=>{ const h=document.getElementById('bkv2-host'); return h?_IN.map(sel=>[...h.querySelectorAll(sel)]):[]; };
  const _inS=_inner().map(a=>a.map(e=>e.scrollTop));
  const w=_wrap();
  const t=w?w.scrollTop:0, l=w?w.scrollLeft:0, y=window.scrollY||0;
  fn();
  const put=()=>{ try{
    const w2=_wrap();
    if(w2){ if(t) w2.scrollTop=t; if(l) w2.scrollLeft=l; }
    _inner().forEach((a,i)=>a.forEach((e,j)=>{ const v=(_inS[i]||[])[j]; if(v && e.scrollTop!==v) e.scrollTop=v; }));
    if(y) window.scrollTo(0,y);
  }catch(_){} };
  put();
  requestAnimationFrame(()=>{ put(); requestAnimationFrame(put); });
}
