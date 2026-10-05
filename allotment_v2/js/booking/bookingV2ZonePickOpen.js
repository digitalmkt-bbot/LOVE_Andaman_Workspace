/* ══ §zonePick (2026-10-05) · By trip · กดชื่อโซนแล้วเปลี่ยนพื้นที่รับได้เลย ═════════
   ผู้ใช้ขอ "กดที่ชื่อโซน ขึ้นป๊อปอัปให้เลือกโซน แล้วกดยืนยัน"
   ช่อง Zone ของ By trip คือ bk.pickupAreaId (ชื่อพื้นที่จาก Pickup Setup) · ที่นี่เปลี่ยนแค่ตัวนั้น
   ⚠ ไม่แตะ trip.zone · ฟอร์มจองใช้ trip.zone คิดราคา (PK/KL/NoTransfer) ถ้าเปลี่ยนตรงนี้
     ราคาจะขยับเงียบ ๆ จากหน้าที่ไม่มีราคาให้เห็น · ข้ามโซนราคาเมื่อไหร่ ป๊อปอัปเตือนให้ไปแก้ใบจอง
   เวลารับคิดใหม่จากพื้นที่ใหม่ (ติ๊กออกได้) · ทริปที่คนพิมพ์เวลาเองไว้ (pickupTimeEdited) ไม่แตะ
   แถวที่แยกคนไปรับคนละจุด (split) ไม่ได้เปิดป๊อปอัปนี้ · พื้นที่ของมันอยู่ใน ops.vanSplits คนละที่ */
function bookingV2ZonePickOpen(el, bkId, date){
  const e=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const bk=(SB_BOOKINGS||[]).find(b=>b.id===bkId); if(!bk) return;
  const old=document.getElementById('bkv2-zonepick'); if(old) old.remove();
  const cur=bk.pickupAreaId||'';
  const areas=(SB_PICKUP_AREAS||[]).filter(a=>a && a.id && a.active!==false);
  const zones=[...new Set(areas.map(a=>a.zone||''))].sort((x,y)=>bookingV2ZoneOrder(x)-bookingV2ZoneOrder(y));
  /* §zonePickFilter · เปิดมาโชว์เฉพาะโซนของใบจอง (ใบ PK เห็นแต่พื้นที่ Phuket) · กดชิปเปลี่ยนโซน / All ได้
     โซนของใบ = trip.zone ของวันนั้น (โซนที่คิดราคา) · ใบรถส่วนตัวราคาเป็น NoTransfer แต่รับจากโรงแรมจริง
     จึงใช้โซนของพื้นที่ปัจจุบันแทน · หาไม่ได้เลย = All */
  const _nz=z=>(z==='NT'?'NoTransfer':(z||''));
  const _curA=cur?bookingV2GetArea(cur):null;
  const _tz=_nz(((bk.trips||[]).find(t=>t&&(t.date||'')===(date||'')&&t.zone)||(bk.trips||[]).find(t=>t&&t.zone)||{}).zone);
  let defZone=(_tz==='NoTransfer' && _curA && _nz(_curA.zone)!=='NoTransfer') ? _nz(_curA.zone) : (_tz || (_curA?_nz(_curA.zone):''));
  if(!zones.some(z=>_nz(z)===defZone)) defZone='';
  window._bkV2ZonePick={ bkId, date:date||'', sel:cur, zone:defZone };
  const _chip=(z,t)=>{ const c=z?bookingV2ZoneColor(z):'#5F5E5A';
    return `<button class="zpk-chip" data-z="${e(z)}" data-c="${c}" onclick="bookingV2ZonePickZone('${e(z)}')" style="border:1px solid ${c}55;border-radius:999px;padding:3px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">${e(t)}</button>`; };
  const chipsH=[...new Set(zones.map(_nz))].map(z=>_chip(z, bookingV2ZoneLabel(z))).join('') + _chip('', laT('ทั้งหมด'));
  const listH=zones.map(z=>{
    const rows=areas.filter(a=>(a.zone||'')===z).sort((x,y)=>String(x.name||'').localeCompare(String(y.name||'')));
    const c=bookingV2ZoneColor(z);
    return `<div class="zpk-grp" data-z="${e(_nz(z))}"><div style="position:sticky;top:0;background:#FAFAF7;padding:6px 13px;font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:${c};border-top:1px solid #f0eee7">${e(bookingV2ZoneLabel(z))}</div>`
      + rows.map(a=>`<div class="zpk-row" data-id="${e(a.id)}" data-n="${e(String(a.name||'').toLowerCase()+' '+String(a.region||'').toLowerCase())}" onclick="bookingV2ZonePickSel('${e(a.id)}')" style="display:flex;align-items:center;gap:9px;padding:8px 13px;cursor:pointer;border-top:1px solid #f4f2ec">`
        + `<span class="zpk-dot" style="width:14px;height:14px;border-radius:50%;border:2px solid ${c};flex:none;box-sizing:border-box"></span>`
        + `<span style="flex:1;font-size:12.5px;font-weight:600;color:#2a2a26">${e(a.name||a.id)}${a.region?` <span style="font-weight:500;color:#9a988f;font-size:11px">· ${e(a.region)}</span>`:''}</span>`
        + (a.id===cur?`<span style="font-size:10px;color:#0F6E56;font-weight:700">${laT('ปัจจุบัน')}</span>`:'')
        + `</div>`).join('')
      + `</div>`;
  }).join('') || `<div style="padding:16px 13px;text-align:center;color:#8a8a82;font-size:12px">${laT('ยังไม่มีพื้นที่รับ · ไปเพิ่มที่ Pickup time setup')}</div>`;
  const curName=(cur&&bookingV2GetArea(cur)||{}).name || (bk.pickupArea||'').trim() || '—';
  const ov=document.createElement('div'); ov.id='bkv2-zonepick';
  ov.style.cssText='position:fixed;inset:0;z-index:600;background:transparent';
  ov.innerHTML=`<div id="bkv2-zonepick-panel" style="position:fixed;width:320px;max-width:92vw;background:#fff;border:1px solid #e0ddd4;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.22);overflow:hidden;font-family:'DM Sans',sans-serif;display:flex;flex-direction:column;max-height:80vh">
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 13px;border-bottom:1px solid #eee">
      <div style="min-width:0"><div style="font-size:12px;font-weight:800;color:#185FA5">&#128205; ${laT('เปลี่ยนโซนรับ')}</div>
        <div style="font-size:11px;color:#8a8a82;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${e(bk.leadPax||bk.customerName||'')} · ${e(bk.voucherRef||bk.id)} · ${laT('ตอนนี้')}: <b style="color:#2F4E77">${e(curName)}</b></div></div>
      <button onclick="document.getElementById('bkv2-zonepick').remove()" style="background:transparent;border:none;font-size:18px;color:#999;cursor:pointer;line-height:1">&times;</button>
    </div>
    <div style="padding:8px 13px;border-bottom:1px solid #f0eee7"><input id="bkv2-zonepick-q" oninput="bookingV2ZonePickFilter()" placeholder="${laT('ค้นหาพื้นที่…')}" style="width:100%;box-sizing:border-box;border:1px solid #e0ddd4;border-radius:8px;padding:6px 9px;font-size:12px;font-family:inherit">
      <div id="bkv2-zonepick-chips" style="display:flex;flex-wrap:wrap;gap:5px;margin-top:7px">${chipsH}</div></div>
    <div id="bkv2-zonepick-list" style="flex:1;min-height:0;overflow-y:auto">${listH}</div>
    <div id="bkv2-zonepick-info" style="padding:0 13px"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;padding:10px 13px;border-top:1px solid #eee">
      <button onclick="document.getElementById('bkv2-zonepick').remove()" style="border:1px solid #e0ddd4;background:#fff;color:#6b6b64;border-radius:8px;padding:6px 14px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">${laT('ยกเลิก')}</button>
      <button id="bkv2-zonepick-ok" onclick="bookingV2ZonePickConfirm()" style="border:none;background:#1683C7;color:#fff;border-radius:8px;padding:6px 16px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">${laT('ยืนยัน')}</button>
    </div>
  </div>`;
  ov.addEventListener('mousedown',ev=>{ ov._d=(ev.target===ov); });
  ov.onclick=ev=>{ if(ev.target===ov && ov._d) ov.remove(); };
  document.body.appendChild(ov);
  bookingV2ZonePickSel(cur);
  bookingV2ZonePickZone(defZone);
  try{
    const panel=document.getElementById('bkv2-zonepick-panel'); const r=el.getBoundingClientRect(); const pw=panel.offsetWidth||320, ph=panel.offsetHeight||400;
    let left=r.left; if(left+pw>window.innerWidth-8) left=Math.max(8, window.innerWidth-pw-8);
    let top=r.bottom+6; if(top+ph>window.innerHeight-8) top=Math.max(8, r.top-ph-6);
    if(top+ph>window.innerHeight-8) top=Math.max(8, window.innerHeight-ph-8);
    panel.style.left=left+'px'; panel.style.top=top+'px';
    const s=panel.querySelector('.zpk-row[data-id="'+(window.CSS&&CSS.escape?CSS.escape(cur):cur)+'"]'); if(s) s.scrollIntoView({block:'center'});
    const q=document.getElementById('bkv2-zonepick-q'); if(q) q.focus({preventScroll:true});
  }catch(_){}
}
