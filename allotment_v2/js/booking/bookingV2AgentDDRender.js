function bookingV2AgentDDRender(filterText){
  const dd = document.getElementById('bkv2-agent-dd');
  if(!dd) return;
  const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const opts = bookingV2GetAgentDDOptions().slice().sort((a,b) => String(a.code).localeCompare(String(b.code)) || String(a.name).localeCompare(String(b.name)));
  const byId = {}; opts.forEach(o => { byId[o.id] = o; });
  let st = { recent:[], recentAt:{}, top:[], cnt:{} };
  try{ st = bookingV2AgentDDStats(); }catch(_){ }
  const q = String(filterText||'').trim().toLowerCase();
  let n = 0;   /* running index over selectable rows · keyboard nav counts .bkv2-nb-dd-item in this same order */
  const row = (o, meta, metaCol) => { const i = n++; return `<div class="bkv2-nb-dd-item${i === _bkV2AgentDDActive ? ' active' : ''}" data-label="${esc(o.label)}" onmousedown="event.preventDefault();bookingV2AgentDDPick(this.dataset.label)" style="display:flex;align-items:center;gap:10px;min-height:38px;padding:0 14px;border-radius:0;border-top:1px solid #F1F0EC">
        <span style="flex:none;width:92px;font-family:'DM Mono',monospace;font-size:11.5px;color:#5B6170;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(o.code)}</span>
        <span style="flex:1;min-width:0;font-size:13.5px;font-weight:600;color:#0F1B3D;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(o.name)}</span>
        ${o.market?`<span style="flex:none;padding:1px 7px;border-radius:5px;background:#F1F0EC;color:#3E4658;font-size:11px;font-weight:600;white-space:nowrap">${esc(o.market)}</span>`:''}
        <span style="flex:none;width:132px;text-align:right;font-size:12px;color:${metaCol||'#5B6170'};white-space:nowrap">${meta||''}</span>
      </div>`; };
  const head = (t, h, c) => `<div style="display:flex;align-items:baseline;gap:8px;padding:9px 14px 5px;background:#F7F7F5;border-top:1px solid #ECEBE6;pointer-events:none;user-select:none"><span style="font-size:10px;font-weight:700;letter-spacing:.10em;text-transform:uppercase;color:#3E4658">${t}</span><span style="font-size:12px;color:#5B6170">${h}</span><span style="margin-left:auto;font-family:'DM Mono',monospace;font-size:11.5px;color:#5B6170">${c}</span></div>`;
  const foot = t => `<div style="padding:8px 14px;background:#F7F7F5;border-top:1px solid #ECEBE6;font-size:12px;color:#5B6170;pointer-events:none">${t}</div>`;
  let html = '';
  if(q){
    const filtered = opts.filter(o => o.label.toLowerCase().includes(q) || o.code.toLowerCase().includes(q) || o.name.toLowerCase().includes(q) || o.market.toLowerCase().includes(q));
    if(filtered.length === 0){ dd.innerHTML = '<div class="bkv2-nb-dd-empty">no agent matches</div>'; return; }
    const rk = id => { const i = st.recent.indexOf(id); return i < 0 ? 999 : i; };
    filtered.sort((a,b) => (rk(a.id) - rk(b.id)) || String(a.code).localeCompare(String(b.code)));
    const shown = filtered.slice(0, 50);
    _bkV2AgentDDActive = Math.min(_bkV2AgentDDActive, shown.length - 1); if(_bkV2AgentDDActive < 0) _bkV2AgentDDActive = -1;
    html = head('Matches', 'your recent ones first, then the rest A to Z', filtered.length)
      + shown.map(o => st.recent.indexOf(o.id) >= 0 ? row(o, 'you booked ' + bookingV2AgentDDWhen(st.recentAt[o.id]), '#0B5A43') : (st.top.indexOf(o.id) >= 0 ? row(o, 'top &middot; ' + st.cnt[o.id] + ' bookings') : row(o, ''))).join('')
      + (filtered.length > 50 ? foot('+ ' + (filtered.length - 50) + ' more &middot; keep typing to narrow') : '');
  } else {
    const rec = st.recent.map(id => byId[id]).filter(Boolean);
    const top = st.top.map(id => byId[id]).filter(Boolean);
    const total = rec.length + top.length + Math.min(opts.length, 50);
    _bkV2AgentDDActive = Math.min(_bkV2AgentDDActive, total - 1); if(_bkV2AgentDDActive < 0) _bkV2AgentDDActive = -1;
    if(rec.length) html += head('Recent', 'agents you booked last, newest first', rec.length) + rec.map(o => row(o, bookingV2AgentDDWhen(st.recentAt[o.id]))).join('');
    if(top.length) html += head('Top', 'most bookings by the whole team, last 30 days', top.length) + top.map(o => row(o, st.cnt[o.id] + ' booking' + (st.cnt[o.id] === 1 ? '' : 's'))).join('');
    if(opts.length === 0){ dd.innerHTML = '<div class="bkv2-nb-dd-empty">no agent matches</div>'; return; }
    html += head('All agents', 'A to Z', opts.length) + opts.slice(0, 50).map(o => row(o, '')).join('');
    html += foot((opts.length > 50 ? ('+ ' + (opts.length - 50) + ' more &middot; ') : '') + 'Arrows to move &middot; Enter to choose &middot; type to search all ' + opts.length + ' agents');
  }
  dd.innerHTML = html;
}
