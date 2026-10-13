function bookingV2CancelModal(bookingId){
  const bk=(SB_BOOKINGS||[]).find(b=>b.id===bookingId); if(!bk) return;
  const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const a=(typeof sbGetAgent==='function')?sbGetAgent(bk.agentId):null;
  const total=(typeof acctBookingTotal==='function')?acctBookingTotal(bk):(bk.total||0);
  const policy=(a&&a.bookingChannel&&a.bookingChannel.cancelPolicy)||'';
  const fmt=n=>'฿'+Math.round(n||0).toLocaleString();
  acctModal(`
    <div style="padding:16px 20px;border-bottom:1px solid var(--fd-line);display:flex;align-items:center;justify-content:space-between"><div><div style="font-size:15px;font-weight:700;color:#A32D2D">Cancel booking</div><div style="font-size:11px;color:var(--fd-ink-soft)">${esc(bk.code||bk.id)}${a?' · '+esc(a.name):''}</div></div><button onclick="acctModalClose()" style="background:transparent;border:none;font-size:20px;color:var(--fd-ink-soft);cursor:pointer">✕</button></div>
    <div style="padding:16px 20px">
      ${policy?`<div style="font-size:10.5px;color:#7A4A00;background:#FBF0DD;border:1px solid #EAD9B0;border-radius:8px;padding:7px 10px;margin-bottom:12px"><b>Contract policy:</b> ${esc(policy)}</div>`:''}
      <label style="font-size:11px;font-weight:700;color:var(--fd-ink-soft);display:block;margin-bottom:5px;text-transform:uppercase;letter-spacing:.04em">Reason <span style="color:#A32D2D">*</span></label>
      <select id="bkc-cat" onchange="bookingV2CancelPickReason()" style="width:100%;font-size:12.5px;font-family:inherit;border:1px solid var(--fd-line);border-radius:8px;padding:8px 9px;margin-bottom:14px;box-sizing:border-box">
        <option value="">— Select reason (เลือกประเภท) —</option>
        ${BKV2_CANCEL_REASONS.map(r=>`<option value="${r.code}">${esc(r.en+' ('+r.th+')')}</option>`).join('')}
      </select>
      <label style="font-size:11px;font-weight:700;color:var(--fd-ink-soft);display:block;margin-bottom:7px;text-transform:uppercase;letter-spacing:.04em">Cancellation charge</label>
      <div style="display:flex;flex-direction:column;gap:7px;margin-bottom:14px">
        <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;cursor:pointer"><input type="radio" name="bkc-charge" value="none" checked onchange="bookingV2CancelToggleAmt()" style="accent-color:#A32D2D"> No charge</label>
        <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;cursor:pointer"><input type="radio" name="bkc-charge" value="full" onchange="bookingV2CancelToggleAmt()" style="accent-color:#A32D2D"> Full charge <span style="color:#A32D2D;font-weight:700">${fmt(total)}</span></label>
        <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;cursor:pointer"><input type="radio" name="bkc-charge" value="partial" onchange="bookingV2CancelToggleAmt()" style="accent-color:#A32D2D"> Partial charge</label>
        <div id="bkc-amt-row" style="display:none;padding-left:26px"><span style="font-size:12px;color:var(--fd-ink-soft)">฿ </span><input id="bkc-amt" type="number" min="0" placeholder="0" style="width:140px;font-size:13px;padding:5px 9px;border:1px solid var(--fd-line);border-radius:7px;font-family:inherit;text-align:right;font-variant-numeric:tabular-nums"></div>
      </div>
      <label style="font-size:11px;font-weight:700;color:var(--fd-ink-soft);display:block;margin-bottom:5px;text-transform:uppercase;letter-spacing:.04em">Note / รายละเอียด <span style="font-weight:400;text-transform:none;color:var(--fd-ink-soft)">· optional (บังคับเมื่อเลือก "อื่นๆ")</span></label>
      <textarea id="bkc-reason" placeholder="รายละเอียดเพิ่มเติม เช่น ชื่อลูกค้า / เลขที่อ้างอิง / สาเหตุ" style="width:100%;min-height:60px;font-size:12px;font-family:inherit;border:1px solid var(--fd-line);border-radius:8px;padding:8px;box-sizing:border-box"></textarea>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px">
        <button onclick="acctModalClose()" style="background:#fff;border:1px solid var(--fd-line);color:var(--fd-ink);font-family:inherit;font-size:12px;padding:9px 15px;border-radius:9px;cursor:pointer">Back</button>
        <button onclick="bookingV2CancelConfirm('${esc(bk.id)}')" style="background:#A32D2D;color:#fff;border:none;font-family:inherit;font-size:12px;font-weight:600;padding:9px 18px;border-radius:9px;cursor:pointer">Confirm cancellation</button>
      </div>
    </div>`);
}
