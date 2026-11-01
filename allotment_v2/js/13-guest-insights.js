/* ══ §guestIns (2026-11-01) · Overview › Guest Insights · ลูกค้าของเรามาจากไหน ══
   owner "เรามีรายละเอียด ลค บางส่วนแล้ว หน้า Overview ควรมี และเอาข้อมูลที่มีมาวิเคราะห์เป็นอีกฐานข้อมูลนึง ทั้งสัญชาติ ทั้งช่วงอายุ ทั้ง Generation"
         + "ควรมีแผนที่โลกด้วย และให้เห็นการกระจายของสัญชาติ" + "ดึงสีอื่นมาใช้เพิ่ม ให้มันดูสดใสขึ้น"
   อ่านอย่างเดียว · ไม่มีที่เก็บใหม่ · ไม่แก้ booking
   ที่มา: รายชื่อใน booking (lead + passengers) + ค่าที่แก้ทับในหน้า Insurance (insEff · อายุ/สัญชาติ)
   หนึ่งคน = หนึ่งแถวต่อ booking (ทริปแรกของ booking ที่อยู่ในช่วงที่เลือก) · นับเฉพาะทริปที่เดินทางแล้ว (≤ วันนี้) และไม่ยกเลิก
   รหัสสัญชาติในระบบมีซ้ำหลายแบบ (DE/DEU/GER · US/USA · GB/GBR/UK/ENG …) → GI_FIX รวมเป็น ISO2 ก่อนนับ
   แผนที่: js/world110.js (Natural Earth 110m) โหลดตอนเปิดหน้านี้ครั้งแรก ไม่ถ่วงหน้าอื่น */
var _giPeriod='year', _giPier='', _giFam='', _giAllNat=false, _giLoading=false;
var GI_FIX={DEU:'DE',GER:'DE',USA:'US',GBR:'GB',UK:'GB',ENG:'GB',SCO:'GB',IRE:'IE',NLD:'NL',HOL:'NL',UAE:'AE',AUS:'AU',FRA:'FR',NIG:'NG',NGN:'NG',NGA:'NG',
  MAC:'MK',LIT:'LT',GHA:'GH',MOR:'MA',MAR:'MA',DEN:'DK',DNK:'DK',PSE:'PS',ATG:'AG',IRA:'IQ',IRQ:'IQ',EST:'EE',JOR:'JO',SWE:'SE',ESP:'ES',SUD:'SD',SDN:'SD',
  KGZ:'KG',MAU:'MU',ETH:'ET',OMR:'OM',OMN:'OM',TUN:'TN',CAN:'CA',MON:'MN',BGD:'BD',CHN:'CN',MOZ:'MZ',KEK:'KE',KAN:'KE',BHR:'BH',CMR:'CM',FJI:'FJ',NAM:'NA',
  COS:'CR',AND:'AD',SOU:'ZA',SYR:'SY',BAR:'BB',CUB:'CU',IDN:'ID',HKG:'HK',ISL:'IS',DOM:'DO',ECU:'EC',UGA:'UG',MMR:'MM',GRE:'GD',RUS:'RU',THA:'TH',IND:'IN',
  KOR:'KR',JPN:'JP',ITA:'IT',POL:'PL',ISR:'IL',KAZ:'KZ',SGP:'SG',MYS:'MY',PHL:'PH',VNM:'VN',TWN:'TW',NZL:'NZ',ZAF:'ZA',EGY:'EG',TUR:'TR',SAU:'SA',CHE:'CH',
  AUT:'AT',BEL:'BE',NOR:'NO',FIN:'FI',PRT:'PT',GRC:'GR',CZE:'CZ',HUN:'HU',ROU:'RO',UKR:'UA',BRA:'BR',ARG:'AR',MEX:'MX',PAK:'PK',QAT:'QA',KWT:'KW',LKA:'LK'};
var GI_REG={
  eu:'RU GB DE ES FR DK NL IE IT PL RO UA CZ NO BE SE RS CH GR LT LV SK AT EE FI PT HU HR BY IS MK AD BG SI BA ME AL MD LU MT CY XK',
  as:'TH IN CN KR KZ JP PK SG MY ID PH TW VN HK LK UZ MM KG LA MN BD KH NP GE AM AZ TJ TM BT MV BN TL MO AF',
  me:'SA IL EG TR OM KW JO QA AE BH LB PS IQ IR SY YE',
  am:'US MX CA AR BR CO PE CL CU DO JM EC AG BB GD CR PA GT HN SV NI VE UY PY BO TT BS HT PR',
  oc:'AU NZ FJ PG WS TO VU',
  af:'ZA NG GH MA SD MU ET TN MZ KE CM NA UG TZ RW DZ LY SN CI ZW ZM BW AO MG SC'};
var GI_REG_META=[['eu','ยุโรป','#6366F1'],['as','เอเชีย','#F43F5E'],['me','ตะวันออกกลาง','#F59E0B'],['am','อเมริกา','#10B981'],['oc','โอเชียเนีย','#06B6D4'],['af','แอฟริกา','#A855F7']];
var GI_GENS=[['Gen Alpha',2013,9999,'#FACC15'],['Gen Z',1997,2012,'#EC4899'],['Millennials',1981,1996,'#7C3AED'],['Gen X',1965,1980,'#06B6D4'],['Boomers',0,1964,'#10B981']];
var GI_BANDS=[[0,11,'0–11'],[12,17,'12–17'],[18,24,'18–24'],[25,34,'25–34'],[35,44,'35–44'],[45,54,'45–54'],[55,64,'55–64'],[65,200,'65+']];
var GI_STOPS=[[0,[254,240,138]],[0.3,[251,146,60]],[0.6,[236,72,153]],[0.85,[124,58,237]],[1,[49,46,129]]];

/* §giTheme · ชุดสีของหน้า (2026-11-01) */
var GI_THEMES={
  sunset:{name:'Sunset', hero:'linear-gradient(115deg,#1E1B4B 0%,#4C1D95 48%,#9D174D 100%)', ink:'#1E1B4B',
    ramp:[[0,[254,240,138]],[0.3,[251,146,60]],[0.6,[236,72,153]],[0.85,[124,58,237]],[1,[49,46,129]]], deep:'#3B0764',
    kpi:['#FDE047','#FB923C','#F472B6','#A78BFA','#22D3EE'], btn:'#FDE047', btnInk:'#1E1B4B',
    reg:['#6366F1','#F43F5E','#F59E0B','#10B981','#06B6D4','#A855F7'], gen:['#FACC15','#EC4899','#7C3AED','#06B6D4','#10B981'],
    bar:'linear-gradient(90deg,#F472B6,#7C3AED)', age:'linear-gradient(180deg,#FDBA74,#F472B6)', agePeak:'linear-gradient(180deg,#EC4899,#7C3AED)',
    bub:'rgba(76,29,149,.30)', pin:['#06B6D4','rgba(6,182,212,.28)','#0E7490'], mx:268, soft:'#F3E8FF', softInk:'#6D28D9', sub:'#D8CCF5', sub2:'#E6DDF8'},
  andaman:{name:'Andaman', hero:'linear-gradient(115deg,#082F49 0%,#0E7490 55%,#0D9488 100%)', ink:'#082F49',
    ramp:[[0,[207,250,254]],[0.3,[94,234,212]],[0.6,[34,211,238]],[0.85,[2,132,199]],[1,[30,58,138]]], deep:'#0C4A6E',
    kpi:['#FDE68A','#5EEAD4','#7DD3FC','#FDA4AF','#C4B5FD'], btn:'#FDE68A', btnInk:'#082F49',
    reg:['#0284C7','#F97316','#FACC15','#10B981','#14B8A6','#E11D48'], gen:['#FDE047','#22D3EE','#0369A1','#F97316','#10B981'],
    bar:'linear-gradient(90deg,#22D3EE,#0369A1)', age:'linear-gradient(180deg,#99F6E4,#22D3EE)', agePeak:'linear-gradient(180deg,#0EA5E9,#1E3A8A)',
    bub:'rgba(12,74,110,.30)', pin:['#F97316','rgba(249,115,22,.30)','#C2410C'], mx:199, soft:'#E0F2FE', softInk:'#0369A1', sub:'#BAE6FD', sub2:'#E0F2FE'},
  tropical:{name:'Tropical', hero:'linear-gradient(115deg,#052E16 0%,#047857 50%,#65A30D 100%)', ink:'#052E16',
    ramp:[[0,[254,249,195]],[0.3,[190,242,100]],[0.6,[52,211,153]],[0.85,[13,148,136]],[1,[19,78,74]]], deep:'#134E4A',
    kpi:['#FDE047','#FDBA74','#86EFAC','#F9A8D4','#67E8F9'], btn:'#FDE047', btnInk:'#052E16',
    reg:['#059669','#F97316','#EAB308','#0EA5E9','#14B8A6','#DB2777'], gen:['#FDE047','#84CC16','#059669','#F97316','#0EA5E9'],
    bar:'linear-gradient(90deg,#A3E635,#059669)', age:'linear-gradient(180deg,#D9F99D,#34D399)', agePeak:'linear-gradient(180deg,#10B981,#115E59)',
    bub:'rgba(19,78,74,.30)', pin:['#F43F5E','rgba(244,63,94,.28)','#BE123C'], mx:160, soft:'#ECFCCB', softInk:'#3F6212', sub:'#BBF7D0', sub2:'#DCFCE7'},
  coral:{name:'Coral reef', hero:'linear-gradient(115deg,#4C0519 0%,#BE123C 50%,#F97316 100%)', ink:'#4C0519',
    ramp:[[0,[255,237,213]],[0.3,[253,186,116]],[0.6,[249,115,22]],[0.85,[225,29,72]],[1,[136,19,55]]], deep:'#881337',
    kpi:['#FDE68A','#FDBA74','#FDA4AF','#F0ABFC','#99F6E4'], btn:'#FFFFFF', btnInk:'#BE123C',
    reg:['#E11D48','#F97316','#FBBF24','#14B8A6','#0EA5E9','#8B5CF6'], gen:['#FBBF24','#FB7185','#BE123C','#14B8A6','#6366F1'],
    bar:'linear-gradient(90deg,#FDBA74,#E11D48)', age:'linear-gradient(180deg,#FED7AA,#FB923C)', agePeak:'linear-gradient(180deg,#F43F5E,#881337)',
    bub:'rgba(136,19,55,.28)', pin:['#0EA5E9','rgba(14,165,233,.30)','#0369A1'], mx:350, soft:'#FFE4E6', softInk:'#BE123C', sub:'#FECDD3', sub2:'#FFE4E6'},
  love:{name:'LOVE Andaman', hero:'linear-gradient(115deg,#1B2A55 0%,#2B3F7A 55%,#FF6B47 100%)', ink:'#1B2A55',
    ramp:[[0,[255,232,224]],[0.3,[255,177,153]],[0.6,[255,107,71]],[0.85,[200,62,40]],[1,[27,42,85]]], deep:'#1B2A55',
    kpi:['#FF6B47','#FFB199','#7DD3FC','#FDE68A','#A7F3D0'], btn:'#FF6B47', btnInk:'#FFFFFF',
    reg:['#1B2A55','#FF6B47','#F59E0B','#10B981','#38BDF8','#A855F7'], gen:['#FDE68A','#FFB199','#FF6B47','#2B3F7A','#38BDF8'],
    bar:'linear-gradient(90deg,#FFB199,#FF6B47)', age:'linear-gradient(180deg,#FFD7C9,#FFB199)', agePeak:'linear-gradient(180deg,#FF6B47,#C83E28)',
    bub:'rgba(27,42,85,.28)', pin:['#38BDF8','rgba(56,189,248,.30)','#0369A1'], mx:14, soft:'#FFE8E0', softInk:'#C83E28', sub:'#C9D4F0', sub2:'#E2E8F7'},
  night:{name:'Night', hero:'linear-gradient(115deg,#020617 0%,#1E1B4B 55%,#312E81 100%)', ink:'#020617',
    ramp:[[0,[224,231,255]],[0.3,[165,180,252]],[0.6,[129,140,248]],[0.85,[192,38,211]],[1,[112,26,117]]], deep:'#3B0764',
    kpi:['#A5B4FC','#F0ABFC','#67E8F9','#FDE68A','#86EFAC'], btn:'#A5B4FC', btnInk:'#020617',
    reg:['#6366F1','#D946EF','#F59E0B','#22D3EE','#34D399','#F43F5E'], gen:['#FDE68A','#F0ABFC','#818CF8','#22D3EE','#34D399'],
    bar:'linear-gradient(90deg,#818CF8,#C026D3)', age:'linear-gradient(180deg,#C7D2FE,#818CF8)', agePeak:'linear-gradient(180deg,#C026D3,#4C1D95)',
    bub:'rgba(76,29,149,.30)', pin:['#22D3EE','rgba(34,211,238,.30)','#0E7490'], mx:250, soft:'#E0E7FF', softInk:'#4338CA', sub:'#C7D2FE', sub2:'#E0E7FF'}
};
/* owner เลือกชุด 2 (Andaman) · ล็อกไว้ ไม่มีปุ่มสลับบนหน้า · ชุดอื่นเก็บไว้ เปลี่ยนได้ที่บรรทัดนี้บรรทัดเดียว */
var _giTheme='andaman';
function giT(){ return GI_THEMES[_giTheme]||GI_THEMES.sunset; }

function giApplyTheme(){ var T=giT(); GI_STOPS=T.ramp; GI_REG_META.forEach(function(m,i){ m[2]=T.reg[i]; }); GI_GENS.forEach(function(g,i){ g[3]=T.gen[i]; }); return T; }
function giRamp(t){ var i=0; while(i<GI_STOPS.length-2 && t>GI_STOPS[i+1][0]) i++; var a=GI_STOPS[i], b=GI_STOPS[i+1], u=(t-a[0])/(b[0]-a[0]);
  return 'rgb('+a[1].map(function(v,k){ return Math.round(v+(b[1][k]-v)*u); }).join(',')+')'; }
function giIso(code){ code=String(code||'').toUpperCase().trim(); if(!code||code==='OTHER'||code==='TBA') return ''; code=GI_FIX[code]||code; return /^[A-Z]{2}$/.test(code)?code:''; }
function giRegOf(a2){ for(var k in GI_REG){ if((' '+GI_REG[k]+' ').indexOf(' '+a2+' ')>=0) return k; } return 'ot'; }
var _giDN=null;
function giCountryTh(a2){ try{ if(!_giDN) _giDN=new Intl.DisplayNames(['th'],{type:'region'}); return _giDN.of(a2)||a2; }catch(e){ return a2; } }
function giToday(){ return (typeof bkV2LocalYMD==='function')?bkV2LocalYMD(new Date()):new Date().toISOString().slice(0,10); }
function giRange(){
  var t=giToday(), d=new Date(t+'T00:00:00'), from;
  if(_giPeriod==='30'){ d.setDate(d.getDate()-30); from=(typeof bkV2LocalYMD==='function')?bkV2LocalYMD(d):d.toISOString().slice(0,10); }
  else if(_giPeriod==='q'){ var m=Math.floor(d.getMonth()/3)*3; from=d.getFullYear()+'-'+String(m+1).padStart(2,'0')+'-01'; }
  else from=d.getFullYear()+'-01-01';
  return {from:from, to:t};
}
function giSet(k,v){ if(k==='period') _giPeriod=v; else if(k==='pier') _giPier=v; else if(k==='fam') _giFam=v; else if(k==='all') _giAllNat=!_giAllNat; renderGuestInsights(); }
/* ข้อมูลดิบ · หนึ่งแถวต่อคน · ใช้ทั้งหน้าจอและ export */
function giCollect(){
  var R=giRange(), rows=[], heads=0, bad={cancelled:1,cancelled_weather:1,rejected:1};
  var lock=(typeof laMyPier==='function' && laMyPier())?String(laMyPier()):'';
  var pier=lock||_giPier;
  (typeof SB_BOOKINGS!=='undefined'?SB_BOOKINGS:[]).forEach(function(b){
    if(!b||bad[b.status]) return;
    var t=(b.trips||[]).filter(function(x){ return x && x.date && x.date>=R.from && x.date<=R.to; })[0]; if(!t) return;
    if(pier && typeof insPierOf==='function' && insPierOf(t.routeId)!==pier) return;
    var fam=(typeof bkV2RouteFamily==='function')?bkV2RouteFamily(t.routeId):null;
    if(_giFam && (!fam || String(fam.id)!==String(_giFam))) return;
    heads+=(typeof bkV2PaxAllTot==='function')?bkV2PaxAllTot(t.pax||{}):0;
    var ag=(typeof sbGetAgent==='function' && sbGetAgent(b.agentId))?(sbGetAgent(b.agentId).name||''):(b.b2cChannel||'');
    var rn=(typeof getRoute==='function' && getRoute(t.routeId))?(getRoute(t.routeId).name||''):'';
    (typeof insBkPax==='function'?insBkPax(b):[]).forEach(function(p){
      var natV=(typeof insEff==='function')?insEff(b.id,p.key,'nat',insNatLabel(p.natCode)):'';
      var a2=giIso((typeof insNatCode==='function')?insNatCode(natV):p.natCode) || giIso(p.natCode);
      var age=parseInt((typeof insEff==='function')?insEff(b.id,p.key,'age',''):'',10); if(isNaN(age)||age<0||age>110) age=null;
      var gen=''; if(age!=null){ var by=+t.date.slice(0,4)-age; GI_GENS.forEach(function(g){ if(by>=g[1]&&by<=g[2]) gen=g[0]; }); }
      rows.push({date:t.date, route:rn, fam:fam?fam.name:'อื่น ๆ', famId:fam?fam.id:'', pier:(typeof insPierOf==='function')?insPierOf(t.routeId):'', a2:a2, age:age, gen:gen, agent:ag});
    });
  });
  return {R:R, rows:rows, heads:heads, pierLock:lock};
}
function giExport(){
  var D=giCollect();
  var q=function(v){ v=String(v==null?'':v); return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v; };
  var L=['travel_date,program,program_family,pier,nationality,age,generation,agent_channel'];
  D.rows.forEach(function(r){ L.push([r.date,r.route,r.fam,r.pier,r.a2,r.age==null?'':r.age,r.gen,r.agent].map(q).join(',')); });
  var blob=new Blob(['﻿'+L.join('\n')],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='guest_profile_'+D.R.from+'_'+D.R.to+'.csv';
  document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); },500);
}
function giMapSvg(cnt, max, e){
  var W=window.LA_WORLD; if(!W) return '';
  var tone=function(n){ return Math.min(1, Math.log10(n)/Math.log10(Math.max(10,max))); };
  var fmt=function(n){ return n.toLocaleString('en-US'); };
  var paths='<path d="'+W.s+'" fill="#F3F6FB"/>'+(W.o?'<path d="'+W.o+'" fill="#E8EAF0" stroke="#fff" stroke-width=".5"/>':'');
  Object.keys(W.c).forEach(function(a2){ var n=cnt[a2]||0;
    paths+='<path d="'+W.c[a2]+'" fill="'+(n?giRamp(tone(n)):'#E8EAF0')+'" stroke="#fff" stroke-width=".5"><title>'+e(giCountryTh(a2))+(n?(' · '+fmt(n)+' คน'):' · ยังไม่มีลูกค้า')+'</title></path>'; });
  var top=Object.keys(cnt).filter(function(a){ return W.p[a]; }).sort(function(a,b){ return cnt[b]-cnt[a]; });
  var thr=Math.max(5, cnt[top[Math.min(13, top.length-1)]]||0);
  var bub='';
  top.filter(function(a){ return cnt[a]>=thr; }).reverse().forEach(function(a){ var p=W.p[a], r=4+Math.sqrt(cnt[a]/max)*22;
    bub+='<circle cx="'+p[0]+'" cy="'+p[1]+'" r="'+r.toFixed(1)+'" fill="'+giT().bub+'" stroke="#fff" stroke-width="1.6"/>'
      +'<text x="'+(p[0]+r+3).toFixed(1)+'" y="'+(p[1]+3.5)+'" font-size="10.5" font-weight="700" fill="'+giT().deep+'" stroke="#fff" stroke-width="3" paint-order="stroke">'+a+' '+fmt(cnt[a])+'</text>'; });
  var k=W.phk||[755.8,226.2];
  var PN=giT().pin;
  bub+='<circle cx="'+k[0]+'" cy="'+k[1]+'" r="11" fill="'+PN[1]+'"/><circle cx="'+k[0]+'" cy="'+k[1]+'" r="6" fill="'+PN[0]+'" stroke="#fff" stroke-width="2"/>'
    +'<text x="'+(k[0]+10)+'" y="'+(k[1]+16)+'" font-size="11" font-weight="700" fill="'+PN[2]+'" stroke="#fff" stroke-width="3" paint-order="stroke">ภูเก็ต</text>';
  return '<svg viewBox="0 0 '+W.w+' '+W.h+'" style="display:block;width:100%;height:auto" role="img" aria-label="แผนที่โลก ระบายสีตามจำนวนลูกค้าแต่ละสัญชาติ">'+paths+bub+'</svg>';
}
function giLoadMap(){
  if(window.LA_WORLD || _giLoading) return; _giLoading=true;
  var s=document.createElement('script'); s.src='js/world110.js?v=2';
  s.onload=function(){ _giLoading=false; var v=document.getElementById('view-guestins'); if(v && v.classList.contains('active')) renderGuestInsights(); };
  s.onerror=function(){ _giLoading=false; };
  document.head.appendChild(s);
}
function renderGuestInsights(){
  var host=document.getElementById('guestins-host'); if(!host) return;
  giLoadMap();
  var T=giApplyTheme();
  var e=function(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  var fmt=function(n){ return Math.round(n).toLocaleString('en-US'); };
  var pc=function(n,d,dp){ return d?((n/d*100).toFixed(dp==null?1:dp)+'%'):'–'; };
  var D=giCollect(), rows=D.rows;
  /* นับ */
  var cnt={}, nNat=0, ages=[], band=GI_BANDS.map(function(){ return 0; }), gen={}, reg={}, natGen={}, fam={};
  rows.forEach(function(r){
    if(r.a2){ cnt[r.a2]=(cnt[r.a2]||0)+1; nNat++; var g=giRegOf(r.a2); reg[g]=(reg[g]||0)+1; }
    var F=fam[r.fam]=fam[r.fam]||{n:0,ages:[],nat:{}}; F.n++; if(r.a2) F.nat[r.a2]=(F.nat[r.a2]||0)+1;
    if(r.age!=null){ ages.push(r.age); F.ages.push(r.age);
      GI_BANDS.forEach(function(b,i){ if(r.age>=b[0]&&r.age<=b[1]) band[i]++; });
      if(r.gen){ gen[r.gen]=(gen[r.gen]||0)+1; if(r.a2){ var m=natGen[r.a2]=natGen[r.a2]||{t:0}; m[r.gen]=(m[r.gen]||0)+1; m.t++; } } }
  });
  ages.sort(function(a,b){ return a-b; });
  var nAge=ages.length, med=nAge?ages[Math.floor(nAge/2)]:null, avg=nAge?ages.reduce(function(a,b){ return a+b; },0)/nAge:null;
  var kids=ages.filter(function(a){ return a<12; }).length;
  var natList=Object.keys(cnt).sort(function(a,b){ return cnt[b]-cnt[a]; });
  var maxN=natList.length?cnt[natList[0]]:1;
  var top3=natList.slice(0,3).reduce(function(a,c){ return a+cnt[c]; },0);
  var genTop=GI_GENS.slice().sort(function(a,b){ return (gen[b[0]]||0)-(gen[a[0]]||0); });
  var R=D.R, dl=function(s){ var d=new Date(s+'T00:00:00'); return d.toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'2-digit'}); };
  var tone=function(n){ return Math.min(1, Math.log10(n)/Math.log10(Math.max(10,maxN))); };
  var chip=function(a2){ var t=tone(cnt[a2]||1); return '<span style="display:inline-block;min-width:30px;text-align:center;border-radius:6px;padding:2px 0;font-size:11px;font-weight:700;background:'+giRamp(t)+';color:'+(t>0.55?'#fff':T.deep)+'">'+e(a2)+'</span>'; };
  /* ตัวกรอง (สไตล์บนพื้นเข้ม) */
  var seg=function(k,v,l,cur){ var on=(v===cur); return '<button onclick="giSet(\''+k+'\',\''+e(v)+'\')" style="border:0;background:'+(on?'#fff':'transparent')+';color:'+(on?T.ink:T.sub2)+';border-radius:7px;padding:7px 12px;font-family:inherit;font-size:12.5px;font-weight:'+(on?700:600)+';cursor:pointer">'+l+'</button>'; };
  var piers=['tublamu','panwa','ranong'].filter(function(p){ return (typeof ROUTES!=='undefined') && ROUTES.some(function(r){ return r && r.pier===p; }); });
  var pierSeg=D.pierLock?('<span style="background:rgba(255,255,255,.12);border-radius:10px;padding:8px 12px;font-size:12.5px;font-weight:700">'+e((typeof laPierName==='function')?laPierName(D.pierLock):D.pierLock)+'</span>')
    :('<div style="display:flex;background:rgba(255,255,255,.10);border-radius:10px;padding:3px">'+seg('pier','','ทุกท่า',_giPier)+piers.map(function(p){ return seg('pier',p,(typeof laPierName==='function')?laPierName(p):p,_giPier); }).join('')+'</div>');
  var famOpts=(typeof _BKV2_FAMILIES!=='undefined'?_BKV2_FAMILIES:[]).map(function(f){ return '<option value="'+e(f.id)+'"'+(String(f.id)===String(_giFam)?' selected':'')+' style="color:#111">'+e(f.name)+'</option>'; }).join('');
  var kp=[['ลูกค้าที่มีสัญชาติ',fmt(nNat),'จาก '+fmt(D.heads)+' คนเดินทาง',T.kpi[0]],
          ['ประเทศ',String(natList.length),natList.length?('Top 3 = '+pc(top3,nNat,0)+' ('+natList.slice(0,3).join(' · ')+')'):'–',T.kpi[1]],
          ['อายุกลาง',med==null?'–':String(med),avg==null?'ยังไม่มีอายุ':('เฉลี่ย '+avg.toFixed(1)+' ปี'),T.kpi[2]],
          ['Generation หลัก',nAge?genTop[0][0]:'–',nAge?(pc(gen[genTop[0][0]]||0,nAge,0)+' · '+genTop[1][0]+' '+pc(gen[genTop[1][0]]||0,nAge,0)):'',T.kpi[3]],
          ['เด็กต่ำกว่า 12 ปี',nAge?pc(kids,nAge,1):'–',nAge?(fmt(kids)+' จาก '+fmt(nAge)+' คน'):'',T.kpi[4]]];
  var card='background:#fff;border-radius:18px;box-shadow:0 4px 16px rgba(14,27,58,.06);padding:20px 22px;display:flex;flex-direction:column;gap:12px';
  var h2='margin:0;font-size:17px;font-weight:700;color:#17223B';
  /* แผนที่ + อันดับ */
  var natShow=_giAllNat?natList:natList.slice(0,12);
  var rank=natShow.map(function(a2,i){ var p=cnt[a2]/Math.max(1,nNat)*100;
    return '<div style="display:grid;grid-template-columns:24px 36px minmax(0,1fr) 54px;align-items:center;gap:8px;height:30px">'
      +'<span style="font-size:11.5px;color:#8A93A6">'+(i+1)+'</span>'+chip(a2)
      +'<div style="display:flex;flex-direction:column;gap:3px;min-width:0"><span style="font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+e(giCountryTh(a2))+' <span style="color:#8A93A6">· '+fmt(cnt[a2])+'</span></span>'
      +'<span style="display:block;height:4px;background:#EEF1F5;border-radius:2px"><span style="display:block;height:100%;width:'+Math.max(2,cnt[a2]/maxN*100)+'%;background:'+T.bar+';border-radius:2px"></span></span></div>'
      +'<b style="text-align:right;font-size:13px;font-variant-numeric:tabular-nums">'+p.toFixed(1)+'%</b></div>'; }).join('');
  var regBar=GI_REG_META.map(function(m){ var n=reg[m[0]]||0; return n?'<div title="'+m[1]+' '+fmt(n)+'" style="width:'+(n/Math.max(1,nNat)*100)+'%;background:'+m[2]+'"></div>':''; }).join('');
  var regLeg=GI_REG_META.filter(function(m){ return reg[m[0]]; }).map(function(m){ return '<span style="display:flex;align-items:center;gap:6px;font-size:12px;color:#3A4458"><span style="width:10px;height:10px;border-radius:3px;background:'+m[2]+'"></span><b>'+m[1]+'</b> '+pc(reg[m[0]],nNat)+'</span>'; }).join('');
  var mapBox=window.LA_WORLD?giMapSvg(cnt,maxN,e):'<div style="aspect-ratio:2/1;display:flex;align-items:center;justify-content:center;color:#8A93A6;font-size:13px">กำลังโหลดแผนที่…</div>';
  var legend='<div style="position:absolute;left:12px;bottom:10px;background:rgba(255,255,255,.92);border-radius:10px;padding:8px 10px;display:flex;flex-direction:column;gap:5px">'
    +'<span style="font-size:11px;font-weight:700;color:#3A4458">จำนวนลูกค้า</span>'
    +'<div style="display:flex;align-items:center;gap:6px;font-size:10.5px;color:#5A6478"><span>1</span><span style="display:block;width:140px;height:8px;border-radius:4px;background:linear-gradient(90deg,'+T.ramp.map(function(s){ return 'rgb('+s[1].join(',')+') '+Math.round(s[0]*100)+'%'; }).join(',')+')"></span><span>'+fmt(maxN)+'</span></div>'
    +'<div style="display:flex;align-items:center;gap:6px;font-size:10.5px;color:#5A6478"><span style="width:18px;height:8px;background:#E8EAF0;border-radius:2px;display:block"></span>ยังไม่มีลูกค้า</div></div>';
  /* อายุ */
  var bMax=Math.max.apply(null, band.concat([1]));
  var bars=band.map(function(n,i){ var p=nAge?n/nAge*100:0, peak=(n===bMax && n>0);
    return '<div style="display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:6px;height:100%"><span style="font-size:12px;font-weight:700">'+(nAge?Math.round(p)+'%':'')+'</span>'
      +'<div style="width:100%;height:'+Math.max(3,Math.round(n/bMax*170))+'px;border-radius:8px 8px 2px 2px;background:'+(peak?T.agePeak:T.age)+'"></div></div>'; }).join('');
  var bLbl=GI_BANDS.map(function(b,i){ return '<div style="display:flex;flex-direction:column;align-items:center"><b style="font-size:12px">'+b[2]+'</b><span style="font-size:11px;color:#5A6478">'+fmt(band[i])+' คน</span></div>'; }).join('');
  /* Generation */
  var genBar=GI_GENS.map(function(g,i){ var n=gen[g[0]]||0, p=nAge?n/nAge*100:0; return n?'<div style="width:'+p+'%;background:'+g[3]+';display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:'+(i===0?T.deep:'#fff')+'">'+(p>12?Math.round(p)+'%':'')+'</div>':''; }).join('');
  var yr=+R.to.slice(0,4);
  var genRows=GI_GENS.map(function(g){ var n=gen[g[0]]||0;
    var yrs=g[2]>=9999?(g[1]+'+'):(g[1]?(g[1]+'–'+g[2]):('ก่อน '+(g[2]+1)));
    var ag=g[2]>=9999?('อายุไม่เกิน '+(yr-g[1])):(g[1]?((yr-g[2])+'–'+(yr-g[1])+' ปี'):((yr-g[2])+' ปีขึ้นไป'));
    return '<div style="display:grid;grid-template-columns:12px minmax(0,1fr) 76px 56px;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid #F0F2F6">'
      +'<span style="width:12px;height:12px;border-radius:4px;background:'+g[3]+'"></span>'
      +'<span style="display:flex;flex-direction:column"><b style="font-size:13px">'+g[0]+'</b><span style="font-size:11.5px;color:#5A6478">เกิด '+yrs+' · '+ag+'</span></span>'
      +'<span style="text-align:right;font-size:12px;color:#5A6478">'+fmt(n)+' คน</span><b style="text-align:right;font-size:15px">'+(nAge?pc(n,nAge,0):'–')+'</b></div>'; }).join('');
  /* สัญชาติ × Generation */
  var cell=function(v){ var t=Math.min(1,v/55), l=Math.round(96-t*58); return '<span style="text-align:center;padding:8px 0;border-radius:8px;font-size:12.5px;font-weight:700;font-variant-numeric:tabular-nums;background:hsl('+T.mx+',80%,'+l+'%);color:'+(l<64?'#fff':T.deep)+'">'+v+'%</span>'; };
  var mxNat=Object.keys(natGen).filter(function(a){ return natGen[a].t>=30; }).sort(function(a,b){ return natGen[b].t-natGen[a].t; }).slice(0,8);
  var mx=mxNat.map(function(a2){ var m=natGen[a2];
    return '<div style="display:grid;grid-template-columns:150px repeat(5,minmax(0,1fr)) 60px;gap:6px;align-items:center">'
      +'<span style="display:flex;align-items:center;gap:8px;min-width:0">'+chip(a2)+'<span style="font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+e(giCountryTh(a2))+'</span></span>'
      +GI_GENS.map(function(g){ return cell(Math.round((m[g[0]]||0)/m.t*100)); }).join('')
      +'<span style="text-align:right;font-size:12px;color:#5A6478">'+fmt(m.t)+'</span></div>'; }).join('');
  /* ตามโปรแกรม */
  var famRows=Object.keys(fam).sort(function(a,b){ return fam[b].n-fam[a].n; }).map(function(k){ var F=fam[k], A=F.ages.slice().sort(function(a,b){ return a-b; });
    var tn=Object.keys(F.nat).sort(function(a,b){ return F.nat[b]-F.nat[a]; })[0];
    return '<div style="display:flex;flex-direction:column;gap:6px;padding:10px 12px;background:#F6F8FB;border-radius:12px">'
      +'<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px"><b style="font-size:13.5px">'+e(k)+'</b><span style="font-size:11.5px;color:#5A6478">'+fmt(F.n)+' คน · มีอายุ '+fmt(A.length)+'</span></div>'
      +'<div style="display:flex;flex-wrap:wrap;gap:6px 18px;font-size:12px;color:#3A4458">'
        +'<span>อายุกลาง <b style="font-size:16px;color:#17223B">'+(A.length?A[Math.floor(A.length/2)]:'–')+'</b></span>'
        +'<span>เด็ก &lt;12 <b style="font-size:16px;color:#17223B">'+(A.length?pc(A.filter(function(a){ return a<12; }).length,A.length):'–')+'</b></span>'
        +'<span>สัญชาติอันดับ 1 '+(tn?(chip(tn)+' <b style="color:#17223B">'+pc(F.nat[tn],Object.keys(F.nat).reduce(function(s,c){ return s+F.nat[c]; },0),0)+'</b>'):'–')+'</span></div></div>'; }).join('');
  /* ความครบ */
  var cov=[['มีชื่อ',rows.length,D.heads],['มีสัญชาติ',nNat,D.heads],['มีอายุ',nAge,D.heads]].map(function(c){ var p=c[2]?c[1]/c[2]*100:0;
    return '<div style="flex:1 1 170px;display:flex;flex-direction:column;gap:5px"><div style="display:flex;justify-content:space-between;font-size:12px"><span style="color:#3A4458">'+c[0]+'</span><b>'+fmt(c[1])+' · '+Math.round(p)+'%</b></div>'
      +'<div style="height:6px;background:#EEF1F5;border-radius:4px;overflow:hidden"><div style="height:100%;width:'+Math.min(100,p)+'%;background:'+(p<50?'linear-gradient(90deg,#FB923C,#F43F5E)':'linear-gradient(90deg,#22D3EE,#10B981)')+';border-radius:4px"></div></div></div>'; }).join('');
  var ageSpan=(function(){ var ds=rows.filter(function(r){ return r.age!=null; }).map(function(r){ return r.date; }).sort(); return ds.length?(dl(ds[0])+' – '+dl(ds[ds.length-1])):''; })();

  host.innerHTML='<div style="margin:-22px;min-height:calc(100dvh - var(--topbar, 44px));background:#EEF1F5;color:#17223B">'
   +'<div style="background:'+T.hero+';color:#fff;padding:24px 30px 84px;display:flex;flex-direction:column;gap:22px">'
     +'<div style="display:flex;flex-wrap:wrap;align-items:flex-end;gap:16px">'
       +'<div style="display:flex;flex-direction:column;gap:4px"><span style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:'+T.sub+';font-weight:600">Overview · Guest Insights</span>'
       +'<div style="font-size:30px;font-weight:700;letter-spacing:-.01em">ลูกค้าของเรามาจากไหน</div>'
       +'<span style="font-size:13px;color:'+T.sub2+'">สัญชาติ · ช่วงอายุ · Generation · ทริป '+dl(R.from)+' – '+dl(R.to)+' ที่เดินทางแล้วและไม่ยกเลิก</span></div>'
       +'<div style="margin-left:auto;display:flex;flex-wrap:wrap;gap:8px;align-items:center">'
         +'<div style="display:flex;background:rgba(255,255,255,.10);border-radius:10px;padding:3px">'+seg('period','30','30 วัน',_giPeriod)+seg('period','q','ไตรมาสนี้',_giPeriod)+seg('period','year','ปีนี้',_giPeriod)+'</div>'
         +pierSeg
         +'<select onchange="giSet(\'fam\',this.value)" style="border:1px solid rgba(255,255,255,.3);background:transparent;color:#fff;border-radius:10px;padding:8px 10px;font-family:inherit;font-size:12.5px;font-weight:600;cursor:pointer"><option value="" style="color:#111">ทุกโปรแกรม</option>'+famOpts+'</select>'
         +'<button onclick="giExport()" title="หนึ่งแถวต่อคน · ไม่มีชื่อ/เบอร์/เลขพาสปอร์ต" style="border:0;background:'+T.btn+';color:'+T.btnInk+';border-radius:10px;padding:9px 14px;font-family:inherit;font-size:12.5px;font-weight:700;cursor:pointer">Export ฐานข้อมูล (.csv)</button>'
       +'</div></div>'
     +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px">'
       +kp.map(function(k){ return '<div style="display:flex;flex-direction:column;gap:2px;border-left:3px solid '+k[3]+';padding-left:14px"><span style="font-size:12px;color:'+T.sub+'">'+k[0]+'</span><b style="font-size:28px;font-weight:700;font-variant-numeric:tabular-nums">'+e(k[1])+'</b><span style="font-size:12px;color:'+T.sub2+'">'+e(k[2])+'</span></div>'; }).join('')
     +'</div></div>'
   +'<div style="padding:0 30px 34px;margin-top:-60px;display:flex;flex-direction:column;gap:16px">'
     +(rows.length?(
     '<section style="background:#fff;border-radius:18px;box-shadow:0 10px 30px rgba(14,27,58,.10);padding:20px 22px;display:flex;flex-wrap:wrap;gap:22px">'
       +'<div style="flex:999 1 620px;min-width:0;display:flex;flex-direction:column;gap:12px">'
         +'<div style="display:flex;flex-wrap:wrap;align-items:baseline;gap:10px"><div style="'+h2+';font-size:18px">การกระจายสัญชาติทั่วโลก</div><span style="font-size:12.5px;color:#5A6478">'+fmt(nNat)+' คนที่มีสัญชาติ · '+natList.length+' ประเทศ · ชี้ที่ประเทศเพื่อดูจำนวน</span></div>'
         +'<div style="position:relative;border-radius:12px;overflow:hidden;background:#F3F6FB">'+mapBox+legend+'</div>'
         +'<div style="display:flex;height:14px;border-radius:7px;overflow:hidden">'+regBar+'</div>'
         +'<div style="display:flex;flex-wrap:wrap;gap:6px 18px">'+regLeg+'</div>'
       +'</div>'
       +'<div style="flex:1 1 290px;display:flex;flex-direction:column;gap:4px">'
         +'<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px"><b style="font-size:14px">อันดับสัญชาติ</b><span style="font-size:11.5px;color:#5A6478">% ของคนที่มีสัญชาติ</span></div>'
         +'<div style="'+(_giAllNat?'max-height:620px;overflow:auto;':'')+'">'+rank+'</div>'
         +(natList.length>12?'<button onclick="giSet(\'all\')" style="margin-top:8px;align-self:flex-start;border:0;background:'+T.soft+';color:'+T.softInk+';border-radius:8px;padding:7px 12px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer">'+(_giAllNat?'ย่อเหลือ 12 อันดับ':('ดูทั้ง '+natList.length+' ประเทศ'))+'</button>':'')
       +'</div></section>'
     +'<div style="display:flex;flex-wrap:wrap;gap:16px;align-items:stretch">'
       +'<section style="flex:1.2 1 460px;'+card+'"><div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap"><div style="'+h2+'">ช่วงอายุ</div><span style="font-size:12.5px;color:#5A6478">'+fmt(nAge)+' คนที่มีอายุ'+(med!=null?(' · อายุกลาง '+med+' ปี'):'')+'</span></div>'
         +(nAge?('<div style="display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:10px;align-items:end;height:210px;border-bottom:1px solid #DCE1EA">'+bars+'</div><div style="display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:10px">'+bLbl+'</div>'):'<div style="color:#8A93A6;font-size:13px;padding:30px 0;text-align:center">ยังไม่มีอายุในช่วงนี้ · กรอกได้ที่หน้า Insurance</div>')+'</section>'
       +'<section style="flex:1 1 400px;'+card+'"><div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap"><div style="'+h2+'">Generation</div><span style="font-size:12.5px;color:#5A6478">ปีเกิด = ปีที่เดินทาง − อายุ</span></div>'
         +(nAge?('<div style="display:flex;height:34px;border-radius:9px;overflow:hidden">'+genBar+'</div>'):'')+'<div style="display:flex;flex-direction:column;gap:2px">'+genRows+'</div></section>'
     +'</div>'
     +'<div style="display:flex;flex-wrap:wrap;gap:16px;align-items:stretch">'
       +'<section style="flex:1.3 1 520px;'+card+';gap:8px"><div style="display:flex;align-items:baseline;gap:10px;margin-bottom:4px;flex-wrap:wrap"><div style="'+h2+'">สัญชาติ × Generation</div><span style="font-size:12.5px;color:#5A6478">% ภายในแต่ละสัญชาติ · เฉพาะสัญชาติที่มีอายุตั้งแต่ 30 คน</span></div>'
         +(mx?('<div style="display:grid;grid-template-columns:150px repeat(5,minmax(0,1fr)) 60px;gap:6px;font-size:11px;font-weight:700;color:#5A6478"><span></span><span style="text-align:center">Alpha</span><span style="text-align:center">Gen Z</span><span style="text-align:center">Millennials</span><span style="text-align:center">Gen X</span><span style="text-align:center">Boomers</span><span style="text-align:right">คน</span></div>'+mx)
             :'<div style="color:#8A93A6;font-size:13px;padding:20px 0">ข้อมูลอายุยังน้อยเกินไปสำหรับตารางนี้</div>')+'</section>'
       +'<section style="flex:1 1 360px;'+card+';gap:10px"><div style="'+h2+'">ตามโปรแกรม</div>'+famRows+'</section>'
     +'</div>'
     ):('<section style="'+card+';align-items:center;padding:40px">ไม่มีลูกค้าในช่วง / ตัวกรองที่เลือก</section>'))
     +'<section style="background:#fff;border-radius:18px;box-shadow:0 4px 16px rgba(14,27,58,.06);padding:18px 22px;display:flex;flex-wrap:wrap;gap:22px;align-items:center">'
       +'<div style="flex:1 1 280px;display:flex;flex-direction:column;gap:4px"><div style="'+h2+';font-size:16px">ความครบของข้อมูล</div>'
       +'<span style="font-size:12px;color:#5A6478;line-height:1.55">เทียบกับคนเดินทาง '+fmt(D.heads)+' คน · กราฟทั้งหมดคิดจากคนที่มีข้อมูลช่องนั้น'+(ageSpan?(' · อายุที่มีมาจากทริป '+ageSpan):'')+' · กรอกเพิ่มได้ที่หน้า Insurance</span></div>'+cov+'</section>'
   +'</div></div>';
}
