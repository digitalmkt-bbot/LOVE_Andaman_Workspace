function bookingV2AgentDDStats(){
  var list=(typeof SB_BOOKINGS!=='undefined' && Array.isArray(SB_BOOKINGS)) ? SB_BOOKINGS : [];
  var me=String((typeof bookingV2LoginUser==='function'?bookingV2LoginUser():'')||'').trim().toLowerCase();
  var now=Date.now();
  if(_bkAgDDCache && _bkAgDDCache.n===list.length && _bkAgDDCache.me===me && (now-_bkAgDDCache.at)<60000) return _bkAgDDCache;
  var ts=function(b){ var v=b.createdAt||b.confirmedAt||b.bookingDate||''; var t=(typeof v==='number')?v:Date.parse(v); return isNaN(t)?0:t; };
  var bad={cancelled:1,cancelled_weather:1,rejected:1};
  var recentAt={}, cnt={}, since=now-30*86400000;
  for(var i=0;i<list.length;i++){
    var b=list[i]; if(!b||!b.agentId) continue;
    var t=ts(b);
    if(me && String(b.confirmedBy||'').trim().toLowerCase()===me){ if(!recentAt[b.agentId] || t>recentAt[b.agentId]) recentAt[b.agentId]=t; }
    if(!bad[b.status] && t>=since) cnt[b.agentId]=(cnt[b.agentId]||0)+1;
  }
  var recent=Object.keys(recentAt).sort(function(a,b){ return recentAt[b]-recentAt[a]; }).slice(0,10);
  var inRecent={}; recent.forEach(function(id){ inRecent[id]=1; });
  var top=Object.keys(cnt).filter(function(id){ return !inRecent[id]; }).sort(function(a,b){ return cnt[b]-cnt[a]; }).slice(0,5);
  _bkAgDDCache={ n:list.length, me:me, at:now, recent:recent, recentAt:recentAt, top:top, cnt:cnt };
  return _bkAgDDCache;
}
