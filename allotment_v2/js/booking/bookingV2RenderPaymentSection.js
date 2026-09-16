function bookingV2RenderPaymentSection(){
  const d = _bkV2.newBooking;
  if(!d.agentId) return '';
  const agent = sbGetAgent(d.agentId);
  if(!agent) return '';
  const escapeHTML = s => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);

  const method = agent.payType === 'invoice' ? 'Credit · Invoice' : 'Prepaid';
  const netDays = agent.creditDays || 0;
  const limit = agent.creditLimit || 0;
  const balance = agent.creditBalance || 0;

  return `
    <div class="bkv2-nb-sec">
      <div class="bkv2-nb-sec-h">&#9679; Payment &amp; Cash on Tour <span style="background:var(--sand-mid);color:var(--ink-soft);font-size:9px;padding:1px 7px;border-radius:3px;letter-spacing:.06em;margin-left:6px">FROM CONTRACT</span></div>
      <div style="background:var(--bk-navy-50);border:1px solid var(--bk-navy-light);border-radius:var(--r-sm);padding:11px 14px;margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:600;color:var(--ink);margin-bottom:3px">
          <span>${method}${netDays?` &middot; Net ${netDays}`:''}</span>
          <span style="font-family:'DM Mono',monospace;color:var(--bk-navy)">${escapeHTML(agent.contractVersion||'no contract')}</span>
        </div>
        <div style="font-size:10px;color:var(--ink-soft);font-family:'DM Mono',monospace">
          ${limit?`Credit limit ฿${limit.toLocaleString()} · used ฿${balance.toLocaleString()} · available ฿${Math.max(0,limit-balance).toLocaleString()}`:'No credit limit set'}
        </div>
      </div>
      <div style="height:1px;background:var(--border);margin:0 0 12px"></div>
      <div style="font-size:10px;color:var(--ink-soft);font-weight:700;letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px">Cash on Tour <em style="font-weight:500;color:#b4b2a9;font-style:normal;font-size:10px;text-transform:none;letter-spacing:0">&middot; optional</em></div>
      ${bookingV2RenderCashOnTourSection()}
    </div>
  `;
}
