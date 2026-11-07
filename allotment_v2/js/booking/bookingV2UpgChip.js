function bookingV2UpgChip(txt){ var U=_bkUpg; if(!U) return; var r=String(U.reason||'').trim();
  U.reason=!r?txt:(r.indexOf(txt)>=0?r:(txt+' · '+r));
  var el=document.getElementById('bkupg-reason'); if(el){ el.value=U.reason; el.focus(); try{ el.setSelectionRange(el.value.length, el.value.length); }catch(_){} }
  bookingV2UpgTicket();
}
