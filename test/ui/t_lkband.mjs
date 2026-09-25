// §btLkBand · ที่นั่งที่ล็อกไว้ ต้องลงมาอยู่ใน manifest ของโปรแกรมนั้น
//
// ที่มา (2026-09-25) · ผู้ใช้เลือกแบบ A จาก mockup สามแบบ
//   "อยากให้วาง ตัวที่ล็อคไว้ใน manifest ในโปรแกรมนั้นๆด้วย"
//   "สี เอเจนท์ ใช้สีเดียวกันกับสีเอเจนท์ที่เรากำหนดเลย"
//   "และเมือมีการใช้ จำนวนที่ล็อคก็จะลดลงตามที่ใช้ใช่ไหม"
//
// ของเดิม · ล็อกอยู่แต่ในการ์ด Seat Lock มุมขวาบน · ทริปที่ยังไม่มี booking
// ขึ้นแค่ "No bookings yet · seats held by lock above" · คนอ่านใบงานไม่เห็นว่า
// เรือลำนี้มีที่นั่งถูกกันไว้ให้ใครอยู่เท่าไหร่ และปริ้นใบงานออกมาก็หายไปเลย
//
// เทสนี้กันแปดอย่าง
//   1 ทริปที่มีล็อกต้องมีแถบล็อกในตาราง manifest จริง (ไม่ใช่อยู่นอกตาราง)
//   2 สีของแถบ = สีประจำเอเยนต์ที่ตั้งไว้ใน sb_agents (อ่านจากข้อมูลดิบ)
//   3 ตัวเลขบนแถบ · ล็อกไว้ / ขายไปแล้ว / เหลือกันไว้ ตรงกับที่นับเองจาก lock.log
//   4 พอดึงไปใช้ จำนวนที่เหลือต้องลดลงเท่าที่ดึง (คำถามของผู้ใช้)
//   5 ใบที่ดึงที่นั่งจากล็อก ต้องติดป้ายชื่อเจ้าของล็อก สีเดียวกัน
//   6 ล็อกหมดเกลี้ยง (เหลือ 0) ต้องไม่มีแถวที่นั่งค้างอยู่ แต่แถบยังอยู่
//   7 ทริปที่มีแต่ล็อก ไม่มี booking เลย ต้องขึ้นตาราง ไม่ใช่ "ยังไม่มี booking"
//   8 แถวล็อกเป็นที่นั่ง ไม่ใช่คน · ยอด pax ของทริปต้องไม่ขยับเพราะล็อก
//
// ⚠ ทุกข้อคำนวณค่าที่คาดหวังจาก SB_SEAT_LOCKS / sb_agents / SB_BOOKINGS ดิบเอง
//    ไม่เรียกฟังก์ชันที่หน้าจอใช้วาด (bkV2LockHeldRemaining / bkV2AgentColor)
import { open } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1800, height: 1200 });
page.on('dialog', d => d.accept());
await page.waitForTimeout(1000);

/* ══ 0 · ปลูกล็อกบนวัน+เส้นทางที่มี booking อยู่จริง ═══════════════════════
   หาวันที่เส้นทางหนึ่งมี booking ที่ยังไม่ยกเลิกอย่างน้อยหนึ่งใบ
   สร้างล็อกให้เอเยนต์ที่ตั้งสีไว้เอง แล้วดึงบางส่วนไปผูกกับ booking ใบนั้น */
const SETUP = await page.evaluate(() => {
  const CXL = ['cancelled', 'rejected', 'cancelled_weather'];
  /* เอเยนต์ที่ "ตั้งสีไว้เอง" · ต้องมี a.color จะได้เทียบกับสีบนจอได้ตรง ๆ */
  const ag = (typeof SB_AGENTS !== 'undefined' ? SB_AGENTS : []).find(a => a && a.color);
  if (!ag) return { err: 'ไม่มีเอเยนต์ที่ตั้งสีไว้ในชุดข้อมูลนี้' };
  /* หาใบที่ยังมีชีวิตบนวัน+เส้นทางเดียวกัน · เอาใบที่ pax มากพอให้ดึงล็อกได้ */
  let hit = null;
  (SB_BOOKINGS || []).some(b => {
    if (!b || CXL.includes(b.status) || b.status === 'pending_approval') return false;
    return (b.trips || []).some(t => {
      if (!t || !t.routeId || !t.date) return false;
      const r = (ROUTES || []).find(x => x && x.id === t.routeId);
      if (!r) return false;
      const st = (typeof getDayStatus === 'function') ? getDayStatus(r, t.date) : null;
      if (st && st.type !== 'open') return false;
      hit = { rid: t.routeId, date: t.date, bkId: b.id };
      return true;
    });
  });
  if (!hit) return { err: 'หาวัน+เส้นทางที่มี booking ไม่ได้' };

  /* ล็อกที่ 1 · บนเส้นทางที่มี booking · ดึงไป 3 ที่ผูกกับใบนั้น */
  const L1 = bkV2CreateLock({ scope: 'day', routeId: hit.rid, date: hit.date,
    holderType: 'agent', holderId: ag.id, qty: 10, reason: 'test band',
    releaseDaysBefore: 2, releaseTime: '18:00' });
  const drew = bkV2DrawLock(L1.id, 3, hit.bkId, hit.date);
  /* แบ่งกรุ๊ปย่อยออกจากล็อกที่ 1 สองกรุ๊ป · บรรทัดเดียวกางชื่อทุกกรุ๊ปไม่ไหว
     ต้องยุบเป็นตัวนับ "↳ N กรุ๊ป" แล้วเก็บรายชื่อเต็มไว้ใน title */
  const kidA = bkV2CreateSubLock(L1.id, 'Poppy', 2);
  const kidB = bkV2CreateSubLock(L1.id, 'Chiky', 1);
  const kids = [kidA, kidB].filter(Boolean).length;

  /* ล็อกที่ 2 · ดึงจนหมดเกลี้ยง · แถวที่นั่งต้องหาย แต่แถบต้องอยู่ */
  const L2 = bkV2CreateLock({ scope: 'day', routeId: hit.rid, date: hit.date,
    holderType: 'agent', holderId: ag.id, qty: 2, reason: 'test drained' });
  const drew2 = bkV2DrawLock(L2.id, 2, hit.bkId, hit.date);

  /* ล็อกที่ 5 · ล็อกแบบช่วง ที่ถูกดึงจนหมด "เฉพาะรอบวันนี้" · สถานะยังเป็น active
     (bkV2DrawLock ไม่ตีตรา depleted ให้ล็อกแบบช่วง เพราะรอบอื่นยังมีที่เหลือ)
     เคสนี้จึงพิสูจน์ว่าต้องกรองด้วย "ที่นั่งคงเหลือของวันนั้น" ไม่ใช่กรองด้วยสถานะ */
  const L5 = bkV2CreateLock({ scope: 'bulk', routeId: hit.rid, dateFrom: hit.date,
    dateTo: (() => { const d = new Date(hit.date + 'T00:00:00'); d.setDate(d.getDate() + 5);
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })(),
    holderType: 'agent', holderId: ag.id, qty: 4, reason: 'test bulk round drained' });
  const drew5 = bkV2DrawLock(L5.id, 4, hit.bkId, hit.date);

  /* ล็อกที่ 4 · ล็อกแบบช่วงของเอเยนต์อีกเจ้า · ดึงไปใช้ใน "วันอื่น" ของช่วงเดียวกัน
     ป้าย "จากล็อก" บนหน้านี้ต้องไม่ติดชื่อเจ้านี้ · ล็อก bulk ใบเดียวถูกดึงข้ามหลายวัน
     ถ้าลืมกรองวัน ใบเดียวกันจะติดป้ายของทุกวันที่เคยดึง */
  const ag2 = (typeof SB_AGENTS !== 'undefined' ? SB_AGENTS : [])
    .find(a => a && a.color && a.id !== ag.id && (a.name || '') !== (ag.name || ''));
  let other = null, L4 = null;
  if (ag2) {
    const d0 = new Date(hit.date + 'T00:00:00');
    const nx = new Date(d0); nx.setDate(nx.getDate() + 1);
    const ds = x => x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
    const to = new Date(d0); to.setDate(to.getDate() + 6);
    L4 = bkV2CreateLock({ scope: 'bulk', routeId: hit.rid, dateFrom: hit.date, dateTo: ds(to),
      holderType: 'agent', holderId: ag2.id, qty: 5, reason: 'test other day' });
    const n4 = bkV2DrawLock(L4.id, 2, hit.bkId, ds(nx));
    other = { name: ag2.name || ag2.id, drew: n4, day: ds(nx) };
  }

  /* ล็อกที่ 3 · เส้นทางที่วันนั้นไม่มี booking เลย · ต้องดันตารางขึ้นมาให้เห็น */
  let bare = null;
  (ROUTES || []).some(r => {
    if (!r || !r.id || r.id === hit.rid) return false;
    const st = (typeof getDayStatus === 'function') ? getDayStatus(r, hit.date) : null;
    if (st && st.type !== 'open') return false;
    const live = (SB_BOOKINGS || []).some(b => b && !CXL.includes(b.status) &&
      (b.trips || []).some(t => t.routeId === r.id && t.date === hit.date));
    if (live) return false;
    bare = r.id; return true;
  });
  const L3 = bare ? bkV2CreateLock({ scope: 'day', routeId: bare, date: hit.date,
    holderType: 'agent', holderId: ag.id, qty: 7, reason: 'test bare' }) : null;

  /* ══ นับเองจากข้อมูลดิบ · ไม่เรียกตัวที่หน้าจอใช้ ══ */
  const usedOf = (l, d) => (l.log || []).reduce((s, e) =>
    s + ((e && e.type === 'draw' && (e.tripDate || l.date || '') === d) ? (Number(e.qty) || 0) : 0), 0);
  const want = {}, wantC = {};
  [L1, L2, L3, L4, L5].filter(Boolean).forEach(l => {
    const u = usedOf(l, hit.date);
    want[l.id] = { qty: l.qty, used: u, held: Math.max(0, l.qty - u), rid: l.routeId };
  });
  /* สีที่คาดหวังของแต่ละล็อก · อ่าน a.color จาก sb_agents ดิบ ไม่เรียก bkV2AgentColor */
  (typeof SB_SEAT_LOCKS !== 'undefined' ? SB_SEAT_LOCKS : []).forEach(l => {
    if (!l || l.holderType !== 'agent') return;
    const a = (typeof SB_AGENTS !== 'undefined' ? SB_AGENTS : []).find(x => x && x.id === l.holderId);
    if (a && a.color) wantC[l.id] = String(a.color).toLowerCase();
  });

  /* pax ของทริปนั้นจาก booking ดิบ · ล็อกต้องไม่ไปบวกเพิ่ม
     คีย์ pax แตกเป็นสามชั้น (ad / ad_fr / ad_th) ต้องบวกครบทั้งสาม
     ไม่งั้นนับได้ศูนย์ทั้งที่มีคนจริง */
  const K = ['ad', 'chd', 'inf', 'foc'];
  let paxRaw = 0;
  (SB_BOOKINGS || []).forEach(b => {
    if (!b || CXL.includes(b.status) || b.status === 'pending_approval') return;
    (b.trips || []).forEach(t => {
      if (t.routeId !== hit.rid || t.date !== hit.date) return;
      const px = t.pax || {};
      K.forEach(k => { paxRaw += (Number(px[k]) || 0) + (Number(px[k + '_fr']) || 0) + (Number(px[k + '_th']) || 0); });
    });
  });

  bkV2SwitchTab('bytrip');
  const el = [].slice.call(document.querySelectorAll('.nav-item[data-view]'))
    .find(x => /booking/i.test(x.dataset.view || '') && !/transfer|flow/i.test(x.dataset.view || ''));
  if (el && typeof nav === 'function') nav(el);
  bkV2SwitchTab('bytrip');
  bkV2Tab2ClearFilters(); bkV2Tab2PickDay(hit.date);

  return { ...hit, bare, other, agId: ag.id, agName: ag.name || ag.id, agColor: String(ag.color).toLowerCase(),
           ids: { L1: L1.id, L2: L2.id, L3: L3 ? L3.id : '', L5: L5.id },
           drew, drew2, drew5, kids, kidNames: [kidA, kidB].filter(Boolean).map(k => k.subName),
           l5Status: L5.status, want, wantC, paxRaw };
});
if (SETUP.err) { console.log('  ✗ ' + SETUP.err); console.log('\nพัง 1'); await close(); process.exit(1); }
await page.waitForTimeout(700);

/* ══ อ่านจากหน้าจอ ═══════════════════════════════════════════════════════ */
const GOT = await page.evaluate((RID) => {
  const hex = v => {
    const s = String(v || '').trim();
    const m = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (m) return '#' + [1, 2, 3].map(i => (+m[i]).toString(16).padStart(2, '0')).join('');
    return s.toLowerCase();
  };
  /* §btLkOne · ล็อกหนึ่งใบ = หนึ่งแถว · ทุกอย่างอยู่บนแถวเดียว ไม่มีแถบคาดแล้ว */
  const bands = [].slice.call(document.querySelectorAll('tr.t2-lrow')).map(tr => {
    const td = tr.querySelector('td');
    const nm = tr.querySelector('.lkwho');
    return {
      txt: (tr.textContent || '').replace(/\s+/g, ' ').trim(),
      who: ((nm || {}).textContent || '').trim(),
      /* สีมาจาก --lc บน <tr> (ขีดซ้ายช่องแรก) และพื้นของป้ายชื่อ · ต้องเป็นสีเดียวกัน */
      lk: tr.getAttribute('data-lk') || '',
      lc: hex((tr.getAttribute('style') || '').replace(/^.*--lc:\s*/, '').replace(/[;\s].*$/, '')),
      chip: hex(nm ? getComputedStyle(nm).backgroundColor : ''),
      stripe: hex((getComputedStyle(td).boxShadow.match(/rgba?\([^)]+\)/) || [''])[0]),
      held: (tr.querySelector('.lkq') || {}).textContent || null,
      /* เรื่องเล่าของโควตา (ล็อกไว้กี่ที่ · ขายไปแล้วกี่ที่) อยู่ในช่อง Pickup
         อ่านจาก title ด้วย เพราะช่องแคบกว่าข้อความจะถูกตัดท้าย */
      story: (function(){ const x = tr.querySelector('.t2-pk .lkclip');
        return x ? ((x.getAttribute('title') || x.textContent || '').replace(/\s+/g, ' ').trim()) : ''; })(),
      inTable: !!tr.closest('table.t2-mtbl'),
      manage: !!tr.querySelector('.lkgo'),
      kid: ((tr.querySelector('.lkkid') || {}).getAttribute ? (tr.querySelector('.lkkid').getAttribute('title') || '') : ''),
      rule: ((tr.querySelector('.lkrule') || {}).textContent || '').trim()
    };
  });
  /* แถบคาดของเดิมต้องไม่เหลืออยู่เลย */
  const oldBands = document.querySelectorAll('tr.t2-lband').length;
  /* ป้ายบนแถบโปรแกรม · ที่นั่งที่ล็อกไว้รวม + เตือนล็อกเกินความจุ */
  const pbands = [].slice.call(document.querySelectorAll('tr.t2-pband')).map(tr => ({
    lk: ((tr.querySelector('.plk') || {}).textContent || '').trim(),
    over: ((tr.querySelector('.pover') || {}).textContent || '').trim(),
    txt: (tr.textContent || '').replace(/\s+/g, ' ').trim() }));
  const drawn = [].slice.call(document.querySelectorAll('.t2-drawn')).map(x => ({
    txt: (x.textContent || '').replace(/\s+/g, ' ').trim(),
    bg: hex(getComputedStyle(x).backgroundColor),
    row: (x.closest('tr') || {}).className || ''
  }));
  /* ยอด pax ของ "ทริปที่ปลูกล็อกไว้" เท่านั้น · หาตารางจาก data-rid บนแถบล็อก
     หน้าเดียวมีหลายทริป ถ้าบวกทั้งหน้าจะไม่ตรงกับที่นับเองของเส้นทางเดียว */
  const paxOfRid = rid => {
    const band = document.querySelector('tr.t2-lrow[data-rid="' + rid + '"]');
    const tb = band && band.closest('table.t2-mtbl');
    if (!tb) return null;
    let n = 0;
    [].slice.call(tb.querySelectorAll('tr.t2-zband .zsub')).forEach(z => {
      const m = (z.textContent || '').match(/(\d+)\s*pax/);
      if (m) n += +m[1];
    });
    return n;
  };
  /* §btLkCell · แถวที่นั่งต้องเป็นช่องจริงเรียงตรงคอลัมน์ · ไม่ใช่แถบยาวช่องเดียว
     เทียบจำนวนช่องกับหัวตาราง และกับแถวของคนจริงในตารางเดียวกัน
     แล้วเช็คว่าจำนวนที่กันไว้ตกอยู่ใต้คอลัมน์ AD พอดี                            */
  const grid = [].slice.call(document.querySelectorAll('tr.t2-lrow')).map(tr => {
    const tb = tr.closest('table.t2-mtbl');
    if (!tb) return { err: 'ไม่ได้อยู่ในตาราง' };
    const ths = [].slice.call(tb.querySelectorAll('thead th'));
    const real = tb.querySelector('tr.t2-row:not(.t2-lrow)');
    const adIx = ths.findIndex(t => (t.textContent || '').trim().toUpperCase() === 'AD');
    const tds = [].slice.call(tr.querySelectorAll('td'));
    return { th: ths.length, td: tds.length,
             real: real ? real.querySelectorAll('td').length : null,
             span: tds.some(t => +(t.getAttribute('colspan') || 1) > 1),
             adIx, adCell: adIx >= 0 && tds[adIx] ? !!tds[adIx].querySelector('.lkq') : false,
             adTxt: adIx >= 0 && tds[adIx] ? (tds[adIx].textContent || '').trim() : '' };
  });
  return { bands, drawn, oldBands, pbands, nobk: document.querySelectorAll('.t2-nobk').length,
           lrows: document.querySelectorAll('tr.t2-lrow').length, grid, paxScreen: paxOfRid(RID) };
}, SETUP.rid);

/* ══ 1 · แถบล็อกอยู่ในตาราง manifest จริง ═══════════════════════════════ */
const nBand = GOT.bands.length;
/* §btLkOne · ล็อกหนึ่งใบต้องกินแค่หนึ่งแถว · ไม่มีแถบคาดเพิ่มอีกแถว */
const wantRows = Object.keys(SETUP.want).filter(id => SETUP.want[id].held > 0).length;
if (nBand < 2) fail('ปลูกล็อกที่ยังเหลือที่นั่งไว้ ' + wantRows + ' ใบ แต่บนจอมีแถวล็อก ' + nBand + ' แถว');
else if (GOT.bands.some(b => !b.inTable)) fail('แถวล็อกบางแถวไม่ได้อยู่ในตาราง manifest');
else if (GOT.oldBands) fail('ยังมีแถบคาดของเดิมเหลืออยู่ ' + GOT.oldBands + ' แถบ · ล็อกใบหนึ่งกินสองบรรทัด');
else if (nBand !== wantRows)
  fail('ล็อกที่ยังเหลือที่นั่งมี ' + wantRows + ' ใบ แต่บนจอมี ' + nBand + ' แถว · ควรเป็นใบละแถวพอดี');
else if (GOT.bands.some(b => !b.manage)) fail('แถวล็อกไม่มีปุ่มจัดการ');
else ok('ล็อกใบละหนึ่งแถว · ' + nBand + ' ใบ ' + nBand + ' แถว ไม่มีแถบคาดเพิ่ม · ' +
        'อยู่ในตาราง manifest จริงและมีปุ่มจัดการครบ');

/* ══ 2 · สีของแถบ = สีเอเยนต์ที่ตั้งไว้เอง ═════════════════════════════ */
const wantC = SETUP.agColor;
/* เทียบสีทีละแถบกับสีของ "เจ้าของล็อกใบนั้น" · ไม่ใช่สีเดียวเหมาทั้งหน้า
   ถ้าเทียบเหมา โค้ดที่ทาสีตายตัวสีเดียวก็ผ่านได้ตราบใดที่บังเอิญตรงกับเจ้าแรก */
const colChk = GOT.bands.filter(b => SETUP.wantC[b.lk]);
const colBad = colChk.filter(b => b.lc !== SETUP.wantC[b.lk] || b.chip !== SETUP.wantC[b.lk]);
const colSet = new Set(colChk.map(b => SETUP.wantC[b.lk]));
if (!GOT.bands.length) fail('ไม่มีแถวล็อกให้ตรวจสี');
else if (!colChk.length) fail('แถวล็อกไม่มี data-lk · เทียบสีกับเจ้าของล็อกทีละใบไม่ได้');
else if (colBad.length)
  fail('สีแถวล็อก ' + colBad[0].lk + ' ควรเป็น ' + SETUP.wantC[colBad[0].lk] +
       ' (สีที่ตั้งไว้ให้เอเยนต์เจ้านั้น) · เจอ ขีด ' + colBad[0].lc + ' / ป้าย ' + colBad[0].chip);
else if (colSet.size < 2)
  fail('แถวล็อกที่ตรวจได้มีสีเดียว · พิสูจน์ไม่ได้ว่าสีผูกกับเอเยนต์จริง ไม่ใช่ทาสีตายตัว');
else ok('สีแถวล็อกผูกกับเอเยนต์รายเจ้า · ตรวจ ' + colChk.length + ' แถว ' + colSet.size +
        ' สี (' + SETUP.agName + ' ' + wantC + ' ฯลฯ) ตรงทั้งขีดซ้ายและป้ายชื่อ');

/* ══ 3+4 · ตัวเลข ล็อกไว้ / ขายไปแล้ว / เหลือ · และลดลงตามที่ดึง ══════════ */
const w1 = SETUP.want[SETUP.ids.L1];
const nz = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const b1 = GOT.bands.find(b => b.lk === SETUP.ids.L1);
if (!SETUP.drew) fail('ดึงที่นั่งจากล็อกไม่ได้ · พิสูจน์ไม่ได้ว่าจำนวนลดลงตามที่ใช้');
else if (!b1) fail('ไม่มีแถวของล็อก L1 (' + w1.qty + ' ที่ · ดึงไป ' + w1.used + ') · เจอ [' +
                   GOT.bands.map(b => b.txt).join(' | ') + ']');
else if (b1.story.indexOf(w1.qty + ' ที่') < 0 || b1.story.indexOf('ขายไปแล้ว ' + w1.used) < 0)
  fail('แถวล็อกต้องบอก "' + w1.qty + ' ที่ · ขายไปแล้ว ' + w1.used + '" · เจอ "' + b1.story + '"');
else if (b1.held !== String(w1.held))
  fail('ช่องที่เหลือกันไว้บอก ' + b1.held + ' · ควรเป็น ' + w1.held + ' (ล็อก ' + w1.qty + ' − ดึง ' + w1.used + ')');
else ok('ตัวเลขลดลงตามที่ใช้ · ล็อก ' + w1.qty + ' ที่ → ดึงไป ' + w1.used + ' → เหลือกันไว้ ' + w1.held +
        ' · อยู่บนแถวเดียวกันครบ ตรงกับที่นับเองจาก lock.log');

/* ══ 5 · ใบที่ดึงจากล็อก ติดป้ายชื่อเจ้าของล็อก สีเดียวกัน ═══════════════ */
const dHit = GOT.drawn.filter(d => d.txt.indexOf(SETUP.agName) >= 0);
if (!GOT.drawn.length) fail('ใบที่ดึงที่นั่งจากล็อกไม่ติดป้าย · ตามรอยกลับไม่ได้ว่ามาจากโควตาใคร');
else if (!dHit.length) fail('ป้ายบนใบที่ดึงล็อกไม่ได้บอกชื่อ ' + SETUP.agName + ' · เจอ "' + GOT.drawn[0].txt + '"');
else if (dHit.some(d => d.bg !== wantC))
  fail('ป้าย "จากล็อก" ใช้สี ' + dHit.find(d => d.bg !== wantC).bg + ' · ควรเป็นสีเอเยนต์ ' + wantC);
else if (SETUP.other && SETUP.other.drew && GOT.drawn.some(d => d.txt.indexOf(SETUP.other.name) >= 0))
  fail('ล็อกของ ' + SETUP.other.name + ' ถูกดึงในวันที่ ' + SETUP.other.day +
       ' แต่ป้ายมาโผล่บนใบของวันนี้ · ป้ายไม่ได้กรองวัน');
else ok('ใบที่ดึงที่นั่งจากล็อกติดป้าย "' + SETUP.agName + '" สีเดียวกับแถบ · ' + dHit.length + ' ใบ' +
        ((SETUP.other && SETUP.other.drew) ? (' · ล็อกช่วงของ ' + SETUP.other.name + ' ที่ถูกดึงวันที่ ' +
          SETUP.other.day + ' ไม่มาติดป้ายผิดวัน') : ''));

/* ══ 5c · กรุ๊ปย่อยยุบเป็นตัวนับ · รายชื่อเต็มอยู่ใน tooltip ═══════════════ */
if (!SETUP.kids) fail('แบ่งกรุ๊ปย่อยไม่สำเร็จ · พิสูจน์ไม่ได้ว่าบรรทัดเดียวรับกรุ๊ปย่อยไหว');
else {
  const bk1 = GOT.bands.find(b => b.lk === SETUP.ids.L1);
  const other = GOT.bands.filter(b => b.lk !== SETUP.ids.L1 && b.kid);
  if (!bk1) fail('ไม่มีแถวของล็อกที่แบ่งกรุ๊ปย่อยไว้');
  else if (!bk1.kid) fail('ล็อกมีกรุ๊ปย่อย ' + SETUP.kids + ' กรุ๊ป แต่แถวไม่บอกเลย');
  else if (SETUP.kidNames.some(n => bk1.kid.indexOf(n) < 0))
    fail('tooltip กรุ๊ปย่อย "' + bk1.kid + '" ควรมีครบทุกชื่อ [' + SETUP.kidNames.join(', ') + ']');
  else if (other.length)
    fail('ล็อกที่ไม่มีกรุ๊ปย่อยกลับขึ้นตัวนับกรุ๊ป · ' + other.length + ' แถว');
  else ok('กรุ๊ปย่อย ' + SETUP.kids + ' กรุ๊ปยุบเป็นตัวนับบรรทัดเดียว · ' +
          'รายชื่อเต็มอยู่ใน tooltip [' + SETUP.kidNames.join(', ') + '] · ' +
          'ล็อกที่ไม่มีกรุ๊ปย่อยไม่ขึ้นตัวนับ');
}

/* ══ 5b · แถวที่นั่งเรียงตรงคอลัมน์ · กวาดตาลงคอลัมน์ AD ได้ไม่สะดุด ═══════ */
if (!GOT.grid.length) fail('ไม่มีแถวที่นั่งให้ตรวจการเรียงคอลัมน์');
else {
  const g = GOT.grid;
  const eBad = g.find(x => x.err);
  const nBad = g.find(x => x.td !== x.th || (x.real != null && x.td !== x.real));
  const sBad = g.find(x => x.span);
  const aBad = g.find(x => !x.adCell);
  if (eBad) fail('แถวที่นั่ง ' + eBad.err);
  else if (sBad) fail('แถวที่นั่งยังใช้ช่องรวบ (colspan) · ตัวเลขไม่ตรงคอลัมน์ ตากวาดลงมาแล้วสะดุด');
  else if (nBad) fail('แถวที่นั่งมี ' + nBad.td + ' ช่อง · หัวตารางมี ' + nBad.th +
                      ' และแถวของคนจริงมี ' + nBad.real + ' · คอลัมน์จะเลื่อนไม่ตรงกัน');
  else if (aBad) fail('จำนวนที่กันไว้ไม่ได้อยู่ใต้คอลัมน์ AD (ช่องที่ ' + (aBad.adIx + 1) +
                      ' มี "' + aBad.adTxt + '")');
  else ok('แถวที่นั่งเรียงตรงคอลัมน์ · ' + g[0].td + ' ช่องเท่าหัวตารางและเท่าแถวของคนจริง · ' +
          'จำนวนที่กันไว้อยู่ใต้ AD (ช่องที่ ' + (g[0].adIx + 1) + ') ทุกแถว ' + g.length + ' แถว');
}

/* ══ 6 · ล็อกที่ถูกดึงจนหมด ต้องหายไปจากใบงานทั้งแถบ ═══════════════════
   §btLkGone · ไม่เหลือที่นั่งให้ใครแล้ว แถบที่บอก "เหลือ 0" กินพื้นที่เต็มแถว
   เพื่อบอกว่าไม่มีอะไร · ร่องรอยว่าที่นั่งมาจากโควตาใคร ยังอยู่ที่ป้ายบนใบจอง */
const w2 = SETUP.want[SETUP.ids.L2];
const b2 = GOT.bands.find(b => b.lk === SETUP.ids.L2);
const zeroBand = GOT.bands.find(b => (b.held || '').trim() === '0');
if (!w2 || w2.held !== 0) fail('ปลูกล็อกที่ดึงจนหมดไม่สำเร็จ (เหลือ ' + (w2 ? w2.held : '?') + ')');
else if (b2) fail('ล็อกที่ใช้หมดแล้ว (' + w2.qty + ' ที่ · ขายครบ) ยังขึ้นแถวอยู่ · ควรหายไปทั้งแถว');
else if (zeroBand) fail('ยังมีแถวล็อกที่เหลือ 0 อยู่ · "' + zeroBand.txt + '"');
else if (!GOT.drawn.length) fail('ล็อกหายไปแล้ว และใบจองก็ไม่มีป้าย "จากล็อก" · ตามรอยโควตาไม่ได้เลย');
else if (!SETUP.drew5 || SETUP.want[SETUP.ids.L5].held !== 0)
  fail('ปลูกล็อกแบบช่วงที่หมดเฉพาะรอบนี้ไม่สำเร็จ (ดึงได้ ' + SETUP.drew5 + ')');
else if (SETUP.l5Status !== 'active')
  fail('ล็อกแบบช่วงถูกตีตรา ' + SETUP.l5Status + ' · เคสนี้ต้องยัง active ถึงจะพิสูจน์ได้ว่ากรองด้วยที่นั่ง ไม่ใช่สถานะ');
else if (GOT.bands.find(b => b.lk === SETUP.ids.L5))
  fail('ล็อกแบบช่วงที่หมดเฉพาะรอบวันนี้ยังขึ้นแถว · สถานะยัง active แต่วันนี้ไม่เหลือที่แล้ว');
else ok('ล็อกที่ใช้หมดแล้วหายไปทั้งแถว · ทั้งล็อกรายวัน (ตีตรา depleted) และล็อกแบบช่วง ' +
        'ที่หมดเฉพาะรอบวันนี้ (สถานะยัง active) · ไม่มีแถวที่เหลือ 0 ค้างอยู่ ' +
        'แต่ยังตามรอยได้จากป้ายบนใบจอง ' + GOT.drawn.length + ' ใบ');

/* ══ 7 · ทริปที่มีแต่ล็อก ไม่มี booking · ต้องขึ้นตาราง ═══════════════════ */
if (!SETUP.bare) ok('ชุดข้อมูลนี้ไม่มีเส้นทางว่างให้ทดสอบทริปที่มีแต่ล็อก · ข้ามข้อนี้');
else {
  const w3 = SETUP.want[SETUP.ids.L3];
  const b3 = GOT.bands.find(b => b.lk === SETUP.ids.L3 && b.held === String(w3.held));
  if (!b3) fail('ทริปที่มีแต่ล็อก ' + w3.qty + ' ที่ ไม่ขึ้นแถวในตาราง');
  else if (GOT.nobk) fail('ยังขึ้นข้อความ "ยังไม่มี booking" ทั้งที่มีที่นั่งล็อกอยู่ ' + w3.qty + ' ที่');
  else ok('ทริปที่ยังไม่มี booking เลย แต่มีล็อก ' + w3.qty + ' ที่ · ขึ้นตารางให้เห็น ไม่ใช่ข้อความว่าง');
}

/* ══ 8 · ล็อกเป็นที่นั่ง ไม่ใช่คน · ยอด pax ต้องไม่ขยับ ═════════════════ */
if (GOT.paxScreen == null || !SETUP.paxRaw) fail('อ่านยอด pax ของทริปที่ปลูกล็อกไม่ได้ · พิสูจน์ไม่ได้ว่าล็อกไม่ถูกนับเป็นคน');
else if (GOT.paxScreen !== SETUP.paxRaw)
  fail('ยอด pax บนจอ ' + GOT.paxScreen + ' · นับเองจาก booking ดิบได้ ' + SETUP.paxRaw +
       ' · ล็อก ' + (w1.qty + (SETUP.want[SETUP.ids.L2] || {}).qty) + ' ที่ไม่ควรถูกนับเป็นคน');
else ok('แถวล็อกเป็นที่นั่ง ไม่ใช่คน · ยอด pax ของทริป ' + GOT.paxScreen +
        ' เท่ากับที่นับเองจาก booking ดิบ (ล็อกไม่เข้าใบงานรถ/เรือ)');

/* ══ 9 · ไม่มี error บนหน้า ═══════════════════════════════════════════ */
const errs = (errors || []).filter(e => !/favicon|fonts\.googleapis/i.test(String(e)));
if (errs.length) fail('มี error บนหน้า ' + errs.length + ' ตัว · ' + String(errs[0]).slice(0, 150));
else ok('ไม่มี error บนหน้าระหว่างทดสอบ');

console.log('\nพัง ' + bad);
await close();
process.exit(bad ? 1 : 0);
