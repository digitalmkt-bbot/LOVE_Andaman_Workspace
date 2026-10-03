// §moCxl · Memo ที่กดยกเลิกแล้ว ต้องยังหาเจอในหน้า Inventory / Memo
//
// ที่มา (2026-09-25) · ผู้ใช้ถามเอง · "มันมีรายการที่กดยกเลิกไป ในนี้ถูกย้ายไปไหน"
// บนจอของจริง · Memorandum 191 ใบ แต่ Active 101 + Archive 84 = 185 · หาย 6 ใบ
//
// ของเดิมแบ่งสองแท็บด้วยรายการสถานะที่เขียนไว้ตายตัว
//   Active  = created / pending_approval / approved / ordered / received
//   Archive = paid
// cancelled ไม่อยู่ในชุดไหนเลย · ใบที่กดยกเลิกจึงหลุดจากลิสต์ทั้งที่ยังอยู่ในระบบ
// ใบที่ผูกกับงานซ่อมยังเปิดดูได้จากแผงงานซ่อม · แต่ใบที่ไม่ผูกกับอะไรเลย
// (ค่าผ่านทาง · ค่าลากเรือ) จะเข้าถึงไม่ได้อีกเลย
//
// เทสนี้กันเจ็ดอย่าง
//   1 ไม่มีใบไหนหลุดจากทั้งสองแท็บ · Active + Archive = ทั้งหมดเสมอ
//   2 ใบที่ยกเลิกอยู่ในแท็บ Archive และเห็นในตารางจริง (ทั้งใบที่ผูกงานซ่อมและใบลอย)
//   3 แถวของใบที่ยกเลิกขึ้นสถานะ CANCELLED พร้อมเหตุผลที่กรอกไว้
//   4 ใบที่ยกเลิกต้องไม่มีปุ่มเดินขั้นต่อไป (ของเดิมขึ้น "ส่งขออนุมัติ" ให้ใบที่ตายแล้ว)
//   5 ปุ่มกรอง Cancelled เลือกได้เฉพาะใบที่ยกเลิก · Paid ต้องไม่ติดมาด้วย
//   6 ยอดรวมรายเดือนไม่นับเงินของใบที่ยกเลิก แต่ยังนับจำนวนใบและบอกว่ายกเลิกกี่ใบ
//   7 แท็บ Active ต้องไม่มีใบที่ยกเลิกปนเข้ามา
//
// ⚠ ทุกข้อคำนวณค่าที่คาดหวังจาก FL_MEMOS ดิบเอง ไม่เรียกตัวกรองที่หน้าจอใช้
import { open } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1800, height: 1200 });
const REASON = 'ทดสอบยกเลิก';
page.on('dialog', d => d.accept(REASON));
await page.waitForTimeout(1200);

/* ══ 0 · ยกเลิกสองใบ · ใบหนึ่งผูกกับงานซ่อม อีกใบไม่ผูกกับอะไรเลย ═════════ */
const SETUP = await page.evaluate(() => {
  const M = (typeof FL_MEMOS !== 'undefined' ? FL_MEMOS : []);
  if (!M.length) return { err: 'ไม่มี memo ในชุดข้อมูลนี้' };
  const live = m => m.status !== 'paid' && m.status !== 'cancelled';
  const withJob = M.find(m => live(m) && m.maintId);
  const bare    = M.find(m => live(m) && !m.maintId && !m.projectId);
  const picked  = [withJob, bare].filter(Boolean);
  if (!picked.length) return { err: 'ไม่มี memo ที่ยกเลิกได้' };
  const before = { total: M.length, spend: M.filter(m => m.status !== 'cancelled')
                                          .reduce((s, m) => s + (m.amount || 0), 0) };
  picked.forEach(m => flCancelMemo(m.id));
  /* ปิด modal ที่ flCancelMemo เปิดค้างไว้ · ไม่งั้นข้อความในนั้นปนกับที่อ่านจากตาราง */
  try { if (typeof closeModal === 'function') closeModal('fl-modal-memo'); } catch (e) {}
  document.querySelectorAll('.modal,.fl-modal,[id^="fl-modal"]').forEach(x => { x.style.display = 'none'; });

  /* ══ นับเองจากข้อมูลดิบ ══ */
  const cxl = M.filter(m => m.status === 'cancelled');
  const paid = M.filter(m => m.status === 'paid');
  /* เดือนที่ใบนั้นถูกจัดกลุ่ม = วันที่ล่าสุดของ workflow · คิดเองจากฟิลด์ดิบ
     ไม่เรียก _memoLastDate ของหน้าจอ · เพี้ยนพร้อมกันแล้วเทสต์ผ่านทั้งที่ผิด */
  const month = m => {
    const ds = [m.createdDate, m.approvedDate, m.orderedDate, m.receivedDate, m.paidDate]
      .filter(Boolean).sort();
    return ds.length ? String(ds[ds.length - 1]).slice(0, 7) : '';
  };
  const agg = {};
  M.forEach(m => {
    if (m.status !== 'cancelled' && m.status !== 'paid') return;
    const k = month(m); if (!k) return;
    const a = (agg[k] = agg[k] || { c: 0, t: 0, x: 0 });
    a.c++;
    if (m.status === 'cancelled') a.x++; else a.t += (m.amount || 0);
  });
  return { total: M.length, before,
    cxl: cxl.map(m => ({ no: m.no, amount: m.amount || 0, maintId: m.maintId || null,
                         reason: m.cancelReason || '', month: month(m) })),
    paidNos: paid.map(m => m.no),
    liveNos: M.filter(m => m.status !== 'cancelled' && m.status !== 'paid').map(m => m.no),
    agg,
    spendAfter: M.filter(m => m.status !== 'cancelled').reduce((s, m) => s + (m.amount || 0), 0) };
});
if (SETUP.err) { console.log('  ✗ ' + SETUP.err); console.log('\nพัง 1'); await close(); process.exit(1); }

/* เปิดหน้า Inventory / Memo → แท็บ Memorandum */
const openMemo = async (tab, filter) => {
  await page.evaluate(([t, f]) => {
    const el = document.querySelector('.nav-item[data-view="fl-inventory"]');
    if (el && typeof nav === 'function') nav(el);
    if (typeof invSwitchTab === 'function') invSwitchTab('memo');
    if (typeof memoSetArchive === 'function') memoSetArchive(t);
    if (typeof memoFilterSt === 'function') memoFilterSt(f || 'all');
  }, [tab, filter]);
  await page.waitForTimeout(500);
};

const readTab = () => page.evaluate(() => {
  const txt = t => (t || '').replace(/\s+/g, ' ').trim();
  /* ตารางของแท็บ Memorandum · หาแถวที่ขึ้นต้นด้วยเลขใบ MO-xxx */
  const rows = [].slice.call(document.querySelectorAll('tr'))
    .map(tr => {
      const c = [].slice.call(tr.querySelectorAll('td'));
      if (c.length < 8) return null;
      const no = txt(c[1] && c[1].textContent);
      if (!/^MO-/.test(no)) return null;
      return { no,
        title: txt(c[2] && c[2].textContent),
        status: txt(tr.textContent).match(/(CREATED|PENDING|APPROVED|ORDERED|RECEIVED|PAID|CANCELLED)/),
        next: txt(c[c.length - 2] && c[c.length - 2].textContent),
        nextBtns: (c[c.length - 2] ? c[c.length - 2].querySelectorAll('button').length : 0),
        cut: !!tr.querySelector('[style*="line-through"]'),
        faded: /opacity:\s*\.?6/.test(tr.getAttribute('style') || '') };
    }).filter(Boolean);
  const grab = re => { const m = document.body.innerText.match(re); return m ? +m[1] : null; };
  const divs = [].slice.call(document.querySelectorAll('tr td[colspan]'))
    .map(td => txt(td.textContent)).filter(t => /\d+ ใบ/.test(t));
  /* ปุ่มกรองที่ "มีให้กดจริง" บนแท็บนี้ · เรียกฟังก์ชันกรองตรง ๆ ผ่านได้แม้ไม่มีปุ่ม */
  const filters = [].slice.call(document.querySelectorAll('button'))
    .filter(b => /memoFilterSt/.test(b.getAttribute('onclick') || ''))
    .map(b => txt(b.textContent));
  return { rows, filters, act: grab(/Active\s+(\d+)/), arc: grab(/Archive\s+(\d+)/),
           memo: grab(/Memorandum\s+(\d+)/), divs };
});

await openMemo('active', 'all');
const A = await readTab();
await openMemo('archive', 'all');
const R = await readTab();

/* ══ 1 · ไม่มีใบไหนหลุดจากทั้งสองแท็บ ═════════════════════════════════════ */
if (R.act == null || R.arc == null || R.memo == null)
  fail('อ่านตัวเลขบนแท็บไม่ได้ (Active/Archive/Memorandum)');
else if (R.act + R.arc !== R.memo)
  fail('Active ' + R.act + ' + Archive ' + R.arc + ' = ' + (R.act + R.arc) +
       ' · แต่ Memorandum มี ' + R.memo + ' ใบ · หายไป ' + (R.memo - R.act - R.arc) + ' ใบ');
else if (R.memo !== SETUP.total)
  fail('ยอดบนแท็บ Memorandum ' + R.memo + ' ไม่ตรงกับ FL_MEMOS ' + SETUP.total);
else ok('ไม่มีใบไหนหลุดจากลิสต์ · Active ' + R.act + ' + Archive ' + R.arc + ' = ' + R.memo +
        ' ใบ เท่ากับที่มีในระบบ (ยกเลิกไป ' + SETUP.cxl.length + ' ใบ)');

/* ══ 2 · ใบที่ยกเลิกอยู่ในแท็บ Archive และเห็นในตารางจริง ═════════════════ */
const seen = SETUP.cxl.map(c => ({ ...c, row: R.rows.find(r => r.no === c.no) }));
const miss = seen.filter(x => !x.row);
if (!SETUP.cxl.length) fail('ยกเลิกไม่สำเร็จ · ไม่มีใบให้ตรวจ');
else if (miss.length)
  fail('ใบที่ยกเลิก ' + miss.map(x => x.no).join(', ') + ' ยังหาไม่เจอในแท็บ Archive');
else if (!seen.some(x => x.maintId) || !seen.some(x => !x.maintId))
  ok('ใบที่ยกเลิก ' + SETUP.cxl.length + ' ใบอยู่ในแท็บ Archive · ' +
     '(ชุดข้อมูลนี้ไม่มีทั้งสองแบบให้เทียบ)');
else ok('ใบที่ยกเลิก ' + SETUP.cxl.length + ' ใบอยู่ในแท็บ Archive ครบ · ' +
        'ทั้งใบที่ผูกกับงานซ่อม และใบที่ไม่ผูกกับอะไรเลย (ใบลอยเคยเข้าถึงไม่ได้เลย)');

/* ══ 3 · สถานะ CANCELLED + เหตุผล ═════════════════════════════════════════ */
const st = seen.filter(x => x.row);
const stBad = st.filter(x => !(x.row.status && x.row.status[1] === 'CANCELLED'));
const rsBad = st.filter(x => x.reason && x.row.next.indexOf(x.reason) < 0);
if (!st.length) fail('ไม่มีแถวให้ตรวจสถานะ');
else if (stBad.length)
  fail(stBad[0].no + ' ไม่ขึ้นสถานะ CANCELLED · เจอ "' + (stBad[0].row.status || ['—'])[0] + '"');
else if (rsBad.length)
  fail(rsBad[0].no + ' ไม่บอกเหตุผลที่ยกเลิก ("' + rsBad[0].reason + '") · ช่องถัดไปเป็น "' +
       rsBad[0].row.next + '"');
else if (!st.every(x => x.row.cut && x.row.faded))
  fail('แถวของใบที่ยกเลิกไม่ได้จาง/ขีดฆ่า · แยกจากใบที่ยังเดินอยู่ด้วยตาไม่ได้');
else ok('แถวใบที่ยกเลิกขึ้น CANCELLED · จางและขีดฆ่า · บอกเหตุผลที่กรอกไว้ ("' + REASON + '")');

/* ══ 4 · ต้องไม่มีปุ่มเดินขั้นต่อไป ═══════════════════════════════════════ */
const btnBad = st.filter(x => x.row.nextBtns > 0);
if (!st.length) fail('ไม่มีแถวให้ตรวจปุ่ม');
else if (btnBad.length)
  fail(btnBad[0].no + ' ยกเลิกไปแล้วแต่ยังมีปุ่มเดินขั้นต่อ "' + btnBad[0].row.next + '"');
else ok('ใบที่ยกเลิกไม่มีปุ่มเดินขั้นต่อไป · ช่องนั้นบอกเหตุผลแทน (ของเดิมขึ้น "ส่งขออนุมัติ" ให้ใบที่ตายแล้ว)');

/* ══ 5 · ปุ่มกรอง Cancelled / Paid แยกกันถูก ═════════════════════════════ */
await openMemo('archive', 'cancelled');
const C = await readTab();
await openMemo('archive', 'paid');
const P = await readTab();
const cNos = C.rows.map(r => r.no).sort();
const pNos = P.rows.map(r => r.no).sort();
const wantC = SETUP.cxl.map(c => c.no).sort();
if (R.filters.indexOf('Cancelled') < 0)
  fail('แท็บ Archive ไม่มีปุ่มกรอง Cancelled ให้กด · เจอ [' + R.filters.join(', ') + ']');
else if (A.filters.indexOf('Cancelled') >= 0)
  fail('แท็บ Active มีปุ่มกรอง Cancelled ทั้งที่ไม่มีใบยกเลิกอยู่ในแท็บนั้น');
else if (cNos.join(',') !== wantC.join(','))
  fail('กรอง Cancelled ได้ [' + cNos.join(',') + '] ควรเป็น [' + wantC.join(',') + ']');
else if (pNos.some(n => wantC.indexOf(n) >= 0))
  fail('กรอง Paid มีใบที่ยกเลิกปนมาด้วย');
else ok('มีปุ่มกรอง Cancelled ในแท็บ Archive (ไม่มีในแท็บ Active) · กดแล้วได้ ' + cNos.length +
        ' ใบตรงกับที่ยกเลิกจริง · Paid ได้ ' + pNos.length + ' ใบ ไม่มีใบยกเลิกปน');

/* ══ 6 · ยอดรวมรายเดือนไม่นับเงินของใบที่ยกเลิก ══════════════════════════ */
const wantMonths = Object.keys(SETUP.agg).filter(k => SETUP.agg[k].x > 0);
if (!wantMonths.length) ok('ไม่มีเดือนไหนมีใบยกเลิก · ข้ามการตรวจยอดรวมรายเดือน');
else {
  const nf = n => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const bad6 = [];
  wantMonths.forEach(k => {
    const a = SETUP.agg[k];
    const hit = R.divs.find(t => t.indexOf(a.c + ' ใบ') >= 0 && t.indexOf('ยกเลิก ' + a.x) >= 0);
    if (!hit) { bad6.push(k + ' ไม่มีแถวคั่นเดือนที่บอก ' + a.c + ' ใบ · ยกเลิก ' + a.x); return; }
    if (hit.indexOf(nf(a.t)) < 0)
      bad6.push(k + ' ยอดรวมควรเป็น ฿' + nf(a.t) + ' (ไม่นับใบยกเลิก) · เจอ "' + hit + '"');
  });
  if (bad6.length) fail('ยอดรวมรายเดือน · ' + bad6.join(' · '));
  else ok('ยอดรวมรายเดือนไม่นับเงินของใบที่ยกเลิก แต่ยังนับจำนวนใบและบอกว่ายกเลิกกี่ใบ · ' +
          'ตรวจ ' + wantMonths.length + ' เดือน');
}

/* ══ 7 · แท็บ Active ต้องไม่มีใบที่ยกเลิกปน ═══════════════════════════════ */
const aNos = A.rows.map(r => r.no);
const leak = wantC.filter(n => aNos.indexOf(n) >= 0);
if (leak.length) fail('ใบที่ยกเลิก ' + leak.join(', ') + ' โผล่ในแท็บ Active');
else if (!aNos.length) fail('แท็บ Active ไม่มีแถวเลย · เทียบไม่ได้');
else ok('แท็บ Active ' + aNos.length + ' แถว ไม่มีใบที่ยกเลิกปนเข้ามา');

/* ══ 8 · ไม่มี error บนหน้า ═══════════════════════════════════════════════ */
const errs = (errors || []).filter(e => !/favicon|fonts\.googleapis/i.test(String(e)));
if (errs.length) fail('มี error บนหน้า ' + errs.length + ' ตัว · ' + String(errs[0]).slice(0, 150));
else ok('ไม่มี error บนหน้าระหว่างทดสอบ');

console.log('\nพัง ' + bad);
await close();
process.exit(bad ? 1 : 0);
