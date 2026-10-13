// §splitOwn · กดชิปบุคกิ้งเดียวกัน → เลื่อนไปแถวอีกฝั่งแล้วกระพริบให้เห็น
function bookingV2SplitGo(key){
  if(!key) return;
  var tr=document.querySelector('#view-booking tr.t2-row[data-al="'+String(key).replace(/"/g,'')+'"]');
  if(!tr) return;
  try{ tr.scrollIntoView({block:'center',behavior:'smooth'}); }catch(_){ tr.scrollIntoView(); }
  tr.classList.remove('t2-splfl'); void tr.offsetWidth; tr.classList.add('t2-splfl');
  setTimeout(function(){ tr.classList.remove('t2-splfl'); }, 1700);
}
