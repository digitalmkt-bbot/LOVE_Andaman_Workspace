function bookingV2LkPendAskModal(){
  const a = _bkV2LkPendAsk; if(!a) return '';
  const esc = s => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const sh = a.short, one = sh.length===1 ? sh[0] : null;
  const rn = (typeof ROUTES!=='undefined' ? ((ROUTES.find(r=>r.id===a.routeId)||{}).name||a.routeId) : a.routeId);
  const btn='font-family:inherit;font-size:12.5px;font-weight:700;border-radius:10px;padding:10px 14px;cursor:pointer;text-align:left;width:100%;line-height:1.45';
  const rows = one ? '' : `<div style="max-height:170px;overflow:auto;border:1px solid var(--border-2);border-radius:9px;margin-top:10px">
      <table style="width:100%;border-collapse:collapse;font-size:11.5px"><thead><tr style="background:#FAF9F5;color:var(--ink-faint);font-size:9.5px;text-transform:uppercase;letter-spacing:.05em">
        <th style="text-align:left;padding:5px 10px">วันเดินทาง</th><th style="padding:5px 10px">ว่าง</th><th style="padding:5px 10px">ขาด</th></tr></thead><tbody>
      ${sh.map(x=>`<tr><td style="padding:4px 10px;font-family:'DM Mono',monospace;border-top:1px solid var(--border-2)">${esc(x.date)}</td>
        <td style="padding:4px 10px;text-align:center;border-top:1px solid var(--border-2);font-family:'DM Mono',monospace">${x.free}</td>
        <td style="padding:4px 10px;text-align:center;border-top:1px solid var(--border-2);font-family:'DM Mono',monospace;font-weight:700;color:#A05A1A">${x.short}</td></tr>`).join('')}
      </tbody></table></div>`;
  const head = one
    ? `ขอล็อก <b style="font-family:'DM Mono',monospace">${one.want}</b> ที่ · ทริปนี้ว่างอยู่ <b style="font-family:'DM Mono',monospace;color:${one.free?'#0F6E56':'#A32D2D'}">${one.free}</b> ที่`
    : `มี <b>${sh.length}</b> รอบในช่วงที่ที่ว่างไม่พอ · รอบอื่นล็อกได้ตามปกติ`;
  const splitLbl = one
    ? (one.free>0 ? `ล็อก ${one.free} ที่ทันที · อีก ${one.short} ที่เป็น Pending` : `Pending ทั้ง ${one.want} ที่ · รอที่ว่าง`)
    : 'ล็อกเท่าที่ว่างของแต่ละรอบ · ส่วนที่ขาดเป็น Pending';
  const allLbl = one ? `Pending ทั้ง ${one.want} ที่ · ไม่แบ่ง` : 'รอบที่ไม่พอ Pending ทั้งจำนวน · ไม่แบ่ง';
  const showAll = a.kind==='create' && !(one && one.free<=0);
  return `<div class="la-modal lkpend-ask" style="position:fixed;inset:0;background:rgba(20,20,16,.46);z-index:10000;display:flex;align-items:center;justify-content:center;padding:22px">
    <div style="background:#fff;border-radius:15px;width:440px;max-width:96vw;box-shadow:0 18px 54px rgba(0,0,0,.3);overflow:hidden">
      <div style="padding:14px 18px;border-bottom:1px solid var(--border)">
        <div style="font-size:9.5px;font-weight:700;letter-spacing:.07em;color:#A05A1A;text-transform:uppercase">Seats not available</div>
        <div style="font-size:15.5px;font-weight:700;margin-top:2px">ที่นั่งว่างไม่พอ</div></div>
      <div style="padding:16px 18px">
        <div style="font-size:12px;color:var(--ink-soft)">${esc(rn)}${one?(' · <span style="font-family:\'DM Mono\',monospace">'+esc(one.date)+'</span>'):''}</div>
        <div style="font-size:13px;margin-top:6px;line-height:1.55">${head}</div>
        ${rows}
        <div style="font-size:11px;color:var(--ink-soft);background:#FBF6EC;border-radius:9px;padding:9px 11px;margin-top:12px;line-height:1.55">
          Pending = ยังไม่คอนเฟิร์ม · ไม่กันที่นั่ง และดึงไปจองไม่ได้ · พอมีที่ว่าง กดยืนยันเองที่หน้า Seat Locks หรือ Manifest</div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:14px">
          <button data-lkpend="split" onclick="bookingV2LkPendAskGo('split')" style="${btn};color:#fff;background:#0F6E56;border:1px solid #0F6E56">${splitLbl}</button>
          ${showAll?`<button data-lkpend="all" onclick="bookingV2LkPendAskGo('all')" style="${btn};color:#7A4A00;background:#FBEFD9;border:1px solid #EBCF9A">${allLbl}</button>`:''}
          <button data-lkpend="cancel" onclick="bookingV2LkPendAskGo('cancel')" style="${btn};color:var(--ink-soft);background:#fff;border:1px solid var(--border);font-weight:600;text-align:center">ยกเลิก · ไม่ล็อก</button>
        </div>
      </div>
    </div></div>`;
}
