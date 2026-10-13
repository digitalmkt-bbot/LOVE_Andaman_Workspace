function bookingV2SplitRender(){
  const m=_bkSplitM; if(!m) return;
  const old=document.getElementById('bk-split-modal'); if(old) old.remove();
  const b=SB_BOOKINGS.find(x=>x.id===m.bkId)||{};
  const mv={}; PAX_K.forEach(k=>mv[k]=+m[k]||0);
  const n=bkPaxSum(mv), tot=bkPaxSum(m.pool), keep=bkPaxSub(m.pool, mv);
  const strand = o => ((o.chd||0)+(o.inf||0))>0 && !(o.ad||0);
  const warn = n>0 ? (strand(mv) ? 'คันใหม่' : (strand(keep) ? 'คันเดิม' : '')) : '';
  const can = n>=1 && n<tot;
  const box = k => {
    const cap=+m.pool[k]||0, v=+m[k]||0;
    return '<div style="text-align:center">'
      +'<div style="font-size:10px;font-weight:800;letter-spacing:.06em;color:#8a7db0">'+PAX_LBL[k]+'</div>'
      +'<div style="font-size:9.5px;color:#b4b2a9;margin-bottom:4px">มี '+cap+'</div>'
      +'<input type="number" min="0" max="'+cap+'" value="'+v+'" '+(cap?'':'disabled ')
        +'oninput="bookingV2SplitSet(\''+k+'\',this.value)" '
        +'style="width:100%;box-sizing:border-box;min-width:0;text-align:center;font-size:17px;font-weight:800;font-family:inherit;'
        +'color:'+(v?'#5B289A':'#c4c1b8')+';border:1.5px solid '+(v?'#C7B8E8':'#e5e5e5')+';border-radius:9px;padding:8px 2px;'
        +'background:'+(v?'#F6F2FE':(cap?'#fff':'#faf9f7'))+'">'
      +(cap?'<button onclick="bookingV2SplitAll(\''+k+'\')" style="margin-top:3px;width:100%;border:none;background:transparent;font-size:9.5px;color:#8a7db0;cursor:pointer;font-family:inherit">ทั้งหมด</button>':'<div style="height:17px"></div>')
      +'</div>';
  };
  const side = (lbl,o,c) => '<div style="flex:1;background:'+c+'0D;border:1px solid '+c+'33;border-radius:10px;padding:9px 11px">'
    +'<div style="font-size:10px;font-weight:700;color:'+c+';letter-spacing:.04em">'+lbl+'</div>'
    +'<div style="font-size:20px;font-weight:800;color:#1B2A55;line-height:1.2;margin-top:1px">'+bkPaxSum(o)+' <span style="font-size:12px;font-weight:600;color:#8a8a82">คน</span></div>'
    +'<div style="font-size:10.5px;color:#6b7280;margin-top:2px">'+(PAX_K.filter(k=>o[k]).map(k=>o[k]+' '+PAX_LBL[k]).join(' · ')||'—')+'</div>'
    +'</div>';
  const ov=document.createElement('div'); ov.id='bk-split-modal';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:900;display:flex;align-items:center;justify-content:center;padding:20px';
  ov.onclick=ev=>{ if(ev.target===ov) bookingV2SplitClose(); };
  const esc=x=>String(x||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  ov.innerHTML='<div style="background:#fff;border-radius:16px;width:430px;max-width:100%;box-shadow:0 24px 70px rgba(0,0,0,.3);overflow:hidden;font-family:inherit">'
    +'<div style="padding:15px 18px;border-bottom:1px solid #eee;display:flex;align-items:center;justify-content:space-between;gap:10px">'
      +'<div style="min-width:0">'
        +'<div style="font-size:15px;font-weight:800;color:#1B2A55">&#9986; '+(m.again?'แยกคนเพิ่ม':'แยกคนไปอีกคัน')+'</div>'
        +'<div style="font-size:11.5px;color:#8a8a82;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'
          +esc(b.leadPax||b.id)+' · '+(m.again?'ส่วนแรกเหลือ ':'ทั้งหมด ')+tot+' คน</div>'
      +'</div>'
      +'<button onclick="bookingV2SplitClose()" style="background:transparent;border:none;font-size:20px;color:#999;cursor:pointer;line-height:1;flex:none">&times;</button>'
    +'</div>'
    +'<div style="padding:16px 18px">'
      +'<div style="font-size:11px;font-weight:700;color:#8a7db0;letter-spacing:.04em;margin-bottom:8px">ย้ายไปคันใหม่กี่คน · แยกตามประเภท</div>'
      +'<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px">'+PAX_K.map(box).join('')+'</div>'
      +'<div style="display:flex;gap:9px;margin-top:14px">'+side('คันเดิม', keep, '#0F6E56')+side('คันใหม่', mv, '#5B289A')+'</div>'
      +(warn?('<div style="margin-top:10px;padding:8px 10px;border-radius:8px;background:#FDF3E4;border:1px solid #F0D8A8;font-size:11px;color:#8a5500;line-height:1.5">&#9888; '+warn+'จะมีเด็ก/ทารก แต่ไม่มีผู้ใหญ่ไปด้วยเลย</div>'):'')
      +((!can&&n>0)?('<div style="margin-top:10px;padding:8px 10px;border-radius:8px;background:#FDECEA;border:1px solid #F5C9C4;font-size:11px;color:#A32D2D">แยกได้ 1 ถึง '+(tot-1)+' คน · ต้องเหลือคนไว้คันเดิมอย่างน้อย 1</div>'):'')
    +'</div>'
    +'<div style="padding:12px 18px;border-top:1px solid #eee;display:flex;gap:9px;justify-content:flex-end;background:#FAFBF9">'
      +'<button onclick="bookingV2SplitClose()" style="background:#fff;border:1px solid #ddd;border-radius:9px;padding:8px 16px;font-size:12.5px;font-weight:600;color:#555;cursor:pointer;font-family:inherit">ยกเลิก</button>'
      +'<button '+(can?'':'disabled ')+'onclick="bookingV2SplitApply()" style="background:'+(can?'#5B289A':'#d8d5cf')+';border:none;border-radius:9px;padding:8px 18px;font-size:12.5px;font-weight:700;color:#fff;cursor:'+(can?'pointer':'not-allowed')+';font-family:inherit">แยก '+n+' คน &rarr;</button>'
    +'</div>'
  +'</div>';
  document.body.appendChild(ov);
}
