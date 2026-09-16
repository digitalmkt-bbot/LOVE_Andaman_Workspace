function bookingV2UpgradePreset(){ const i=+(document.getElementById('bku-preset')||{}).value||0; const L=document.getElementById('bku-label'); if(L)L.value=BKV2_UPGRADE_PRESETS[i]||''; }
