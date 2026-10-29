function bookingV2RenderTopbar(){
  const tab = _bkV2.tab;
  const view = _bkV2.view;
  const cur = _bkV2.cursor;
  const monthLbl = cur.toLocaleDateString('en-US', { month: 'short', year:'numeric' });
  return `
    <div class="bkv2-topbar2">
      <div class="bkv2-utabs">
        <button class="bkv2-utab ${tab==='cal'?'on':''}" onclick="bookingV2SwitchTab('cal')">Calendar</button>
        <button class="bkv2-utab ${tab==='bytrip'?'on':''}" onclick="bookingV2SwitchTab('bytrip')">By trip &middot; date</button>
        <button class="bkv2-utab ${tab==='all'?'on':''}" onclick="bookingV2SwitchTab('all')">All bookings</button>
        <button class="bkv2-utab ${tab==='locks'?'on':''}" onclick="bookingV2SwitchTab('locks')">Seat Locks</button>
        ${(function(){ const _sn=(typeof window.laOpsPendingApprovals==='function')?window.laOpsPendingApprovals():null; /* §opsApprovalsBadge · the server's count of ALL pending approvals (stats.by_status), not just the loaded months */ const n=(_sn!=null)?_sn:(SB_BOOKINGS||[]).filter(b=>b.status==='pending_approval').length; return `<button class="bkv2-utab ${tab==='approvals'?'on':''}" onclick="bookingV2SwitchTab('approvals')" style="${n>0?'color:#A32D2D':''}">${laT('รออนุมัติ')}${n>0?` <span style="background:#A32D2D;color:#fff;border-radius:9px;padding:0 6px;font-size:10px;font-weight:700;font-family:'DM Mono',monospace">${n}</span>`:''}</button>`; })()}
        <button class="bkv2-utab ${tab==='cancel'?'on':''}" onclick="bookingV2SwitchTab('cancel')">Cancellations${(typeof cxwTabBadge==='function')?cxwTabBadge():''}</button>
      </div>
      ${tab==='cal' ? `
        <span class="bkv2-topdiv"></span>
        <div class="bkv2-vseg">
          <button class="bkv2-vsegbtn ${view==='cal'?'on':''}" onclick="bookingV2SwitchView('cal')" title="Calendar view">&#9638;</button>
          <button class="bkv2-vsegbtn ${view==='mx'?'on':''}" onclick="bookingV2SwitchView('mx')" title="Matrix view">&#9636;</button>
        </div>
        <div class="bkv2-datechip">
          <button class="bkv2-dcbtn" onclick="bookingV2NavMonth(-1)">&lsaquo;</button>
          <span class="bkv2-dclbl">${monthLbl}</span>
          <button class="bkv2-dcbtn" onclick="bookingV2NavMonth(1)">&rsaquo;</button>
        </div>
        <button class="bkv2-todaylink" onclick="bookingV2Today()">Today</button>
      ` : ''}
      <div class="bkv2-topspacer"></div>
      <div class="bkv2-meta2">${bookingV2TopbarMeta()}</div>
      <button class="bkv2-newbtn2" onclick="bkImpStart()" title="นำเข้าไฟล์ Excel รายชื่อลูกค้าจากเอเยนต์ (เช่น Tour Customer List) · กรอกฟอร์มให้ทีละใบ" style="background:#fff;color:#16265C;border:1px solid #CBD2E0;margin-right:6px">&#11014; Import Excel</button>   <!-- §bkImp -->
      <button class="bkv2-newbtn2" onclick="bookingV2NewBooking()">+ New booking <span class="bkv2-kbd2">C</span></button>
    </div>
  `;
}
