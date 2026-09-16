function bookingV2RenderQuoteSection(){
  const d = _bkV2.newBooking;
  const rt = bookingV2GetRT();
  if(!rt) return '';
  const q = bookingV2CalcQuote();
  const hasTrip = d.trips.some(t => t.routeId && t.date);
  if(!hasTrip) return '';

  const esc = s => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const adjRows = (d.adjustments||[]).map((a,i) => {
    const disc = a.kind === 'discount';
    const v = Number(a.value) || 0;
    const amt = disc ? (a.mode === 'percent' ? Math.round(q.base * v / 100) : Math.round(v)) : Math.round(v);
    const col = disc ? '#A32D2D' : '#0F7A5A';
    return `
      <div style="background:var(--white);border:1px solid var(--border);border-radius:var(--r-sm);padding:7px 9px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <span style="font-size:8px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:${col};background:${disc?'#FDECEA':'#E1F5EE'};padding:2px 6px;border-radius:4px">${disc?'Discount':'Extra'}</span>
        <input value="${esc(a.label)}" oninput="bookingV2SetAdjustment(${i},'label',this.value)" placeholder="${disc?'Discount label':'Charge label'}" style="flex:1;min-width:90px;font-size:11px;padding:4px 7px">
        ${disc?`<span style="display:inline-flex;border:1px solid var(--border);border-radius:5px;overflow:hidden">
          <button onclick="bookingV2SetAdjustment(${i},'mode','amount')" style="border:none;cursor:pointer;font-family:inherit;font-size:11px;padding:4px 8px;background:${a.mode!=='percent'?'var(--bk-navy)':'var(--white)'};color:${a.mode!=='percent'?'#fff':'var(--ink-soft)'}">฿</button>
          <button onclick="bookingV2SetAdjustment(${i},'mode','percent')" style="border:none;cursor:pointer;font-family:inherit;font-size:11px;padding:4px 8px;background:${a.mode==='percent'?'var(--bk-navy)':'var(--white)'};color:${a.mode==='percent'?'#fff':'var(--ink-soft)'}">%</button>
        </span>`:''}
        <input type="number" min="0" value="${v||''}" onchange="bookingV2SetAdjustment(${i},'value',this.value)" placeholder="0" style="width:74px;font-size:12px;padding:4px 7px;text-align:right;font-family:Manrope,sans-serif;font-variant-numeric:tabular-nums">
        <span style="min-width:74px;text-align:right;font-family:Manrope,sans-serif;font-weight:700;font-variant-numeric:tabular-nums;color:${col}">${disc?'&minus;':'+'}฿${amt.toLocaleString()}</span>
        <button onclick="bookingV2RemoveAdjustment(${i})" title="Remove" style="border:none;background:transparent;cursor:pointer;color:var(--ink-soft);font-size:15px;line-height:1;padding:0 2px">&times;</button>
        <input value="${esc(a.note)}" oninput="bookingV2SetAdjustment(${i},'note',this.value)" placeholder="Note (optional)" style="flex:1 1 100%;font-size:11px;padding:4px 7px;color:var(--ink-soft)">
      </div>`;
  }).join('');

  return `
    <div class="bkv2-nb-sec" style="background:var(--bk-navy-50)">
      <div class="bkv2-nb-sec-h">&#9679; Quote Summary</div>
      <div style="display:grid;grid-template-columns:1fr 130px;gap:6px 14px;font-size:12px;line-height:1.6">
        <div style="color:var(--ink-soft)">Seat rates (${d.trips.filter(t=>t.routeId).length} trip${d.trips.filter(t=>t.routeId).length===1?'':'s'})</div>
        <div style="text-align:right;font-family:Manrope,sans-serif;font-weight:600;color:var(--ink);font-variant-numeric:tabular-nums">฿${q.totalSeat.toLocaleString()}</div>
        ${q.totalAddOn>0?`<div style="color:var(--ink-soft)">Add-ons (${d.addOns.length})</div><div style="text-align:right;font-family:Manrope,sans-serif;font-weight:600;color:var(--ink);font-variant-numeric:tabular-nums">฿${q.totalAddOn.toLocaleString()}</div>`:''}
        ${q.totalFoc>0?`<div style="color:#ba7517">FOC × ${q.totalFoc} <span style="font-size:10px">· not charged · ฿${q.focDiscount.toLocaleString()} forgone</span></div><div style="text-align:right;font-family:Manrope,sans-serif;font-weight:600;color:#ba7517;font-variant-numeric:tabular-nums">&minus;฿${q.focDiscount.toLocaleString()}</div>`:''}
        ${q.totalDiscount>0?`<div style="color:#A32D2D">Discount</div><div style="text-align:right;font-family:Manrope,sans-serif;font-weight:600;color:#A32D2D;font-variant-numeric:tabular-nums">&minus;฿${q.totalDiscount.toLocaleString()}</div>`:''}
        ${q.totalExtra>0?`<div style="color:#0F7A5A">Extra charge</div><div style="text-align:right;font-family:Manrope,sans-serif;font-weight:600;color:#0F7A5A;font-variant-numeric:tabular-nums">+฿${q.totalExtra.toLocaleString()}</div>`:''}
        <div style="border-top:2px solid var(--bk-navy);padding-top:8px;margin-top:4px;color:var(--ink);font-weight:700;font-size:13px">Total</div>
        <div style="border-top:2px solid var(--bk-navy);padding-top:8px;margin-top:4px;text-align:right;font-family:Manrope,sans-serif;font-weight:700;color:var(--bk-navy);font-size:20px;font-variant-numeric:tabular-nums;letter-spacing:-.02em">฿${q.grandTotal.toLocaleString()}</div>
      </div>
      ${adjRows?`<div style="display:flex;flex-direction:column;gap:6px;margin-top:10px">${adjRows}</div>`:''}
      <div style="display:flex;gap:8px;margin-top:8px">
        <button onclick="bookingV2AddAdjustment('discount')" style="font-size:11px;font-weight:600;color:#A32D2D;background:#FDECEA;border:1px solid #F5C9C4;border-radius:var(--r-sm);padding:6px 11px;cursor:pointer;font-family:inherit">+ Add discount</button>
        <button onclick="bookingV2AddAdjustment('extra')" style="font-size:11px;font-weight:600;color:#0F7A5A;background:#E1F5EE;border:1px solid #B8E5D2;border-radius:var(--r-sm);padding:6px 11px;cursor:pointer;font-family:inherit">+ Add extra charge</button>
      </div>
    </div>
  `;
}
