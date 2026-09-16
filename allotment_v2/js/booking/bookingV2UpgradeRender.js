function bookingV2UpgradeRender(){
  const esc = s => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const bkId=_bkUpgBk; const bk=(SB_BOOKINGS||[]).find(x=>x.id===bkId); if(!bk) return;
  if(!Array.isArray(bk.upgrades)) bk.upgrades=[];
  const list=bk.upgrades; const fmt=n=>'฿'+pckNum(n);
  const editing=_bkUpgEditId?list.find(u=>u.id===_bkUpgEditId):null;
  const rows=list.map(u=>{ const on=(u.id===_bkUpgEditId); return `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:0.5px solid var(--fd-line-soft);${on?'background:#F0F7FF;border-radius:7px;padding:8px':''}">
      <div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:600">${esc(u.label)} ${u.collected?'<span style="color:#0F6E56;font-size:10px">&#10003; เก็บแล้ว</span>':'<span style="color:#9A5B00;font-size:10px">รอเก็บ</span>'}</div><div style="font-size:10px;color:var(--fd-ink-soft)">ขาย ${fmt(u.sellPrice)} · บริษัท ${fmt(u.toCompany)} · คอม ${fmt(u.commission)}${u.seller?' · <b style="color:#854F0B">'+esc(u.seller)+'</b>':''}${(u.method&&u.method!=='cash')?` · <b style="color:#0C447C">${u.method==='card'?'บัตร':'โอน'}</b>${(+u.fee||0)?` (ค่าธรรมเนียม ฿${pckNum(u.fee)})`:''}${(!(u.slips||[]).length)?' <span style="color:#A32D2D">⚠ ยังไม่มีสลิป</span>':''}`:''}</div></div>
      <button onclick="bookingV2UpgradeEditLoad('${u.id}','${bkId}')" title="แก้ไข" style="background:transparent;border:none;color:#185FA5;cursor:pointer;font-size:13px">&#9998;</button>
      <button onclick="bookingV2UpgradeDelete('${u.id}','${bkId}')" title="ลบ" style="background:transparent;border:none;color:#A32D2D;cursor:pointer;font-size:13px">✕</button>
    </div>`; }).join('') || '<div style="font-size:11.5px;color:var(--fd-ink-soft);font-style:italic;padding:6px 0">ยังไม่มีรายการอัพเกรด</div>';
  const _si=editing?Math.max(0,BKV2_UPGRADE_PRESETS.indexOf(editing.label)):0;
  const presetOpts=BKV2_UPGRADE_PRESETS.map((p,i)=>`<option value="${i}"${i===_si?' selected':''}>${p}</option>`).join('');
  const fLabel=editing?editing.label:BKV2_UPGRADE_PRESETS[0];
  const fSell=editing?(editing.sellPrice||0):0;
  const fComp=editing?(editing.toCompany||0):0;
  const fComm=Math.max(0,pckN(fSell-fComp));
  const fColl=editing?!!editing.collected:false;
  const fNote=editing?(editing.note||''):'';
  const fSeller=editing?(editing.seller||''):'';
  const _sellerOpts=(typeof SB_SALES!=='undefined'?SB_SALES:[]).map(s=>`<option value="${esc(s.name)}">`).join('');
  acctModal(`
    <datalist id="bkv2-sellers">${_sellerOpts}</datalist>`+`
    <div style="padding:16px 20px;border-bottom:1px solid var(--fd-line);display:flex;align-items:center;justify-content:space-between"><div><div style="font-size:15px;font-weight:700">&#11014; อัพเกรดหน้างาน · ${bk.code||bk.id}</div><div style="font-size:11px;color:var(--fd-ink-soft)">กำหนดราคาขาย − จ่ายบริษัท = คอมมิชชั่น · สรุปที่ Travel Summary</div></div><button onclick="acctModalClose()" style="background:transparent;border:none;font-size:20px;color:var(--fd-ink-soft);cursor:pointer">✕</button></div>
    <div style="padding:16px 20px">
      ${rows}
      <div style="display:flex;align-items:center;justify-content:space-between;margin:8px 0 14px;padding-top:8px;border-top:1px solid var(--fd-line)"><span style="font-size:11px;color:var(--fd-ink-soft)">รวมขาย / คอมมิชชั่น</span><span style="font-size:13px;font-weight:700;font-variant-numeric:tabular-nums"><span style="color:#185FA5">${fmt(bookingV2UpgradePaidTotal(bkId))}</span> <span style="color:var(--fd-ink-soft);font-weight:400">·</span> <span style="color:#854F0B">คอม ${fmt(bookingV2UpgradeCommTotal(bkId))}</span></span></div>
      <div style="margin-bottom:8px"><label style="font-size:10px;color:var(--fd-ink-soft)">ประเภทอัพเกรด</label><select id="bku-preset" onchange="bookingV2UpgradePreset()" style="width:100%;height:32px;font-size:12px;font-family:inherit;border:1px solid var(--fd-line);border-radius:7px;padding:2px 6px;background:#fff">${presetOpts}</select></div>
      <div style="margin-bottom:8px"><label style="font-size:10px;color:var(--fd-ink-soft)">ชื่อรายการ (แก้ได้)</label><input id="bku-label" type="text" value="${esc(fLabel)}" style="width:100%;height:32px;font-size:12px;border:1px solid var(--fd-line);border-radius:7px;padding:2px 8px"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px">
        <div><label style="font-size:10px;color:var(--fd-ink-soft)">ราคาขาย ฿ (เก็บลูกค้า)</label><input id="bku-sell" type="number" min="0" step="0.01" value="${fSell}" oninput="bookingV2UpgradeRecalc()" style="width:100%;height:32px;font-size:12px;text-align:right;font-weight:700;border:1px solid var(--fd-line);border-radius:7px;padding:2px 8px"></div>
        <div><label style="font-size:10px;color:var(--fd-ink-soft)">จ่ายบริษัท ฿</label><input id="bku-company" type="number" min="0" step="0.01" value="${fComp}" oninput="bookingV2UpgradeRecalc()" style="width:100%;height:32px;font-size:12px;text-align:right;border:1px solid var(--fd-line);border-radius:7px;padding:2px 8px"></div>
        <div><label style="font-size:10px;color:#854F0B">คอมมิชชั่น (= ส่วนต่าง)</label><div style="height:32px;display:flex;align-items:center;justify-content:flex-end;padding:0 8px;font-size:13px;font-weight:700;font-variant-numeric:tabular-nums;color:#854F0B;background:#FCF8F0;border:1px solid #854F0B33;border-radius:7px"><span id="bku-comm">${fmt(fComm)}</span></div></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
        <div><label style="font-size:10px;color:#854F0B">คนขาย (คอมมิชชั่นของใคร)</label><input id="bku-seller" list="bkv2-sellers" type="text" value="${esc(fSeller)}" placeholder="เลือก/พิมพ์ชื่อคนขาย" style="width:100%;height:32px;font-size:12px;border:1px solid var(--fd-line);border-radius:7px;padding:2px 8px"></div>
        <div><label style="font-size:10px;color:var(--fd-ink-soft)">โน้ต</label><input id="bku-note" type="text" value="${esc(fNote)}" placeholder="โน้ต (ถ้ามี)" style="width:100%;height:32px;font-size:12px;border:1px solid var(--fd-line);border-radius:7px;padding:2px 8px"></div>
      </div>
      <div style="margin-bottom:10px"><label style="font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer"><input id="bku-coll" type="checkbox" ${fColl?'checked':''} style="width:16px;height:16px">เก็บเงินแล้ว</label></div>
      <div id="bku-pay" style="margin-bottom:12px"></div>
      <div style="display:flex;justify-content:flex-end;gap:8px">${editing?`<button onclick="bookingV2UpgradeEditCancel()" style="background:#fff;border:1px solid var(--fd-line);color:var(--fd-ink);font-family:inherit;font-size:12px;padding:9px 15px;border-radius:9px;cursor:pointer">ยกเลิกแก้ไข</button>`:''}<button onclick="bookingV2UpgradeSave('${bkId}')" style="background:${editing?'#185FA5':'#0F7A5A'};color:#fff;border:none;font-family:inherit;font-size:12px;font-weight:600;padding:9px 18px;border-radius:9px;cursor:pointer">${editing?'บันทึกการแก้ไข':'+ เพิ่มอัพเกรด'}</button></div>
    </div>`);
  if(typeof bookingV2ExtraPayRender==='function') bookingV2ExtraPayRender();   // §upgPay · วาดบล็อกรับเงินหลัง modal ขึ้นจอแล้ว
}
