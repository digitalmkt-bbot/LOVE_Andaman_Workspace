/* ══════════════════════════════════════════════════════════════════════════
   §embed (2026-09-19) · โหมดฝังหน้าเดียวลง <iframe> ของบริการอื่น

   ทำไมต้องมีไฟล์นี้ — แอปนี้ไม่มี routing เลย เปลี่ยนหน้าด้วย nav(el) ที่อ่าน
   data-view จาก DOM ที่ถูกคลิกเท่านั้น ไม่มี hash ไม่มี query string
   แปะ <iframe src="...allotment_v2.html"> เฉย ๆ จึงได้หน้า Dashboard
   พร้อมแถบบน+เมนูข้างทุกครั้ง ไม่ว่าอยากได้หน้าไหน

   ใช้:
     /allotment_v2/allotment_v2.html?embed=1&view=booking&tab=cal
     /allotment_v2/allotment_v2.html?embed=1&view=booking&tab=bytrip&date=2026-09-20

   พารามิเตอร์
     embed=1    เปิดโหมดนี้ · ไม่ใส่ = ไฟล์นี้ออกทันที ไม่แตะอะไรเลยสักอย่าง
     view=      ค่าเดียวกับ data-view ในแถบเมนู · ไม่ใส่ = booking
     tab=       เฉพาะ view=booking · cal | bytrip | all | locks | approvals | cancel
     date=      YYYY-MM-DD · ใช้กับ tab=bytrip
     route=     route id · ใช้กับ tab=bytrip
     chrome=1   ดีบั๊ก · คงแถบบนกับเมนูข้างไว้ จะได้เห็นว่าไปโผล่หน้าไหนจริง

   ⚠ ไฟล์นี้ต้องเป็น <script> ตัวแรก มาก่อน 01-auth-sync.js เพราะ
     1. ต้องทา class ก่อนวาดจอครั้งแรก ไม่งั้นเห็นเมนูแวบหนึ่งแล้วค่อยหาย
     2. ต้องตั้ง window.__laEmbed ก่อนที่ 01-auth-sync จะตั้งนาฬิกา
        _laRestoreView (850ms) ซึ่งจะคลิกหน้าที่ค้างไว้ทับหน้าที่สั่งมาทาง URL

   ⚠ นี่ไม่ใช่กำแพงสิทธิ์ · ซ่อนเมนูด้วย CSS ไม่ได้ลดสิทธิ์อะไรเลย ในกรอบนั้น
     คือแอปเต็มตัวที่รันด้วย session ของคนดู เปิด devtools แล้วเรียกฟังก์ชัน
     อะไรก็ได้ · ใช้กับคนที่มีสิทธิ์อยู่แล้วเท่านั้น คนนอกต้องทำหน้า read-only
     แยกที่ดึงจาก API แคบ ๆ ไม่ใช่ฝังหน้านี้
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  var qs; try{ qs = new URLSearchParams(location.search); }catch(_){ return; }
  if(qs.get('embed') !== '1') return;                 // ไม่ใช่โหมดฝัง = ไม่มีผลข้างเคียงใด ๆ

  window.__laEmbed = true;

  /* §embedTabNorm (2026-09-22) · ชื่อแท็บของหน้าแม่ ≠ ชื่อแท็บข้างใน
     /embed/calendar ถูกแปลงเป็น tab=cal ที่ server.js §embedRoute อยู่แล้ว
     แต่ตอนหน้าแม่สั่งเปลี่ยนแท็บผ่าน postMessage มันส่ง 'calendar' มาดิบ ๆ
     ไม่มีใครแปลงให้ · _bkV2.tab จึงกลายเป็น 'calendar' ซึ่งไม่ตรงสักกิ่ง
     แล้ว bkV2RenderTabBody ตกไป else = โชว์ "All bookings" แทนปฏิทิน
     (ไม่ได้จอขาว แต่ผิดหน้า ซึ่งแย่กว่าเพราะดูไม่ออกว่าพัง)

     แก้ที่ฝั่งนี้ไม่ใช่ฝั่งโน้น เพราะ (1) ไม่ต้องรอ deploy ของอีกทีม
     (2) ค่าที่มาจากนอกบ้านไม่ควรถูกยัดลง state ดิบ ๆ ตั้งแต่แรก
     ชื่อที่ยอมรับ = ปุ่มบนแถบแท็บจริง (08-app.js bkV2SwitchTab) เท่านั้น
     ชื่อแปลกปลอม = ทิ้ง แล้วคงแท็บเดิมไว้ ดีกว่าเด้งไปหน้าที่ไม่ได้ขอ */
  var TAB_OK    = ['cal','bytrip','all','locks','approvals','cancel'];
  var TAB_ALIAS = { calendar:'cal', trip:'bytrip', bytrip:'bytrip', cancellations:'cancel' };
  function normTab(t){
    t = String(t || '').trim().toLowerCase();
    if(!t) return '';
    t = TAB_ALIAS[t] || t;
    if(TAB_OK.indexOf(t) >= 0) return t;
    try{ console.warn('[embed] unknown tab: ' + t + ' · keeping current'); }catch(_){}
    return '';
  }

  var VIEW   = qs.get('view')  || 'booking';
  var TAB    = normTab(qs.get('tab'));
  var DATE   = qs.get('date')  || '';
  var ROUTE  = qs.get('route') || '';
  var CHROME = qs.get('chrome') === '1';
  /* §embedRO · ค่าเริ่มต้นของโหมดฝังคือ "ดูอย่างเดียว" ต้องใส่ edit=1 ถึงจะได้ปุ่มลงมือ
     ตั้งใจให้ default เป็นฝั่งที่ปลอดภัย · คนที่เอาไปแปะคือคนที่อยากให้ "ดู"
     ⚠ ตรงนี้เป็นแค่การเก็บปุ่ม ไม่ใช่กำแพงสิทธิ์ · กำแพงจริงอยู่ที่บัญชีผู้ใช้
       (canEdit=false → server ตอบ 403 ที่ /api/save และ /api/v1/_batch ทุกครั้ง)
       ถ้าบัญชีแก้ได้ เปิด devtools ก็เรียกฟังก์ชันตรง ๆ ได้อยู่ดี */
  var RO = qs.get('edit') !== '1';

  /* หน้าแม่คือใคร · ใช้เป็นปลายทางของ postMessage ที่เราส่งออก
     CSP frame-ancestors (server.js §embedFrame) เป็นตัวกันว่าใครฝังได้จริง
     ตรงนี้แค่ไม่อยากยิงข้อความออกเป็น '*' โดยไม่จำเป็น */
  var PARENT_ORIGIN = '*';
  try{ if(document.referrer) PARENT_ORIGIN = new URL(document.referrer).origin; }catch(_){}

  // ── 1) ถอดแถบบน + เมนูข้าง ก่อนวาดจอครั้งแรก ──────────────────────────
  /* --topbar / --sidebar เป็นตัวแปรที่ทั้งแอปใช้คิดตำแหน่งของที่ตรึงไว้
     (CLAUDE.md §6 · ห้าม hardcode 52) · ตั้งเป็น 0 ที่นี่ที่เดียว แล้วหัวตาราง
     ที่ sticky ทุกตัวเลื่อนตามเองหมด ไม่ต้องไล่แก้ทีละที่
     :root มีน้ำหนัก (0,1,0) · html.la-embed:not(...) มี (0,2,1) จึงทับได้ */
  var de = document.documentElement;
  de.classList.add('la-embed');
  if(CHROME) de.classList.add('la-embed-chrome');
  if(RO) de.classList.add('la-embed-ro');

  /* ⚠ ทุกกฎที่แย่งกับสกินต้องมี !important · css/02-skins.css ชั้น liquid-glass
     ตั้ง .main{margin-left:274px !important} (ไม่ใช่ var(--sidebar) · 274 ฝังไว้ตรง ๆ)
     ซ่อนเมนูข้างเฉย ๆ จึงยังเหลือช่องว่างซ้าย 274px ในกรอบ · น้ำหนัก selector
     ชนะไม่ได้ถ้าอีกฝั่งเป็น !important ต้อง !important สู้เท่านั้น
     คลุม body.sb-collapsed .main (108px) ด้วยในกฎเดียวกัน เพราะน้ำหนักสูงกว่า */
  var st = document.createElement('style');
  st.id = 'la-embed-css';
  st.textContent =
     'html.la-embed{background:#fff}'
    +'html.la-embed:not(.la-embed-chrome){--topbar:0px !important;--sidebar:0px !important}'
    +'html.la-embed:not(.la-embed-chrome) .topbar,'
    +'html.la-embed:not(.la-embed-chrome) .sidebar,'
    +'html.la-embed:not(.la-embed-chrome) .la-navdim,'
    /* #la-viewonly (ป้าย "👁 ดูอย่างเดียว") ตั้งใจไม่ซ่อน · ถ้าบัญชีเป็นแบบดูอย่างเดียว
       จริง ป้ายนี้คือสิ่งเดียวที่บอกคนใช้ว่าทำไมกดแล้วไม่มีอะไรเกิดขึ้น
       ที่ซ่อนคือ #la-userbadge เพราะมีปุ่ม "ผู้ใช้" กับ "ออก" ติดมาด้วย */
    +'html.la-embed:not(.la-embed-chrome) #la-userbadge{display:none !important}'
    /* §embedRO · เก็บปุ่มที่ลงมือกับข้อมูล · แถวโหมด Van/Boat/Re-confirm (.bt-c)
       กับปุ่ม + New booking · ปล่อยชิปเตือนไว้ เพราะมันคือ "ข้อมูล" ที่ CS ต้องเห็น
       (ยังไม่จัดรถกี่ใบ) แค่กดแล้วไม่เข้าโหมด เพราะฟังก์ชันถูกทับไว้ข้างล่าง */
    +'html.la-embed-ro .bt-c,'
    +'html.la-embed-ro .bkv2-newbtn,'
    +'html.la-embed-ro .bkv2-newbtn2{display:none !important}'
    +'html.la-embed:not(.la-embed-chrome) .app{margin-top:0 !important}'
    +'html.la-embed:not(.la-embed-chrome) .main,'
    +'html.la-embed:not(.la-embed-chrome) body.sb-collapsed .main{'
      +'margin-left:0 !important;padding-left:10px !important;padding-right:10px !important}'
    /* การ์ดแจ้งเตือน/สถานะของโหมดฝัง · หน้าตาเดียวกับ .la-modal ของ 01-auth-sync */
    +'.la-embed-msg{position:fixed;inset:0;z-index:99999;background:#F6F4EF;display:flex;'
      +'align-items:center;justify-content:center;padding:20px;'
      +'font:14px/1.5 "DM Sans",-apple-system,sans-serif;color:#15396B;text-align:center}'
    +'.la-embed-msg .c{background:#fff;border-radius:14px;padding:26px 28px;max-width:380px;'
      +'box-shadow:0 12px 40px rgba(10,20,40,.14)}'
    +'.la-embed-msg b{display:block;font-size:16px;font-weight:800;margin-bottom:6px}'
    +'.la-embed-msg p{margin:0 0 16px;font-size:13px;color:#7A756C}'
    +'.la-embed-msg a,.la-embed-msg button{display:inline-block;background:#1683C7;color:#fff;'
      +'border:none;border-radius:9px;padding:10px 18px;font:700 13px inherit;cursor:pointer;'
      +'text-decoration:none;margin:0 4px}';
  (document.head || de).appendChild(st);

  // ── 2) ข้อความแทนหน้าจอ เมื่อเข้าไม่ได้ ────────────────────────────────
  function msg(title, body, extraHTML){
    var d = document.getElementById('la-embed-msg');
    if(!d){ d = document.createElement('div'); d.id = 'la-embed-msg'; d.className = 'la-embed-msg';
            (document.body || de).appendChild(d); }
    d.innerHTML = '<div class="c"><b>' + title + '</b><p>' + body + '</p>' + (extraHTML || '') + '</div>';
  }

  /* ยังไม่ได้ล็อกอิน · 01-auth-sync เจอ /api/me = 401 แล้วกาง #la-login ให้
     ในกรอบ iframe ฟอร์มนั้นใช้ไม่ได้ถ้าหน้าแม่อยู่คนละโดเมน — คุกกี้ sess เป็น
     SameSite=Lax เบราว์เซอร์จึงทิ้ง Set-Cookie ที่ตอบกลับมาใน third-party context
     กรอกไปก็วนอยู่อย่างนั้น · เปลี่ยนเป็นบอกให้ไปล็อกอินในแท็บจริงแล้วค่อยกลับมา */
  function catchLogin(){
    var ov = document.getElementById('la-login');
    if(!ov) return false;
    ov.remove();
    try{ de.style.overflow = ''; }catch(_){}      // showLogin ล็อกไว้ ต้องปลดคืน
    msg('ยังไม่ได้เข้าสู่ระบบ',
        'เปิดระบบจองในแท็บใหม่เพื่อเข้าสู่ระบบก่อน แล้วกลับมากดโหลดใหม่',
        '<a href="' + location.pathname + '" target="_blank" rel="noopener">เข้าสู่ระบบ</a>'
        + '<button onclick="location.reload()">โหลดใหม่</button>');
    return true;
  }

  /* ── 2.5) §embedRO · ปิดทางเข้าโหมดลงมือ ────────────────────────────────
     ทับตัวฟังก์ชันแทนที่จะไล่ซ่อนปุ่มด้วย CSS อย่างเดียว เพราะปุ่มที่พาเข้าโหมด
     Van มีกระจายอยู่หลายที่ · แถวโหมด (.bt-c) · ชิปเตือนหัวตาราง (.t2-hd-warnchip)
     · ป้าย "↩ กลับคันเดิม" ในแต่ละแถว · ไล่ selector ให้ครบเป็นไปไม่ได้และพังทุกครั้ง
     ที่หน้าตาเปลี่ยน · ปิดที่ประตูเดียวจบ และทนต่อการแก้ UI ในอนาคต

     ฟังก์ชันพวกนี้ประกาศเป็น function ระดับบนสุดใน 08-app.js จึงอยู่บน window
     และ onclick= ใน HTML ก็หาเจอผ่าน window ตอนกด · ทับทีหลังได้ ไม่ต้องทับก่อน

     ⚠ ย้ำอีกครั้ง · นี่คือ UX ไม่ใช่ security · ห้ามเอาไปนับเป็นการจำกัดสิทธิ์ */
  var RO_FNS = ['bkV2ToggleVanMode','bkV2ToggleBoatMode','bkV2ToggleReconfirmMode','bkV2NewBooking','bkV2ZonePickOpen'];
  function roNotice(){
    var t = document.getElementById('la-embed-ro-t');
    if(!t){ t = document.createElement('div'); t.id = 'la-embed-ro-t';
      t.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:100002;'
        + 'background:#7A4A00;color:#fff;border-radius:20px;padding:8px 16px;opacity:0;transition:opacity .18s;'
        + 'font:13px/1.35 "DM Sans",-apple-system,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.25)';
      (document.body || de).appendChild(t); }
    t.textContent = '👁 หน้านี้เปิดไว้สำหรับดูอย่างเดียว';
    t.style.opacity = '1';
    clearTimeout(t._h); t._h = setTimeout(function(){ t.style.opacity = '0'; }, 2400);
  }
  function roLockDown(){
    RO_FNS.forEach(function(fn){ if(typeof window[fn] === 'function') window[fn] = roNotice; });
    // เผื่อโหมดค้างมาจากรอบก่อน · ต้องดับก่อนวาด ไม่งั้นโผล่เป็นตารางโหมดจัดรถ
    try{ _bkV2.boatAssignMode = false; _bkV2.vanAssignMode = false; _bkV2.reconfirmMode = false; }catch(_){}
  }

  // ── 3) พาไปหน้าที่สั่งมา ────────────────────────────────────────────────
  function applyView(){
    if(RO) roLockDown();
    if(catchLogin()) return;

    var el = document.querySelector('.nav-item[data-view="' + VIEW + '"]');
    if(!el){ msg('ไม่พบหน้าที่ขอ', 'view=' + VIEW + ' ไม่ตรงกับเมนูไหนเลย'); return; }

    // สิทธิ์ของผู้ใช้จริง ๆ อยู่ที่ laAllowed() · ไม่ใช่ที่การซ่อนเมนู
    if(typeof laAllowed === 'function' && !laAllowed(VIEW)){
      msg('ไม่มีสิทธิ์เข้าหน้านี้', 'บัญชีที่เข้าสู่ระบบอยู่ไม่ได้รับสิทธิ์หน้านี้ · ติดต่อ admin');
      return;
    }

    /* _bkV2 / _bkV2T2Cursor ประกาศด้วย const/let ที่ระดับบนสุดของ 08-app.js
       ของพวกนี้อยู่ใน global lexical scope ไม่ได้ไปเกาะ window
       (window._bkV2 = undefined เสมอ) จึงต้องอ้างชื่อตรง ๆ แบบนี้เท่านั้น */
    if(VIEW === 'booking'){
      try{
        _bkV2.detailId = null; _bkV2.newBooking = null; _bkV2.editingId = null;
        if(TAB) _bkV2.tab = TAB;
        if(DATE){ _bkV2.filterDate = DATE; _bkV2T2Cursor = DATE.slice(0, 7); }
        _bkV2.filterRoute = ROUTE || null;
      }catch(e){ try{ console.warn('[embed] booking state not ready:', e.message); }catch(_){} }
    }

    try{ el.click(); }catch(e){ try{ console.error('[embed] nav failed:', e); }catch(_){} }
  }

  /* เรียกซ้ำสามจังหวะโดยตั้งใจ · 01-auth-sync ตั้งนาฬิกา laApplyPerms ไว้ที่
     600ms ซึ่งจะคลิกเมนูตัวแรกที่มีสิทธิ์ทับ ถ้าหน้าที่ active อยู่ไม่ผ่านสิทธิ์
     ยิงซ้ำหลังจังหวะนั้นแล้วหน้าที่สั่งมาถึงจะอยู่ (_laRestoreView 850ms
     ถูกปิดไปแล้วด้วย window.__laEmbed) */
  function boot(){ applyView(); setTimeout(applyView, 700); setTimeout(applyView, 1000);
    try{ window.parent.postMessage({type:'la-embed-ready', view:VIEW, tab:TAB, date:DATE}, PARENT_ORIGIN); }catch(_){}
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(boot, 0); });
  else setTimeout(boot, 0);

  /* §embedMsg · ให้หน้าแม่สั่งเปลี่ยนวัน/แท็บได้โดยไม่ต้องโหลด iframe ใหม่
     โหลดใหม่ = ดาวน์โหลด JS ~2.2MB (gzip) + /api/load ทั้งก้อนอีกรอบ
     ไม่ต้องเช็ค origin ซ้ำที่นี่ · CSP frame-ancestors กันไว้แล้วว่าใครฝังได้
     เช็คแค่ว่ามาจากหน้าแม่จริง ไม่ใช่ iframe อื่นที่อยู่ในหน้าเดียวกัน
       parent: frame.contentWindow.postMessage({type:'la-embed',tab:'bytrip',date:'2026-09-20'}, 'https://rsvn.loveandaman.com') */
  window.addEventListener('message', function(e){
    if(e.source !== window.parent) return;
    var m = e.data;
    if(!m || m.type !== 'la-embed') return;
    if(m.view)  VIEW  = String(m.view);
    /* §embedTabNorm · ผ่านตัวแปลงชื่อ/ตัวกรองเดียวกับตอนอ่านจาก URL
       ชื่อไม่รู้จัก → '' → applyView ไม่แตะ _bkV2.tab = คงแท็บเดิม */
    if('tab'   in m) TAB   = normTab(m.tab);
    /* §embedTabNorm · วันที่จาก URL ถูก server.js ตรวจ regex มาแล้ว แต่ทาง
       postMessage ไม่มีใครตรวจ · ค่าเพี้ยนลง _bkV2.filterDate และ
       _bkV2T2Cursor = DATE.slice(0,7) ทำปฏิทินเพี้ยนตาม · ตรวจรูปแบบเดียวกัน */
    if('date'  in m){
      var _d = m.date ? String(m.date) : '';
      DATE = (!_d || /^\d{4}-\d{2}-\d{2}$/.test(_d)) ? _d : DATE;
    }
    if('route' in m) ROUTE = m.route ? String(m.route) : '';
    applyView();
  });
})();
