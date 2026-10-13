function bookingV2RowPayAction(bkId){
  const bk=(SB_BOOKINGS||[]).find(x=>x.id===bkId); if(!bk) return;
  const a=(typeof sbGetAgent==='function')?sbGetAgent(bk.agentId):null;
  const inv=acctBookingInvoice(bk.id);
  const fmt=n=>'฿'+Math.round(n||0).toLocaleString();
  const isPF=a&&a.payType==='proforma';
  let body;
  if(!bk.agentId){
    body=`<div style="font-size:12px;color:var(--fd-ink-soft)">Booking นี้เป็น B2C (ไม่มี agent) — จัดการชำระเงินที่หน้า Accounting หรือ booking detail</div>`;
  } else if(!inv){
    // B2C carries its own settled amount from the webshop (payments + credits, synced server-side).
    // Show it here, otherwise this modal reads "no invoice yet" on a booking the customer already paid.
    const _bps=(bk.agentId==='a_b2c'&&bk.paymentSnapshot&&bk.paymentSnapshot.paidStatus)?bk.paymentSnapshot:null;
    const _bl=_bps?`<div style="font-size:12px;margin-bottom:8px">B2C · ${({paid:'ชำระครบแล้ว',deposit:'มัดจำ/ชำระบางส่วน',unpaid:'ยังไม่ชำระ'})[_bps.paidStatus]||_bps.paidStatus} · รับแล้ว ${fmt(_bps.paid)} <span style="color:var(--fd-ink-soft)">(ยอดระดับ order)</span></div>`:'';
    body=_bl+`<div style="font-size:12px;color:var(--fd-ink-soft);margin-bottom:12px">ยังไม่ได้ออกใบแจ้งหนี้ · ยอด ${fmt(acctBookingTotal(bk))}</div>
      <button onclick="bookingV2PayDoCreate('${bkId}')" style="background:var(--fd-coral);color:#fff;border:none;font-family:inherit;font-size:12px;font-weight:600;padding:9px 16px;border-radius:9px;cursor:pointer">ออก${isPF?' Pro Forma':'ใบแจ้งหนี้'}</button>`;
  } else {
    const bal=acctInvoiceBalance(inv), paid=acctInvoicePaid(inv);
    body=`<div style="font-size:12px;margin-bottom:10px"><span style="font-family:'DM Mono',monospace;font-weight:600">${inv.number}</span> · ${acctStateChip(acctInvoiceState(inv))}</div>
      <div style="display:flex;gap:14px;font-size:12px;margin-bottom:12px;font-variant-numeric:tabular-nums"><span>Total ${fmt(inv.total)}</span><span style="color:#0F6E56">Paid ${fmt(paid)}</span><span style="color:#A05A1A">Balance ${fmt(bal)}</span></div>
      ${bal>0?`<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
        <div><label style="font-size:10.5px;color:var(--fd-ink-soft);display:block;margin-bottom:4px">จำนวนเงิน</label><input id="bkv2-pay-amt" type="number" min="0" value="${Math.round(bal)}" style="width:100%;height:34px;font-size:13px;text-align:right;border:1px solid var(--fd-line);border-radius:8px;padding:2px 9px"></div>
        <div><label style="font-size:10.5px;color:var(--fd-ink-soft);display:block;margin-bottom:4px">วิธี</label><select id="bkv2-pay-method" style="width:100%;height:34px;font-size:12px;font-family:inherit;border:1px solid var(--fd-line);border-radius:8px;padding:2px 6px;background:#fff"><option value="transfer">โอน</option><option value="cash">เงินสด</option><option value="card">บัตร</option></select></div>
      </div>`:''}
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${bal>0?`<button onclick="bookingV2PayDoRecord('${inv.id}','${bkId}')" style="background:#0F7A5A;color:#fff;border:none;font-family:inherit;font-size:12px;font-weight:600;padding:9px 16px;border-radius:9px;cursor:pointer">บันทึกรับเงิน</button>`:''}
        <button onclick="acctOpenDoc('${inv.id}','invoice')" style="background:#fff;border:1px solid var(--fd-line);color:var(--fd-ink);font-family:inherit;font-size:12px;padding:9px 14px;border-radius:9px;cursor:pointer">ดูเอกสาร</button>
      </div>`;
  }
  acctModal(`<div style="padding:16px 20px;border-bottom:1px solid var(--fd-line);display:flex;align-items:center;justify-content:space-between"><div><div style="font-size:15px;font-weight:700">การชำระเงิน · ${bk.code||bk.id}</div><div style="font-size:11px;color:var(--fd-ink-soft)">${a?a.name:'—'}${a?` · ${bookingV2PayLabel(a.payType)}`:''}</div></div><button onclick="acctModalClose()" style="background:transparent;border:none;font-size:20px;color:var(--fd-ink-soft);cursor:pointer">✕</button></div><div style="padding:16px 20px">${body}</div>`);
}
