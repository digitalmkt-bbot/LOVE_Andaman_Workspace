function bookingV2AgentDDWhen(t){
  if(!t) return '';
  var d=new Date(t), n=new Date();
  var ymd=function(x){ return x.getFullYear()*10000+(x.getMonth()+1)*100+x.getDate(); };
  var p2=function(x){ return (x<10?'0':'')+x; };
  if(ymd(d)===ymd(n)) return 'today '+p2(d.getHours())+':'+p2(d.getMinutes());
  var y=new Date(n.getFullYear(),n.getMonth(),n.getDate()-1);
  if(ymd(d)===ymd(y)) return 'yesterday';
  return d.getDate()+' '+['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]+(d.getFullYear()!==n.getFullYear()?(' '+d.getFullYear()):'');
}
