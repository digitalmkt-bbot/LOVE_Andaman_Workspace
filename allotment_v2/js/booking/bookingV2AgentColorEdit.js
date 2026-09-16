// Edit an agent's colour from the By-trip-date Agency cell · popover with recently-used colours · Alt-click = reset to auto
function bookingV2AgentColorEdit(agentId, ev){
  const a=(typeof sbGetAgent==='function')?sbGetAgent(agentId):null; if(!a) return;
  if(ev && ev.altKey){ a.color=null; if(typeof sbAgentsPersist==='function') sbAgentsPersist(); if(typeof bookingV2Render==='function') bookingV2Render(); return; }
  const old=document.getElementById('bkv2-agcol-pop'); if(old) old.remove();
  const used=[...new Set(((typeof SB_AGENTS!=='undefined'?SB_AGENTS:[])||[]).map(x=>x.color).filter(Boolean))];
  const cur=String(a.color||'').toLowerCase();
  const sw=(c)=>`<button onclick="bookingV2AgentColorSet('${agentId}','${c}')" title="${c}" style="width:24px;height:24px;border-radius:6px;background:${c};border:2px solid ${cur===String(c).toLowerCase()?'#1a1a1a':'#fff'};box-shadow:0 0 0 1px #d8d8d2;cursor:pointer;padding:0"></button>`;
  const lab='font-size:10px;font-weight:700;color:#8a8a82;text-transform:uppercase;letter-spacing:.04em;margin:0 0 6px';
  const grid='display:flex;flex-wrap:wrap;gap:6px;margin-bottom:11px';
  const pop=document.createElement('div'); pop.id='bkv2-agcol-pop';
  const r=(ev&&ev.currentTarget&&ev.currentTarget.getBoundingClientRect)?ev.currentTarget.getBoundingClientRect():{left:80,bottom:140};
  pop.style.cssText=`position:fixed;z-index:10010;left:${Math.max(8,Math.min(r.left,(window.innerWidth||1200)-252))}px;top:${(r.bottom||120)+4}px;background:#fff;border:1px solid #e3e5e9;border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,.18);padding:12px 14px;width:236px;font-family:inherit;max-height:82vh;overflow-y:auto`;
  pop.innerHTML=`<div style="font-size:12px;font-weight:700;color:#1a1a1a;margin-bottom:9px">สี · ${String(a.name||'').slice(0,22)}</div>`
    +(used.length?`<div style="${lab}">สีที่เคยใช้</div><div style="${grid}">${used.map(sw).join('')}</div>`:'')
    +`<div style="${lab}">สีมาตรฐาน</div><div style="${grid}">${BKV2_AGENT_PALETTE.map(sw).join('')}</div>`
    +`<div style="display:flex;align-items:center;gap:8px;border-top:1px solid #eee;padding-top:9px"><label style="display:inline-flex;align-items:center;gap:6px;font-size:11px;color:#5A5A52;cursor:pointer">กำหนดเอง <input type="color" value="${bookingV2AgentColor(agentId)}" onchange="bookingV2AgentColorSet('${agentId}',this.value)" style="width:30px;height:24px;border:1px solid #ddd;border-radius:5px;padding:1px;cursor:pointer"></label><button onclick="bookingV2AgentColorSet('${agentId}','')" style="margin-left:auto;font-size:11px;border:1px solid #ddd;background:#fff;border-radius:7px;padding:4px 9px;cursor:pointer;font-family:inherit">สีอัตโนมัติ</button></div>`;
  document.body.appendChild(pop);
  { const vh=window.innerHeight||800, h=pop.offsetHeight, gap=8; let top=(r.bottom||120)+4; if(top+h+gap>vh){ const up=(r.top||120)-h-4; top = up>=gap ? up : Math.max(gap, vh-h-gap); } pop.style.top=top+'px'; }
  setTimeout(()=>{ const close=(e)=>{ if(!pop.contains(e.target)){ pop.remove(); document.removeEventListener('mousedown',close); } }; document.addEventListener('mousedown',close); },0);
}
