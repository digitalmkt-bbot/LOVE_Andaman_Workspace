function bookingV2RouteDDRender(idx, val){
  const dd = document.getElementById('bkv2-route-dd-' + idx);
  if(!dd) return;
  const opts = bookingV2RouteDDOpts();
  const q = String(val||'').trim().toLowerCase();
  const filtered = !q ? opts : opts.filter(o => o.label.toLowerCase().includes(q) || o.id.toLowerCase().includes(q));
  if(filtered.length === 0){ dd.innerHTML = '<div class="bkv2-nb-dd-empty">no route matches · agent rate type may not cover this</div>'; return; }
  _bkV2RouteDDActive = Math.min(_bkV2RouteDDActive, filtered.length - 1);
  /* §pierHd · คั่นด้วยหัวชื่อท่าแทนชิป TL/VP ทุกแถว
     หัวขึ้นเฉพาะท่าที่ยังมีผลลัพธ์หลังกรอง · พิมพ์ "phi" แล้วหัวทับละมุต้องหายไปด้วย
     ไม่งั้นจะมีหัวลอยที่ไม่มีอะไรอยู่ข้างใต้
     หัวไม่ใช่ .bkv2-nb-dd-item · ปุ่มลูกศรขึ้น-ลงที่นับเฉพาะ item จึงข้ามหัวเอง */
  const shown = filtered.slice(0, 30);
  let html = '', lastPier = null;
  shown.forEach((o, i) => {
    if(o.pierId !== lastPier){
      lastPier = o.pierId;
      const nm = (typeof laPierName === 'function') ? laPierName(o.pierId) : (o.pier || '');
      const _cnt = shown.filter(x => x.pierId === o.pierId).length;
      html += `<div style="display:flex;align-items:baseline;gap:8px;padding:9px 14px 5px;background:#F7F7F5;border-top:1px solid #ECEBE6;pointer-events:none;user-select:none"><span style="font-size:10px;font-weight:700;letter-spacing:.10em;text-transform:uppercase;color:#3E4658">${nm}</span><span style="margin-left:auto;font-family:'DM Mono',monospace;font-size:11.5px;color:#5B6170">${_cnt}</span></div>`;
    }
    html += `<div class="bkv2-nb-dd-item${i === _bkV2RouteDDActive ? ' active' : ''}" data-label="${String(o.label).replace(/"/g,'&quot;')}" onmousedown="event.preventDefault();bookingV2RouteDDPick(${idx}, this.dataset.label)" style="display:flex;align-items:center;gap:10px;min-height:38px;padding:0 14px;border-radius:0;border-top:1px solid #F1F0EC">
      <span style="flex:none;width:12px;height:12px;border-radius:4px;background:${(typeof tsRouteColor==='function') ? tsRouteColor(o.id) : '#8b909c'}"></span>
      <span class="bkv2-nb-dd-name" style="font-size:13.5px;font-weight:600;color:#0F1B3D">${o.label}</span>
    </div>`;
  });
  dd.innerHTML = html;
}
