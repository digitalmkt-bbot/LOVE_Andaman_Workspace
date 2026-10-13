// Live split: total removed → charged count + waived count, auto-suggest ฿ amounts (editable after)
function bookingV2PartialRecalc(){
  let totRem=0;
  (typeof BKV2_PAX_KEYS!=='undefined'?BKV2_PAX_KEYS:[]).forEach(([k])=>{ const el=document.getElementById('bkp-rm-'+k); if(el) totRem+=Math.max(0,parseInt(el.value)||0); });
  const totEl=document.getElementById('bkp-totrem'); if(totEl) totEl.textContent=totRem;
  const chgEl=document.getElementById('bkp-chg-cnt'); if(!chgEl) return;
  let chg=Math.max(0,Math.min(parseInt(chgEl.value)||0,totRem)); chgEl.value=chg;
  const waive=Math.max(0,totRem-chg);
  const wcEl=document.getElementById('bkp-waive-cnt'); if(wcEl) wcEl.textContent=waive;
  const pp=Math.max(0,window._bkpPerPax||0);
  const ca=document.getElementById('bkp-chg-amt'); if(ca) ca.value=Math.round(chg*pp);
  const wa=document.getElementById('bkp-waive-amt'); if(wa) wa.value=Math.round(waive*pp);
}
