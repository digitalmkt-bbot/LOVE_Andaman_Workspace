function bookingV2RenderFocSection(){
  const d = _bkV2.newBooking;
  const q = bookingV2CalcQuote();
  if(q.totalFoc <= 0) return '';
  const escapeHTML = s => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  return `
    <div class="bkv2-nb-sec" style="background:#FFF6E5;border-top:1px solid #EAD9B0">
      <div class="bkv2-nb-sec-h" style="color:#633806">&#9888; FOC Approval Required</div>
      <div style="font-size:12px;color:#633806;line-height:1.55;margin-bottom:10px">
        <strong>${q.totalFoc} FOC pax</strong> across trips &middot; ฿${q.focDiscount.toLocaleString()} forgone revenue &middot; booking will start as <strong>Pending FOC Approval</strong> until reviewed.
      </div>
      <textarea class="bkv2-nb-input" rows="3" placeholder="Reason for FOC · e.g. VIP returning client · comp for last trip issue" oninput="bookingV2SetFocReason(this.value)" style="border-color:#BA7517">${escapeHTML(d.focReason)}</textarea>
    </div>
  `;
}
