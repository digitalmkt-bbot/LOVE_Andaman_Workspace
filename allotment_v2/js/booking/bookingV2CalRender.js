function bookingV2CalRender(){
  if(_bkV2CalIdx === null) return;
  const idx = _bkV2CalIdx;
  const pop = document.getElementById('bkv2-cal-pop-' + idx);
  if(!pop) return;
  const t = _bkV2.newBooking?.trips?.[idx];
  const route = (t?.routeId && typeof ROUTES !== 'undefined') ? ROUTES.find(r => r.id === t.routeId) : null;
  const [y, m] = _bkV2CalMonth.split('-').map(Number);
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const firstDay = new Date(y, m-1, 1).getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  const today = TODAY_STR;
  const selDate = t?.date || '';

  let cells = '';
  for(let i = 0; i < firstDay; i++) cells += '<div class="bkv2-cal-day empty"></div>';
  for(let d = 1; d <= daysInMonth; d++){
    const ds = y + '-' + String(m).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    const isPast = ds < today;
    const isToday = ds === today;
    const isSel = ds === selDate;
    let isClosed = false;
    if(route && typeof getDayStatus === 'function'){
      const status = getDayStatus(route, ds);
      isClosed = !!(status && status.type === 'closed');
    }
    const allowPast = !!window._bkV2CalAllowPast;   // opt-in · backdated bookings
    const cls = [
      'bkv2-cal-day',
      (isPast && !allowPast) ? 'past' : '',
      isClosed ? 'closed' : '',
      isToday ? 'today' : '',
      isSel ? 'sel' : ''
    ].filter(Boolean).join(' ');
    const clickable = (!isPast || allowPast) && !isClosed;
    const onclick = clickable ? `onmousedown="event.preventDefault();bookingV2CalPick(${idx},'${ds}')"` : '';
    const title = isClosed ? 'Program is closed on this date' : (isPast ? (allowPast?ds+' · ย้อนหลัง':'Past date') : ds);
    cells += `<div class="${cls}" ${onclick} title="${title}">${d}</div>`;
  }

  pop.innerHTML = `
    <div class="bkv2-cal-head">
      <button class="bkv2-cal-nav" onmousedown="event.preventDefault();bookingV2CalNav(-1)" title="Previous month">‹</button>
      <span class="bkv2-cal-head-title">${monthNames[m-1]} ${y}</span>
      <button class="bkv2-cal-nav" onmousedown="event.preventDefault();bookingV2CalNav(1)" title="Next month">›</button>
    </div>
    <div class="bkv2-cal-wdh"><div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div></div>
    <div class="bkv2-cal-grid">${cells}</div>
    <div class="bkv2-cal-foot">
      <div class="bkv2-cal-legend">
        ${route ? '<span><i style="background:#FDECEA"></i>Closed</span>' : '<span style="font-style:italic">No route · all dates open</span>'}
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        <label title="เปิดเพื่อทำบุคกิ้งย้อนหลัง (เลือกวันที่ผ่านมาแล้วได้)" style="display:inline-flex;align-items:center;gap:4px;font-size:10.5px;color:${window._bkV2CalAllowPast?'#A32D2D':'#8a8a82'};cursor:pointer;font-weight:${window._bkV2CalAllowPast?'700':'500'}"><input type="checkbox" ${window._bkV2CalAllowPast?'checked':''} onmousedown="event.stopPropagation()" onchange="window._bkV2CalAllowPast=this.checked;bookingV2CalRender()" style="margin:0;cursor:pointer">ย้อนหลัง</label>
        ${selDate ? '<button onmousedown="event.preventDefault();bookingV2CalClear()">Clear</button>' : ''}
        <button onmousedown="event.preventDefault();bookingV2CalGoToday()">Today</button>
      </div>
    </div>
  `;
}
