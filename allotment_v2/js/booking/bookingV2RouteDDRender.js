function bookingV2RouteDDRender(idx, val){
  const dd = document.getElementById('bkv2-route-dd-' + idx);
  if(!dd) return;
  const opts = bookingV2RouteDDOpts();
  const q = String(val||'').trim().toLowerCase();
  const filtered = !q ? opts : opts.filter(o => o.label.toLowerCase().includes(q) || o.id.toLowerCase().includes(q));
  if(filtered.length === 0){ dd.innerHTML = '<div class="bkv2-nb-dd-empty">no route matches · agent rate type may not cover this</div>'; return; }
  _bkV2RouteDDActive = Math.min(_bkV2RouteDDActive, filtered.length - 1);
  dd.innerHTML = filtered.slice(0, 30).map((o, i) =>
    `<div class="bkv2-nb-dd-item${i === _bkV2RouteDDActive ? ' active' : ''}" data-label="${String(o.label).replace(/"/g,'&quot;')}" onmousedown="event.preventDefault();bookingV2RouteDDPick(${idx}, this.dataset.label)">
      <span class="bkv2-nb-dd-mkt">${o.pier}</span>
      <span class="bkv2-nb-dd-name">${o.label}</span>
    </div>`
  ).join('');
}
