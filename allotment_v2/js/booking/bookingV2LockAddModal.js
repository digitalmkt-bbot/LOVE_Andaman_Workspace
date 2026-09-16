function bookingV2LockAddModal(){
  const m=_bkV2AddModal; if(!m) return '';
  const l=SB_SEAT_LOCKS.find(x=>x.id===m.lockId); if(!l) return '';
  const esc = s => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const rn = (typeof ROUTES!=='undefined' ? (ROUTES.find(r=>r.id===l.routeId)?.name||l.routeId) : l.routeId);
  const isBulk = bookingV2LockSpansDays(l);
  const rg = bookingV2LockRange(l);
  const rounds = isBulk ? bookingV2LockRounds(l) : null;
  const n = parseInt(m.add,10)||0;
  const inp='width:100%;font-family:inherit;font-size:12.5px;border:1px solid var(--border);border-radius:9px;padding:7px 9px;background:#FBFAF7;color:var(--ink)';
  const lab='display:block;font-size:9.5px;font-weight:700;color:var(--ink-faint);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px';
  return `<div onclick="bookingV2LockAddClose()" style="position:fixed;inset:0;background:rgba(20,20,16,.42);z-index:9998;display:flex;align-items:center;justify-content:center;padding:22px">
    <div onclick="event.stopPropagation()" style="background:#fff;border-radius:15px;width:430px;max-width:96vw;box-shadow:0 18px 54px rgba(0,0,0,.28);overflow:hidden">
      <div style="padding:14px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px">
        <div><div style="font-size:9.5px;font-weight:700;letter-spacing:.07em;color:#0F6E56;text-transform:uppercase">Add seats</div>
          <div style="font-size:15.5px;font-weight:700;margin-top:2px">เพิ่มที่นั่งในล็อกนี้</div></div>
        <button onclick="bookingV2LockAddClose()" style="margin-left:auto;border:none;background:transparent;font-size:21px;color:var(--ink-soft);cursor:pointer;line-height:1">&times;</button>
      </div>
      <div style="padding:16px 18px">
        <div style="background:#F7F6F1;border-radius:10px;padding:10px 12px;margin-bottom:14px">
          <div style="font-size:12.5px;font-weight:700">${esc(rn)}${l.parentId?' · '+esc(l.subName||'ย่อย'):''}</div>
          <div style="font-size:11.5px;color:var(--ink-soft);margin-top:2px">${esc(bookingV2LockHolderName(l))} · ${isBulk?esc(rg.from+' → '+rg.to):esc(l.date||'')}</div>
          <div style="font-size:11.5px;color:var(--ink-soft);margin-top:4px">ตอนนี้ <b style="color:var(--ink);font-family:'DM Mono',monospace">${l.qty||0}</b> ที่${isBulk?('ต่อรอบ · เหลืออีก '+Math.max(0,(rounds.total-rounds.past))+' รอบในช่วง'):(' · เหลือ '+bookingV2LockHeldRemaining(l)+' ที่')}</div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end">
          <div style="flex:0 1 130px"><label style="${lab}">เพิ่มอีก</label><input type="number" min="1" value="${esc(m.add)}" oninput="bookingV2LockAddSet('add',this.value)" style="${inp}"></div>
          <div style="flex:1 1 150px"><label style="${lab}">รวมเป็น</label>
            <div style="${inp};background:#EFFAF5;border-color:#B7E2D2;color:#0F6E56;font-weight:700;font-family:'DM Mono',monospace">${(l.qty||0)+n} ที่${isBulk?'ต่อรอบ':''}</div></div>
          <div style="flex:1 1 100%"><label style="${lab}">เหตุผล <em style="font-weight:500;color:#c2bfb6;font-style:normal;text-transform:none;letter-spacing:0">· เก็บลงประวัติ</em></label>
            <input value="${esc(m.note)}" placeholder="เช่น เอเจ้นขอเพิ่มโควตา" oninput="bookingV2LockAddSet('note',this.value)" style="${inp}"></div>
        </div>
        <div style="font-size:11px;color:var(--ink-soft);background:#F7F6F1;border-radius:9px;padding:9px 11px;margin-top:13px;line-height:1.5">
          เพิ่มแล้วที่นั่งจะถูกกันออกจาก pool ที่ขายได้ทันที${l.parentId?' · กรุ๊ปย่อยเพิ่มได้ไม่เกินที่ล็อกแม่ยังไม่ได้แบ่ง':''}</div>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;padding:12px 18px;background:#FAF9F5;border-top:1px solid var(--border)">
        <button onclick="bookingV2LockAddClose()" style="font-family:inherit;font-size:12px;font-weight:600;color:var(--ink-soft);background:#fff;border:1px solid var(--border);border-radius:9px;padding:8px 14px;cursor:pointer">ยกเลิก</button>
        <button onclick="bookingV2LockAddSubmit()" style="font-family:inherit;font-size:12px;font-weight:700;color:#fff;background:#0F6E56;border:none;border-radius:9px;padding:8px 16px;cursor:pointer">เพิ่มที่นั่ง</button>
      </div>
    </div></div>`;
}
