function bookingV2VoucherTicket(bk, esc){
  esc = esc || (s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]));
  const NAVY='#16265C', CYAN='#4FA9DC', ROW='#F2F3F5', MUT='#7C8091', RED='#E0232A';
  const trips=(bk.trips||[]), t0=trips[0]||{}, dsFirst=t0.date||'';
  const PIER={tublamu:'Tub Lamu',panwa:'Visit Panwa',ranong:'Ranong'};
  const money=n=>'\u0e3f'+Math.round(+n||0).toLocaleString('en-US');
  const Z='<span style="color:#B9BCC6">\u2014</span>';

  const st=String(bk.status||'');
  const stLbl=(typeof bookingV2StatusLabel==='function')?bookingV2StatusLabel(st):st;
  const stCol=/cancel|reject/.test(st)?'#C6403F':(/pending/.test(st)?'#DBA02A':CYAN);

  const ag=(bk.agentId&&typeof sbGetAgent==='function')?sbGetAgent(bk.agentId):null;
  const agTxt=ag?[ag.name,ag.code].filter(Boolean).join(' \u00b7 '):(bk.channelType==='b2c'?'B2C \u00b7 Direct':'Walk-in / Direct');
  // \u00a7b2cBy \u00b7 \u0e1c\u0e39\u0e49\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e43\u0e1a\u0e19\u0e35\u0e49 \u00b7 \u0e43\u0e1a B2C \u0e04\u0e37\u0e2d\u0e0a\u0e37\u0e48\u0e2d\u0e1e\u0e19\u0e31\u0e01\u0e07\u0e32\u0e19\u0e17\u0e35\u0e48\u0e04\u0e35\u0e22\u0e4c\u0e1d\u0e31\u0e48\u0e07 B2C (relSyncB2C \u0e43\u0e2a\u0e48 booked_by_name \u0e25\u0e07 createdBy)
  //   'b2c_sync' \u0e04\u0e37\u0e2d\u0e04\u0e48\u0e32\u0e15\u0e01\u0e04\u0e49\u0e32\u0e07\u0e02\u0e2d\u0e07\u0e43\u0e1a\u0e40\u0e01\u0e48\u0e32\u0e17\u0e35\u0e48\u0e15\u0e49\u0e19\u0e17\u0e32\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e0a\u0e37\u0e48\u0e2d \u2014 \u0e44\u0e21\u0e48\u0e15\u0e49\u0e2d\u0e07\u0e40\u0e2d\u0e32\u0e02\u0e36\u0e49\u0e19\u0e43\u0e1a
  const byTxt=(String(bk.createdBy||'').trim()==='b2c_sync')?'':String(bk.createdBy||'').trim();

  const PT=(px,k)=>(typeof bookingV2PaxTot==='function')?bookingV2PaxTot(px||{},k):0;
  /* §vcSkin · จำนวนคนเขียนเป็นคำ · "2 Adult" อ่านออกทันทีโดยไม่ต้องรู้ว่า AD ย่อจากอะไร
     ประเภทที่เป็น 0 ไม่ขึ้นเลย · ของเดิมโชว์สี่ชิปเสมอ ใบที่มีแต่ผู้ใหญ่จึงมีชิป 0 สามอัน
     แย่งที่และแย่งสายตาโดยไม่ได้บอกอะไร
     ชิปอยู่บนพื้นขาวแล้ว จึงเปลี่ยนเป็นฟ้าอ่อนตัวอักษรกรมท่า ไม่ใช่สีทึบแบบบนพื้นน้ำเงิน */
  const PAXW={ad:'Adult',chd:'Child',inf:'Infant',foc:'FOC'};
  const paxChip=(k,lbl,n)=> (n>0)
    ? ('<span style="background:#EAF4FB;color:'+NAVY+';border:1.5px solid #BFD9EE;border-radius:8px;'
       +'padding:4px 12px;font-size:11px;font-weight:600;white-space:nowrap">'
       +'<b style="font-size:14px;font-weight:800;letter-spacing:-.01em;margin-right:3px;'
       +'font-family:\'DM Mono\',monospace">'+n+'</b>'+PAXW[k]+'</span>')
    : '';
  /* ทั้งใบไม่มีใครสักคน · ต้องบอกว่าว่าง ไม่ใช่ปล่อยแถวเปล่า */
  const paxRow=(px)=>{
    const out=['ad','chd','inf','foc'].map(k=>paxChip(k,'',PT(px,k))).filter(Boolean).join('');
    return out || '<span style="font-size:11.5px;color:#B9BCC6">ยังไม่ระบุจำนวนผู้โดยสาร</span>';
  };

  // การ์ดทริป · หลายทริปในใบเดียวก็เรียงต่อกัน (ชื่อลูกค้าอยู่ในใบแรกใบเดียว)
  const tripCards=trips.map((t,i)=>{
    const r=(typeof ROUTES!=='undefined')?ROUTES.find(x=>x.id===t.routeId):null;
    const dep=(r&&(r.times||[])[0])||'';
    const meta=[dep, PIER[(r&&r.pier)||'']||''].filter(Boolean).join(' \u00b7 ');
    // §date · เดือนเป็นตัวอักษร · เลขวันกับปีเป็น mono ให้ตัวเลขเรียงตรงกันทุกใบ
    let dD='', dM='', dY='';
    /* §vcSkin · วันที่รูปแบบแปลก (ข้อมูลเก่าบางใบเก็บเป็น "Sat Jul 04") ทำให้ Date เพี้ยน
       แต่ไม่ throw · ป้ายวันที่จึงขึ้น "NaN NaN" · เช็คก่อนแล้วถอยไปโชว์ค่าดิบแทน */
    try{ if(t.date){ const _dt=new Date(t.date+'T12:00:00');
      if(isNaN(_dt.getTime())) throw 0;
      dD=String(_dt.getDate());
      dM=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][_dt.getMonth()]||'';
      dY=String(_dt.getFullYear()); } }catch(_){}
    const MONO='font-family:\'DM Mono\',monospace';
    const dHtml = dD ? ('<span style="'+MONO+'">'+dD+'</span> '+dM+' <span style="'+MONO+'">'+dY+'</span>')
                     : esc(t.date||'\u2014');
    const rc=(r&&r.color)||CYAN;   // §bar · สีประจำเส้นทาง · ไม่มีก็ใช้ฟ้าของแบรนด์
    const cot=(i===0 && bk.cashOnTour && +bk.cashOnTour.amount>0)?+bk.cashOnTour.amount:0;
    /* §vcSkin · แยกการ์ดเป็นสองส่วน · แถบบนน้ำเงินคือ "ทริปอะไร วันไหน"
       ส่วนล่างพื้นขาวคือ "ใครไป กี่คน" · ของเดิมน้ำเงินทั้งใบ ชื่อลูกค้าตัวขาวบนน้ำเงิน
       อ่านสู้ตัวกรมท่าบนพื้นขาวไม่ได้ และทำให้ใบดูทึบไปทั้งก้อน
       ยังอยู่ในกรอบเดียวกัน จึงยังอ่านเป็นเรื่องเดียว ไม่ได้แตกเป็นสองการ์ด */
    return '<div style="border:1.5px solid #D5DAE5;border-radius:16px;overflow:hidden;'
      + 'margin-bottom:10px;background:#fff">'
      + '<div style="background:'+NAVY+';color:#fff;padding:13px 16px;border-left:7px solid '+rc+'">'
      + '<div style="display:flex;align-items:flex-start;gap:12px">'
        + '<div style="min-width:0"><div style="font-size:19px;font-weight:800;line-height:1.18;letter-spacing:-.01em">'   /* §big · ชื่อเส้นทาง */
          + esc((r&&r.name)||t.routeId||'\u2014')
          + (t.bookingMode==='charter'?' <span style="font-size:10.5px;font-weight:800;color:#D9C2FF">CHARTER</span>':'')+'</div>'
          + (meta?('<div style="font-size:10.5px;opacity:.72;margin-top:3px">'+esc(meta)+'</div>'):'')+'</div>'
        /* §big · วันเดินทาง · ป้ายขาวบนพื้นน้ำเงิน อ่านเจอก่อนอย่างอื่น */
        + '<span style="margin-left:auto;background:#fff;color:'+NAVY+';border-radius:999px;padding:5px 14px;'
          + 'font-size:15px;font-weight:800;white-space:nowrap">'+dHtml+'</span>'
      + '</div></div>'
      /* ── ส่วนล่าง · พื้นขาว ── */
      + '<div style="padding:12px 16px;background:#fff">'
      + (i===0 ? ('<div style="font-size:9.5px;letter-spacing:.11em;font-weight:800;color:#8A9099;text-transform:uppercase">Lead passenger</div>'
          + '<div style="font-size:20px;font-weight:800;letter-spacing:-.01em;line-height:1.2;'
          + 'margin-top:2px;color:'+NAVY+'">'+esc(bk.leadPax||'\u2014')+'</div>')
        : '')
      + '<div style="display:flex;gap:7px;'+(i===0?'margin-top:10px;':'')+'flex-wrap:wrap;align-items:center">'
        + paxRow(t.pax)
        + (cot?('<span style="margin-left:auto;background:#FDF3DC;color:#7A4A00;border:1.5px solid #EBD9AE;'
                +'border-radius:8px;padding:4px 12px;font-size:11px;font-weight:800;white-space:nowrap">'
                +'CASH ON TOUR '+money(cot)+'</span>'):'')
      + '</div></div></div>';
  }).join('')||('<div style="background:'+ROW+';border-radius:20px;padding:16px;text-align:center;color:'+MUT+';margin-bottom:10px">No trip on this booking</div>');

  // ── ไทล์ 2×2 ──
  const room=(bk.roomNumber||'').trim();
  const zone=[bk.pickupArea||'', bk.pickupZone||''].filter(Boolean).join(' \u00b7 ');
  const dropDiff=(bk.dropoffSame===false);
  const dropTxt=dropDiff?(bk.dropoffHotelName||bk.dropoffArea||''):'';
  let retTxt='';
  try{ if(dsFirst && typeof ckRetVan==='function'){ const rv=ckRetVan(bk,dsFirst);
        if(rv && typeof ckRetVanTxt==='function') retTxt=ckRetVanTxt(rv); } }catch(_){}
  const ptime=((bk.ops&&bk.ops.pickupTimeFinal)||t0.pickupTime||bk.pickupTime||'').trim();

  const chip=(txt,bg,fg,bd)=>'<span style="display:inline-block;background:'+bg+';color:'+fg+';border:1px solid '+bd
    +';border-radius:999px;padding:1px 9px;font-size:10.5px;font-weight:700;margin:0 4px 4px 0">'+txt+'</span>';
  const sm=bk.specialMeals||{}, gd=bk.guides||{};
  const reqBits=[];
  const allerg=(typeof bookingV2AllergyText==='function')?bookingV2AllergyText(sm):((sm.allergies||'').trim());
  if(allerg) reqBits.push(chip('\u26a0 '+esc(allerg),'#FDECEC','#A32D2D','#F3C9C9'));
  if(sm.veg)   reqBits.push(chip('Vegetarian '+sm.veg,'#E7F5EE','#0F6E56','#BFE4D5'));
  if(sm.vegan) reqBits.push(chip('Vegan '+sm.vegan,'#E7F5EE','#0F6E56','#BFE4D5'));
  if(sm.halal) reqBits.push(chip('Halal '+sm.halal,'#E7F5EE','#0F6E56','#BFE4D5'));
  if((bk.notes||'').trim()) reqBits.push('<div style="font-size:12px;line-height:1.45;margin-top:2px">'+esc(bk.notes.trim())+'</div>');
  // §vcSvc · แหล่งเดียวกับใบงานเรือ · bundle ของทริปและ Rate Type ก็นับ ไม่ใช่แค่ addOns
  const svcBits=[];
  (function(){
    let _join=false, _chtr=0, _ptr=false;
    (bk.trips||[]).forEach(t=>{ if(typeof bookingV2AddOnFlags!=='function') return;
      const f=bookingV2AddOnFlags(bk, t.routeId);
      if(f.join) _join=true;
      if(f.charter) _chtr += (+f.charterQty||1);
      if(f.transfer) _ptr=true; });
    if(_join) svcBits.push(chip('Longtail Join','#E9F5FC','#0E5E80','#C9E6F5'));
    if(_chtr) svcBits.push(chip('Longtail Charter'+(_chtr>1?(' \u00d7'+_chtr):''),'#E9F5FC','#0E5E80','#C9E6F5'));
    if(_ptr)  svcBits.push(chip('Private Transfer','#E9F5FC','#0E5E80','#C9E6F5'));
    // add-on ชื่ออื่น ๆ · ข้ามหางยาวกับรถส่วนตัวเพราะนับไปแล้วข้างบน
    (bk.addOns||[]).forEach(a=>{
      if(typeof bookingV2IsB2CFeeAddOn==='function' && bookingV2IsB2CFeeAddOn(a)) return;   // §b2cFee
      const ty=String(a.type||'');
      if(/longtail|transfer/i.test(ty)) return;
      const lbl=String(a.label||ty).trim(); if(!lbl) return;
      svcBits.push(chip(esc(lbl)+((+a.qty>1)?(' \u00d7'+(+a.qty)):'')+(+a.amount>0?(' '+money(a.amount)):''),'#E9F5FC','#0E5E80','#C9E6F5'));
    });
  })();
  const langs=[]; if(gd.english)langs.push('EN'); if(gd.russian)langs.push('RU'); if(gd.chinese)langs.push('CN');
  if((gd.otherLang||'').trim()) langs.push(esc(gd.otherLang.trim()));

  /* §vcSkin · ของเดิมเป็นพื้นเทาไม่มีขอบ สี่ช่องติดกันจนดูเป็นก้อนเดียว
     เปลี่ยนเป็นพื้นขาวขอบ 1.5px หัวข้ออยู่ในแถบเทามีเส้นใต้ · แยกช่องออกจากกันชัด */
  const TILE=(h,body)=>'<div style="background:#fff;border:1.5px solid #D5DAE5;border-radius:14px;overflow:hidden">'
    + '<div style="background:#F4F6FA;border-bottom:1.5px solid #E2E7F0;padding:7px 13px;'
    + 'font-size:9px;font-weight:800;letter-spacing:.1em;color:'+NAVY+'">'+h+'</div>'
    + '<div style="padding:11px 13px">'+body+'</div></div>';
  const FV=(t,extra)=>'<div style="font-size:12px;line-height:1.45;margin-top:1px'+(extra||'')+'">'+t+'</div>';

  // ── §vcPay · เงิน · ปิดได้ทั้งระบบ ──
  let payHtml='';
  try{
    const _on=bookingV2PayShow();
    const _tg='<button onclick="event.stopPropagation();bookingV2PayToggle()" '
      + 'title="เปิด/ปิดแถบนี้ · เป็นค่าของทั้งระบบ ทุกใบเหมือนกันหมด" '
      + 'style="border:1px solid rgba(22,38,92,.18);background:#fff;color:'+MUT+';border-radius:999px;'
      + 'padding:3px 11px;font-size:10px;font-weight:800;cursor:pointer;font-family:inherit;letter-spacing:.04em">'
      + (_on?'ซ่อน':'แสดง')+'</button>';
    if(!_on){
      payHtml='<div style="background:'+ROW+';border-radius:18px;padding:9px 14px;margin-top:9px;'
        +'display:flex;align-items:center;gap:10px">'
        +'<span style="font-size:9px;font-weight:800;letter-spacing:.09em;color:'+MUT+'">PAYMENT</span>'
        +'<span style="font-size:11px;color:#B9BCC6">ซ่อนอยู่</span>'
        +'<span style="margin-left:auto">'+_tg+'</span></div>';
    } else {
      const _p=bookingV2PayOf(bk);
      const _C=_p.cot||{amt:0};
      const _S={ paid:{t:'จ่ายครบ',   c:'#0F6E56', bg:'#E1F5EE', bd:'#B7E2D2'},
                 partial:{t:'จ่ายบางส่วน', c:'#854F0B', bg:'#FAEEDA', bd:'#EBD9AE'},
                 due:{t:'ค้างชำระ',  c:'#A32D2D', bg:'#FCEBEB', bd:'#E6C9C3'},
                 noinv:(_C.amt>0
                   ? {t:'เก็บเงินหน้างาน', c:'#7A4A00', bg:'#FBF1E0', bd:'#EBD9AE'}
                   : {t:'ยังไม่ออกใบแจ้งหนี้', c:'#5F5E5A', bg:'#F1EFE8', bd:'#E1DED5'}) }[_p.state];
      /* §vcSkin · สามช่องเงินมีเส้นแบ่งกลาง อ่านเป็นตาราง ไม่ใช่ตัวเลขสามตัวลอย ๆ */
      const _cell=(lb,v,col,strong,first)=>'<div style="flex:1;min-width:0;padding:11px 13px;'
        +(first?'':'border-left:1.5px solid #E2E7F0')+'">'
        +'<div style="font-size:9px;font-weight:800;letter-spacing:.09em;color:'+MUT+'">'+lb+'</div>'
        +'<div style="font-family:\'DM Mono\',monospace;font-size:'+(strong?'20px':'17px')+';font-weight:800;'
        +'color:'+col+';margin-top:2px;letter-spacing:-.01em">'+money(v)+'</div></div>';
      payHtml='<div style="background:#fff;border:1.5px solid #D5DAE5;border-radius:14px;'
        +'overflow:hidden;margin-top:9px">'
        +'<div style="display:flex;align-items:center;gap:9px;background:#F4F6FA;'
          +'border-bottom:1.5px solid #E2E7F0;padding:7px 13px">'
          +'<span style="font-size:9px;font-weight:800;letter-spacing:.1em;color:'+NAVY+'">PAYMENT</span>'
          +'<span style="background:'+_S.bg+';color:'+_S.c+';border:1px solid '+_S.bd+';border-radius:999px;'
            +'padding:2px 10px;font-size:10px;font-weight:800">'+_S.t+'</span>'
          +'<span style="margin-left:auto">'+_tg+'</span></div>'
        /* §vcCot · ใบที่เก็บเงินหน้างานและยังไม่ออกบิล · สามช่องต้องตอบว่า
           ยอดทั้งหมดเท่าไร · เก็บหน้างานเท่าไร · เหลือวางบิล agent เท่าไร
           ไม่ใช่ TOTAL/PAID/BALANCE ที่อ่านแล้วเหมือน agent ค้างเราเต็มจำนวน */
        +((_C.amt>0 && !_p.inv)
          ? ('<div style="display:flex;align-items:stretch">'
              +_cell('TOTAL', _p.bkTot, NAVY, true, true)
              +_cell('COT · เก็บหน้างาน', _C.amt, '#7A4A00')
              +_cell('คงเหลือวางบิล', _p.billable, _p.billable>0?RED:'#0F6E56')
            +'</div>')
          : ('<div style="display:flex;align-items:stretch">'
              +_cell('TOTAL', _p.tot, NAVY, true, true)
              +_cell('PAID', _p.paid, _p.paid>0?'#0F6E56':'#B9BCC6')
              +_cell('BALANCE', _p.bal, _p.bal>0?RED:'#B9BCC6')
            +'</div>'))
        /* สามบรรทัดข้างบนคือของใบแจ้งหนี้ · อะไรที่ไม่ตรงกับ booking ต้องบอกไว้
           ไม่ใช่เกลี่ยให้ดูสวยแล้วปล่อยให้คนอ่านเข้าใจผิด */
        /* §vcCot · เงินหน้างานเป็นเรื่องของหน้างานกับบัญชี ไม่ใช่ของใบแจ้งหนี้
           ต้องบอกให้ครบว่าเป็นแผนหรือตัดสินแล้ว · ไม่งั้นคนอ่านนึกว่าหักไปแล้วจริง */
        +(function(){
            if(!(_C.amt>0)) return '';
            /* §vcSkin · บรรทัดเดิมขึ้นว่า "หักจากใบแจ้งหนี้ของ agent" · เป็นเรื่องบัญชีภายใน
               ไม่ควรติดไปกับใบที่ส่งให้คนอื่นดู · และจำนวนก็ซ้ำกับช่อง COT อยู่แล้ว
               เหลือไว้เฉพาะสถานะว่าตัดสินหรือยัง ซึ่งเป็นคนละเรื่องกัน */
            var wrap=(txt,col)=>'<div style="font-size:10.5px;padding:9px 13px;line-height:1.5;'
              +'border-top:1.5px dashed #E2E7F0;background:#FCFCFD;color:'+(col||MUT)+'">'+txt+'</div>';
            var head='';
            var over=(_C.over>0)
              ? ('<br><b style="color:'+RED+'">&#9888; เงินหน้างานที่หัก '+money(_C.use)
                 +' มากกว่ายอดทัวร์ '+money(_p.bkTot)+' อยู่ '+money(_C.over)
                 +'</b> &middot; ให้บัญชีตรวจว่ามีค่าอุทยาน/ของเพิ่มปนมา หรือกรอกผิด')
              : '';
            if(_C.settled){
              var by=_C.settled.by?(' &middot; '+esc(_C.settled.by)):'';
              var rf=_C.settled.ref?(' &middot; อ้างอิง '+esc(_C.settled.ref)):'';
              /* โหมดที่ตัดสินได้ · full/part = หักบางส่วนหรือทั้งหมด · none = ไม่หัก เงินเข้าบริษัท
                 · payout = จ่ายคืน agent · ถ้าเขียนว่า "หัก 0" เฉย ๆ คนอ่านนึกว่าลืมกรอก */
              var what;
              if(_C.deduct>0 && _C.payout>0) what='หัก '+money(_C.deduct)+' &middot; จ่ายคืน agent '+money(_C.payout);
              else if(_C.deduct>0)           what='หักจากใบแจ้งหนี้ '+money(_C.deduct);
              else if(_C.payout>0)           what='จ่ายคืน agent '+money(_C.payout);
              else                           what='ไม่หักจากใบแจ้งหนี้ &middot; เงินเก็บเข้าบริษัท';
              return wrap('&#10003; ตัดสินที่ Travel Summary แล้ว &middot; '+what+by+rf+over, '#0F6E56');
            }
            return wrap('&#9888; <b>ยังไม่ได้ตัดสินที่ Travel Summary</b> &middot; '
              +'ตัวเลขนี้เป็นไปตามที่ตั้งไว้ตอนเปิดใบ ยังไม่ใช่ยอดที่เก็บได้จริง'+over, '#8A5B00');
          })()
        +(function(){
            var _wr=(t,c)=>'<div style="font-size:10.5px;padding:9px 13px;line-height:1.5;'
              +'border-top:1.5px dashed #E2E7F0;background:#FCFCFD;color:'+(c||MUT)+'">'+t+'</div>';
            if(!_p.inv) return (_C.amt>0)?'':_wr('ยังไม่ได้ออกใบแจ้งหนี้ · ยอดคงค้างจึงเท่ากับยอดรวมของ booking');
            var L=['ใบแจ้งหนี้ '+esc(_p.inv.id||'')];
            if(_p.shared) L.push('<b>รวม '+_p.shared+' booking</b> ยอดข้างบนไม่ใช่ของใบนี้ใบเดียว');
            if(Math.round(_p.bkTot)!==Math.round(_p.tot))
              L.push('<b>ยอดของ booking ใบนี้ '+money(_p.bkTot)+'</b> ไม่เท่ากับที่ออกบิลไว้');
            /* §vcCot · ออกบิลไปแล้วโดยไม่ได้หักเงินที่เก็บหน้างาน = เก็บซ้ำสองรอบ */
            if(!_p.shared && _C.use>0 && Math.round(_p.tot)===Math.round(_p.bkTot))
              L.push('<b style="color:'+RED+'">ใบแจ้งหนี้ยังไม่ได้หักเงินหน้างาน '+money(_C.use)+'</b>');
            return _wr(L.join(' · '))
              +(_p.over>0
                ? _wr('&#9888; <b>รายการที่จ่ายเข้ามารวม '+money(_p.paid)+' เกินยอดบิล '+money(_p.over)+'</b> &middot; '
                   +'ให้บัญชีตรวจว่าจ่ายเกิน หรือมีรายการไปลงผิดใบ', RED)
                : '');
          })()
      +'</div>';
    }
  }catch(_){ payHtml=''; }

  // ── ยกเลิก / ไม่มา หน้างาน ──
  let lostHtml='';
  try{
    if(dsFirst && typeof ckLostByType==='function'){
      const L=ckLostByType(bk,dsFirst);
      if(L && L.total>0){
        const who=(typeof tsPaxWho==='function')?tsPaxWho(L):'';
        const kind=(L.cxl>0)?'Cancelled at the door':'No-show';
        lostHtml='<div style="background:#FDECEC;border:1px solid #F3C9C9;border-radius:18px;padding:11px 14px;margin-top:9px">'
          +'<div style="font-size:9px;font-weight:800;letter-spacing:.09em;color:#A32D2D;margin-bottom:4px">'+kind.toUpperCase()+'</div>'
          +'<div style="font-size:12.5px;font-weight:700;color:#A32D2D">'+L.total+' pax'+(who?(' \u00b7 '+esc(who)):'')
          +(L.unalloc>0?(' \u00b7 type not recorded '+L.unalloc):'')+'</div>'
          +'<div style="font-size:11px;color:#8a3a30;margin-top:2px">Charge decided in Travel Summary \u00b7 section 02</div></div>';
      }
    }
  }catch(_){}

  return '<div class="bkv2-vcdoc">'
  /* §vcSkin · หัวบริษัทมีเส้นคั่นหนา · แยกส่วนหัวออกจากเนื้อใบให้ชัด */
  + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px;'
    + 'padding-bottom:13px;border-bottom:2px solid '+NAVY+';margin-bottom:13px">'
    + '<img src="'+LA_LOGO_FULL+'" alt="LOVE andaman" style="height:24px;width:auto;display:block">'
    + '<div style="text-align:right;line-height:1.45">'
      + '<div style="font-size:11.5px;font-weight:800;color:'+NAVY+'">LOVE ISLAND CO.,LTD.</div>'
      + '<div style="font-size:8.8px;color:'+MUT+'">T.TALAD NUEA , A.MUENG , PHUKET 83000</div>'
      + '<div style="font-size:8.8px;color:'+MUT+'">MOBILE: + 66 (0)887654678</div></div></div>'

  /* §vcSkin · แถวเลขที่เป็นกล่องมีกรอบ · ของเดิมลอยอยู่เฉย ๆ ไม่รู้ว่าเป็นส่วนไหน */
  + '<div style="display:flex;align-items:center;gap:11px;margin-bottom:11px;'
    + 'border:1.5px solid #D5DAE5;border-radius:11px;padding:9px 13px;background:#FAFBFD">'
    + '<span style="font-family:\'DM Mono\',monospace;font-size:16px;font-weight:800;color:'+NAVY+'">'
      + esc(bk.voucherRef || ((typeof bookingV2DisplayCode==='function')?bookingV2DisplayCode(bk):bk.id) || '\u2014')+'</span>'
    + '<span style="background:'+stCol+';color:#fff;border-radius:999px;padding:4px 13px;font-size:11px;font-weight:700">'+esc(stLbl)+'</span>'
    + '<span style="margin-left:auto;font-size:10.5px;color:'+MUT+';text-align:right;line-height:1.4">'+esc(agTxt)
      + '<br>'+esc(bk.packageName||'One Day Tour')
      + (byTxt?('<br><span style="color:'+NAVY+';font-weight:700">Booked by '+esc(byTxt)+'</span>'):'')+'</span></div>'

  + tripCards

  + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:9px">'
    + TILE('PICK UP',
        /* §big · ชื่อโรงแรม */
        '<div style="font-size:15px;font-weight:600;line-height:1.35">'+(esc(bk.hotelName||bk.pickup||'')||Z)
          + (room?(' '+chip('Room '+esc(room),'#E9F5FC','#0E5E80','#C9E6F5')):'')+'</div>'
        + (zone?FV('<span style="color:'+MUT+'">'+esc(zone)+'</span>'):'')
        /* §big · เวลารับ */
        /* §vcSkin · เวลารับเป็นของที่คนขับต้องเจอก่อนอย่างอื่น · ทำเป็นแถบมีกรอบ */
        + (ptime?('<div style="color:'+RED+';font-weight:800;font-size:14px;margin-top:9px;'
            +'background:#FDECEC;border:1.5px solid #F6C9C6;border-radius:9px;'
            +'padding:6px 11px;display:inline-block">Pick up '+esc(ptime)+'</div>'):''))
    + TILE('DROP OFF',
        '<div style="font-size:15px;font-weight:600;line-height:1.35">'
          + (dropDiff?(esc(dropTxt)||Z):'<span style="color:#B9BCC6">Same as pick-up</span>')+'</div>'
        + (retTxt?FV('<span style="color:'+MUT+'">Return van \u00b7 '+esc(retTxt)+'</span>'):''))
    + TILE('SPECIAL REQUEST', reqBits.length?reqBits.join(''):FV(Z))
    + TILE('SERVICES', (svcBits.length?svcBits.join(''):FV(Z))
        + FV('Guide language '+(langs.length?langs.map(l=>chip(l,'#E9F5FC','#0E5E80','#C9E6F5')).join(''):Z)))
  + '</div>'
  + payHtml
  + lostHtml
  + '</div>';
}
