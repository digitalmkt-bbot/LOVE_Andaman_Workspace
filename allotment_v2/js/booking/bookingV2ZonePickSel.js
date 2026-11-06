function bookingV2ZonePickSel(id){
  const st=window._bkV2ZonePick; if(!st) return;
  st.sel=id||'';
  document.querySelectorAll('#bkv2-zonepick-list .zpk-row').forEach(r=>{
    const on=r.dataset.id===st.sel;
    r.style.background=on?'#EAF4FB':'';
    const d=r.querySelector('.zpk-dot'); if(d) d.style.background=on?d.style.borderColor:'transparent';
  });
  const bk=(SB_BOOKINGS||[]).find(b=>b.id===st.bkId);
  const info=document.getElementById('bkv2-zonepick-info'), ok=document.getElementById('bkv2-zonepick-ok');
  const same=!bk || st.sel===(bk.pickupAreaId||'');
  if(ok){ ok.disabled=same||!st.sel; ok.style.opacity=ok.disabled?'.45':'1'; ok.style.cursor=ok.disabled?'default':'pointer'; }
  if(!info) return;
  if(same||!st.sel){ info.innerHTML=''; return; }
  const e=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const p=_bkV2ZonePickPlan(bk, st.sel);
  let h='';
  if(p.times.length){
    const tx=p.times.map(x=>`${e(x.t.date||'')} <s style="color:#9a988f">${e(x.from||'—')}</s> &rarr; <b>${e(x.to)}</b>`).join('<br>');
    h+=`<label style="display:flex;gap:7px;align-items:flex-start;margin-top:9px;font-size:11.5px;color:#3a3a35;cursor:pointer"><input type="checkbox" id="bkv2-zonepick-time" checked style="margin-top:2px"><span>${laT('อัปเดตเวลารับตามพื้นที่ใหม่')}<br><span style="font-family:'DM Mono',monospace;font-size:11px">${tx}</span></span></label>`;
  }
  if(p.zoneDiff){
    /* §zoneFollow (2026-11-06) · owner: "ปรับเป็น Visit Panwa Pier แต่ไม่ย้าย" / "เปลี่ยนกลับ ก็ไม่ย้ายกลับให้"
       แถวในตารางเกาะตาม trip.zone ไม่ใช่พื้นที่รับ · เดิมป๊อปอัปเปลี่ยนแต่พื้นที่ แถวจึงไม่ขยับ · ตอนนี้ติ๊กให้โซนของทริปตามพื้นที่ใหม่ (ค่าเริ่มต้นติ๊ก) · ราคาไม่แตะ */
    h+=`<label style="display:flex;gap:7px;align-items:flex-start;margin-top:9px;font-size:11.5px;color:#3a3a35;cursor:pointer"><input type="checkbox" id="bkv2-zonepick-zone" checked style="margin-top:2px"><span><b>${laT('ย้ายโซนของทริปตามพื้นที่ใหม่')}</b> (${e(p.priceZones.map(bookingV2ZoneLabel).join(', '))} &rarr; <b>${e(bookingV2ZoneLabel(p.area.zone))}</b>)<br><span style="color:#7A4A00">${laT('แถวจะย้ายไปอยู่โซนนั้นในตาราง · ราคาไม่เปลี่ยน · ถ้าต้องคิดราคาใหม่ให้แก้ไขใบจอง')}</span></span></label>`;
  }
  info.innerHTML=h;
}
