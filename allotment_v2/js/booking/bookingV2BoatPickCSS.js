function bookingV2BoatPickCSS(){
  if(document.getElementById('bpk2-css')) return;
  const st=document.createElement('style'); st.id='bpk2-css';
  st.textContent=[
    /* §bpk3 · owner "ให้ดูกระชับกว่านี้" · กว้าง 260 · หัวสองบรรทัดเล็ก · เรือแถวละบรรทัด 30px · ปุ่มท้ายเล็ก */
    '#bkv2-boatpick .bpk{position:fixed;width:260px;max-width:92vw;background:#fff;border-radius:10px;box-shadow:0 10px 30px rgba(15,27,61,.22),0 0 0 1px rgba(15,27,61,.08);overflow:hidden;font-family:"DM Sans",sans-serif;color:#0F1B3D}',
    '#bkv2-boatpick .bpk-h{display:flex;align-items:flex-start;gap:6px;background:#0B1E5B;color:#fff;padding:6px 6px 6px 10px}',
    '#bkv2-boatpick .bpk-h .x{flex:none;background:transparent;border:0;color:#B9C6E8;font-size:16px;line-height:1;cursor:pointer;padding:0 3px}',
    '#bkv2-boatpick .bpk-h .x:hover{color:#fff}',
    '#bkv2-boatpick .bpk-who{flex:1;display:flex;flex-direction:column;min-width:0}',
    '#bkv2-boatpick .bpk-who>b{font-size:12.5px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '#bkv2-boatpick .bpk-who>span{font-size:10.5px;line-height:1.3;color:#C9D4F0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '#bkv2-boatpick .bpk-who em{font-style:normal;background:rgba(255,255,255,.16);color:#fff;border-radius:5px;padding:0 4px}',
    '#bkv2-boatpick .bpk-l{max-height:40vh;overflow-y:auto}',
    '#bkv2-boatpick .bpk-b{display:grid;grid-template-columns:20px minmax(0,1fr) auto 34px 10px;align-items:center;gap:6px;height:30px;padding:0 8px 0 10px;border-top:1px solid #EEF0F3;cursor:pointer}',
    '#bkv2-boatpick .bpk-l>.bpk-b:first-child{border-top:0}',
    '#bkv2-boatpick .bpk-b:hover{background:#F4F7FC}',
    '#bkv2-boatpick .bpk-b.on{background:#EEF8F3}',
    '#bkv2-boatpick .bpk-b .av{width:20px;height:20px;border-radius:50%;color:#fff;font:700 8px/20px "DM Mono",monospace;text-align:center}',
    '#bkv2-boatpick .bpk-b .nm{display:flex;align-items:baseline;gap:5px;min-width:0}',
    '#bkv2-boatpick .bpk-b .nm b{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '#bkv2-boatpick .bpk-b .nm i{flex:none;font-style:normal;font-size:9.5px;color:#9AA0AC}',
    '#bkv2-boatpick .bpk-b em{font-style:normal;font:500 10px "DM Mono",monospace;color:#5B6478;white-space:nowrap;text-align:right}',
    '#bkv2-boatpick .bpk-b em b{color:#0F1B3D}',
    '#bkv2-boatpick .bpk-b em.ov,#bkv2-boatpick .bpk-b em.ov b{color:#C62828}',
    '#bkv2-boatpick .bpk-b .bar{position:relative;height:4px;border-radius:2px;background:#E9ECF2;overflow:hidden}',
    '#bkv2-boatpick .bpk-b .bar s{position:absolute;left:0;top:0;bottom:0;border-radius:2px}',
    '#bkv2-boatpick .bpk-b .ck{color:#0F6E56;font-weight:800;font-size:11px}',
    '#bkv2-boatpick .bpk-b.hard .nm b{color:#9AA0AC}',
    '#bkv2-boatpick .bpk-none{padding:12px 10px;text-align:center;color:#A32D2D;font-size:11.5px;line-height:1.5}',
    '#bkv2-boatpick .bpk-none span{color:#8a8a82}',
    '#bkv2-boatpick .bpk-act{display:flex;gap:4px;padding:5px 6px;border-top:1px solid #E6E9EF;background:#FAFBFD}',
    '#bkv2-boatpick .bpk-act button{flex:1 1 0;min-width:0;border:1px solid #D5DCE8;background:#fff;color:#1B2A55;border-radius:6px;padding:3px 4px;font:600 10.5px "DM Sans",sans-serif;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '#bkv2-boatpick .bpk-act button:hover{background:#EEF3FB;border-color:#9DBCE3}',
    '#bkv2-boatpick .bpk-act button.on{background:#F3EEFE;border-color:#C7B8E8;color:#5B289A}',
    '#bkv2-boatpick .bpk-act button.un{flex:0 0 auto;color:#A32D2D;border-color:#F0CFCB;padding:3px 7px}',
    '#bkv2-boatpick .bpk-act button.un:hover{background:#FDECEA}',
    /* ช่องเรือที่กำลังเลือก */
    'td.bpk-cell{background:#FFF6D6!important;box-shadow:inset 0 0 0 2px #F2B705!important}'
  ].join('\n');
  document.head.appendChild(st);
}
