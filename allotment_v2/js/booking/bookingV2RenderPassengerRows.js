// Returns <tr> rows only · for use inside the unified Guests table
function bookingV2RenderPassengerRows(){
  const d = _bkV2.newBooking;
  bookingV2SyncPassengers();
  if(d.passengers.length === 0){
    return `<tr><td colspan="4" style="padding:8px 12px;font-size:10px;color:var(--ink-soft);font-style:italic">Only lead · bump AD/CHD/INF/FOC in Trips to add more guests.</td></tr>`;
  }
  const escapeHTML = s => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const typeStyle = t => ({
    AD:  {bg:'#f5f3ef',color:'#5A5A52'},
    CHD: {bg:'#E8F4DE',color:'#3B6D11'},
    INF: {bg:'#FBEAF0',color:'#993556'},
    FOC: {bg:'#FAEEDA',color:'#A05A1A'}
  })[t] || {bg:'#f5f3ef',color:'#5A5A52'};
  const _totFoc = (d.trips||[]).reduce((s,t)=> s + ((typeof bookingV2PaxTot==='function')?bookingV2PaxTot(t.pax,'foc'):0), 0);
  return d.passengers.map((p, i) => {
    const seqNum = i + 2; // pax #2, #3, ... (lead is #1)
    const isGuess = p.nationality && bookingV2GuessNationality(p.name||'') === p.nationality;
    const ts = typeStyle(p.type);
    return `
      <tr style="border-bottom:1px solid #f5f3ef">
        <td style="padding:5px 6px;vertical-align:middle">
          <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--ink-soft);font-weight:700;line-height:1.1">#${seqNum}</div>
          <div style="background:${ts.bg};color:${ts.color};font-size:7px;font-weight:700;padding:1px 4px;border-radius:2px;letter-spacing:.08em;display:inline-block;margin-top:2px">${p.type||'AD'}</div>
          ${_totFoc>0?`<div onclick="event.stopPropagation();bookingV2TogglePassengerFoc(${i})" title="${p.type==='FOC'?'FOC · คลิกเพื่อเอาออก':'เลือกเป็น FOC (ฟรี)'}" style="cursor:pointer;font-size:13px;line-height:1;margin-top:3px;color:${p.type==='FOC'?'#D9A400':'#cfcabd'}">${p.type==='FOC'?'★':'☆'}</div>`:''}
        </td>
        <td style="padding:5px 6px"><input class="bkv2-nb-input" type="text" placeholder="${p.type==='INF'?'Infant':p.type==='CHD'?'Child':p.type==='FOC'?'FOC':'Pax'} ${seqNum} name" value="${escapeHTML(p.name||'')}" oninput="bookingV2SetPassenger(${i},'name',this.value)" onblur="bookingV2SyncPassengers();bookingV2Render()" style="padding:6px 8px;font-size:12px;width:100%;box-sizing:border-box"></td>
        <td style="padding:5px 6px">
          <div class="bkv2-nb-ddwrap">
            <input id="bkv2-nat-input-p${i}" class="bkv2-nb-input" type="text" placeholder="Type or pick…" autocomplete="off" value="${p.nationality ? escapeHTML(bookingV2NatDDLabel(p.nationality)) : ''}" oninput="bookingV2NatDDFilter('p${i}', this.value)" onfocus="bookingV2NatDDShow('p${i}')" onkeydown="bookingV2NatDDKey(event,'p${i}')" onblur="bookingV2NatDDBlur('p${i}')" style="padding:6px 8px;font-size:12px;width:100%;box-sizing:border-box">
            <div id="bkv2-nat-dd-p${i}" class="bkv2-nb-dd"></div>
          </div>
        </td>
        <td style="padding:5px 6px;text-align:center">${isGuess ? '<span style="background:#E1F5EE;color:#0F6E56;font-size:8px;padding:1px 5px;border-radius:3px;font-weight:600;letter-spacing:.06em">GUESS</span>' : ''}</td>
      </tr>
    `;
  }).join('');
}
