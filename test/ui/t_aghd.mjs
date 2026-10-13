// §agHd · หน้า Agent List ที่จัดใหม่ · แถบหัวแบบ Dashboard · แท็บอยู่บน · เรื่องที่ต้องจัดการรวมเป็นแถบเดียว
//
// ที่มา (2026-09-18) · ของเดิมหน้านี้บอกอะไรที่ทำอะไรต่อไม่ได้ (Top Market · Credit Limit รวม)
//   ส่วนเรื่องที่ต้องลงมือจริงกลับกระจายอยู่สี่ที่ และแถวแท็บถูกดันไปอยู่ล่างสุดจนมองไม่เห็น
//
// เทสนี้กันสามอย่างที่ไหลกลับได้ง่ายที่สุด
//   1 ตัวเลขบนแถบหัวต้องมาจากการนับชุดเดียวกับที่ป๊อปแจง (อ่านที่เดียว ใช้สองที่)
//   2 แท็บต้องอยู่เหนือเนื้อหา ไม่ใช่ท้ายหน้า
//   3 เรื่องของเอเย่นต์ต้องอยู่ในแถบเดียว เรียงตามความด่วน และมีปุ่มพาไปแก้ทุกแถว
//
// ⚠ ต้องเปิดผ่าน nav() จริง · สไตล์ทั้งชุด scope ไว้ใต้ #view-agents
import { open } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1680, height: 1100 });
await page.evaluate(() => { const el = document.querySelector('.nav-item[data-view="agents"]'); if (el) nav(el); });
await page.waitForTimeout(1100);

/* ══ 1 · แถบหัว ══════════════════════════════════════════════════════════ */
/* ตัวนับอิสระของเทส · นับจากข้อมูลดิบเอง ไม่เรียก agHdScan()
   ถ้าเทสไปเรียกตัวนับของหน้า เลขสองฝั่งจะเท่ากันเสมอแม้ตัวนับจะเพี้ยน — จับอะไรไม่ได้เลย */
const COUNT = `(function(){
  var ags = (typeof laScopeAgents==='function') ? laScopeAgents(SB_AGENTS) : SB_AGENTS;
  var o = {total:ags.length, selling:0, need:0, exp:0, drift:0, orph:0, norate:0};
  ags.forEach(function(a){
    if(!(a.programs||[]).length) return;
    o.selling++;
    var hit=false;
    var rt = a.rateTypeId ? getRateType(a.rateTypeId) : null;
    if(!rt){ o.norate++; o.need++; return; }
    var to = String(rt.validTo||'');
    if(to){
      var d = rtExpDaysTo(to);
      var answered = !!laSeasonAt(a, laDayAfter(to));
      if(d!==null && d<=60 && !answered){ o.exp++; hit=true; }
    }
    var have = rt.seatRates||{};
    if((a.programs||[]).some(function(p){ return p && !have[p]; })){ o.orph++; hit=true; }
    var nx = rtExpNextOf(a.id);
    if(nx && nx!==a.rateTypeId){ o.drift++; hit=true; }
    if(hit) o.need++;
  });
  return o;
})()`;

const H = await page.evaluate(`(function(){
  var q = function(s){ return document.querySelector('#view-agents ' + s); };
  var n = q('.ag-hd-n'), g = q('.ag-hd-g'), br = q('.ag-hd-brand');
  var chips = Array.from(document.querySelectorAll('#view-agents .ag-hd-kpi .ag-chip')).map(function(e){ return e.textContent.trim(); });
  var s = ${COUNT};
  var hdBox = q('.ag-hd') ? q('.ag-hd').getBoundingClientRect() : null;
  var kpiBox = q('.ag-hd-kpi') ? q('.ag-hd-kpi').getBoundingClientRect() : null;
  var brBox = (br && getComputedStyle(br).display!=='none') ? br.getBoundingClientRect() : null;
  return {
    num: n ? n.textContent.trim() : '',
    sub: g ? g.textContent.trim() : '',
    chips: chips, scan: s,
    seg: Array.from(document.querySelectorAll('#view-agents .ag-seg b')).map(function(e){ return e.textContent.trim(); }),
    hasAdd: !!q('.ag-hd-add'),
    brandOverlapsChips: (brBox && kpiBox) ? Math.round(brBox.right - kpiBox.left) : -999,
    hdH: hdBox ? Math.round(hdBox.height) : -1,
    oldTiles: document.querySelectorAll('#view-agents .sb-kpi').length
  };
})()`);


if (H.num !== String(H.scan.total)) fail('เลขบนแถบหัว "' + H.num + '" ไม่ตรงกับที่นับได้ ' + H.scan.total);
else ok('จำนวนเอเย่นต์บนแถบหัว ' + H.num + ' · ตรงกับตัวนับ');

if (!/selling now/i.test(H.sub)) fail('ใต้เลขไม่ได้บอกว่าขายอยู่จริงกี่เจ้า · ได้ "' + H.sub + '"');
else if (Number((H.sub.match(/(\d[\d,]*)\s*selling/i) || [])[1]) !== H.scan.selling)
  fail('ป้ายใต้เลขบอกจำนวนที่ขายอยู่ไม่ตรงกับที่นับได้ ' + H.scan.selling + ' · ได้ "' + H.sub + '"');
else ok('ป้ายใต้เลข · ' + H.sub.replace(/\s+/g, ' ') + ' · ตรงกับตัวนับอิสระ');

if (H.oldTiles) fail('การ์ด KPI ขาวชุดเก่ายังอยู่ ' + H.oldTiles + ' ใบ');
else ok('การ์ด KPI ขาวชุดเก่าไม่เหลือแล้ว');

if (H.hdH > 90) fail('แถบหัวสูง ' + H.hdH + 'px · แถบของ Dashboard สูงราว 55-70px');
else ok('แถบหัวสูง ' + H.hdH + 'px');

/* ปุ่มงานทั้งหมดต้องอยู่บนแถบ ไม่ใช่ page-hd เดิม */
if (!H.hasAdd || H.seg.join('|') !== 'Card|Table')
  fail('ปุ่มบนแถบหัวไม่ครบ · seg=' + H.seg.join('|') + ' add=' + H.hasAdd);
else ok('Card · Table · + New Agent อยู่บนแถบหัว');

/* ชื่อหน้ากลางแถบต้องไม่ทับชิปตัวเลข · ที่ 1680 ต้องยังโชว์อยู่ (กติกา .dv-brand คือซ่อนต่ำกว่า 1600) */
if (H.brandOverlapsChips > 0)
  fail('ชื่อหน้ากลางแถบทับชิปตัวเลข ' + H.brandOverlapsChips + 'px ที่จอ 1680');
else ok('ชื่อหน้ากลางแถบไม่ทับชิปตัวเลข');

/* ══ 2 · ชิปแดง กับ ป๊อปแจงรายการ ต้องพูดเลขชุดเดียวกัน ══════════════════ */
const chipTxt = H.chips.find(t => /Needs action/i.test(t)) || '';
const chipNum = Number((chipTxt.match(/(\d[\d,]*)/) || [])[1] || '').valueOf();
if (!chipTxt) fail('ไม่มีชิป Needs action บนแถบหัว');
else if (chipNum !== H.scan.need) fail('ชิปบอก ' + chipNum + ' แต่ตัวนับได้ ' + H.scan.need);
else ok('ชิป Needs action ' + chipNum + ' · ตรงกับตัวนับ');

await page.click('#view-agents .ag-chip.warn');
await page.waitForTimeout(250);
const P = await page.evaluate(`(function(){
  var pop = document.getElementById('ag-hd-pop');
  return {
    on: !!(pop && pop.classList.contains('on')),
    rows: Array.from(document.querySelectorAll('#view-agents .ag-hd-pop .ag-hd-pr:not(.dim)'))
      .map(function(r){ return { t: r.querySelector('.t b').textContent.trim(), n: Number(r.querySelector('.n').textContent.trim()) }; }),
    scan: ${COUNT}
  };
})()`);
if (!P.on) fail('กดชิปแล้วป๊อปไม่เปิด');
else ok('กดชิปแล้วป๊อปเปิด');

const want = [['Rate expiring', P.scan.exp], ['Contract ≠ bound rate', P.scan.drift],
              ['Route with no price', P.scan.orph], ['No rate bound', P.scan.norate]];
let popBad = 0;
want.forEach(([t, n]) => {
  const r = P.rows.find(x => x.t === t);
  if (!r) { popBad++; console.log('  ✗ ป๊อปไม่มีแถว "' + t + '"'); }
  else if (r.n !== n) { popBad++; console.log('  ✗ แถว "' + t + '" บอก ' + r.n + ' แต่ตัวนับได้ ' + n); }
});
if (popBad) bad += popBad;
else ok('ป๊อปแจง 4 แถว · ' + want.map(x => x[1]).join(' / ') + ' · ตรงกับตัวนับทุกตัว');

/* ══ 3 · แผงของเอเย่นต์ · ชื่อก่อน แล้วแท็บ แล้วเรื่องที่ต้องจัดการ ══════ */
const D = await page.evaluate(() => {
  /* เลือกเจ้าที่มีทั้งเครดิตและโปรแกรม · แผงจะได้มีของให้ดูครบ */
  const a = (SB_AGENTS || []).filter(x => (x.programs || []).length >= 4 && x.payType === 'invoice')[0]
         || (SB_AGENTS || [])[0];
  agSelect(a.id);
  const top = s => { const e = document.querySelector('#view-agents ' + s); return e ? Math.round(e.getBoundingClientRect().top) : null; };
  const bands = [...document.querySelectorAll('#view-agents .ag-band .ttl')].map(e => e.textContent.trim());
  const als = [...document.querySelectorAll('#view-agents .ag-al')].map(r => ({
    t: r.querySelector('.t').textContent.trim(),
    go: !!r.querySelector('.go'),
    on: (r.querySelector('.go') || {}).getAttribute ? r.querySelector('.go').getAttribute('onclick') : ''
  }));
  return {
    agent: a.code,
    nameTop: top('.sb-main-ttl'), tabsTop: top('.sb-tabs'), bodyTop: top('#ag-tabbody'),
    bands, als,
    alCount: (typeof agAlerts === 'function') ? agAlerts(a).length : -1,
    oldBanner: document.querySelectorAll('#view-agents .ct-banner').length,
    /* ชิปเวอร์ชันสัญญา · วัดจาก "มีปุ่มเปิดดูใบสัญญา" ไม่ใช่จากคลาสของคอมโพเนนต์
       คลาสเปลี่ยนได้เมื่อหน้าตาเปลี่ยน · สิ่งที่ต้องไม่หายคือทางเข้าไปดูใบสัญญาเก่า */
    pillsInBody: /ctViewContract\(/.test((document.getElementById('ag-tabbody')||{}).innerHTML||''),
    pillsAboveTabs: (function(){
      const hd = document.querySelector('#view-agents .sb-main-hd');
      const tabs = document.querySelector('#view-agents .sb-tabs');
      if(!hd || !tabs) return false;
      let n = hd.nextElementSibling, found = false;
      while(n && n !== tabs){ if(/ctViewContract\(/.test(n.innerHTML||'')) found = true; n = n.nextElementSibling; }
      return found;
    })()
  };
});
console.log('Agent · ' + D.agent);

if (D.nameTop === null || D.tabsTop === null) fail('หาชื่อเอเย่นต์หรือแถวแท็บไม่เจอ');
else if (!(D.nameTop < D.tabsTop)) fail('ชื่อเอเย่นต์ไม่ได้อยู่เหนือแถวแท็บ');
else if (D.tabsTop - D.nameTop > 150)
  fail('แท็บอยู่ห่างจากชื่อ ' + (D.tabsTop - D.nameTop) + 'px · มีของคั่นกลางอีกแล้ว');
else ok('ชื่อก่อน แล้วแท็บ · ห่างกัน ' + (D.tabsTop - D.nameTop) + 'px');

if (D.pillsAboveTabs) fail('แถวชิปสัญญายังคั่นอยู่ระหว่างชื่อกับแท็บ');
else if (!D.pillsInBody) fail('แถวชิปสัญญาหายไป ไม่ได้ย้ายลงบล็อก Commercial');
else ok('แถวชิปสัญญาย้ายไปอยู่ในบล็อก Commercial');

if (D.oldBanner) fail('แบนเนอร์สัญญาชุดเก่ายังอยู่ ' + D.oldBanner + ' ใบ · ควรรวมอยู่ในแถบ Needs action แล้ว');
else ok('แบนเนอร์ชุดเก่าไม่เหลือ');

const wantBands = ['Needs action', 'Commercial', 'Rate used for pricing', 'Programs sold', 'Company & Contact'];
if (D.bands.join(' | ') !== wantBands.join(' | '))
  fail('หัวข้อไม่ครบหรือสลับลำดับ · ได้ ' + D.bands.join(' | '));
else ok('หัวข้อ 5 บล็อกครบตามลำดับ');

if (D.als.length !== D.alCount)
  fail('แถบ Alert วาด ' + D.als.length + ' แถว แต่ agAlerts() บอก ' + D.alCount + ' เรื่อง');
else ok('แถบ Alert ' + D.als.length + ' แถว · ตรงกับ agAlerts()');

/* ตรวจแบบอิสระหนึ่งเคส · เจ้าที่สัญญาหมดใน 30 วันตามข้อมูลดิบ ต้องมีแถว Contract expiring จริง
   ข้อนี้กันเคสที่ตัวแถบวาดออกมาสวยแต่ไม่ได้อ่านข้อมูลจริงสักตัว */
const C = await page.evaluate(() => {
  const T = TODAY_STR;
  const days = ymd => { const A=ymd.split('-'), B=T.split('-');
    return Math.round((Date.UTC(+A[0],+A[1]-1,+A[2]) - Date.UTC(+B[0],+B[1]-1,+B[2]))/86400000); };
  const a = (SB_AGENTS||[]).filter(x => x.contractEnd && days(x.contractEnd) >= 0 && days(x.contractEnd) <= 30)[0];
  if(!a) return {skip:true};
  agSelect(a.id);
  return { skip:false, code:a.code, left:days(a.contractEnd),
    rows:[...document.querySelectorAll('#view-agents .ag-al .t')].map(e=>e.textContent.trim()) };
});
if (C.skip) console.log('  ! ไม่มีเจ้าที่สัญญาหมดใน 30 วันในชุดข้อมูลนี้ · ข้ามข้อนี้');
else if (!C.rows.some(t => /Contract expiring/.test(t)))
  fail(C.code + ' สัญญาเหลือ ' + C.left + ' วัน แต่แถบไม่ได้ขึ้นเรื่องนี้ · ได้ ' + C.rows.join(' / '));
else ok(C.code + ' สัญญาเหลือ ' + C.left + ' วัน · แถบขึ้นเรื่องนี้จริง');

/* §agStd · จอ 1440 คือจอที่แคบที่สุดที่ยังเป็นเดสก์ท็อป และเป็นจอที่ใช้กันจริง
   แผงเหลือกว้างราว 720px เพราะลิสต์เอเย่นต์กินไป 390px · ตารางโปรแกรมต้องยังอ่านชื่อได้ครบ
   (วัดที่ 1680 อย่างเดียวจับไม่ได้ · ที่นั่นเหลือ 960px ซึ่งกว้างเกินกว่าจะพัง) */
await page.setViewportSize({ width: 1440, height: 1100 });
await page.waitForTimeout(450);
const PW = await page.evaluate(() => {
  const w = document.querySelector('#view-agents .agi-prog-wrap');
  const n = [...document.querySelectorAll('#view-agents .agi-prog-name')];
  return { panelW: w ? Math.round(w.getBoundingClientRect().width) : -1,
           names: n.length, clipped: n.filter(e=>e.scrollWidth > e.clientWidth + 1).length,
           clippedNames: n.filter(e=>e.scrollWidth > e.clientWidth + 1).map(e=>e.textContent.trim()).slice(0,3) };
});
if (PW.names <= 0) console.log('  ! เอเย่นต์รายนี้ไม่มีโปรแกรม · ข้ามข้อชื่อเส้นทาง');
else if (PW.clipped)
  fail('จอ 1440 · ชื่อเส้นทางโดนตัด ' + PW.clipped + ' จาก ' + PW.names + ' แถว (แผงกว้าง ' + PW.panelW + 'px) · ' + PW.clippedNames.join(' / '));
else ok('จอ 1440 · ชื่อเส้นทางครบทุกแถว · แผงกว้าง ' + PW.panelW + 'px');
await page.setViewportSize({ width: 1680, height: 1100 });
await page.waitForTimeout(350);

/* §agStd · จอกว้าง · ที่ว่างที่เพิ่มมาต้องกระจายให้ทุกคอลัมน์ ไม่ใช่ตกเป็นของชื่อเส้นทางคนเดียว
   ตรึงความกว้างช่องวันไว้ตายตัวเมื่อไหร่ คอลัมน์ขวาจะไปกองชิดกันเป็นกระจุก ระยะห่างไม่เท่ากัน
   วัดเป็นสัดส่วน ไม่ใช่พิกเซล · พิกเซลเปลี่ยนตามจอ แต่สัดส่วนคือสิ่งที่ตาเห็นว่า "เท่ากันไหม" */
const CW = await page.evaluate(() => {
  const r = document.querySelector('#view-agents .agi-prog-row');
  if(!r) return null;
  const w = e => e ? e.getBoundingClientRect().width : 0;
  const per = [...r.querySelectorAll('.agi-period-col')].filter(e=>getComputedStyle(e).display!=='none');
  const piers = [...document.querySelectorAll('#view-agents .agi-prog-row .agi-prog-pier-col')];
  return { route: Math.round(w(r.querySelector('.agi-prog-name-wrap'))),
           date:  Math.round(w(per[0])), date2: Math.round(w(per[1])),
           /* ท่าเรือต้องเป็นคอลัมน์ของตัวเอง ไม่ใช่ห้อยท้ายชื่อเส้นทาง · และต้องมีค่าจริงทุกแถว */
           pierShown: piers.length ? getComputedStyle(piers[0]).display !== 'none' : false,
           pierRows: piers.length,
           pierEmpty: piers.filter(e=>!e.textContent.trim()).length,
           pierInName: !!r.querySelector('.agi-prog-name-wrap .agi-prog-pier') };
});
if (!CW) console.log('  ! ไม่มีแถวโปรแกรมให้วัดสัดส่วน · ข้ามข้อนี้');
else {
  const ratio = CW.date ? +(CW.route / CW.date).toFixed(2) : 99;
  if (ratio > 2.2)
    fail('จอ 1680 · ชื่อเส้นทางกว้างกว่าช่องวัน ' + ratio + ' เท่า (' + CW.route + ' vs ' + CW.date + ') · ที่ว่างไม่ได้ถูกแบ่ง คอลัมน์ขวาไปกองชิดกัน');
  else if (Math.abs(CW.date - CW.date2) > 2)
    fail('จอ 1680 · ช่องวันสองช่องกว้างไม่เท่ากัน ' + CW.date + ' / ' + CW.date2);
  else ok('จอ 1680 · คอลัมน์แบ่งที่ว่างกันทุกช่อง · ชื่อ:วัน = ' + ratio + ' เท่า');

  if (!CW.pierShown)
    fail('จอ 1680 · ไม่มีคอลัมน์ท่าเรือ · ท่าเรือต้องแยกออกมาเป็นคอลัมน์ของตัวเองเมื่อจอกว้างพอ');
  else if (CW.pierInName)
    fail('ท่าเรือยังห้อยอยู่ท้ายชื่อเส้นทางด้วย · โผล่สองที่ในแถวเดียวกัน');
  else if (CW.pierEmpty)
    fail('คอลัมน์ท่าเรือว่าง ' + CW.pierEmpty + ' จาก ' + CW.pierRows + ' แถว');
  else ok('จอ 1680 · ท่าเรือเป็นคอลัมน์ของตัวเอง · มีค่าครบ ' + CW.pierRows + ' แถว');
}

const noGo = D.als.filter(x => !x.go || !x.on);
if (noGo.length) fail(noGo.length + ' แถวไม่มีปุ่มพาไปแก้ · ' + noGo.map(x => x.t).join(', '));
else if (D.als.length) ok('ทุกแถวมีปุ่มพาไปแก้ · ' + D.als.map(x => x.t.replace(/\s+/g, ' ')).join(' · '));
else ok('เอเย่นต์รายนี้ไม่มีเรื่องค้าง');

/* ══ 4 · มือถือ · ลิสต์ยุบ · ไม่ล้นขอบ ═══════════════════════════════════ */
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(500);
const M = await page.evaluate(() => {
  const list = document.getElementById('ag-list'), tgl = document.getElementById('ag-side-tgl');
  const before = getComputedStyle(list).display;
  agSideToggle();
  const after = getComputedStyle(list).display;
  return {
    ovf: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
    tgl: tgl ? getComputedStyle(tgl).display : 'none',
    before, after,
    tabRows: (function () {
      const t = document.querySelector('#view-agents .sb-tabs');
      return t ? Math.round(t.getBoundingClientRect().height) : -1;
    })()
  };
});
if (M.ovf > 2) fail('มือถือ 390px · ล้นแนวนอน ' + M.ovf + 'px');
else ok('มือถือ 390px · ไม่ล้นแนวนอน');
if (M.tgl === 'none') fail('มือถือไม่มีปุ่มกางลิสต์');
else if (M.before !== 'none' || M.after === 'none') fail('ลิสต์ไม่ได้ยุบไว้ก่อน หรือกดแล้วไม่กาง (' + M.before + ' → ' + M.after + ')');
else ok('มือถือ · ลิสต์ยุบไว้ก่อน กด Browse แล้วกาง');
if (M.tabRows > 46) fail('แถวแท็บสูง ' + M.tabRows + 'px · ห่อหลายบรรทัดอีกแล้ว');
else ok('แถวแท็บแถวเดียว ' + M.tabRows + 'px');

const NOISE = /Failed to load resource|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|net::ERR_/;
const real = errors.filter(x => !NOISE.test(x));
if (real.length) { bad += real.length; real.forEach(x => console.log('  ✗ ' + x)); }
console.log('พัง ' + bad);
await close();
process.exit(bad ? 1 : 0);
