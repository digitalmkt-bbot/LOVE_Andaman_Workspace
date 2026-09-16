function bookingV2RenderBookingDetail(){
  const bk = bookingV2GetDetailBooking();
  const escapeHTML = s => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  if(!bk){
    return `
      <div class="bkv2-nb bkv2-vc" style="padding:24px">
        <div class="bkv2-nb-topbar" style="margin-right:0">
          <button class="bkv2-nb-back" onclick="bookingV2CloseDetail()">${bookingV2DetailIcon('back',13)} Back to list</button>
          <div class="bkv2-nb-title">Booking not found</div>
        </div>
        <div style="padding:40px;text-align:center;color:var(--ink-soft)">
          The booking <code>${escapeHTML(_bkV2.detailId)}</code> was not found.
        </div>
      </div>
    `;
  }
  const isV2 = bk.schemaVer === 2;
  const n = bookingV2Norm(bk);
  const statusLbl = bookingV2StatusLabel(bk.status);
  const canCancel = !['cancelled','completed','rejected'].includes(bk.status);
  const canEdit = isV2 && !['cancelled','rejected'].includes(bk.status);
  const foc = bk.focApproval || null;
  const focPending = foc?.status === 'pending';

  // Agent info lookup
  const agent = bk.agentId ? sbGetAgent(bk.agentId) : null;
  const rt = bk.rateTypeRef ? SB_RATE_TYPES.find(r=>r.id===bk.rateTypeRef) : null;
  const b2c = bk.b2cChannel ? sbGetB2C(bk.b2cChannel) : null;
  // History timeline (audit trail) · falls back to rebook for bookings created before history logging
  // Booking-date record + lead time + market (for forecasting context)
  const _bkDate = bk.bookingDate || bk.createdAt;
  const _firstTrip = (bk.trips||[]).map(t=>t.date).filter(Boolean).sort()[0];
  let _leadTxt = '';
  if(_bkDate && _firstTrip){ const dd=Math.round((new Date(_firstTrip+'T00:00') - new Date(String(_bkDate).slice(0,10)+'T00:00'))/86400000); if(!isNaN(dd)) _leadTxt = ` · ${dd} day${dd===1?'':'s'} lead time`; }
  const _mktSnap = bk.marketSnapshot || {};
  const _mktName = (typeof SB_MARKETS!=='undefined'?SB_MARKETS:[]).find(m=>m.id===_mktSnap.market)?.name || '';
  const _mktTxt = _mktName ? ` · ${_mktName}${_mktSnap.sub?` / ${_mktSnap.sub}`:''}` : '';
  const histList = (Array.isArray(bk.history)?bk.history.slice():[]);
  if(!histList.length && bk.rebook){ histList.push({at:bk.rebook.at,kind:'weather',tag:'Reschedule',text:'Rescheduled · '+bk.rebook.from+' → '+bk.rebook.to+(bk.rebook.reason==='weather'?' (weather)':''),by:'—'}); }

  return `
    <div class="bkv2-nb bkv2-vc" style="padding:24px;background:var(--sand-mid)">
      <!-- TOPBAR -->
      <div class="bkv2-nb-topbar" style="margin-right:0">
        <button class="bkv2-nb-back" onclick="bookingV2CloseDetail()">${bookingV2DetailIcon('back',13)} Back to list</button>
        <div class="bkv2-nb-title">${escapeHTML(bookingV2DisplayCode(bk))}</div>
        <span class="bkv2-chip ${bk.status}" style="font-size:11px"><span class="dot"></span>${statusLbl}</span>
        ${n.focCount>0?`<span class="bkv2-foc-flag">FOC ${n.focCount}${foc?.status?` · ${foc.status}`:''}</span>`:''}
        <div style="margin-left:auto;display:flex;gap:8px">
          ${canEdit?`<button class="bkv2-nb-btn" onclick="bookingV2EditBooking('${bk.id}')" style="display:inline-flex;align-items:center;gap:6px">${bookingV2DetailIcon('edit',13)} Edit</button>`:''}
          ${canCancel?`<button class="bkv2-nb-btn" onclick="bookingV2DetailReschedule('${bk.id}')" style="display:inline-flex;align-items:center;gap:6px;color:#185FA5;border-color:rgba(24,95,165,0.3)">${bookingV2DetailIcon('clock',13)} Reschedule</button>`:''}
          ${canCancel?`<button class="bkv2-nb-btn" onclick="bookingV2DetailPartial('${bk.id}')" style="display:inline-flex;align-items:center;gap:6px;color:#A05A1A;border-color:rgba(160,90,26,0.3)">− Reduce pax</button>`:''}
          ${canCancel?`<button class="bkv2-nb-btn" onclick="bookingV2DetailCancel('${bk.id}')" style="display:inline-flex;align-items:center;gap:6px;color:#c43a2e;border-color:rgba(196,58,46,0.3)">${bookingV2DetailIcon('cancel',13)} Cancel</button>`:''}
          ${['cancelled','cancelled_weather','rejected'].includes(bk.status)?`<button class="bkv2-nb-btn" onclick="bookingV2RestoreBooking('${bk.id}')" style="display:inline-flex;align-items:center;gap:6px;color:#0F6E56;border-color:rgba(15,110,86,0.35)">&#8634; กู้คืน (Restore)</button>`:''}
        </div>
      </div>

      <!-- TICKET hero (boarding-pass style · trip + travel date) -->
      ${bookingV2VoucherTicket(bk, escapeHTML)}

      <!-- 2-col layout · main + sidebar -->
      <div style="display:grid;grid-template-columns:1fr 320px;gap:14px;align-items:start">
        <!-- LEFT main -->
        <div style="display:flex;flex-direction:column;gap:14px;min-width:0">

          ${focPending?`
          <!-- FOC pending banner -->
          <div class="bkv2-nb-card" style="border-color:#F59E0B;background:#FFF7E6">
            <div style="display:flex;align-items:flex-start;gap:12px">
              <div style="width:36px;height:36px;border-radius:50%;background:#F59E0B;color:white;display:flex;align-items:center;justify-content:center;flex-shrink:0">${bookingV2DetailIcon('foc',18)}</div>
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:800;color:#92400E;margin-bottom:4px">FOC Approval Pending · ${foc.count} pax</div>
                <div style="font-size:12px;color:#7C5C0A;line-height:1.5">${escapeHTML(foc.reason||'(no reason given)')}</div>
                <div style="font-size:11px;color:#8B6914;margin-top:6px">Requested by ${escapeHTML(foc.requestedBy||'—')} · ${bookingV2FmtDateTime(foc.requestedAt)}</div>
              </div>
              <div style="display:flex;gap:6px;flex-shrink:0">
                <button onclick="bookingV2FocApprove('${bk.id}')" style="background:#10B981;color:white;border:none;padding:8px 12px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:5px">${bookingV2DetailIcon('check',13)} Approve</button>
                <button onclick="bookingV2FocReject('${bk.id}')" style="background:white;color:#c43a2e;border:1px solid rgba(196,58,46,0.3);padding:8px 12px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:5px">${bookingV2DetailIcon('x',13)} Reject</button>
              </div>
            </div>
          </div>`:''}

          ${foc && foc.status !== 'pending'?`
          <!-- FOC decided history -->
          <div class="bkv2-nb-card" style="border-color:${foc.status==='approved'?'#10B981':'#c43a2e'};background:${foc.status==='approved'?'#ECFDF5':'#FEF2F2'}">
            <div style="display:flex;align-items:center;gap:10px">
              <div style="width:28px;height:28px;border-radius:50%;background:${foc.status==='approved'?'#10B981':'#c43a2e'};color:white;display:flex;align-items:center;justify-content:center;flex-shrink:0">${bookingV2DetailIcon(foc.status==='approved'?'check':'x',14)}</div>
              <div style="flex:1;min-width:0">
                <div style="font-size:12px;font-weight:800;color:${foc.status==='approved'?'#065F46':'#7F1D1D'}">FOC ${foc.status} · ${foc.count} pax</div>
                <div style="font-size:11px;color:${foc.status==='approved'?'#047857':'#991B1B'}">${foc.status==='rejected' && foc.rejectReason?escapeHTML(foc.rejectReason)+' · ':''}by ${escapeHTML(foc.approvedBy||'—')} · ${bookingV2FmtDateTime(foc.approvedAt)}</div>
              </div>
            </div>
          </div>`:''}

          ${bk.cancellation?`
          <!-- CANCELLATION -->
          <div class="bkv2-nb-card" style="border-color:#E89A92;background:#FDEEEC">
            <div style="display:flex;align-items:center;gap:11px">
              <div style="width:30px;height:30px;border-radius:50%;background:#A32D2D;color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0">${bookingV2DetailIcon('cancel',15)}</div>
              <div style="flex:1;min-width:0">
                <div style="font-size:12.5px;font-weight:800;color:#A32D2D">Cancelled · ${bk.cancellation.chargeType==='full'?('Full charge ฿'+Math.round(bk.cancellation.chargeAmount||0).toLocaleString()):bk.cancellation.chargeType==='partial'?('Charge ฿'+Math.round(bk.cancellation.chargeAmount||0).toLocaleString()):'No charge'}</div>
                <div style="font-size:11.5px;color:#8a3a30;line-height:1.5;margin-top:1px">${escapeHTML(bk.cancellation.reason||'(no reason)')}</div>
                <div style="font-size:10px;color:#9a6a62;margin-top:3px">${bookingV2FmtDateTime(bk.cancellation.at)}${bk.cancellation.by?' · by '+escapeHTML(bk.cancellation.by):''}${(bk.cancellation.chargeAmount>0)?' · billed as a cancellation-fee invoice':''}</div>
              </div>
            </div>
          </div>`:''}

          <!-- AGENT & VOUCHER -->
          <div class="bkv2-nb-card">
            <div class="bkv2-nb-sec-hd"><span class="bkv2-nb-sec-dot"></span><span class="bkv2-nb-sec-ttl">Agent &amp; Voucher</span></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;padding-top:4px">
              <div>
                <div class="bkv2-dt-lab">Agent</div>
                <div class="bkv2-dt-val">${escapeHTML(agent?.name || b2c?.name || '—')}${agent?.code?` <span style="color:var(--ink-soft);font-weight:500">· ${escapeHTML(agent.code)}</span>`:''}</div>
                ${rt?`<div class="bkv2-dt-sub">Rate Type: ${escapeHTML(rt.code||'')} · ${escapeHTML(rt.name||'')}</div>`:''}
                ${bk.channelType==='b2c'?`<div class="bkv2-dt-sub">B2C · Direct</div>`:''}
              </div>
              <div>
                <div class="bkv2-dt-lab">Voucher Ref</div>
                <div class="bkv2-dt-val">${escapeHTML(bk.voucherRef || '—')}</div>
                <div class="bkv2-dt-sub"><strong style="color:var(--ink)">Booked ${bookingV2FmtFullDate(_bkDate)}</strong>${_leadTxt}${_mktTxt}</div>
                <div class="bkv2-dt-sub">Submitted by ${escapeHTML(bk.createdBy||'—')}${bk.confirmedBy?` &middot; Confirmed by <strong style="color:#0F6E56">${escapeHTML(bk.confirmedBy)}</strong>`:''}</div>
              </div>
            </div>
          </div>

          <!-- History moved to the right sidebar (below Activity) -->

          <!-- TRIPS & PAX -->
          <div class="bkv2-nb-card">
            <div class="bkv2-nb-sec-hd"><span class="bkv2-nb-sec-dot"></span><span class="bkv2-nb-sec-ttl">Trips &amp; Pax</span></div>
            <div style="display:flex;flex-direction:column;gap:10px;padding-top:4px">
              ${(bk.trips||[]).map((t,i) => {
                const route = ROUTES.find(r => r.id === t.routeId);
                const px = t.pax || {};
                const ad = bookingV2PaxTot(px,'ad'), chd = bookingV2PaxTot(px,'chd'), inf = bookingV2PaxTot(px,'inf'), focN = bookingV2PaxTot(px,'foc');
                /* §trOtherVeh (2026-09-11) · "Other transfer" (TR-OTHER) is quoted per vehicle, not per
                   pax — the B2C mapper already writes "Sedan × 2 · (round trip) · A → B" as the first
                   line of bk.notes (server.js §b2cTransfer), so read the vehicle count back out of it
                   rather than adding a vehQty/vehType column to sb_bookings__trips for one route.
                   Falls back to the normal pax grid if the note doesn't match (e.g. a booking made by
                   hand in ops, with no such note). */
                const _vehM = (route?.extId==='TR-OTHER') ? String(bk.notes||'').split('\n')[0].match(/^(.+?)\s*[×x]\s*(\d+)/i) : null;
                const vehGrid = _vehM ? `
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-family:'DM Mono',monospace">
                      <div><div style="font-size:10px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:0.5px">Vehicle</div><div style="font-size:16px;font-weight:700">${escapeHTML(_vehM[1].trim())} &times; ${escapeHTML(_vehM[2])}</div></div>
                      <div style="text-align:right"><div style="font-size:10px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:0.5px">Subtotal</div><div style="font-size:15px;font-weight:700">฿${bookingV2FmtTHB(t.subtotal||0)}</div></div>
                    </div>` : `
                    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;font-family:'DM Mono',monospace">
                      <div><div style="font-size:10px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:0.5px">Adult</div><div style="font-size:18px;font-weight:700">${ad}</div></div>
                      <div><div style="font-size:10px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:0.5px">Child</div><div style="font-size:18px;font-weight:700">${chd}</div></div>
                      <div><div style="font-size:10px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:0.5px">Infant</div><div style="font-size:18px;font-weight:700">${inf}</div></div>
                      <div><div style="font-size:10px;color:#92400E;text-transform:uppercase;letter-spacing:0.5px">FOC</div><div style="font-size:18px;font-weight:700;color:${focN?'#92400E':'inherit'}">${focN}</div></div>
                      <div style="text-align:right"><div style="font-size:10px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:0.5px">Subtotal</div><div style="font-size:15px;font-weight:700">฿${bookingV2FmtTHB(t.subtotal||0)}</div></div>
                    </div>`;
                return `
                  <div style="border:1px solid rgba(26,35,50,0.08);border-radius:10px;padding:12px 14px;background:white">
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
                      <div style="width:6px;height:24px;border-radius:3px;background:#1F2A44"></div>
                      <div style="flex:1;min-width:0">
                        <div style="font-size:13px;font-weight:800;color:#1F2A44">${escapeHTML(route?.name || t.routeId)}</div>
                        <div style="font-size:11px;color:var(--ink-soft);margin-top:2px">${bookingV2FmtFullDate(t.date)}</div>
                      </div>
                      ${t.charter?`<span style="background:#3A6FF7;color:white;font-size:10px;padding:3px 8px;border-radius:6px;font-weight:700">CHARTER</span>`:''}
                      ${t.bundle?`<span style="background:#10B981;color:white;font-size:10px;padding:3px 8px;border-radius:6px;font-weight:700">${escapeHTML(t.bundle.type||'BUNDLE')} ${t.bundle.mode==='paid'?'paid':'free'}</span>`:''}
                    </div>
                    ${vehGrid}
                  </div>
                `;
              }).join('')}
              ${!(bk.trips||[]).length?'<div style="padding:14px;text-align:center;color:var(--ink-soft);font-size:12px">No trips</div>':''}
            </div>
          </div>

          <!-- GUESTS -->
          <div class="bkv2-nb-card">
            <div class="bkv2-nb-sec-hd"><span class="bkv2-nb-sec-dot"></span><span class="bkv2-nb-sec-ttl">Guests</span></div>
            <div style="padding-top:4px">
              <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;padding:10px 0;border-bottom:1px solid rgba(26,35,50,0.05)">
                <div>
                  <div class="bkv2-dt-lab">Lead Pax</div>
                  <div class="bkv2-dt-val">${escapeHTML(bk.leadPax || '—')}</div>
                  ${bk.leadNationality?`<div class="bkv2-dt-sub">${escapeHTML(bk.leadNationality)}</div>`:''}
                </div>
                <div>
                  <div class="bkv2-dt-lab">Phone</div>
                  <div class="bkv2-dt-val">${escapeHTML(bk.leadPhone || '—')}</div>
                </div>
                <div>
                  <div class="bkv2-dt-lab">Email</div>
                  <div class="bkv2-dt-val">${escapeHTML(bk.leadEmail || '—')}</div>
                </div>
              </div>
              ${(bk.passengers||[]).length?`
                <div style="margin-top:8px">
                  <div class="bkv2-dt-lab" style="margin-bottom:6px">Other passengers · ${bk.passengers.length}</div>
                  <table style="width:100%;border-collapse:collapse;font-size:12px">
                    <thead>
                      <tr style="border-bottom:1px solid rgba(26,35,50,0.08)">
                        <th style="text-align:left;padding:6px 8px;font-weight:700;color:var(--ink-soft);font-size:10px;text-transform:uppercase;letter-spacing:0.5px">#</th>
                        <th style="text-align:left;padding:6px 8px;font-weight:700;color:var(--ink-soft);font-size:10px;text-transform:uppercase;letter-spacing:0.5px">Name</th>
                        <th style="text-align:left;padding:6px 8px;font-weight:700;color:var(--ink-soft);font-size:10px;text-transform:uppercase;letter-spacing:0.5px">Type</th>
                        <th style="text-align:left;padding:6px 8px;font-weight:700;color:var(--ink-soft);font-size:10px;text-transform:uppercase;letter-spacing:0.5px">Nationality</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${bk.passengers.map((p,i)=>`
                        <tr style="border-bottom:1px solid rgba(26,35,50,0.04)">
                          <td style="padding:6px 8px;color:var(--ink-soft)">#${i+2}</td>
                          <td style="padding:6px 8px">${escapeHTML(p.name || '—')}</td>
                          <td style="padding:6px 8px"><span style="background:rgba(26,35,50,0.06);padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700">${escapeHTML(p.type||'AD')}</span></td>
                          <td style="padding:6px 8px">${escapeHTML(p.nationality || '—')}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              `:''}
            </div>
          </div>

          <!-- PICKUP & DROP-OFF -->
          <div class="bkv2-nb-card">
            <div class="bkv2-nb-sec-hd"><span class="bkv2-nb-sec-dot"></span><span class="bkv2-nb-sec-ttl">Pickup &amp; Drop-off</span></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;padding-top:4px">
              <div>
                <div class="bkv2-dt-lab">Pickup</div>
                <div class="bkv2-dt-val">${escapeHTML(bk.pickup || bk.hotelName || '—')}</div>
                ${bk.roomNumber?`<div class="bkv2-dt-sub">Room ${escapeHTML(bk.roomNumber)}</div>`:''}
                ${bk.pickupTime?`<div class="bkv2-dt-sub">${escapeHTML(bk.pickupTime)}</div>`:''}
              </div>
              <div>
                <div class="bkv2-dt-lab">Drop-off</div>
                <div class="bkv2-dt-val">${bk.dropoffSameAsPickup!==false && !bk.dropoffHotelName?'Same as pickup':escapeHTML(bk.dropoffHotelName||'—')}</div>
              </div>
            </div>
            ${(Array.isArray(bk.altPickups)&&bk.altPickups.length)?`
            <div style="margin-top:12px;padding-top:12px;border-top:1px dashed var(--border)">
              <div class="bkv2-dt-lab" style="color:#5B289A">&#128652; รับหลายจุด (บางคนรับคนละที่) · ${bk.altPickups.length} จุด</div>
              <div style="display:flex;flex-direction:column;gap:6px;margin-top:7px">
                ${bk.altPickups.map(a=>{ const _ar=a.areaId&&typeof bookingV2GetArea==='function'?bookingV2GetArea(a.areaId):null; const _z=(a.zone||(_ar?_ar.zone:'')); const _zl=(_z==='PK'?'PK':_z==='KL'?'KL':_z==='NoTransfer'?'NT':''); const _loc=(a.place||'').trim()||(_ar?_ar.name:'')||'—'; const _q=Math.max(1,parseInt(a.qty)||1); return `<div style="display:flex;align-items:center;gap:8px;font-size:12px;flex-wrap:wrap"><span style="background:#EDE7FB;color:#5B289A;font-weight:700;border-radius:6px;padding:1px 8px;font-size:11px">${_q} คน</span><span style="color:var(--ink);font-weight:600">${escapeHTML((a.who||'').trim()||'—')}</span>${_zl?`<span style="background:#F0EBFA;color:#5B289A;font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px">${_zl}</span>`:''}<span style="color:var(--ink-soft)">&rarr; ${escapeHTML(_loc)}</span></div>`; }).join('')}
              </div>
            </div>`:''}
          </div>

          <!-- DIETARY · LUGGAGE · GUIDES -->
          ${(bk.diet||bk.dietNotes||bk.guides||bk.notes||bk.luggage)?`
          <div class="bkv2-nb-card">
            <div class="bkv2-nb-sec-hd"><span class="bkv2-nb-sec-dot"></span><span class="bkv2-nb-sec-ttl">Dietary &amp; Special Requests</span></div>
            <div style="display:flex;flex-direction:column;gap:10px;padding-top:4px">
              ${bk.diet&&Object.values(bk.diet).some(v=>v)?`<div><div class="bkv2-dt-lab">Diet</div><div class="bkv2-dt-val">${Object.entries(bk.diet).filter(([k,v])=>v).map(([k])=>k).join(' · ')}</div></div>`:''}
              ${bk.dietNotes?`<div><div class="bkv2-dt-lab">Allergies / notes</div><div class="bkv2-dt-val" style="white-space:pre-wrap">${escapeHTML(bk.dietNotes)}</div></div>`:''}
              ${bk.luggage&&Object.values(bk.luggage).some(v=>v)?`<div><div class="bkv2-dt-lab">Luggage</div><div class="bkv2-dt-val">${Object.entries(bk.luggage).filter(([k,v])=>v).map(([k])=>k).join(' · ')}</div></div>`:''}
              ${bk.guides&&(Array.isArray(bk.guides)?bk.guides.length:Object.values(bk.guides).some(v=>v))?`<div><div class="bkv2-dt-lab">Guide languages</div><div class="bkv2-dt-val">${Array.isArray(bk.guides)?bk.guides.join(' · '):Object.entries(bk.guides).filter(([k,v])=>v).map(([k])=>k).join(' · ')}</div></div>`:''}
              ${bk.notes?`<div><div class="bkv2-dt-lab">Notes / special request</div><div class="bkv2-dt-val" style="white-space:pre-wrap">${escapeHTML(bk.notes)}</div></div>`:''}
            </div>
          </div>`:''}

          <!-- ADD-ONS -->
          ${(bk.addOns||[]).length?`
          <div class="bkv2-nb-card">
            <div class="bkv2-nb-sec-hd"><span class="bkv2-nb-sec-dot"></span><span class="bkv2-nb-sec-ttl">Add-on Services</span></div>
            <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:6px">
              <tbody>
                ${(bk.addOns||[]).map(a => {
                  /* §addonUnit · show the working, not just the total: "4 × ฿200" under the name.
                     Derived from qty + amount rather than stored, so it cannot drift from the money.
                     Shown only when it divides exactly — a rounded unit price that does not multiply
                     back to the total is worse than no unit price at all. qty is units for a charter
                     (ลำ) and pax for a per-person add-on, so the row stays deliberately unlabelled. */
                  const _q = Math.max(1, Math.round(Number(a.qty) || 1));
                  const _amt = Math.round(Number(a.amount) || 0);
                  const _unit = (_q > 1 && _amt > 0 && _amt % _q === 0) ? (_amt / _q) : null;
                  return `
                  <tr style="border-bottom:1px solid rgba(26,35,50,0.05)">
                    <td style="padding:8px 0">${escapeHTML(a.label || a.type || '—')}${_unit !== null ? `<div style="font-size:11px;color:var(--ink-soft);font-family:'DM Mono',monospace;margin-top:2px">${_q} × ฿${bookingV2FmtTHB(_unit)}</div>` : ''}</td>
                    <td style="padding:8px 0;text-align:right;font-family:'DM Mono',monospace;font-weight:700;vertical-align:top">฿${bookingV2FmtTHB(_amt)}</td>
                  </tr>
                `;}).join('')}
              </tbody>
            </table>
          </div>`:''}

          <!-- PAYMENT & CASH ON TOUR -->
          <div class="bkv2-nb-card">
            <div class="bkv2-nb-sec-hd"><span class="bkv2-nb-sec-dot"></span><span class="bkv2-nb-sec-ttl">Payment</span></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;padding-top:4px">
              <div>
                <div class="bkv2-dt-lab">Method</div>
                ${(function(){
                  // §B2C payment card (2026-08-01): B2C bookings carry their settlement on
                  // paymentSnapshot (paid / paidStatus / deposit / balance, derived server-side from
                  // Σpayments + Σcredits on the B2C order) but this card only ever printed .method —
                  // so a booking the customer had already paid in full read as a bare "bt".
                  // Derived label: settled in full -> prepaid · anything outstanding -> deposit.
                  // NOT "credit": no terms were extended, the balance is due before travel.
                  // B2B is untouched — it keeps the contract method / Net days / contract version.
                  const ps = bk.paymentSnapshot || {};
                  if(bk.agentId !== 'a_b2c'){
                    return `<div class="bkv2-dt-val">${escapeHTML(ps.method || bk.payment || '—')}</div>`
                      + (ps.netDays?`<div class="bkv2-dt-sub">Net ${ps.netDays} days</div>`:'')
                      + (ps.source?`<div class="bkv2-dt-sub">From: ${escapeHTML(ps.source)}${ps.contractVersion?` · ${escapeHTML(ps.contractVersion)}`:''}</div>`:'');
                  }
                  const st   = String(ps.paidStatus||'');
                  const lbl  = st==='paid' ? 'prepaid' : (st ? 'deposit' : (ps.method || '—'));
                  const term = (typeof bookingV2PayLabel==='function' && ps.method) ? bookingV2PayLabel(ps.method) : (ps.method||'');
                  const paid = Number(ps.paid)||0, bal = Number(ps.balance)||0;
                  // Amounts are ORDER-level and ride on the first line of a multi-item order only
                  // (see mapB2CItemBooking · isFirstLine) — the status is on every line. So show
                  // figures when we have them and say what they cover; never print "THB 0 received"
                  // on a sibling line that simply carries no amount.
                  const money = st==='paid' ? 'paid in full'
                    : (paid||bal) ? [paid?`THB ${paid.toLocaleString()} received`:null,
                                     bal ?`balance THB ${bal.toLocaleString()}`:null].filter(Boolean).join(' · ') + ' · order-level'
                    : (st==='unpaid' ? 'not yet paid' : '');
                  return `<div class="bkv2-dt-val">${escapeHTML(lbl)}</div>`
                    + ((term||money)?`<div class="bkv2-dt-sub">${escapeHTML([term,money].filter(Boolean).join(' · '))}</div>`:'')
                    + `<div class="bkv2-dt-sub">From: B2C sync</div>`;
                })()}
              </div>
              <div>
                <div class="bkv2-dt-lab">Cash on Tour</div>
                <div class="bkv2-dt-val">${bk.cashOnTour?escapeHTML(bk.cashOnTour.currency||'THB')+' '+(bk.cashOnTour.amount||0).toLocaleString()+' · '+(bk.cashOnTour.handling==='deduct'?'หักจาก invoice':'แยกต่างหาก'):'—'}</div>
                ${bk.cashOnTour&&(bk.cashOnTour.note||bk.cashOnTour.notes)?`<div class="bkv2-dt-sub">📝 ${escapeHTML(bk.cashOnTour.note||bk.cashOnTour.notes)}</div>`:''}
              </div>
            </div>
          </div>

        </div>

        <!-- RIGHT sidebar · price summary + activity -->
        <div style="display:flex;flex-direction:column;gap:14px;min-width:0">

          <!-- COST SUMMARY -->
          <div class="bkv2-nb-card" style="position:sticky;top:14px">
            <div class="bkv2-nb-sec-hd"><span class="bkv2-nb-sec-dot"></span><span class="bkv2-nb-sec-ttl">Total</span></div>
            <div style="padding-top:8px">
              ${bk.priceBreakdown?`
                ${bk.priceBreakdown.seat?`<div class="bkv2-dt-row"><span>Seat rates</span><span>฿${bookingV2FmtTHB(bk.priceBreakdown.seat)}</span></div>`:''}
                ${bk.priceBreakdown.charter?`<div class="bkv2-dt-row"><span>Charter</span><span>฿${bookingV2FmtTHB(bk.priceBreakdown.charter)}</span></div>`:''}
                ${bk.priceBreakdown.addOn?`<div class="bkv2-dt-row"><span>Add-ons</span><span>฿${bookingV2FmtTHB(bk.priceBreakdown.addOn)}</span></div>`:''}
                ${bk.priceBreakdown.focDiscount?`<div class="bkv2-dt-row" style="color:#A05A1A;font-style:italic"><span>FOC · given free <span style="font-size:10.5px;color:var(--ink-soft);font-style:normal">value forgone · not in total</span></span><span>฿${bookingV2FmtTHB(-bk.priceBreakdown.focDiscount)}</span></div>`:''}
                ${(bk.adjustments||[]).map(a=>{
                  const v=Number(a.value)||0; if(v<=0) return '';
                  const base=(bk.priceBreakdown?(bk.priceBreakdown.seat||0)+(bk.priceBreakdown.addOn||0):0);
                  const amt=a.mode==='percent'?Math.round(base*v/100):Math.round(v);
                  const sub=(a.label?escapeHTML(a.label):'')+(a.mode==='percent'?` (${v}%)`:'')+(a.note?` · ${escapeHTML(a.note)}`:'');
                  if(a.kind==='extra') return `<div class="bkv2-dt-row" style="color:#A05A1A"><span>Extra charge${sub?' · '+sub:''}</span><span>+฿${bookingV2FmtTHB(amt)}</span></div>`;
                  if(a.kind==='discount') return `<div class="bkv2-dt-row" style="color:#A32D2D"><span>Discount${sub?' · '+sub:''}</span><span>−฿${bookingV2FmtTHB(amt)}</span></div>`;
                  return '';
                }).join('')}
              `:''}
              ${(bk.feeItems||[]).map(f=>{ const amt=Math.round(+f.amount||0); if(!amt) return ''; const lbl=escapeHTML(f.label||(f.type==='reschedule'?'Reschedule fee':'Fee')); return `<div class="bkv2-dt-row" style="color:#A05A1A"><span>${lbl}</span><span>+฿${bookingV2FmtTHB(amt)}</span></div>`; }).join('')}
              <div class="bkv2-dt-row" style="border-top:1px solid rgba(26,35,50,0.12);margin-top:10px;padding-top:10px;font-size:18px;font-weight:800;color:#1F2A44">
                <span>Total</span><span>฿${bookingV2FmtTHB((typeof acctBookingTotal==='function')?acctBookingTotal(bk):(bk.total || bk.priceBreakdown?.total || 0))}</span>
              </div>
              <div style="margin-top:8px;font-size:11px;color:var(--ink-soft)">${n.paxTotal} pax · ${escapeHTML(n.paxBreak||'')}</div>
            </div>
          </div>

          <!-- ACTIVITY -->
          <div class="bkv2-nb-card">
            <div class="bkv2-nb-sec-hd"><span class="bkv2-nb-sec-dot"></span><span class="bkv2-nb-sec-ttl">Activity</span></div>
            <div style="padding-top:8px;display:flex;flex-direction:column;gap:8px">
              <div style="display:flex;gap:8px;font-size:11px">
                <div style="width:6px;height:6px;border-radius:50%;background:#10B981;margin-top:5px;flex-shrink:0"></div>
                <div style="flex:1;min-width:0">
                  <div style="font-weight:700;color:#1F2A44">Created</div>
                  <div style="color:var(--ink-soft)">${bookingV2FmtDateTime(bk.createdAt)} · by ${escapeHTML(bk.createdBy||'—')}</div>
                </div>
              </div>
              ${foc?.requestedAt?`
                <div style="display:flex;gap:8px;font-size:11px">
                  <div style="width:6px;height:6px;border-radius:50%;background:#F59E0B;margin-top:5px;flex-shrink:0"></div>
                  <div style="flex:1;min-width:0">
                    <div style="font-weight:700;color:#1F2A44">FOC requested</div>
                    <div style="color:var(--ink-soft)">${bookingV2FmtDateTime(foc.requestedAt)} · ${foc.count} pax</div>
                  </div>
                </div>
              `:''}
              ${foc?.approvedAt?`
                <div style="display:flex;gap:8px;font-size:11px">
                  <div style="width:6px;height:6px;border-radius:50%;background:${foc.status==='approved'?'#10B981':'#c43a2e'};margin-top:5px;flex-shrink:0"></div>
                  <div style="flex:1;min-width:0">
                    <div style="font-weight:700;color:#1F2A44">FOC ${foc.status}</div>
                    <div style="color:var(--ink-soft)">${bookingV2FmtDateTime(foc.approvedAt)} · by ${escapeHTML(foc.approvedBy||'—')}</div>
                  </div>
                </div>
              `:''}
              ${bk.status==='cancelled'?`
                <div style="display:flex;gap:8px;font-size:11px">
                  <div style="width:6px;height:6px;border-radius:50%;background:#c43a2e;margin-top:5px;flex-shrink:0"></div>
                  <div style="flex:1;min-width:0">
                    <div style="font-weight:700;color:#1F2A44">Cancelled</div>
                    <div style="color:var(--ink-soft)">${bookingV2FmtDateTime(bk.cancelledAt)} · by ${escapeHTML(bk.cancelledBy||'—')}</div>
                  </div>
                </div>
              `:''}
            </div>
          </div>

          ${histList.length?`
          <!-- HISTORY / ประวัติ · moved here to sit with Activity -->
          <div class="bkv2-nb-card">
            <div class="bkv2-nb-sec-hd"><span class="bkv2-nb-sec-dot"></span><span class="bkv2-nb-sec-ttl">History</span></div>
            <div style="display:flex;flex-direction:column;padding-top:6px">
              ${histList.slice().reverse().map(h=>{
                const tc=(typeof bookingV2HistTagColor==='function')?bookingV2HistTagColor(h.tag):['#F1EFE8','#5F5E5A'];
                return `
                <div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid rgba(26,35,50,0.05)">
                  <div style="width:8px;height:8px;border-radius:50%;background:${tc[1]};margin-top:5px;flex-shrink:0"></div>
                  <div style="flex:1;min-width:0">
                    <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap">
                      ${h.tag?`<span style="background:${tc[0]};color:${tc[1]};font-size:9.5px;font-weight:700;padding:1px 8px;border-radius:6px;white-space:nowrap">${escapeHTML(h.tag)}</span>`:''}
                      <span style="font-size:12px;color:#1F2A44;line-height:1.4">${escapeHTML(h.text)}</span>
                    </div>
                    <div style="font-size:10.5px;color:var(--ink-soft);margin-top:2px;font-family:'DM Mono',monospace">${bookingV2FmtDateTime(h.at)}${h.by&&h.by!=='—'?' · '+escapeHTML(h.by):''}</div>
                  </div>
                </div>`;}).join('')}
            </div>
          </div>`:''}

        </div>
      </div>
    </div>
  `;
}
