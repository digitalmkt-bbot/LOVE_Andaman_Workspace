function bookingV2VanUpgrade(date, rid, zone, gid){
  if(typeof window.laGuardEdit==='function' && !window.laGuardEdit('operations')) return;
  var m=bkUpgVanMembers(date, rid, gid);
  if(!m.length){ alert('No booking in this van group.'); return; }
  var vid=null; m.forEach(function(x){ if(vid) return; var v=x.s?x.s.vanId:x.o.vanId; if(v) vid=v; });
  _bkUpgVan={ date:date, from:rid, zone:zone||'', gid:+gid, vanId:vid||'', to:'', reason:'', charge:'0', pick:bkUpgVanPick(m), pick0:bkUpgVanPick(m) };
  bookingV2UpgVanModal();
}
