function bookingV2B2COpen(){
  const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const L=bookingV2B2CList();
  const can=(typeof acctCanEditBookings!=='function') || acctCanEditBookings();
  const dLbl=d=>{ const x=new Date(d+'T00:00'); return isNaN(x)?d:x.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}); };
  const rName=rid=>{ const r=(typeof ROUTES!=='undefined'?ROUTES:[]).find(x=>x.id===rid); return r?r.name:(rid||''); };
  const item=x=>{
    const bk=x.bk, p=x.p, t=(bk.trips||[]).find(tt=>tt.date===x.date)||(bk.trips||[])[0]||{};
    const pax=(typeof bookingV2Norm==='function')?((bookingV2Norm(bk)||{}).paxTotal||0):0;
    const code=(typeof bookingV2DisplayCode==='function')?bookingV2DisplayCode(bk):(bk.voucherRef||bk.id);
    return `<div class="b2ci k-${bookingV2B2CKind(p)}">`
      + `<div class="b2ci-h"><b>${esc(code)}</b> &middot; ${esc(bk.leadPax||'—')}${pax?(' &middot; '+pax+' pax'):''}<span>${esc(bookingV2B2CWhen(p.at))}</span></div>`
      + `<div class="b2ci-s">${esc(rName(t.routeId))} &middot; ${esc(dLbl(x.date))}</div>`
      + `<div class="b2cl">${bookingV2B2CBodyHtml(bk,p,x.date)}</div>`
      + `<div class="b2ci-a"><button onclick="bookingV2B2CGo('${esc(bk.id)}')">${p.moved?('ไปที่ '+esc(dLbl(x.date))+' &rarr;'):'เปิดในหน้าวันนั้น &rarr;'}</button>`
      + (can?`<button class="ok" onclick="bookingV2B2CSeen('${esc(bk.id)}')">&#10003; รับทราบ</button>`:'')+`</div></div>`;
  };
  const moved=L.filter(x=>x.p.moved).sort((a,b)=>a.date.localeCompare(b.date));
  const rest=L.filter(x=>!x.p.moved).sort((a,b)=>a.date.localeCompare(b.date)||String(b.p.at).localeCompare(String(a.p.at)));
  let body='';
  if(moved.length) body+=`<div class="b2cg">Travel date moved &middot; ${moved.length}</div>`+moved.map(item).join('');
  let lastD='';
  rest.forEach(x=>{ if(x.date!==lastD){ lastD=x.date; body+=`<div class="b2cg">${esc(dLbl(x.date))}</div>`; } body+=item(x); });
  if(!L.length) body=`<div class="b2ce">&#10003; ไม่มีรายการค้าง &middot; ทุกการแก้ไขจาก B2C รับทราบแล้ว</div>`;
  let d=document.getElementById('b2cchg-drw');
  if(!d){ d=document.createElement('div'); d.id='b2cchg-drw'; document.body.appendChild(d); }
  d.innerHTML=`<style>
#b2cchg-drw{position:fixed;inset:0;z-index:9000;font-family:'DM Sans','Sarabun',sans-serif}
#b2cchg-drw .b2cd-bg{position:absolute;inset:0;background:rgba(11,21,80,.28)}
#b2cchg-drw .b2cd{position:absolute;top:0;right:0;bottom:0;width:min(440px,100vw);background:#fff;box-shadow:-10px 0 30px rgba(0,0,0,.2);display:flex;flex-direction:column}
#b2cchg-drw .b2cd-h{display:flex;align-items:flex-start;gap:10px;padding:14px 16px;border-bottom:1px solid #E6E8F0}
#b2cchg-drw .b2cd-h b{display:block;font-size:15px;color:#1F2430}
#b2cchg-drw .b2cd-h span{font-size:11px;color:#6B7390}
#b2cchg-drw .b2cd-h button{margin-left:auto;border:0;background:#EEF0F5;border-radius:8px;width:30px;height:30px;font-size:18px;cursor:pointer}
#b2cchg-drw .b2cd-b{flex:1;overflow:auto;padding:4px 0 12px}
#b2cchg-drw .b2cg{padding:12px 16px 4px;font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#6B7390}
#b2cchg-drw .b2ci{margin:6px 12px;border:1px solid #E6E8F0;border-left:4px solid #F97316;border-radius:10px;padding:9px 11px}
#b2cchg-drw .b2ci.k-r{border-left-color:#DC2626}#b2cchg-drw .b2ci.k-n{border-left-color:#2563EB}
#b2cchg-drw .b2ci-h{display:flex;gap:6px;font-size:12.5px;color:#1F2430}
#b2cchg-drw .b2ci-h span{margin-left:auto;font-size:10.5px;color:#6B7390;white-space:nowrap}
#b2cchg-drw .b2ci-s{font-size:11px;color:#6B7390;margin:1px 0 6px}
#b2cchg-drw .b2cl{display:flex;flex-wrap:wrap;gap:4px 7px;font-size:11.5px;line-height:1.5}
#b2cchg-drw .b2cf{color:#1F2430}#b2cchg-drw .b2cf s{color:#9CA3AF}#b2cchg-drw .b2cf b{font-weight:800}
#b2cchg-drw .b2cf .k{font-size:9.5px;text-transform:uppercase;color:#6B7390;font-weight:700;margin-right:4px}
#b2cchg-drw .b2csep{color:#D1D5DB}
#b2cchg-drw .b2cw{color:#92400E;background:#FEF3C7;border-radius:6px;padding:1px 7px;font-weight:700}
#b2cchg-drw .b2ci-a{display:flex;gap:6px;margin-top:8px}
#b2cchg-drw .b2ci-a button,#b2cchg-drw .b2cd-f button{border:1px solid #D7DAE6;background:#fff;border-radius:7px;padding:4px 10px;font-size:11px;font-weight:700;color:#000F4C;cursor:pointer;font-family:inherit}
#b2cchg-drw .b2ci-a button.ok,#b2cchg-drw .b2cd-f button{background:#0F6E56;border-color:#0F6E56;color:#fff}
#b2cchg-drw .b2cd-f{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-top:1px solid #E6E8F0;font-size:11.5px;color:#6B7390}
#b2cchg-drw .b2ce{padding:40px 20px;text-align:center;color:#0F6E56;font-weight:700}
</style><div class="b2cd-bg" onclick="bookingV2B2CClose()"></div><div class="b2cd">`
    + `<div class="b2cd-h"><div><b>&#128276; B2C changes</b><span>ยังไม่มีคนรับทราบ &middot; ทุกวันเดินทางที่ยังไม่ถึง</span></div><button onclick="bookingV2B2CClose()" title="Close">&times;</button></div>`
    + `<div class="b2cd-b">${body}</div>`
    + ((L.length && can)?`<div class="b2cd-f"><span>${L.length} to review</span><button onclick="bookingV2B2CSeenAll()">&#10003; รับทราบทั้งหมด</button></div>`:'')
    + `</div>`;
}
