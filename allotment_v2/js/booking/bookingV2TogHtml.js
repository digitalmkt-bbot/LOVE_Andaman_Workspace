/* §togCompact · owner "ขอให้กระชับกว่านี้หน่อย" · popup เหลือแถวละบรรทัดเดียว [ไอคอน · จำนวน · ชื่อ · โซน/รถ · ›]
   รายละเอียดเต็ม (จุดรับ ฯลฯ) อยู่ใน title ของแต่ละบรรทัด · ตัดบรรทัดท้าย (Pay/Total) ออก */
function bookingV2TogHtml(bkId, date, curKey){
  var esc = function(v){ return String(v==null?'':v).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  var b = (SB_BOOKINGS||[]).find(function(x){ return x.id === bkId; }); if(!b) return '';
  var O = (typeof bkOpsRead === 'function') ? bkOpsRead(b, date) : (b.ops||{});
  var sp = Array.isArray(O.vanSplits) ? O.vanSplits : []; if(sp.length < 2) return '';
  var t = (b.trips||[]).find(function(x){ return x && x.date === date; }) || {};
  var z = ((typeof bookingV2EffZone === 'function') ? bookingV2EffZone(b, t) : (t.zone||b.pickupZone)) || 'NoTransfer';
  var zl = function(k){ return (typeof bookingV2ZoneLabel === 'function') ? bookingV2ZoneLabel(k) : k; };
  var code = (/^b2c_/.test(String(b.id)) && typeof bookingV2DisplayCode === 'function') ? bookingV2DisplayCode(b) : (b.voucherRef || '');
  var tot = 0;
  var li = sp.map(function(s, i){
    var self = (typeof bookingV2SplitIsSelf === 'function') && bookingV2SplitIsSelf(s);
    var p = (typeof bkSplitPax === 'function') ? bkSplitPax(s) : null;
    var n = (p && typeof bkPaxSum === 'function') ? bkPaxSum(p) : 0; if(!n) n = +s.pax || 0; tot += n;
    var main = !!s.main || i === 0;
    var who = main ? (b.leadPax || b.customerName || '') : String(s.altWho||'').trim();
    var ar = (s.pickAreaId && typeof bookingV2GetArea === 'function') ? bookingV2GetArea(s.pickAreaId) : null;
    var place = (main || (!s.pickHotel && !s.pickAreaId)) ? (b.hotelName || b.pickup || '') : (s.pickHotel || (ar ? ar.name : ''));
    place = String(place||'').replace(/\s*\((?:self[- ]?arrive|มาเอง)[^)]*\)\s*$/i, '');
    var zone = zl((!main && s.pickZone) ? s.pickZone : z);
    var van = s.vanId && typeof vehGet === 'function' ? ((vehGet(s.vanId)||{}).name || s.vanId) : '';
    var meta = self ? laT('มาเอง') : (zone + (van ? (' · ' + van) : ''));
    var tip = n + ' ' + laT('คน') + (who ? (' · ' + who) : '') + ' · ' + (self ? laT('มาเองที่ท่า') : ((van ? (laT('ขึ้นรถ') + ' ' + van) : laT('ขึ้นรถ · ยังไม่เลือกรถ')) + ' · ' + zone + (place ? (' · ' + place) : '')));
    var key = b.id + '@' + i, here = (key === curKey);
    return '<div class="tg-li'+(here?' here':'')+'" title="'+esc(tip)+'">'
      + '<span class="tg-ic">'+(self?'&#128694;':'&#128656;')+'</span>'
      + '<b class="tg-n">'+n+'</b>'
      + '<span class="tg-nm">'+esc(who||'—')+'</span>'
      + '<span class="tg-m">'+esc(meta)+'</span>'
      + (here ? '<span class="tg-here">'+laT('แถวนี้')+'</span>'
              : '<button type="button" class="tg-go" title="'+laT('ไปที่แถว')+'" onclick="event.stopPropagation();bookingV2TogHide(true);bookingV2SplitGo(\''+esc(key)+'\')">&rsaquo;</button>')
      + '</div>';
  }).join('');
  return '<div class="tg-h"><span class="tg-chip">&#128101; Together</span>'
    + '<span class="tg-hd" title="'+esc(laT('บุคกิ้งเดียวกัน')+(code?(' '+code):'')+' · '+laT('เงิน · ใบวางบิล เป็นใบเดียว · Pay / Total อยู่ที่แถวแรก'))+'"><b>'+esc(b.leadPax||code||'')+'</b><i>'+tot+' '+laT('คน')+'</i></span></div>'
    + li;
}
