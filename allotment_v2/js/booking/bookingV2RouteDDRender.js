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
      html += `<div class="bkv2-nb-dd-hd"><span class="lb">${nm}</span><span class="ln"></span></div>`;
    }
    html += `<div class="bkv2-nb-dd-item${i === _bkV2RouteDDActive ? ' active' : ''}" data-label="${String(o.label).replace(/"/g,'&quot;')}" onmousedown="event.preventDefault();bookingV2RouteDDPick(${idx}, this.dataset.label)">
      <span class="bkv2-nb-dd-name">${o.label}</span>
    </div>`;
  });
  dd.innerHTML = html;
}
