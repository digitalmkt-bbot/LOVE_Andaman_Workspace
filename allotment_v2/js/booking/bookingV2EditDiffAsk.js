/* §nbDiffAsk · คืน true = ขึ้นป๊อปอัปแล้ว (รอคนกด) · false = ไม่มีอะไรให้ถาม ให้บันทึกต่อได้เลย */
function bookingV2EditDiffAsk(onYes){
  try{
    if(!_bkV2 || !_bkV2.editingId || !_bkV2.newBooking || typeof document==='undefined') return false;
    var sn=_bkV2.editSnap; if(!sn || sn.id!==_bkV2.editingId) return false;
    var d=_bkV2.newBooking, L=bookingV2EditDiff(sn.bk, d); if(!L.length) return false;
    var e=bookingV2EditDiffEsc, NAVY='#16265C';
    var old=document.getElementById('nbdiff-ask'); if(old){ try{ old.remove(); }catch(_){} }
    var ag=''; try{ var _a=d.agentId&&typeof sbGetAgent==='function'?sbGetAgent(d.agentId):null; ag=_a?(_a.name||''):''; }catch(_){}
    var totPax=0, trips=(d.trips||[]).filter(function(t){ return t&&t.routeId; }).map(function(t,i){
      var n=0; try{ n=(typeof bookingV2PaxAllTot==='function')?(+bookingV2PaxAllTot(t.pax||{})||0):0; }catch(_){} totPax+=n;
      var rn=t.routeId; try{ var r=(typeof ROUTES!=='undefined')?ROUTES.find(function(x){ return x.id===t.routeId; }):null; if(r) rn=r.name; }catch(_){}
      var z=t.zone||d.pickupZone||'';
      return '<div style="grid-column:1/-1;border-left:3px solid #2F7D32;padding-left:10px"><div style="font-size:12.5px;font-weight:700;color:#0F1B3D">'+(i+1)+'. '+e(rn)+'</div>'
        +'<div style="font-family:\'DM Mono\',monospace;font-size:11.5px;color:#5B6170">'+e(t.date?((typeof bkNbfDMY==='function')?bkNbfDMY(t.date):t.date):'—')+' · '+n+' pax'+(z?(' <span style="background:#ECEBE6;border-radius:3px;padding:0 5px;font-size:10px">'+e(z)+'</span>'):'')+'</div></div>';
    }).join('');
    var ff="'DM Sans','IBM Plex Sans Thai',sans-serif"; try{ var vb=document.querySelector('#view-booking .bkv2-review-inner')||document.getElementById('view-booking'); if(vb&&typeof getComputedStyle==='function') ff=getComputedStyle(vb).fontFamily||ff; }catch(_){}
    var cks=''; try{ cks=(typeof bkNbfChecksHtml==='function')?bkNbfChecksHtml():''; }catch(_){}
    var ov=document.createElement('div'); ov.className='la-modal'; ov.id='nbdiff-ask'; ov.style.zIndex='100050';
    ov.innerHTML='<div class="la-card" style="width:470px;max-width:94vw;padding:18px 20px;display:flex;flex-direction:column;max-height:92vh;border-radius:16px;font-family:'+ff.replace(/"/g,"'")+';color:#0F1B3D;text-align:left">'
      +'<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><div style="font-size:11px;font-weight:700;letter-spacing:.10em;text-transform:uppercase;color:#3E4658">Review changes</div>'
        +'<span style="background:#dbeafe;color:#1e40af;font-size:11.5px;font-weight:700;border-radius:12px;padding:2px 10px;display:inline-flex;align-items:center;gap:6px"><span style="width:6px;height:6px;border-radius:50%;background:#1e40af"></span>Editing</span>'
        +'<span style="margin-left:auto;font-family:\'DM Mono\',monospace;font-size:11px;color:#5B6170">'+e(_bkV2.editingId)+'</span></div>'
      +'<div style="font-size:19px;font-weight:700;color:#0F1B3D;margin-top:8px;letter-spacing:-.01em">ยืนยันการแก้ไข booking</div>'
      +'<div style="overflow:auto;min-height:0;flex:1 1 auto;margin:12px -6px 0;padding:0 6px">'
        +'<div style="padding:10px 12px;background:#F7F7F5;border:1px solid #ECEBE6;border-radius:10px;display:grid;grid-template-columns:1fr 1fr;gap:8px 14px">'
          +'<div style="min-width:0">'+bookingV2EditDiffLab('Agent')+'<div style="font-size:13px;font-weight:700;margin-top:2px;overflow-wrap:anywhere">'+e(ag||'—')+'</div>'+(d.voucherRef?('<div style="font-size:11px;color:#5B6170;overflow-wrap:anywhere">Voucher: '+e(d.voucherRef)+'</div>'):'')+'</div>'
          +'<div style="min-width:0">'+bookingV2EditDiffLab('Guest')+'<div style="font-size:13px;font-weight:700;margin-top:2px;overflow-wrap:anywhere">'+e(d.leadPax||'—')+'</div><div style="font-size:11px;color:#5B6170">'+totPax+' pax</div></div>'
          +trips+'</div>'
        +'<div style="margin-top:16px">'+bookingV2EditDiffHead(L.length)+'</div>'
        +bookingV2EditDiffRows(L,d)+bookingV2EditDiffMoney(L)
        +((cks.indexOf('>ready<')>=0)?('<div style="margin-top:14px;padding:10px 12px;border-radius:10px;background:#F7F7F5;border:1px solid #ECEBE6;display:flex;align-items:center;gap:9px"><span style="width:18px;height:18px;border-radius:50%;background:#3C9D6B;color:#fff;font-size:11px;display:inline-flex;align-items:center;justify-content:center;flex:none">&check;</span><span style="font-size:12.5px;color:#3E4658">Before you confirm · checks passed</span><span style="margin-left:auto;font-size:11.5px;font-weight:700;color:#0B5A43">ready</span></div>'):'')
      +'</div>'
      +'<button type="button" data-ask="yes" style="margin-top:12px;background:'+NAVY+';color:#fff;border:none;border-radius:12px;min-height:48px;font:700 15px inherit;cursor:pointer;width:100%">Confirm Update · '+L.length+' รายการ &check;</button>'
      +'<button type="button" data-ask="no" style="margin-top:6px;background:#fff;border:1px solid #CFCFC8;border-radius:10px;min-height:40px;font:600 13px inherit;color:#0F1B3D;cursor:pointer;width:100%">&larr; กลับไปแก้</button>'
      +'</div>';
    document.body.appendChild(ov);
    var close=function(){ try{ ov.remove(); }catch(_){} };
    ov.querySelector('[data-ask="no"]').onclick=close;
    ov.onclick=function(ev){ if(ev.target===ov) close(); };
    ov.querySelector('[data-ask="yes"]').onclick=function(){ close(); try{ if(typeof onYes==='function') onYes(); }catch(err){ console.warn('nbDiffAsk', err); alert('บันทึกไม่สำเร็จ: '+(err&&err.message||err)); } };
    return true;
  }catch(err){ console.warn('nbDiffAsk', err); return false; }
}
