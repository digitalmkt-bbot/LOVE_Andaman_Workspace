function bookingV2UpgPick(k,v){ var U=_bkUpg; if(!U) return;
  if(k==='to'){ U.to=v; if(U.kind==='promise'){ var B=_bkUpgRoomBoats(U); if(!B.some(function(x){ return x.boatId===U.boat; })) U.boat=(B.length===1?B[0].boatId:''); } }
  else if(k==='kind'){ if(!U.to) return; U.kind=v; if(v==='promise' && !U.boat){ var B2=_bkUpgRoomBoats(U); if(B2.length===1) U.boat=B2[0].boatId; } }
  else if(k==='boat'){ U.boat=v; }
  else if(k==='chg'){ U.chargeOn=!!v; if(!v) U.charge=''; }
  bookingV2UpgModal();
  if(k==='chg' && v){ var ci=document.getElementById('bkupg-charge'); if(ci) ci.focus(); }
}
