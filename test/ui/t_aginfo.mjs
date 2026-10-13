// §agSheet · แท็บ Information ของ Agent · ต้องอยู่ในโหมดตาราง ไม่ใช่กองการ์ด
//
// ที่มา (2026-09-18) · ของเดิมเป็นการ์ดมุมมนซ้อนกันเป็นชั้น ๆ ทุกอย่างมีพื้นหลังและขอบของตัวเอง
//   อ่านทีละใบได้ แต่ไล่สายตาข้ามบรรทัดไม่ได้ และกินความสูงมาก
//   ข้อมูลหน้านี้เป็นตารางโดยธรรมชาติอยู่แล้ว (โปรแกรม × ช่วงจอง × ช่วงเดินทาง)
//
// เทสนี้วัด "หน้าตา" ไม่ใช่ตัวเลข · จับได้เรื่องเดียวคือความหนาแน่นไหลกลับไปเป็นการ์ด
// ⚠ ต้องวาดใน #view-agents เท่านั้น · CSS ทั้งบล็อกถูก scope ไว้ใต้ id นั้น
//   วาดนอกนั้นจะได้สไตล์เก่าแล้วเทสจะฟ้องผิดจุด
import { open } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };
const warn = m => console.log('  ! ' + m);

const draw = async (page) => page.evaluate(() => {
  const view = document.getElementById('view-agents');
  let host = document.getElementById('ag-tabbody');
  if(!host){ host = document.createElement('div'); host.id = 'ag-tabbody'; view.appendChild(host); }
  host.style.cssText = 'background:#fff;padding:20px 24px';
  // เลือกเอเย่นต์ที่มีโปรแกรมพอให้ตารางมีความหมาย
  const a = (SB_AGENTS||[]).filter(x => (x.programPeriods||[]).length >= 5)[0] || (SB_AGENTS||[])[0];
  host.innerHTML = agTabInfo(a);
  const row  = host.querySelector('.agi-prog-row');
  const name = host.querySelector('.agi-prog-name-wrap');
  const val  = host.querySelector('.agi-period-val');
  /* §agStd · ช่องตัวเลขตัวอย่างย้ายจาก .agi-info-card มาเป็น .ag-stat
     ถามคำถามเดิม (ช่องข้อมูลต้องไม่เป็นกล่องสีทึบ) กับตัวที่วาดจริงในวันนี้
     เผื่อชื่อเก่าไว้ด้วย · ไม่มีทั้งคู่ = ไม่มีเรทผูกอยู่ ไม่ใช่ความผิดของหน้าตา */
  const card = host.querySelector('.ag-stat') || host.querySelector('.agi-info-card');
  const sale = host.querySelector('.agi-sales-card');
  const cs   = el => el ? getComputedStyle(el) : null;
  return {
    agent: a.code, n: (a.programPeriods||[]).length,
    rowH:  row  ? Math.round(row.getBoundingClientRect().height)  : -1,
    nameH: name ? Math.round(name.getBoundingClientRect().height) : -1,
    saleH: sale ? Math.round(sale.getBoundingClientRect().height) : -1,
    cardH: card ? Math.round(card.getBoundingClientRect().height) : -1,
    totalH: Math.round(host.getBoundingClientRect().height),
    rowRadius: row  ? cs(row).borderTopLeftRadius : '?',
    cardBg:    card ? cs(card).backgroundColor    : '?',
    valMono:   val  ? /mono/i.test(cs(val).fontFamily) : false,
    overflowX: Math.max(0, host.scrollWidth - host.clientWidth),

    /* ── §agStd · สามข้อที่ทำให้ของเดิม "ดูไม่เป็นมาตรฐาน" ──────────────────
       วัดตรงที่มันพัง ไม่ใช่วัดว่ามีคลาสอะไรอยู่
         1 หัวข้อเป็นแถบสีเด่นกว่าเนื้อที่มันคั่น     → พื้นหัวข้อต้องโปร่ง
         2 กล่องเรียงแบบ auto-fit ขอบแต่ละแถวไม่ตรงกัน → ขอบซ้ายต้องมีไม่กี่ค่า และกว้างเท่ากัน
         3 ป้ายกำกับกว้างไม่เท่ากันในแต่ละกล่อง        → ความกว้างป้ายต้องมีค่าเดียวทั้งหน้า */
    bandFills: [...host.querySelectorAll('.ag-band')].map(b=>{
      const c = cs(b); return c.backgroundColor + '|' + c.backgroundImage;
    }),
    bandNums: host.querySelectorAll('.ag-band .no').length,
    /* ขอบซ้ายของการ์ดทุกใบ ปัดเป็น int · กริดจริงต้องซ้ำกันไม่กี่ค่า */
    boxLefts: [...new Set([...host.querySelectorAll('.ag-box')]
      .map(b=>Math.round(b.getBoundingClientRect().left)))].sort((x,y)=>x-y),
    /* ขอบขวาด้วย · ขอบซ้ายอย่างเดียวจับไม่ได้ตอนการ์ดใบหนึ่งกว้างผิดขนาดแล้วอยู่ลำพังในแถว */
    boxRights: [...new Set([...host.querySelectorAll('.ag-box')]
      .map(b=>Math.round(b.getBoundingClientRect().right)))].sort((x,y)=>x-y),
    /* การ์ดที่ขอบบนตรงกันคือแถวเดียวกัน · แถวเดียวกันต้องกว้างเท่ากัน */
    rowWidthSpread: (function(){
      const rows = {};
      [...host.querySelectorAll('.ag-box')].forEach(b=>{
        const r = b.getBoundingClientRect();
        (rows[Math.round(r.top)] = rows[Math.round(r.top)] || []).push(Math.round(r.width));
      });
      return Math.max(0, ...Object.values(rows).map(w=>Math.max(...w)-Math.min(...w)));
    })(),
    /* การ์ดในแถวเดียวกันต้องจบที่ขอบล่างเดียวกัน · align-items:start เมื่อไหร่ ขอบล่างจะหยักทันที */
    rowBottomSpread: (function(){
      const rows = {};
      [...host.querySelectorAll('.ag-box')].forEach(b=>{
        const r = b.getBoundingClientRect();
        (rows[Math.round(r.top)] = rows[Math.round(r.top)] || []).push(Math.round(r.bottom));
      });
      return Math.max(0, ...Object.values(rows).filter(v=>v.length>1).map(v=>Math.max(...v)-Math.min(...v)));
    })(),
    /* ตารางโปรแกรม · ช่องวันสองช่องต้องกว้างเท่ากัน (ระยะห่างในตารางจึงสม่ำเสมอ)
       ส่วน "ชื่อโดนตัดไหม" ตัวจริงอยู่ใน t_aghd · ที่นั่นเป็นความกว้างจริงของแผง (722px)
       host ของเทสนี้กว้างราว 1030px จึงมีที่เหลือเฟือ ข้อนี้จับได้แค่เคสที่เพี้ยนมาก */
    progClipped: [...host.querySelectorAll('.agi-prog-name')]
      .filter(e=>e.scrollWidth > e.clientWidth + 1).length,
    progNames: host.querySelectorAll('.agi-prog-name').length,
    /* นับเฉพาะช่องที่โชว์อยู่จริง · ต่ำกว่าจอ 1440 คอลัมน์ช่วงรับจองซ่อนตัวเอง (กว้าง 0)
       ถ้าเอา 0 มาเทียบด้วย เทสจะฟ้องว่าไม่เท่ากันทุกครั้งที่จอไม่กว้างพอ ซึ่งไม่ใช่ความผิด */
    progDateW: [...new Set([...host.querySelectorAll('.agi-prog-row')].slice(0,1)
      .flatMap(r=>[...r.querySelectorAll('.agi-period-col')])
      .filter(c=>getComputedStyle(c).display!=='none')
      .map(c=>Math.round(c.getBoundingClientRect().width)))],
    labelWidths: [...new Set([...host.querySelectorAll('.ag-sh .r .k')]
      .map(k=>Math.round(k.getBoundingClientRect().width)))].sort((x,y)=>x-y),
    /* แถวเตือนต้องไม่ย้อมพื้น และต้องมีคอลัมน์ความด่วน */
    alTints: [...new Set([...host.querySelectorAll('.ag-al')]
      .map(r=>cs(r).backgroundColor))],
    alNoSev: [...host.querySelectorAll('.ag-al')].filter(r=>!r.querySelector('.sev')).length,
    nAl: host.querySelectorAll('.ag-al').length
  };
});

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1400, height: 1600 });
await page.click('.nav-item[data-view="agents"]');
await page.waitForTimeout(900);
const D = await draw(page);
console.log('Agent Information · ' + D.agent + ' · ' + D.n + ' programs');

/* ── แถวต้องเตี้ยแบบชีต ── */
if (D.rowH < 0) fail('วาดตารางไม่ออก');
else if (D.rowH > 44)
  fail('แถวสูง ' + D.rowH + 'px · กลับไปเป็นการ์ดแล้ว');
else ok('แถวสูง ' + D.rowH + 'px');

/* ── ชื่อโปรแกรมกับท่าเรือต้องอยู่บรรทัดเดียว ── */
if (D.nameH > 26)
  fail('ชื่อกับท่าเรือแยกสองบรรทัด (' + D.nameH + 'px) · แถวสูงเป็นเท่าโดยไม่ได้ข้อมูลเพิ่ม');
else ok('ชื่อโปรแกรมกับท่าเรืออยู่บรรทัดเดียว');

/* ── แถวต้องไม่ใช่การ์ดมุมมน ── */
if (parseFloat(D.rowRadius) > 4)
  fail('แถวยังมีมุมมน ' + D.rowRadius + ' · โหมดตารางไม่ควรมี');
else ok('แถวเป็นเส้นคั่น ไม่ใช่การ์ด');

/* ── ช่องข้อมูลต้องไม่เป็นกล่องสีทึบ ── */
if (D.cardBg === '?') warn('เอเย่นต์รายนี้ไม่มีช่องตัวเลขตัวอย่างให้วัด · ข้ามข้อนี้');
else if (!/rgba\(0, 0, 0, 0\)|transparent/.test(D.cardBg))
  fail('ช่องข้อมูลยังมีพื้นหลังทึบ (' + D.cardBg + ')');
else ok('ช่องข้อมูลแบนราบ คั่นด้วยเส้น');

/* ── วันที่ต้องเป็นตัวเลขเรียงหลัก ── */
if (!D.valMono) warn('ช่องวันที่ไม่ได้ใช้ฟอนต์ mono · ตัวเลขอาจไม่ตรงหลัก');
else ok('ช่องวันที่ใช้ฟอนต์เรียงหลัก');

/* ── คนดูแลต้องเป็นบรรทัดเดียว ── */
if (D.saleH > 52) fail('แถบคนดูแลสูง ' + D.saleH + 'px · ควรเป็นบรรทัดเดียว');
else ok('แถบคนดูแลสูง ' + D.saleH + 'px');

if (D.overflowX > 2) fail('ล้นแนวนอน ' + D.overflowX + 'px');
else ok('ไม่ล้นแนวนอน');
console.log('  · ความสูงทั้งแท็บ ' + D.totalH + 'px');

/* ══ §agStd · กติกาของชุดมาตรฐาน ════════════════════════════════════════════ */
const painted = D.bandFills.filter(f => !/rgba\(0, 0, 0, 0\)\|none/.test(f));
if (painted.length)
  fail(painted.length + ' หัวข้อยังมีพื้นสี · หัวข้อต้องเบากว่าเนื้อที่มันคั่น (' + painted[0] + ')');
else if (D.bandNums)
  fail('หัวข้อยังมีเลขกำกับในวงกลม ' + D.bandNums + ' อัน');
else ok('หัวข้อเป็นป้ายเรียบ ไม่มีพื้นสี ไม่มีเลขกำกับ');

/* จอ 1400 ของเทสนี้ = สองใบต่อแถว · เส้นกริดที่การ์ดได้จึงมีแค่ซ้าย/กลาง และ กลาง/ขวา
   เกินกว่านั้นแปลว่ามีใบไหนกว้างไม่ลงล็อก — ซึ่งคือสิ่งที่ auto-fit ของเดิมทำอยู่ */
if (D.boxLefts.length > 2)
  fail('การ์ดเริ่มที่ขอบซ้าย ' + D.boxLefts.length + ' ตำแหน่ง · กริดไม่ลงคอลัมน์เดียวกัน · ' + D.boxLefts.join(', '));
else if (D.boxRights.length > 2)
  fail('การ์ดจบที่ขอบขวา ' + D.boxRights.length + ' ตำแหน่ง · มีใบกว้างไม่ลงล็อก · ' + D.boxRights.join(', '));
else if (D.rowWidthSpread > 2)
  fail('การ์ดในแถวเดียวกันกว้างไม่เท่ากัน ต่างกัน ' + D.rowWidthSpread + 'px');
else if (D.rowBottomSpread > 2)
  fail('การ์ดในแถวเดียวกันจบไม่ตรงกัน ขอบล่างต่างกัน ' + D.rowBottomSpread + 'px');
else ok('การ์ดเกาะกริดเดียวกัน · ขอบซ้าย ' + D.boxLefts.join(' / ') + ' · ขอบขวา ' + D.boxRights.join(' / ') + ' · ขอบล่างตรงกันทุกแถว');

if (!D.progNames) console.log('  ! เอเย่นต์รายนี้ไม่มีโปรแกรมให้วัด · ข้ามข้อตาราง');
else if (D.progClipped)
  fail('ชื่อเส้นทางโดนตัด ' + D.progClipped + ' จาก ' + D.progNames + ' แถว · คอลัมน์แบ่งไม่พอดี');
else if (D.progDateW.length > 1)
  fail('ช่องวันสองช่องกว้างไม่เท่ากัน (' + D.progDateW.join(', ') + ') · ระยะห่างในตารางไม่สม่ำเสมอ');
else ok('ตารางโปรแกรม · ชื่อเส้นทางครบทุกแถว · ช่องวันกว้างเท่ากัน ' + D.progDateW[0] + 'px');

if (D.labelWidths.length > 1)
  fail('ป้ายกำกับกว้างไม่เท่ากัน ' + D.labelWidths.length + ' ขนาด (' + D.labelWidths.join(', ') + ') · ค่าเลยไม่เรียงเป็นคอลัมน์');
else ok('ป้ายกำกับกว้างเท่ากันทั้งหน้า · ' + D.labelWidths[0] + 'px');

if (!D.nAl) console.log('  ! เอเย่นต์รายนี้ไม่มีเรื่องค้าง · ข้ามข้อแถบเตือน');
else if (D.alTints.some(c => !/rgba\(0, 0, 0, 0\)|rgb\(255, 255, 255\)/.test(c)))
  fail('แถวเตือนยังย้อมพื้นทั้งแถว (' + D.alTints.join(' / ') + ') · ทุกเรื่องเลยดูด่วนเท่ากันหมด');
else if (D.alNoSev)
  fail(D.alNoSev + ' แถวเตือนไม่มีคอลัมน์ความด่วน');
else ok('แถวเตือน ' + D.nAl + ' แถว · ไม่ย้อมพื้น · มีคอลัมน์ความด่วนครบ');

/* ── มือถือ · กฎใน 02-skins.css ต้องยังชนะบล็อกนี้ ─────────────────────────
   บล็อก §agSheet เป็น CSS ชั้นบน · ถ้าวันไหนเขียนแรงกว่ากฎมือถือ ตารางจะไม่ยุบเป็นคอลัมน์เดียว
   แล้วหน้าจะล้นออกนอกจอบนมือถือ · ข้อนี้กันเรื่องนั้น */
await page.setViewportSize({ width: 390, height: 812 });
await page.waitForTimeout(400);
const M = await draw(page);
if (M.overflowX > 4)
  fail('มือถือ 390px · ล้นแนวนอน ' + M.overflowX + 'px · กฎมือถือถูก §agSheet ทับ');
else ok('มือถือ 390px · ไม่ล้นแนวนอน');

const NOISE = /Failed to load resource|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|net::ERR_/;
const real = errors.filter(x => !NOISE.test(x));
if (real.length) { bad += real.length; real.forEach(x => console.log('  ✗ ' + x)); }
console.log('พัง ' + bad);
await close();
process.exit(bad ? 1 : 0);
