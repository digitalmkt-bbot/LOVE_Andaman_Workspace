/* ══ §lkHeal · กู้ช่วงวันของล็อก Bulk ที่หายไปกับ round-trip ของ SQL ═══════════════
   ตาราง sb_seat_locks ไม่มีคอลัมน์ datefrom/dateto/dow มาตั้งแต่ §lkBulk
   ทุกใบที่เคยเซฟขึ้น cloud จึงกลับมาแบบ scope='bulk' ที่ไม่มีช่วงวันเลย
   → bookingV2LockRange คืนค่าว่าง → ไม่ครอบรอบไหน → ไม่ขึ้น manifest วันไหนทั้งนั้น
   แก้ที่ backend แล้ว (mapping + model + ALTER TABLE) แต่ใบที่ค่าหายไปก่อนหน้านั้น
   ต้องเติมคืนเอง · ร่องรอยที่ยังอยู่ในฐาน เรียงตามความน่าเชื่อถือ:
     1. monthFrom/monthTo/month  — ถูก map มาตลอด · ใบที่แปลงมาจาก scope='month' มีครบ
     2. log[].note ของรายการแก้ไข — 'dateFrom: — → 2026-11-01' (§lkEdit · note ถูก map)
     3. log[].note ของรายการแปลง  — 'month → bulk 2026-11-01→2026-12-31'
   ไม่มีร่องรอยเลย = กู้ไม่ได้จริง ๆ · whenCell จะติดป้ายแดงให้กรอกช่วงวันใหม่
   ทำงานซ้ำได้ · แตะเฉพาะใบที่ dateFrom ว่าง จึงไม่เคยทับค่าที่คนกรอกมาเอง
   ═══════════════════════════════════════════════════════════════════════════════ */
function bookingV2LockHealRange(l){
  if(!l || l.scope!=='bulk' || l.dateFrom) return null;
  const mf = l.monthFrom || l.month || '', mt = l.monthTo || l.monthFrom || l.month || '';
  if(/^\d{4}-\d{2}$/.test(mf) && /^\d{4}-\d{2}$/.test(mt)){
    const y=+mt.slice(0,4), m=+mt.slice(5,7);
    const last=new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { from: mf+'-01', to: mt+'-'+String(last).padStart(2,'0'), src:'month' };
  }
  const logs = Array.isArray(l.log) ? l.log : [];
  let from='', to='';
  for(let i=logs.length-1; i>=0; i--){                                  // ล่าสุดชนะ
    const note = String((logs[i]&&logs[i].note)||'');
    if(!from){ const a=/dateFrom:[^→]*→\s*(\d{4}-\d{2}-\d{2})/.exec(note); if(a) from=a[1]; }
    if(!to){   const b=/dateTo:[^→]*→\s*(\d{4}-\d{2}-\d{2})/.exec(note);   if(b) to=b[1]; }
    if(from&&to) break;
  }
  if(from||to) return { from: from||to, to: to||from, src:'editlog' };
  for(let i=logs.length-1; i>=0; i--){
    const m2=/month\s*→\s*bulk\s*(\d{4}-\d{2}-\d{2})\s*→\s*(\d{4}-\d{2}-\d{2})/.exec(String((logs[i]&&logs[i].note)||''));
    if(m2) return { from:m2[1], to:m2[2], src:'migratelog' };
  }
  return null;
}
