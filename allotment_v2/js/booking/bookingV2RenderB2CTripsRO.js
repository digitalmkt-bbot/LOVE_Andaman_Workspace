// ทริป + add-on ของใบ B2C · อ่านอย่างเดียว · sync ลบแล้วใส่ใหม่ทุกรอบ แก้ที่นี่ไม่มีทางอยู่
function bookingV2RenderB2CTripsRO(d){
  var e=function(x){ return String(x||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); };
  var rows=(d.trips||[]).map(function(t,i){
    var r=(typeof ROUTES!=='undefined')?ROUTES.find(function(x){return x.id===t.routeId;}):null;
    var pt=function(k){ return (typeof bookingV2PaxTot==='function')?bookingV2PaxTot(t.pax||{},k):0; };
    var parts=[]; if(pt('ad'))parts.push(pt('ad')+' AD'); if(pt('chd'))parts.push(pt('chd')+' CHD');
    if(pt('inf'))parts.push(pt('inf')+' INF'); if(pt('foc'))parts.push(pt('foc')+' FOC');
    return '<div style="display:flex;align-items:baseline;gap:10px;padding:8px 0;border-bottom:1px solid #f0eee9">'
      +'<span style="font-family:\'DM Mono\',monospace;font-size:11px;color:#9b9590">'+(i+1)+'</span>'
      +'<div style="flex:1;min-width:0"><div style="font-weight:700;font-size:12.5px">'+e((r&&r.name)||t.routeId)+'</div>'
      +'<div style="font-size:11px;color:var(--ink-soft);margin-top:2px">'+e(t.date||'—')
        +' &middot; '+e(t.zone||'—')+' &middot; '+e(parts.join(' · ')||'0 pax')+'</div></div>'
      +'<div style="font-family:\'DM Mono\',monospace;font-size:12px">&#3647;'+(Number(t.subtotal)||0).toLocaleString()+'</div>'
    +'</div>';
  }).join('');
  return '<div style="border:1px solid #EAD9B0;background:#FFFBF2;border-radius:10px;padding:10px 13px">'
    +'<div style="font-size:11px;font-weight:700;color:#633806;letter-spacing:.03em">ทริป &middot; pax &middot; ราคา มาจาก B2C</div>'
    +'<div style="font-size:10.5px;color:#8a7a58;margin-top:2px;line-height:1.45">ชุดนี้ถูกดึงใหม่จาก B2C ทุกครั้งที่ sync '
      +'&middot; แก้ตรงนี้จะถูกทับกลับ ถ้าต้องเปลี่ยนทริป/จำนวนคน/ราคา ให้แก้ที่ B2C</div>'
    +'<div style="margin-top:8px">'+(rows||'<div style="font-size:11.5px;color:#9b9590;padding:8px 0">ไม่มีทริป</div>')+'</div>'
  +'</div>';
}
