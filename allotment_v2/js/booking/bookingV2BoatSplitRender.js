function bookingV2BoatSplitRender(){
  const m=_bkBoatM; if(!m) return;
  const old=document.getElementById('bk-boatsplit-modal'); if(old) old.remove();
  const esc=x=>String(x==null?'':x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const b=(typeof SB_BOOKINGS!=='undefined'?SB_BOOKINGS:[]).find(x=>x.id===m.bkId)||{};
  const pool=bkBoatSplitPool(b, m.date);
  const tot=bkPaxSum(m.pool);
  const used=m.parts.reduce((s,p)=>s+bkPaxSum(p),0);
  const leftN=tot-used;
  const dupIds=m.parts.map(p=>p.boatId).filter(Boolean);
  const dup=dupIds.filter((x,i)=>dupIds.indexOf(x)!==i).length>0;
  const noBoat=m.parts.some(p=>bkPaxSum(p)>0 && !p.boatId);
  let over=[];
  m.parts.forEach(p=>{ if(!p.boatId) return;
    const bo=(typeof BOATS!=='undefined'?BOATS:[]).find(x=>x.id===p.boatId)||{};
    const cap=(typeof boatCapFor==='function')?boatCapFor(p.boatId,m.date):(+bo.cap||0);
    const load=bkBoatLoadOther(b,m.date,p.boatId)+bkPaxSum(p);
    if(cap>0 && load>cap) over.push((bo.name||p.boatId)+' เกิน '+(load-cap));
  });
  const can = leftN===0 && used>0 && !dup && !noBoat;

  const partHtml=m.parts.map((p,i)=>{
    const n=bkPaxSum(p);
    const bo=p.boatId?((typeof BOATS!=='undefined'?BOATS:[]).find(x=>x.id===p.boatId)||{}):null;
    const cap=p.boatId?((typeof boatCapFor==='function')?boatCapFor(p.boatId,m.date):(+((bo||{}).cap)||0)):0;
    const other=p.boatId?bkBoatLoadOther(b,m.date,p.boatId):0;
    const load=other+n;
    const pct=cap>0?Math.min(100,load/cap*100):0;
    const c=p.boatId?((typeof bookingV2BoatAvatarColor==='function')?bookingV2BoatAvatarColor(p.boatId):'#5B289A'):'#b9b6ae';
    const bad=cap>0 && load>cap;
    const opts='<option value="">— เลือกลำ —</option>'+pool.map(x=>{
      const taken=m.parts.some((q,j)=>j!==i && q.boatId===x.id);
      const xc=(typeof boatCapFor==='function')?boatCapFor(x.id,m.date):(+x.cap||0);
      const xo=bkBoatLoadOther(b,m.date,x.id);
      return '<option value="'+esc(x.id)+'"'+(p.boatId===x.id?' selected':'')+(taken?' disabled':'')+'>'
        +esc(x.name||x.id)+' · จุ '+xc+(xo?(' · มีอยู่แล้ว '+xo):'')+(taken?' · เลือกไปแล้ว':'')+'</option>';
    }).join('');
    const box=k=>{
      const other2=m.parts.reduce((s,q,j)=>s+(j===i?0:(+q[k]||0)),0);
      const room=Math.max(0,(+m.pool[k]||0)-other2), v=+p[k]||0;
      return '<div style="text-align:center">'
        +'<div style="font-size:9.5px;font-weight:800;letter-spacing:.06em;color:#8a7db0">'+PAX_LBL[k]+'</div>'
        +'<input type="number" min="0" max="'+room+'" value="'+v+'"'+(room?'':' disabled')
          +' oninput="bookingV2BoatSplitSet('+i+',\''+k+'\',this.value)"'
          +' style="width:100%;box-sizing:border-box;min-width:0;text-align:center;font-size:15px;font-weight:800;font-family:inherit;'
          +'color:'+(v?'#5B289A':'#c4c1b8')+';border:1.5px solid '+(v?'#C7B8E8':'#e5e5e5')+';border-radius:8px;padding:6px 2px;'
          +'background:'+(v?'#F6F2FE':(room?'#fff':'#faf9f7'))+'"></div>';
    };
    return '<div style="border:1.5px solid '+(bad?'#F5C9C4':(p.boatId?'#C7B8E8':'#E4E1D9'))+';border-radius:12px;padding:10px 11px 9px;margin-bottom:8px;background:'+(bad?'#FEF7F6':(p.boatId?'#FBF9FE':'#FCFCFA'))+'">'
      +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">'
        +'<span style="width:21px;height:21px;border-radius:6px;background:'+c+';color:#fff;font-family:DM Mono,monospace;font-size:10.5px;font-weight:700;display:flex;align-items:center;justify-content:center;flex:none">'+(i+1)+'</span>'
        +'<select onchange="bookingV2BoatSplitSetBoat('+i+',this.value)" style="flex:1;min-width:0;font-family:inherit;font-size:12.5px;font-weight:700;color:'+(p.boatId?c:'#8a8a82')+';border:1.5px solid '+(p.boatId?'#D9CFF2':'#E4E1D9')+';background:#fff;border-radius:9px;padding:6px 9px">'+opts+'</select>'
        +(m.parts.length>1?('<button onclick="bookingV2BoatSplitDelPart('+i+')" title="ลบก้อนนี้" style="background:transparent;border:none;color:#A32D2D;font-size:15px;cursor:pointer;flex:none;padding:0 3px">&times;</button>'):'')
      +'</div>'
      +'<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr)) 1.1fr;gap:7px;align-items:end">'
        +PAX_K.map(box).join('')
        +'<div style="background:#fff;border:1.5px solid #E4E1D9;border-radius:8px;padding:4px 8px;text-align:right">'
          +'<div style="font-size:8.5px;color:#8a8a82;font-weight:700">ลำนี้</div>'
          +'<div style="font-size:16px;font-weight:800;color:#1B2A55;line-height:1.15;font-family:DM Mono,monospace">'+n+'</div></div>'
      +'</div>'
      +(p.boatId?('<div style="margin-top:7px;height:6px;border-radius:999px;background:#EFEDE6;overflow:hidden"><i style="display:block;height:100%;border-radius:999px;width:'+pct.toFixed(1)+'%;background:'+(bad?'#A32D2D':c)+'"></i></div>'
        +'<div style="font-size:10px;color:'+(bad?'#A32D2D':'#8a8a82')+';margin-top:4px;display:flex;justify-content:space-between">'
        +'<span>'+(bad?('เกินความจุ '+(load-cap)+' คน'):(cap>load?('ยังว่าง '+(cap-load)+' ที่'):'เต็มพอดี'))+(other?(' · มีบุคกิ้งอื่น '+other):'')+'</span>'
        +'<span style="font-family:DM Mono,monospace;font-weight:700">'+load+'/'+cap+'</span></div>'):'')
    +'</div>';
  }).join('');

  const tallyOk = leftN===0 && !dup && !noBoat;
  const tallyMsg = dup ? 'เลือกเรือซ้ำลำ' : (noBoat ? 'มีก้อนที่ยังไม่ได้เลือกเรือ'
      : (leftN>0 ? ('ยังไม่ได้จัด '+leftN+' คน') : (leftN<0 ? ('เกินมา '+(-leftN)+' คน') : 'ครบพอดี')));

  const ov=document.createElement('div'); ov.id='bk-boatsplit-modal';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:900;display:flex;align-items:center;justify-content:center;padding:20px';
  ov.onclick=ev=>{ if(ev.target===ov) bookingV2BoatSplitClose(); };
  ov.innerHTML='<div style="background:#fff;border-radius:16px;width:640px;max-width:100%;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 24px 70px rgba(0,0,0,.3);overflow:hidden;font-family:inherit">'
    +'<div style="padding:15px 18px;border-bottom:1px solid #eee;display:flex;align-items:center;justify-content:space-between;gap:10px;flex:none">'
      +'<div style="min-width:0"><div style="font-size:15px;font-weight:800;color:#1B2A55">&#128676; แยกคนลงเรือ</div>'
      +'<div style="font-size:11.5px;color:#8a8a82;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'
        +esc(b.leadPax||b.voucherRef||b.id)+' · ทั้งหมด <b>'+tot+' คน</b> · '+esc(m.date)+'</div></div>'
      +'<button onclick="bookingV2BoatSplitClose()" style="background:transparent;border:none;font-size:20px;color:#999;cursor:pointer;line-height:1;flex:none">&times;</button>'
    +'</div>'
    +'<div style="padding:14px 18px;overflow:auto;flex:1;min-height:0">'
      +(pool.length?'':'<div style="padding:10px 12px;border-radius:9px;background:#FFF6E5;border:1px dashed #EAD9B0;color:#633806;font-size:11.5px;margin-bottom:10px">ยังไม่มีเรือผูกกับเส้นทางนี้ในวันนั้น — ไปผูกเรือที่ Boat Operation ก่อน</div>')
      +'<div style="font-size:11px;font-weight:700;color:#8a7db0;letter-spacing:.04em;margin-bottom:8px">จัดคนลงลำ · รวมต้องได้ '+tot+' พอดี</div>'
      +partHtml
      +'<div style="display:flex;gap:8px">'
        +'<button onclick="bookingV2BoatSplitAddPart()" style="flex:1;border:1.5px dashed #D9CFF2;background:transparent;color:#5B289A;border-radius:11px;padding:9px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">+ เพิ่มอีกลำ</button>'
        +(leftN>0?'<button onclick="bookingV2BoatSplitAuto()" title="เกลี่ยคนที่เหลือลงลำที่เลือกไว้ ตามที่ว่างจริง" style="flex:none;border:1.5px solid #9FE1CB;background:#EFFAF5;color:#0F6E56;border-radius:11px;padding:9px 15px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">&#9889; เกลี่ยอัตโนมัติ</button>':'')
      +'</div>'
      +'<div style="display:flex;align-items:center;gap:11px;margin-top:12px;padding:10px 13px;border-radius:11px;background:'+(tallyOk?'#E9F7F0':'#FDECEA')+';border:1px solid '+(tallyOk?'#9FE1CB':'#F5C9C4')+'">'
        +'<span style="font-size:19px;font-weight:800;font-family:DM Mono,monospace;color:'+(tallyOk?'#0F6E56':'#A32D2D')+'">'+used+' / '+tot+'</span>'
        +'<span style="font-size:11.5px;font-weight:600;line-height:1.5;color:'+(tallyOk?'#0F6E56':'#A32D2D')+'">'+esc(tallyMsg)+'</span></div>'
      +(over.length?('<div style="margin-top:9px;padding:8px 11px;border-radius:9px;background:#FDF3E4;border:1px solid #F0D8A8;font-size:11px;color:#8a5500;line-height:1.55">&#9888; '+esc(over.join(' · '))+' — บันทึกได้ แต่ต้องแจ้งฝ่ายเรือ</div>'):'')
    +'</div>'
    +'<div style="padding:12px 18px;border-top:1px solid #eee;display:flex;gap:9px;justify-content:flex-end;background:#FAFBF9;flex:none">'
      +'<button onclick="bookingV2BoatSplitClose()" style="background:#fff;border:1px solid #ddd;border-radius:9px;padding:8px 16px;font-size:12.5px;font-weight:600;color:#555;cursor:pointer;font-family:inherit">ยกเลิก</button>'
      +'<button '+(can?'':'disabled ')+'onclick="bookingV2BoatSplitApply()" style="background:'+(can?'#5B289A':'#d8d5cf')+';border:none;border-radius:9px;padding:8px 18px;font-size:12.5px;font-weight:700;color:#fff;cursor:'+(can?'pointer':'not-allowed')+';font-family:inherit">บันทึก · '+m.parts.filter(p=>bkPaxSum(p)>0).length+' ลำ &rarr;</button>'
    +'</div>'
  +'</div>';
  document.body.appendChild(ov);
}
