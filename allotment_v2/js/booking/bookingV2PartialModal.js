function bookingV2PartialModal(bookingId, tripIdx){
  const bk=SB_BOOKINGS.find(b=>b.id===bookingId); if(!bk) return;
  const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  tripIdx=Math.max(0,Math.min(tripIdx|0,(bk.trips||[]).length-1));
  const t=bk.trips[tripIdx]||{pax:{}};
  const REASONS=(typeof BKV2_CANCEL_REASONS!=='undefined')?BKV2_CANCEL_REASONS:[];
  const tripSel=(bk.trips||[]).length>1
    ? `<select id="bkp-trip" onchange="bookingV2PartialModal('${esc(bk.id)}',this.value)" style="width:100%;font-size:12.5px;font-family:inherit;border:1px solid var(--fd-line);border-radius:8px;padding:8px 9px;margin-bottom:12px;box-sizing:border-box">${bk.trips.map((x,i)=>`<option value="${i}" ${i===tripIdx?'selected':''}>${esc((typeof bookingV2RouteShort==='function'?bookingV2RouteShort(x.routeId):x.routeId)||'trip')} · ${esc(x.date||'')} · ${bookingV2PaxAllTot(x.pax||{})} pax</option>`).join('')}</select>`
    : `<div style="font-size:11.5px;color:var(--fd-ink-soft);margin-bottom:10px">${esc((typeof bookingV2RouteShort==='function'?bookingV2RouteShort(t.routeId):t.routeId)||'trip')} · ${esc(t.date||'')} · ${bookingV2PaxAllTot(t.pax||{})} pax</div>`;
  const rows=BKV2_PAX_KEYS.filter(([k])=>(t.pax&&t.pax[k]>0)).map(([k,lab])=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:0.5px solid rgba(0,0,0,.05)"><span style="font-size:12.5px">${lab} <span style="color:var(--fd-ink-soft);font-family:'DM Mono',monospace">(${t.pax[k]})</span></span><span style="font-size:11px;color:var(--fd-ink-soft)">remove <input id="bkp-rm-${k}" type="number" min="0" max="${t.pax[k]}" value="0" oninput="bookingV2PartialRecalc()" style="width:60px;font-size:13px;padding:4px 8px;border:1px solid var(--fd-line);border-radius:7px;font-family:inherit;text-align:right;margin-left:6px"></span></div>`).join('');
  // per-seat price (avg) for auto-suggesting charge/refund amounts
  let _totPax=0; (bk.trips||[]).forEach(x=>{ _totPax+=bookingV2PaxAllTot(x.pax||{}); });
  const _basePrice=(bk.priceBreakdown&&typeof bk.priceBreakdown.seat==='number')?bk.priceBreakdown.seat:(typeof bk.total==='number'?bk.total:0);
  window._bkpPerPax=_totPax>0?Math.round(_basePrice/_totPax):0;
  acctModal(`
    <div style="padding:16px 20px;border-bottom:1px solid var(--fd-line);display:flex;align-items:center;justify-content:space-between"><div><div style="font-size:15px;font-weight:700;color:#A05A1A">Reduce pax · partial cancel</div><div style="font-size:11px;color:var(--fd-ink-soft)">${esc(bk.code||bk.id)}</div></div><button onclick="acctModalClose()" style="background:transparent;border:none;font-size:20px;color:var(--fd-ink-soft);cursor:pointer">✕</button></div>
    <div style="padding:16px 20px">
      <label style="font-size:11px;font-weight:700;color:var(--fd-ink-soft);display:block;margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em">Trip</label>
      ${tripSel}
      <label style="font-size:11px;font-weight:700;color:var(--fd-ink-soft);display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:.04em">Pax to remove</label>
      <div style="margin-bottom:14px">${rows||'<div style="font-size:11.5px;color:var(--fd-ink-soft)">No pax on this trip</div>'}</div>
      <label style="font-size:11px;font-weight:700;color:var(--fd-ink-soft);display:block;margin-bottom:5px;text-transform:uppercase;letter-spacing:.04em">Reason <span style="color:#A32D2D">*</span></label>
      <select id="bkp-cat" style="width:100%;font-size:12.5px;font-family:inherit;border:1px solid var(--fd-line);border-radius:8px;padding:8px 9px;margin-bottom:12px;box-sizing:border-box"><option value="">— Select reason (เลือกประเภท) —</option>${REASONS.map(r=>`<option value="${r.code}">${esc(r.en+' ('+r.th+')')}</option>`).join('')}</select>
      <label style="font-size:11px;font-weight:700;color:var(--fd-ink-soft);display:block;margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em">การเงิน <span style="font-weight:400;text-transform:none">· แยกคนที่ชาร์จ / ไม่ชาร์จ</span></label>
      <div style="background:#FAF7F2;border:1px solid var(--fd-line);border-radius:10px;padding:11px 12px;margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:10px"><span style="color:var(--fd-ink-soft)">ลดทั้งหมด</span><span style="font-weight:700;font-family:'DM Mono',monospace"><span id="bkp-totrem">0</span> คน</span></div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:9px">
          <span style="font-size:12.5px;color:#A05A1A;font-weight:600">เก็บเงิน (ชาร์จ)</span>
          <span style="display:flex;align-items:center;gap:6px"><input id="bkp-chg-cnt" type="number" min="0" value="0" oninput="bookingV2PartialRecalc()" style="width:46px;font-size:13px;padding:4px 7px;border:1px solid var(--fd-line);border-radius:7px;font-family:inherit;text-align:right"><span style="font-size:11.5px;color:var(--fd-ink-soft)">คน ·</span><span style="font-size:11px;color:var(--fd-ink-soft)">฿</span><input id="bkp-chg-amt" type="number" min="0" value="0" style="width:88px;font-size:13px;padding:4px 8px;border:1px solid var(--fd-line);border-radius:7px;font-family:inherit;text-align:right"></span>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
          <span style="font-size:12.5px;color:#0F6E56;font-weight:600">ไม่เก็บ / คืนเงิน</span>
          <span style="display:flex;align-items:center;gap:6px"><span id="bkp-waive-cnt" style="display:inline-block;width:46px;text-align:right;font-size:13px;font-family:'DM Mono',monospace;font-weight:700">0</span><span style="font-size:11.5px;color:var(--fd-ink-soft)">คน ·</span><span style="font-size:11px;color:var(--fd-ink-soft)">฿</span><input id="bkp-waive-amt" type="number" min="0" value="0" style="width:88px;font-size:13px;padding:4px 8px;border:1px solid var(--fd-line);border-radius:7px;font-family:inherit;text-align:right"></span>
        </div>
        <div style="font-size:10.5px;color:var(--fd-ink-soft);margin-top:9px;line-height:1.45">ยอดคืนเงิน = เฉพาะช่อง "ไม่เก็บ" · "ชาร์จ" = เก็บเป็นค่าธรรมเนียมยกเลิก (เป็นรายได้) · ตัวเลข ฿ auto จากราคาต่อหัว แก้ได้</div>
      </div>
      <label style="font-size:11px;font-weight:700;color:var(--fd-ink-soft);display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:.04em">Note <span style="font-weight:400;text-transform:none">· optional</span></label>
      <textarea id="bkp-note" placeholder="เช่น ชื่อคนที่ยกเลิก / เหตุผล" style="width:100%;min-height:50px;font-size:12px;font-family:inherit;border:1px solid var(--fd-line);border-radius:8px;padding:8px;box-sizing:border-box"></textarea>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px">
        <button onclick="acctModalClose()" style="background:#fff;border:1px solid var(--fd-line);color:var(--fd-ink);font-family:inherit;font-size:12px;padding:9px 15px;border-radius:9px;cursor:pointer">Back</button>
        <button onclick="bookingV2PartialConfirm('${esc(bk.id)}',${tripIdx})" style="background:#A05A1A;color:#fff;border:none;font-family:inherit;font-size:12px;font-weight:600;padding:9px 18px;border-radius:9px;cursor:pointer">Confirm reduce</button>
      </div>
    </div>`);
}
