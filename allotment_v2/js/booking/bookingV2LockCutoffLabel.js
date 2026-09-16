// Human label of the rolling cutoff rule · '' when none
function bookingV2LockCutoffLabel(l){
  if(!l || ((l.releaseDaysBefore==null||l.releaseDaysBefore==='') && !l.releaseTime)) return '';
  const d = Math.max(0, parseInt(l.releaseDaysBefore,10)||0);
  const t = l.releaseTime || '18:00';
  return 'ปล่อย '+(d===0?'วันเดินทาง':(d+' วันก่อน'))+' '+t;
}
