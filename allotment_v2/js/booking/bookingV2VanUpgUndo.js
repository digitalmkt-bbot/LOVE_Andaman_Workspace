/* ย้อนกลับทั้งคัน · เรียกจากหัวกรุ๊ปฝั่งปลายทาง · กลับไปกรุ๊ปเดิมถ้าเลขนั้นยังว่าง ไม่งั้นเปิดเลขใหม่ (เลขเดิมอาจถูกกรุ๊ปใหม่ใช้ไปแล้ว) */
function bookingV2VanUpgUndo(date, rid, zone, gid){
  if(typeof window.laGuardEdit==='function' && !window.laGuardEdit('operations')) return;
  var U=bkUpgVanOf(date, rid, gid); if(!U){ alert('This van group did not come from a whole-van upgrade.'); return; }
  var m=bkUpgVanMembers(date, rid, gid);
  var from=U.from, fromNm=bkUpgRouteName(from), toNm=bkUpgRouteName(rid);
  var pax=m.reduce(function(s,x){ return s+x.pax; },0);
  if(typeof bookingV2IsRouteOpenOn==='function' && !bookingV2IsRouteOpenOn(from, date)){ alert('Cannot undo: '+fromNm+' is not running on '+date+'.'); return; }
  var al=(typeof getAllotment==='function')?getAllotment(from, date, null):null;
  if(al && al.hasAllotment && pax>al.seatsAvailable){ alert('Cannot undo: not enough free seats on '+fromNm+' ('+date+').\nNeeds '+pax+', free '+al.seatsAvailable+'.'); return; }
  var uncol=0, col=0; m.forEach(function(x){ var u=x.t.upg; var it=(u.upgId && Array.isArray(x.b.upgrades))?x.b.upgrades.find(function(y){ return y.id===u.upgId; }):null; if(it){ if(it.collected) col+=(+it.sellPrice||0); else uncol+=(+it.sellPrice||0); } });
  if(!confirm('Undo the whole-van upgrade? ('+m.length+' bookings, '+pax+' pax)\n'+toNm+' > back to '+fromNm+'\n'+(uncol?('Uncollected extra charges (THB '+uncol.toLocaleString()+') will be removed.\n'):'')+(col?('Collected charges (THB '+col.toLocaleString()+') stay on the bookings.\n'):'')+'Boats must be assigned again.')) return;
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
