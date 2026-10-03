/* คืนลำดับเป็นเลขกรุ๊ป · ไว้ให้กดตอนลากมั่วแล้วอยากเริ่มใหม่ */
function bookingV2GrpOrderReset(date, routeId, zone){
  if(!confirm('Reset group order to group number?')) return;
  bookingV2GrpOrderSet(date, routeId, zone, []);
  if(typeof bookingV2RenderKeep==='function') bookingV2RenderKeep(); else bookingV2Render();
}
