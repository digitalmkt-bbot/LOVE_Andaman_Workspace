function bookingV2ExtraRender(){
  const esc = s => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const bkId=_bkExtraBk; const bk=(SB_BOOKINGS||[]).find(x=>x.id===bkId); if(!bk) return;
  const list=bookingV2ExtrasFor(bkId); const fmt=n=>'฿'+pckNum(n);
  const editing=_bkExtraEditId?list.find(e=>e.id===_bkExtraEditId):null;
  const rows=list.map(e=>{ const on=(e.id===_bkExtraEditId); const _g=(typeof bkxExGot==='function')?bkxExGot(e):true; return `<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:0.5px solid var(--fd-line-soft);${on?'background:#F0F7FF;border-radius:7px;padding:7px 8px':(_g?'':'background:#FDF9F0;border-radius:7px;padding:7px 8px')}"><div style="flex:1;min-width:0"><div style="font-size:12px">${e.service}${e.qty>1?` ×${e.qty} @ ${fmt(e.unitPrice)}`:''}${_g?'':' <span style="font-size:9.5px;font-weight:700;color:#8A5300;background:#FBEFD6;border-radius:5px;padding:1px 6px">&#9203; รอเก็บวันเดินทาง</span>'}</div>${((+e.commission||0)||e.seller)?`<div style="font-size:10px;color:var(--fd-ink-soft)">${(+e.commission||0)?`บริษัท ${fmt(e.toCompany)} · คอม ${fmt(e.commission)}`:''}${e.seller?`${(+e.commission||0)?' · ':''}<b style="color:#854F0B">${esc(e.seller)}</b>`:''}${(e.method&&e.method!=='cash'&&e.method!=='cot')?` · <b style="color:#0C447C">${e.method==='card'?'บัตร':'โอน'}</b>${(+e.fee||0)?` (ค่าธรรมเนียม ฿${pckNum(e.fee)})`:''}${(!(e.slips||[]).length)?' <span style="color:#A32D2D">⚠ ยังไม่มีสลิป</span>':''}`:''}</div>`:''}</div><span style="font-size:12px;font-variant-numeric:tabular-nums;font-weight:600">${fmt(e.total)}</span>${_g?'':`<button onclick="bookingV2ExtraCollect('${e.id}','${bkId}')" title="เก็บเงินสดแล้ว" style="background:#E8F5EF;border:1px solid #9FCFBB;color:#0F6E56;cursor:pointer;font-size:12px;font-weight:700;border-radius:7px;padding:3px 8px">&#10003;</button>`}<button onclick="bookingV2ExtraEditLoad('${e.id}','${bkId}')" title="แก้ไข" style="background:transparent;border:none;color:#185FA5;cursor:pointer;font-size:13px">&#9998;</button><button onclick="bookingV2ExtraDelete('${e.id}','${bkId}')" title="ลบ" style="background:transparent;border:none;color:#A32D2D;cursor:pointer;font-size:13px">✕</button></div>`; }).join('') || '<div style="font-size:11.5px;color:var(--fd-ink-soft);font-style:italic;padding:6px 0">ยังไม่มีรายการ</div>';
  const _selIdx=editing?Math.max(0,BKV2_EXTRA_PRESETS.findIndex(p=>p.name===editing.service)):0;
  const presetOpts=BKV2_EXTRA_PRESETS.map((p,i)=>`<option value="${i}"${i===_selIdx?' selected':''}>${p.name}</option>`).join('');
  const _fName=editing?editing.service:BKV2_EXTRA_PRESETS[0].name;
  const _fQty=editing?editing.qty:1;
  const _fPrice=editing?editing.unitPrice:BKV2_EXTRA_PRESETS[0].price;
  const _fCompany=editing?(editing.toCompany||0):0;
  const _fComm=Math.max(0,pckN((_fQty*_fPrice)-_fCompany));
  const _fSeller=editing?(editing.seller||''):'';
  const _sellerOpts=(typeof SB_SALES!=='undefined'?SB_SALES:[]).map(s=>`<option value="${esc(s.name)}">`).join('');
  acctModal(`
    <datalist id="bkv2-sellers">${_sellerOpts}</datalist>
    <div style="padding:16px 20px;border-bottom:1px solid var(--fd-line);display:flex;align-items:center;justify-content:space-between"><div><div style="font-size:15px;font-weight:700">Extra วันเดินทาง · ${bk.code||bk.id}</div><div style="font-size:11px;color:var(--fd-ink-soft)">ขายหน้างาน หรือขายล่วงหน้าแล้วเก็บเงินวันเดินทาง · ไม่เกี่ยวกับเครดิต/บิล agent</div></div><button onclick="acctModalClose()" style="background:transparent;border:none;font-size:20px;color:var(--fd-ink-soft);cursor:pointer">✕</button></div>
    <div style="padding:16px 20px">
      ${rows}
      <div style="display:flex;align-items:center;justify-content:space-between;margin:8px 0 14px;padding-top:8px;border-top:1px solid var(--fd-line)"><span style="font-size:11px;color:var(--fd-ink-soft)">รวมขายหน้างาน</span><span style="font-size:15px;font-weight:700;font-variant-numeric:tabular-nums;color:#0F6E56">${fmt(bookingV2ExtraTotal(bkId))}</span></div>
      <div style="display:grid;grid-template-columns:2fr 1fr;gap:8px;margin-bottom:8px">
        <div><label style="font-size:10px;color:var(--fd-ink-soft)">เลือกบริการ</label><select id="bkx-preset" onchange="bookingV2ExtraPreset()" style="width:100%;height:32px;font-size:12px;font-family:inherit;border:1px solid var(--fd-line);border-radius:7px;padding:2px 6px;background:#fff">${presetOpts}</select></div>
        <div><label style="font-size:10px;color:var(--fd-ink-soft)">จำนวน</label><input id="bkx-qty" type="number" min="1" value="${_fQty}" oninput="bookingV2ExtraRecalc()" style="width:100%;height:32px;font-size:12px;text-align:right;border:1px solid var(--fd-line);border-radius:7px;padding:2px 8px"></div>
      </div>
      <div style="display:grid;grid-template-columns:2fr 1fr;gap:8px;margin-bottom:8px">
        <div><label style="font-size:10px;color:var(--fd-ink-soft)">ชื่อรายการ (แก้ได้)</label><input id="bkx-name" type="text" value="${esc(_fName)}" style="width:100%;height:32px;font-size:12px;border:1px solid var(--fd-line);border-radius:7px;padding:2px 8px"></div>
        <div><label style="font-size:10px;color:var(--fd-ink-soft)">ราคา/หน่วย ฿ (ขาย)</label><input id="bkx-price" type="number" min="0" step="0.01" value="${_fPrice}" oninput="bookingV2ExtraRecalc()" style="width:100%;height:32px;font-size:12px;text-align:right;border:1px solid var(--fd-line);border-radius:7px;padding:2px 8px"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
        <div><label style="font-size:10px;color:var(--fd-ink-soft)">จ่ายบริษัท ฿ (รวม)</label><input id="bkx-company" type="number" min="0" step="0.01" value="${_fCompany}" oninput="bookingV2ExtraRecalc()" title="ยอดที่ต้องส่งคืนบริษัท · ที่เหลือ = คอมมิชชั่นคนขาย" style="width:100%;height:32px;font-size:12px;text-align:right;border:1px solid var(--fd-line);border-radius:7px;padding:2px 8px"></div>
        <div><label style="font-size:10px;color:#854F0B">คอมมิชชั่น (= ขาย − บริษัท)</label><div style="height:32px;display:flex;align-items:center;justify-content:flex-end;padding:0 8px;font-size:13px;font-weight:700;font-variant-numeric:tabular-nums;color:#854F0B;background:#FCF8F0;border:1px solid #854F0B33;border-radius:7px"><span id="bkx-comm">${fmt(_fComm)}</span></div></div>
      </div>
      <div id="bkx-pay" style="margin:2px 0 12px;padding-top:10px;border-top:1px solid var(--fd-line)"></div>
      <div style="margin-bottom:12px"><label style="font-size:10px;color:#854F0B">คนขาย (คอมมิชชั่นของใคร)</label><input id="bkx-seller" list="bkv2-sellers" type="text" value="${esc(_fSeller)}" placeholder="เลือก/พิมพ์ชื่อคนขาย" style="width:100%;height:32px;font-size:12px;border:1px solid var(--fd-line);border-radius:7px;padding:2px 8px"></div>
      <div style="display:flex;justify-content:flex-end;gap:8px">${editing?`<button onclick="bookingV2ExtraEditCancel()" style="background:#fff;border:1px solid var(--fd-line);color:var(--fd-ink);font-family:inherit;font-size:12px;padding:9px 15px;border-radius:9px;cursor:pointer">ยกเลิกแก้ไข</button>`:''}<button onclick="bookingV2ExtraSave('${bkId}')" style="background:${editing?'#185FA5':'#0F7A5A'};color:#fff;border:none;font-family:inherit;font-size:12px;font-weight:600;padding:9px 18px;border-radius:9px;cursor:pointer">${editing?'บันทึกการแก้ไข':'+ เพิ่มรายการ'}</button></div>
    </div>`);
  setTimeout(bookingV2ExtraPayRender,0);
}
