function bookingV2EditDiffMoney(L){
  var c=(L||[]).filter(function(x){ return x.tone==='money'; })[0]; if(!c) return '';
  return '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px;padding:12px 0 2px;border-top:1px solid #E6E7EB">'+bookingV2EditDiffLab('Quote total')
    +'<div style="white-space:nowrap"><span style="font-family:\'DM Mono\',monospace;font-size:12.5px;color:#9A9FAB;text-decoration:line-through;margin-right:8px">'+bookingV2EditDiffEsc(c.from)+'</span><span style="font-family:\'DM Mono\',monospace;font-style:italic;font-weight:500;font-size:22px;color:#16265C">'+bookingV2EditDiffEsc(c.to)+'</span></div></div>';
}
