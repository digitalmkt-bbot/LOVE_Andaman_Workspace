// ── Tab 1 · Matrix view ──
function bookingV2RenderMatrix(){
  const cur = _bkV2.cursor;
  const year = cur.getFullYear();
  const month = cur.getMonth();
  const lastDay = new Date(year, month+1, 0).getDate();
  const agg = bookingV2Aggregate();
  const todayKey = bookingV2DateKey(new Date());

  let headers = `<th class="rowh">Route</th>`;
  const dayTotals = [];
  const dayBrk = [];                                  /* §mxBrk · แยกประเภทของแต่ละวัน */
  const wkArr = [];                                   /* §mxRead · เสาร์-อาทิตย์ */
  for(let d = 1; d <= lastDay; d++){
    const dt = new Date(year, month, d);
    const dow = dt.getDay();
    const weekend = dow === 0 || dow === 6;
    wkArr.push(weekend);
    const dowLetter = ['S','M','T','W','T','F','S'][dow];
    const dateKey = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = dateKey === todayKey;
    const dhSel = _bkV2.selected?.date === dateKey ? 'sel' : '';
    headers += `<th class="dh ${weekend?'weekend':''} ${isToday?'today':''} ${dhSel}" onclick="bookingV2SelectDay('${dateKey}')" title="View ${dateKey}">${dowLetter}<span class="dnum">${d}</span></th>`;
    dayTotals.push(0); dayBrk.push({ad:0,chd:0,inf:0,foc:0});
  }
  headers += `<th class="rowh sumh">รวมเดือน</th>`;   /* §mxRead */
  headers += `<th class="pxh" title="ผู้ใหญ่">AD</th><th class="pxh" title="เด็ก">CHD</th>`
           + `<th class="pxh" title="ทารก">INF</th><th class="pxh" title="ฟรี / FOC">FOC</th>`;  /* §mxBrk2 */
  const _dk = d => `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

  // Family-grouped rows · parent rows shown by default · click to expand sub-routes
  // §cityTourView · Transfer/City Tour are real families (§routeKind) · marine page (flag off)
  //   excludes them · land page (flag on) shows only them
  const fams = bookingV2Families().filter(fam => {
    if(typeof laIsLandRoute!=='function') return true;
    const _famIsLand = (bookingV2FamilyRoutes(fam.id)||[]).some(rd => laIsLandRoute(rd.id));
    return _famIsLand === _bkV2CityTourOnly;
  });
  /* §mxBrk · ผลรวมต้องบอกด้วยว่าเป็นผู้ใหญ่/เด็ก/ทารก/FOC กี่คน
     เลขรวมอย่างเดียวใช้วางแผนที่นั่งกับคิดเงินไม่ได้ — เด็กกับทารกคิดคนละราคา
     ประเภทที่เป็นศูนย์ไม่ต้องขึ้น · เดือนที่ไม่มีทารกเลยจะได้ไม่มี "INF 0" มารกทุกแถว */
  /* §mxBrk2 · ประเภทผู้โดยสารเป็นคอลัมน์ของตัวเอง ไม่ใช่ป้ายซ้อนในช่องรวม
     ยัดสี่ป้ายลงช่องกว้าง 108px มันตกบรรทัด แถวเลยสูงจาก 55 เป็น 74px ทั้งตาราง
     แยกเป็นคอลัมน์แล้วอ่านลงแนวตั้งได้ด้วย เทียบข้ามโปรแกรมง่ายกว่าอ่านทีละแถว
     ศูนย์ขึ้นเป็นจุด ไม่ใช่ 0 · ตาจะได้ข้ามไปหาตัวที่มีเลขจริง */
  const _pxCells = o => ['ad','chd','inf','foc'].map(k => {
    const v = +((o||{})[k]) || 0;
    return v ? `<td class="px">${v.toLocaleString()}</td>` : `<td class="px z">&middot;</td>`;
  }).join('');
  const _sumCell = (val, foot, col, brk) =>
    `<td class="sum"><b${col?` style="color:${col}"`:''}>${val.toLocaleString()}</b><i>${foot}</i></td>`
    + _pxCells(brk);
  /* รวม ad/chd/inf/foc ของหลายวัน · ใช้ทั้งแถวแม่ แถวลูก และแถวรวมทั้งวัน */
  const _brkAdd = (t, x) => { if(!x) return t;
    t.ad+=(+x.ad||0); t.chd+=(+x.chd||0); t.inf+=(+x.inf||0); t.foc+=(+x.foc||0); return t; };
  const _brkNew = () => ({ad:0,chd:0,inf:0,foc:0});
  const _brkTitle = x => x ? `AD ${(+x.ad||0)} · CHD ${(+x.chd||0)} · INF ${(+x.inf||0)} · FOC ${(+x.foc||0)}` : '';
  const rows = fams.map(fam => {
    const subRoutes = bookingV2FamilyRoutes(fam.id);
    const isExpanded = _bkV2.expanded.has(fam.id);
    /* §mxRead · เก็บค่าทั้งเดือนก่อน · ต้องรู้ต่ำสุด-สูงสุดของแถวถึงจะไล่สีได้ */
    const famDay = [], famOpenD = [];
    for(let d = 1; d <= lastDay; d++){
      famOpenD.push(bookingV2IsFamilyOpenOn(fam.id, _dk(d)));
      famDay.push(bookingV2FamilyAggregate(fam.id, _dk(d), agg));
    }
    const famLive = famDay.map(x => x.total).filter(v => v > 0);
    const fLo = famLive.length ? Math.min(...famLive) : 0;
    const fHi = famLive.length ? Math.max(...famLive) : 0;
    const fSum = famLive.reduce((a,b) => a+b, 0);
    const fBrk = famDay.reduce((t,x) => _brkAdd(t,x), _brkNew());   /* §mxBrk */
    famDay.forEach((x, i) => { dayTotals[i] += x.total; _brkAdd(dayBrk[i], x); });

    let parentRow = `<td class="rowh" onclick="bookingV2ToggleFamily('${fam.id}')" style="border-left-color:${fam.color}"><span class="caret">${isExpanded?'▾':'▸'}</span>${fam.name}<span class="subc">${subRoutes.length} variant${subRoutes.length===1?'':'s'}</span></td>`;
    for(let d = 1; d <= lastDay; d++){
      const dateKey = _dk(d), wk = wkArr[d-1] ? ' wk' : '';
      /* §mxRead · กางออกแล้วแถวแม่ปล่อยว่าง · เลขอยู่ที่แถวลูกอย่างเดียว ไม่ต้องอ่านซ้ำ */
      if(isExpanded){ parentRow += `<td class="cell blank${wk}"></td>`; continue; }
      const famOpen = famOpenD[d-1], famData = famDay[d-1];
      const sel = _bkV2.selected?.date === dateKey && _bkV2.selected?.familyId === fam.id;
      if(!famOpen && famData.total === 0){ parentRow += `<td class="cell closed${wk}" title="All routes in this family closed">&times;</td>`; continue; }
      if(famData.total === 0){ parentRow += `<td class="cell empty${wk}${sel?' sel':''}" onclick="bookingV2SelectFamilyCell('${dateKey}','${fam.id}')">&mdash;</td>`; continue; }
      const cls = ['cell', famData.hasFocPending?'foc':'', sel?'sel':'', famData.hasFocPending?'focdot':'', wk.trim()].filter(Boolean).join(' ');
      const st = (famData.hasFocPending || sel) ? '' : ` style="${bookingV2MxHeat(famData.total, fLo, fHi, fam.color, false)}"`;
      parentRow += `<td class="${cls}"${st} onclick="bookingV2SelectFamilyCell('${dateKey}','${fam.id}')">${famData.total}</td>`;
    }
    parentRow += _sumCell(fSum, isExpanded ? 'รวมทุก variant' : (famLive.length ? Math.round(fSum/famLive.length)+'/วันที่ออก' : 'ไม่ได้ออกเลย'),
                          isExpanded ? '#5B6670' : fam.color, fBrk);
    let html = `<tr class="fam ${isExpanded?'expanded':''}">${parentRow}</tr>`;

    // Sub-routes (rendered when expanded)
    if(isExpanded){
      /* §mxRead · แยกตัวที่มีคนกับตัวที่ว่างทั้งเดือน · ตัวว่างพับเก็บ กินที่เปล่า ๆ */
      const subInfo = subRoutes.map(rDef => {
        const vals = [], brk = _brkNew();
        for(let d = 1; d <= lastDay; d++){
          const cell = agg.byDate[_dk(d)]?.routes?.[rDef.id];
          vals.push((cell?.total) || 0);
          _brkAdd(brk, cell);                                        /* §mxBrk */
        }
        const live = vals.filter(v => v > 0);
        return { rDef, vals, live, brk, sum: live.reduce((a,b)=>a+b,0) };
      });
      const withData = subInfo.filter(o => o.live.length);
      const noData   = subInfo.filter(o => !o.live.length);
      const showEmpty = !!(_bkV2.mxEmpty && _bkV2.mxEmpty.has(fam.id));
      const shown = showEmpty ? subInfo : (withData.length ? withData : subInfo);

      shown.forEach(o => {
        const rDef = o.rDef;
        const sLo = o.live.length ? Math.min(...o.live) : 0;
        const sHi = o.live.length ? Math.max(...o.live) : 0;
        let subRow = `<td class="rowh" title="${rDef.full}">${rDef.full}</td>`;
        for(let d = 1; d <= lastDay; d++){
          const dateKey = _dk(d), wk = wkArr[d-1] ? ' wk' : '';
          const isOpen = bookingV2IsRouteOpenOn(rDef.id, dateKey);
          const r = agg.byDate[dateKey]?.routes?.[rDef.id];
          if(!isOpen && !r){ subRow += `<td class="cell closed${wk}" title="Route closed">&times;</td>`; continue; }
          if(!r){ const eSel=(_bkV2.selected?.date===dateKey && _bkV2.selected?.routeId===rDef.id)?' sel':''; subRow += `<td class="cell empty${wk}${eSel}" onclick="bookingV2SelectCell('${dateKey}','${rDef.id}')">&mdash;</td>`; continue; }
          const sel = _bkV2.selected?.date === dateKey && _bkV2.selected?.routeId === rDef.id;
          if(!isOpen){
            subRow += `<td class="cell closed-with-data${wk} ${sel?'sel':''}" onclick="bookingV2SelectCell('${dateKey}','${rDef.id}')" title="Bookings on closed route">${r.total}</td>`;
            continue;
          }
          const cls = ['cell', r.hasFocPending?'foc':'', sel?'sel':'', r.hasFocPending?'focdot':'', wk.trim()].filter(Boolean).join(' ');
          const st = (r.hasFocPending || sel) ? '' : ` style="${bookingV2MxHeat(r.total, sLo, sHi, fam.color, false)}"`;
          subRow += `<td class="${cls}"${st} onclick="bookingV2SelectCell('${dateKey}','${rDef.id}')">${r.total}</td>`;
        }
        subRow += _sumCell(o.sum, o.live.length + ' วัน', o.live.length ? fam.color : '#B6BCC3', o.brk);
        html += `<tr class="sub">${subRow}</tr>`;
      });

      if(noData.length && withData.length){
        html += `<tr class="sub emptyvars"><td class="rowh mxmore" colspan="${lastDay+6}" onclick="bookingV2ToggleEmptyVars('${fam.id}')">`
              + `${showEmpty?'▾':'▸'} <u>อีก ${noData.length} variant${noData.length===1?'':'s'} ไม่มีคนทั้งเดือน</u>`
              + ` <span class="mxmore-n">${noData.map(o=>o.rDef.full).join(' · ')}</span></td></tr>`;
      }
    }
    return html;
  }).join('');

  // Toolbar above matrix (expand/collapse all)
  const anyExpanded = _bkV2.expanded.size > 0;
  const toolbar = `<div class="bkv2-mx-toolbar"><span>${fams.length} programs &middot; ${bookingV2Routes().length} variants</span><span style="margin-left:auto"></span><button onclick="bookingV2ExpandAllFamilies()">Expand all</button>${anyExpanded?`<button onclick="bookingV2CollapseAllFamilies()">Collapse all</button>`:''}`
    + `<button onclick="bookingV2TogglePanel()" title="${_bkV2.panelHid?'กางแผงรายละเอียดวัน':'พับแผงขวา · ตารางกว้างขึ้น 360px'}">${_bkV2.panelHid?'&rsaquo;&rsaquo; แผงขวา':'&lsaquo;&lsaquo; พับแผงขวา'}</button></div>`;

  /* §mxRead · บรรทัดที่ต้องอ่านที่สุดของหน้านี้ · บาร์ใต้ตัวเลขทำให้เห็นจังหวะทั้งเดือนในตาเดียว */
  const _maxDay = Math.max(1, ...dayTotals);
  let totRow = `<td class="rowh">รวมทั้งวัน</td>`;
  for(let d = 1; d <= lastDay; d++){
    const isToday = _dk(d) === todayKey;
    const v = dayTotals[d-1] || 0;
    /* §mxBrk · ช่องวันแคบเกินกว่าจะพิมพ์ 4 ประเภทลงไป · ใส่ไว้ใน tooltip แทน
       เลขที่อ่านทุกวันคือยอดรวม · รายละเอียดหาได้เมื่ออยากรู้ ไม่ต้องรกทั้งแถว */
    totRow += `<td class="${isToday?'today':''}"${v?` title="${_dk(d)} · ${_brkTitle(dayBrk[d-1])}"`:''}><div class="tn">${v || '·'}</div>`
            + `<div class="ttrack"><div class="tbar" style="width:${v?Math.max(8,Math.round(v/_maxDay*100)):0}%"></div></div></td>`;
  }
  const _grand = dayTotals.reduce((a,b) => a+b, 0);
  const _gBrk = dayBrk.reduce((t,x) => _brkAdd(t,x), _brkNew());     /* §mxBrk */
  totRow += _sumCell(_grand, 'เฉลี่ย '+Math.round(_grand/lastDay)+'/วัน', '', _gBrk);

  // Colgroup enforces equal day column widths (works with table-layout:fixed)
  let colgroup = '<col class="label">';
  for(let d = 1; d <= lastDay; d++) colgroup += '<col class="day">';
  colgroup += '<col class="sumcol">';                 /* §mxRead */
  colgroup += '<col class="pxcol"><col class="pxcol"><col class="pxcol"><col class="pxcol">';   /* §mxBrk2 */

  return `
    ${bookingV2RenderStats()}
    ${bookingV2RenderRouteAvgs()}
    <div class="bkv2-split${_bkV2.panelHid?' nopanel':''}">
      <div class="bkv2-mx">
        ${toolbar}
        <table>
          <colgroup>${colgroup}</colgroup>
          <thead><tr>${headers}</tr></thead>
          <tbody>
            ${rows}
            <tr class="tot">${totRow}</tr>
          </tbody>
        </table>
      </div>
      ${bookingV2PanelSlot()}
    </div>
    ${bookingV2RenderFooterHints('mx')}
  `;
}
