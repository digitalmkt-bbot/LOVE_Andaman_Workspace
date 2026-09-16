function bookingV2RenderFooterHints(viewMode){
  if(viewMode === 'cal'){
    // Calendar view: chips per route · no heatmap intensity · just FOC indicator + tip
    return `
      <div class="bkv2-foot-hints">
        <span class="bkv2-legend"><span class="sw focdot"></span>FOC pending</span>
        <span class="gp" style="color:var(--ink-soft);font-style:italic">Chips show pax per route &middot; click cell for AD&middot;CHD&middot;INF&middot;FOC + PK&middot;KL&middot;NT breakdown</span>
        <span style="margin-left:auto" class="gp"><span class="bkv2-kbd">M</span>switch to matrix</span>
      </div>
    `;
  }
  // Matrix view: keep heatmap legend
  return `
    <div class="bkv2-foot-hints">
      <span class="bkv2-legend"><span class="sw mxlo"></span>วันเงียบของโปรแกรมนั้น</span>
      <span class="bkv2-legend"><span class="sw mxhi"></span>วันแน่นของโปรแกรมนั้น</span>
      <span class="bkv2-legend"><span class="sw mxempty"></span>เปิดแต่ยังไม่มีคน</span>
      <span class="bkv2-legend"><span class="sw mxclosed"></span>ไม่ออกวันนั้น</span>
      <span class="bkv2-legend"><span class="sw focdot"></span>FOC pending</span>
      <span style="margin-left:auto" class="gp"><span class="bkv2-kbd">M</span>back to calendar</span>
    </div>
  `;
}
