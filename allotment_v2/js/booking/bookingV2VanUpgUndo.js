/* ย้อนกลับทั้งคัน · เรียกจากหัวกรุ๊ปฝั่งปลายทาง · กลับไปกรุ๊ปเดิมถ้าเลขนั้นยังว่าง ไม่งั้นเปิดเลขใหม่ (เลขเดิมอาจถูกกรุ๊ปใหม่ใช้ไปแล้ว) */
function bookingV2VanUpgUndo(date, rid, zone, gid, _ok){
  if(typeof window.laGuardEdit==='function' && !window.laGuardEdit('operations')) return;
  var U=bkUpgVanOf(date, rid, gid); if(!U){ alert('This van group did not come from a whole-van upgrade.'); return; }
  var m=bkUpgVanMembers(date, rid, gid);
  var from=U.from, fromNm=bkUpgRouteName(from), toNm=bkUpgRouteName(rid);
  var pax=m.reduce(function(s,x){ return s+x.pax; },0);
  if(typeof bookingV2IsRouteOpenOn==='function' && !bookingV2IsRouteOpenOn(from, date)){ bkUpgUndoBlocked({al:null, fromNm:fromNm, toNm:toNm, toRid:rid, fromRid:from, pax:pax, n:m.length, date:date}); return; }
  var al=(typeof getAllotment==='function')?getAllotment(from, date, null):null;
  if(al && al.hasAllotment && pax>al.seatsAvailable){ bkUpgUndoBlocked({al:al, fromNm:fromNm, toNm:toNm, toRid:rid, fromRid:from, pax:pax, n:m.length, date:date}); return; }
  var uncol=0, col=0; m.forEach(function(x){ var u=x.t.upg; var it=(u.upgId && Array.isArray(x.b.upgrades))?x.b.upgrades.find(function(y){ return y.id===u.upgId; }):null; if(it){ if(it.collected) col+=(+it.sellPrice||0); else uncol+=(+it.sellPrice||0); } });
  if(!_ok){   /* §upgUndoUi */
    var _T=function(x){ return (typeof laT==='function')?laT(x):x; }, _rw=[[_T('ทั้งคัน'), m.length+' booking &middot; '+pax+' pax']];
    if(uncol) _rw.push([_T('ค่า Upgrade'), '<span style="color:#7A4A00">&#3647;'+uncol.toLocaleString()+'</span> '+_T('ยังไม่เก็บ · จะถูกลบออก')]);
    if(col) _rw.push([_T('เก็บแล้ว'), '&#3647;'+col.toLocaleString()+' '+_T('คงไว้ในบุคกิ้ง')]);
    bkUpgSheet({ mode:'ask', title:_T('ย้ายทั้งคันกลับโปรแกรมเดิม?'), toNm:toNm, fromNm:fromNm, toRid:rid, fromRid:from, whoSub:m.length+' booking · '+pax+' pax', pax:pax, date:date, rows:_rw.slice(1),
      tip:_T('ย้ายกลับแล้วเรือที่จัดไว้จะถูกล้าง ต้องจัดเรือใหม่ในโปรแกรมเดิม'), okLabel:_T('ยืนยันยกเลิกทั้งคัน'),
      onYes:function(){ bookingV2VanUpgUndo(date, rid, zone, gid, true); } });
    return; }
  /* เลขกรุ๊ปเดิมยังว่างไหม · ถ้ามีคนใช้แล้ว เปิดเลขใหม่ */
  var oldGid=+U.gid||0, used=false;
  if(oldGid){ (SB_BOOKINGS||[]).forEach(function(b){ if(used||!b||['cancelled','rejected','cancelled_weather'].indexOf(b.status)>=0) return; if(!(b.trips||[]).some(function(t){ return t&&(t.date||'')===date&&(t.routeId||'')===from; })) return; var o=bkOpsRead(b,date)||{}; if(Array.isArray(o.vanSplits)){ if(o.vanSplits.some(function(s){ return (+s.vanGroup||0)===oldGid; })) used=true; } else if((+o.vanGroup||0)===oldGid) used=true; }); }
  var backGid=(oldGid && !used)?oldGid:((typeof _bkV2VanNextGroup==='function')?_bkV2VanNextGroup(date, from, zone):1);
  m.forEach(function(x){
    var b=x.b, t=x.t, u=t.upg, O=bkOpsFor(b, date);
    var it=(u.upgId && Array.isArray(b.upgrades))?b.upgrades.find(function(y){ return y.id===u.upgId; }):null;
    if(it && !it.collected) b.upgrades=b.upgrades.filter(function(y){ return y.id!==u.upgId; });
    var tgt=x.s||O; tgt.vanGroup=backGid;
    if(u.van && u.van.pickChanged){ if(x.s && bkSplitOwnPick(x.s)) x.s.pickTime=u.van.pick||''; else O.pickupTimeFinal=u.van.pick||''; }
    t.routeId=from; delete t.upg;
    O.boatId=null; if(O.boatSplits) delete O.boatSplits;
    if(typeof bookingV2AddHistory==='function') bookingV2AddHistory(b,'edit','Upgrade undone (whole van) · back to '+fromNm+' · van group '+gid+' > '+backGid,'Edit');
  });
  bkUpgVanMoveStops(date, rid, gid, from, backGid, '');
  acctPersistBookings();
  if(typeof bookingV2RenderKeep==='function') bookingV2RenderKeep(); else if(typeof bookingV2Render==='function') bookingV2Render();
}
