/* §mxRead · สีของช่องหนึ่ง · เทียบกับต่ำสุด-สูงสุดของแถวนั้น ไม่ใช่เกณฑ์ตายตัว
   วันเงียบของโปรแกรมใหญ่จึงดูเงียบจริง · แถวย่อยใช้สีเดียวกันแต่จางลง */
function bookingV2MxHeat(v, lo, hi, color, fade){
  var t = (hi<=lo) ? 0.55 : (0.14 + 0.72*((v-lo)/(hi-lo)));
  if(fade) t = t*0.45;
  return 'background:'+bookingV2Mix(color,t)+';color:'+((t>0.55 && !fade)?'#fff':'#26313B');
}
