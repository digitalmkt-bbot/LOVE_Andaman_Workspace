function bookingV2RescheduleModal(bookingId){
  const bk=(SB_BOOKINGS||[]).find(b=>b.id===bookingId); if(!bk) return;
  const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const a=(typeof sbGetAgent==='function')?sbGetAgent(bk.agentId):null;
  const total=(typeof acctBookingTotal==='function')?acctBookingTotal(bk):(bk.total||0);
  const fmt=n=>'฿'+Math.round(n||0).toLocaleString();
  const dates=[...new Set((bk.trips||[]).map(t=>t.date).filter(Boolean))].sort();
  const fromCtl = dates.length>1
    ? `<select id="bkr-from" style="font-size:13px;padding:6px 9px;border:1px solid var(--fd-line);border-radius:7px;font-family:inherit">${dates.map(d=>`<option value="${d}">${d}</option>`).join('')}</select>`
    : `<input id="bkr-from" type="hidden" value="${dates[0]||''}"><span style="font-size:13px;font-weight:600;color:var(--fd-ink);font-variant-numeric:tabular-nums">${dates[0]||'—'}</span>`;
  acctModal(`
    <div style="padding:16px 20px;border-bottom:1px solid var(--fd-line);display:flex;align-items:center;justify-content:space-between"><div><div style="font-size:15px;font-weight:700;color:#185FA5">Reschedule booking</div><div style="font-size:11px;color:var(--fd-ink-soft)">${esc(bk.code||bk.id)}${a?' · '+esc(a.name):''}</div></div><button onclick="acctModalClose()" style="background:transparent;border:none;font-size:20px;color:var(--fd-ink-soft);cursor:pointer">✕</button></div>
    <div style="padding:16px 20px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap">
        <div><label style="font-size:11px;font-weight:700;color:var(--fd-ink-soft);display:block;margin-bottom:5px;text-transform:uppercase;letter-spacing:.04em">Move from</label>${fromCtl}</div>
        <div style="align-self:flex-end;color:var(--fd-ink-soft);font-size:16px;padding-bottom:4px">→</div>
        <div><label style="font-size:11px;font-weight:700;color:#185FA5;display:block;margin-bottom:5px;text-transform:uppercase;letter-spacing:.04em">New date *</label><input id="bkr-newdate" type="date" style="font-size:13px;padding:6px 9px;border:1px solid #9DBCE0;border-radius:7px;font-family:inherit"></div>
      </div>
      <label style="font-size:11px;font-weight:700;color:var(--fd-ink-soft);display:block;margin-bottom:7px;text-transform:uppercase;letter-spacing:.04em">Reschedule fee</label>
      <div style="display:flex;flex-direction:column;gap:7px;margin-bottom:12px">
        <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;cursor:pointer"><input type="radio" name="bkr-charge" value="none" checked onchange="bookingV2RescheduleToggleAmt()" style="accent-color:#185FA5"> No charge</label>
        <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;cursor:pointer"><input type="radio" name="bkr-charge" value="full" onchange="bookingV2RescheduleToggleAmt()" style="accent-color:#185FA5"> Full charge <span style="color:#185FA5;font-weight:700">${fmt(total)}</span></label>
        <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;cursor:pointer"><input type="radio" name="bkr-charge" value="partial" onchange="bookingV2RescheduleToggleAmt()" style="accent-color:#185FA5"> Partial charge</label>
        <div id="bkr-amt-row" style="display:none;padding-left:26px"><span style="font-size:12px;color:var(--fd-ink-soft)">฿ </span><input id="bkr-amt" type="number" min="0" placeholder="0" style="width:140px;font-size:13px;padding:5px 9px;border:1px solid var(--fd-line);border-radius:7px;font-family:inherit;text-align:right;font-variant-numeric:tabular-nums"></div>
      </div>
      <div id="bkr-collect-row" style="display:none;margin-bottom:12px;background:#F4F8FC;border:1px solid #DCEAF5;border-radius:9px;padding:9px 12px">
        <label style="font-size:10.5px;font-weight:700;color:#185FA5;display:block;margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em">How is the fee collected?</label>
        <label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer;margin-bottom:4px"><input type="radio" name="bkr-collect" value="invoice" checked style="accent-color:#185FA5"> On the booking's invoice <span style="color:var(--fd-ink-soft);font-size:10.5px">(adds a "Reschedule fee" line to this booking's own invoice)</span></label>
        <label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer"><input type="radio" name="bkr-collect" value="separate" style="accent-color:#185FA5"> Paid separately / cash <span style="color:var(--fd-ink-soft);font-size:10.5px">(record only · not on invoice)</span></label>
      </div>
      <label style="font-size:11px;font-weight:700;color:var(--fd-ink-soft);display:block;margin-bottom:5px;text-transform:uppercase;letter-spacing:.04em">Reason <span style="color:#A32D2D">*</span></label>
      <textarea id="bkr-reason" placeholder="e.g. customer request · weather window · operational change" style="width:100%;min-height:60px;font-size:12px;font-family:inherit;border:1px solid var(--fd-line);border-radius:8px;padding:8px;box-sizing:border-box"></textarea>
      <div style="font-size:10.5px;color:var(--fd-ink-soft);margin-top:8px;line-height:1.5">The trip still runs — its original price stands. Any fee here is an extra reschedule charge.</div>
      <label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer;margin-top:10px;background:#F4F8FC;border:1px solid #DCEAF5;border-radius:9px;padding:9px 12px"><input type="checkbox" id="bkr-editpickup" style="accent-color:#185FA5"> เปิดหน้าแก้ไขต่อ เพื่อปรับ pickup / รับส่ง สำหรับวันใหม่ <span style="color:var(--fd-ink-soft);font-size:10.5px">(เช่น เดิมเดินทางเอง → วันใหม่ต้องรับส่ง)</span></label>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px">
        <button onclick="acctModalClose()" style="background:#fff;border:1px solid var(--fd-line);color:var(--fd-ink);font-family:inherit;font-size:12px;padding:9px 15px;border-radius:9px;cursor:pointer">Back</button>
        <button onclick="bookingV2RescheduleConfirm('${esc(bk.id)}')" style="background:#185FA5;color:#fff;border:none;font-family:inherit;font-size:12px;font-weight:600;padding:9px 18px;border-radius:9px;cursor:pointer">Confirm reschedule</button>
      </div>
    </div>`);
}
