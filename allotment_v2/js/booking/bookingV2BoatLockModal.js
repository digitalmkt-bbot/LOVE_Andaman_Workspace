function bookingV2BoatLockModal(){
  const f=_bkBoatForm; if(!f) return '';
  const E=_bkBE;
  /* §bkLock · เฉพาะเส้นทางเรือ · โปรแกรมบก (City Tour, รับส่งสนามบิน, โชว์) ไม่มีเรือให้ล็อก
     กติกาเดียวกับทั้งระบบ · ถามผ่าน laIsLandRoute() จุดเดียวเหมือนหน้าจอฝั่งเรืออื่น ๆ */
  const ROU=(typeof ROUTES!=='undefined'?ROUTES:[]).filter(r=>r && (typeof laIsLandRoute!=='function' || !laIsLandRoute(r.id)));
  const routeOpts='<option value="">— เลือกเส้นทาง —</option>'
    + ROU.map(r=>`<option value="${E(r.id)}" ${f.routeId===r.id?'selected':''}>${E(r.name)}</option>`).join('');
  const agentList=(typeof SB_AGENTS!=='undefined'?SB_AGENTS:[]).map(a=>`<option value="${E(a.name)}"></option>`).join('');
  const list=bookingV2BoatLockPickList(f.date,f.routeId,f.editId||null);
  const lab='display:block;font-size:9.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#6e675e;margin-bottom:5px';
  const inp='width:100%;border:1px solid var(--border);border-radius:8px;background:#FCFBF9;padding:8px 10px;font-family:inherit;font-size:12.5px;color:var(--ink)';
  const boatRows=list.map(b=>{
    const on=f.boatId===b.id;
    return `<div onclick="${b.ok?`bookingV2BoatLockSet('boatId','${E(b.id)}')`:''}" style="display:flex;align-items:center;gap:10px;padding:8px 11px;border-bottom:1px solid #EFECE6;font-size:12.5px;${b.ok?'cursor:pointer;':'background:#F7F5F2;color:#a8a29a;'}${on?'background:#F3EBFA;':''}">
      <span style="width:13px;height:13px;border-radius:50%;flex:none;border:2px solid ${on?'#6B289A':'#C3BCB2'};background:${on?'#6B289A':'transparent'};box-shadow:${on?'inset 0 0 0 2.5px #fff':'none'}"></span>
      <b style="font-weight:700">${E(b.name)}</b>
      <span style="font-family:'DM Mono',monospace;font-size:11.5px;color:${b.ok?'var(--ink-soft)':'inherit'}">${b.cap} ที่</span>
      <span style="margin-left:auto;font-size:11px;font-weight:600;color:${b.own?'#6B289A':(b.ok?'#0C6B47':'#8A6A1A')}">${b.own?'ลำที่กันไว้ตอนนี้':(b.ok?'ว่าง':E(b.why))}</span>
    </div>`;
  }).join('') || '<div style="padding:14px;text-align:center;color:var(--ink-faint);font-size:12px">วันนี้ไม่มีเรือ</div>';
  /* ด่านกัน · ลำที่เลือกมีใบจองอยู่ → โชว์รายการให้เลย คนกดต้องรู้ว่าจะย้ายใบไหน */
  const pick=list.find(x=>x.id===f.boatId);
  const blk=(pick && !pick.ok) ? pick.blockers : null;
  const blkBox=(blk && blk.rows.length) ? `
    <div style="margin-top:10px;border:1px solid #EFC9C4;background:#fff;border-radius:10px;overflow:hidden">
      <div style="background:#FBEAE8;padding:9px 12px;border-bottom:1px solid #EFC9C4">
        <b style="font-size:12.5px;color:#B3261E">ล็อกลำนี้ไม่ได้ · มีใบจองอยู่แล้ว ${blk.pax} ที่</b>
        <div style="font-size:11px;color:#7a4a44;margin-top:3px">ย้ายใบเหล่านี้ไปลำอื่นก่อน แล้วค่อยกลับมาล็อก</div>
      </div>
      <div style="max-height:150px;overflow:auto">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          ${blk.rows.slice(0,12).map(r=>`<tr>
            <td style="padding:6px 11px;border-bottom:1px solid #F0EDE7;font-family:'DM Mono',monospace">${E(r.vc)}</td>
            <td style="padding:6px 11px;border-bottom:1px solid #F0EDE7">${E((typeof bookingV2LockHolderName==='function'&&r.agentId)?bookingV2AgentNm(r.agentId):'')}</td>
            <td style="padding:6px 11px;border-bottom:1px solid #F0EDE7;text-align:center;font-family:'DM Mono',monospace">${r.pax}</td>
            <td style="padding:6px 11px;border-bottom:1px solid #F0EDE7;text-align:right;font-size:11px;color:var(--ink-soft)">${r.fromLock?('ดึงจากล็อก '+r.fromLock):'—'}</td>
          </tr>`).join('')}
        </table>
      </div>
    </div>` : '';
  const pill=(on,t,d,act)=>`<div onclick="${act}" style="flex:1 1 220px;cursor:pointer;border:1px solid ${on?'#6B289A':'var(--border)'};background:${on?'#F3EBFA':'#FCFBF9'};border-radius:10px;padding:10px 12px;${on?'box-shadow:inset 0 0 0 1px #6B289A':''}">
      <div style="font-size:12.5px;font-weight:700;display:flex;align-items:center;gap:8px">
        <span style="width:13px;height:13px;border-radius:50%;flex:none;border:2px solid ${on?'#6B289A':'#C3BCB2'};background:${on?'#6B289A':'transparent'};box-shadow:${on?'inset 0 0 0 2.5px #fff':'none'}"></span>${t}</div>
      <div style="font-size:11px;color:var(--ink-soft);line-height:1.6;margin-top:4px">${d}</div></div>`;
  const capNow=f.boatId?bookingV2BoatCapOn(f.boatId,f.date):0;
  const ready=!!(f.routeId&&f.date&&f.boatId&&f.expiry&&pick&&pick.ok);
  return `
  <div onclick="bookingV2BoatLockClose()" style="position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:9998;display:flex;align-items:center;justify-content:center;padding:20px">
    <div onclick="event.stopPropagation()" class="bkv2-locks" style="background:#fff;border-radius:15px;width:760px;max-width:96vw;max-height:92vh;overflow:auto;box-shadow:0 16px 50px rgba(0,0,0,.3)">
      <div style="padding:14px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px">
        <div style="flex:1">
          <div style="font-size:9.5px;font-weight:700;letter-spacing:.07em;color:#6B289A;text-transform:uppercase">Hold whole boat</div>
          <div style="font-size:15.5px;font-weight:700;margin-top:2px">${f.editId?'แก้ไขใบล็อกเรือทั้งลำ':'ล็อกเรือทั้งลำ · ใบใหม่'}</div>
        </div>
        <button onclick="bookingV2BoatLockClose()" style="border:none;background:transparent;font-size:20px;color:var(--ink-soft);cursor:pointer;line-height:1">&times;</button>
      </div>
      <div style="padding:16px 18px">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">
          <div><label style="${lab}">เส้นทาง</label>
            <select style="${inp}" onchange="bookingV2BoatLockSet('routeId',this.value)">${routeOpts}</select></div>
          <div><label style="${lab}">วันที่เดินทาง</label>
            <input type="date" style="${inp}" value="${E(f.date)}" onchange="bookingV2BoatLockSet('date',this.value)"></div>
          <div><label style="${lab}">ผู้ถือ</label>
            <div style="display:flex;gap:6px">
              <select style="${inp};width:auto" onchange="bookingV2BoatLockSet('holderType',this.value)">
                <option value="agent" ${f.holderType==='agent'?'selected':''}>เอเยนต์</option>
                <option value="office" ${f.holderType==='office'?'selected':''}>Office</option>
              </select>
              ${f.holderType==='agent'?`<input list="bkbl-ag" style="${inp}" value="${E(f.holderName)}" placeholder="ชื่อเอเยนต์" oninput="bookingV2BoatLockSetQ('holderName',this.value)"><datalist id="bkbl-ag">${agentList}</datalist>`:''}
            </div></div>
          <div><label style="${lab}">หมดอายุ <span style="color:#B3261E;text-transform:none;letter-spacing:0">· บังคับกรอก</span></label>
            <input type="date" style="${inp}" value="${E(f.expiry)}" onchange="bookingV2BoatLockSet('expiry',this.value)"></div>
        </div>

        <div style="margin-top:14px"><label style="${lab}">ลำเรือ</label>
          <div style="border:1px solid var(--border);border-radius:9px;overflow:hidden;max-height:208px;overflow-y:auto">${boatRows}</div>
          ${blkBox}</div>

        <div style="margin-top:14px"><label style="${lab}">แบบการตกลงกับเอเยนต์</label>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            ${pill(f.fixed!==false,'สัญญาลำนี้เลย'+(f.boatId?(' · '+E(bookingV2BoatNameOf(f.boatId))):''),
              'เอเยนต์รู้ชื่อเรือ เอาไปขายต่อได้ · ฝ่ายเรือสลับลำไม่ได้เงียบ ๆ ต้องเด้งเตือนก่อน',
              "bookingV2BoatLockSet('fixed',true)")}
            ${pill(f.fixed===false,'สัญญา “เรือ 1 ลำ”',
              'ฝ่ายเรือสลับลำได้เองจนถึงวันเดินทาง ถ้าความจุไม่ต่ำกว่าที่สัญญาไว้',
              "bookingV2BoatLockSet('fixed',false)")}
          </div>
          <div style="margin-top:9px;display:flex;align-items:center;gap:9px;flex-wrap:wrap">
            <span style="font-size:11.5px;color:var(--ink-soft)">ที่นั่งขั้นต่ำที่รับปากไว้</span>
            <input type="number" min="1" style="${inp};width:92px;text-align:right;font-family:'DM Mono',monospace" value="${E(f.minCap)}" oninput="bookingV2BoatLockSetQ('minCap',this.value)">
            <span style="font-size:11.5px;color:var(--ink-soft)">ที่${capNow?(' · ลำที่เลือกจุ '+capNow):''}</span>
          </div>
        </div>

        <div style="margin-top:14px"><label style="${lab}">หมายเหตุ <span style="text-transform:none;letter-spacing:0;font-weight:500;color:#8a8378">· ขึ้นในหน้า Seat Locks และใบงาน By trip</span></label>
          <textarea id="bkbl-note" rows="2" style="${inp};resize:vertical;line-height:1.5" placeholder="เช่น กรุ๊ปบริษัท · รอยืนยันจำนวนหัว · ผู้ประสานงาน" oninput="bookingV2BoatLockSetQ('reason',this.value)">${E(f.reason)}</textarea></div>

        <div style="margin-top:14px;border:1px solid #DCC7EE;background:#F3EBFA;border-radius:10px;padding:11px 13px;font-size:12px;color:#53207A;line-height:1.65">
          <b>=</b> กันไว้ <b>ทั้งลำ${f.boatId?(' · '+E(bookingV2BoatNameOf(f.boatId))+' · '+capNow+' ที่'):''}</b>
          — ความจุของวันนั้นลดลง ${capNow} ที่หนึ่งครั้ง
          และ<b>ไม่ไปหักจากพูลที่นั่งซ้ำอีกรอบ</b>
        </div>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;padding:12px 18px;background:#fafafa;border-top:1px solid var(--border)">
        ${f.editId?`<button onclick="bookingV2BoatLockFormGo('charter')" title="เปิดฟอร์มจองเหมาลำ กรอกให้ล่วงหน้าจากใบล็อกนี้" style="font-family:inherit;font-size:12px;font-weight:700;color:#6B289A;background:#F3EBFA;border:1px solid #DCC7EE;border-radius:9px;padding:8px 14px;cursor:pointer">เหมาลำ</button>
        <button onclick="bookingV2BoatLockFormGo('release')" title="คืนเรือลำนี้เข้าพูลขายที่นั่งทันที" style="font-family:inherit;font-size:12px;font-weight:600;color:#A32D2D;background:#FDECEA;border:1px solid #F5C9C4;border-radius:9px;padding:8px 14px;cursor:pointer">ปล่อยลำ</button>
        <span style="flex:1"></span>`:''}
        <button onclick="bookingV2BoatLockClose()" style="font-family:inherit;font-size:12px;font-weight:600;color:var(--ink-soft);background:#fff;border:1px solid var(--border);border-radius:9px;padding:8px 14px;cursor:pointer">ยกเลิก</button>
        <button ${ready?'':'disabled'} onclick="bookingV2BoatLockSubmit()" style="font-family:inherit;font-size:12px;font-weight:700;color:#fff;background:${ready?'#6B289A':'#C9C4BC'};border:1px solid ${ready?'#6B289A':'#C9C4BC'};border-radius:9px;padding:8px 16px;cursor:${ready?'pointer':'not-allowed'}">${f.editId?'บันทึกการแก้ไข':'ล็อกลำนี้'}</button>
      </div>
    </div>
  </div>`;
}
