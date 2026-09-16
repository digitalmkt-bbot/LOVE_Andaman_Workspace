function bookingV2NatDDRender(key){
  const ids = bookingV2NatDDIds(key);
  const inp = document.getElementById(ids.inp);
  const dd  = document.getElementById(ids.dd);
  if(!inp || !dd) return;
  const q = String(inp.value||'').trim().toLowerCase();
  const ALL = bookingV2AllNats();
  const opts = !q ? ALL : ALL.filter(n =>
    n.name.toLowerCase().includes(q) || n.code.toLowerCase().includes(q)
  );
  // Show an explicit "+ Add" row when the typed text has no exact name/code match.
  const rawTyped = String(inp.value||'').trim();
  const exact = !!rawTyped && ALL.some(n =>
    n.name.toLowerCase() === rawTyped.toLowerCase() ||
    n.code.toLowerCase() === rawTyped.toLowerCase()
  );
  const canAdd = rawTyped.replace(/[^A-Za-z฀-๿]/g,'').length >= 2;
  const addRow = (rawTyped && !exact && canAdd)
    ? `<div class="bkv2-nb-dd-item bkv2-nat-addnew" onmousedown="event.preventDefault();bookingV2NatDDAddNew('${key}')">
         <span class="bkv2-nb-dd-mkt" style="color:#1683C7;font-weight:700">+</span>
         <span class="bkv2-nb-dd-name">Add &quot;${rawTyped.replace(/"/g,'&quot;')}&quot; as new nationality</span>
       </div>`
    : '';
  if(opts.length === 0 && !addRow){
    dd.innerHTML = '<div class="bkv2-nb-dd-empty">no match — type at least 2 letters to add</div>';
    return;
  }
  _bkV2NatDDActive = Math.min(_bkV2NatDDActive, opts.length - 1);
  dd.innerHTML = opts.slice(0, 30).map((n, i) =>
    `<div class="bkv2-nb-dd-item${i === _bkV2NatDDActive ? ' active' : ''}" data-code="${n.code}" data-name="${String(n.name).replace(/"/g,'&quot;')}" onmousedown="event.preventDefault();bookingV2NatDDPick('${key}','${n.code}')">
       <span class="bkv2-nb-dd-mkt">${n.code}</span>
       <span class="bkv2-nb-dd-name">${n.name}</span>
     </div>`
  ).join('') + addRow;
}
