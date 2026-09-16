function bookingV2AgentDDRender(filterText){
  const dd = document.getElementById('bkv2-agent-dd');
  if(!dd) return;
  const opts = bookingV2GetAgentDDOptions();
  const q = String(filterText||'').trim().toLowerCase();
  const filtered = q ? opts.filter(o =>
    o.label.toLowerCase().includes(q) ||
    o.code.toLowerCase().includes(q) ||
    o.name.toLowerCase().includes(q) ||
    o.market.toLowerCase().includes(q)
  ) : opts;
  if(filtered.length === 0){
    dd.innerHTML = '<div class="bkv2-nb-dd-empty">no agent matches</div>';
  } else {
    _bkV2AgentDDActive = Math.min(_bkV2AgentDDActive, filtered.length - 1);
    if(_bkV2AgentDDActive < 0) _bkV2AgentDDActive = -1;
    dd.innerHTML = filtered.slice(0, 50).map((o, i) =>
      `<div class="bkv2-nb-dd-item${i === _bkV2AgentDDActive ? ' active' : ''}" data-label="${String(o.label).replace(/"/g,'&quot;')}" onmousedown="event.preventDefault();bookingV2AgentDDPick(this.dataset.label)">
        <span class="bkv2-nb-dd-mkt">${o.market}</span>
        <span class="bkv2-nb-dd-code">${o.code}</span>
        <span class="bkv2-nb-dd-name">${o.name}</span>
      </div>`
    ).join('');
    if(filtered.length > 50) dd.innerHTML += `<div class="bkv2-nb-dd-empty">+ ${filtered.length - 50} more · keep typing to narrow</div>`;
  }
}
