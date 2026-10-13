// §agSum · แท็บ Recent Bookings ของเอเย่นต์ · ตัวสรุปแยกเดือน × แยกทริป
//
// ที่มา (2026-09-29) · ผู้ใช้ขอเอง "หน้า Recent booking อยากได้ตัวสรุปแยกเดือน แยกทริป"
// ตกลงกันไว้ · ตารางไขว้ แถว=เดือน คอลัมน์=โปรแกรม · แต่ละช่องมีหัวคนกับยอดเงิน
//   คอลัมน์ยกเลิกแยกออกมาต่างหาก · สลับดูตามวันเดินทาง/วันที่จองได้
//
// สามกับดักที่ตารางข้างล่างมีอยู่แล้วและตัวสรุปต้องไม่ตกลงไป
//   1 ใบจองใบเดียวมีได้หลายทริป · ตารางโชว์แค่ทริปแรกแล้วต่อท้าย +N
//     ถ้านับทีละใบ ทริปที่สองจะหายทั้งเดือนทั้งโปรแกรม
//   2 bk.total เป็นเงินของทั้งใบ ไม่ใช่ของทริป · วัดจากข้อมูลจริงแล้วมี 5 ใบจาก 127
//     ที่ total ไม่เท่าผลบวก subtotal เพราะส่วนลดอยู่ที่ระดับใบ
//   3 เลข "126 bookings" ที่ตารางข้างล่างโชว์ รวมใบที่ยกเลิกแล้วด้วย
//
// เทสนี้กันสิบเอ็ดอย่าง
//   1  มีบล็อกสรุปขึ้นเหนือตาราง พร้อมปุ่มสลับโหมดเดือน
//   2  คอลัมน์คือโปรแกรมที่ขายได้จริง เรียงตามหัวคน · ไม่มีโปรแกรมที่มีแต่ใบยกเลิกโผล่มา
//   3  ทุกช่อง เดือน×โปรแกรม ตรงกับที่นับเองจากใบจองดิบ ทั้งหัวคนและยอดเงิน
//   4  แถวรวมของเดือน = ผลบวกของช่องในแถวนั้น
//   5  แถวรวมท้ายตาราง = ผลบวกของทุกเดือน
//   6  คอลัมน์ยกเลิกแยกจริง · ไม่ถูกนับในช่องโปรแกรมและไม่ถูกนับในช่องรวม
//   7  ใบที่มีหลายทริปถูกกางออก · ทริปที่สองไปโผล่ถูกเดือนถูกโปรแกรม
//   8  ยอดเงินของใบทริปเดียวใช้ total ของใบ (รวมส่วนลดแล้ว) ไม่ใช่ subtotal
//   9  โหมด "วันที่จอง" · ไม่มีข้อมูลต้องปิดปุ่มและบอกเหตุผล · มีข้อมูลแล้วสลับได้จริง
//   10 เอเย่นต์ที่ขายเกินหกโปรแกรม · ยุบเป็นคอลัมน์ "อื่น ๆ" และตัวเลขต้องครบ
//   11 ไม่มี error บนหน้า

import { open } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1700, height: 1100 });
page.on('dialog', d => d.accept());
await page.waitForTimeout(1400);

/* อ่านตารางสรุปจากจอที่วาดออกมา · ไม่ถามฟังก์ชันที่กำลังทดสอบ */
const readSum = () => page.evaluate(() => {
  const el = document.querySelector('.agsum');
  if (!el) return { has: false };
  const head = [].slice.call(el.querySelectorAll('.agsum-t thead th')).map(t => (t.textContent || '').trim());
  const cell = td => {
    const b = td.querySelector('b'), i = td.querySelector('i');
    if (!b) return { pax: 0, baht: 0, empty: true };
    return { pax: +((b.textContent || '').replace(/[^0-9-]/g, '') || 0),
             baht: +(((i || {}).textContent || '').replace(/[^0-9-]/g, '') || 0), empty: false };
  };
  const rowOf = tr => ({ m: ((tr.querySelector('td.m') || {}).textContent || '').trim(),
                         cells: [].slice.call(tr.querySelectorAll('td:not(.m)')).map(cell) });
  const modes = [].slice.call(el.querySelectorAll('.agsum-md')).map(b => ({
    txt: (b.textContent || '').trim(), on: b.classList.contains('on'),
    dis: b.disabled, title: b.getAttribute('title') || '' }));
  return { has: true, head,
           rows: [].slice.call(el.querySelectorAll('.agsum-t tbody tr')).map(rowOf),
           foot: [].slice.call(el.querySelectorAll('.agsum-t tfoot tr')).map(rowOf)[0] || null,
           modes, foot_txt: ((el.querySelector('.agsum-ft') || {}).textContent || '').trim().slice(0, 60) };
});

/* เปิดหน้า Agent + เอเย่นต์ที่ต้องการ แล้วเข้าแท็บ Recent Bookings */
const openAg = (aid) => page.evaluate((id) => {
  nav(document.querySelector('.nav-item[data-view="agents"]'));
  agRenderDetail(id);
  agSwitchTab('hist', id);
}, aid);

/* ══ 0 · เลือกเอเย่นต์ + คิดเลขที่ควรได้เองจากใบจองดิบ ═══════════════════
   คิดจาก SB_BOOKINGS ตรง ๆ ไม่เรียก agSumRows / agSumBlock
   ไม่งั้นก็แค่เอาผลของโค้ดเดียวกันมาเทียบกับตัวเอง */
const R0 = await page.evaluate(() => {
  if (typeof agRenderDetail !== 'function' || typeof agTabHist !== 'function')
    return { err: 'ไม่มีฟังก์ชันของหน้า Agent' };
  const cnt = {};
  (SB_BOOKINGS || []).forEach(b => { if (b.agentId) cnt[b.agentId] = (cnt[b.agentId] || 0) + 1; });
  const aid = Object.keys(cnt).sort((x, y) => cnt[y] - cnt[x])[0];
  if (!aid) return { err: 'ไม่มีใบจองที่ผูกเอเย่นต์เลย' };
  const rName = id => (ROUTES.find(x => x.id === id) || {}).name || (id || '—');
  const DEAD = ['cancelled', 'rejected', 'cancelled_weather'];
  const live = {}, dead = {}, prog = {};
  let nMulti = 0, nDeadBk = 0;
  (SB_BOOKINGS || []).filter(b => b.agentId === aid).forEach(b => {
    const isDead = DEAD.indexOf(b.status) >= 0;
    if (isDead) nDeadBk++;
    const tr = (b.schemaVer === 2 || Array.isArray(b.trips)) ? (b.trips || []) : null;
    if (tr && tr.length > 1) nMulti++;
    const put = (m, rid, pax, baht) => {
      if (!m) return;
      if (isDead) { dead[m] = dead[m] || { pax: 0, baht: 0 }; dead[m].pax += pax; dead[m].baht += baht; return; }
      const k = m + '|' + rid;
      live[k] = live[k] || { pax: 0, baht: 0 }; live[k].pax += pax; live[k].baht += baht;
      prog[rid] = (prog[rid] || 0) + pax;
    };
    if (tr) {
      const one = tr.length <= 1;
      tr.forEach(t => {
        const pax = bkV2PaxAllTot(t.pax);
        const baht = one ? (typeof b.total === 'number' ? b.total : (t.subtotal || 0)) : (t.subtotal || 0);
        put(t.date ? String(t.date).slice(0, 7) : '', t.routeId || '', pax, baht);
      });
    } else {
      const p = b.pax || {};
      put(b.travelDate ? String(b.travelDate).slice(0, 7) : '', b.programId || '',
          (p.adult || 0) + (p.child || 0) + (p.infant || 0), b.total || 0);
    }
  });
  const months = [...new Set(Object.keys(live).map(k => k.split('|')[0])
                    .concat(Object.keys(dead)))].sort();
  const cols = Object.keys(prog).sort((x, y) => prog[y] - prog[x]);
  return { aid, n: cnt[aid], months, cols, colNames: cols.map(rName), live, dead,
           nMulti, nDeadBk, progPax: prog };
});
if (R0.err) fail(R0.err);
else ok('ใช้เอเย่นต์ ' + R0.aid + ' · ' + R0.n + ' ใบ (ยกเลิก ' + R0.nDeadBk + ') · ' +
        R0.months.length + ' เดือน · ' + R0.cols.length + ' โปรแกรม · ใบหลายทริป ' + R0.nMulti);

if (!R0.err) {
  await openAg(R0.aid);
  await page.waitForTimeout(500);
  const S = await readSum();

  /* ══ 1 · มีบล็อกสรุป + ปุ่มสลับ ═══════════════════════════════════ */
  if (!S.has) fail('ไม่มีบล็อกสรุปบนแท็บ Recent Bookings เลย');
  else if (S.modes.length !== 2)
    fail('ปุ่มสลับโหมดเดือนมี ' + S.modes.length + ' ปุ่ม · ควรมี 2 (วันเดินทาง / วันที่จอง)');
  else if (!S.modes[0].on)
    fail('ค่าตั้งต้นไม่ได้อยู่ที่ "วันเดินทาง" · ' + JSON.stringify(S.modes));
  else ok('มีบล็อกสรุปเหนือตาราง · ปุ่มสลับ 2 โหมด ค่าตั้งต้นคือ "' + S.modes[0].txt + '"');

  /* ══ 2 · คอลัมน์ = โปรแกรมที่ขายได้ เรียงตามหัวคน ══════════════════ */
  if (S.has) {
    const want = R0.colNames.slice(0, 6);
    const got = S.head.slice(1, 1 + want.length);
    if (JSON.stringify(got) !== JSON.stringify(want))
      fail('คอลัมน์โปรแกรมไม่ตรง · ได้ [' + got.join(' | ') + '] · คิดเองได้ [' + want.join(' | ') + ']');
    else if (S.head[S.head.length - 1] !== 'ยกเลิก')
      fail('คอลัมน์สุดท้ายควรเป็น "ยกเลิก" · ได้ "' + S.head[S.head.length - 1] + '"');
    else if (S.head[S.head.length - 2] !== 'รวม')
      fail('คอลัมน์ก่อนสุดท้ายควรเป็น "รวม" · ได้ "' + S.head[S.head.length - 2] + '"');
    else ok('คอลัมน์เป็นโปรแกรมที่ขายได้ เรียงตามหัวคนมาก→น้อย (' + got.join(' · ') +
            ') ปิดท้ายด้วย รวม + ยกเลิก');
  }

  /* ══ 3 · ทุกช่องตรงกับที่นับเองจากใบจองดิบ ═══════════════════════ */
  if (S.has) {
    const nCol = Math.min(6, R0.cols.length);
    const off = [];
    S.rows.forEach(r => {
      for (let i = 0; i < nCol; i++) {
        const exp = R0.live[r.m + '|' + R0.cols[i]] || { pax: 0, baht: 0 };
        const got = r.cells[i];
        if (got.pax !== exp.pax || got.baht !== exp.baht)
          off.push(r.m + ' / ' + R0.colNames[i] + ' · จอ ' + got.pax + '/' + got.baht +
                   ' · นับเอง ' + exp.pax + '/' + exp.baht);
      }
    });
    if (S.rows.length !== R0.months.length)
      fail('แถวเดือนมี ' + S.rows.length + ' · คิดเองได้ ' + R0.months.length + ' เดือน');
    else if (off.length)
      fail('ช่องที่ไม่ตรงกับใบจองจริง ' + off.length + ' ช่อง · ' + off.slice(0, 3).join(' | '));
    else ok('ทุกช่อง เดือน×โปรแกรม (' + S.rows.length + '×' + nCol + ') ตรงกับที่นับเองจากใบจองดิบ ' +
            'ทั้งหัวคนและยอดเงิน');
  }

  /* ══ 4 · แถวรวมของเดือน = ผลบวกของช่องในแถว ═══════════════════════ */
  if (S.has) {
    const iSum = S.head.length - 3;   /* ช่อง td ไม่มี td.m · รวมอยู่ก่อนยกเลิก */
    const off = [];
    S.rows.forEach(r => {
      const parts = r.cells.slice(0, r.cells.length - 2);
      const p = parts.reduce((s, c) => s + c.pax, 0), b = parts.reduce((s, c) => s + c.baht, 0);
      const sum = r.cells[r.cells.length - 2];
      if (sum.pax !== p || sum.baht !== b)
        off.push(r.m + ' · ช่องรวม ' + sum.pax + '/' + sum.baht + ' · บวกเอง ' + p + '/' + b);
    });
    if (off.length) fail('ช่องรวมของเดือนไม่เท่าผลบวกในแถว · ' + off.slice(0, 3).join(' | '));
    else ok('ช่องรวมของทุกเดือนเท่ากับผลบวกของช่องโปรแกรมในแถวนั้น (' + S.rows.length + ' แถว)');
  }

  /* ══ 5 · แถวรวมท้ายตาราง = ผลบวกทุกเดือน ═════════════════════════ */
  if (S.has && S.foot) {
    const off = [];
    S.foot.cells.forEach((f, i) => {
      const p = S.rows.reduce((s, r) => s + (r.cells[i] ? r.cells[i].pax : 0), 0);
      const b = S.rows.reduce((s, r) => s + (r.cells[i] ? r.cells[i].baht : 0), 0);
      if (f.pax !== p || f.baht !== b) off.push('คอลัมน์ ' + i + ' · ท้ายตาราง ' + f.pax + '/' + f.baht +
        ' · บวกเอง ' + p + '/' + b);
    });
    if (off.length) fail('แถวรวมท้ายตารางไม่เท่าผลบวกของแถวเดือน · ' + off.slice(0, 3).join(' | '));
    else ok('แถวรวมท้ายตารางเท่ากับผลบวกของทุกเดือนครบทั้ง ' + S.foot.cells.length + ' คอลัมน์');
  }
  else if (S.has) fail('ไม่มีแถวรวมท้ายตาราง');

  /* ══ 6 · คอลัมน์ยกเลิกแยกจริง ═════════════════════════════════════
     ถ้าใบยกเลิกไปปนอยู่ในช่องโปรแกรม ยอดที่ "ขายได้" จะสูงกว่าความจริง */
  if (S.has) {
    const off = [];
    let anyDead = 0;
    S.rows.forEach(r => {
      const exp = R0.dead[r.m] || { pax: 0, baht: 0 };
      const got = r.cells[r.cells.length - 1];
      anyDead += got.pax;
      if (got.pax !== exp.pax || got.baht !== exp.baht)
        off.push(r.m + ' · จอ ' + got.pax + '/' + got.baht + ' · นับเอง ' + exp.pax + '/' + exp.baht);
    });
    /* ยอดรวมทั้งตาราง (ไม่รวมคอลัมน์ยกเลิก) ต้องเท่ากับหัวคนของใบที่ยังไม่ยกเลิกเท่านั้น */
    const liveTot = Object.keys(R0.live).reduce((s, k) => s + R0.live[k].pax, 0);
    const shownTot = S.foot ? S.foot.cells[S.foot.cells.length - 2].pax : -1;
    if (!R0.nDeadBk)
      fail('เอเย่นต์รายนี้ไม่มีใบยกเลิกเลย · พิสูจน์ว่าคอลัมน์ยกเลิกแยกจริงไม่ได้');
    else if (off.length)
      fail('คอลัมน์ยกเลิกไม่ตรงกับที่นับเอง · ' + off.slice(0, 3).join(' | '));
    else if (!anyDead)
      fail('มีใบยกเลิก ' + R0.nDeadBk + ' ใบ แต่คอลัมน์ยกเลิกเป็นศูนย์ทุกแถว');
    else if (shownTot !== liveTot)
      fail('ช่องรวมทั้งตารางขึ้น ' + shownTot + ' คน · หัวคนของใบที่ยังไม่ยกเลิกมี ' + liveTot +
           ' คน · แปลว่าใบยกเลิกถูกนับปนเข้าไปในยอดที่ขายได้');
    else ok('คอลัมน์ยกเลิกแยกจริง (' + anyDead + ' คน จาก ' + R0.nDeadBk + ' ใบ) · ' +
            'ยอดรวมที่ขายได้ ' + shownTot + ' คน ไม่มีใบยกเลิกปน');
  }

  /* ══ 7 · ใบหลายทริปถูกกางออก ══════════════════════════════════════
     ⚠ ชุดข้อมูลนี้ทุกใบมีทริปเดียว · ถ้าปล่อยผ่านก็เท่ากับไม่ได้ตรวจอะไร
        จึงสร้างใบสองทริปขึ้นมาเอง ข้ามเดือนและข้ามโปรแกรม แล้วลบทิ้งหลังวัดเสร็จ */
  const R7 = await page.evaluate(([aid, cols, months]) => {
    const r1 = cols[0], r2 = cols[1] || cols[0];
    const m1 = months[0];
    const y = +m1.slice(0, 4), mo = +m1.slice(5, 7);
    const nx = new Date(y, mo, 1);   /* เดือนถัดไป */
    const m2 = nx.getFullYear() + '-' + String(nx.getMonth() + 1).padStart(2, '0');
    const mk = p => ({ ad_th: p, chd_th: 0, inf_th: 0, foc_th: 0, ad_fr: 0, chd_fr: 0, inf_fr: 0, foc_fr: 0, foc: 0 });
    const bk = { id: '__t_multi', schemaVer: 2, agentId: aid, status: 'confirmed', leadPax: 'TEST MULTI',
                 total: 9999,
                 trips: [ { routeId: r1, date: m1 + '-05', pax: mk(3), subtotal: 300 },
                          { routeId: r2, date: m2 + '-06', pax: mk(4), subtotal: 400 } ] };
    SB_BOOKINGS.push(bk);
    agRenderDetail(aid); agSwitchTab('hist', aid);
    return { m1, m2, r1, r2, p1: 3, p2: 4, b1: 300, b2: 400 };
  }, [R0.aid, R0.cols, R0.months]);
  await page.waitForTimeout(400);
  const S7 = await readSum();
  {
    const colIx = rid => R0.cols.indexOf(rid);
    const row = m => S7.rows.filter(r => r.m === m)[0];
    const r1 = row(R7.m1), r2 = row(R7.m2);
    const base1 = (R0.live[R7.m1 + '|' + R7.r1] || { pax: 0, baht: 0 });
    if (!r1) fail('หาแถวเดือน ' + R7.m1 + ' ไม่เจอหลังใส่ใบสองทริป');
    else if (!r2) fail('ทริปที่สองอยู่เดือน ' + R7.m2 + ' แต่ไม่มีแถวเดือนนั้นขึ้นมา · ' +
                       'ใบหลายทริปถูกนับแค่ทริปแรก ทริปที่สองหายไปทั้งเดือน');
    else {
      const c1 = r1.cells[colIx(R7.r1)], c2 = r2.cells[colIx(R7.r2)];
      if (c1.pax !== base1.pax + R7.p1)
        fail('ทริปแรกของใบสองทริปไม่เข้าช่อง ' + R7.m1 + ' · จอ ' + c1.pax +
             ' · ควรเป็น ' + (base1.pax + R7.p1));
      else if (c2.pax !== R7.p2)
        fail('ทริปที่สองไม่เข้าช่อง ' + R7.m2 + ' · จอ ' + c2.pax + ' · ควรเป็น ' + R7.p2);
      else if (c1.baht !== base1.baht + R7.b1 || c2.baht !== R7.b2)
        fail('ใบหลายทริปต้องใช้ยอดรายทริป · จอ ' + c1.baht + ' / ' + c2.baht +
             ' · ควรเป็น ' + (base1.baht + R7.b1) + ' / ' + R7.b2 +
             ' (ถ้าเอา total 9999 ของทั้งใบไปใส่ทั้งสองช่อง เงินจะเด้งเป็นสองเท่า)');
      else ok('ใบสองทริปถูกกางออก · ทริปแรกเข้า ' + R7.m1 + ' (+' + R7.p1 + ' คน ฿' + R7.b1 +
              ') ทริปที่สองเข้า ' + R7.m2 + ' (' + R7.p2 + ' คน ฿' + R7.b2 + ') คนละช่องคนละเดือน');
    }
  }

  /* ══ 8 · ใบทริปเดียวใช้ total ของใบ ไม่ใช่ subtotal ════════════════
     ส่วนลด/ปรับยอดอยู่ที่ระดับใบ · ถ้าเอา subtotal มาใช้ ยอดขายจะสูงกว่าที่เก็บเงินได้จริง */
  const R8 = await page.evaluate(([aid, cols, months]) => {
    SB_BOOKINGS.splice(SB_BOOKINGS.findIndex(b => b.id === '__t_multi'), 1);
    const mk = p => ({ ad_th: p, chd_th: 0, inf_th: 0, foc_th: 0, ad_fr: 0, chd_fr: 0, inf_fr: 0, foc_fr: 0, foc: 0 });
    /* subtotal 1000 แต่เก็บจริง 700 · ส่วนลด 300 อยู่ที่ใบ */
    const bk = { id: '__t_disc', schemaVer: 2, agentId: aid, status: 'confirmed', leadPax: 'TEST DISCOUNT',
                 total: 700, trips: [{ routeId: cols[0], date: months[0] + '-07', pax: mk(2), subtotal: 1000 }] };
    SB_BOOKINGS.push(bk);
    agRenderDetail(aid); agSwitchTab('hist', aid);
    return { m: months[0], rid: cols[0], want: 700, sub: 1000 };
  }, [R0.aid, R0.cols, R0.months]);
  await page.waitForTimeout(400);
  const S8 = await readSum();
  {
    const r = S8.rows.filter(x => x.m === R8.m)[0];
    const base = (R0.live[R8.m + '|' + R8.rid] || { pax: 0, baht: 0 });
    const c = r ? r.cells[R0.cols.indexOf(R8.rid)] : null;
    if (!c) fail('หาช่องของ ' + R8.m + ' ไม่เจอ');
    else if (c.baht === base.baht + R8.sub)
      fail('ใบทริปเดียวถูกคิดด้วย subtotal ' + R8.sub + ' · ควรใช้ total ของใบ ' + R8.want +
           ' ซึ่งหักส่วนลดแล้ว · ยอดขายจะสูงกว่าที่เก็บเงินได้จริง');
    else if (c.baht !== base.baht + R8.want)
      fail('ยอดเงินของช่องไม่ถูก · จอ ' + c.baht + ' · ควรเป็น ' + (base.baht + R8.want));
    else ok('ใบทริปเดียวที่มีส่วนลด (subtotal ' + R8.sub + ' เก็บจริง ' + R8.want +
            ') ถูกคิดด้วยยอดที่เก็บได้จริง ไม่ใช่ราคาก่อนลด');
  }

  /* ══ 9 · โหมดวันที่จอง ════════════════════════════════════════════ */
  const S9a = await readSum();
  const bookedBtn = S9a.modes[1] || {};
  if (!bookedBtn.dis)
    fail('ชุดข้อมูลนี้ไม่มีวันที่จองติดมากับใบเลย แต่ปุ่ม "วันที่จอง" ยังกดได้ · ' +
         'กดแล้วจะได้ตารางว่างโดยไม่มีใครรู้ว่าทำไม');
  else if (!/วันที่จอง|ไม่มี/.test(bookedBtn.title))
    fail('ปุ่มถูกปิดแต่ไม่บอกเหตุผล · title="' + bookedBtn.title + '"');
  else {
    /* ใส่วันที่จองให้ใบทดสอบ แล้ววัดว่าปุ่มเปิดและสลับได้จริง */
    const R9 = await page.evaluate(([aid, months]) => {
      const y = +months[0].slice(0, 4), mo = +months[0].slice(5, 7);
      const pv = new Date(y, mo - 2, 1);   /* เดือนก่อนหน้า · ให้ต่างจากเดือนเดินทางแน่ ๆ */
      const bm = pv.getFullYear() + '-' + String(pv.getMonth() + 1).padStart(2, '0');
      (SB_BOOKINGS || []).forEach(b => { if (b.agentId === aid) b.bookingDate = bm + '-01'; });
      agRenderDetail(aid); agSwitchTab('hist', aid);
      return { bm };
    }, [R0.aid, R0.months]);
    await page.waitForTimeout(350);
    const S9b = await readSum();
    if (S9b.modes[1].dis) fail('ใส่วันที่จองให้ทุกใบแล้ว แต่ปุ่ม "วันที่จอง" ยังถูกปิดอยู่');
    else {
      await page.evaluate((aid) => agSumSetMode(aid, 'booked'), R0.aid);
      await page.waitForTimeout(350);
      const S9c = await readSum();
      const tot0 = S9b.foot.cells[S9b.foot.cells.length - 2].pax;
      const tot1 = S9c.foot ? S9c.foot.cells[S9c.foot.cells.length - 2].pax : -1;
      if (!S9c.modes[1].on) fail('กดสลับไปโหมด "วันที่จอง" แล้วปุ่มไม่ติดไฟ');
      else if (S9c.rows.length !== 1 || S9c.rows[0].m !== R9.bm)
        fail('ตั้งให้ทุกใบจองในเดือน ' + R9.bm + ' · โหมดวันที่จองควรเหลือแถวเดียวคือเดือนนั้น · ได้ ' +
             S9c.rows.map(r => r.m).join(', '));
      else if (tot1 !== tot0)
        fail('สลับโหมดแล้วยอดรวมเปลี่ยนจาก ' + tot0 + ' เป็น ' + tot1 +
             ' · เปลี่ยนแค่วิธีจัดกลุ่ม หัวคนทั้งหมดต้องเท่าเดิม');
      else ok('ไม่มีวันที่จอง → ปุ่มปิดพร้อมเหตุผล · ใส่วันที่จองแล้วเปิดได้ และสลับแล้วยุบเหลือเดือน ' +
              R9.bm + ' แถวเดียว ยอดรวมยังเท่าเดิม ' + tot1 + ' คน');
      await page.evaluate((aid) => agSumSetMode(aid, 'travel'), R0.aid);
      await page.waitForTimeout(250);
    }
  }

  /* ══ 10 · เกินหกโปรแกรม · ยุบเป็น "อื่น ๆ" และตัวเลขต้องครบ ══════ */
  const R10 = await page.evaluate(([aid, months]) => {
    (SB_BOOKINGS || []).forEach(b => { if (b.agentId === aid) delete b.bookingDate; });
    const i = SB_BOOKINGS.findIndex(b => b.id === '__t_disc');
    if (i >= 0) SB_BOOKINGS.splice(i, 1);
    const mk = p => ({ ad_th: p, chd_th: 0, inf_th: 0, foc_th: 0, ad_fr: 0, chd_fr: 0, inf_fr: 0, foc_fr: 0, foc: 0 });
    /* ใส่โปรแกรมเล็ก ๆ เพิ่มจนเกินหกคอลัมน์ · ตัวเล็กจะถูกยุบเป็น "อื่น ๆ" */
    const extra = ROUTES.slice(0, 9).map(r => r.id);
    let added = 0, etcPax = 0;
    extra.forEach((rid, k) => {
      SB_BOOKINGS.push({ id: '__t_many' + k, schemaVer: 2, agentId: aid, status: 'confirmed',
        leadPax: 'TEST MANY', total: 100,
        trips: [{ routeId: rid, date: months[0] + '-09', pax: mk(1), subtotal: 100 }] });
      added++;
    });
    agRenderDetail(aid); agSwitchTab('hist', aid);
    /* โปรแกรมที่เอเย่นต์รายนี้ขายจริงทั้งหมด (ไม่นับใบที่ยกเลิก) · คิดเองจากใบจองดิบ */
    const DEAD = ['cancelled', 'rejected', 'cancelled_weather'];
    const set = {};
    (SB_BOOKINGS || []).forEach(b => {
      if (b.agentId !== aid || DEAD.indexOf(b.status) >= 0) return;
      ((b.trips) || []).forEach(t => { if (t.routeId) set[t.routeId] = 1; });
      if (!b.trips && b.programId) set[b.programId] = 1;
    });
    return { added, extra, nProg: Object.keys(set).length };
  }, [R0.aid, R0.months]);
  await page.waitForTimeout(450);
  const S10 = await readSum();
  {
    const etcIx = S10.head.findIndex(h => /^อื่น ๆ/.test(h));
    if (etcIx < 0)
      fail('ใส่โปรแกรมจนเกินหกแล้ว (' + R10.added + ' ใบ) แต่ไม่มีคอลัมน์ "อื่น ๆ" · ' +
           'ตารางจะกว้างจนอ่านไม่ได้เมื่อเอเย่นต์ขายหลายโปรแกรม');
    else {
      /* ตัวเลขต้องครบ · รวมทุกคอลัมน์ในแถว ต้องเท่ากับช่องรวมของแถวนั้น */
      const offs = [];
      S10.rows.forEach(r => {
        const parts = r.cells.slice(0, r.cells.length - 2);
        const p = parts.reduce((s, c) => s + c.pax, 0);
        if (r.cells[r.cells.length - 2].pax !== p)
          offs.push(r.m + ' · รวม ' + r.cells[r.cells.length - 2].pax + ' · บวกเอง ' + p);
      });
      /* ตอนนี้มีหลายคอลัมน์แล้ว · เป็นจังหวะเดียวที่พิสูจน์ลำดับคอลัมน์ได้จริง
         ตอนเอเย่นต์ขายโปรแกรมเดียว จะเรียงยังไงก็เหมือนกันหมด ข้อ 2 จึงพิสูจน์อะไรไม่ได้
         วัดจากตัวเลขที่วาดออกมาเอง · หัวคนของคอลัมน์โปรแกรมต้องไล่จากมากไปน้อย */
      const fc = S10.foot ? S10.foot.cells : [];
      const progPax = fc.slice(0, etcIx - 1).map(c => c.pax);   /* ตัด อื่นๆ / รวม / ยกเลิก ออก */
      const desc = progPax.every((v, i) => i === 0 || progPax[i - 1] >= v);
      const etcPax = fc[etcIx - 1] ? fc[etcIx - 1].pax : 0;
      const etcN = +((S10.head[etcIx] || '').replace(/[^0-9]/g, '') || 0);
      if (offs.length)
        fail('ยุบเป็น "อื่น ๆ" แล้วตัวเลขหาย · ' + offs.slice(0, 3).join(' | '));
      else if (progPax.length < 3)
        fail('มีคอลัมน์โปรแกรมแค่ ' + progPax.length + ' หลังใส่ของทดสอบ · ตรวจลำดับคอลัมน์ไม่ได้');
      else if (!desc)
        fail('คอลัมน์โปรแกรมไม่ได้เรียงจากหัวคนมากไปน้อย · ได้ [' + progPax.join(' > ') + '] · ' +
             'โปรแกรมหลักของเอเย่นต์จะไม่ได้อยู่ซ้ายสุด');
      /* ยุบไปกี่โปรแกรม + ที่โชว์ไว้ ต้องเท่ากับโปรแกรมที่เอเย่นต์ขายจริงทั้งหมด
         ไม่งั้นโปรแกรมที่หายไปก็คือของที่ไม่มีใครเห็นและไม่มีใครรู้ว่าหาย */
      else if (progPax.length + etcN !== R10.nProg)
        fail('โชว์ ' + progPax.length + ' คอลัมน์ + ยุบไป ' + etcN + ' = ' + (progPax.length + etcN) +
             ' · เอเย่นต์รายนี้ขายจริง ' + R10.nProg + ' โปรแกรม · มีโปรแกรมหายไปเงียบ ๆ');
      else ok('ขายเกินหกโปรแกรม · ยุบเป็นคอลัมน์ "' + S10.head[etcIx] + '" ตัวเลขยังครบ · ' +
              'คอลัมน์เรียงจากหัวคนมากไปน้อย [' + progPax.join(' > ') + '] · ' +
              'ยุบไป ' + etcN + ' โปรแกรม (' + etcPax + ' คน) รวมแล้วครบ ' + R10.nProg + ' โปรแกรม');
    }
  }
  /* เก็บกวาดใบทดสอบทั้งหมด */
  await page.evaluate((aid) => {
    for (let i = SB_BOOKINGS.length - 1; i >= 0; i--)
      if (String(SB_BOOKINGS[i].id || '').indexOf('__t_') === 0) SB_BOOKINGS.splice(i, 1);
    (SB_BOOKINGS || []).forEach(b => { if (b.agentId === aid) delete b.bookingDate; });
    agRenderDetail(aid); agSwitchTab('hist', aid);
  }, R0.aid);
  await page.waitForTimeout(300);
}

/* ══ 11 · ไม่มี error บนหน้า ═════════════════════════════════════════ */
if (errors.length) fail('มี error ' + errors.length + ' ครั้ง · ' + errors.slice(0, 2).join(' | '));
else ok('ไม่มี error บนหน้าระหว่างทดสอบ');

console.log('\nพัง ' + bad);
await close();
process.exit(bad ? 1 : 0);
