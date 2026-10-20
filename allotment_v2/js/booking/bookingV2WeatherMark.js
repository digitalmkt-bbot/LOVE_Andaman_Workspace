function bookingV2WeatherMark(routeId,date){
  if(!tcxCan()){ alert('You do not have permission to cancel a trip.\nAsk an admin to tick "Cancel trip" for you in Users.'); return; }
  const rname=((typeof ROUTES!=='undefined'&&ROUTES.find(r=>r.id===routeId))||{}).name||routeId;
  const closed=bookingV2IsWeatherClosed(routeId,date);
  const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  window._tcxPick = closed ? tcxReason(routeId,date) : 'weather';
  const S = (closed && tcxSnapOf(routeId,date)) || tcxSnapNow(routeId,date);
  const ag = Object.keys(S.byAg||{}).map(k=>esc(k)+' '+S.byAg[k]).join(' · ') || '—';
  const gap = S.be>0 ? Math.max(0,S.be-S.pax) : 0;
  const chips = Object.keys(TCX_R).map(k=>{ const R=TCX_R[k];
    return '<button type="button" class="tcx-rc'+(k===window._tcxPick?' on':'')+'" data-k="'+k+'" onclick="tcxPickR(\''+k+'\')"><b>'+R.ic+' '+R.th+'</b><small>'+R.sub+'</small></button>'; }).join('');
  const cell=(k,v,d,c)=>'<div><div style="font-size:10.5px;font-weight:700;color:#6B7489">'+k+'</div><div style="font-family:\'DM Mono\',monospace;font-size:20px;font-weight:700;'+(c?('color:'+c):'')+'">'+v+'</div><div style="font-size:11px;color:#8A8F9C;line-height:1.4">'+d+'</div></div>';
  acctModal(`
    <style>.tcx-rc{flex:1;text-align:left;border:1.5px solid #D5DAE5;border-radius:11px;padding:8px 10px;background:#fff;cursor:pointer;font-family:inherit;color:#0F1B3D}
      .tcx-rc b{display:block;font-size:13px}.tcx-rc small{display:block;color:#6B7489;font-size:10.5px;margin-top:2px}.tcx-rc.on{border-color:#4F3EA3;background:#F4F1FD}</style>
    <div style="padding:16px 20px;border-bottom:1px solid var(--fd-line);display:flex;align-items:center;justify-content:space-between"><div><div style="font-size:11px;font-weight:800;letter-spacing:.08em;color:#A32D2D">${closed?'TRIP CANCELLED':'CANCEL TRIP'}</div><div style="font-size:15px;font-weight:700;color:#0F1B3D">${esc(rname)} · ${esc(date)}</div></div><button onclick="acctModalClose()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--fd-ink-soft)">&times;</button></div>
    <div style="padding:14px 20px">
      <div style="font-size:11px;font-weight:700;color:var(--fd-ink-soft);margin-bottom:6px">Reason</div>
      <div style="display:flex;gap:8px;margin-bottom:12px">${chips}</div>
      <label style="font-size:11px;color:var(--fd-ink-soft);display:block;margin-bottom:5px">Note</label>
      <textarea id="wx-note" placeholder="e.g. 8 pax only · merged into Speedboat 08:30 · high waves 3m" style="width:100%;min-height:58px;font-size:12px;font-family:inherit;border:1px solid var(--fd-line);border-radius:8px;padding:8px;box-sizing:border-box">${closed?esc(bookingV2WeatherNote(routeId,date)):''}</textarea>
      <div style="font-size:11px;font-weight:700;color:var(--fd-ink-soft);margin:12px 0 6px">${closed?'Snapshot when it was cancelled':'Snapshot (saved when you confirm)'}</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;border:1px solid #E6E8EE;border-radius:12px;background:#FAFBFD;padding:10px 12px">
        ${cell('Pax on trip', S.pax, S.bk+' booking'+(S.bk===1?'':'s')+' · AD '+S.ad+' · CHD '+S.chd)}
        ${cell('Break-even', S.be>0?S.be:'—', S.be>0?(gap>0?('short '+gap):'reached'):'no plan in Trip P&L', S.be>0&&gap>0?'#A32D2D':'')}
        <div><div style="font-size:10.5px;font-weight:700;color:#6B7489">Agents</div><div style="font-size:12px;line-height:1.55;margin-top:3px">${ag}</div></div>
        <div><div style="font-size:10.5px;font-weight:700;color:#6B7489">${closed?'Cancelled by':'By'}</div><div style="font-size:12px;line-height:1.55;margin-top:3px"><b>${esc(S.by||laBy())}</b><br>${esc(String(S.at||new Date().toISOString()).slice(0,16).replace('T',' '))}${S.before!=null?(' · '+S.before+' day'+(S.before===1?'':'s')+' before'):''}</div></div>
      </div>
      <div style="margin-top:12px;padding:10px 12px;border-radius:12px;background:#F4F1FD;border:1px solid #CFC6F2;display:flex;align-items:center;gap:12px">
        <div style="font-size:12px;line-height:1.5"><b style="color:#4F3EA3">Bookings · resolve on By trip</b><br>Every booking on this trip gets the cancel banner in By trip ${esc(date)} · pick the result row by row there (move program · reschedule · refund · credit · cancel).</div>
        ${closed?`<button onclick="acctModalClose();tcxGoByTrip('${routeId}','${date}')" style="margin-left:auto;background:#fff;border:1px solid #4F3EA3;color:#4F3EA3;font-family:inherit;font-size:12px;font-weight:700;padding:8px 13px;border-radius:9px;cursor:pointer;white-space:nowrap">Open By trip ›</button>`:''}
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:14px">
        <div>${closed?`<button onclick="bookingV2WeatherUncancel('${routeId}','${date}')" style="background:#fff;border:1px solid #0F7A5A;color:#0F7A5A;font-family:inherit;font-size:12px;font-weight:600;padding:9px 15px;border-radius:9px;cursor:pointer">&#8630; Undo cancellation</button>`:''}</div>
        <div style="display:flex;gap:8px">
          <button onclick="acctModalClose()" style="background:#fff;border:1px solid var(--fd-line);color:var(--fd-ink);font-family:inherit;font-size:12px;padding:9px 15px;border-radius:9px;cursor:pointer">Back</button>
          <button onclick="bookingV2WeatherMarkConfirm('${routeId}','${date}')" style="background:#A32D2D;color:#fff;border:none;font-family:inherit;font-size:12px;font-weight:600;padding:9px 18px;border-radius:9px;cursor:pointer">${closed?'Update':'Confirm cancel trip'}</button>
        </div>
      </div>
    </div>`);
}
