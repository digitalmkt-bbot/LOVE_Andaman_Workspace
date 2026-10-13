// §bkPage · pager strip · window of page numbers around the current one, with first/last always
// reachable so 68 pages never turns into 68 buttons. §bkMonthPage · now a fallback — it only appears
// when one month (or All time) holds more rows than pageSize.
function bookingV2PagerHtml(page, pageCount, from, shown, total){
  const size = _bkV2.pageSize;
  const btn = (label, target, opts={}) => {
    const on = !!opts.on, dis = !!opts.dis;
    return `<button ${dis?'disabled':`onclick="bookingV2SetPage(${target})"`}
      style="min-width:30px;height:28px;padding:0 8px;border-radius:7px;cursor:${dis?'default':'pointer'};font-family:inherit;
        font-size:11.5px;font-weight:${on?800:600};font-variant-numeric:tabular-nums;
        border:1px solid ${on?'var(--bk-navy,#185FA5)':'#E2E0DA'};
        background:${on?'var(--bk-navy,#185FA5)':'#fff'};
        color:${on?'#fff':(dis?'#C4C2BB':'var(--ink-soft,#6b6862)')}">${label}</button>`;
  };
  const nums = [];
  if(pageCount <= 7){
    for(let i=1;i<=pageCount;i++) nums.push(i);
  } else {
    // Fixed-width window that slides and clamps, so page 1 and the last page still show a full run
    // of neighbours rather than collapsing to "1 2 … 68".
    const W = 5;
    let start = Math.max(2, page - Math.floor(W/2));
    let end   = Math.min(pageCount - 1, start + W - 1);
    start = Math.max(2, end - W + 1);
    nums.push(1);
    if(start > 2) nums.push('…');
    for(let i=start;i<=end;i++) nums.push(i);
    if(end < pageCount - 1) nums.push('…');
    nums.push(pageCount);
  }
  const gap = `<span style="color:#C4C2BB;font-size:11.5px;padding:0 2px">…</span>`;
  return `
    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:12px 2px 4px">
      <span style="font-size:11px;color:var(--ink-soft,#6b6862);font-variant-numeric:tabular-nums">
        ${total === 0 ? '0' : `${from+1}&ndash;${from+shown}`} of ${total}
      </span>
      <div style="margin-left:auto;display:flex;align-items:center;gap:5px;flex-wrap:wrap">
        ${btn('&lsaquo; Prev', page-1, {dis: page<=1})}
        ${nums.map(n => n === '…' ? gap : btn(String(n), n, {on: n===page})).join('')}
        ${btn('Next &rsaquo;', page+1, {dis: page>=pageCount})}
        <select onchange="bookingV2SetPageSize(this.value)" title="Rows per page"
          style="height:28px;margin-left:6px;border:1px solid #E2E0DA;border-radius:7px;background:#fff;
            font-family:inherit;font-size:11.5px;color:var(--ink-soft,#6b6862);cursor:pointer;padding:0 4px">
          ${[50,100,200,'all'].map(v => `<option value="${v}" ${String(size)===String(v)?'selected':''}>${v==='all'?'All':v+' / page'}</option>`).join('')}
        </select>
      </div>
    </div>
  `;
}
