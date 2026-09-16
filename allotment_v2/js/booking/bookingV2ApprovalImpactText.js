function bookingV2ApprovalImpactText(imp){
  if(!imp.length) return '';
  return '\n\nที่นั่งหลังอนุมัติ:\n' + imp.map(function(o){
    return o.overLic>0 ? ('  \u26a0 '+o.name+' '+o.date+' \u00b7 '+o.need+' ที่ \u2014 เกินทะเบียนเรือ '+o.overLic+' ที่ (ไม่มีที่นั่งจริง)')
         : o.overCap>0 ? ('  \u26a0 '+o.name+' '+o.date+' \u00b7 '+o.need+' ที่ \u2014 เกินโควต้าบริษัท '+o.overCap+' ที่ (ยังอยู่ในทะเบียนเรือ)')
         : ('  \u2713 '+o.name+' '+o.date+' \u00b7 '+o.need+' ที่ \u2014 ที่นั่งพอ (เหลือ '+(o.sellable-o.need)+')');
  }).join('\n');
}
