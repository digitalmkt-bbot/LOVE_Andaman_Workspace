// ── Over-capacity Pending-approval queue (manager) ──
function bookingV2RenderApprovals(){
  const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  // §cityTourView · a booking that mixes trip types is shown on BOTH pages (marine page: any trip is marine · land page: any trip is land) — intentional simplification, not a bug. No trips at all → treated as marine (matches this booking's behavior before this filter existed).
  const _ctLandBk=b=>(typeof laIsLandRoute!=='function') ? true : ((b.trips&&b.trips.length) ? b.trips.some(t=>laIsLandRoute(t&&t.routeId)===_bkV2CityTourOnly) : !_bkV2CityTourOnly);
  const pend=(SB_BOOKINGS||[]).filter(b=>b.status==='pending_approval').filter(_ctLandBk);
  const recent=(SB_BOOKINGS||[]).filter(b=>b.approval && b.approval.status && b.approval.status!=='pending').filter(_ctLandBk).sort((a,b)=>String(b.approval.approvedAt||'').localeCompare(String(a.approval.approvedAt||''))).slice(0,15);
  const card=(b)=>{
    const a=sbGetAgent(b.agentId); const ap=b.approval||{};
    const hasCap=(ap.over&&ap.over.length)||ap.totOver>0;
    const hasDisc=(ap.discount||0)>0;
    const accent=hasCap?'#A32D2D':'#A05A1A';
    const rows=(ap.over||[]).map(o=>`<tr><td style="padding:3px 8px">${esc(o.name)}</td><td style="padding:3px 8px;font-family:'DM Mono',monospace">${esc(o.date)}</td><td style="padding:3px 8px;text-align:center;font-family:'DM Mono',monospace">${o.need}</td><td style="padding:3px 8px;text-align:center;font-family:'DM Mono',monospace;color:#A05A1A">+${o.overBy}</td><td style="padding:3px 8px;text-align:center;font-family:'DM Mono',monospace;color:#0F6E56">${o.licFree} license</td></tr>`).join('');
    return `<div style="background:#fff;border:1px solid ${hasCap?'#F0D9D2':'#EAD9B0'};border-left:4px solid ${accent};border-radius:10px;padding:13px 15px;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px">
        <span style="font-family:'DM Mono',monospace;font-weight:700;color:#1B2A55">${esc(b.id)}</span>
        <span style="font-size:12px;color:#555">${esc(b.leadPax||'—')} · ${esc(a?a.name:'')}</span>
        ${hasCap?`<span style="font-size:11px;font-weight:700;color:#A32D2D;background:#FCEBEB;border-radius:6px;padding:2px 9px">เกิน cap +${ap.totOver||0} ที่นั่ง</span>`:''}
        ${(!hasCap&&!hasDisc)?(function(){ const w=ap.reason||((typeof bookingV2PendReason==='function')?bookingV2PendReason(b):'');
            const cl=w==='closed_day'; return `<span style="font-size:11px;font-weight:700;color:${cl?'#A32D2D':'#7A4A00'};background:${cl?'#FCEBEB':'#FBF0DD'};border-radius:6px;padding:2px 9px" title="${cl?'ขายเข้ามาบนวันที่เส้นทางไม่ออก':'ระบบพักไว้อัตโนมัติตอน B2C sync'}">${esc(bookingV2PendLabel(w))}</span>`; })():''}
        ${hasDisc?`<span style="font-size:11px;font-weight:700;color:#854F0B;background:#FAEEDA;border-radius:6px;padding:2px 9px" title="รอเซลล์${ap.saleName?(' ('+esc(ap.saleName)+')'):''}ยืนยันส่วนลด">ส่วนลด ฿${(ap.discount||0).toLocaleString()} · รอเซลล์ยืนยัน</span>`:''}
        <span style="margin-left:auto;font-size:10px;color:#999">ขอโดย ${esc(ap.requestedBy||'-')} · ${esc((ap.requestedAt||'').slice(0,10))}</span>
      </div>
      ${rows?`<table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:10px"><thead><tr style="color:#999;font-size:9px;text-transform:uppercase"><th style="padding:3px 8px;text-align:left">Program</th><th style="padding:3px 8px;text-align:left">Date</th><th style="padding:3px 8px;text-align:center">Need</th><th style="padding:3px 8px;text-align:center">Over cap</th><th style="padding:3px 8px;text-align:center">Real seats left</th></tr></thead><tbody>${rows}</tbody></table>`:'<div style="height:4px"></div>'}
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button onclick="bookingV2OpenDetail('${esc(b.id)}')" style="background:#fff;border:1px solid #ddd;border-radius:7px;padding:6px 12px;font-size:11px;cursor:pointer;font-family:inherit;color:#185FA5">ดูรายละเอียด</button>
        <button onclick="bookingV2RejectBooking('${esc(b.id)}')" style="background:#fff;border:1px solid #E6C9C3;color:#A32D2D;border-radius:7px;padding:6px 12px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit">ไม่อนุมัติ</button>
        <button onclick="bookingV2ApproveBooking('${esc(b.id)}')" style="background:#0F6E56;border:none;color:#fff;border-radius:7px;padding:6px 14px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">&#10003; อนุมัติ</button>
      </div>
    </div>`;
  };
  const histRow=(b)=>{ const ap=b.approval||{}; const ok=ap.status==='approved'; return `<div style="display:flex;align-items:center;gap:9px;padding:6px 10px;border-top:1px solid #f0eee7;font-size:11px"><span style="font-family:'DM Mono',monospace;color:#1B2A55">${esc(b.id)}</span><span style="color:#666">${esc(b.leadPax||'—')}</span><span style="margin-left:auto;font-weight:700;color:${ok?'#0F6E56':'#A32D2D'}">${ok?'✓ อนุมัติ':'✕ ไม่อนุมัติ'}</span><span style="color:#999">${esc(ap.approvedBy||'')} · ${esc((ap.approvedAt||'').slice(0,10))}</span></div>`; };
  return `<div style="padding:16px 18px">
    <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:14px">
      <span style="font-size:16px;font-weight:800;color:#A32D2D">รออนุมัติ</span>
      <span style="font-size:12px;color:#8a8a82">${pend.length} รายการ · ต้องอนุมัติก่อนบุคกิ้งจะ confirm</span>
    </div>
    <div style="font-size:11px;color:#8a8a82;background:#FBF3E2;border:1px solid #EAD9B0;border-radius:8px;padding:8px 11px;margin-bottom:14px"><b>เกิน Capacity</b> = เกินโควต้าบริษัท (ไม่เกินทะเบียนเรือ) → ผจก.อนุมัติ · <b>ส่วนลด</b> = มีส่วนลด → เซลล์ที่ดูแลยืนยันส่วนลดก่อน · ทั้งคู่จะ "ยังไม่ confirm" จนกว่าจะอนุมัติ</div>
    ${pend.length?pend.map(card).join(''):'<div style="text-align:center;color:#c7c5bb;font-size:13px;padding:30px">ไม่มีรายการรออนุมัติ</div>'}
    ${recent.length?`<div style="margin-top:18px"><div style="font-size:11px;font-weight:700;color:#8a8a82;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">ประวัติล่าสุด</div>${recent.map(histRow).join('')}</div>`:''}
  </div>`;
}
