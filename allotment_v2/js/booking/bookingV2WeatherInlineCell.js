// Inline manifest cell (By-trip-date) — shown only when trip is weather-closed · mirrors the modal's per-booking workflow
function bookingV2WeatherInlineCell(bkId){
  const bk=(SB_BOOKINGS||[]).find(x=>x.id===bkId); const wr=bk&&bk.weatherResolve;
  if(!wr) return '<span class="t2-dim">&mdash;</span>';
  const st=wr.status;
  if(st==='resolved'){
    const oL={reschedule:'Rescheduled',refund:'Refunded',credit:'Credit',cancel:'Cancelled'};
    const ex=(wr.outcome==='reschedule'&&wr.newDate)?(' &rarr; '+String(wr.newDate).slice(5)):'';
    return '<span style="font-size:10px;color:#0F6E56;font-weight:700;white-space:nowrap">&#10003; '+(oL[wr.outcome]||wr.outcome)+ex+'</span>';
  }
  if(st==='notified'){
    const inv=(typeof acctBookingInvoice==='function')?acctBookingInvoice(bkId):null;
    const paid=inv?acctInvoicePaid(inv):0;
    const d0=String(wr.event||'').split('|')[1]||''; let next=d0;
    try{ const nd=new Date(d0+'T00:00'); nd.setDate(nd.getDate()+1); next=(typeof bookingV2LocalYMD==='function')?bookingV2LocalYMD(nd):d0; }catch(e){}
    return '<div style="display:flex;flex-direction:column;gap:3px;min-width:128px">'
      +'<span style="font-size:8px;font-weight:700;color:#7A4A00;letter-spacing:.02em">Notified · awaiting</span>'
      +'<div style="display:flex;gap:3px;align-items:center">'
      +'<select id="wxr-out-'+bkId+'" onchange="bookingV2WeatherToggleDate(\''+bkId+'\',\'wxr-\')" style="height:24px;font-size:9.5px;font-family:inherit;border:1px solid var(--border);border-radius:5px;padding:1px 3px;background:#fff;flex:1;min-width:0"><option value="reschedule">Reschedule</option><option value="refund">Refund</option><option value="credit" '+(paid>0?'':'disabled')+'>Credit</option><option value="cancel">Cancel</option></select>'
      +'<button onclick="bookingV2WeatherResolveOne(\''+bkId+'\',\'wxr-\')" style="height:24px;background:#A32D2D;color:#fff;border:none;font-family:inherit;font-size:9.5px;font-weight:700;padding:0 8px;border-radius:5px;cursor:pointer;white-space:nowrap">Apply</button></div>'
      +'<input type="date" id="wxr-date-'+bkId+'" value="'+next+'" style="height:22px;font-size:9px;border:1px solid var(--border);border-radius:5px;padding:1px 4px">'
      +'</div>';
  }
  // awaiting
  return '<button onclick="bookingV2WeatherNotify(\''+bkId+'\',\'wxr-\')" style="background:#185FA5;color:#fff;border:none;font-family:inherit;font-size:10px;font-weight:700;padding:5px 9px;border-radius:6px;cursor:pointer;white-space:nowrap">Notify agent</button>';
}
