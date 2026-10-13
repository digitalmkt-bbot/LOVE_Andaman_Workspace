// ── Manual van grouping · mark bookings that go together = 1 group · van assigned to the group later (optional) ──
function bookingV2VanSelToggle(bkId){ window._bkV2VanSel=window._bkV2VanSel||{}; if(window._bkV2VanSel[bkId]) delete window._bkV2VanSel[bkId]; else { window._bkV2VanSelN=(window._bkV2VanSelN||0)+1; window._bkV2VanSel[bkId]=window._bkV2VanSelN; } bookingV2RenderKeep(); }
