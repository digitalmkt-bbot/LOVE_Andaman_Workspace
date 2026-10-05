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
    h+=`<div style="margin-top:9px;background:#FBF0DD;color:#7A4A00;border-radius:8px;padding:7px 9px;font-size:11px;line-height:1.45">&#9888; ${laT('พื้นที่ใหม่อยู่คนละโซนราคากับใบจอง')} (${e(p.priceZones.map(bookingV2ZoneLabel).join(', '))} &rarr; ${e(bookingV2ZoneLabel(p.area.zone))}) · ${laT('ราคาไม่เปลี่ยน · ถ้าต้องคิดราคาใหม่ให้แก้ไขใบจอง')}</div>`;
  }
  info.innerHTML=h;
}
