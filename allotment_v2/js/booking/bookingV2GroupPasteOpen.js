// ── Group paste · fill a big group (30-40 pax) at once from a pasted name list ──
function bookingV2GroupPasteOpen(){
  if(!_bkV2.newBooking || document.getElementById('bkv2-grouppaste')) return;
  const html=`<div id="bkv2-grouppaste" style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:400;display:flex;align-items:flex-start;justify-content:center;padding:50px 20px;overflow-y:auto" onclick="if(event.target===this)bookingV2GroupPasteClose()">
    <div style="background:#fff;border-radius:12px;width:520px;max-width:100%;box-shadow:0 20px 60px rgba(0,0,0,.25);overflow:hidden">
      <div style="padding:16px 20px;border-bottom:1px solid #e8e8e8;display:flex;align-items:center;justify-content:space-between"><div><div style="font-size:15px;font-weight:700;color:#185FA5">Paste group list</div><div style="font-size:11px;color:#888">One name per line · add nationality after a comma (e.g. Ivan Petrov, RU)</div></div><button onclick="bookingV2GroupPasteClose()" style="background:transparent;border:none;font-size:20px;color:#888;cursor:pointer">✕</button></div>
      <div style="padding:16px 20px">
        <textarea id="bkv2-grouppaste-ta" rows="12" placeholder="Ivan Petrov, RU&#10;Anna Ivanova, RU&#10;John Smith, GB&#10;..." style="width:100%;font-size:12.5px;font-family:inherit;border:1px solid #ccc;border-radius:8px;padding:10px;box-sizing:border-box;resize:vertical"></textarea>
        <div style="font-size:11px;color:#888;margin-top:8px;line-height:1.55">คนแรก = Lead · ทุกคนนับเป็นผู้ใหญ่ (เด็ก/ทารกปรับจำนวนทีหลังได้) · ระบบจะตั้งจำนวน AD ให้อัตโนมัติตามจำนวนบรรทัด และเติมชื่อ+สัญชาติทุกแถวให้</div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px"><button onclick="bookingV2GroupPasteClose()" style="background:#fff;border:1px solid #ccc;color:#333;font-family:inherit;font-size:12px;padding:9px 15px;border-radius:9px;cursor:pointer">ยกเลิก</button><button onclick="bookingV2GroupPasteApply()" style="background:#185FA5;color:#fff;border:none;font-family:inherit;font-size:12px;font-weight:600;padding:9px 18px;border-radius:9px;cursor:pointer">เติมรายชื่อ</button></div>
      </div>
    </div></div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  setTimeout(()=>{ const ta=document.getElementById('bkv2-grouppaste-ta'); if(ta) ta.focus(); },40);
}
