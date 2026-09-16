// คะแนนความเหมือน · ชุดคำเหมือนกันแค่ไหน (Dice) ผสมกับตัวอักษรที่ตรงกันจากหัว
function bookingV2HotelSim(a,b){
  var ka=bookingV2HotelKey(a), kb=bookingV2HotelKey(b);
  if(!ka || !kb) return 0;
  if(ka===kb) return 1;
  var ta=ka.split(' '), tb=kb.split(' ');
  var m={}; ta.forEach(function(w){ m[w]=(m[w]||0)+1; });
  var hit=0; tb.forEach(function(w){ if(m[w]>0){ m[w]--; hit++; } });
  var dice=(2*hit)/(ta.length+tb.length);
  // คำที่ไม่ตรงเป๊ะแต่ขึ้นต้นเหมือนกัน (พิมพ์ตกท้าย) ให้คะแนนบางส่วน
  var pre=0, sa=ka.replace(/ /g,''), sb=kb.replace(/ /g,'');
  var n=Math.min(sa.length,sb.length); for(var i=0;i<n;i++){ if(sa[i]!==sb[i]) break; pre++; }
  var prefix=pre/Math.max(sa.length,sb.length);
  return Math.max(dice, dice*0.75+prefix*0.25);
}
