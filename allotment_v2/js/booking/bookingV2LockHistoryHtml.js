/* ══ §lkHist (2026-10-20) · owner "ปลดล็อคของ BG Travel ผิด · ทำประวัติ" → "เอาแค่ประวัติก็พอ ถ้าปล่อยผิดเราก็สร้างใหม่อีกที"
   หน้าต่าง "ประวัติ" ของล็อกแสดงรายการปล่อย/ปล่อยรอบ/เพิ่มที่นั่ง (รวมกรุ๊ปย่อย) · ใคร เมื่อไหร่ เท่าไหร่ · อ่านอย่างเดียว ไม่มีปุ่มคืน
   ใช้คอลัมน์ log เดิม (type/qty/note/tripDate/at/by) · ไม่ต้องแก้ฐานข้อมูล ══ */
/* ประวัติของล็อก (รวมกรุ๊ปย่อย) · ใหม่สุดก่อน · ปุ่มคืนกลับเฉพาะรายการที่ยังคืนได้ */
function bookingV2LockHistoryHtml(mL, esc){
  const kids=bookingV2LockChildren(mL.id);
  const T={release:['ปล่อยที่นั่ง','#A32D2D'], 'release-round':['ปล่อยรอบ','#A32D2D'], add:['เพิ่มที่นั่ง','#0F6E56'],
           expire:['หมดอายุ','#64748B'], reactivate:['เปิดใหม่','#64748B']};
  const rows=[];
  [mL].concat(kids).forEach(l=>{ (l.log||[]).forEach((e,i)=>{ if(!e || !T[e.type]) return; rows.push({l:l,e:e,i:i}); }); });
  const key=r=>String(r.e.at||((r.e.date||'')+'T99'))+'|'+String(r.i).padStart(5,'0');
  rows.sort((a,b)=> key(b).localeCompare(key(a)));
  const head=`<div style="font-size:10px;font-weight:700;color:var(--ink);text-transform:uppercase;letter-spacing:.05em">ประวัติ</div>`;
  if(!rows.length) return `<div style="margin-top:14px;border-top:1px solid var(--border-2);padding-top:11px">${head}<div style="font-size:11px;color:var(--ink-soft);margin-top:4px">ยังไม่มีการปล่อยหรือเพิ่มที่นั่ง</div></div>`;
  const tm=e=>{ if(!e.at) return esc(e.date||''); const d=new Date(e.at); if(isNaN(d)) return esc(e.date||''); return esc(bookingV2LocalYMD(d)+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')); };
  const body=rows.slice(0,40).map(r=>{ const e=r.e, l=r.l, t=T[e.type];
    const what=t[0]+(e.qty?(' '+e.qty+' ที่'):'')+(e.tripDate?(' · รอบ '+e.tripDate):'');
    return `<div style="padding:6px 0;border-top:1px solid var(--border-2)">
        <div style="font-size:11.5px;font-weight:700;color:${t[1]}">${esc(what)}${l.parentId?` <span style="font-weight:600;color:#534AB7">· ${esc(l.subName||'ย่อย')}</span>`:''}</div>
        <div style="font-family:'DM Mono',monospace;font-size:9.5px;color:var(--ink-soft)">${tm(e)}${e.by?(' · '+esc(e.by)):''}${e.note?(' · '+esc(e.note)):''}</div></div>`; }).join('');
  return `<div style="margin-top:14px;border-top:1px solid var(--border-2);padding-top:11px">${head}<div style="margin-top:4px">${body}</div></div>`;
}
