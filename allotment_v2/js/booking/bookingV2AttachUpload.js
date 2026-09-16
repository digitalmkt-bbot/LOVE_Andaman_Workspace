function bookingV2AttachUpload(file,kind){
  const d=_bkV2.newBooking; if(!d||!file) return;
  const bid=bookingV2AttachDraftId(); if(!bid){ alert('เปิดฟอร์ม booking ก่อนแนบไฟล์'); return; }
  const post=(blob,mime,name)=>{ if(blob&&blob.size>6*1024*1024){ alert('ไฟล์ใหญ่เกิน 6MB · กรุณาย่อ/บีบอัดก่อน'); return; } const fr=new FileReader(); fr.onload=()=>{ const b64=String(fr.result).split(',')[1]||''; fetch('/api/attach',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({bookingId:bid,filename:name,mime:mime,dataB64:b64})}).then(r=>r.json()).then(j=>{ if(j&&j.error){ alert('อัปโหลดไม่สำเร็จ: '+j.error); return; } d.attachments=Array.isArray(d.attachments)?d.attachments:[]; d.attachments.push({id:j.id,name:j.filename,mime:j.mime,size:j.size,kind:kind||'upload',by:(window.LA_ME&&(LA_ME.name||LA_ME.username))||'',at:new Date().toISOString()}); bookingV2RefreshAttachSection(); }).catch(e=>alert('อัปโหลดไม่สำเร็จ: '+e.message)); }; fr.readAsDataURL(blob); };
  if(/^image\//.test(file.type||'')){ _bkV2DownscaleImage(file,2400,(b,m)=>{ if(b) post(b,m,((file.name||'image').replace(/\.[^.]+$/,''))+'.jpg'); else post(file,file.type,file.name||'image'); }); }
  else { post(file,file.type||'application/octet-stream',file.name||'file'); }
}
