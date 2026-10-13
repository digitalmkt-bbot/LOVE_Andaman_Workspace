function bookingV2WeatherPanel(routeId,date){
  bookingV2WeatherTagBookings(routeId,date);
  const rname=((typeof ROUTES!=='undefined'&&ROUTES.find(r=>r.id===routeId))||{}).name||routeId;
  const fmt=n=>'฿'+Math.round(n||0).toLocaleString();
  const nd=new Date(date+'T00:00'); nd.setDate(nd.getDate()+1); const next=(typeof bookingV2LocalYMD==='function')?bookingV2LocalYMD(nd):date;
  const list=bookingV2WeatherEventBookings(routeId,date);
  if(!list.length){ acctModal('<div style="padding:20px;font-size:13px">No bookings on this trip <div style="margin-top:14px;text-align:right"><button onclick="acctModalClose();bookingV2Render()" style="background:var(--fd-coral);color:#fff;border:none;font-family:inherit;font-size:12px;padding:8px 16px;border-radius:9px;cursor:pointer">Close</button></div></div>'); return; }
  const outLbl={reschedule:'Rescheduled',refund:'Refunded',credit:'Credit',cancel:'Cancelled'};
  const nAwait=list.filter(b=>b.weatherResolve.status==='awaiting').length;
  const nNotif=list.filter(b=>b.weatherResolve.status==='notified').length;
  const nDone=list.filter(b=>b.weatherResolve.status==='resolved').length;
  const rows=list.map(bk=>{
    const a=(typeof sbGetAgent==='function')?sbGetAgent(bk.agentId):null;
    const inv=(typeof acctBookingInvoice==='function')?acctBookingInvoice(bk.id):null;
    const paid=inv?acctInvoicePaid(inv):0;
    const pax=(bk.trips||[]).reduce((s,t)=>s+((typeof bookingV2PaxAllTot==='function')?bookingV2PaxAllTot(t.pax):0),0);
    const paidLbl= paid>0?`<span style="color:#0F6E56">Paid ${fmt(paid)}</span>`:`<span style="color:var(--fd-ink-soft)">Unpaid</span>`;
    const wr=bk.weatherResolve, st=wr.status;
    const stBadge= st==='awaiting'?'<span style="background:#F1EFE8;color:#5F5E5A;font-size:9px;font-weight:700;padding:2px 7px;border-radius:6px">To notify</span>'
      : st==='notified'?('<span style="background:#FBF0DD;color:#7A4A00;font-size:9px;font-weight:700;padding:2px 7px;border-radius:6px">Notified'+(wr.notifiedAt?' · '+wr.notifiedAt.slice(0,10):'')+' · awaiting</span>')
      : '<span style="background:#E1F5EE;color:#0F6E56;font-size:9px;font-weight:700;padding:2px 7px;border-radius:6px">Resolved</span>';
    let action='';
    if(st==='awaiting'){
      action='<button onclick="bookingV2WeatherNotify(\''+bk.id+'\')" style="background:#185FA5;color:#fff;border:none;font-family:inherit;font-size:11px;font-weight:600;padding:7px 13px;border-radius:8px;cursor:pointer;white-space:nowrap">Notify agent</button>';
    } else if(st==='notified'){
      action='<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end">'
        +'<select id="wx-out-'+bk.id+'" onchange="bookingV2WeatherToggleDate(\''+bk.id+'\')" style="height:30px;font-size:11px;font-family:inherit;border:1px solid var(--fd-line);border-radius:7px;padding:2px 6px;background:#fff"><option value="reschedule">Reschedule</option><option value="refund">Refund</option><option value="credit" '+(paid>0?'':'disabled')+'>Credit</option><option value="cancel">Cancel</option></select>'
        +'<input type="date" id="wx-date-'+bk.id+'" value="'+next+'" style="height:30px;font-size:11px;border:1px solid var(--fd-line);border-radius:7px;padding:2px 6px">'
        +'<button onclick="bookingV2WeatherResolveOne(\''+bk.id+'\')" style="background:#A32D2D;color:#fff;border:none;font-family:inherit;font-size:11px;font-weight:600;padding:7px 13px;border-radius:8px;cursor:pointer">Resolve</button></div>';
    } else {
      const extra=(wr.outcome==='reschedule'&&wr.newDate)?(' → '+wr.newDate):'';
      action='<span style="font-size:11.5px;color:#0F6E56;font-weight:600">✓ '+(outLbl[wr.outcome]||wr.outcome)+extra+'</span>';
    }
    return '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:0.5px solid var(--fd-line-soft)">'
      +'<div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:600;display:flex;align-items:center;gap:7px;flex-wrap:wrap">'+(bk.code||bk.id)+' · '+(a?a.name:'B2C')+' '+stBadge+'</div><div style="font-size:10.5px;color:var(--fd-ink-soft);margin-top:1px">'+pax+' pax · '+paidLbl+'</div></div>'
      +'<div style="flex-shrink:0">'+action+'</div></div>';
  }).join('');
  acctModal('<div style="padding:16px 20px;border-bottom:1px solid var(--fd-line);display:flex;align-items:center;justify-content:space-between"><div><div style="font-size:15px;font-weight:700;color:#A32D2D">Manage bookings · trip cancelled (weather)</div><div style="font-size:11px;color:var(--fd-ink-soft)">'+rname+' · '+date+' · Steps: notify agent → agent contacts customer → resolve</div></div><button onclick="acctModalClose()" style="background:transparent;border:none;font-size:20px;color:var(--fd-ink-soft);cursor:pointer">✕</button></div>'
    +'<div style="padding:10px 20px;background:#fafaf8;border-bottom:1px solid var(--fd-line-soft);font-size:11px;color:var(--fd-ink-soft)">To notify <b style="color:#5F5E5A">'+nAwait+'</b> · Notified <b style="color:#7A4A00">'+nNotif+'</b> · Resolved <b style="color:#0F6E56">'+nDone+'</b></div>'
    +'<div style="padding:6px 20px 16px">'+rows+'<div style="margin-top:14px;text-align:right"><button onclick="acctModalClose();bookingV2Render()" style="background:#fff;border:1px solid var(--fd-line);color:var(--fd-ink);font-family:inherit;font-size:12px;padding:9px 16px;border-radius:9px;cursor:pointer">Close</button></div></div>');
}
