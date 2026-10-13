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
  try{ bkVcCSS(); }catch(_){}
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

      <!-- §vc2 · document on the left (fixed 900px) · use / staff / activity on the right -->
      <div class="bkvc2-grid">
        <div class="bkvc2-main">

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

          <!-- §vc2 · the sheet that goes out · agent copy or guest copy -->
          <div class="bkvc2-hold">${bkVcDoc(bk, bkVcMode())}</div>
          <!-- §vc2d · the PAYMENT strip under the sheet was removed on request (2026-10-09) -->

        </div>

        <!-- RIGHT · use this voucher, then staff-only details, then activity -->
        <div class="bkvc2-side">

          ${bkVcUseCard(bk)}
          ${bkVcStaffCard(bk)}

          ${bkVcActivityCard(bk)}

        </div>
      </div>
    </div>
  `;
}
