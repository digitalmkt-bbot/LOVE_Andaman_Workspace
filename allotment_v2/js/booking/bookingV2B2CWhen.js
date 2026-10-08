function bookingV2B2CWhen(at){
  const d=new Date(at); if(isNaN(d)) return '';
  const hm=d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
  const min=Math.round((Date.now()-d.getTime())/60000);
  if(min<1) return hm+' (เมื่อสักครู่)';
  if(min<60) return hm+' ('+min+' นาทีที่แล้ว)';
  if(min<24*60) return hm+' ('+Math.round(min/60)+' ชม.ที่แล้ว)';
  return d.toLocaleDateString('en-GB',{day:'numeric',month:'short'})+' '+hm;
}
