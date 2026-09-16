// Right-column live Review · summarizes what's been filled
function bookingV2RenderReviewPanel(){
  const d = _bkV2.newBooking;
  const escapeHTML = s => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  if(!d.agentId){
    return `<div style="background:#fafafa;border:1px dashed var(--border);border-radius:var(--r-sm);padding:18px 14px;font-size:11px;color:var(--ink-soft);font-style:italic;text-align:center">Pick an agent to see live booking review</div>`;
  }
  const agent = sbGetAgent(d.agentId);
  const q = bookingV2CalcQuote();
  const totPax = d.trips.reduce((s,t) => s + bookingV2PaxAllTot(t.pax), 0);
  const totAd = d.trips.reduce((s,t) => s + bookingV2PaxTot(t.pax,'ad'), 0);
  const pickupArea = bookingV2GetArea(d.pickupAreaId);
  const dropArea = d.dropoffSame ? null : bookingV2GetArea(d.dropoffAreaId);

  const fmtMoney = n => `<span style="font-family:Manrope,sans-serif;font-weight:700;font-variant-numeric:tabular-nums">฿${(n||0).toLocaleString()}</span>`;
  const fmtNum = n => `<span style="font-family:Manrope,sans-serif;font-weight:600;font-variant-numeric:tabular-nums">${n||0}</span>`;

  // Trips block · with allotment summary
  const tripsHtml = d.trips.filter(t => t.routeId).map((t, i) => {
    const route = (typeof ROUTES!=='undefined') ? ROUTES.find(r => r.id === t.routeId) : null;
    const tp = bookingV2PaxAllTot(t.pax);
    const sub = bookingV2TripSubtotal(t);
    // Allotment chip
    let allotChip = '';
    if(t.date && typeof getAllotment === 'function'){
      const al = getAllotment(t.routeId, t.date, _bkV2.editingId || null);   // exclude own seats when editing
      const isOver = al.hasAllotment && tp > al.seatsAvailable && tp > 0;
      if(!al.hasAllotment){
        allotChip = ((typeof laIsLandRoute==='function') && laIsLandRoute(t.routeId))   // §otherPier
          ? `<span style="background:#F3EAFB;border:1px dashed #D7B5F0;color:#5B289A;font-size:9px;padding:1px 5px;border-radius:3px;font-weight:600">NO LIMIT</span>`
          : `<span style="background:#fafafa;border:1px dashed #d3d1c7;color:#5A5A52;font-size:9px;padding:1px 5px;border-radius:3px;font-weight:600">PROVISIONAL</span>`;
      } else if(isOver){
        allotChip = `<span style="background:#FDE7E7;color:#a32d2d;font-size:9px;padding:1px 5px;border-radius:3px;font-weight:700">OVER ${tp}/${al.seatsAvailable}</span>`;
      } else if(al.state === 'full'){
        allotChip = `<span style="background:#FDE7E7;color:#a32d2d;font-size:9px;padding:1px 5px;border-radius:3px;font-weight:700">FULL</span>`;
      } else if(al.state === 'tight'){
        allotChip = `<span style="background:#FFF6E5;color:#A05A1A;font-size:9px;padding:1px 5px;border-radius:3px;font-weight:600">${al.seatsAvailable} left</span>`;
      } else {
        allotChip = `<span style="background:#E1F5EE;color:#0F6E56;font-size:9px;padding:1px 5px;border-radius:3px;font-weight:600">${al.seatsAvailable} free</span>`;
      }
    }
    const modeChip = t.bookingMode === 'charter'
      ? `<span style="background:#F4E8FB;color:#6B289A;font-size:9px;padding:1px 5px;border-radius:3px;font-weight:700;letter-spacing:.04em">CHARTER${sub.boatName?' · '+escapeHTML(sub.boatName):''}</span>`
      : '';
    return `
      <div style="padding:6px 0;border-bottom:1px solid #f5f3ef;font-size:11px;line-height:1.4">
        <div style="display:flex;align-items:baseline;justify-content:space-between;gap:6px">
          <div style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;color:var(--ink)" title="${escapeHTML(route?.name||t.routeId)}">${i+1}. ${escapeHTML(route?.name||t.routeId)}</div>
          ${(function(){ /* §b2cEdit · ใบ B2C ยอดรายทริปเป็นของจริง ไม่ต้องขีดฆ่า */
            var _b2c=(typeof bookingV2IsB2CBk==='function')&&bookingV2IsB2CBk(d);
            if(_b2c) return `<div>${fmtMoney(Number(t.subtotal)||0)}</div>`;
            return `<div ${d.priceMode==='manual'?'style="text-decoration:line-through;opacity:.5" title="Rate-type reference — Manual total used"':''}>${fmtMoney(sub.total)}</div>`;
          })()}
        </div>
        <div style="font-family:Manrope,sans-serif;font-variant-numeric:tabular-nums;display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:3px">
          <span style="font-size:11.5px;font-weight:700;color:var(--ink)">${t.date ? escapeHTML(t.date) : '<span style="color:#a32d2d">no date</span>'}</span>
          <span style="color:var(--ink-soft)">&middot;</span>
          <span style="font-size:11.5px;font-weight:700;color:var(--ink)">${tp} pax</span>
          <span style="font-size:9px;font-weight:600;color:var(--ink-soft);background:#efece6;padding:1px 6px;border-radius:4px;letter-spacing:.02em">${escapeHTML(t.zone)}</span>
          ${modeChip} ${allotChip}
        </div>
      </div>
    `;
  }).join('');

  // Add-ons block
  const addOnsHtml = d.addOns.length > 0 ? `
    <div class="rv-section">
      <div class="rv-lab">Add-ons (${fmtNum(d.addOns.length)})</div>
      ${d.addOns.map(a => {
        const info = bookingV2AddOnInfo(a.type);
        const q = a.qty||1; const amt = info.total*q;
        const ql = (a.type==='longtail-charter'&&q>1)?` <span style="color:var(--bk-navy);font-weight:700">× ${q} ลำ</span>`:'';
        const _nt=(a.note||'').trim();
        return `<div style="display:flex;justify-content:space-between;gap:6px;font-size:11px;color:var(--ink-soft);margin-top:2px">
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${escapeHTML(info.label||a.type)}${ql}${_nt?` <span style="color:#9A5B00" title="${escapeHTML(_nt)}">&#128221; ${escapeHTML(_nt)}</span>`:''}</span>
          <span>${fmtMoney(amt)}</span>
        </div>`;
      }).join('')}
    </div>
  ` : '';

  // Special meals
  const m = d.specialMeals || {};
  const mealCount = (m.veg||0) + (m.vegan||0) + (m.halal||0);
  const _allergTxtRv=(typeof bookingV2AllergyText==='function')?bookingV2AllergyText(m):(m.allergies||'').trim();
  const mealHtml = (mealCount > 0 || _allergTxtRv || (d.largeLuggage||0) > 0) ? `
    <div class="rv-section">
      <div class="rv-lab">Special</div>
      ${m.veg ? `<div style="font-size:11px;color:var(--ink-soft);margin-top:2px">🥬 ${fmtNum(m.veg)} vegetarian</div>` : ''}
      ${m.vegan ? `<div style="font-size:11px;color:var(--ink-soft);margin-top:2px">🌱 ${fmtNum(m.vegan)} vegan</div>` : ''}
      ${m.halal ? `<div style="font-size:11px;color:var(--ink-soft);margin-top:2px">🕌 ${fmtNum(m.halal)} halal</div>` : ''}
      ${_allergTxtRv ? `<div style="font-size:10px;color:var(--ink-soft);margin-top:2px;font-style:italic;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHTML(_allergTxtRv)}">⚠ ${escapeHTML(_allergTxtRv)}</div>` : ''}
      ${d.largeLuggage ? `<div style="font-size:11px;color:var(--ink-soft);margin-top:2px">🧳 ${fmtNum(d.largeLuggage)} large bag${d.largeLuggage===1?'':'s'}</div>` : ''}
    </div>
  ` : '';

  // Cash on Tour
  const cotHtml = d.cashOnTour ? `
    <div class="rv-section" style="background:#FFF6E5;border:1px solid #EAD9B0;border-radius:var(--r-sm);padding:6px 9px;margin-top:8px">
      <div style="font-size:9px;color:#633806;font-weight:700;letter-spacing:.06em">💰 CASH ON TOUR</div>
      <div id="bkv2-cot-rv-amt" style="font-size:11px;color:#633806;font-weight:700;margin-top:2px;font-family:Manrope,sans-serif;font-variant-numeric:tabular-nums">${escapeHTML(d.cashOnTour.currency||'THB')} ${(d.cashOnTour.amount||0).toLocaleString()}</div>
      <div style="font-size:9px;color:#633806;margin-top:1px">${d.cashOnTour.handling === 'deduct' ? 'Deduct from invoice' : 'Keep separate'}</div>
      <div id="bkv2-cot-rv-note" style="font-size:9.5px;color:#7a5a14;margin-top:3px;line-height:1.35;border-top:1px dashed #EAD9B0;padding-top:3px;display:${(d.cashOnTour.note||'').trim()?'block':'none'}">${(d.cashOnTour.note||'').trim()?'📝 '+escapeHTML(d.cashOnTour.note):''}</div>
    </div>
  ` : '';

  return `
    <style>
      #view-booking .rv-card{background:#fafafa;border:1px solid var(--border);border-radius:var(--r-sm);padding:12px 14px;font-family:'DM Sans',sans-serif}
      #view-booking .rv-section{padding:8px 0;border-bottom:1px solid #f5f3ef}
      #view-booking .rv-section:last-child{border-bottom:none}
      #view-booking .rv-lab{font-size:9px;color:var(--ink-soft);font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:3px}
      #view-booking .rv-val{font-size:12px;color:var(--ink);font-weight:600}
      #view-booking .rv-sub{font-size:10px;color:var(--ink-soft);margin-top:1px;font-family:Manrope,sans-serif;font-variant-numeric:tabular-nums}
      #view-booking .rv-total{padding:10px 12px;background:var(--bk-navy-50);border:1px solid var(--bk-navy-light);border-radius:var(--r-sm);margin-top:10px;display:flex;align-items:baseline;justify-content:space-between;gap:8px}
      #view-booking .rv-total-lab{font-size:10px;color:var(--bk-navy);font-weight:700;letter-spacing:.08em}
      #view-booking .rv-total-amt{font-family:Manrope,sans-serif;font-size:18px;font-weight:700;color:#0F6E56;font-variant-numeric:tabular-nums;letter-spacing:-.01em}
    </style>
    <div class="rv-card">
      <div class="rv-section">
        <div class="rv-lab">Agent</div>
        <div class="rv-val">${escapeHTML(agent?.name||'—')}</div>
        ${d.voucherRef ? `<div class="rv-sub">Voucher: ${escapeHTML(d.voucherRef)}</div>` : ''}
      </div>
      ${d.trips.some(t=>t.routeId) ? `
        <div class="rv-section">
          <div class="rv-lab">Trips · ${fmtNum(d.trips.filter(t=>t.routeId).length)}</div>
          ${tripsHtml}
        </div>
      ` : ''}
      ${totPax > 0 ? `
        <div class="rv-section">
          <div class="rv-lab">Guests · ${fmtNum(totPax)} pax</div>
          <div class="rv-val">${d.leadPax ? escapeHTML(d.leadPax) : '<span style="color:#a32d2d;font-style:italic">no lead name</span>'}</div>
          ${d.leadPhone ? `<div class="rv-sub">📞 ${escapeHTML(d.leadPhone)}</div>` : ''}
          ${totAd > 1 ? `<div class="rv-sub">+ ${fmtNum(totAd - 1)} additional adult${totAd>2?'s':''}</div>` : ''}
        </div>
      ` : ''}
      ${pickupArea ? `
        <div class="rv-section">
          <div class="rv-lab">Pickup</div>
          ${d.hotelName
            ? `<div class="rv-val" style="font-size:13.5px;line-height:1.3">${escapeHTML(d.hotelName)}</div>
               <div class="rv-sub" style="text-transform:none">${escapeHTML(pickupArea.name)}${d.roomNumber?' · Room '+escapeHTML(d.roomNumber):''}</div>`
            : `<div class="rv-val" style="font-size:13.5px;line-height:1.3">${escapeHTML(pickupArea.name)}</div>
               ${d.roomNumber?`<div class="rv-sub">Room ${escapeHTML(d.roomNumber)}</div>`:''}`}
          ${dropArea ? `<div class="rv-sub">↪ Drop: ${escapeHTML(dropArea.name)}</div>` : ''}
        </div>
      ` : ''}
      ${(Array.isArray(d.altPickups) && d.altPickups.some(a=>(a.who||'').trim()||(a.place||'').trim())) ? `
        <div class="rv-section">
          <div class="rv-lab">🚌 รับหลายจุด</div>
          ${d.altPickups.filter(a=>(a.who||'').trim()||(a.place||'').trim()||a.areaId).map(a=>{const _ar=a.areaId&&typeof bookingV2GetArea==='function'?bookingV2GetArea(a.areaId):null;const _z=(a.zone||(_ar?_ar.zone:''));const _zl=(_z==='PK'?'PK':_z==='KL'?'KL':_z==='NoTransfer'?'NT':'');const _loc=(a.place||'').trim()||(_ar?_ar.name:'')||'—';const _q=Math.max(1,parseInt(a.qty)||1);return `<div class="rv-sub" style="text-transform:none;color:#5B289A"><b>${_q} คน</b> · ${escapeHTML((a.who||'').trim()||'—')}${_zl?` <span style="font-size:8px;font-weight:700;background:#EDE7FB;padding:0 4px;border-radius:3px">${_zl}</span>`:''} · ${escapeHTML(_loc)}</div>`;}).join('')}
        </div>
      ` : ''}
      ${addOnsHtml}
      ${mealHtml}
      ${cotHtml}
      ${(() => {
        const esc = escapeHTML;
        const rows = (d.adjustments||[]).map((a,i) => {
          const disc = a.kind === 'discount';
          const v = Number(a.value) || 0;
          const amt = disc ? (a.mode === 'percent' ? Math.round(q.base * v / 100) : Math.round(v)) : Math.round(v);
          const col = disc ? '#A32D2D' : '#0F7A5A';
          return `
            <div style="background:#fff;border:1px solid var(--border);border-radius:6px;padding:6px 8px;margin-top:6px;display:flex;align-items:center;gap:5px;flex-wrap:wrap">
              <span style="font-size:8px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:${col};background:${disc?'#FDECEA':'#E1F5EE'};padding:2px 5px;border-radius:4px">${disc?'Disc':'Extra'}</span>
              <input value="${esc(a.label)}" oninput="bookingV2SetAdjustment(${i},'label',this.value)" placeholder="Label" style="flex:1;min-width:70px;font-size:11px;padding:3px 6px">
              ${disc?`<span style="display:inline-flex;border:1px solid var(--border);border-radius:5px;overflow:hidden">
                <button onclick="bookingV2SetAdjustment(${i},'mode','amount')" style="border:none;cursor:pointer;font-family:inherit;font-size:11px;padding:3px 7px;background:${a.mode!=='percent'?'var(--bk-navy)':'#fff'};color:${a.mode!=='percent'?'#fff':'var(--ink-soft)'}">฿</button>
                <button onclick="bookingV2SetAdjustment(${i},'mode','percent')" style="border:none;cursor:pointer;font-family:inherit;font-size:11px;padding:3px 7px;background:${a.mode==='percent'?'var(--bk-navy)':'#fff'};color:${a.mode==='percent'?'#fff':'var(--ink-soft)'}">%</button>
              </span>`:''}
              <input type="number" min="0" value="${v||''}" onchange="bookingV2SetAdjustment(${i},'value',this.value)" placeholder="0" style="width:64px;font-size:12px;padding:3px 6px;text-align:right;font-family:Manrope,sans-serif;font-variant-numeric:tabular-nums">
              <span style="min-width:62px;text-align:right;font-family:Manrope,sans-serif;font-weight:700;font-variant-numeric:tabular-nums;color:${col}">${disc?'&minus;':'+'}฿${amt.toLocaleString()}</span>
              <button onclick="bookingV2RemoveAdjustment(${i})" title="Remove" style="border:none;background:transparent;cursor:pointer;color:var(--ink-soft);font-size:15px;line-height:1">&times;</button>
              <input value="${esc(a.note)}" oninput="bookingV2SetAdjustment(${i},'note',this.value)" placeholder="Note (optional)" style="flex:1 1 100%;font-size:11px;padding:3px 6px;color:var(--ink-soft)">
            </div>`;
        }).join('');
        return `
          <div class="rv-section">
            <div class="rv-lab">Adjustments</div>
            ${rows}
            <div style="display:flex;gap:7px;margin-top:7px">
              <button onclick="bookingV2AddAdjustment('discount')" style="font-size:11px;font-weight:600;color:#A32D2D;background:#FDECEA;border:1px solid #F5C9C4;border-radius:6px;padding:5px 10px;cursor:pointer;font-family:inherit">+ Discount</button>
              <button onclick="bookingV2AddAdjustment('extra')" style="font-size:11px;font-weight:600;color:#0F7A5A;background:#E1F5EE;border:1px solid #B8E5D2;border-radius:6px;padding:5px 10px;cursor:pointer;font-family:inherit">+ Extra charge</button>
            </div>
          </div>`;
      })()}
      ${(q.totalDiscount>0||q.totalExtra>0) ? `
        <div style="display:grid;grid-template-columns:1fr auto;gap:3px 10px;font-size:11px;padding:8px 0 0">
          <span style="color:var(--ink-soft)">Subtotal</span><span style="text-align:right;font-family:Manrope,sans-serif;font-variant-numeric:tabular-nums">฿${q.base.toLocaleString()}</span>
          ${q.totalDiscount>0?`<span style="color:#A32D2D">Discount</span><span style="text-align:right;font-family:Manrope,sans-serif;color:#A32D2D;font-variant-numeric:tabular-nums">&minus;฿${q.totalDiscount.toLocaleString()}</span>`:''}
          ${q.totalExtra>0?`<span style="color:#0F7A5A">Extra charge</span><span style="text-align:right;font-family:Manrope,sans-serif;color:#0F7A5A;font-variant-numeric:tabular-nums">+฿${q.totalExtra.toLocaleString()}</span>`:''}
        </div>` : ''}
      <div class="rv-total">
        <span class="rv-total-lab">QUOTE TOTAL</span>
        <span class="rv-total-amt">฿${q.grandTotal.toLocaleString()}</span>
      </div>
      ${q.totalFoc > 0 ? `<div style="font-size:10px;color:#A05A1A;margin-top:6px;text-align:center;font-style:italic">${q.totalFoc} FOC · ฿${q.focDiscount.toLocaleString()} forgone</div>` : ''}
    </div>
  `;
}
