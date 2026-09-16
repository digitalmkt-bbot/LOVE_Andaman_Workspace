function bookingV2AttachListHTML(){
  const d=_bkV2.newBooking; const list=(d&&Array.isArray(d.attachments))?d.attachments:[];
  const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  if(!list.length) return '<div style="font-size:12px;color:var(--ink-soft);padding:12px;border:1px dashed var(--border);border-radius:10px;text-align:center">ยังไม่มีเอกสารแนบ — อัปโหลด / Capture หน้าจอ / วางรูป ('+(_bkV2IsMac()?'Cmd+V':'Ctrl+V')+')</div>';
  return '<div style="display:flex;flex-wrap:wrap;gap:10px">'+list.map(a=>{
    const isImg=/^image\//.test(a.mime||''); const url='/api/attach/'+encodeURIComponent(a.id);
    const thumb=isImg?`<img src="${url}" loading="lazy" style="width:100%;height:84px;object-fit:cover;display:block">`:`<div style="width:100%;height:84px;display:flex;align-items:center;justify-content:center;background:#F4F2EC;font-size:26px">📄</div>`;
    const kindLbl=a.kind==='capture'?'🖥':a.kind==='paste'?'📋':'📎';
    return `<div style="width:120px;border:1px solid var(--border);border-radius:10px;overflow:hidden;background:#fff">
      <a href="${url}" target="_blank" rel="noopener" title="เปิดดูเต็ม">${thumb}</a>
      <div style="padding:5px 7px">
        <div style="font-size:10px;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(a.name)}">${kindLbl} ${esc(a.name||'file')}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:3px">
          <span style="font-size:9px;color:var(--ink-soft)">${a.size?Math.round(a.size/1024)+'KB':''}</span>
          <button type="button" onclick="bookingV2AttachRemove('${esc(a.id)}')" title="ลบ" style="border:none;background:transparent;color:#C0392B;font-size:11px;font-weight:600;cursor:pointer">ลบ</button>
        </div>
      </div>
    </div>`;
  }).join('')+'</div>';
}
