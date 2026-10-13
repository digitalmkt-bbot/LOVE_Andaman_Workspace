// ── Cash on Tour ──
function bookingV2RenderCashOnTourSection(){
  const d = _bkV2.newBooking;
  const cot = d.cashOnTour;
  const escapeHTML = s => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  return `
    <label style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:${cot?'#E8F3FB':'#fff'};border:1.5px solid ${cot?'#1272B3':'#C9CCD6'};border-radius:10px;cursor:pointer">
      <input type="checkbox" ${cot?'checked':''} onchange="bookingV2ToggleCashOnTour(this.checked)" style="accent-color:#16265C;width:16px;height:16px;margin:0;flex:none">
      <span style="font-size:13px;color:${cot?'#0B4F7A':'var(--ink)'};font-weight:600">💰 Collect cash on tour</span>
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
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px">
          <label style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:${cot.handling==='deduct'?'#E8F3FB':'#fff'};border:1.5px solid ${cot.handling==='deduct'?'#1272B3':'#C9CCD6'};border-radius:10px;cursor:pointer">
            <input type="radio" name="cot-handling" ${cot.handling==='deduct'?'checked':''} onchange="bookingV2SetCashOnTour('handling','deduct')" style="accent-color:var(--bk-navy);margin-top:2px">
            <div><div style="font-size:13px;font-weight:600;color:${cot.handling==='deduct'?'#0B4F7A':'var(--ink)'}">Deduct from invoice</div><div style="font-size:9px;color:var(--ink-soft);margin-top:1px">Reduces total owed by agent</div></div>
          </label>
          <label style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:${cot.handling==='separate'?'#E8F3FB':'#fff'};border:1.5px solid ${cot.handling==='separate'?'#1272B3':'#C9CCD6'};border-radius:10px;cursor:pointer">
            <input type="radio" name="cot-handling" ${cot.handling==='separate'?'checked':''} onchange="bookingV2SetCashOnTour('handling','separate')" style="accent-color:var(--bk-navy);margin-top:2px">
            <div><div style="font-size:13px;font-weight:600;color:${cot.handling==='separate'?'#0B4F7A':'var(--ink)'}">Keep separate</div><div style="font-size:9px;color:var(--ink-soft);margin-top:1px">Full invoice still owed</div></div>
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
