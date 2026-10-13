function bookingV2GrpOrderSet(date, routeId, zone, arr){
  if(typeof window.laCanEditArea==='function' && !window.laCanEditArea('operations')) return false;
  try{
    var d=laBlob();
    var o=d.bkv2_grp_order; if(typeof o==='string'){ try{ o=JSON.parse(o); }catch(_){ o={}; } }
    if(!o || typeof o!=='object') o={};
    var k=bookingV2GrpOrderKey(date, routeId, zone);
    var list=(arr||[]).map(Number).filter(function(n){ return n>0; });
    /* ตัดของเก่าก่อน แล้วค่อยเขียนอันใหม่ · สลับลำดับกันเมื่อไหร่ การจัดลำดับ
       ของทริปเก่า (ซึ่งยังเปิดดูย้อนหลังได้) จะโดนลบทิ้งทันทีที่กดเสร็จ */
    _grpOrdPrune(o);
    if(list.length) o[k]=list; else delete o[k];
    d.bkv2_grp_order=JSON.stringify(o);     /* ต้องเป็นสตริง · ดูหมายเหตุหัวบล็อก */
    _grpOrdCache=null; _grpOrdSrc=null;
    laBlobSave();
    return true;
  }catch(e){ console.warn('grp-order save failed', e); return false; }
}
