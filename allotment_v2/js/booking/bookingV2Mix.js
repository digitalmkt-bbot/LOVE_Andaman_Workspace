// Intensity classes
/* §mxRead · ผสมสีประจำโปรแกรมกับขาว · t=0 ขาว · t=1 สีเต็ม */
function bookingV2Mix(hex, t){
  var h=String(hex||'#5B6670').replace('#','');
  if(h.length===3) h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  if(!/^[0-9a-f]{6}$/i.test(h)) h='5B6670';
  var p=function(i){ return parseInt(h.substr(i*2,2),16); };
  var f=function(i){ return Math.round(255+(p(i)-255)*t); };
  return 'rgb('+f(0)+','+f(1)+','+f(2)+')';
}
