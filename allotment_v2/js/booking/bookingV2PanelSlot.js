function bookingV2PanelSlot(){
  return _bkV2.panelHid
    ? `<div class="bkv2-selrail" onclick="bookingV2TogglePanel()" title="กางแผงรายละเอียดวัน">`
      + `<span class="ar">&lsaquo;</span><span class="tx">รายละเอียดวัน</span></div>`
    : bookingV2RenderSelDay();
}
