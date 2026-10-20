function bookingV2SwitchTab(t){ if(bkLimProg() && t!=='cal' && t!=='bytrip') t='bytrip'; _bkV2.tab = t; bookingV2Render(); }
