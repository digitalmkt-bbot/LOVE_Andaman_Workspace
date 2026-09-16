// Shared create-lock form fields (used by the Seat Locks tab + Calendar modal)
function bookingV2LockFormFields(){
  const f = _bkV2LockForm;
  const esc = s => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const isBulk = f.scope==='bulk';
  if(!Array.isArray(f.dow)) f.dow=[];
  const agentDatalist = (typeof SB_AGENTS!=='undefined'?SB_AGENTS:[]).map(a=>`<option value="${esc(a.name)}"></option>`).join('');
  const routeOpts = (typeof ROUTES!=='undefined'?ROUTES:[]).map(r=>`<option value="${r.id}" ${f.routeId===r.id?'selected':''}>${esc(r.name)}</option>`).join('');
  const scopeBtn = (val,lbl)=>`<button onclick="bookingV2LockSetField('scope','${val}')" style="border:none;cursor:pointer;font-family:inherit;font-size:11.5px;font-weight:700;padding:5px 13px;background:${f.scope===val?'#C0392B':'#fff'};color:${f.scope===val?'#fff':'#9a3b21'};border-radius:6px">${lbl}</button>`;
  // §lkBulk · ติ๊กวันในสัปดาห์ · ไม่ติ๊ก = ทุกวัน
  const DOWL=['อา','จ','อ','พ','พฤ','ศ','ส'];
  const dowPick = DOWL.map((d,i)=>{
    const on = f.dow.indexOf(i)>=0;
    return `<button onclick="bookingV2LockToggleDow(${i})" style="width:40px;height:32px;border-radius:8px;border:1px solid ${on?'#5B3FA5':'var(--border)'};background:${on?'#5B3FA5':'#FBFAF7'};color:${on?'#fff':'var(--ink-soft)'};font-family:inherit;font-size:11.5px;font-weight:600;cursor:pointer">${d}</button>`;
  }).join('');
  // สรุปเป็นภาษาคน กันตีความผิดว่าเป็นโควตารวม
  const _thMon=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const _dmy = ds => { if(!ds) return '—'; const p=String(ds).split('-'); return (+p[2])+' '+(_thMon[(+p[1])-1]||'')+' '+p[0]; };
  const dowTxt = f.dow.length ? f.dow.slice().sort((a,b)=>a-b).map(i=>DOWL[i]).join(' · ') : 'ทุกวัน';
  const summary = isBulk
    ? `กันไว้ <b>${esc(f.qty||'—')} ที่ทุกรอบ</b> ที่ออกระหว่าง <b>${esc(_dmy(f.dateFrom))} – ${esc(_dmy(f.dateTo||f.dateFrom))}</b> เฉพาะวัน <b>${esc(dowTxt)}</b><br>
       จองวันไหนไปก็ตัดยอดเฉพาะวันนั้น วันอื่นยังมี ${esc(f.qty||'—')} ที่เต็ม · ที่นั่งของแต่ละรอบจะปล่อยคืนเข้า pool อัตโนมัติ <b>${esc(String(f.releaseDaysBefore||0))} วันก่อนเดินทาง เวลา ${esc(f.releaseTime||'18:00')}</b>`
    : `กันที่นั่งไว้เฉพาะรอบของวันนั้นวันเดียว`;
  return `
      <div style="display:flex;align-items:center;gap:9px;margin-bottom:12px">
        <span style="font-size:10px;font-weight:700;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.05em">แบบ</span>
        <span style="display:inline-flex;background:#F7E9E6;border:1px solid #EAC6BF;border-radius:8px;padding:3px;gap:2px">${scopeBtn('day','รายวัน · วันเดียว')}${scopeBtn('bulk','Bulk · ช่วงวันที่')}</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end">
        <div style="flex:2 1 210px;min-width:190px"><label class="bkv2-nb-label" style="display:block;margin-bottom:4px">เส้นทาง</label><select class="bkv2-nb-input" style="width:100%" onchange="bookingV2LockSetField('routeId',this.value)"><option value="">— เลือกเส้นทาง —</option>${routeOpts}</select></div>
        ${isBulk
          ? `<div style="flex:1 1 300px;min-width:270px"><label class="bkv2-nb-label" style="display:block;margin-bottom:4px">ช่วงวันที่</label>
               <div style="display:flex;align-items:center;gap:7px">
                 <input class="bkv2-nb-input" type="date" value="${esc(f.dateFrom)}" onchange="bookingV2LockSetField('dateFrom',this.value)" style="flex:1">
                 <span style="color:var(--ink-faint)">&rarr;</span>
                 <input class="bkv2-nb-input" type="date" value="${esc(f.dateTo)}" min="${esc(f.dateFrom)}" onchange="bookingV2LockSetField('dateTo',this.value)" style="flex:1">
               </div></div>`
          : `<div style="flex:1 1 150px;min-width:140px"><label class="bkv2-nb-label" style="display:block;margin-bottom:4px">วันที่</label><input class="bkv2-nb-input" type="date" value="${esc(f.date)}" onchange="bookingV2LockSetField('date',this.value)" style="width:100%"></div>`}
        <div style="flex:1 1 130px;min-width:120px"><label class="bkv2-nb-label" style="display:block;margin-bottom:4px">ผู้ถือ</label><select class="bkv2-nb-input" style="width:100%" onchange="bookingV2LockSetField('holderType',this.value)">
          <option value="office" ${f.holderType==='office'?'selected':''}>Office hold</option>
          <option value="agent" ${f.holderType==='agent'?'selected':''}>Agent</option>
          <option value="global" ${f.holderType==='global'?'selected':''}>Global pool</option>
        </select></div>
        ${f.holderType==='agent'?`<div style="flex:1 1 170px;min-width:150px"><label class="bkv2-nb-label" style="display:block;margin-bottom:4px">Agent</label><input class="bkv2-nb-input" list="bkv2-lock-agents" value="${esc(f.holderName)}" placeholder="พิมพ์ชื่อเอเจ้น…" oninput="bookingV2LockSetField('holderName',this.value)" style="width:100%"><datalist id="bkv2-lock-agents">${agentDatalist}</datalist></div>`:''}
      </div>
      ${isBulk?`<div style="margin-top:13px"><label class="bkv2-nb-label" style="display:block;margin-bottom:4px">วันในสัปดาห์ <em style="font-weight:500;color:#b4b2a9;font-style:normal">· ไม่ติ๊ก = ทุกวัน</em></label>
        <div style="display:flex;gap:5px;flex-wrap:wrap">${dowPick}</div></div>`:''}
      <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;margin-top:13px">
        <div style="flex:0 1 150px;min-width:130px"><label class="bkv2-nb-label" style="display:block;margin-bottom:4px">${isBulk?'ที่นั่งต่อรอบ':'ที่นั่ง'}</label><input class="bkv2-nb-input" type="number" min="1" value="${esc(f.qty)}" placeholder="เช่น 10" oninput="bookingV2LockSetField('qty',this.value)" style="width:100%"></div>
        ${isBulk
          ? `<div style="flex:1 1 260px;min-width:240px"><label class="bkv2-nb-label" style="display:block;margin-bottom:4px">ปล่อยคืน <em style="font-weight:500;color:#b4b2a9;font-style:normal">· ก่อนวันเดินทางแต่ละรอบ</em></label>
               <div style="display:flex;align-items:center;gap:6px">
                 <input class="bkv2-nb-input" type="number" min="0" value="${esc(f.releaseDaysBefore)}" oninput="bookingV2LockSetField('releaseDaysBefore',this.value)" style="width:66px">
                 <span style="font-size:11.5px;color:var(--ink-soft);white-space:nowrap">วันก่อน เวลา</span>
                 <input class="bkv2-nb-input" type="time" value="${esc(f.releaseTime||'18:00')}" onchange="bookingV2LockSetField('releaseTime',this.value)" style="width:112px">
               </div></div>`
          : `<div style="flex:1 1 140px;min-width:130px"><label class="bkv2-nb-label" style="display:block;margin-bottom:4px">หมดอายุ <em style="font-weight:500;color:#b4b2a9;font-style:normal">· ปล่อยคืนอัตโนมัติ</em></label><input class="bkv2-nb-input" type="date" value="${esc(f.expiry)}" onchange="bookingV2LockSetField('expiry',this.value)" style="width:100%"></div>`}
        <div style="flex:1 1 100%"><label class="bkv2-nb-label" style="display:block;margin-bottom:4px">โน้ต</label><input class="bkv2-nb-input" value="${esc(f.reason)}" placeholder="เช่น allotment รายสัปดาห์ · กรุ๊ปสอบถาม" oninput="bookingV2LockSetField('reason',this.value)" style="width:100%"></div>
      </div>
      <div style="margin-top:13px;font-size:11.5px;color:var(--ink-soft);background:#F7F6F1;border-radius:9px;padding:9px 12px;line-height:1.55">${summary}</div>`;
}
