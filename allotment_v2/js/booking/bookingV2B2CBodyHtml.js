// เนื้อบรรทัดสรุป (ใช้ทั้งในแถวและในแถบรวม)
function bookingV2B2CBodyHtml(bk, p, date){
  const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const fs=p.segs.map(s=>`<span class="b2cf"><span class="k">${esc(s.label)}</span>${s.vals.slice(0,-1).map(v=>`<s>${esc(v)}</s>`).join(' &rarr; ')} &rarr; <b>${esc(s.vals[s.vals.length-1])}</b></span>`);
  p.extras.forEach(x=>fs.push(`<span class="b2cf">${esc(x)}</span>`));
  if(p.isNew){ const t=p.newText.replace(/^New booking from B2C( · )?/,''); if(t) fs.push(`<span class="b2cf">${esc(t)}</span>`); }
  // จัดรถไว้แล้ว แต่สิ่งที่กระทบรถเปลี่ยน → เตือนให้ตรวจรถ
  let warn='';
  try{
    const o=(typeof bkOpsRead==='function' && date) ? bkOpsRead(bk,date) : (bk.ops||{});
    const hasVan=!!(o && (o.vanId || o.vanGroup || (Array.isArray(o.vanSplits)&&o.vanSplits.length)));
    if(hasVan && !p.cancelled && p.segs.some(s=>/^(Hotel|Pickup area|Self-arrive|Pax)/.test(s.label))) warn=`<span class="b2cw">&#9888; จัดรถแล้ว &middot; ตรวจรถ</span>`;
    if(hasVan && p.cancelled) warn=`<span class="b2cw">&#9888; ยังอยู่ในกรุ๊ปรถ &middot; เอาออกจากรถ</span>`;
  }catch(e){}
  return fs.join('<span class="b2csep">&middot;</span>')+warn;
}
