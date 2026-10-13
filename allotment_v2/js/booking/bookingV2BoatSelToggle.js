function bookingV2BoatSelToggle(bkId){ const s=window._bkV2BoatSel; if(s[bkId]) delete s[bkId]; else s[bkId]=true; bookingV2RenderKeep(); }
