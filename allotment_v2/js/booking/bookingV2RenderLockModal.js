// Inline create-lock modal · opened from Calendar (no tab switch)
function bookingV2RenderLockModal(){
  if(!_bkV2LockModalOpen) return '';
  const r = (typeof ROUTES!=='undefined' && _bkV2LockForm.routeId) ? ROUTES.find(x=>x.id===_bkV2LockForm.routeId) : null;
  return `
    <div onclick="bookingV2CloseLockModal()" style="position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:9998;display:flex;align-items:center;justify-content:center;padding:20px">
      <div onclick="event.stopPropagation()" class="bkv2-locks" style="background:#fff;border-radius:15px;width:720px;max-width:96vw;max-height:92vh;overflow:auto;box-shadow:0 16px 50px rgba(0,0,0,.3)">
        <div style="padding:14px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px">
          <div style="flex:1"><div style="font-size:9.5px;font-weight:700;letter-spacing:.07em;color:#C0392B;text-transform:uppercase">Lock seats</div><div style="font-size:15.5px;font-weight:700;color:var(--ink);margin-top:2px">กันที่นั่งไว้ก่อน${_bkV2LockForm.date?` · ${_bkV2LockForm.date}`:''}</div></div>
          <button onclick="bookingV2CloseLockModal()" style="border:none;background:transparent;font-size:20px;color:var(--ink-soft);cursor:pointer;line-height:1">&times;</button>
        </div>
        <div style="padding:16px 18px">${bookingV2LockFormFields()}</div>
        <div style="display:flex;gap:8px;justify-content:flex-end;padding:12px 18px;background:#fafafa;border-top:1px solid var(--border)">
          <button onclick="bookingV2CloseLockModal()" style="font-size:12px;font-weight:600;color:var(--ink-soft);background:#fff;border:1px solid var(--border);border-radius:9px;padding:8px 14px;cursor:pointer;font-family:inherit">ยกเลิก</button>
          <button onclick="bookingV2LockCreateSubmit()" class="bkv2-newbtn2" style="font-size:12px">สร้างล็อก</button>
        </div>
      </div>
    </div>`;
}
