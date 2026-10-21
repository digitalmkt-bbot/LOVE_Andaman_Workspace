// §invMove · Memo บอกยอดคงคลัง + Movement ต่อบรรทัด · Stock card (พิมพ์ / Excel / Copy text) · จับคู่ชื่อ/เบอร์ตอนสร้าง Memo
// ข้อมูล: LAD=allotment_v2/data_exports/subset_inv1020.json (ตัดจาก backup_2026-10-20)
import { open } from './_harness.mjs';
let bad = 0; const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1440, height: 1000 });
page.on('dialog', d => d.accept());
const OUT = process.env.OUT || '/mnt/user-data/outputs';
const r = await page.evaluate(async () => {
  const z = ms => new Promise(f => setTimeout(f, ms));
  nav(document.querySelector('.nav-item[data-view="fl-inventory"]')); await z(500);
  const ID = 'i_auto_muktl9vf_j8sspk';
  const it = _invAll().find(x => x.id === ID);
  const L = ivmLedger(it, { days: 90 });
  const led = { opening: L.opening, tin: L.tin, tout: L.tout, closing: L.closing, bals: L.rows.map(r => r.bal), refs: L.rows.map(r => r.R.ref + ':' + (r.R.boat || (r.R.spare ? 'spare' : ''))),
    bought: Object.fromEntries(Object.entries(L.bought).map(([k, v]) => [k, v.q])), used: Object.fromEntries(Object.entries(L.used).map(([k, v]) => [k, v.q])) };
  // ทุกรายการ: ยอดปิดของบัญชี = ยอดใน stocks[] เสมอ
  let mism = 0; _invAll().forEach(x => { const a = ivmLedger(x, { days: 0 }); if (Math.abs(a.closing - ivmNow(x).total) > 1e-6) mism++; const b = a.rows.length ? a.rows[a.rows.length - 1].bal : a.opening; if (Math.abs(b - a.closing) > 1e-6) mism++; });
  const fz = ivmFuzzy('กรองเบนซิน แรงดันสูง 16910-ZVL-003', '', ID).map(o => o.x.id);
  const fzNone = ivmFuzzy('เพลาข้อเหวี่ยง ไม่มีในระบบแน่นอน XYZ-99999', '', null).length;
  // 1) เปิดดู Memo
  const mo = FL_MEMOS.find(m => m.no === 'MO-196');
  flViewMemo(mo.id); await z(250);
  const B = document.getElementById('memoview-body');
  const banner = B.textContent.match(/\d+ จาก \d+ รายการมีของอยู่ในคลังแล้ว/);
  const heads = [...B.querySelectorAll('thead th')].map(t => t.textContent.trim());
  const idx = mo.items.findIndex(x => x.invId === ID);
  const rowTxt = B.querySelectorAll('tbody tr')[idx * 2].textContent;
  ivmMemoToggle(idx, ID); await z(100);
  const mx = document.getElementById('ivm-mx-' + idx);
  const mxRows = mx.querySelectorAll('tbody tr').length, mxTxt = mx.textContent;
  const width = B.closest('.modal').getBoundingClientRect().width;
  return { led, mism, fz, fzNone, banner: banner && banner[0], heads, rowTxt, mxRows, mxTxt, width, idx, moId: mo.id };
});
await page.screenshot({ path: OUT + '/invmove_memo.png' });
const R = JSON.stringify(r).slice(0, 1200);
const L = r.led;
if (L.opening === 0 && L.tin === 15 && L.tout === 7 && L.closing === 8) ok('กรองเบนซิน แรงดันสูง · ยกมา 0 รับ +15 เบิก −7 คงเหลือ 8'); else fail('ledger ' + R);
if (JSON.stringify(L.bals) === JSON.stringify([0, 4, 7, 10, 12, 15, 11, 8])) ok('ยอดคงเหลือรายบรรทัด ' + L.bals.join(' → ')); else fail('bals ' + JSON.stringify(L.bals));
if (L.refs.includes('MO-212:Okeanos') && L.refs.includes('MO-216:spare') && L.refs.includes('MJ-142:Artemis') && L.refs.includes('MJ-143:Verona')) ok('อ้างอิงระบุเรือ · ' + L.refs.join(' | ')); else fail('refs ' + JSON.stringify(L.refs));
if (L.bought.Okeanos === 3 && L.bought['สแปร์'] === 4 && L.used.Artemis === 4 && L.used.Verona === 3) ok('ซื้อเพื่อ ' + JSON.stringify(L.bought) + ' · เบิกให้ ' + JSON.stringify(L.used)); else fail('by boat ' + R);
if (r.mism === 0) ok('ทุกรายการในคลัง ยอดปิดของบัญชีตรงกับ stocks[] (ทั้งหมด)'); else fail('mismatch ' + r.mism);
if (r.fz.includes('imsu8tjpo15k4d') && r.fzNone === 0) ok('จับคู่เบอร์อะไหล่ · เจอรายการเดิม imsu8tjpo15k4d (ลงซ้ำ) · ชื่อมั่ว ๆ ไม่เจอ'); else fail('fuzzy ' + R);
if (r.banner && /จาก 23/.test(r.banner)) ok('Memo MO-196 · ' + r.banner); else fail('banner ' + R);
if (r.heads.includes('คงคลังตอนนี้') && r.heads.some(h => /Movement/.test(h)) && r.width > 800) ok('ตาราง Memo มีคอลัมน์ คงคลัง + Movement · กว้าง ' + Math.round(r.width)); else fail('heads ' + R);
if (/มีในคลัง 8/.test(r.rowTxt) && /TL 8/.test(r.rowTxt) && /\+15/.test(r.rowTxt) && /คล้ายกัน/.test(r.rowTxt)) ok('บรรทัด 19 · มีในคลัง 8 · TL 8 · +15/−7 · เตือนรายการคล้ายกัน'); else fail('row ' + r.rowTxt.slice(0, 300));
if (r.mxRows >= 4 && /MJ-142/.test(r.mxTxt) && /Artemis/.test(r.mxTxt) && /เปิดรายงานฉบับเต็ม/.test(r.mxTxt)) ok('กด Movement · บัญชีย่อย ' + r.mxRows + ' แถว (รับวันเดียวกันรวมแถว)'); else fail('mini ' + r.mxTxt.slice(0, 300));

// 2) Stock card
const s = await page.evaluate(async () => {
  const z = ms => new Promise(f => setTimeout(f, ms));
  ivmReportOpen('i_auto_muktl9vf_j8sspk'); await z(150);
  const sh = document.getElementById('ivm-sheet');
  const sm = [...sh.querySelectorAll('.sm b')].map(b => b.textContent);
  const nRows = sh.querySelectorAll('tbody tr').length;
  const txt = ivmText();
  const sig = [...sh.querySelectorAll('.sig div')].map(d => d.textContent);
  const boats = sh.querySelector('.bb').textContent;
  ivmSet('wh', 'TL'); await z(80); const tl = [...document.querySelectorAll('#ivm-sheet .sm b')].map(b => b.textContent);
  ivmSet('days', 0); await z(80); const all = [...document.querySelectorAll('#ivm-sheet .sm b')].map(b => b.textContent);
  ivmSet('wh', 'all'); ivmSet('days', 90); await z(80);
  const aoa = ivmAoa();
  return { sm, nRows, txt, sig, boats, tl, all, aoaN: aoa.length, aoaHead: aoa[7] };
});
await page.screenshot({ path: OUT + '/invmove_report.png', fullPage: false });
if (JSON.stringify(s.sm) === JSON.stringify(['0', '+15', '−7', '8', '฿5,088'])) ok('สรุป 5 กล่อง · ' + s.sm.join(' / ')); else fail('summary ' + JSON.stringify(s));
if (s.nRows === 10) ok('ตาราง · ยกมา + 8 บรรทัด + รวม'); else fail('rows ' + s.nRows);
const T = s.txt.split('\n');
if (/^📦 Stock card · กรองเบนซิน แรงดันสูง 16910-ZVL-003$/.test(T[0]) && /ยกมา 0 · รับ \+15 · เบิก −7 · คงเหลือ 8 \(฿5,088\)/.test(T[2])
  && T.some(l => /^10 ต\.ค\. รับ \+3 MO-212 · Okeanos @TL → 15$/.test(l)) && T.some(l => /^15 ต\.ค\. เบิก −3 MJ-143 · Verona @TL → 8$/.test(l))
  && T.some(l => /^ซื้อเพื่อ: .*Okeanos 3/.test(l)) && T.some(l => /^เบิกให้: Artemis 4 · Verona 3$/.test(l))) ok('Copy text ตามรูปแบบที่ตกลง'); else fail('text\n' + s.txt);
if (s.sig.join('|') === 'ผู้จัดทำ|ผู้ตรวจสอบ|ผู้อนุมัติ') ok('ช่องลงชื่อ 3 ช่อง'); else fail('sig ' + s.sig);
if (/Okeanos · MO-212/.test(s.boats) && /Artemis · MJ-142/.test(s.boats) && /ยังไม่มีการเบิกให้/.test(s.boats)) ok('ซื้อเพื่อเรือ / เบิกให้เรือ + หมายเหตุเรือที่ยังไม่เบิก'); else fail('boats ' + s.boats);
if (s.tl[3] === '8' && s.all[3] === '8') ok('สลับคลัง TL / ทั้งหมด · ยอดปิดยังเป็น 8'); else fail('toggle ' + JSON.stringify(s));
if (s.aoaN > 15 && s.aoaHead.join(',') === 'วันที่,รายการ,อ้างอิง,เรือ,คลัง,รับ,เบิก,คงเหลือ') ok('Excel · ' + s.aoaN + ' แถว'); else fail('aoa ' + JSON.stringify(s.aoaHead));
// Excel download works
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }).catch(() => null), page.evaluate(() => ivmExcel())]);
if (dl && /stockcard_.*\.(xlsx|csv)$/.test(dl.suggestedFilename())) ok('ดาวน์โหลด ' + dl.suggestedFilename()); else fail('download');
// Print: เฉพาะแผ่นรายงาน
await page.evaluate(() => document.body.classList.add('ivm-print')); await page.emulateMedia({ media: 'print' });
const pv = await page.evaluate(() => ({ bar: getComputedStyle(document.querySelector('#ivm .bar')).display, app: [...document.body.children].filter(e => e.id !== 'ivm' && getComputedStyle(e).display !== 'none' && e.tagName !== 'SCRIPT' && e.tagName !== 'STYLE').length }));
await page.pdf({ path: OUT + '/invmove_report.pdf', format: 'A4', printBackground: false });
await page.emulateMedia({ media: 'screen' }); await page.evaluate(() => document.body.classList.remove('ivm-print'));
if (pv.bar === 'none' && pv.app === 0) ok('พิมพ์ · ซ่อนแถบปุ่มและหน้าแอป'); else fail('print ' + JSON.stringify(pv));

// 3) สร้าง Memo · พิมพ์ชื่อที่มีเบอร์ตรงของในคลัง → เสนอให้ผูกแทนสร้างซ้ำ
const c = await page.evaluate(async () => {
  const z = ms => new Promise(f => setTimeout(f, ms));
  ivmReportClose(); closeModal('fl-modal-memoview');
  _memoType = 'parts';
  _memoItems = [{ name: 'กรองเบนซิน 16910-ZVL-003 ใหม่', qty: 2, price: 650, invId: null, fromInventory: false, autoRegister: true, unit: 'ชิ้น', category: 'parts' },
                { name: 'ค่าแรงช่าง', qty: 1, price: 500, invId: null, autoRegister: false, category: 'parts' }];
  openModal('fl-modal-memo'); memoRenderItems(); await z(80);
  const tb = document.getElementById('memo-items-tbody');
  const hint = tb.querySelectorAll('tr')[0].textContent;
  const btns = tb.querySelectorAll('tr')[0].querySelectorAll('button');
  const useBtn = [...btns].find(b => /ใช้รายการนี้/.test(b.textContent));
  const second = tb.querySelectorAll('tr')[1].textContent;
  if (useBtn) useBtn.click(); await z(80);
  const it0 = _memoItems[0];
  const after = document.getElementById('memo-items-tbody').querySelectorAll('tr')[0].textContent;
  closeModal('fl-modal-memo');
  // 4) แผงรายการในหน้า Stock items มีปุ่ม Stock card
  _invTab = 'stock'; _selInvId = 'i_auto_muktl9vf_j8sspk'; flRenderInventory(); await z(150);
  const btn = [...document.querySelectorAll('button')].some(b => /Stock card/.test(b.textContent) && /ivmReportOpen/.test(b.getAttribute('onclick') || ''));
  return { hint, second, linked: { invId: it0.invId, auto: it0.autoRegister, from: it0.fromInventory }, after, btn };
});
await page.screenshot({ path: OUT + '/invmove_stockitem.png' });
if (/มีในคลังแล้ว\?/.test(c.hint) && /ใช้รายการนี้/.test(c.hint)) ok('สร้าง Memo · เสนอ "มีในคลังแล้ว? … ใช้รายการนี้"'); else fail('hint ' + c.hint.slice(0, 300));
if (!/มีในคลังแล้ว\?/.test(c.second)) ok('ชื่อที่ไม่ตรงอะไร ไม่มีป้ายรบกวน'); else fail('second ' + c.second);
if (c.linked.invId && c.linked.auto === false && c.linked.from === true && /มีในคลัง/.test(c.after) && /Inv/.test(c.after)) ok('กดใช้ → ผูก ' + c.linked.invId + ' · ไม่ลงทะเบียนใหม่ · ขึ้นยอดคงคลัง'); else fail('link ' + JSON.stringify(c));
if (c.btn) ok('หน้า Stock items · ปุ่ม 📄 Stock card ในแผงรายการ'); else fail('detail btn');
if (errors.length) { fail('page errors'); console.log('    errors:', errors.slice(0, 3)); }
console.log(bad ? `FAIL ${bad}` : 'PASS'); await close(); process.exit(bad ? 1 : 0);
