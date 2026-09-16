// ── Cancellation report · stats off bk.cancelCategory / cancellation.group ──
function bookingV2RenderCancelReport(){
  const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const fmt=n=>'฿'+Math.round(n||0).toLocaleString();
  // §cityTourView · a booking that mixes trip types is shown on BOTH pages (marine page: any trip is marine · land page: any trip is land) — intentional simplification, not a bug. No trips at all → treated as marine (matches this booking's behavior before this filter existed).
  const _ctLandBk=b=>(typeof laIsLandRoute!=='function') ? true : ((b.trips&&b.trips.length) ? b.trips.some(t=>laIsLandRoute(t&&t.routeId)===_bkV2CityTourOnly) : !_bkV2CityTourOnly);
  const all=(SB_BOOKINGS||[]).filter(_ctLandBk);
  const cancelled=all.filter(b=>b.status==='cancelled'||b.status==='cancelled_weather');
  const partials=[]; all.forEach(b=>(b.partialCancels||[]).forEach(pc=>partials.push({b,pc})));  // partial-cancel events
  const denom=all.filter(b=>b.status!=='rejected' && b.status!=='draft').length || 1;  // confirmed+completed+cancelled
  const paxOf=b=>(b.trips||[]).reduce((s,t)=>s+((typeof bookingV2PaxAllTot==='function')?bookingV2PaxAllTot(t.pax||{}):0),0);
  const REASONS=(typeof BKV2_CANCEL_REASONS!=='undefined')?BKV2_CANCEL_REASONS:[];
  const catLabel=code=> (typeof bookingV2CancelLabel==='function')?bookingV2CancelLabel(code):((REASONS.find(x=>x.code===code)?.en)||code||'—');
  const catGroup=code=> code==='weather'?'operator':(REASONS.find(x=>x.code===code)?.group)||'other';
  const codeOf=b=> b.status==='cancelled_weather'?'weather':(b.cancelCategory||(b.cancellation&&b.cancellation.category)||'unspecified');
  const feeOf=b=> Number((b.cancellation&&b.cancellation.chargeAmount)||0);
  // aggregate
  const byCat={}, byGroup={customer:0,operator:0,other:0}, byMonth={}, byAgent={};
  let totPax=0, totFee=0, noShow=0;
  cancelled.forEach(b=>{
    const code=codeOf(b), pax=paxOf(b), fee=feeOf(b);
    totPax+=pax; totFee+=fee; if(code==='no_show') noShow++;
    (byCat[code]=byCat[code]||{count:0,pax:0,fee:0}); byCat[code].count++; byCat[code].pax+=pax; byCat[code].fee+=fee;
    byGroup[catGroup(code)]=(byGroup[catGroup(code)]||0)+1;
    const at=(b.cancellation&&b.cancellation.at)||b.cancelledAt||''; const m=at.slice(0,7)||'—'; byMonth[m]=(byMonth[m]||0)+1;
    const aid=b.agentId||'B2C'; byAgent[aid]=(byAgent[aid]||0)+1;
  });
  // fold in partial-cancel events (pax-level · booking stays active)
  let partialPax=0;
  partials.forEach(({b,pc})=>{
    const code=pc.category||'unspecified', px=pc.count||0;
    partialPax+=px; totPax+=px; if(code==='no_show') noShow++;
    (byCat[code]=byCat[code]||{count:0,pax:0,fee:0}); byCat[code].count++; byCat[code].pax+=px;
    byGroup[catGroup(code)]=(byGroup[catGroup(code)]||0)+1;
    const at=pc.at||''; const m=at.slice(0,7)||'—'; byMonth[m]=(byMonth[m]||0)+1;
    const aid=b.agentId||'B2C'; byAgent[aid]=(byAgent[aid]||0)+1;
  });
  const pct=(n,d)=>d>0?Math.round(n/d*1000)/10:0;
  const noShowRate=pct(noShow,denom), cancelRate=pct(cancelled.length,denom);
  if(!cancelled.length && !partials.length){
    return `<div class="bkv2" style="padding:40px;text-align:center;color:var(--ink-soft,#888)"><div style="font-size:14px;font-weight:600;margin-bottom:4px">No cancellations yet</div><div style="font-size:12px">Cancelled bookings will be analysed here by reason, fault side, agent and month.</div></div>`;
  }
  const card=(inner,extra)=>`<div style="background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:12px;padding:14px 16px;${extra||''}">${inner}</div>`;
  const kpi=(lab,val,sub,col)=>card(`<div style="font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#8a8a82">${lab}</div><div style="font-size:24px;font-weight:700;color:${col||'#1B2A55'};font-family:'DM Mono',monospace;margin-top:4px">${val}</div><div style="font-size:10.5px;color:#8a8a82;margin-top:1px">${sub||''}</div>`);
  const kpis=`<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px">
    ${kpi('Cancellations',cancelled.length,`${cancelRate}% of ${denom}${partials.length?` · +${partials.length} partial`:''}`,'#A32D2D')}
    ${kpi('Pax cancelled',totPax,partialPax?`${totPax-partialPax} full · ${partialPax} partial`:'seats released')}
    ${kpi('No-show rate',noShowRate+'%',`${noShow} no-show`,'#A05A1A')}
    ${kpi('Fees collected',fmt(totFee),'cancellation charges','#0F6E56')}
  </div>`;
  // by category bars
  const catRows=Object.entries(byCat).sort((a,b)=>b[1].count-a[1].count);
  const maxC=Math.max(...catRows.map(([,v])=>v.count),1);
  const grpColor=g=>g==='operator'?'#185FA5':g==='other'?'#8a8a82':'#A32D2D';
  const catHtml=card(`<div style="font-size:13px;font-weight:700;color:#1B2A55;margin-bottom:10px">By reason</div>`+catRows.map(([code,v])=>{
    const g=catGroup(code), w=Math.round(v.count/maxC*100);
    return `<div style="margin-bottom:9px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px"><span>${esc(catLabel(code))} <span style="font-size:9px;color:#fff;background:${grpColor(g)};padding:1px 6px;border-radius:8px;text-transform:uppercase;letter-spacing:.03em">${g}</span></span><span style="font-family:'DM Mono',monospace;color:#5A5A52">${v.count} &middot; ${v.pax} pax &middot; ${fmt(v.fee)}</span></div><div style="height:7px;border-radius:4px;background:#f0eee8"><div style="width:${w}%;height:100%;border-radius:4px;background:${grpColor(g)}"></div></div></div>`;
  }).join(''));
  // fault split
  const gTot=Object.values(byGroup).reduce((a,b)=>a+b,0)||1;
  const faultHtml=card(`<div style="font-size:13px;font-weight:700;color:#1B2A55;margin-bottom:10px">Fault side</div><div style="display:flex;height:14px;border-radius:7px;overflow:hidden;margin-bottom:8px">
    <div style="width:${pct(byGroup.customer,gTot)}%;background:#A32D2D"></div><div style="width:${pct(byGroup.operator,gTot)}%;background:#185FA5"></div><div style="width:${pct(byGroup.other,gTot)}%;background:#8a8a82"></div></div>
    <div style="display:flex;gap:14px;font-size:11.5px;color:#5A5A52"><span><span style="color:#A32D2D">&#9632;</span> Customer ${byGroup.customer} (${pct(byGroup.customer,gTot)}%)</span><span><span style="color:#185FA5">&#9632;</span> Operator ${byGroup.operator} (${pct(byGroup.operator,gTot)}%)</span><span><span style="color:#8a8a82">&#9632;</span> Other ${byGroup.other}</span></div>`);
  // top agents
  const agentRows=Object.entries(byAgent).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const agName=aid=> aid==='B2C'?'B2C / Walk-in':((typeof sbGetAgent==='function'&&sbGetAgent(aid))?sbGetAgent(aid).name:aid);
  const agentsHtml=card(`<div style="font-size:13px;font-weight:700;color:#1B2A55;margin-bottom:10px">Top cancelling agents</div>`+agentRows.map(([aid,n])=>`<div style="display:flex;justify-content:space-between;font-size:12px;padding:5px 0;border-bottom:0.5px solid rgba(0,0,0,.05)"><span>${esc(agName(aid))}</span><span style="font-family:'DM Mono',monospace;font-weight:700;color:#A32D2D">${n}</span></div>`).join(''));
  // by month
  const monthRows=Object.entries(byMonth).sort((a,b)=>a[0]<b[0]?-1:1);
  const maxM=Math.max(...monthRows.map(([,n])=>n),1);
  const monthHtml=card(`<div style="font-size:13px;font-weight:700;color:#1B2A55;margin-bottom:10px">By month</div>`+monthRows.map(([m,n])=>`<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span style="width:62px;font-size:11px;font-family:'DM Mono',monospace;color:#5A5A52">${esc(m)}</span><div style="flex:1;height:7px;border-radius:4px;background:#f0eee8"><div style="width:${Math.round(n/maxM*100)}%;height:100%;border-radius:4px;background:#185FA5"></div></div><span style="width:22px;text-align:right;font-size:11px;font-family:'DM Mono',monospace">${n}</span></div>`).join(''));
  return `<div class="bkv2" style="padding:18px">${kpis}<div style="display:grid;grid-template-columns:1.3fr 1fr;gap:12px;align-items:start;margin-bottom:12px">${catHtml}<div style="display:flex;flex-direction:column;gap:12px">${faultHtml}${agentsHtml}</div></div>${monthHtml}</div>`;
}
