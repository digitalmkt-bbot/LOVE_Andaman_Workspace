// §bkMonthPage · the tab's primary navigator: a month stepper + a scrollable strip of months that have rows.
// Replaces "page 43 of 68" — a page number means nothing to staff and shifts under them as bookings arrive,
// a travel month does not.
function bookingV2MonthBarHtml(o){
  const {month, months, monthCounts, monthMin, monthMax, allTotal, searching} = o;
  const navy = 'var(--bk-navy,#185FA5)';
  const n = month === 'all' ? allTotal : (monthCounts.get(month) || 0);
  const step = (label, target, dis) => `<button ${dis?'disabled':`onclick="bookingV2SetMonth('${target}')"`}
    style="width:30px;height:30px;border-radius:8px;border:1px solid #E2E0DA;background:#fff;cursor:${dis?'default':'pointer'};
      font-family:inherit;font-size:14px;line-height:1;color:${dis?'#C4C2BB':'var(--ink-soft,#6b6862)'}">${label}</button>`;
  // Stepping out of "All time" lands on the newest month rather than one month either side of it.
  const prev = month === 'all' ? (monthMax || month) : bookingV2MonthShift(month, -1);
  const next = month === 'all' ? (monthMax || month) : bookingV2MonthShift(month, 1);
  const chip = (k) => {
    const on = k === month;
    return `<button onclick="bookingV2SetMonth('${k}')" data-mon="${k}"
      style="flex:none;height:26px;padding:0 9px;border-radius:7px;cursor:pointer;font-family:inherit;font-size:11px;
        font-weight:${on?800:600};white-space:nowrap;font-variant-numeric:tabular-nums;
        border:1px solid ${on?navy:'#E2E0DA'};background:${on?navy:'#fff'};color:${on?'#fff':'var(--ink-soft,#6b6862)'}"
      >${bookingV2MonthLabel(k,true)} <span style="opacity:.65;font-weight:600">${monthCounts.get(k)||0}</span></button>`;
  };
  const allOn = month === 'all';
  return `
    <div style="display:flex;flex-direction:column;gap:7px;margin:2px 0 10px">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        ${step('&lsaquo;', prev, month !== 'all' && (!monthMin || month <= monthMin))}
        <div style="min-width:210px;text-align:center;font-size:13.5px;font-weight:800;color:var(--ink,#2c2a26);font-variant-numeric:tabular-nums">
          ${searching ? 'Search &middot; all months' : bookingV2MonthLabel(month)}
          <span style="font-size:11px;font-weight:600;color:var(--ink-soft,#6b6862)"> &middot; ${n} booking${n===1?'':'s'}</span>
        </div>
        ${step('&rsaquo;', next, month !== 'all' && (!monthMax || month >= monthMax))}
        ${searching ? `<span style="font-size:11px;color:#9A5B00;background:#FBE9D6;border-radius:6px;padding:3px 8px">
            &#9873; search ignores the month &mdash; clear it to go back to ${bookingV2MonthLabel(_bkV2.month || month)}</span>` : ''}
        <button onclick="bookingV2SetMonth('all')" title="Every travel date · slower on a big list"
          style="margin-left:auto;height:28px;padding:0 11px;border-radius:8px;cursor:pointer;font-family:inherit;font-size:11.5px;
            font-weight:${allOn?800:600};border:1px solid ${allOn?navy:'#E2E0DA'};background:${allOn?navy:'#fff'};
            color:${allOn?'#fff':'var(--ink-soft,#6b6862)'}">All time &middot; ${allTotal}</button>
      </div>
      ${months.length <= 1 ? '' : `
      <div id="bkv2-monthstrip" style="display:flex;gap:5px;overflow-x:auto;padding-bottom:3px;scrollbar-width:thin">
        ${months.map(chip).join('')}
      </div>`}
    </div>
  `;
}
