// Reusable in-app confirm modal (styled · replaces the native confirm() which can't be themed).
// bookingV2ConfirmModal({title, message, okText, cancelText, danger, onConfirm, onCancel})
function bookingV2ConfirmModal(opts){
  opts = opts || {};
  const _e = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const ex = document.getElementById('bkv2-confirm-modal'); if(ex) ex.remove();
  const danger = !!opts.danger;
  const accent = danger ? '#C0392B' : '#185FA5';
  const ov = document.createElement('div');
  ov.id = 'bkv2-confirm-modal';
  ov.style.cssText = "position:fixed;inset:0;z-index:100060;background:rgba(20,26,34,.42);display:flex;align-items:center;justify-content:center;padding:20px;font-family:'DM Sans',sans-serif;animation:bkv2cfIn .12s ease";
  ov.innerHTML =
    '<style>@keyframes bkv2cfIn{from{opacity:0}to{opacity:1}}@keyframes bkv2cfPop{from{transform:scale(.96);opacity:.4}to{transform:scale(1);opacity:1}}</style>'
    + '<div role="dialog" aria-modal="true" style="background:#fff;border-radius:16px;max-width:400px;width:100%;box-shadow:0 22px 64px rgba(0,0,0,.30);overflow:hidden;animation:bkv2cfPop .14s ease">'
      + '<div style="padding:22px 24px 8px">'
        + (opts.title ? '<div style="font-size:16px;font-weight:800;color:#1F2A44;margin-bottom:7px;display:flex;align-items:center;gap:9px"><span style="width:26px;height:26px;border-radius:50%;background:'+(danger?'#FCEBEB':'#E6F1FB')+';color:'+accent+';display:inline-flex;align-items:center;justify-content:center;font-size:15px;flex:none">'+(danger?'&#9888;':'&#63;')+'</span>'+_e(opts.title)+'</div>' : '')
        + '<div style="font-size:13.5px;color:#5a6472;line-height:1.55'+(opts.title?';padding-left:35px':'')+'">'+_e(opts.message||'')+'</div>'
      + '</div>'
      + '<div style="display:flex;gap:10px;justify-content:flex-end;padding:16px 22px 20px">'
        + '<button id="bkv2-cf-cancel" style="background:#fff;border:1px solid #d9dde3;color:#5a6472;border-radius:10px;padding:9px 18px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">'+_e(opts.cancelText||'Cancel')+'</button>'
        + '<button id="bkv2-cf-ok" style="background:'+accent+';border:none;color:#fff;border-radius:10px;padding:9px 20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">'+_e(opts.okText||'OK')+'</button>'
      + '</div>'
    + '</div>';
  document.body.appendChild(ov);
  const done = cb => { document.removeEventListener('keydown', kh); ov.remove(); if(typeof cb==='function') cb(); };
  const kh = e => { if(e.key==='Escape') done(opts.onCancel); else if(e.key==='Enter') done(opts.onConfirm); };
  document.addEventListener('keydown', kh);
  ov.querySelector('#bkv2-cf-cancel').onclick = () => done(opts.onCancel);
  ov.querySelector('#bkv2-cf-ok').onclick = () => done(opts.onConfirm);
  ov.onclick = e => { if(e.target===ov) done(opts.onCancel); };
  try{ ov.querySelector('#bkv2-cf-ok').focus(); }catch(e){}
}
