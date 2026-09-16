// ── Cash on Tour ──
function bookingV2RenderCashOnTourSection(){
  const d = _bkV2.newBooking;
  const cot = d.cashOnTour;
  const escapeHTML = s => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  return `
    <label style="display:flex;align-items:center;gap:8px;padding:7px 11px;background:${cot?'#FFF6E5':'var(--white)'};border:1px solid ${cot?'#EAD9B0':'var(--border)'};border-radius:var(--r-sm);cursor:pointer">
      <input type="checkbox" ${cot?'checked':''} onchange="bookingV2ToggleCashOnTour(this.checked)" style="accent-color:#ba7517">
      <span style="font-size:12px;color:${cot?'#633806':'var(--ink)'};font-weight:600">💰 Collect cash on tour</span>
      <span style="font-size:10px;color:var(--ink-soft);margin-left:auto">guide collects from guest on tour day</span>
    </label>
    ${cot ? `
      <div class="bkv2-nb-row" style="margin-top:10px">
        <div class="bkv2-nb-field">
          <label class="bkv2-nb-label">Amount to collect</label>
          <input class="bkv2-nb-input" type="number" min="0" step="100" placeholder="0" value="${cot.amount||''}" oninput="bookingV2SetCashOnTour('amount', Number(this.value)||0)">
        </div>
        <div class="bkv2-nb-field">
          <label class="bkv2-nb-label">Currency</label>
          <select class="bkv2-nb-input" onchange="bookingV2SetCashOnTour('currency', this.value)">
            ${['THB','USD','EUR','RUB','CNY','GBP','AUD'].map(c => `<option value="${c}" ${cot.currency===c?'selected':''}>${c}</option>`).join('')}
          </select>
        </div>
      </div>
      <div style="margin-top:8px">
        <div style="font-size:10px;color:var(--ink-soft);font-weight:700;letter-spacing:.06em;margin-bottom:5px">HANDLING</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
          <label style="display:flex;align-items:flex-start;gap:8px;padding:8px 11px;background:${cot.handling==='deduct'?'var(--bk-navy-50)':'var(--white)'};border:1px solid ${cot.handling==='deduct'?'var(--bk-navy-mid)':'var(--border)'};border-radius:var(--r-sm);cursor:pointer">
            <input type="radio" name="cot-handling" ${cot.handling==='deduct'?'checked':''} onchange="bookingV2SetCashOnTour('handling','deduct')" style="accent-color:var(--bk-navy);margin-top:2px">
            <div><div style="font-size:11px;font-weight:700;color:${cot.handling==='deduct'?'var(--bk-navy)':'var(--ink)'}">Deduct from invoice</div><div style="font-size:9px;color:var(--ink-soft);margin-top:1px">Reduces total owed by agent</div></div>
          </label>
          <label style="display:flex;align-items:flex-start;gap:8px;padding:8px 11px;background:${cot.handling==='separate'?'var(--bk-navy-50)':'var(--white)'};border:1px solid ${cot.handling==='separate'?'var(--bk-navy-mid)':'var(--border)'};border-radius:var(--r-sm);cursor:pointer">
            <input type="radio" name="cot-handling" ${cot.handling==='separate'?'checked':''} onchange="bookingV2SetCashOnTour('handling','separate')" style="accent-color:var(--bk-navy);margin-top:2px">
            <div><div style="font-size:11px;font-weight:700;color:${cot.handling==='separate'?'var(--bk-navy)':'var(--ink)'}">Keep separate</div><div style="font-size:9px;color:var(--ink-soft);margin-top:1px">Full invoice still owed</div></div>
          </label>
        </div>
      </div>
      <div style="margin-top:10px">
        <div style="font-size:10px;color:var(--ink-soft);font-weight:700;letter-spacing:.06em;margin-bottom:5px">NOTE <span style="font-weight:400;text-transform:none">· แสดงในตัวสรุป</span></div>
        <input class="bkv2-nb-input" style="width:100%;box-sizing:border-box" placeholder="เช่น เก็บค่า Longtail / สปีดโบ๊ทเพิ่ม · รายละเอียดเก็บเงิน" value="${escapeHTML(cot.note||'')}" oninput="bookingV2SetCashOnTour('note', this.value)">
      </div>
    ` : ''}
  `;
}
