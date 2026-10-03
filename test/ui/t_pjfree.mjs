// §pjFreeAll / §pjGdTight · ใบงานเรือ · เรือเช่าพิมพ์ชื่อลูกเรือเองได้ทุกช่อง · แถวไกด์กระชับ
//
// ที่มา (2026-10-03) · ผู้ใช้ส่งภาพการ์ด LKC66 (เรือเช่า) เทียบกับ Hermetis
//   "Captain และตำแหน่งอื่น ๆ ที่เพิ่มเข้ามาของ Captain & Crew ควรพิมพ์อิสระได้ เพราะเป็นเรือเช่ามา
//    ส่วนของไกด์ ควรจัดให้กระชับเหมือนของ Hermetis
//    พอเปลี่ยนชื่อ ตรวจสอบว่าไปเพิ่มในทะเบียนรายชื่อผู้เดินทางเข้า-ออกด้วยไหม"
//
// กันแปดอย่าง
//   1 เรือเช่า · ทุกช่องของ Captain & Crew (รวมช่องที่กดเพิ่ม) เป็นช่องพิมพ์ ไม่ใช่เมนูเลือก
//   2 พิมพ์ชื่อที่ไม่อยู่ในทะเบียน · เก็บตามที่พิมพ์ และขึ้นบนการ์ดหลังวาดใหม่
//   3 พิมพ์ตรงกับคนในทะเบียน · เก็บเป็นรหัสคนนั้น (ไม่กลายเป็นคนละคน)
//   4 ทะเบียนรายชื่อผู้เดินทางเข้า-ออก ได้ชื่อที่พิมพ์ครบทุกช่อง พร้อมตำแหน่ง
//   5 เปลี่ยนชื่อบนการ์ด · ทะเบียนเปลี่ยนตาม ชื่อเก่าไม่ค้าง
//   6 เรือของบริษัทเอง · ยังเป็นเมนูเลือกจากทะเบียนเหมือนเดิม
//   7 แถวไกด์ตอนแก้ไข · ป้ายหัวหน้า/ภาษาอยู่บรรทัดเดียวกับชื่อ · แถวสูงไม่เกินชื่อสองบรรทัด (เดิม 71px)
//   8 ชื่อที่พิมพ์รอดทางไป-กลับของเซิร์ฟเวอร์ · ไม่มี error บนหน้า
import { open } from './_harness.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const _require = createRequire(import.meta.url);
const osRepo = _require(path.join(path.dirname(fileURLToPath(import.meta.url)), '../../os-backend/src/mapping/os_repo.js'));

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

/* การ์ดกว้างคงที่ ~292px ไม่ว่าจอจะกว้างเท่าไหร่ · ภาพที่ผู้ใช้ส่งมาถูกซูม 1.5 เท่า */
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1000, height: 1300 });
page.on('dialog', d => d.accept());
await page.waitForTimeout(900);

const S = await page.evaluate(() => {
  const D = '2026-09-23';
  let pick = null;
  for (const pier of (PO_PIERS || []).map(x => x.k)){
    const mine = (BOATS || []).filter(x => (x.pier || '') === pier);
    const rt = (ROUTES || []).find(r => (r.pier || '') === pier) || (ROUTES || [])[0];
    if (mine.length < 2 || !rt) continue;
    TRIPS[D] = TRIPS[D] || {};
    mine.forEach(b => { if (!TRIPS[D][b.id]) TRIPS[D][b.id] = { route:rt.id, type:'normal', booked:0 }; });
    _poDate = D; _poPier = pier;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const v = document.getElementById('view-poj-' + pier); if (v) v.classList.add('active');
    renderPierJob(pier);
    const run = [...document.querySelectorAll('.pj-pop[id^="pjwb-"] .pj-sw[onclick]')]
      .map(sw => (/pjWbSet\('([^']+)'/.exec(sw.getAttribute('onclick') || '') || [])[1]).filter(Boolean);
    const ids = [...new Set(run)];
    if (ids.length >= 2){ pick = { pier, rent: ids[0], own: ids[1] }; break; }
  }
  if (!pick) return { err:'need two running boats on one pier' };
  if (typeof poCanEdit === 'function' && !poCanEdit()) return { err:'this user cannot edit' };
  const br = (BOATS || []).find(b => b.id === pick.rent), bo = (BOATS || []).find(b => b.id === pick.own);
  /* เรือเช่าต้องมีช่วงเช่าคลุมวันนั้น ไม่งั้นหน้านี้ถือว่าไม่มีเรือ (§chWin) · สถานะเดียวกับที่ลำนี้เป็นอยู่ */
  const stWas = (pjLogAt(br, D) || {}).s || 'available';
  br.ownership = 'charter'; bo.ownership = 'own';
  br.log = (br.log || []).concat([{ from: D, to: D, s: stWas, reason: 't-pjfree' }]);
  pjSet(D, pick.rent, { cap:'', asst:'', crew:[], island:[], lock:0 });
  const st = (PIER_STAFF || []).filter(s => s.active !== false)[0];
  renderPierJob(pick.pier);
  return Object.assign(pick, { D, staffId: st.id, staffName: pjStaffName(st.id) });
});
if (S.err){ console.log('  ! ' + S.err + ' · skipped'); console.log('\nพัง 0'); await close(); process.exit(0); }

const card = bid => `.bc:has(#pjwb-${bid.replace(/[^A-Za-z0-9_-]/g, '_')})`;
const inp = slot => `${card(S.rent)} input.pj-free[data-pjfree="${slot}"]`;
const type = async (slot, txt) => { await page.click(inp(slot), { clickCount: 3 }); await page.keyboard.press('Backspace');
  await page.keyboard.type(txt); await page.keyboard.press('Tab'); await page.waitForTimeout(250); };

/* ══ 1 · ทุกช่องเป็นช่องพิมพ์ ══ */
await page.evaluate(p => { ['asst', 'crew0', 'island0'].forEach(s => pjSlotAdd(p.rent, s)); }, S);
await page.waitForTimeout(250);
const R1 = await page.evaluate(sel => { const c = document.querySelector(sel); if (!c) return { err: 'card not found' };
  const sec = [...c.querySelectorAll('.pj-rw')].filter(r => r.querySelector('input.pj-free') || r.querySelector('.pj-sel'));
  const free = [...c.querySelectorAll('input.pj-free')].map(i => i.getAttribute('data-pjfree'));
  const crewSel = [...c.querySelectorAll('.pj-rw:not(.pj-gdr) .pj-sel select')].length;
  return { free, crewSel, dl: c.querySelectorAll('datalist option').length, list: (c.querySelector('input.pj-free') || {}).getAttribute ? c.querySelector('input.pj-free').getAttribute('list') : '' };
}, card(S.rent));
if (!R1.err && R1.free.join() === 'cap,asst,crew0,island0' && R1.crewSel === 0 && R1.dl > 0 && R1.list)
  ok('1 เรือเช่า · Captain / Asst. Captain / Crew 1 / Island Staff 1 เป็นช่องพิมพ์ทั้งหมด (มีรายชื่อทะเบียน ' + R1.dl + ' คนให้เลือกตอนพิมพ์)');
else fail('1 ' + JSON.stringify(R1));

/* ══ 2–3 · พิมพ์ ══ */
await type('cap', 'T-FREE CAPTAIN ONE');
await type('asst', 'T-FREE ENGINEER');
await type('crew0', 'T-FREE DECKHAND');
await type('island0', S.staffName);
const R2 = await page.evaluate(p => { const J = pjOf(p.D, p.rent);
  const c = document.querySelector(p.card);
  return { cap: J.cap, asst: J.asst, crew: J.crew, island: J.island,
    shown: [...c.querySelectorAll('input.pj-free')].map(i => i.value) }; }, Object.assign({ card: card(S.rent) }, S));
if (R2.cap === 'T-FREE CAPTAIN ONE' && R2.asst === 'T-FREE ENGINEER' && R2.crew[0] === 'T-FREE DECKHAND'
    && R2.shown.slice(0, 3).join('|') === 'T-FREE CAPTAIN ONE|T-FREE ENGINEER|T-FREE DECKHAND')
  ok('2 พิมพ์ชื่อคนของเจ้าของเรือลงสามช่อง · เก็บตามที่พิมพ์ และยังขึ้นบนการ์ดหลังวาดใหม่');
else fail('2 ' + JSON.stringify(R2));
if (R2.island[0] === S.staffId && R2.shown[3] === S.staffName) ok('3 พิมพ์ตรงกับคนในทะเบียน · เก็บเป็นรหัสของคนนั้น ชื่อบนการ์ดเหมือนเดิม');
else fail('3 ' + JSON.stringify({ got: R2.island, want: S.staffId, shown: R2.shown[3] }));

/* ══ 4 · ทะเบียนรายชื่อผู้เดินทาง ══ */
const reg = () => page.evaluate(p => pckTravelCrew(p.rent, p.D).filter(x => x.grp !== 'guide').map(x => x.pos + ':' + x.name), S);
const R4 = await reg();
const want4 = ['กัปตัน:T-FREE CAPTAIN ONE', 'ช่างเครื่อง:T-FREE ENGINEER', 'คนเรือ:T-FREE DECKHAND', 'ผช. ไกด์:' + S.staffName];
if (want4.every(w => R4.indexOf(w) >= 0)) ok('4 ทะเบียนรายชื่อผู้เดินทางเข้า-ออก ได้ครบสี่คน พร้อมตำแหน่ง (กัปตัน · ช่างเครื่อง · คนเรือ · ผช. ไกด์)');
else fail('4 ' + JSON.stringify(R4));

/* ══ 5 · เปลี่ยนชื่อ ══ */
await type('cap', 'T-FREE CAPTAIN TWO');
const R5 = await reg();
const html5 = await page.evaluate(p => { try { return (typeof pckTravelRegHtml === 'function') ? String(pckTravelRegHtml(p.rent, p.D)) : ''; } catch (e) { return ''; } }, S);
if (R5.indexOf('กัปตัน:T-FREE CAPTAIN TWO') >= 0 && !R5.some(x => /CAPTAIN ONE/.test(x)))
  ok('5 เปลี่ยนชื่อกัปตันบนการ์ด · ทะเบียนเปลี่ยนตามทันที ชื่อเก่าไม่ค้าง');
else fail('5 ' + JSON.stringify(R5));

/* ══ 6 · เรือของบริษัทเอง ══ */
const R6 = await page.evaluate(sel => { const c = document.querySelector(sel); if (!c) return { err: 'card not found' };
  return { free: c.querySelectorAll('input.pj-free').length, sel: c.querySelectorAll('.pj-rw:not(.pj-gdr) .pj-sel select').length }; }, card(S.own));
if (!R6.err && R6.free === 0 && R6.sel >= 1) ok('6 เรือของบริษัทเอง · ยังเป็นเมนูเลือกจากทะเบียน (' + R6.sel + ' ช่อง) ไม่มีช่องพิมพ์');
else fail('6 ' + JSON.stringify(R6));

/* ══ 7 · แถวไกด์กระชับ ══ */
const R7 = await page.evaluate(async p => {
  const gs = (typeof goGuides === 'function' ? goGuides() : []).filter(g => g && g.active !== false && g.name);
  if (gs.length < 2) return { err: 'need 2 guides' };
  const len = g => ((g.name || '') + (g.nick || '')).length;
  const byLen = gs.slice().sort((a, z) => len(z) - len(a));
  /* ชื่อยาวระดับเดียวกับในภาพ (~30 ตัวอักษร) · คนที่ยาวผิดปกติไม่ใช่เคสที่ผู้ใช้ชี้ */
  const cand = byLen.filter(g => len(g) <= 32);
  const g1 = cand[0] || byLen[byLen.length - 1], g2 = cand[1] || byLen[byLen.length - 2];
  pjGdPick(p.rent, 'gd', 0, g1.id); pjGdAddSlot(p.rent, 'gd'); pjGdPick(p.rent, 'gd', 1, g2.id);
  await new Promise(z => setTimeout(z, 300));
  const c = document.querySelector(p.card);
  const rows = [...c.querySelectorAll('.pj-rw.pj-gdr')].filter(r => r.querySelector('.pj-lgs') || r.querySelector('.pj-tag'));
  return { cardW: Math.round(c.getBoundingClientRect().width), n: rows.length,
    rows: rows.map(r => { const sel = r.querySelector('.pj-sel').getBoundingClientRect();
      const chips = [...r.querySelectorAll('.pj-lgs, .pj-tag')].map(x => x.getBoundingClientRect());
      const mid = b => b.top + b.height / 2;
      return { h: Math.round(r.getBoundingClientRect().height), selW: Math.round(sel.width),
        same: chips.every(b => mid(b) >= sel.top - 1 && mid(b) <= sel.bottom + 1),
        nm: (r.querySelector('.pj-nm') || {}).textContent, nch: chips.length }; }) };
}, Object.assign({ card: card(S.rent) }, S));
if (!R7.err && R7.n >= 2 && R7.rows.every(r => r.same && r.selW >= 70 && r.h <= 48))
  ok('7 การ์ดกว้าง ' + R7.cardW + 'px · แถวไกด์ ' + R7.n + ' แถว ป้ายอยู่บรรทัดเดียวกับชื่อทุกแถว (สูง ' + R7.rows.map(r => r.h).join('/') + 'px)');
else fail('7 ' + JSON.stringify(R7));

/* ══ 8 · ทางไป-กลับของเซิร์ฟเวอร์ ══ */
const SRV = await page.evaluate(p => { const DD = JSON.parse(localStorage.getItem('loveandaman_v2') || '{}');
  const k = Object.keys(DD.pier_job || {}).filter(x => x.indexOf(p.rent) >= 0 && x.indexOf(p.D) >= 0);
  const o = {}; k.forEach(x => o[x] = DD.pier_job[x]); return { pier_job: o }; }, S);
const BACK = osRepo.assembleBlob(osRepo.decomposeBlob(SRV));
const flat = B => Object.values(B.pier_job || {}).map(j => [j.cap, j.asst, (j.crew || []).join(','), (j.island || []).join(',')].join('/')).join(' ; ');
const realErr = errors.filter(e => !/Failed to load resource/.test(e));
if (Object.keys(SRV.pier_job).length === 1 && /T-FREE CAPTAIN TWO\/T-FREE ENGINEER\/T-FREE DECKHAND\//.test(flat(SRV)) && flat(BACK) === flat(SRV) && !realErr.length)
  ok('8 ชื่อที่พิมพ์อยู่ในที่เก็บ และรอดทางไป-กลับของเซิร์ฟเวอร์ · ไม่มี error บนหน้า');
else fail('8 ' + JSON.stringify({ srv: flat(SRV), back: flat(BACK), realErr: realErr.slice(0, 2) }));

await close();
console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed');
process.exit(bad ? 1 : 0);
