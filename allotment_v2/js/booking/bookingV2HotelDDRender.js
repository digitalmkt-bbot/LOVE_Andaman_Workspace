function bookingV2HotelDDRender(val){
  var dd=document.getElementById('bkv2-hotel-dd'); if(!dd) return;
  var q=String(val||'').trim().toLowerCase();
  var nb=(typeof _bkV2!=='undefined'&&_bkV2.newBooking)?_bkV2.newBooking:null;
  var zone=nb?(nb.pickupZoneFilter||''):'';
  var areaId=nb?(nb.pickupAreaId||''):'';
  var areaName=(areaId&&typeof bookingV2GetArea==='function')?((bookingV2GetArea(areaId)||{}).name||''):'';
  // 3 tiers: hotels seen in THIS pickup area (first) → hotels in this zone → all others (free-text, never blocked)
  var areaList=areaId?bookingV2HotelNameList(null,areaId):[];
  var zoneList=(zone&&zone!=='NoTransfer'&&zone!=='NT')?bookingV2HotelNameList(zone):[];
  var all=bookingV2HotelNameList();
  var _qk=(typeof bookingV2HotelKey==='function')?bookingV2HotelKey(q):'';
  var _qt=_qk?_qk.split(' ').filter(Boolean):[];
  var match=function(s){
    if(!q) return true;
    if(s.toLowerCase().indexOf(q)!==-1) return true;
    if(!_qt.length || typeof bookingV2HotelKey!=='function') return false;
    var st=bookingV2HotelKey(s).split(' ');
    return _qt.every(function(w){ return st.some(function(x){ return x.indexOf(w)===0; }); });
  };
  var esc=function(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');};
  var seen={};
  var take=function(list,tier){ var out=[]; list.forEach(function(s){ var k=s.toLowerCase(); if(seen[k]||!match(s))return; seen[k]=1; out.push({s:s,tier:tier}); }); return out; };
  var combined=take(areaList,'area').concat(take(zoneList,'zone')).concat(take(all,'other'));
  // §hotelDedupe · ชื่อที่พิมพ์ยังไม่มีในระบบ → เสนอแถว "เพิ่มโรงแรมใหม่" ให้กดยืนยัน
  //   ไม่บล็อกการพิมพ์ แต่บังคับให้เห็นชื่อเดิมก่อนเสมอ · คนจะเลือกของเดิมมากกว่าสร้างใหม่
  var typed=String(val||'').replace(/\s+/g,' ').trim();
  var exact=typed && all.some(function(x){ return x.toLowerCase()===typed.toLowerCase(); });
  var addRow='';
  if(typed.length>=3 && !exact){
    var near=(typeof bookingV2HotelNear==='function')?bookingV2HotelNear(typed, null, areaId, zone):null;
    addRow='<div class="bkv2-nb-dd-item" data-label="'+esc(typed)+'"'
      +' onmousedown="event.preventDefault();bookingV2HotelDDPick(this.dataset.label,1)">'
      +'<span class="bkv2-nb-dd-mkt" style="background:#E1F5EE;color:#0F6E56">ใหม่</span>'
      +'<span class="bkv2-nb-dd-name">&#65291; เพิ่มโรงแรมใหม่: <b>'+esc(typed)+'</b>'
      +(near?('<span style="color:#A05A1A;font-weight:600"> &middot; คล้ายกับ '+esc(near.name)+'</span>'):'')
      +'</span></div>';
  }
  if(combined.length===0 && !addRow){ dd.classList.remove('open'); dd.innerHTML=''; return; }
  combined=combined.slice(0,50);
  if(_bkV2HotelDDActive>combined.length-1) _bkV2HotelDDActive=combined.length-1;
  var zlbl=zone==='PK'?'PK':zone==='KL'?'KL':zone;
  dd.innerHTML=addRow+combined.map(function(o,i){
    var badge = o.tier==='area' ? ('<span class="bkv2-nb-dd-mkt" style="background:#E1F0FA;color:#1683C7" title="เคยใช้ในพื้นที่ '+esc(areaName)+'">'+esc(areaName||'AREA')+'</span>')
      : o.tier==='zone' ? ('<span class="bkv2-nb-dd-mkt" style="background:#EAF1FA;color:#5685B5">'+esc(zlbl)+'</span>')
      : '<span class="bkv2-nb-dd-mkt" style="background:#EEEDEA;color:#9a988f">HOTEL</span>';
    return '<div class="bkv2-nb-dd-item'+(i===_bkV2HotelDDActive?' active':'')+'" data-label="'+esc(o.s)+'" onmousedown="event.preventDefault();bookingV2HotelDDPick(this.dataset.label)">'
      +badge+'<span class="bkv2-nb-dd-name">'+esc(o.s)+'</span></div>';
  }).join('');
  dd.classList.add('open');
}
