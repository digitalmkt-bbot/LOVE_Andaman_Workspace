function bookingV2ExtraPickSlip(inp){
  var f=(inp&&inp.files&&inp.files[0])||null; if(inp) inp.value='';
  if(!f) return;
  if(typeof pckSlipUpload!=='function'){ alert('อัปโหลดสลิปไม่ได้ในหน้านี้'); return; }
  pckSlipUpload(f, (_bkxPayBkId||_bkExtraBk), function(meta){ _bkExtraPay.slips.push(meta); bookingV2ExtraPayRender(); });
}
