// Main entry (called from renderBooking)
function bookingV2Render(){
  const host = document.getElementById('bkv2-host');
  if(!host) return;
  try{
    // P3 · Detail view (read-only by default · Edit toggles into newBooking flow)
    if(_bkV2.detailId && !_bkV2.newBooking){
      host.innerHTML = `<div class="bkv2">${bookingV2RenderBookingDetail()}</div>`;
      return;
    }
    // If New Booking form is open · render that instead of tabs
    if(_bkV2.newBooking){
      host.innerHTML = `<div class="bkv2">${bookingV2RenderNewBooking()}</div>`;
      return;
    }
    host.innerHTML = `<div class="bkv2 bkv2-topcard">${bookingV2RenderTopbar()}</div><div class="bkv2 bkv2-bodycard">${bookingV2RenderTabBody()}</div>${bookingV2RenderLockModal()}${(typeof bookingV2LockOverlays==='function'?bookingV2LockOverlays():'')}`;
    // Stack the sticky headers below the (sticky) day header · set LITERAL px offsets (no calc-in-custom-prop, which can fail to resolve)
    requestAnimationFrame(()=>{ try{
      const vb=document.getElementById('view-booking'); if(!vb) return;
      /* §btHead · หัว By-trip ตรึงแล้ว (top:-22px) · ชั้นล่างต้องเกาะใต้ความสูงจริงของมัน
         ฮาร์ดโค้ดไม่ได้ เพราะการ์ดในหัวตกบรรทัดตามความกว้างจอ */
      const _bth=host.querySelector('.bt-pkh');
      const h=_bth?_bth.offsetHeight:0;
      /* §btFreeze · ระยะซ้ายของคอลัมน์ที่ตรึง · ฮาร์ดโค้ดไม่ได้เพราะความกว้างจริง
         ขึ้นกับ padding/border ของธีม และเปลี่ยนตามโหมด (Van ซ่อน 4 คอลัมน์) */
      try{ const _hr=host.querySelector('table.t2-mtbl thead tr');
        if(_hr && _hr.children.length>2){
          const w1=Math.round(_hr.children[0].getBoundingClientRect().width);
          const w2=Math.round(_hr.children[1].getBoundingClientRect().width);
          vb.style.setProperty('--t2-fz1', w1+'px');
          vb.style.setProperty('--t2-fz2', (w1+w2)+'px');
        } }catch(_){}
      const TOP=parseInt(getComputedStyle(document.documentElement).getPropertyValue('--topbar'))||0;   // topbar height (0 after topbar removal · auto-reverts if bar restored)
      const vanOn=!!(typeof _bkV2!=='undefined'&&_bkV2&&_bkV2.vanAssignMode);
      // measure the actual van+grouping strip height (was hardcoded 96 → gap/overlap when real height differed)
      const vs=host.querySelector('.bkv2-vanstrip'); const VANGROUP=(vanOn&&vs)?vs.offsetHeight:0;
      /* §btScroll · ตัวเลื่อนย้ายมาอยู่ที่ .t2-wrap แล้ว · ชั้นที่ตรึงต้องวัดจาก
         ขอบบนของกล่องนั้น ไม่ใช่จากขอบจอ · ไม่งั้นแถบ VANS ไปลอยกลางตาราง */
      vb.style.setProperty('--t2-vangroup-top', '0px');
      vb.style.setProperty('--t2-head-top', VANGROUP+'px');
      /* §btScroll · ความสูงกล่องรายวัน = จอ ลบแถบแท็บ ลบหัวที่ตรึง ลบขอบล่างไว้หายใจ
         ต้องอยู่หลัง TOP ถูกประกาศ ไม่งั้นชนกฎ let/const แล้วโยน ReferenceError เงียบ ๆ */
      try{ const _wp=host.querySelector('.t2-wrap');
        if(_wp){ const _vh=window.innerHeight||900;
          /* วัดจากตำแหน่งจริงของกล่อง · บวกลบความสูงทีละชิ้นพลาดไป ~34px
             (ขอบ/มาร์จินของการ์ดครอบที่ไม่ได้นับ) แล้วหน้าเลื่อนได้อีกนิดหน่อย
             กลายเป็นสองตัวเลื่อนซ้อนกัน */
          const _top=_wp.getBoundingClientRect().top + (window.scrollY||0);
          let _hh=Math.max(280, _vh-_top-12);
          vb.style.setProperty('--bt-wraph', _hh+'px');
          /* ยังมีขอบล่างของ #view (64px) กับ main (22px) ที่ไม่ได้อยู่ในสายที่วัด
             ดันให้หน้ายังเลื่อนได้อีกนิด กลายเป็นสองตัวเลื่อนซ้อนกัน
             หดความสูงกล่องไม่ได้ เพราะจะเสียพื้นที่ตารางไป 86px เปล่า ๆ
             ดึงขอบล่างนั้นกลับด้วย margin ติดลบแทน · กล่องได้ความสูงเต็ม หน้าไม่เลื่อน */
          _wp.style.marginBottom='0px';
          requestAnimationFrame(()=>{ try{
            const _ov=document.documentElement.scrollHeight-(window.innerHeight||900);
            if(_ov>1) _wp.style.marginBottom=(-_ov)+'px';
          }catch(_){} });
        } }catch(_){}
    }catch(_){} });
  }catch(e){
    console.error('[bookingV2Render] render failed:', e);
    host.innerHTML = `<div class="bkv2" style="padding:24px"><div style="font-size:13px;color:#A32D2D;font-weight:600">⚠ Booking view render error</div><div style="font-size:12px;color:var(--ink-soft,#888);margin-top:6px;font-family:'DM Mono',monospace">${String((e&&e.message)||e).replace(/[<>&]/g,'')}</div><button onclick="_bkV2.detailId=null;_bkV2.newBooking=null;_bkV2.editingId=null;_bkV2.tab='cal';try{bookingV2Render()}catch(_){}" style="margin-top:14px;background:#185FA5;color:#fff;border:none;font-family:inherit;font-size:12px;font-weight:600;padding:9px 16px;border-radius:9px;cursor:pointer">Reset to Calendar view</button></div>`;
  }
}
