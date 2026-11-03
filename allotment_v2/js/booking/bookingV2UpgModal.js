function bookingV2UpgModal(){
  var U=_bkUpg; if(!U) return;
  var e=function(x){ return String(x==null?'':x).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  var q=function(x){ return e(String(x).replace(/\\/g,'\\\\').replace(/'/g,"\\'")); };
  var b=SB_BOOKINGS.find(function(x){ return x.id===U.bkId; }), t=bkUpgTripOn(b, U.date, U.from);
  var pax=(typeof bookingV2PaxAllTot==='function')?bookingV2PaxAllTot((t&&t.pax)||{}):0;
  var T=bookingV2UpgTargets(U.date, U.from, U.bkId);
  if(U.chargeOn==null) U.chargeOn=(parseFloat(U.charge)||0)>0;
  var old=document.getElementById('bkv2-upg-ov');
  var _sc=old?old.querySelector('[data-upg-left]'):null, _upgSc=_sc?_sc.scrollTop:0;   /* §upgStay */
  if(old) old.remove();
  var ov=document.createElement('div'); ov.id='bkv2-upg-ov'; ov.className='la-modal';
  ov.style.cssText='position:fixed;inset:0;z-index:9000;background:rgba(20,24,22,.42);display:flex;align-items:center;justify-content:center;padding:16px';
  /* §upgDrag · ลากเลือกข้อความในช่องเหตุผลจนเลยขอบแล้วปล่อยเมาส์บนพื้นหลัง = เบราว์เซอร์ส่ง click ให้พื้นหลัง → หน้าต่างปิด งานที่กรอกหาย
     ปิดด้วยพื้นหลังได้ก็ต่อเมื่อ "กดลง" บนพื้นหลังด้วย (ไม่ใช่แค่ปล่อย) */
  var _dn=null; ov.onmousedown=function(ev){ _dn=ev.target; };
  ov.onclick=function(ev){ if(ev.target===ov && _dn===ov) bookingV2UpgModalClose(); _dn=null; };
  var INK='#14233F', MUT='#5B6472', LINE='#E4E2DA';
  var K=U.kind||'', C=_UPG_C[K]||['#14233F','#EEF0F4','#14233F'];
  var fromPier=bkUpgPierOf(U.from), pnm=function(p){ return (typeof laPierName==='function')?laPierName(p):p; };
  var dep=function(rid){ return (typeof pckDepOf==='function')?pckDepOf(rid):''; };
  var step=function(n,ttl,sub,on){ return '<div style="display:flex;align-items:baseline;gap:8px;opacity:'+(on?'1':'.4')+'"><span style="width:20px;height:20px;border-radius:50%;background:'+INK+';color:#fff;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex:none">'+n+'</span><b style="font-size:14.5px;color:'+INK+'">'+e(ttl)+'</b>'+(sub?'<span style="font-size:12px;color:'+MUT+'">'+e(sub)+'</span>':'')+'</div>'; };
  /* ① ทริป */
  var piers=[]; T.forEach(function(x){ if(piers.indexOf(x.pier)<0) piers.push(x.pier); });
  piers.sort(function(a,c){ return (a===fromPier?0:1)-(c===fromPier?0:1); });
  var tile=function(x){ var no=(x.free!=null && x.free<pax), on=(U.to===x.rid), tm=dep(x.rid);
    if(no) return '<div data-upg-to="'+e(x.rid)+'" data-upg-no="1" title="'+e(x.name)+'" style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;background:#F4F3EF;color:#8A9099;font-size:12.5px">'
      +'<span style="font-family:\'DM Mono\',monospace;font-size:11px;flex:none">'+e(tm)+'</span><span style="flex:1;min-width:0;line-height:1.3">'+e(x.name)+'</span>'
      +'<span style="font-size:11.5px;font-weight:700;color:#B42318;flex:none">'+(x.free<=0?laT('เต็ม'):(laT('ว่าง')+' '+x.free+' · '+laT('ไม่พอ')))+'</span></div>';
    return '<button type="button" data-upg-to="'+e(x.rid)+'" onclick="bookingV2UpgPick(\'to\',\''+q(x.rid)+'\')" style="display:flex;align-items:center;gap:8px;padding:'+(on?'6px 9px':'7px 10px')+';border-radius:8px;border:'+(on?('2px solid '+C[0]):('1px solid '+LINE))+';background:'+(on?C[1]:'#fff')+';font-family:inherit;text-align:left;cursor:pointer;font-size:12.5px;color:'+INK+'">'
      +'<span style="font-family:\'DM Mono\',monospace;font-size:11px;color:'+MUT+';flex:none">'+e(tm)+'</span><span style="flex:1;min-width:0;line-height:1.3;font-weight:'+(on?700:500)+'">'+e(x.name)+'</span>'
      +'<span style="font-size:11.5px;font-weight:700;flex:none;color:'+(x.free==null?MUT:(x.free>=5?'#15803D':'#B45309'))+'">'+(x.free==null?'-':(laT('ว่าง')+' '+x.free))+'</span></button>'; };
  /* §upgFold (2026-11-04) · owner: "ของท่าไหน โชว์ท่านั้นก่อน ส่วนต่างท่ายุบไว้ก่อน ถ้าอยากเห็นค่อยกด · กลัว User เห็นเยอะ ๆ จะสับสน"
     ท่าอื่นยุบเป็นบรรทัดเดียว · กางให้เองเมื่อ (1) ท่าเดิมไม่มีทริปที่พอ (2) ทริปที่เลือกไว้อยู่ท่าอื่น (3) ท่าเดิมไม่มีทริปอื่นเลย */
  var _room=function(x){ return x.free==null || x.free>=pax; };
  var _sameT=T.filter(function(x){ return x.pier===fromPier; }), _sameOk=_sameT.some(_room);
  var _selOther=!!(U.to && T.some(function(x){ return x.rid===U.to && x.pier!==fromPier; }));
  var _auto=(!_sameOk || _selOther), _openO=!!(U.showOther || _auto);
  var _otherP=piers.filter(function(p){ return p!==fromPier; });
  var _otherN=T.filter(function(x){ return x.pier!==fromPier && _room(x); }).length;
  var _fold='';
  if(_otherP.length){
    var _pn=_otherP.map(function(p){ return pnm(p); }).join(' · ');
    if(!_openO) _fold='<button type="button" data-upg-fold="open" onclick="_bkUpg.showOther=true;bookingV2UpgModal()" style="grid-column:1 / -1;display:flex;align-items:center;gap:8px;border:1px dashed #E7C58F;background:#FFFBF3;border-radius:8px;padding:7px 10px;font-family:inherit;font-size:12.5px;color:#8A5B00;cursor:pointer;text-align:left">'
      +'<span aria-hidden="true">&#9656;</span><b>'+e(_pn)+'</b><span>· '+e(laT('ต่างท่า'))+' · '+_otherN+' '+e(laT('ทริปที่ว่าง'))+'</span><span style="margin-left:auto;font-size:11.5px;color:'+MUT+'">'+e(laT('กดเพื่อดู'))+'</span></button>';
    else if(!_auto) _fold='<button type="button" data-upg-fold="close" onclick="_bkUpg.showOther=false;bookingV2UpgModal()" style="grid-column:1 / -1;justify-self:start;border:0;background:transparent;font-family:inherit;font-size:12px;color:'+MUT+';cursor:pointer;padding:0 2px">&#9662; '+e(laT('ซ่อนท่าอื่น'))+'</button>';
  }
  var _sameNote=(!_sameOk && _otherP.length)?('<div data-upg-samefull="1" style="grid-column:1 / -1;font-size:12px;font-weight:700;color:#B45309">'+e(_sameT.length?laT('ท่าเดิมไม่มีทริปที่พอ · ดูท่าอื่นด้านล่าง'):laT('ท่าเดิมไม่มีทริปอื่น · ดูท่าอื่นด้านล่าง'))+'</div>'):'';
  var trips=T.length?('<div style="display:grid;grid-template-columns:64px minmax(0,1fr);gap:8px 10px;align-items:start">'
      +((!_sameT.length)?_sameNote:'')
      +piers.map(function(p){ var same=(p===fromPier);
        if(!same && !_openO) return '';
        return '<div data-upg-pier="'+e(p)+'" style="font-size:11.5px;font-weight:700;line-height:1.3;padding-top:7px;color:'+(same?'#0F766E':'#B45309')+'">'+e(pnm(p))+'<br><span data-upg-piertag="'+(same?'same':'other')+'" style="font-weight:500;color:'+MUT+'">'+e(same?laT('ท่าเดิม'):laT('ต่างท่า'))+'</span></div>'
          +'<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:6px">'+T.filter(function(x){ return x.pier===p; }).map(tile).join('')+'</div>'
          +(same?(_sameNote+_fold):''); }).join('')+'</div>')
    : '<div style="padding:12px;text-align:center;color:#A32D2D;font-size:12.5px">'+laT('วันนี้ไม่มีโปรแกรมอื่นที่มีเรือวิ่ง')+'</div>';
  /* ② ใครขอ */
  var who=function(k,big,sub,tag){ var on=(K===k), c=_UPG_C[k], dis=!U.to;
    return '<button type="button" data-upg-kind="'+k+'"'+(dis?' disabled':'')+' onclick="bookingV2UpgPick(\'kind\',\''+k+'\')" style="flex:1 1 200px;text-align:left;border:'+(on?('2px solid '+c[0]):('1px solid '+LINE))+';background:'+(on?c[1]:'#fff')+';border-radius:10px;padding:'+(on?'8px 11px':'9px 12px')+';font-family:inherit;display:flex;flex-direction:column;gap:2px;cursor:'+(dis?'not-allowed':'pointer')+';opacity:'+(dis?'.45':((K&&!on)?'.6':'1'))+'">'
      +'<span style="display:flex;align-items:center;gap:8px"><b style="font-size:13.5px;color:'+INK+'">'+e(big)+'</b><span style="margin-left:auto;font-size:11px;font-weight:700;color:'+c[0]+'">'+tag+'</span></span>'
      +'<span style="font-size:12px;color:'+MUT+'">'+e(sub)+'</span></button>'; };
  var whoH='<div style="display:flex;gap:8px;flex-wrap:wrap">'
    +who('promise', laT('ลูกค้าขอ / เราสัญญาไว้'), laT('ล็อกกับเรือลำที่สัญญา · ไม่ถูกย้ายอัตโนมัติ'), '<span style="color:#EAB308">&#9733;</span> '+e(laT('สัญญากับลูกค้า')))
    +who('fill', laT('เราย้ายเอง'), laT('ลูกค้าไม่ได้ขอ · ย้ายเรือ / ย้ายกลับได้ตามปกติ'), '&#10548; '+e(laT('เติมที่นั่ง')))+'</div>';
  var boatH='';
  if(K==='promise'){
    var B=(typeof baBoatsForRoute==='function')?baBoatsForRoute(U.date, U.to):[];
    boatH='<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span style="font-size:12px;color:'+MUT+'">'+e(laT('ลำที่สัญญา'))+' <span style="color:#B42318">*</span></span>'
      +(B.length?B.map(function(x){ var cap=(typeof boatCapFor==='function')?boatCapFor(x.boatId,U.date):(+x.boat.cap||0);
          var free=cap-((typeof baAssignedPax==='function')?baAssignedPax(U.date,x.boatId):0), full=(cap>0&&free<pax), on=(U.boat===x.boatId);
          return '<button type="button" data-upg-boat="'+e(x.boatId)+'"'+(full?' disabled':'')+' onclick="bookingV2UpgPick(\'boat\',\''+q(x.boatId)+'\')" style="border:'+(on?'2px solid #0F766E':('1px solid '+LINE))+';background:'+(on?'#E6F6F2':(full?'#F4F3EF':'#fff'))+';border-radius:8px;padding:'+(on?'4px 9px':'5px 10px')+';font-family:inherit;font-size:12.5px;font-weight:700;color:'+(full?'#8A9099':(on?'#0F766E':INK))+';cursor:'+(full?'not-allowed':'pointer')+'">'
            +e(x.boat.name||x.boatId)+' <span style="font-weight:500;color:'+(full?'#B42318':MUT)+'">· '+(cap?(laT('ว่าง')+' '+Math.max(0,free)+'/'+cap):'-')+'</span></button>'; }).join('')
        :'<span style="font-size:12px;color:#A32D2D">'+e(laT('โปรแกรมนี้ยังไม่มีเรือวิ่งวันนั้น · จัดเรือที่ Boat Operation ก่อน'))+'</span>')+'</div>';
  }
  /* ③ เหตุผล */
  var chipsL=(K==='promise')?[laT('ลูกค้าขอเปลี่ยน'),laT('ทริปเดิมไม่ออก'),laT('ลูกค้าจ่ายเพิ่ม')]:[laT('เรือเดิมเต็ม'),laT('รวมคนให้เต็มลำ'),laT('ทริปเดิมไม่ออก')];
  var rOn=!!K;
  var reasonH='<div style="display:flex;gap:6px;flex-wrap:wrap;opacity:'+(rOn?'1':'.4')+'">'+chipsL.map(function(c){ return '<button type="button"'+(rOn?'':' disabled')+' onclick="bookingV2UpgChip(\''+q(c)+'\')" style="border:1px solid '+LINE+';background:#fff;color:'+MUT+';border-radius:20px;padding:4px 10px;font-family:inherit;font-size:12px;cursor:pointer">'+e(c)+'</button>'; }).join('')+'</div>'
    +'<label style="display:flex;flex-direction:column;gap:4px;opacity:'+(rOn?'1':'.4')+'"><span style="font-size:11.5px;color:'+MUT+'">'+e(laT('พิมพ์เพิ่มได้ · กดปุ่มด้านบนเพื่อใส่คำให้เร็ว'))+'</span>'
    +'<input id="bkupg-reason" type="text"'+(rOn?'':' disabled')+' value="'+e(U.reason)+'" oninput="_bkUpg.reason=this.value" placeholder="'+e(laT('พิมพ์เหตุผล'))+'" style="border:1px solid #D0D5DD;border-radius:8px;padding:8px 10px;font-family:inherit;font-size:13px;color:'+INK+';box-sizing:border-box;width:100%"></label>';
  var left='<div data-upg-left="1" style="flex:1 1 520px;min-width:0;padding:16px 20px;display:flex;flex-direction:column;gap:10px;overflow:auto;overscroll-behavior:contain;max-height:92vh;box-sizing:border-box">'
    +'<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap"><b style="font-size:17px;color:'+INK+'">&#10548; Upgrade</b><span style="font-size:12px;color:'+MUT+'">'+e((b&&(b.leadPax||b.customerName))||U.bkId)+' · '+pax+' pax · '+e(U.date)+' · '+e(laT('ตอนนี้'))+' '+e(bkUpgRouteName(U.from))+'</span></div>'
    +step(1, laT('ไปทริปไหน'), pax+' pax · '+U.date, true)+trips
    +step(2, laT('ใครขอให้ย้าย'), '', !!U.to)+whoH+boatH
    +step(3, laT('เหตุผล'), '', rOn)+reasonH+'</div>';
  /* ขวา · ตั๋วใหม่ */
  var dst=T.filter(function(x){ return x.rid===U.to; })[0];
  var right, ready=!!(U.to && K && (K!=='promise' || U.boat));
  if(!dst){
    right='<div style="flex:1;border:2px dashed '+LINE+';border-radius:14px;display:flex;align-items:center;justify-content:center;text-align:center;padding:20px;color:'+MUT+';font-size:12.5px;line-height:1.6"><span><b style="display:block;font-size:14px;color:'+INK+';margin-bottom:4px">'+e(laT('ตั๋วใหม่จะขึ้นตรงนี้'))+'</b>'+e(laT('เลือกทริปก่อน'))+'</span></div>';
  } else {
    var diff=(dst.pier!==fromPier), lines=[];
    if(diff) lines.push(['!', laT('ต่างท่า')+' · '+laT('ไปขึ้นเรือที่')+' '+pnm(dst.pier)+' · '+laT('ตรวจรถรับ / เวลารับ'), '#B45309', 'diff']);
    if(K==='promise') lines.push(['&#9733;', U.boat?(laT('ล็อกกับ')+' '+bkUpgBoatNm(U.boat)+' · '+laT('จัดเรืออัตโนมัติ / สลับทั้งลำ จะข้ามใบนี้')):laT('เลือกลำที่สัญญา'), '#0F766E', 'pr']);
    else if(K==='fill') lines.push(['&#8856;', laT('เรือเดิมถูกล้าง · รอจัดเรือในโปรแกรมใหม่'), '#B42318', 'fill']);
    else lines.push(['?', laT('ตอบข้อ 2 ว่าใครขอให้ย้าย'), MUT, 'q']);
    var stamp=(K==='promise')?('<span style="color:#EAB308">&#9733;</span> '+e(laT('สัญญา'))+(U.boat?(' '+e(bkUpgBoatNm(U.boat))):'')):(K==='fill'?('&#10548; '+e(laT('เติมที่นั่ง'))):'');
    right='<div style="display:flex;flex-direction:column;gap:10px">'
      +'<span style="font-size:11.5px;color:#8A9099;text-decoration:line-through">'+e(laT('เดิม'))+' · '+e(bkUpgRouteName(U.from))+' · '+e(pnm(fromPier))+'</span>'
      +'<div data-upg-ticket="1" style="position:relative;background:#fff;border:1px solid '+LINE+';border-radius:14px;box-shadow:0 8px 22px -10px rgba(20,35,63,.3);overflow:hidden">'
        +'<div style="background:'+C[0]+';height:6px"></div>'
        +'<div style="padding:12px 14px 10px;display:flex;flex-direction:column;gap:3px">'
          +(stamp?'<span style="position:absolute;top:14px;right:12px;transform:rotate(5deg);border:2px solid '+C[0]+';color:'+C[0]+';border-radius:6px;padding:2px 8px;font-size:11px;font-weight:800;background:#fff;max-width:120px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+stamp+'</span>':'')
          +'<span style="font-size:11.5px;color:'+MUT+';padding-right:'+(stamp?'118px':'0')+';white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+e((b&&(b.leadPax||b.customerName))||'')+' · '+pax+' pax</span>'
          +'<b style="font-size:15.5px;color:'+INK+';line-height:1.3;padding-right:'+(stamp?'118px':'0')+'">'+e(dst.name)+'</b>'
          +'<span style="font-size:12.5px;color:'+INK+'">'+e(U.date)+(dep(dst.rid)?(' · '+e(dep(dst.rid))):'')+' · <b style="color:'+(diff?'#B45309':'#0F766E')+'">'+e(pnm(dst.pier))+'</b></span></div>'
        +'<div style="border-top:2px dashed '+LINE+';margin:0 12px"></div>'
        +'<div style="padding:10px 14px 12px;display:flex;flex-direction:column;gap:6px">'
          +lines.map(function(l){ return '<div data-upg-line="'+l[3]+'" style="display:flex;gap:8px;font-size:12.5px;line-height:1.45;color:'+l[2]+'"><span style="width:14px;flex:none;text-align:center;font-weight:800">'+l[0]+'</span><span>'+e(l[1])+'</span></div>'; }).join('')
          +'<div style="display:flex;gap:8px;font-size:12.5px;line-height:1.45;color:'+INK+'"><span style="width:14px;flex:none;text-align:center;font-weight:800">&#3647;</span><span id="bkupg-tkm"></span></div>'
        +'</div></div>'
      +'<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="font-size:12px;color:'+MUT+'">'+e(laT('ค่าอัพเกรด'))+'</span>'
        +'<div style="display:inline-flex;border:1px solid #CFD3DA;border-radius:8px;overflow:hidden">'
        +'<button type="button" data-upg-chg="0" onclick="bookingV2UpgPick(\'chg\',0)" style="border:0;padding:6px 11px;font-family:inherit;font-size:12px;cursor:pointer;'+(!U.chargeOn?('background:'+INK+';color:#fff;font-weight:700'):('background:#fff;color:'+MUT))+'">'+e(laT('ไม่เก็บ'))+'</button>'
        +'<button type="button" data-upg-chg="1" onclick="bookingV2UpgPick(\'chg\',1)" style="border:0;border-left:1px solid #CFD3DA;padding:6px 11px;font-family:inherit;font-size:12px;cursor:pointer;'+(U.chargeOn?('background:'+INK+';color:#fff;font-weight:700'):('background:#fff;color:'+MUT))+'">'+e(laT('เก็บเพิ่ม'))+'</button></div>'
        +(U.chargeOn?('<label style="display:flex;align-items:center;gap:4px;font-size:12.5px;color:'+MUT+'">&#3647; <input id="bkupg-charge" type="number" min="0" value="'+e(U.charge)+'" oninput="_bkUpg.charge=this.value;bookingV2UpgTicket()" placeholder="0" aria-label="'+e(laT('ยอดเก็บเพิ่ม'))+'" style="width:90px;border:1px solid #D0D5DD;border-radius:8px;padding:6px 8px;font-family:\'DM Mono\',monospace;font-size:13px;font-weight:700;box-sizing:border-box"></label>'):'')
      +'</div>'
      +'<div style="font-size:11.5px;color:'+MUT+'">'+e(laT('ทีมจะเห็นบนใบ'))+' <span style="background:'+C[1]+';color:'+C[2]+';border-radius:6px;padding:1px 8px;font-weight:700">&#10548; Upgrade'+(K==='promise'?' <span style="color:#EAB308">&#9733;</span>':'')+'</span></div>'
      +'</div>';
  }
  var btnT=!U.to?laT('เลือกทริปก่อน'):(!K?laT('เลือกว่าใครขอให้ย้าย'):((K==='promise'&&!U.boat)?laT('เลือกลำที่สัญญา'):(K==='promise'?(laT('ยืนยัน')+' · '+laT('สัญญาลำ')+' '+bkUpgBoatNm(U.boat)):(laT('ยืนยัน')+' · '+laT('เติมที่นั่ง')))));
  var rightW='<div style="flex:0 1 300px;min-width:260px;background:#FAFAF7;border-left:1px solid '+LINE+';padding:12px 16px 14px;display:flex;flex-direction:column;gap:10px;box-sizing:border-box">'
    +'<div style="display:flex;justify-content:flex-end;margin-bottom:-6px"><button type="button" aria-label="'+e(laT('ปิด'))+'" onclick="bookingV2UpgModalClose()" style="border:0;background:transparent;font-size:20px;color:'+MUT+';width:32px;height:32px;cursor:pointer">&times;</button></div>'
    +right+'<div style="flex:1"></div>'
    +'<button type="button" data-upg-go="1"'+(ready?'':' disabled')+' onclick="bookingV2UpgApply(true)" style="border:0;background:'+(ready?C[0]:'#D5D8DE')+';color:#fff;border-radius:10px;padding:12px;font-family:inherit;font-size:13.5px;font-weight:700;cursor:'+(ready?'pointer':'not-allowed')+'">'+e(btnT)+'</button>'
    +'<button type="button" onclick="bookingV2UpgModalClose()" style="border:0;background:transparent;color:'+MUT+';font-family:inherit;font-size:12.5px;padding:4px;cursor:pointer">'+e(laT('ยกเลิก'))+'</button></div>';
  ov.innerHTML='<div role="dialog" aria-modal="true" style="background:#fff;border-radius:16px;width:min(960px,96vw);max-height:94vh;display:flex;flex-wrap:wrap;overflow:auto;overscroll-behavior:contain;box-shadow:0 18px 50px rgba(0,0,0,.28);font-family:\'IBM Plex Sans Thai\',\'DM Sans\',sans-serif">'+left+rightW+'</div>';
  document.body.appendChild(ov);
  bookingV2UpgTicket();
  if(_upgSc){ var nl=ov.querySelector('[data-upg-left]'); if(nl) nl.scrollTop=_upgSc; }   /* §upgStay */
}
