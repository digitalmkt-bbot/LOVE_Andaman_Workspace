function bookingV2AreaDDRender(kind, val){
  const dd = document.getElementById('bkv2-area-dd-' + kind);
  if(!dd) return;
  const opts = bookingV2AreaDDOpts(kind);
  const q = String(val||'').trim().toLowerCase();
  const filtered = !q ? opts : opts.filter(o => o.label.toLowerCase().includes(q) || o.name.toLowerCase().includes(q) || o.zone.toLowerCase().includes(q));
  if(filtered.length === 0){ dd.innerHTML = '<div class="bkv2-nb-dd-empty">no area matches</div>'; return; }
  _bkV2AreaDDActive = Math.min(_bkV2AreaDDActive, filtered.length - 1);
  dd.innerHTML = filtered.slice(0, 50).map((o, i) =>
    `<div class="bkv2-nb-dd-item${i === _bkV2AreaDDActive ? ' active' : ''}" data-label="${String(o.label).replace(/"/g,'&quot;')}" onmousedown="event.preventDefault();bookingV2AreaDDPick('${kind}', this.dataset.label)">
      <span class="bkv2-nb-dd-mkt">${o.zone.split(' · ')[0]}</span>
      <span class="bkv2-nb-dd-name">${o.name}</span>
      ${o.count ? `<span style="margin-left:auto;font-size:9.5px;color:#1683C7;background:#E1F0FA;border-radius:7px;padding:1px 7px;white-space:nowrap" title="เคยใช้ ${o.count} ครั้งในบุคกิ้งก่อนหน้า">${o.count}×</span>` : ''}
    </div>`
  ).join('');
}
