function bookingV2RenderAttachSection(){
  const d=_bkV2.newBooking; if(!d) return '';
  if(!d.agentId) return '';   // เฉพาะ B2B/agent
  const _mac=_bkV2IsMac(); const _shot=_mac?'Cmd+Shift+4':'Win+Shift+S'; const _paste=_mac?'Cmd+V':'Ctrl+V';
  return `<div class="bkv2-nb-sec" id="bkv2-attach-sec">
    <div class="bkv2-nb-sec-hd"><span class="bkv2-nb-sec-dot"></span><span class="bkv2-nb-sec-ttl">Documents</span><span style="font-size:10px;font-weight:700;color:#185FA5;background:#EAF3FB;padding:2px 8px;border-radius:10px">B2B</span></div>
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
      <label title="อัปโหลดไฟล์ (PDF / รูป)" style="display:inline-flex;align-items:center;justify-content:center;background:var(--bk-navy);color:#fff;border-radius:9px;width:42px;height:36px;font-size:17px;cursor:pointer">📎<input type="file" accept="image/*,application/pdf" multiple style="display:none" onchange="bookingV2AttachFromInput(this)"></label>
      <button type="button" title="Capture หน้าจอ" onclick="bookingV2AttachCapture()" style="display:inline-flex;align-items:center;justify-content:center;background:#fff;color:var(--bk-navy);border:1px solid var(--border);border-radius:9px;width:42px;height:36px;font-size:17px;cursor:pointer">🖥</button>
    </div>
    <div style="font-size:10.5px;color:var(--ink-soft);line-height:1.5;margin-bottom:10px">📋 ถ่ายหน้าจอ (${_shot}) แล้วกด <b style="color:var(--ink)">${_paste}</b> วางตรงนี้ได้เลย</div>
    <div id="bkv2-attach-list">${bookingV2AttachListHTML()}</div>
  </div>`;
}
