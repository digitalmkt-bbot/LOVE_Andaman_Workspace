function bookingV2VanJobOrder(date, vanId, routeId, leg, grp){
  const v=vehGet(vanId); if(!v){ alert('Vehicle not found'); return; }
  const e=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const _rn=routeId?(((typeof getRoute==='function'?getRoute(routeId):null)||{}).name||routeId):'';
  /* §vjRound · ชื่อหน้าต่าง/ชื่อไฟล์ต้องบอกรอบด้วย · สองใบของคันเดียวกันวันเดียวกัน
     ถ้าชื่อเหมือนกันเป๊ะ คนพิมพ์แยกไม่ออกว่าใบไหนคือรอบไหน */
  const _RND=(typeof vjRoundOf==='function')?vjRoundOf(date,vanId,routeId,+grp||0):null;
  const legTitle=(_rn?(' · '+_rn):'')+(_RND?(' · '+vjRoundLbl(_RND)):'')+(leg==='ret'?' · ขากลับ':'');
  /* §vjRowHl · สีที่ทาไว้ต้องติดไปด้วย แต่ onclick ต้องไม่ติด · หน้าต่างพิมพ์ไม่มีฟังก์ชันพวกนี้ */
  const _hlWas=_VJ_HL_ON; _VJ_HL_ON=false;
  const html='<!doctype html><html><head><meta charset="utf-8"><title>Van Job Order · '+e(v.name||vanId)+legTitle+' · '+e(date)+'</title>'+vanJobsOrderCss(false)+'</head><body style="'+vjTplVars(vanId)+'">'+vanJobsOrderInner(date,vanId,routeId,leg,grp)+'<script>setTimeout(function(){try{window.print()}catch(e){}},350)<\/script></body></html>';
  _VJ_HL_ON=_hlWas;
  const w=window.open('','_blank'); if(!w){ alert('Please allow pop-ups to print the van job order'); return; }
  w.document.write(html); w.document.close(); w.focus();
}
