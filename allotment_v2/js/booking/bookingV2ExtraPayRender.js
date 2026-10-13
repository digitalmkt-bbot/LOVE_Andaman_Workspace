// วาดเฉพาะบล็อกการรับเงิน · ไม่แตะช่องอื่นในฟอร์ม
function bookingV2ExtraPayRender(){
  var host=document.getElementById(_bkxPayHost||'bkx-pay'); if(!host) return;
  var esc=function(x){ return String(x||'').replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  var P=_bkExtraPay, h='';
  h+='<label style="font-size:10px;color:var(--fd-ink-soft)">วิธีรับเงิน</label>';
  var _ways=BKX_PAY_WAYS.filter(function(x){ return x[0]!=='cot' || _bkxPayCot; });
  h+='<div style="display:grid;grid-template-columns:repeat('+(_ways.length>3?2:3)+',1fr);gap:7px;margin:4px 0 10px">';
  _ways.forEach(function(x){
    var on=(P.m===x[0]);
    h+='<button type="button" onclick="bookingV2ExtraSetM(\''+x[0]+'\')" style="border:1.5px solid '+(on?'#0F7A5A':'var(--fd-line)')+';background:'+(on?'#E8F5EF':'#fff')+';color:'+(on?'#0F6E56':'var(--fd-ink)')+';border-radius:9px;padding:7px 4px;cursor:pointer;font-family:inherit;line-height:1.25">'
      +'<span style="display:block;font-size:12px;font-weight:'+(on?'700':'600')+'">'+x[1]+'</span>'
      +'<span style="display:block;font-size:9.5px;color:'+(on?'#0F6E56':'var(--fd-ink-soft)')+';opacity:.85">'+x[2]+'</span></button>';
  });
  h+='</div>';
  if(P.m==='cot'){
    h+='<div style="display:flex;gap:9px;align-items:flex-start;background:#FDF6E7;border:1px solid #E7CE93;'
      +'border-radius:9px;padding:9px 11px;margin-bottom:10px">'
      +'<span style="font-size:13px;line-height:1.2">&#9203;</span>'
      +'<div style="font-size:10.5px;color:#7A4A00;line-height:1.6">'
      +'<b>ยังไม่ได้รับเงิน</b> \u00b7 รายการนี้จะไปขึ้นเป็น <b>ยอดที่ต้องเก็บ</b> ที่หน้า '
      +'เช็คอินหน้าท่า ของวันเดินทาง<br>พอเก็บเงินจริงแล้วให้กด &#10003; ที่รายการ '
      +'หรือแก้วิธีรับเงินเป็น เงินสด / โอน / บัตร</div></div>';
  }
  if(P.m==='card'){
    var base=_bkxPayBase(), fee=bookingV2ExtraFee();
    h+='<div style="display:grid;grid-template-columns:1fr 1.6fr;gap:8px;margin-bottom:10px">'
      +'<div><label style="font-size:10px;color:var(--fd-ink-soft)">ค่าธรรมเนียมบัตร %</label>'
      +'<input type="text" inputmode="decimal" data-bkx="pct" value="'+esc(String(P.feePct==null?0:P.feePct))+'" oninput="bookingV2ExtraSetPct(this.value)" style="width:100%;height:32px;font-size:12px;text-align:right;border:1px solid var(--fd-line);border-radius:7px;padding:2px 8px"></div>'
      +'<div><label style="font-size:10px;color:#7A4A00">ลูกค้าจ่ายจริง</label>'
      +'<div style="height:32px;display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:0 9px;background:#FCF8F0;border:1px solid #854F0B33;border-radius:7px">'
      +'<span style="font-size:10px;color:#7A4A00">ค่าธรรมเนียม &#3647;'+pckNum(fee)+'</span>'
      +'<b style="font-size:13.5px;font-variant-numeric:tabular-nums;color:#7A4A00">&#3647;'+pckNum(base+fee)+'</b></div></div></div>';
  }
  if(P.m!=='cash' && P.m!=='cot'){
    h+='<label style="font-size:10px;color:var(--fd-ink-soft)">สลิป — แนบทีหลังได้</label>';
    h+='<div style="margin:4px 0 4px">';
    P.slips.forEach(function(sp,i){
      h+='<div style="display:flex;align-items:center;gap:8px;font-size:11.5px;padding:4px 0;border-bottom:0.5px solid var(--fd-line-soft)">'
        /* §slipView · กดชื่อไฟล์เปิดดูได้ · โอเวอร์เลย์ z-index สูงกว่ากล่องนี้ จึงไม่โดนบัง */
        +'<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;text-decoration:underline" '
          +laSlipClickAttr(P.slips, 'สลิปของรายการขายเพิ่ม', i)
          +' title="กดเพื่อเปิดดูสลิป">&#128206; '+esc(sp.name||sp.url||'slip')+'</span>'
        +'<button type="button" onclick="bookingV2ExtraRmSlip('+i+')" style="background:transparent;border:none;color:#A32D2D;cursor:pointer;font-size:12px">&#10005;</button></div>';
    });
    h+='<label style="display:block;border:1.5px dashed var(--fd-line);border-radius:9px;padding:10px;text-align:center;font-size:11.5px;color:var(--fd-ink-soft);cursor:pointer;margin-top:4px">'
      +'&#128247; ถ่ายรูป / เลือกไฟล์สลิป'
      +'<input type="file" accept="image/*,application/pdf" onchange="bookingV2ExtraPickSlip(this)" style="display:none"></label>';
    h+='</div>';
  }
  // §pierDecimal · จำ caret ของช่อง % ไว้ก่อนเขียนทับ แล้วคืนให้ ไม่งั้นพิมพ์ 2.5 ไม่ได้
  var _ae=document.activeElement;
  var _fk=(_ae && _ae.getAttribute) ? _ae.getAttribute('data-bkx') : null;
  var _fp=(_fk && typeof _ae.selectionStart==='number') ? _ae.selectionStart : null;
  host.innerHTML=h;
  if(_fk){ var _el=host.querySelector('[data-bkx="'+_fk+'"]');
           if(_el){ try{ _el.focus(); if(_fp!=null) _el.setSelectionRange(_fp,_fp); }catch(_){} } }
}
