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
      <div style="display:flex;flex-direction:column;gap:8px">
        <select class="bkv2-nb-input" onchange="bookingV2SetFocType(this.value)" style="border-color:#BA7517;font-weight:600">
          <option value="">— เลือกประเภท FOC (บังคับ) —</option>
          ${FOC_TYPES.map(t => `<option value="${t.id}" ${d.focType===t.id?'selected':''}>${t.l}${t.h?' — '+t.h:''}</option>`).join('')}
        </select>
        <textarea class="bkv2-nb-input" rows="2" placeholder="${bookingV2FocNeedNote(d.focType)?'ระบุเหตุผล (บังคับสำหรับประเภทนี้)':'หมายเหตุ · ชื่อไกด์ / กรุ๊ป / เลขสัญญา (ไม่บังคับ)'}" oninput="bookingV2SetFocReason(this.value)" style="border-color:${bookingV2FocNeedNote(d.focType)&&!(d.focReason||'').trim()?'#BA7517':'#EAD9B0'}">${escapeHTML(d.focReason)}</textarea>
      </div>
    </div>
  `;
}
