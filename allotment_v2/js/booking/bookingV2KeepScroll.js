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
  /* §clickRefresh (2026-11-28) · "the booking panel keep repaint/redraw and being pull up": the open booking's own scroll boxes
     (its side card .bkv2-review-sticky, any scrolled box in the panel) and the mobile page box (.main) were not remembered,
     so every redraw put them back at the top. Every box that is scrolled is kept now, matched after the redraw by its class
     and its place among boxes with that class. */
  const _boxKey=e=>(e.id?'#'+e.id:'')+'.'+String(e.className||'');
  const _kept=[];
  (()=>{ const h=document.getElementById('bkv2-host'), m=document.querySelector('.main'), cnt={};
    const see=e=>{ const k=_boxKey(e), n=cnt[k]=(cnt[k]||0)+1; if(e.scrollTop||e.scrollLeft) _kept.push({ k, n, t:e.scrollTop, l:e.scrollLeft }); };
    if(m) see(m); if(h) h.querySelectorAll('*').forEach(see); })();
  const _putBoxes=()=>{ if(!_kept.length) return;
    const h=document.getElementById('bkv2-host'), m=document.querySelector('.main'), at={}, cnt={};
    if(m){ const k=_boxKey(m); cnt[k]=1; at[k+'|1']=m; }
    if(h) h.querySelectorAll('*').forEach(e=>{ const k=_boxKey(e), n=cnt[k]=(cnt[k]||0)+1; at[k+'|'+n]=e; });
    _kept.forEach(s=>{ const e=at[s.k+'|'+s.n]; if(!e) return;
      if(s.t && e.scrollTop!==s.t) e.scrollTop=s.t; if(s.l && e.scrollLeft!==s.l) e.scrollLeft=s.l; }); };
  const w=_wrap();
  const t=w?w.scrollTop:0, l=w?w.scrollLeft:0, y=window.scrollY||0;
  fn();
  const put=()=>{ try{
    const w2=_wrap();
    if(w2){ if(t) w2.scrollTop=t; if(l) w2.scrollLeft=l; }
    _inner().forEach((a,i)=>a.forEach((e,j)=>{ const v=(_inS[i]||[])[j]; if(v && e.scrollTop!==v) e.scrollTop=v; }));
    _putBoxes();
    if(y) window.scrollTo(0,y);
  }catch(_){} };
  put();
  requestAnimationFrame(()=>{ put(); requestAnimationFrame(put); });
}
