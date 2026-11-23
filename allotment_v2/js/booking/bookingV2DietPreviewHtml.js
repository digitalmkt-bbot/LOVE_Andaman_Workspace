/* ตัวอย่างสด · หน้าตาเดียวกับช่อง Add-on ของ By trip date · ผู้กรอกเห็นทันทีว่าพิมพ์แบบนี้แล้วขึ้นแบบไหน */
function bookingV2DietPreviewHtml(){
  /* §mealNote3 · owner: "ต้องให้เห็นทั้ง By trip date / Pier Checkin / PR/PO" · สามหน้าแสดงไม่เหมือนกันและคนอ่านคนละกลุ่ม
     วาดป้ายด้วยสีและคำเดียวกับหน้าจริง (t2-rb · pckMealChips · ppChips) · เป็นภาพจำลองของใบนี้ใบเดียว ไม่ใช่ยอดรวมทั้งลำ */
  const d=_bkV2.newBooking; if(!d) return '';
  const sm=d.specialMeals||{}, g=d.guides||{};
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const veg=+sm.veg||0, vegan=+sm.vegan||0, halal=+sm.halal||0;
  const al=bookingV2AllergyOnlyText(sm), nt=bookingV2MealNoteOnly(sm), alN=bookingV2AllergyCount(sm);
  const hasList=(Array.isArray(sm.allergyList)?sm.allergyList:[]).some(x=>x&&x.name);
  const txtAl=(!hasList && bookingV2MealNoteIsAl(sm));                       /* แพ้แบบพิมพ์ข้อความ ไม่มีจำนวนคน */
  const allPax=txtAl && (typeof ppAllPax==='function') && ppAllPax(sm.allergies);
  const gl=[]; if(g.english)gl.push('EN'); if(g.russian)gl.push('RU'); if(g.chinese)gl.push('CN'); if((g.otherLang||'').trim())gl.push(esc(g.otherLang));
  const dash='<span style="color:#9AA1AE;font-size:12px">&mdash;</span>';
  /* 1 · By trip date */
  const rb=(t,bg,c)=>`<span style="font-size:10px;border-radius:5px;padding:2px 7px;font-weight:600;white-space:nowrap;background:${bg};color:${c}">${t}</span>`;
  const B=[];
  if(veg) B.push(rb(veg+' veg','#EAF3DE','#3B6D11'));
  if(vegan) B.push(rb(vegan+' vegan','#EAF3DE','#3B6D11'));
  if(halal) B.push(rb(halal+' halal','#E1F5EE','#0F6E56'));
  if(+d.largeLuggage) B.push(rb((+d.largeLuggage)+' bag','#FAEEDA','#854F0B'));
  gl.forEach(code=>{ const lc=(typeof bookingV2LangColors==='function')?bookingV2LangColors(code):['#EEF2FF','#3730A3']; B.push(rb(code,lc[0],lc[1])); });
  const r1=(!B.length && !al && !nt)?dash:
     ((B.length?`<div style="display:flex;flex-wrap:wrap;gap:4px">${B.join('')}</div>`:'')
     +(al?`<div style="font-size:11px;line-height:1.35;color:#A32D2D;margin-top:4px">Allergy: ${esc(al)}</div>`:'')
     +(nt?`<div style="font-size:11px;line-height:1.35;color:#5F5E5A;margin-top:4px">&#127860; ${esc(nt)}</div>`:''));
  /* 2 · Pier Checkin */
  const mc=(t,bg,c,bd)=>`<span style="display:inline-block;font-size:10.5px;font-weight:700;border:1px solid ${bd};border-radius:999px;padding:2px 9px;white-space:nowrap;background:${bg};color:${c}">${t}</span>`;
  const P=[];
  if(veg) P.push(mc('มังสวิรัติ '+veg,'#E7F4EF','#0F6E56','#BEE0D2'));
  if(vegan) P.push(mc('วีแกน '+vegan,'#E7F4EF','#0F6E56','#BEE0D2'));
  if(halal) P.push(mc('ฮาลาล '+halal,'#E9F1FB','#185FA5','#C3D9F0'));
  if(alN) P.push(mc('&#9888; แพ้อาหาร '+alN,'#FCEBEB','#A32D2D','#F0C9C9'));
  if(nt) P.push(mc('โน้ตอาหาร','#F4F3EF','#5F5E5A','#DDD9CF'));
  if(gl.length) P.push(mc('&#128483; ไกด์ '+gl.join('/'),'#EEF2FF','#3730A3','#C7D2FE'));
  const r2=P.length?(`<div style="display:flex;flex-wrap:wrap;gap:4px">${P.join('')}</div>`
     +((alN||nt)?'<div style="font-size:10px;color:#8A8F9C;margin-top:3px">ข้อความเต็มอยู่ในป้าย · ชี้ค้างถึงจะเห็น</div>':'')):dash;
  /* 3 · PR/PO */
  const pc=(t,bg,bd,c)=>`<span style="display:inline-block;font-size:11.5px;border:1px solid ${bd};border-radius:999px;padding:2px 10px;margin:0 4px 4px 0;background:${bg};color:${c}">${t}</span>`;
  const O=[];
  if(veg) O.push(pc('มังสวิรัติ <b>'+veg+'</b>','#E7F4EF','#BEE0D2','#0F6E56'));
  if(vegan) O.push(pc('วีแกน <b>'+vegan+'</b>','#E7F4EF','#BEE0D2','#0F6E56'));
  if(halal) O.push(pc('ฮาลาล <b>'+halal+'</b>','#E9F1FB','#C3D9F0','#185FA5'));
  if(hasList) O.push(pc('&#9888; แพ้อาหาร <b>'+alN+'</b> คน &middot; '+(sm.allergyList||[]).filter(x=>x&&x.name).map(x=>esc(x.name)+' <b>&times;'+Math.max(1,Math.floor(+x.qty||1))+'</b>').join(' &middot; '),'#FEF2F2','#F5CFCF','#B91C1C'));
  else if(allPax) O.push(pc('&#9888; แพ้อาหาร <b>ทั้งใบ</b> &middot; '+esc(String(sm.allergies).trim()),'#FEF2F2','#F5CFCF','#B91C1C'));
  else if(txtAl) O.push(pc('&#9888; แพ้อาหาร <b>ยังไม่รู้จำนวน 1 ใบ</b> &middot; '+esc(String(sm.allergies).trim()),'#FEF2F2','#F5CFCF','#B91C1C'));
  const _nl=(nt && !allPax && typeof ppNoteLine==='function')?ppNoteLine({t:nt,veg:veg,vegan:vegan,halal:halal}):'';   /* §mealNote4 */
  const r3=(O.length?O.join(''):(_nl?'':'<span style="color:#9AA1AE;font-size:11.5px">ไม่มีรายการอาหารพิเศษ</span>'))+_nl;
  const row=(lb,who,body)=>`<div style="padding:8px 0;border-top:1px solid #E9ECF2">
      <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:5px"><b style="font-size:11px;color:#16265C">${lb}</b><span style="font-size:10px;color:#8A8F9C">${who}</span></div>${body}</div>`;
  const tips=[];
  if(txtAl && !allPax) tips.push('<span style="color:#A32D2D">โน้ตมีคำเกี่ยวกับการแพ้ แต่ไม่มีจำนวนคน &middot; เพิ่มในช่อง Allergies พร้อมจำนวนคนจะชัดกว่า</span>');
  if(nt && !(veg||vegan||halal)) tips.push('<span style="color:#6B7280">โน้ตอาหารไม่ถูกนับเป็นจำนวน &middot; ถ้าเป็นมังสวิรัติ / วีแกน / ฮาลาล ให้ติ๊กที่ Diet ด้วย</span>');
  return `<div style="border:1px dashed #C9CCD6;border-radius:12px;background:#FAFBFD;padding:10px 12px 4px">
    <div style="font-size:10px;font-weight:800;letter-spacing:.06em;color:#3E4658;margin-bottom:6px">ตัวอย่าง &middot; ใบนี้จะขึ้นในแต่ละหน้าแบบนี้</div>
    ${row('By trip date','ทีมรับจอง',r1)}
    ${row('Pier Checkin','หน้าท่า',r2)}
    ${row('PR/PO','สั่งอาหาร / ครัว',r3)}
    ${tips.length?`<div style="font-size:11px;line-height:1.55;padding:7px 0 6px;border-top:1px solid #E9ECF2">${tips.join('<br>')}</div>`:''}
  </div>`;
}
