/* แยกตัวย้ายออกมา เพื่อให้เทสและคีย์บอร์ด (ถ้ามีวันหน้า) เรียกได้โดยไม่ต้องจำลอง event ลาก */
function bookingV2GrpMove(key, from, to){
  from=+from||0; to=+to||0;
  if(!key || !from || !to || from===to) return false;
  /* ลำดับปัจจุบันอ่านจากสิ่งที่ตาเห็นจริง ไม่ใช่จากที่เก็บ
     กรุ๊ปที่เพิ่งสร้างยังไม่อยู่ในที่เก็บ ถ้าอ่านจากที่เก็บมันจะหล่นหายตอนบันทึก */
  var cur=[].slice.call(document.querySelectorAll('tr[data-grp]'))
            .filter(function(t){ return (t.getAttribute('data-gk')||'')===String(key); })
            .map(function(t){ return +t.getAttribute('data-grp')||0; })
            .filter(function(n){ return n>0; });
  var iF=cur.indexOf(from), iT=cur.indexOf(to);
  if(iF<0 || iT<0) return false;
  cur.splice(iF,1);
  cur.splice(cur.indexOf(to) + (iF<iT ? 1 : 0), 0, from);   /* ลากลง = วางหลังเป้า · ลากขึ้น = วางก่อนเป้า */
  var p=String(key).split('::');
  if(!bookingV2GrpOrderSet(p[0], p[1], p.slice(2).join('::'), cur)){ alert('View-only: cannot reorder groups'); return false; }
  if(typeof bookingV2RenderKeep==='function') bookingV2RenderKeep(); else bookingV2Render();
  return true;
}
