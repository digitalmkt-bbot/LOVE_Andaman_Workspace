// §flDeploy · Fleet Deployment · วางกำลังเรือก่อนเปิดฤดู
//
// ที่มา (2026-09-23) · ก่อนเปิดไฮซีซั่นต้องตอบสามคำถามติดกัน
//   ลำไหนอยู่ท่าไหน → ลำไหนยังติดซ่อมและต้องเสร็จวันไหน → ลำไหนวิ่งเส้นไหนในแต่ละวัน
// ของเดิมกระจายอยู่สามหน้า (Boat Status · Maintenance · Boat Operation)
//
// เทสนี้กันเก้าอย่าง
//   0 เมนูมีจริง และกดแล้วหน้าเปิดจริง (ไม่ใช่ div เปล่า)
//   1 เรือทุกลำต้องโผล่บนกระดาน · หายไปลำเดียวก็แปลว่าวางแผนจากของไม่ครบ
//   2 Seats ready ต้องนับเฉพาะลำที่พร้อมใช้ · ตัวเลขนี้คือตัวที่เอาไปตั้งโควตาขาย
//   3 ย้ายท่าต้องเป็น "ร่าง" · ข้อมูลจริงห้ามขยับจนกว่าคนจะกดบันทึก
//     (หน้านี้เป็นกระดานวางแผน · ลากเล่นดูภาพรวมต้องไม่ไปโผล่ที่หน้าอื่น)
//   4 ปฏิทินต้องเคารพฤดูกาลของเส้นทาง · วันที่ยังไม่เปิดขายต้องขึ้น "ปิดฤดู"
//   5 ที่นั่งต่อวันบนปฏิทินต้องตรงกับที่คำนวณเองจาก TRIPS
//   6 ใส่/ถอดเรือต้องไปผ่านตัวเขียนของ Boat Operation · ด่านกันวันที่ผ่านมาแล้วต้องยังอยู่
//   7 คิวซ่อม · งานไม่มีวันเสร็จต้องเป็นแถบลายทาง · งานที่เสร็จหลังวันเปิดฤดูต้องขึ้นสีเตือน
//   8 หน้านี้ต้องอยู่ในทะเบียนสิทธิ์ · laAllowed() ปล่อยผ่านเมนูที่ไม่รู้จัก = เปิดให้ทุกคน
//
// ⚠ ทุกข้อคำนวณค่าที่คาดหวังจากข้อมูลดิบเอง ไม่เรียกฟังก์ชันของหน้ามาเทียบกับตัวเอง
import { open } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1500, height: 1300 });
page.on('dialog', d => d.accept());
await page.waitForTimeout(1000);

/* ══ 0 · เมนูมีจริง และกดแล้วหน้าเปิด ═════════════════════════════════════ */
const R0 = await page.evaluate(() => {
  const el = document.querySelector('.nav-item[data-view="fl-deployment"]');
  if (!el) return { err: 'ไม่มีเมนู Fleet Deployment ในไซด์บาร์' };
  nav(el);
  const v = document.getElementById('view-fl-deployment');
  const w = document.getElementById('fl-deploy-wrap');
  return {
    err: !v ? 'ไม่มีกล่องหน้า #view-fl-deployment' : '',
    active: !!(v && v.classList.contains('active')),
    len: (w && w.innerHTML || '').length,
    label: el.textContent.trim()
  };
});
if (R0.err) { fail(R0.err); console.log('\nพัง ' + bad); await close(); process.exit(1); }
if (!R0.active)        fail('กดเมนูแล้วหน้าไม่ active');
else if (R0.len < 2000) fail('หน้าเปิดแต่วาดได้แค่ ' + R0.len + ' ตัวอักษร · แทบไม่มีอะไร');
else ok('เมนู "' + R0.label + '" เปิดหน้าได้ · วาด ' + R0.len + ' ตัวอักษร');

/* ══ 1 · เรือทุกลำต้องโผล่บนกระดาน ═══════════════════════════════════════ */
const R1 = await page.evaluate(() => {
  const w = document.getElementById('fl-deploy-wrap');
  const onBoard = [].slice.call(w.querySelectorAll('.fd-boat')).length;
  const want = (BOATS || []).filter(b => b && !b.retired).length;
  const cols = [].slice.call(w.querySelectorAll('.fd-col')).length;
  return { onBoard, want, cols };
});
if (R1.onBoard !== R1.want)
  fail('เรือบนกระดาน ' + R1.onBoard + ' ลำ แต่ทะเบียนมี ' + R1.want + ' ลำ · หายไป ' + (R1.want - R1.onBoard));
else if (R1.cols < 4) fail('กระดานมีแค่ ' + R1.cols + ' คอลัมน์ · ต้องมีสามท่า + อู่');
else ok('เรือครบทุกลำบนกระดาน ' + R1.want + ' ลำ · ' + R1.cols + ' คอลัมน์');

/* ══ 1b · เรือบริษัทกับเรือเช่าต้องแยกกันออก ════════════════
   ลำบริษัทคือกำลังที่ต้องวางคนและรับภาระซ่อมเอง · ลำเช่าคือกำลังเสริมที่เพิ่ม-ถอนได้
   นับรวมกันแล้ววางแผนกำลังคนผิดทันที */
const R1b = await page.evaluate(() => {
  const w = document.getElementById('fl-deploy-wrap');
  const n = () => [].slice.call(w.querySelectorAll('.fd-boat')).length;
  const fleet = (BOATS || []).filter(b => b && !b.retired);
  const wantChr = fleet.filter(b => b.ownership === 'charter').length;
  const wantOwn = fleet.length - wantChr;
  fdSetOwn('all');     const all = n();
  fdSetOwn('own');     const own = n(), ownTags = w.querySelectorAll('.fd-own-tag').length;
  fdSetOwn('charter'); const chr = n(), chrTags = w.querySelectorAll('.fd-own-tag').length;
  fdSetOwn('all');
  return { all, own, chr, wantOwn, wantChr, ownTags, chrTags,
           split: w.querySelectorAll('.fd-split').length };
});
if (!R1b.wantChr) console.log('  ! ชุดนี้ไม่มีเรือเช่า · ข้ามข้อ 1b');
else if (R1b.own !== R1b.wantOwn || R1b.chr !== R1b.wantChr)
  fail('ตัวกรองเจ้าของนับผิด · บริษัท ' + R1b.own + '/' + R1b.wantOwn
    + ' · เช่า ' + R1b.chr + '/' + R1b.wantChr);
else if (R1b.own + R1b.chr !== R1b.all)
  fail('บริษัท ' + R1b.own + ' + เช่า ' + R1b.chr + ' ≠ ทั้งหมด ' + R1b.all + ' · มีลำที่นับซ้ำหรือหายไป');
else if (R1b.ownTags !== 0)
  fail('กรองเรือบริษัทแต่ยังมีป้าย "เช่า" โผล่ ' + R1b.ownTags + ' ใบ');
else if (R1b.chrTags !== R1b.chr)
  fail('กรองเรือเช่า ' + R1b.chr + ' ลำ แต่มีป้ายแค่ ' + R1b.chrTags + ' ใบ');
else ok('แยกเรือบริษัท ' + R1b.wantOwn + ' ลำ / เรือเช่า ' + R1b.wantChr
      + ' ลำ ได้ถูก · ป้าย "เช่า" ขึ้นเฉพาะลำเช่า · หัวคอลัมน์แยกตัวเลข ' + R1b.split + ' ท่า');

/* ══ 2 · Seats planned ต้องนับตามลำที่วางไว้ · ไม่ใช่ตามใบซ่อม ════════════
   ที่มา (2026-09-24) · ผู้ใช้ชี้ว่าตัวเลขควรนับตามลำที่วางไว้บนกระดาน
   เพราะการวางแผนคือการสมมติว่าซ่อมจะเสร็จทัน แล้วไปเร่งให้ทัน
   คำนวณเองจาก BOATS + getBoatCurrentPier โดยไม่แตะฟังก์ชันนับของหน้า */
const R2 = await page.evaluate(() => {
  _fdPlan = { pier: [], drop: [], trip: {}, avail: {}, boats: [], ready: {} };
  fdPlanSave(); flRenderDeployment();
  const w = document.getElementById('fl-deploy-wrap');
  const from = w.querySelector('.fd-season input').value;
  const fleet = (BOATS || []).filter(b => b && !b.retired);
  /* คาดหวัง · ทุกลำที่อยู่ท่านั้นถูกนับทั้ง planned และ placed */
  const want = {};
  fleet.forEach(b => {
    const p = getBoatCurrentPier(b, from);
    if (!want[p]) want[p] = { ready: 0, all: 0, fix: 0 };
    want[p].all += (b.cap || 0);
    want[p].ready += (b.cap || 0);
    if ((boatEffStatus(b, from) || {}).s !== 'available') want[p].fix++;
  });
  const read = () => {
    const got = {};
    [].slice.call(document.querySelectorAll('#fl-deploy-wrap .fd-col')).forEach(c => {
      const m = c.querySelectorAll('.fd-mini b');
      if (m.length >= 2) got[c.dataset.pier] = { ready: +m[0].textContent, all: +m[1].textContent };
    });
    return got;
  };
  const got = read();
  /* กดปุ่ม "นับในแผน" ของลำหนึ่งให้เป็นไม่นับ · planned ต้องลดเท่าที่นั่งลำนั้นพอดี */
  const pk = FD_PIERS.map(p => ({ p, list: fdBoatsAt(p, from) })).find(x => x.list.length);
  let off = null;
  if (pk) {
    const b = pk.list[0];
    const btn = [].slice.call(document.querySelectorAll('#fl-deploy-wrap .fd-boat'))
      .find(c => ((c.querySelector('.bn') || {}).textContent || '').trim() === b.name);
    const rdy = btn && btn.querySelector('.fd-rdy');
    const hadBtn = !!rdy;
    if (rdy) rdy.click();
    const after = read();
    off = { pier: pk.p, name: b.name, cap: b.cap || 0, hadBtn,
            dReady: got[pk.p].ready - after[pk.p].ready,
            dAll:   got[pk.p].all   - after[pk.p].all,
            statusChip: !!(btn && btn.querySelector('.fd-chip')) };
    /* กดกลับ · ต้องกลับมาเท่าเดิม */
    const rdy2 = [].slice.call(document.querySelectorAll('#fl-deploy-wrap .fd-boat'))
      .find(c => ((c.querySelector('.bn') || {}).textContent || '').trim() === b.name);
    if (rdy2 && rdy2.querySelector('.fd-rdy')) rdy2.querySelector('.fd-rdy').click();
    off.back = read()[pk.p].ready;
  }
  return { from, want, got, off, labels: (typeof PIER_LABELS !== 'undefined') ? PIER_LABELS : {} };
});
{
  const miss = [];
  Object.keys(R2.want).forEach(k => {
    if (k === 'shop') return;                                  /* คอลัมน์อู่ไม่มีแถบตัวเลข */
    const g = R2.got[k];
    if (!g) { miss.push(k + ' ไม่มีแถบตัวเลข'); return; }
    if (g.ready !== R2.want[k].ready)
      miss.push(k + ' seats planned ' + g.ready + ' ควรเป็น ' + R2.want[k].ready + ' (ทุกลำที่วางไว้)');
    if (g.all !== R2.want[k].all) miss.push(k + ' seats placed ' + g.all + ' ควรเป็น ' + R2.want[k].all);
  });
  const o = R2.off;
  if (o) {
    if (!o.hadBtn) miss.push('การ์ดเรือไม่มีปุ่มนับในแผนให้กด');
    else if (o.dReady !== o.cap) miss.push('กดไม่นับ ' + o.name + ' แล้ว planned ลด ' + o.dReady + ' · ควรลด ' + o.cap);
    else if (o.dAll !== 0) miss.push('กดไม่นับแล้ว seats placed ขยับ ' + o.dAll + ' · ต้องไม่ขยับ');
    else if (o.back !== R2.got[o.pier].ready) miss.push('กดกลับแล้ว planned ไม่กลับเท่าเดิม');
    else if (!o.statusChip) miss.push('ป้ายสถานะจริงหายจากการ์ด · ต้องอยู่คู่กับปุ่มเสมอ');
  }
  if (miss.length) fail('ตัวเลขที่นั่ง · ' + miss.join(' · '));
  else ok('Seats planned นับทุกลำที่วางไว้ตรงกับที่คำนวณเองทุกท่า ณ ' + R2.from
      + ' · กดไม่นับ ' + R2.off.name + ' แล้วลด ' + R2.off.cap + ' ที่ กดกลับแล้วเท่าเดิม · ป้ายสถานะจริงยังอยู่');
}

/* ══ 2b · เรียงการ์ด · คาตามารัน → สปีดโบ๊ท 4 เครื่อง → 3 เครื่อง ══════════
   ลำดับนี้คือลำดับที่ผู้ใช้จัดจริง · อ่านชื่อจาก DOM แล้วเทียบกับลำดับที่คำนวณเองจาก BOATS */
const R2b = await page.evaluate(() => {
  const rank = b => {
    const t = String((b && b.type) || '').toLowerCase();
    return t.indexOf('cata') >= 0 ? 0 : (t.indexOf('speed') >= 0 ? 1 : 2);
  };
  const out = [];
  [].slice.call(document.querySelectorAll('#fl-deploy-wrap .fd-col[data-pier]')).forEach(c => {
    const names = [].slice.call(c.querySelectorAll('.fd-boat .bn')).map(x => x.textContent.trim());
    if (names.length < 2) return;
    const boats = names.map(n => (BOATS || []).find(b => b && b.name === n)).filter(Boolean);
    if (boats.length !== names.length) return;                 /* มีเรือสมมติปน · ข้ามคอลัมน์นี้ */
    /* กลุ่มบริษัท/เช่าแยกกันอยู่แล้ว · ตรวจลำดับภายในแต่ละกลุ่ม */
    ['own', 'chr'].forEach(g => {
      const grp = boats.filter(b => (g === 'chr') === (b.ownership === 'charter'));
      for (let i = 1; i < grp.length; i++) {
        const a = grp[i - 1], z = grp[i];
        const ka = [rank(a), -(Number(a.engineCount) || 0), -(a.cap || 0)];
        const kz = [rank(z), -(Number(z.engineCount) || 0), -(z.cap || 0)];
        for (let j = 0; j < 3; j++) {
          if (ka[j] < kz[j]) break;
          if (ka[j] > kz[j]) { out.push(c.dataset.pier + ': ' + a.name + ' อยู่ก่อน ' + z.name); break; }
        }
      }
    });
  });
  const first = [].slice.call(document.querySelectorAll('#fl-deploy-wrap .fd-col[data-pier] .fd-boat .bn'))
                  .slice(0, 3).map(x => x.textContent.trim());
  /* กองเรือจริงบังเอิญมีจำนวนเครื่องเรียงตามที่นั่งพอดี · การตัดกติกา "เครื่องก่อนที่นั่ง" ออก
     จึงไม่เปลี่ยนลำดับเลยถ้าดูแต่ของจริง · ปั้นชุดที่ 3 เครื่องที่นั่งเยอะกว่า 4 เครื่องมาตรวจด้วย */
  const mk = (n, t, e, c) => ({ id: 'x' + n, name: n, type: t, engineCount: e, cap: c });
  const probe = [mk('S3big', 'Speedboat', 3, 99), mk('S4small', 'Speedboat', 4, 10),
                 mk('Cat3', 'Catamaran', 3, 5), mk('Unknown', '', 4, 200)];
  return { bad: out, first, probe: fdSort(probe).map(b => b.name) };
});
{
  /* ลำดับที่ควรเป็น คิดจากกติกาที่ตกลงกันไว้ ไม่ได้ถามหน้าเอา
     คาตามารันก่อน → สปีดโบ๊ทเรียงตามจำนวนเครื่อง → ชนิดที่ไม่รู้จักไว้ท้ายสุดแม้ที่นั่งจะเยอะ */
  const wantProbe = ['Cat3', 'S4small', 'S3big', 'Unknown'];
  if (R2b.bad.length) fail('เรียงเรือผิดลำดับ ' + R2b.bad.length + ' คู่ · ' + R2b.bad.slice(0, 3).join(' · '));
  else if (String(R2b.probe) !== String(wantProbe))
    fail('ชุดตรวจเรียงได้ ' + R2b.probe.join(' → ') + ' · ควรเป็น ' + wantProbe.join(' → '));
  else ok('เรียงคาตามารัน → สปีดโบ๊ท 4 เครื่อง → 3 เครื่อง ถูกทุกคอลัมน์ · หัวแถว ' + R2b.first.join(' / ')
      + ' · ชุดตรวจที่ 3 เครื่องที่นั่งเยอะกว่า 4 เครื่องก็ยังเรียงตามเครื่องก่อน');
}

/* ══ 2c · ชื่อเรือบนการ์ดห้ามถูกตัด ════════════════════════════════════
   คอลัมน์แคบ + ป้ายหลายใบบนแถวเดียว = ชื่อโดนตัดเป็น "Andam…" ซึ่งอ่านผิดลำได้
   วัดจริงจาก DOM · ข้อความที่วาดต้องเท่าชื่อเต็ม และกล่องต้องไม่ล้นจนถูกครอบ */
const R2c = await page.evaluate(() => {
  /* ตั้งสภาพให้แถวแน่นที่สุดก่อนวัด · เรือเช่ามีป้าย "เช่า" เพิ่มมาอีกใบบนแถวเดียวกัน
     กองทุกลำเช่าไว้ท่าเดียว แล้วกดไม่นับบางลำ (ป้ายยาวขึ้นอีก) · นี่คือกรณีที่เคยตัดชื่อจริง */
  _fdPlan = { pier: [], drop: [], trip: {}, avail: {}, boats: [], ready: {} }; fdPlanSave();
  fdSetScope('month'); _fdWinIx = 0; fdSetOwn('all'); flRenderDeployment();
  const d = fdWin().from;
  (BOATS || []).filter(b => b && !b.retired && b.ownership === 'charter').forEach(b => {
    if (fdPierOf(b, d) !== 'ranong') { _fdSel = b.id; fdMove('ranong'); }
    if (!fdRealReady(b, d)) fdReadyToggle(b.id);
  });
  flRenderDeployment();
  const cut = [], over = [];
  [].slice.call(document.querySelectorAll('#fl-deploy-wrap .fd-boat')).forEach(c => {
    const bn = c.querySelector('.bn'); if (!bn) return;
    const id = c.dataset.id;
    const b = (BOATS || []).find(x => x && x.id === id) || (_fdPlan.boats || []).find(x => x && x.id === id);
    const shown = (bn.textContent || '').trim();
    if (b && shown !== String(b.name || '').trim()) cut.push(shown + ' ≠ ' + b.name);
    if (bn.scrollWidth > bn.clientWidth + 1) over.push(shown + ' (' + bn.scrollWidth + '>' + bn.clientWidth + ')');
  });
  const n = document.querySelectorAll('#fl-deploy-wrap .fd-boat .bn').length;
  /* ชื่อที่ยาวที่สุดที่โผล่บนกระดาน · ไว้บอกในผลว่าเทสนี้เจอของจริงแค่ไหน */
  const longest = [].slice.call(document.querySelectorAll('#fl-deploy-wrap .fd-boat .bn'))
    .map(x => (x.textContent || '').trim()).sort((a, z) => z.length - a.length)[0] || '';
  return { cut, over, n, longest };
});
if (R2c.cut.length)
  fail('ชื่อเรือถูกตัด ' + R2c.cut.length + ' ใบ · ' + R2c.cut.slice(0, 3).join(' · '));
else if (R2c.over.length)
  fail('ชื่อเรือล้นกล่อง ' + R2c.over.length + ' ใบ · ' + R2c.over.slice(0, 3).join(' · '));
else ok('ชื่อเรือบนการ์ดครบทุกตัวอักษรทั้ง ' + R2c.n + ' ใบ · ยาวสุด "' + R2c.longest + '"');

/* ══ 3 · ย้ายท่าต้องเป็น "ร่าง" · ข้อมูลจริงห้ามขยับ ══════════════════════
   หน้านี้คือกระดานวางแผน · ลากเล่นดูภาพรวมต้องไม่ไปโผล่ที่ใบงานเรือ
   หน้า Boat Status หรือหน้าจัดเรือ จนกว่าคนจะกดบันทึกเอง */
const R3 = await page.evaluate(() => {
  fdSetScope('month'); _fdWinIx = 0;
  _fdPlan = { pier: [], drop: [], trip: {} }; fdPlanSave(); flRenderDeployment();
  const W = fdWindows();
  const fleet = (BOATS || []).filter(b => b && !b.retired);
  const b = fleet.find(x => getBoatCurrentPier(x, W[0].from) !== 'shop');
  if (!b) return { skip: 'ไม่มีเรือที่ย้ายได้' };
  const was = getBoatCurrentPier(b, W[0].from);
  const to  = ['tublamu', 'panwa', 'ranong'].find(p => p !== was);
  /* ถ่ายรูปข้อมูลจริงไว้ก่อน · ทั้งใบย้ายท่าของลำนี้ และตารางเดินเรือของวันนั้น */
  const snapA = JSON.stringify(b.assignments || []);
  const snapT = JSON.stringify((TRIPS || {})[W[0].from] || {});
  _fdSel = b.id;
  fdMove(to);
  const w = document.getElementById('fl-deploy-wrap');
  let col = '';
  [].slice.call(w.querySelectorAll('.fd-col')).forEach(c => {
    if ([].slice.call(c.querySelectorAll('.fd-boat .bn')).some(x => x.textContent.trim() === b.name))
      col = ((c.querySelector('.nm') || {}).textContent || '').replace(/\d+\s*ลำ$/, '').trim();
  });
  return {
    name: b.name, was, to, w0: W[0],
    planN: fdPlanN(),
    board: fdPierOf(b, W[0].from),
    real:  getBoatCurrentPier(b, W[0].from),
    asnSame:  JSON.stringify(b.assignments || []) === snapA,
    tripSame: JSON.stringify((TRIPS || {})[W[0].from] || {}) === snapT,
    col, want: (typeof PIER_LABELS !== 'undefined' ? PIER_LABELS[to] : to),
    bar: !!w.querySelector('.fd-planbar.on')
  };
});
if (R3.skip) console.log('  ! ' + R3.skip + ' · ข้ามข้อ 3');
else if (R3.planN !== 1)   fail('ย้ายแล้วร่างมี ' + R3.planN + ' รายการ · ต้องเป็น 1');
else if (!R3.asnSame)      fail('ย้ายแล้วใบย้ายท่าจริงของ ' + R3.name + ' ถูกแก้ · ร่างต้องไม่แตะข้อมูลจริง');
else if (!R3.tripSame)     fail('ย้ายแล้วตารางเดินเรือจริงถูกแก้ · ร่างต้องไม่แตะข้อมูลจริง');
else if (R3.real !== R3.was)
  fail('getBoatCurrentPier (ตัวที่หน้าอื่นใช้) เปลี่ยนเป็น ' + R3.real + ' แล้ว · ต้องยังเป็น ' + R3.was);
else if (R3.board !== R3.to) fail('กระดานยังไม่ขยับ · ยังเห็นเป็น ' + R3.board + ' · ควรเป็น ' + R3.to);
else if (R3.col !== R3.want) fail('การ์ดยังอยู่คอลัมน์ "' + R3.col + '" · ควรอยู่ "' + R3.want + '"');
else if (!R3.bar)            fail('ไม่มีแถบบอกว่ามีแผนร่างค้างอยู่');
else ok('ย้ายแล้วเป็นร่าง · ' + R3.name + ' บนกระดานอยู่ ' + R3.to
      + ' แต่ข้อมูลจริงยังเป็น ' + R3.was + ' · ใบย้ายท่าและตารางเดินเรือไม่ถูกแตะ');

/* ══ 3b · ร่างต้องครอบแค่ช่วงที่เลือก ════════════════════════════════════
   ถ้าร่างครอบทั้งฤดู แผนโยกสลับระหว่างฤดูจะทำไม่ได้เลย */
const R3b = await page.evaluate(() => {
  const W = fdWindows();
  if (W.length < 2) return { skip: 'ฤดูนี้มีช่วงเดียว' };
  const p = (_fdPlan.pier || [])[0];
  if (!p) return { skip: 'ไม่มีร่างให้ตรวจ' };
  const b = (BOATS || []).find(x => x.id === p.boatId);
  return { name: b.name, w0: W[0], w1: W[1], rec: { s: p.from, e: p.to },
           inWin: fdPierOf(b, W[0].to), next: fdPierOf(b, W[1].from),
           nextReal: getBoatCurrentPier(b, W[1].from), to: p.toPier };
});
if (R3b.skip) console.log('  ! ' + R3b.skip + ' · ข้ามข้อ 3b');
else if (R3b.rec.s !== R3b.w0.from || R3b.rec.e !== R3b.w0.to)
  fail('ร่างครอบ ' + R3b.rec.s + '→' + R3b.rec.e + ' · ควรครอบแค่ ' + R3b.w0.from + '→' + R3b.w0.to);
else if (R3b.inWin !== R3b.to)
  fail('ท้ายช่วงเรือหลุดไป ' + R3b.inWin + ' · ควรยังเป็น ' + R3b.to);
else if (R3b.next !== R3b.nextReal)
  fail('ช่วงถัดไปถูกร่างลากไปด้วย · กระดานเห็น ' + R3b.next + ' แต่ของจริงเป็น ' + R3b.nextReal);
else ok('ร่างครอบแค่ ' + R3b.w0.lb + ' (' + R3b.rec.s + '→' + R3b.rec.e + ') · ' + R3b.w1.lb + ' ไม่ขยับ');

/* ══ 3e · ช่วงกำหนดเอง ═════════════════════════════
   เดือน/สัปดาห์ไม่พอ · เรือเช่ามา 10 วัน หรือโยกเรือกลางสัปดาห์ ก็ต้องกำหนดเองได้ */
const R3e = await page.evaluate(() => {
  const S = fdSeason();
  const from = fdAddDays(S.from, 20), to = fdAddDays(S.from, 29);
  fdSetScope('custom');
  fdSetCustom('from', from);
  fdSetCustom('to', to);
  const win = fdWin();
  const fleet = (BOATS || []).filter(b => b && !b.retired);
  const b = fleet.find(x => fdPierOf(x, from) !== 'shop'
                         && !(_fdPlan.pier || []).some(p => p.boatId === x.id));
  if (!b) return { skip: 'ไม่มีเรือที่ย้ายได้', win, from, to };
  const was = fdPierOf(b, from);
  const dest = ['tublamu', 'panwa', 'ranong'].find(p => p !== was);
  _fdSel = b.id; fdMove(dest);
  const rec = (_fdPlan.pier || []).filter(p => p.boatId === b.id).pop() || {};
  const out = { win, from, to, name: b.name, was, dest, rec: { s: rec.from, e: rec.to },
    inside:  fdPierOf(b, to),
    before:  fdPierOf(b, fdAddDays(from, -1)),
    after:   fdPierOf(b, fdAddDays(to, 1)) };
  if (rec.id) fdPlanDel(rec.id);
  fdSetScope('month'); _fdWinIx = 0;
  return out;
});
if (R3e.skip) console.log('  ! ' + R3e.skip + ' · ข้ามข้อ 3e');
else if (R3e.win.from !== R3e.from || R3e.win.to !== R3e.to)
  fail('ตั้งช่วงเอง ' + R3e.from + '→' + R3e.to + ' แต่หน้าใช้ ' + R3e.win.from + '→' + R3e.win.to);
else if (R3e.rec.s !== R3e.from || R3e.rec.e !== R3e.to)
  fail('ร่างครอบ ' + R3e.rec.s + '→' + R3e.rec.e + ' · ควรครอบวันที่ตั้งเอง ' + R3e.from + '→' + R3e.to);
else if (R3e.inside !== R3e.dest)
  fail('วันสุดท้ายของช่วงเรือหลุดไป ' + R3e.inside + ' · ควรเป็น ' + R3e.dest);
else if (R3e.before === R3e.dest || R3e.after === R3e.dest)
  fail('ร่างรั่วออกนอกช่วง · ก่อนหน้า=' + R3e.before + ' หลัง=' + R3e.after);
else ok('ช่วงกำหนดเอง ' + R3e.from + '→' + R3e.to + ' (10 วัน) · '
      + R3e.name + ' อยู่ ' + R3e.dest + ' เฉพาะในช่วง · ก่อนหน้าหลังไม่ขยับ');

/* ══ 3c · หน้านี้ต้องไม่มีทางเขียนกลับระบบเลย ═════════════════════════════
   ข้อนี้คือสัญญาหลักของหน้า · ลากอะไรก็ได้ กดอะไรก็ได้
   BOATS กับ TRIPS ต้องเหมือนเดิมทุกตัวอักษร */
const R3c = await page.evaluate(() => {
  const snapB = JSON.stringify(BOATS);
  const snapT = JSON.stringify(TRIPS);
  const W = fdWindows();
  const fleet = (BOATS || []).filter(b => b && !b.retired);
  const b = fleet.find(x => fdPierOf(x, W[0].from) !== 'shop');
  /* กวนให้ครบทุกทาง · ย้ายท่า · ตั้งช่วงเช่า · เพิ่มเรือ · จัดเส้นทางในปฏิทิน */
  if (b) {
    const to = ['tublamu', 'panwa', 'ranong'].find(p => p !== fdPierOf(b, W[0].from));
    _fdSel = b.id; fdMove(to);
    fdSetScope('season'); _fdSel = b.id; fdMove(to === 'ranong' ? 'panwa' : 'ranong');
    fdSetScope('month'); _fdWinIx = 0;
    fdAvailOn(b.id); fdSetAvail(b.id, 'to', W[0].to);
  }
  _fdAddPier = 'tublamu'; flRenderDeployment();
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  set('fd-nb-name', 'ทดสอบไม่เขียนกลับ'); set('fd-nb-cap', '40');
  fdAddSave('tublamu');
  /* ปฏิทิน · ใส่และถอดเรือ */
  fdTab('month');
  const d = _fdMonth + '-20';
  const r = (ROUTES || []).find(x => (x.pier || '') === _fdPier);
  if (r && b) { fdOpenDay(d); fdAssign(r.id, d, b.id); fdUnassign(d, b.id); }
  fdTab('pier');
  return {
    boatsSame: JSON.stringify(BOATS) === snapB,
    tripsSame: JSON.stringify(TRIPS) === snapT,
    noApply:   (typeof fdPlanApply === 'undefined'),
    noTrim:    (typeof fdTrim === 'undefined'),
    planN: fdPlanN(),
    btns: [].slice.call(document.querySelectorAll('#fl-deploy-wrap .fd-planbar button'))
            .map(x => x.textContent.trim())
  };
});
if (!R3c.boatsSame) fail('ทำอะไรบนกระดานแล้ว BOATS จริงเปลี่ยน · หน้านี้ต้องไม่เขียนกลับระบบ');
else if (!R3c.tripsSame) fail('ทำอะไรบนกระดานแล้ว TRIPS จริงเปลี่ยน · หน้านี้ต้องไม่เขียนกลับระบบ');
else if (!R3c.noApply)  fail('ยังมีฟังก์ชัน fdPlanApply อยู่ · ทางเขียนกลับต้องถูกถอดออก');
else if (!R3c.noTrim)   fail('ยังมีฟังก์ชัน fdTrim อยู่ · ตัวนี้มีไว้แก้ใบจริงเท่านั้น');
else if (!R3c.planN)    fail('กวนไปตั้งหลายอย่างแต่ร่างว่าง · กระดานไม่ได้จำอะไรเลย');
else if (R3c.btns.some(t => /บันทึก|save/i.test(t)))
  fail('ยังมีปุ่มบันทึกอยู่บนแถบแผน · ' + R3c.btns.join(' / '));
else ok('กวนครบทุกทาง (ย้ายท่า · ตั้งช่วงเช่า · เพิ่มเรือ · จัดเส้นทาง) รวม ' + R3c.planN
      + ' รายการ · BOATS/TRIPS จริงไม่ขยับสักตัวอักษร · ไม่มีปุ่มบันทึกและไม่มีทางเขียนกลับ');

/* ══ 3f · เรือเช่าที่เช่ามาแค่บางวัน ══════════════════════════════════════
   สองทาง · ตั้งช่วงเช่าให้ลำที่มีในทะเบียน และเพิ่มลำใหม่ที่ยังไม่มี
   นอกช่วงต้องหายจากกระดาน ไม่งั้นจะนับที่นั่งเกินจริงทั้งฤดู */
const R3f = await page.evaluate(() => {
  _fdPlan = { pier: [], drop: [], trip: {}, avail: {}, boats: [] }; fdPlanSave();
  fdSetScope('month'); _fdWinIx = 0; flRenderDeployment();
  const W = fdWindows();
  const f = fdAddDays(W[0].from, 3), t = fdAddDays(W[0].from, 7);
  const names = d => fdBoatsAt('tublamu', d).map(x => x.name);
  const seats = d => fdBoatsAt('tublamu', d).filter(x => fdCanRun(x, d))
                      .reduce((s, x) => s + (x.cap || 0), 0);
  const seat0 = seats(f);

  /* 1 · เพิ่มลำใหม่ที่ยังไม่มีในทะเบียน */
  _fdAddPier = 'tublamu'; flRenderDeployment();
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  set('fd-nb-name', 'เรือเช่าทดสอบ'); set('fd-nb-cap', '48'); set('fd-nb-crew', '4');
  set('fd-nb-from', f); set('fd-nb-to', t);
  fdAddSave('tublamu');
  const nb = (_fdPlan.boats || [])[0] || {};
  const inReg = (BOATS || []).some(x => x && x.id === nb.id);

  /* 2 · ตั้งช่วงเช่าให้เรือเช่าที่มีในทะเบียนอยู่แล้ว */
  const chr = (BOATS || []).find(x => x && !x.retired && x.ownership === 'charter');
  let chrIn = null, chrOut = null;
  if (chr) {
    fdAvailOn(chr.id); fdSetAvail(chr.id, 'from', f); fdSetAvail(chr.id, 'to', t);
    const p = fdPierOf(chr, f);
    chrIn  = fdBoatsAt(p, f).some(x => x.id === chr.id);
    chrOut = fdBoatsAt(p, fdAddDays(t, 1)).some(x => x.id === chr.id);
  }
  return {
    f, t, nb: nb.name, inReg,
    inWin:  names(f).indexOf('เรือเช่าทดสอบ') >= 0,
    before: names(fdAddDays(f, -1)).indexOf('เรือเช่าทดสอบ') >= 0,
    after:  names(fdAddDays(t, 1)).indexOf('เรือเช่าทดสอบ') >= 0,
    seatIn: seats(f) - seat0, seatOut: seats(fdAddDays(t, 1)) - seats(fdAddDays(t, 1)),
    seatsAfter: seats(fdAddDays(t, 1)), seat0,
    chr: chr && chr.name, chrIn, chrOut
  };
});
{
  const bad3f = [];
  if (!R3f.inWin)  bad3f.push('เรือที่เพิ่มเองไม่โผล่ในช่วงเช่า');
  if (R3f.before || R3f.after) bad3f.push('เรือที่เพิ่มเองโผล่นอกช่วงเช่าด้วย');
  if (R3f.inReg)   bad3f.push('เรือที่เพิ่มเองหลุดเข้าไปอยู่ในทะเบียน BOATS จริง');
  if (R3f.seatIn !== 48) bad3f.push('ที่นั่งในช่วงเพิ่มขึ้น ' + R3f.seatIn + ' · ควรเป็น 48');
  if (R3f.seatsAfter !== R3f.seat0) bad3f.push('นอกช่วงที่นั่งไม่กลับเท่าเดิม');
  if (R3f.chr) {
    if (!R3f.chrIn)  bad3f.push(R3f.chr + ' หายจากกระดานทั้งที่อยู่ในช่วงเช่า');
    if (R3f.chrOut)  bad3f.push(R3f.chr + ' ยังโผล่นอกช่วงเช่า');
  }
  if (bad3f.length) fail('เรือเช่าบางวัน · ' + bad3f.join(' · '));
  else ok('เรือเช่าบางวันจัดการได้สองทาง · เพิ่ม "' + R3f.nb + '" 48 ที่ เช่า ' + R3f.f + '→' + R3f.t
      + ' (โผล่เฉพาะในช่วง ไม่เข้าทะเบียนจริง) · ตั้งช่วงเช่าให้ ' + R3f.chr + ' แล้วนอกช่วงหายจากกระดาน');
}
/* ══ 3d · ลากวางได้ และเอาออกจากร่างได้ ══════════════════════════════════ */
const R3d = await page.evaluate(() => {
  flRenderDeployment();
  const w = document.getElementById('fl-deploy-wrap');
  const cards = [].slice.call(w.querySelectorAll('.fd-boat'));
  const cols  = [].slice.call(w.querySelectorAll('.fd-col[data-pier]'));
  const drag  = cards.filter(c => c.getAttribute('draggable') === 'true').length;
  const drop  = cols.filter(c => c.getAttribute('ondrop')).length;
  const W = fdWindows();
  const fleet = (BOATS || []).filter(b => b && !b.retired);
  const b = fleet.find(x => fdPierOf(x, W[0].from) !== 'shop'
                         && !(_fdPlan.pier || []).some(p => p.boatId === x.id));
  if (!b) return { drag, drop, cards: cards.length, cols: cols.length, skip: 1 };
  const was = fdPierOf(b, W[0].from);
  const to  = ['tublamu', 'panwa', 'ranong'].find(p => p !== was);
  const col = cols.find(c => c.dataset.pier === to);
  const snapA = JSON.stringify(b.assignments || []);
  const n0 = fdPlanN();
  /* ลากจริง · เรียก fdDrop ด้วย event ปลอม เหมือนที่เบราว์เซอร์ส่งมา */
  fdDrop({ preventDefault(){}, dataTransfer:{ getData(){ return b.id; } } }, col);
  const afterDrop = fdPierOf(b, W[0].from);
  const nDrop = fdPlanN();
  const fresh = (_fdPlan.pier || []).filter(p => p.boatId === b.id).pop();
  let back = null, nBack = null;
  if (fresh) { fdPlanDel(fresh.id); back = fdPierOf(b, W[0].from); nBack = fdPlanN(); }
  return { drag, drop, cards: cards.length, cols: cols.length, name: b.name, was, to,
           afterDrop, back, added: nDrop - n0, removed: nDrop - nBack,
           asnSame: JSON.stringify(b.assignments || []) === snapA };
});
{
  const bad3d = [];
  if (R3d.drag !== R3d.cards) bad3d.push('การ์ดลากได้ ' + R3d.drag + ' จาก ' + R3d.cards + ' ใบ');
  if (R3d.drop !== R3d.cols)  bad3d.push('คอลัมน์รับของที่ลากมา ' + R3d.drop + ' จาก ' + R3d.cols);
  if (!R3d.skip) {
    if (R3d.added !== 1)          bad3d.push('ลากวางแล้วร่างเพิ่ม ' + R3d.added + ' รายการ · ต้องเป็น 1');
    if (R3d.afterDrop !== R3d.to) bad3d.push('ลากวางแล้วกระดานยังเห็น ' + R3d.afterDrop + ' · ควรเป็น ' + R3d.to);
    if (R3d.removed !== 1)        bad3d.push('กด ✕ แล้วร่างลดลง ' + R3d.removed + ' · ต้องเป็น 1');
    if (R3d.back !== R3d.was)     bad3d.push('เอาออกจากร่างแล้วยังเห็น ' + R3d.back + ' · ควรกลับไป ' + R3d.was);
    if (!R3d.asnSame)             bad3d.push('ลากวางไปแตะใบย้ายท่าจริงเข้าแล้ว');
  }
  if (bad3d.length) fail('ลากวาง/เอาออกจากร่าง · ' + bad3d.join(' · '));
  else ok('ลากวางได้ทุกใบ (' + R3d.cards + ' การ์ด / ' + R3d.cols + ' คอลัมน์) · ลาก ' + R3d.name
      + ' → ' + R3d.to + ' เป็นร่าง แล้วกด ✕ เอาออก กลับไป ' + R3d.was + ' · ข้อมูลจริงไม่ถูกแตะ');
}
/* ══ 3g · เรือในอู่ต้องโยกมาวางบนกระดานได้ ═════════════
   กระดานนี้คือการสมมติ "ถ้าซ่อมเสร็จทัน ลำนี้จะไปอยู่ท่าไหน"
   กันไม่ให้ย้าย = วางแผนไม่ได้ · แต่ป้ายซ่อมต้องคาอยู่ และต้องขึ้นรายการที่ต้องไปเร่ง */
const R3g = await page.evaluate(() => {
  _fdPlan = { pier: [], drop: [], trip: {}, avail: {}, boats: [] }; fdPlanSave();
  fdSetScope('month'); _fdWinIx = 0; fdSetOwn('all'); flRenderDeployment();
  const W = fdWindows();
  const inShop = fdBoatsAt('shop', W[0].from);
  if (!inShop.length) return { skip: 'ชุดนี้ไม่มีเรืออยู่อู่' };
  const b = inShop[0];
  _fdSel = b.id; fdMove('tublamu');
  const w = document.getElementById('fl-deploy-wrap');
  let col = '';
  [].slice.call(w.querySelectorAll('.fd-col')).forEach(c => {
    if ([].slice.call(c.querySelectorAll('.fd-boat .bn')).some(x => x.textContent.trim() === b.name))
      col = (c.dataset.pier || '');
  });
  const card = [].slice.call(w.querySelectorAll('.fd-boat'))
    .find(c => ((c.querySelector('.bn') || {}).textContent || '').trim() === b.name);
  const chase = [].slice.call(w.querySelectorAll('.fd-chase .ci'))
    .find(x => x.textContent.indexOf(b.name) >= 0);
  return {
    name: b.name, col, pier: fdPierOf(b, W[0].from),
    realPier: getBoatCurrentPier(b, W[0].from),
    keepsFlag: !!(card && card.querySelector('.fd-flag.bad')),
    inChase: !!chase,
    chaseMoved: !!(chase && chase.classList.contains('moved')),
    chaseN: w.querySelectorAll('.fd-chase .ci').length
  };
});
if (R3g.skip) console.log('  ! ' + R3g.skip + ' · ข้ามข้อ 3g');
else if (R3g.pier !== 'tublamu' || R3g.col !== 'tublamu')
  fail('โยกเรือออกจากอู่ไม่ได้ · ' + R3g.name + ' ยังอยู่ ' + R3g.pier + ' คอลัมน์ ' + R3g.col);
else if (R3g.realPier === 'tublamu') fail('โยกแล้วข้อมูลจริงขยับด้วย · ต้องเป็นร่างเท่านั้น');
else if (!R3g.keepsFlag) fail('โยกออกจากอู่แล้วป้ายงานซ่อมหาย · ต้องติดอยู่เพื่อให้รู้ว่าต้องเร่ง');
else if (!R3g.inChase) fail(R3g.name + ' ไม่ขึ้นในรายการเรือที่ต้องเร่งซ่อม');
else if (!R3g.chaseMoved) fail(R3g.name + ' ขึ้นในรายการแต่ไม่ติดป้ายว่าย้ายมาในแผน');
else ok('โยก ' + R3g.name + ' ออกจากอู่มา Tub Lamu ได้ · ป้ายซ่อมยังติด · '
      + 'ขึ้นรายการต้องเร่งซ่อม (' + R3g.chaseN + ' ลำ) พร้อมป้าย ย้ายมาในแผน');

/* ══ 3h · ที่พักเรือ ══════════════════════════════
   กระดานเปล่าไว้พักเรือที่ยังไม่ตัดสิน · เรือที่พักไว้ต้องไม่ถูกนับเป็นที่นั่งของท่าไหน */
const R3h = await page.evaluate(() => {
  const W = fdWindows(), d = W[0].from;
  const seatsAt = p => fdBoatsAt(p, d).filter(x => fdCanRun(x, d)).reduce((s, x) => s + (x.cap || 0), 0);
  const pick = FD_PIERS.map(p => ({ p, list: fdBoatsAt(p, d).filter(x => fdCanRun(x, d)) }))
                       .find(x => x.list.length);
  if (!pick) return { skip: 'ไม่มีเรือพร้อมใช้ให้ย้าย' };
  const b = pick.list[0], before = seatsAt(pick.p);
  const w = document.getElementById('fl-deploy-wrap');
  const tray = !!w.querySelector('.fd-hold[data-pier="hold"]');
  _fdSel = b.id; fdMove('hold');
  const after = seatsAt(pick.p);
  const inTray = [].slice.call(document.querySelectorAll('#fl-deploy-wrap .fd-hold .hc'))
    .some(x => x.textContent.indexOf(b.name) >= 0);
  const anyPier = FD_PIERS.some(p => fdBoatsAt(p, d).some(x => x.id === b.id));
  return { tray, name: b.name, pier: pick.p, cap: b.cap || 0, before, after, inTray, anyPier,
           dropZone: !!w.querySelector('.fd-hold[ondrop]') };
});
if (R3h.skip) console.log('  ! ' + R3h.skip + ' · ข้ามข้อ 3h');
else if (!R3h.tray)     fail('ไม่มีที่พักเรือบนกระดาน');
else if (!R3h.dropZone) fail('ที่พักเรือรับของที่ลากมาไม่ได้');
else if (!R3h.inTray)   fail(R3h.name + ' ไม่ไปโผล่ที่ที่พักเรือ');
else if (R3h.anyPier)   fail(R3h.name + ' พักอยู่แต่ยังนับอยู่ในท่าด้วย');
else if (R3h.before - R3h.after !== R3h.cap)
  fail('พักเรือแล้วที่นั่งของ ' + R3h.pier + ' ลด ' + (R3h.before - R3h.after) + ' · ควรลด ' + R3h.cap);
else ok('ที่พักเรือใช้งานได้ · พัก ' + R3h.name + ' จาก ' + R3h.pier
      + ' → ที่นั่งท่านั้นลด ' + R3h.cap + ' และไม่ไปนับที่ท่าอื่น');

/* ══ 3i · SAVE mockup · เก็บเป็นรอบ แล้ววางรอบถัดไปต่อ ══════════════════
   ที่มา (2026-09-24) · ผู้ใช้อยากเห็นว่ารอบนี้ครอบวันไหนถึงวันไหน แล้ววางรอบถัดไปต่อ
   ข้อนี้กันสามอย่าง · เซฟแล้วเปิดกลับมาได้ครบ · คนละคีย์กับข้อมูลจริง · ยังไม่เขียนกลับระบบ */
const R3i = await page.evaluate(() => {
  const LS = 'loveandaman_v2';
  const snapB = JSON.stringify(BOATS), snapT = JSON.stringify(TRIPS);
  const realBefore = localStorage.getItem(LS);
  try { localStorage.removeItem('la_fd_plans'); } catch (_) {}
  _fdSaved = null;
  _fdPlan = { pier: [], drop: [], trip: {}, avail: {}, boats: [], ready: {} }; fdPlanSave();
  fdSetScope('custom'); fdSetCustom('from', fdSeason().from);
  fdSetCustom('to', fdAddDays(fdSeason().from, 9));
  const W1 = fdWin();
  /* รอบที่ 1 · ย้ายเรือลำหนึ่ง แล้วกดไม่นับอีกลำ จะได้มีของให้เทียบตอนเปิดกลับมา */
  const fleet = (BOATS || []).filter(b => b && !b.retired);
  const b1 = fleet.find(x => fdPierOf(x, W1.from) !== 'shop');
  const to = ['tublamu', 'panwa', 'ranong'].find(p => p !== fdPierOf(b1, W1.from));
  _fdSel = b1.id; fdMove(to);
  fdReadyToggle(b1.id);
  const n1 = fdPlanN(), pier1 = fdPierOf(b1, W1.from), run1 = fdCanRun(b1, W1.from);
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  fdSaveOpen(); set('fd-sv-name', 'รอบทดสอบ 1'); fdSaveDo();
  const savedN1 = fdSaved().length;

  /* กดวางรอบถัดไป · ช่วงต้องเริ่มวันถัดจากรอบแรกพอดี ไม่ทับและไม่เว้น */
  fdSavedNext();
  const W2 = fdWin();
  const gapless = (W2.from === fdAddDays(W1.to, 1));

  /* รอบที่ 2 · จัดต่อบนกระดานเดิม (แบบที่คนใช้จริงทำ · เซฟแล้วลากต่อ)
     ⚠ ตั้งใจไม่สร้าง _fdPlan ก้อนใหม่ · ถ้ารอบที่เซฟแชร์ array กับกระดาน
     การลากต่อตรงนี้จะไปแก้รอบที่เซฟไว้ด้วย และข้อนี้ต้องจับได้ */
  const b2 = fleet.find(x => x.id !== b1.id && fdPierOf(x, W2.from) !== 'shop');
  if (b2) { _fdSel = b2.id; fdMove(['tublamu','panwa','ranong'].find(p => p !== fdPierOf(b2, W2.from))); }
  const n2 = fdPlanN();
  fdSaveOpen(); set('fd-sv-name', 'รอบทดสอบ 2'); fdSaveDo();
  const savedN2 = fdSaved().length;

  /* เปิดรอบแรกกลับมา · ต้องได้ของเดิมครบ ทั้งใบย้ายและปุ่มไม่นับ */
  const ids = fdSaved().map(x => x.id);
  fdSavedOpen(ids[0]);
  const back = { n: fdPlanN(), pier: fdPierOf(b1, W1.from), run: fdCanRun(b1, W1.from),
                 win: fdWin() };
  /* เปิดมาแล้วแก้ต่ออีกที แล้วเปิดรอบเดิมซ้ำ · รอบที่เซฟต้องไม่โดนแก้ตาม
     ใช้ปุ่มนับในแผน เพราะตัวนี้แก้ของในก้อนเดิมตรง ๆ (_fdPlan.ready[id]=0)
     ถ้าตอนเปิดรอบไปชี้ก้อนเดียวกับที่เซฟไว้ รอบที่เซฟจะโตตามทันที */
  if (b2) fdReadyToggle(b2.id);
  fdSavedOpen(ids[0]);
  const again = fdPlanN();

  /* แถบรอบ · ต้องมีชิปครบและมีแถบเส้นเวลา */
  const w = document.getElementById('fl-deploy-wrap');
  const chips = w.querySelectorAll('.fd-saved .sv-i').length;
  const track = w.querySelectorAll('.fd-saved .sv-track .b').length;
  const holes = w.querySelectorAll('.fd-saved .sv-track .g').length;

  /* คีย์ที่เขียน · ต้องเป็น la_fd_plans ไม่ใช่ blob จริง */
  let raw = null; try { raw = localStorage.getItem('la_fd_plans'); } catch (_) {}
  const realAfter = localStorage.getItem(LS);
  return {
    n1, pier1, run1, savedN1, savedN2, n2, gapless, again,
    w1: { f: W1.from, t: W1.to }, w2: { f: W2.from, t: W2.to },
    back, chips, track, holes,
    wroteOwnKey: !!raw && raw.indexOf('รอบทดสอบ 1') >= 0,
    realUntouched: realBefore === realAfter,
    boatsSame: JSON.stringify(BOATS) === snapB,
    tripsSame: JSON.stringify(TRIPS) === snapT
  };
});
{
  const bad = [];
  if (R3i.savedN1 !== 1) bad.push('เซฟรอบแรกแล้วมี ' + R3i.savedN1 + ' รอบ · ควรเป็น 1');
  if (R3i.savedN2 !== 2) bad.push('เซฟรอบสองแล้วมี ' + R3i.savedN2 + ' รอบ · ควรเป็น 2');
  if (!R3i.gapless) bad.push('รอบถัดไปเริ่ม ' + R3i.w2.f + ' · ควรเริ่มวันถัดจาก ' + R3i.w1.t);
  if (R3i.n2 <= R3i.n1) bad.push('ลากต่อหลังเซฟแล้วกระดานไม่เพิ่มรายการ · ทดสอบไม่ได้');
  if (R3i.back.n !== R3i.n1)
    bad.push('เปิดรอบแรกกลับมาได้ ' + R3i.back.n + ' รายการ · ตอนเซฟมี ' + R3i.n1
           + ' — รอบที่เซฟโดนกระดานแก้ตาม');
  if (R3i.again !== R3i.n1)
    bad.push('เปิดรอบแรกซ้ำอีกครั้งได้ ' + R3i.again + ' รายการ · ควรเป็น ' + R3i.n1
           + ' — เปิดรอบมาแล้วลากต่อ ไปแก้รอบที่เซฟไว้ด้วย');
  if (R3i.back.pier !== R3i.pier1) bad.push('เปิดกลับมาแล้วเรืออยู่ ' + R3i.back.pier + ' · ตอนเซฟอยู่ ' + R3i.pier1);
  if (R3i.back.run !== R3i.run1) bad.push('เปิดกลับมาแล้วปุ่มนับในแผนไม่เหมือนตอนเซฟ');
  if (R3i.back.win.from !== R3i.w1.f || R3i.back.win.to !== R3i.w1.t)
    bad.push('เปิดรอบแล้วช่วงบนกระดานไม่ตรงกับรอบนั้น · ' + R3i.back.win.from + '→' + R3i.back.win.to);
  if (R3i.chips !== 2) bad.push('แถบรอบมีชิป ' + R3i.chips + ' · ควรมี 2');
  if (R3i.track !== 2) bad.push('เส้นเวลามีบล็อก ' + R3i.track + ' · ควรมี 2');
  if (!R3i.wroteOwnKey) bad.push('ไม่ได้เขียนลงคีย์ la_fd_plans');
  if (!R3i.realUntouched) bad.push('เซฟรอบแล้ว blob ข้อมูลจริง (loveandaman_v2) ถูกแตะ');
  if (!R3i.boatsSame || !R3i.tripsSame) bad.push('เซฟ/เปิดรอบแล้ว BOATS หรือ TRIPS จริงเปลี่ยน');
  if (bad.length) fail('SAVE mockup · ' + bad.join(' · '));
  else ok('เซฟ Mockup เป็นรอบได้ · รอบ 1 ' + R3i.w1.f + '→' + R3i.w1.t + ' (' + R3i.n1 + ' รายการ) · '
      + 'กดวางรอบถัดไปได้ช่วง ' + R3i.w2.f + '→' + R3i.w2.t + ' ต่อกันพอดีไม่ทับ · '
      + 'เปิดรอบแรกกลับมาได้ครบ · เขียนลง la_fd_plans อย่างเดียว blob จริงไม่ถูกแตะ'
      + (R3i.holes ? (' · เส้นเวลาชี้ช่องว่าง ' + R3i.holes + ' ช่วง') : ''));
}

/* ══ 3j · กล่องต้องเร่งซ่อมอ่านของจริง ไม่ใช่ตัวเลือกของคนวางแผน ═══════════
   ถ้ากดนับลำที่ยังซ่อมอยู่แล้วลำนั้นหายจากรายการ = แผนสวยขึ้นโดยไม่มีใครไปเร่ง */
const R3j = await page.evaluate(() => {
  _fdPlan = { pier: [], drop: [], trip: {}, avail: {}, boats: [], ready: {} }; fdPlanSave();
  fdSetScope('month'); _fdWinIx = 0; fdSetOwn('all'); flRenderDeployment();
  const d = fdWin().from;
  /* หาลำที่ของจริงยังไม่พร้อม แล้ววางไว้ที่ท่า */
  const sick = (BOATS || []).filter(b => b && !b.retired)
    .find(b => (boatEffStatus(b, d) || {}).s !== 'available');
  if (!sick) return { skip: 'ชุดนี้ไม่มีเรือที่ซ่อมค้าง' };
  if (fdPierOf(sick, d) === 'shop') { _fdSel = sick.id; fdMove('tublamu'); }
  const seats = () => fdBoatsAt(fdPierOf(sick, d), d).filter(x => fdCanRun(x, d))
                        .reduce((s, x) => s + (x.cap || 0), 0);
  const inChase = () => [].slice.call(document.querySelectorAll('#fl-deploy-wrap .fd-chase .ci'))
                          .some(x => x.textContent.indexOf(sick.name) >= 0);
  const countedSeats = seats(), countedChase = inChase();
  fdReadyToggle(sick.id);
  const offSeats = seats(), offChase = inChase();
  return { name: sick.name, cap: sick.cap || 0, countedSeats, countedChase, offSeats, offChase,
           real: (boatEffStatus(sick, d) || {}).s };
});
if (R3j.skip) console.log('  ! ' + R3j.skip + ' · ข้ามข้อ 3j');
else if (!R3j.countedChase)
  fail(R3j.name + ' ซ่อมค้างและวางไว้บนกระดาน แต่ไม่ขึ้นกล่องต้องเร่งซ่อม');
else if (R3j.countedSeats - R3j.offSeats !== R3j.cap)
  fail('กดไม่นับ ' + R3j.name + ' แล้วที่นั่งลด ' + (R3j.countedSeats - R3j.offSeats) + ' · ควรลด ' + R3j.cap);
else if (!R3j.offChase)
  fail(R3j.name + ' หายจากกล่องต้องเร่งซ่อมหลังกดไม่นับ · กล่องนี้ต้องอ่านสถานะจริงเสมอ');
else ok('กล่องต้องเร่งซ่อมอ่านของจริง · ' + R3j.name + ' (' + R3j.real + ') นับอยู่ในที่นั่ง '
      + R3j.cap + ' ที่ และยังขึ้นรายการ · กดไม่นับแล้วที่นั่งหายแต่ยังคาอยู่ในรายการ');

/* ══ 3k · สรุปรอบที่กำลังวาง ═══════════════════════════════════════════
   ที่มา (2026-09-24) · "จับวางแล้ว ตัวไหนเป็นตัวสรุปภาพรวมของรอบ
   และเรือที่ยังไม่ได้เลือกให้วิ่งเส้นทางนั้นจะเป็นแบบไหน"
   ของเดิมมีแต่สรุปทั้งฤดูกับทั้งเดือน · หน่วยที่คนทำงานจริงคือ "รอบ"
   ข้อนี้กันสามอย่าง
     · จำนวนวันที่แต่ละลำวิ่ง ต้องตรงกับที่นับเองจาก TRIPS
     · ลำที่วิ่ง 0 วันต้องอยู่กลุ่ม "ยังไม่ได้ลงเส้นทางเลย"
     · ท่าที่ยังไม่เปิดขายสักวันในช่วงนั้น ต้องแยกออก ไม่ปนกับลำที่ยังไม่ได้ใช้ */
const R3k = await page.evaluate(() => {
  _fdPlan = { pier: [], drop: [], trip: {}, avail: {}, boats: [], ready: {} }; fdPlanSave();
  fdTab('pier'); fdSetOwn('all');
  /* ตั้งช่วงให้คร่อมวันที่ปิดฤดูด้วย · ฤดูเปิดกลางเดือน ครึ่งแรกของเดือนจึงปิด
     ถ้าเลือกช่วงที่เปิดหมดทุกวัน จะแยกไม่ออกว่า "วันที่เปิดขาย" กับ "ทุกวัน" ต่างกันตรงไหน */
  const S = fdSeason();
  const m = S.from.slice(0, 7);
  fdSetScope('custom'); fdSetCustom('from', m + '-01'); fdSetCustom('to', fdMonthEnd(m + '-01'));
  flRenderDeployment();
  const W = fdWin();
  const days = []; let d = W.from;
  while (d <= W.to && days.length < 400) { days.push(d); d = fdAddDays(d, 1); }
  /* วางเรือไว้บน "วันที่ปิดขาย" หนึ่งวัน · เป็นสภาพที่เกิดขึ้นจริงเวลาโปรแกรมถูกปิดทีหลัง
     ตัวนับต้องไม่เอาวันนั้นมารวม · ถ้านับทุกวันแทนวันที่เปิดขาย ข้อนี้จะจับได้ */
  let planted = null;
  FD_PIERS.some(p => {
    const shutDay = days.find(x => !fdOpenRoutes(p, x).length);
    if (!shutDay) return false;
    const anyRoute = (ROUTES || []).find(r => r && (r.pier || '') === p);
    const b = fdBoatsAt(p, W.from)[0];
    if (!anyRoute || !b) return false;
    fdAssign(anyRoute.id, shutDay, b.id);
    planted = { pier: p, d: shutDay, boat: b.name };
    return true;
  });
  flRenderDeployment();
  /* คำนวณเองจาก ROUTES + TRIPS · ไม่เรียกตัวสรุปของหน้ามาเทียบกับตัวเอง */
  const want = {};
  FD_PIERS.forEach(p => {
    const open = days.filter(x => (ROUTES || []).some(r => r && (r.pier || '') === p &&
      (() => { const st = getDayStatus(r, x); return !st || st.type === 'open'; })()));
    const list = fdBoatsAt(p, W.from);
    want[p] = { open: open.length, none: [], part: [], full: [], shut: [] };
    list.forEach(b => {
      const ran = open.filter(x => {
        const t = fdTripsOn(x)[b.id]; if (!t) return false;
        const r = (ROUTES || []).find(y => y && y.id === t.route);
        return !!(r && (r.pier || '') === p);
      }).length;
      if (!open.length) want[p].shut.push(b.name);
      else if (!ran) want[p].none.push(b.name);
      else if (ran >= open.length) want[p].full.push(b.name + '|' + ran);
      else want[p].part.push(b.name + '|' + ran);
    });
  });
  /* อ่านจากหน้าจอ */
  const box = document.querySelector('#fl-deploy-wrap .fd-sum');
  if (!box) return { err: 'ไม่มีกล่องสรุปรอบบนหน้า' };
  const got = {};
  [].slice.call(box.querySelectorAll('.sr')).forEach(sr => {
    const nm = ((sr.querySelector('.rh b') || {}).textContent || '').trim();
    const rec = { none: [], part: [], full: [], shut: [] };
    [].slice.call(sr.querySelectorAll('.sg')).forEach(sg => {
      const k = /none/.test(sg.className) ? 'none' : /part/.test(sg.className) ? 'part'
              : /full/.test(sg.className) ? 'full' : /shut/.test(sg.className) ? 'shut' : '';
      if (!k) return;
      [].slice.call(sg.querySelectorAll('span')).forEach(x => {
        const u = (x.querySelector('u') || {}).textContent || '';
        const name = (x.childNodes[0].textContent || '').trim();
        const m = /(\d+)\/\d+/.exec(u);
        rec[k].push(m ? (name + '|' + m[1]) : name);
      });
    });
    got[nm] = rec;
  });
  const head = ((box.querySelector('.sb') || {}).textContent || '').replace(/\s+/g, ' ');
  const mNone = /ยังไม่ได้ลงเส้นทางเลย\s*(\d+)/.exec(head);
  return { want, got, days: days.length, w: W, planted,
           labels: (typeof PIER_LABELS !== 'undefined') ? PIER_LABELS : {},
           headNone: mNone ? +mNone[1] : null, head: head.slice(0, 160) };
});
if (R3k.err) fail(R3k.err);
else {
  const miss = [];
  let wantHeadNone = 0;
  Object.keys(R3k.want).forEach(p => {
    const w = R3k.want[p], lbl = R3k.labels[p] || p, g = R3k.got[lbl];
    const total = w.none.length + w.part.length + w.full.length + w.shut.length;
    if (!total) return;
    wantHeadNone += w.none.length;
    if (!g) { miss.push(lbl + ' ไม่มีในกล่องสรุป'); return; }
    ['none', 'part', 'full', 'shut'].forEach(k => {
      const a = w[k].slice().sort().join(','), b = (g[k] || []).slice().sort().join(',');
      if (a !== b) miss.push(lbl + ' กลุ่ม ' + k + ' · หน้าจอ [' + b + '] ควรเป็น [' + a + ']');
    });
  });
  if (R3k.headNone !== wantHeadNone)
    miss.push('พาดหัวบอก ' + R3k.headNone + ' ลำที่ยังไม่ได้ลงเส้นทาง · ควรเป็น ' + wantHeadNone
            + ' (ท่าที่ยังไม่เปิดขายต้องไม่ถูกนับรวม)');
  if (miss.length) fail('สรุปรอบ · ' + miss.slice(0, 3).join(' · '));
  else {
    /* ต้องมีอย่างน้อยหนึ่งท่าที่ "เปิดขายบางวัน ไม่ใช่ทุกวัน" และมีเรือวิ่งอยู่
       ไม่งั้นการนับจากวันที่เปิดขายกับนับทุกวันให้ผลเท่ากัน แยกไม่ออกว่าโค้ดทำถูกไหม */
    const probe = Object.keys(R3k.want).filter(p => {
      const w = R3k.want[p];
      return w.open > 0 && w.open < R3k.days && (w.part.length + w.full.length) > 0;
    });
    if (!probe.length)
      fail('ไม่มีท่าไหนที่เปิดขายบางวันและมีเรือวิ่ง · แยกไม่ออกว่านับจากวันที่เปิดขายจริงหรือนับทุกวัน');
    else if (!R3k.planted)
      fail('วางเรือบนวันที่ปิดขายไม่ได้ · ข้อนี้พิสูจน์ไม่ได้ว่านับเฉพาะวันที่เปิดขาย');
    else ok('สรุปรอบตรงกับที่นับเองจาก TRIPS ทุกท่า · ช่วง ' + R3k.w.from + '→' + R3k.w.to
      + ' (' + R3k.days + ' วัน) · ' + probe.map(p => p + ' เปิดขาย ' + R3k.want[p].open + ' วัน').join(' · ')
      + ' · ยังไม่ได้ลงเส้นทาง ' + wantHeadNone + ' ลำ · '
      + 'วาง ' + R3k.planted.boat + ' ไว้บนวันที่ปิดขาย ' + R3k.planted.d + ' แล้วไม่ถูกนับ');
  }
}

/* ══ 3m · Factsheet ของรอบ ═════════════════════════════════════════════
   ที่มา (2026-09-24) · "มันน่าจะต้องเป็นเหมือน Factsheet ที่เห็นว่าวันที่นี้ถึงวันที่นี้
   มีเรืออะไรอยู่ท่าไหนบ้าง มีโปรแกรมอะไรบ้าง เรือแต่ละลำวิ่งโปรแกรมไหน
   ที่นั่งมีเท่าไหร่ / รับได้เท่าไหร่ มีเรื่องอะไรที่ต้องให้ความสนใจ"
   ข้อนี้กันสี่อย่าง
     · ตาราง เรือ → โปรแกรม ตรงกับที่นับเองจาก TRIPS + ROUTES
     · ที่นั่งที่รับได้ตลอดช่วง = ที่นั่ง × วันที่เปิดขายจริง ไม่ใช่คูณวันทั้งหมด
     · ท่าที่ยังไม่เปิดขายต้องไม่ถูกเขียนว่า "ยังไม่ได้ลงโปรแกรม"
     · เรือที่ลงโปรแกรมของท่าหนึ่งทั้งที่แผนวางไว้อีกท่า ต้องขึ้นในรายการที่ต้องสนใจ */
const R3m = await page.evaluate(() => {
  const snapB = JSON.stringify(BOATS), snapT = JSON.stringify(TRIPS);
  _fdPlan = { pier: [], drop: [], trip: {}, avail: {}, boats: [], ready: {} }; fdPlanSave();
  fdTab('pier'); fdSetOwn('all');
  const S = fdSeason(), m = S.from.slice(0, 7);
  fdSetScope('custom'); fdSetCustom('from', m + '-01'); fdSetCustom('to', fdMonthEnd(m + '-01'));
  const W = fdWin();
  const days = []; let d = W.from;
  while (d <= W.to && days.length < 400) { days.push(d); d = fdAddDays(d, 1); }
  /* จับเรือลงโปรแกรมให้มีทั้งลำที่วิ่งครบ วิ่งบางวัน และไม่ได้วิ่งเลย */
  FD_PIERS.forEach(p => {
    const fleet = fdBoatsAt(p, W.from);
    days.forEach((x, i) => {
      const rs = fdOpenRoutes(p, x); if (!rs.length) return;
      if (fleet[0] && rs[0]) fdAssign(rs[0].id, x, fleet[0].id);
      if (fleet[1] && rs[rs.length > 1 ? 1 : 0] && i % 2 === 0) fdAssign(rs[rs.length > 1 ? 1 : 0].id, x, fleet[1].id);
    });
  });
  /* วางเรือไว้บนวันที่ปิดขายด้วย · ที่นั่งของวันนั้นต้องไม่ถูกนับเข้า "รับได้ตลอดช่วง"
     ถ้าไม่วาง วันปิดขายจะว่างเปล่าอยู่แล้ว แยกไม่ออกว่าโค้ดคูณวันเปิดขายหรือคูณทุกวัน */
  let shutPlant = null;
  FD_PIERS.some(p => {
    const sd = days.find(x => !fdOpenRoutes(p, x).length);
    const any = (ROUTES || []).find(r => r && (r.pier || '') === p);
    const b = fdBoatsAt(p, W.from)[0];
    if (!sd || !any || !b) return false;
    fdAssign(any.id, sd, b.id);
    shutPlant = { pier: p, d: sd, boat: b.name, cap: b.cap || 0 };
    return true;
  });
  /* วางเรือจากอู่ลงโปรแกรมของท่าหนึ่ง โดยไม่ย้ายมันเข้าท่า · ของสองตารางจะไม่ตรงกันโดยตั้งใจ */
  let stray = null;
  const shopB = fdBoatsAt('shop', W.from)[0];
  if (shopB) {
    const p = FD_PIERS.find(x => fdOpenRoutes(x, days[days.length - 1]).length);
    if (p) { fdAssign(fdOpenRoutes(p, days[days.length - 1])[0].id, days[days.length - 1], shopB.id);
             stray = { boat: shopB.name, pier: p }; }
  }
  fdTab('sheet'); flRenderDeployment();

  /* ── คำนวณเองจาก TRIPS + ROUTES ── */
  const want = {};
  FD_PIERS.forEach(p => {
    const open = days.filter(x => fdOpenRoutes(p, x).length > 0);
    const list = fdBoatsAt(p, W.from);
    const runs = {};
    list.forEach(b => {
      const by = {};
      open.forEach(x => {
        const t = fdTripsOn(x)[b.id]; if (!t) return;
        const r = (ROUTES || []).find(y => y && y.id === t.route);
        if (!r || (r.pier || '') !== p) return;
        by[r.name] = (by[r.name] || 0) + 1;
      });
      runs[b.name] = by;
    });
    /* ที่นั่ง × วันที่เปิดขาย · นับเองวันต่อวัน */
    let seatDay = 0;
    open.forEach(x => {
      const t = fdTripsOn(x);
      Object.keys(t).forEach(id => {
        const r = (ROUTES || []).find(y => y && y.id === t[id].route);
        if (!r || (r.pier || '') !== p) return;
        const b = fdBoat(id); if (!b || !fdCanRun(b, x)) return;
        seatDay += (b.cap || 0);
      });
    });
    want[p] = { open: open.length, runs, seatDay, n: list.length };
  });

  /* ── อ่านจากแผ่น ── */
  const sheet = document.querySelector('#fl-deploy-wrap .fd-sheet');
  if (!sheet) return { err: 'ไม่มีแผ่น Factsheet บนหน้า' };
  const got = {};
  [].slice.call(sheet.querySelectorAll('.fs-p')).forEach(sec => {
    const nm = ((sec.querySelector('.ph b') || {}).textContent || '').trim();
    const head = ((sec.querySelector('.ph span') || {}).textContent || '').replace(/\s+/g, ' ');
    const mSd = /รับได้รวม\s*([\d,]+)/.exec(head);
    const rows = {}, shutRows = [], idleRows = [];
    const tb = sec.querySelector('.fs-t tbody');
    if (tb) [].slice.call(tb.querySelectorAll('tr')).forEach(tr => {
      const bn = ((tr.querySelector('td b') || {}).textContent || '').trim();
      const by = {};
      [].slice.call(tr.querySelectorAll('.rn')).forEach(x => {
        const u = (x.querySelector('u') || {}).textContent || '0';
        by[(x.childNodes[0].textContent || '').trim()] = +u;
      });
      rows[bn] = by;
      if (/shut/.test(tr.className)) shutRows.push(bn);
      if (/idle/.test(tr.className)) idleRows.push(bn);
    });
    got[nm] = { rows, shutRows, idleRows, seatDay: mSd ? +mSd[1].replace(/,/g, '') : null };
  });
  const att = [].slice.call(sheet.querySelectorAll('.fs-att li')).map(x => (x.textContent || '').trim());
  return { want, got, att, stray, shutPlant, days: days.length,
           labels: (typeof PIER_LABELS !== 'undefined') ? PIER_LABELS : {},
           boatsSame: JSON.stringify(BOATS) === snapB, tripsSame: JSON.stringify(TRIPS) === snapT };
});
if (R3m.err) fail(R3m.err);
else {
  const bad3m = [];
  Object.keys(R3m.want).forEach(p => {
    const w = R3m.want[p], lbl = R3m.labels[p] || p, g = R3m.got[lbl];
    if (!w.n) return;
    if (!g) { bad3m.push(lbl + ' ไม่มีในแผ่น'); return; }
    /* เรือ → โปรแกรม */
    Object.keys(w.runs).forEach(bn => {
      const a = JSON.stringify(w.runs[bn]), b = JSON.stringify(g.rows[bn] || {});
      if (a !== b) bad3m.push(lbl + ' · ' + bn + ' แผ่นบอก ' + b + ' ควรเป็น ' + a);
    });
    /* ที่นั่ง × วัน */
    if (g.seatDay !== w.seatDay)
      bad3m.push(lbl + ' รับได้รวม ' + g.seatDay + ' · นับเองได้ ' + w.seatDay);
    /* ท่าที่ยังไม่เปิดขาย ต้องเป็นแถวเทา ไม่ใช่แถวแดง */
    if (!w.open) {
      if (g.idleRows.length) bad3m.push(lbl + ' ยังไม่เปิดขายสักวัน แต่มีแถวขึ้นแดงว่าไม่ได้ลงโปรแกรม ' + g.idleRows.length);
      if (g.shutRows.length !== w.n) bad3m.push(lbl + ' ยังไม่เปิดขาย แต่ทำเครื่องหมายไว้แค่ ' + g.shutRows.length + ' จาก ' + w.n);
    } else {
      const wantIdle = Object.keys(w.runs).filter(bn => !Object.keys(w.runs[bn]).length).sort().join(',');
      if (g.idleRows.slice().sort().join(',') !== wantIdle)
        bad3m.push(lbl + ' แถวที่ยังไม่ได้ลงโปรแกรม [' + g.idleRows.join(',') + '] ควรเป็น [' + wantIdle + ']');
    }
  });
  if (R3m.stray && !R3m.att.some(t => /วางไว้ท่าอื่น/.test(t) && t.indexOf(R3m.stray.boat) >= 0))
    bad3m.push('เรือ ' + R3m.stray.boat + ' ลงโปรแกรมของท่าอื่นแต่ไม่ขึ้นในรายการที่ต้องสนใจ');
  if (!R3m.shutPlant)
    bad3m.push('วางเรือบนวันที่ปิดขายไม่ได้ · พิสูจน์ไม่ได้ว่า "รับได้ตลอดช่วง" คูณเฉพาะวันที่เปิดขาย');
  if (!R3m.boatsSame || !R3m.tripsSame) bad3m.push('เปิดแผ่นแล้ว BOATS หรือ TRIPS จริงเปลี่ยน');
  if (bad3m.length) fail('Factsheet · ' + bad3m.slice(0, 3).join(' · '));
  else ok('Factsheet ตรงกับที่นับเองจาก TRIPS ทุกท่า · ช่วง ' + R3m.days + ' วัน · '
      + Object.keys(R3m.want).filter(p => R3m.want[p].n)
          .map(p => p + ' ' + R3m.want[p].seatDay.toLocaleString() + ' ที่'). join(' · ')
      + ' · รายการที่ต้องสนใจ ' + R3m.att.length + ' เรื่อง · '
      + 'วาง ' + R3m.shutPlant.boat + ' ไว้บนวันปิดขาย ' + R3m.shutPlant.d + ' แล้วไม่ถูกนับ · '
      + 'ข้อมูลจริงไม่ถูกแตะ');
}

/* ══ 4 · ปฏิทินต้องเคารพฤดูกาลของเส้นทาง ══════════════════════════════════ */
const R4 = await page.evaluate(() => {
  fdTab('month');
  const w = document.getElementById('fl-deploy-wrap');
  const pier = _fdPier, month = _fdMonth;
  const cells = [].slice.call(w.querySelectorAll('.fd-day:not(.pad)'));
  /* คาดหวัง · คำนวณจาก ROUTES + getDayStatus เอง ไม่เรียก fdOpenRoutes ของหน้า */
  const out = { pier, month, wrongClosed: [], wrongOpen: [], n: cells.length };
  cells.forEach((c, i) => {
    const day = month + '-' + String(i + 1).padStart(2, '0');
    const open = (ROUTES || []).filter(r => {
      if ((r.pier || '') !== pier) return false;
      const d = getDayStatus(r, day);
      return !d || d.type === 'open';
    }).length;
    const shown = c.classList.contains('closed');
    if (open > 0 && shown)  out.wrongClosed.push(day);
    if (open === 0 && !shown) out.wrongOpen.push(day);
  });
  return out;
});
if (R4.wrongClosed.length)
  fail('ปฏิทินขึ้น "ปิดฤดู" ทั้งที่มีโปรแกรมเปิดขาย ' + R4.wrongClosed.length + ' วัน · ' + R4.wrongClosed.slice(0, 4).join(' · '));
else if (R4.wrongOpen.length)
  fail('ปฏิทินเปิดให้จัดเรือทั้งที่ยังไม่เปิดฤดู ' + R4.wrongOpen.length + ' วัน · ' + R4.wrongOpen.slice(0, 4).join(' · '));
else ok('ปฏิทิน ' + R4.month + ' ท่า ' + R4.pier + ' · เปิด/ปิดฤดูตรงกับที่ตั้งไว้ในเส้นทางทั้ง ' + R4.n + ' วัน');

/* ══ 4b · บนปฏิทินก็ต้องเลือกเองได้ว่าลำไหนนับเป็นกำลังในแผน ═════════════
   ที่มา (2026-09-24) · "หน้า Monthly Deployment เรือพร้อมหรือไม่พร้อม ควรเลือกได้
   เพราะมันคือ Mockup วางแผน" · กดแล้วตัวเลขทั้งเดือนต้องขยับตาม */
const R4b = await page.evaluate(() => {
  _fdPlan = { pier: [], drop: [], trip: {}, avail: {}, boats: [], ready: {} }; fdPlanSave();
  fdTab('month'); flRenderDeployment();
  const w = document.getElementById('fl-deploy-wrap');
  const chips = [].slice.call(w.querySelectorAll('.fd-tray .fd-tb'));
  const withBtn = chips.filter(c => c.querySelector('.fd-rdy')).length;
  if (!chips.length) return { skip: 'ท่านี้ไม่มีเรือในเดือนนี้' };
  /* เลือกลำที่วิ่งจริงในเดือนนี้ จะได้เห็นตัวเลข Seats this month ขยับ */
  const seatsNow = () => +((document.querySelector('#fl-deploy-wrap .fd-cstats .cs b') || {})
                            .textContent || '0').replace(/,/g, '');
  if (withBtn !== chips.length) return { chips: chips.length, withBtn, noBtn: 1 };
  const pick = chips.find(c => !/วิ่ง 0 วัน/.test(c.textContent)) || chips[0];
  const name = (pick.childNodes[0].textContent || '').trim();
  const b = fdBoatsAt(_fdPier, _fdMonth + '-01' < fdSeason().from ? fdSeason().from : _fdMonth + '-01')
              .find(x => x.name === name);
  const before = seatsNow();
  pick.querySelector('.fd-rdy').click();
  const after = seatsNow();
  const offCls = !![].slice.call(document.querySelectorAll('#fl-deploy-wrap .fd-tray .fd-tb'))
    .find(c => c.textContent.indexOf(name) >= 0 && c.classList.contains('off'));
  /* วันละกี่ครั้งที่ลำนี้วิ่ง · คำนวณเองจาก TRIPS แล้วเทียบผลต่างที่นั่ง */
  let days = 0;
  for (let i = 1; i <= 31; i++) {
    const d = _fdMonth + '-' + String(i).padStart(2, '0');
    if (d.slice(0, 7) !== _fdMonth) continue;
    const t = (TRIPS || {})[d] || {};
    if (!t[b.id]) continue;
    const r = (ROUTES || []).find(x => x.id === t[b.id].route);
    if (r && (r.pier || '') === _fdPier) days++;
  }
  [].slice.call(document.querySelectorAll('#fl-deploy-wrap .fd-tray .fd-tb'))
    .find(c => c.textContent.indexOf(name) >= 0).querySelector('.fd-rdy').click();
  return { chips: chips.length, withBtn, name, cap: b ? (b.cap || 0) : 0, before, after, days,
           offCls, back: seatsNow() };
});
if (R4b.skip) console.log('  ! ' + R4b.skip + ' · ข้ามข้อ 4b');
else if (R4b.withBtn !== R4b.chips)
  fail('ปุ่มเลือกพร้อม/ไม่พร้อมมีแค่ ' + R4b.withBtn + ' จาก ' + R4b.chips + ' ลำบนปฏิทิน');
else if (!R4b.offCls) fail('กดไม่นับ ' + R4b.name + ' แล้วชิปบนปฏิทินไม่เปลี่ยนสภาพ');
else if (R4b.before - R4b.after !== R4b.cap * R4b.days)
  fail('กดไม่นับ ' + R4b.name + ' แล้ว Seats this month ลด ' + (R4b.before - R4b.after)
     + ' · ควรลด ' + (R4b.cap * R4b.days) + ' (' + R4b.cap + ' ที่ × ' + R4b.days + ' วัน)');
else if (R4b.back !== R4b.before) fail('กดกลับแล้วตัวเลขไม่กลับเท่าเดิม');
else ok('บนปฏิทินเลือกพร้อม/ไม่พร้อมได้ครบทั้ง ' + R4b.chips + ' ลำ · กดไม่นับ ' + R4b.name
      + ' แล้ว Seats this month ลด ' + (R4b.cap * R4b.days) + ' ตรงกับที่คำนวณเองจาก TRIPS');

/* ══ 4c · "ไม่นับในแผน" กับ "อยู่นอกช่วงเช่า" ต้องแยกกัน ════════════════
   ที่มา (2026-09-24) · ผู้ใช้ถามว่า "ไม่นับในแผน" แปลว่าอะไร · พอไปดูโค้ดพบว่า
   ป้ายเดียวนี้ครอบสองสาเหตุที่ต้องทำคนละเรื่อง
     คนกดเองว่าไม่เอาลำนี้        → กดกลับได้ตรงนั้น
     วันนั้นเรือไม่ได้อยู่กับเรา  → กดปุ่มไม่ช่วย ต้องไปแก้ช่วงวัน
   ถ้าเขียนเหมือนกัน คนจะกดปุ่มแล้วงงว่าทำไมตัวเลขไม่ขยับ */
const R4c = await page.evaluate(() => {
  _fdPlan = { pier: [], drop: [], trip: {}, avail: {}, boats: [], ready: {} }; fdPlanSave();
  fdTab('month'); flRenderDeployment();
  const month = _fdMonth, pier = _fdPier;
  /* หาวันที่มีเรือวิ่งจริงในเดือนนี้ แล้วเลือกลำหนึ่งมาทดสอบทั้งสองสาเหตุ */
  let hit = null;
  for (let i = 1; i <= 31 && !hit; i++) {
    const d = month + '-' + String(i).padStart(2, '0');
    if (d.slice(0, 7) !== month) continue;
    const t = (TRIPS || {})[d] || {};
    const id = Object.keys(t).find(x => {
      const r = (ROUTES || []).find(y => y && y.id === t[x].route);
      if (!r || (r.pier || '') !== pier) return false;
      const b = (BOATS || []).find(y => y && y.id === x);
      return !!(b && !b.retired && (b.cap || 0) > 0);
    });
    if (id) hit = { d, id, i, boat: (BOATS.find(b => b.id === id) || {}).name };
  }
  if (!hit) return { skip: 'เดือนนี้ไม่มีเรือวิ่งในปฏิทิน' };
  const cell = () => {
    const c = [].slice.call(document.querySelectorAll('#fl-deploy-wrap .fd-day:not(.pad)'))[hit.i - 1];
    const w = c && c.querySelector('.fd-warn');
    return { warn: w ? (w.textContent || '').trim() : '',
             seats: +(((c && c.querySelector('.dh i') || {}).textContent || '').match(/·\s*(\d+)\s*ที่/) || [0, 0])[1] };
  };
  const base = cell();
  /* สาเหตุที่ 1 · กดปุ่มไม่เอาลำนี้ */
  fdReadyToggle(hit.id);
  const off = cell();
  fdReadyToggle(hit.id);
  /* สาเหตุที่ 2 · ตั้งช่วงที่เรืออยู่กับเราให้ไม่คร่อมวันนั้น */
  fdAvailOn(hit.id);
  fdSetAvail(hit.id, 'from', fdAddDays(hit.d, 5));
  fdSetAvail(hit.id, 'to', fdAddDays(hit.d, 9));
  const rent = cell();
  /* แผงรายวันต้องบอกเหตุผลเดียวกัน */
  _fdDay = ''; fdOpenDay(hit.d);
  const chip = [].slice.call(document.querySelectorAll('#fl-deploy-wrap .fd-sb'))
    .find(x => (x.textContent || '').indexOf(hit.boat) >= 0);
  const chipTxt = chip ? (chip.textContent || '').trim() : '';
  const chipBtn = chip ? ((chip.querySelector('.fd-rdy') || {}).className || '') : '';
  /* ทั้งสองอย่างพร้อมกัน · ต้องบอก "นอกช่วงเช่า" เพราะกดปุ่มยังไงก็ไม่ช่วย
     ถ้าบอกว่า "ไม่นับในแผน" คนจะไปกดปุ่มแล้วตัวเลขไม่ขยับ แล้วคิดว่าระบบเสีย */
  fdReadyToggle(hit.id);
  const both = cell();
  fdReadyToggle(hit.id);
  fdAvailOff(hit.id); _fdDay = ''; flRenderDeployment();
  const back = cell();
  return { ...hit, base, off, rent, both, back, chipTxt, chipBtn };
});
if (R4c.skip) console.log('  ! ' + R4c.skip + ' · ข้ามข้อ 4c');
else {
  const b4 = [];
  if (!/ไม่นับในแผน/.test(R4c.off.warn))
    b4.push('กดปุ่มไม่เอาแล้วช่องวันไม่ได้บอกว่า "ไม่นับในแผน" · ได้ "' + R4c.off.warn + '"');
  if (!/นอกช่วงเช่า/.test(R4c.rent.warn))
    b4.push('ตั้งช่วงไม่คร่อมวันนั้นแล้วยังบอกว่า "' + R4c.rent.warn + '" · ควรบอกว่าอยู่นอกช่วงเช่า');
  if (/ไม่นับในแผน/.test(R4c.rent.warn))
    b4.push('นอกช่วงเช่าแต่ไปเขียนว่าไม่นับในแผน · คนจะกดปุ่มแล้วงงว่าทำไมไม่ขยับ');
  if (R4c.off.seats !== R4c.rent.seats)
    b4.push('สองสาเหตุหักที่นั่งไม่เท่ากัน · ' + R4c.off.seats + ' กับ ' + R4c.rent.seats);
  if (R4c.back.warn !== R4c.base.warn || R4c.back.seats !== R4c.base.seats)
    b4.push('เอาช่วงออกแล้วไม่กลับเป็นเหมือนเดิม');
  if (R4c.chipTxt && !/นอกช่วงเช่า/.test(R4c.chipTxt))
    b4.push('แผงรายวันบอกคนละเรื่องกับช่องวัน · "' + R4c.chipTxt + '"');
  if (R4c.chipBtn && !/rent/.test(R4c.chipBtn))
    b4.push('ปุ่มในแผงรายวันยังกดได้ทั้งที่กดแล้วไม่ช่วยอะไร');
  if (!/นอกช่วงเช่า/.test(R4c.both.warn))
    b4.push('เป็นทั้งสองอย่างพร้อมกันแล้วบอกว่า "' + R4c.both.warn
          + '" · ต้องบอกนอกช่วงเช่าก่อน เพราะกดปุ่มไม่ช่วย');
  if (b4.length) fail('แยกสาเหตุที่ไม่ถูกนับ · ' + b4.join(' · '));
  else ok('แยกสาเหตุได้ถูก · ' + R4c.boat + ' ' + R4c.d + ' · กดไม่เอา → "' + R4c.off.warn
      + '" · นอกช่วงเช่า → "' + R4c.rent.warn + '" · หักที่นั่งเท่ากัน ' + (R4c.base.seats - R4c.off.seats)
      + ' ที่ และแผงรายวันบอกตรงกัน · เป็นทั้งสองอย่างพร้อมกันบอก "' + R4c.both.warn + '"');
}

/* ══ 5 · ที่นั่งต่อวันต้องตรงกับที่คำนวณเองจาก TRIPS ══════════════════════
   §flDeployReady · นับทุกลำที่ถูกวางไว้ในวันนั้น เว้นลำที่คนกดไว้ว่าไม่นับในแผน
   (สถานะซ่อมไม่ได้กันอีกแล้ว · หน้านี้คือแผน ไม่ใช่รายงานสถานะวันนี้) */
const R5 = await page.evaluate(() => {
  _fdPlan = { pier: [], drop: [], trip: {}, avail: {}, boats: [], ready: {} }; fdPlanSave();
  flRenderDeployment();
  const w = document.getElementById('fl-deploy-wrap');
  const pier = _fdPier, month = _fdMonth;
  const cells = [].slice.call(w.querySelectorAll('.fd-day:not(.pad)'));
  const wrong = [];
  let checked = 0;
  cells.forEach((c, i) => {
    if (c.classList.contains('closed')) return;
    const day = month + '-' + String(i + 1).padStart(2, '0');
    const t = (TRIPS || {})[day] || {};
    let want = 0;
    Object.keys(t).forEach(id => {
      const r = (ROUTES || []).find(x => x.id === t[id].route);
      if (!r || (r.pier || '') !== pier) return;
      const b = (BOATS || []).find(x => x.id === id);
      if (!b || b.retired) return;
      want += (b.cap || 0);
    });
    const txt = ((c.querySelector('.dh i') || {}).textContent || '');
    const m = /·\s*(\d+)\s*ที่/.exec(txt);
    const got = m ? +m[1] : -1;
    checked++;
    if (got !== want) wrong.push(day + ' หน้าจอ ' + got + ' ควรเป็น ' + want);
  });
  return { wrong, checked };
});
if (!R5.checked) console.log('  ! เดือนนี้ไม่มีวันที่เปิดขายเลย · ข้ามข้อ 5');
else if (R5.wrong.length)
  fail('ที่นั่งต่อวันไม่ตรง ' + R5.wrong.length + ' วัน · ' + R5.wrong.slice(0, 3).join(' · '));
else ok('ที่นั่งต่อวันตรงกับที่คำนวณเองจาก TRIPS ทั้ง ' + R5.checked + ' วันที่เปิดขาย');

/* ══ 6 · ตารางเดินเรือก็เป็นร่าง · ตอนบันทึกต้องผ่านตัวเขียนของ Boat Operation ══
   หน้านี้ไม่เขียน TRIPS เลย · ทุกอย่างเป็นร่างบนกระดานนี้เท่านั้น */
const R6 = await page.evaluate(() => {
  const pier = _fdPier;
  const fleet = (BOATS || []).filter(b => b && !b.retired && fdPierOf(b, _fdFrom) === pier);
  if (!fleet.length) return { skip: 'ท่านี้ไม่มีเรือ' };
  const openOn = d => (ROUTES || []).filter(r => (r.pier || '') === pier &&
    (() => { const s = getDayStatus(r, d); return !s || s.type === 'open'; })());
  const days = [];
  for (let i = 1; i <= 31; i++) days.push(_fdMonth + '-' + String(i).padStart(2, '0'));
  const future = days.find(d => d > TODAY_STR && openOn(d).length && fleet.some(b => !((TRIPS || {})[d] || {})[b.id]));
  if (!future) return { skip: 'ไม่มีวันในอนาคตที่ว่างพอจะทดสอบ' };
  const r = openOn(future)[0];
  const b = fleet.find(x => !((TRIPS || {})[future] || {})[x.id]);

  /* 1 · ใส่เรือ = ร่าง · TRIPS จริงต้องยังไม่ขยับ */
  const snap = JSON.stringify((TRIPS || {})[future] || {});
  fdOpenDay(future);
  fdAssign(r.id, future, b.id);
  const draftOnly = JSON.stringify((TRIPS || {})[future] || {}) === snap;
  const onBoard = !!fdTripsOn(future)[b.id];

  /* 3 · ถอดออกจากร่าง · ต้องหายจากกระดาน แต่ TRIPS จริงต้องเหมือนเดิมทั้งขาหน้าหลัง */
  fdUnassign(future, b.id);
  const offBoard = !fdTripsOn(future)[b.id];
  const tripSame = JSON.stringify((TRIPS || {})[future] || {}) === snap;
  return { future, boat: b.name, route: r.name, draftOnly, onBoard, offBoard, tripSame };
});
if (R6.skip) console.log('  ! ' + R6.skip + ' · ข้ามข้อ 6');
else if (!R6.draftOnly) fail('ใส่เรือในปฏิทินแล้ว TRIPS จริงขยับทันที · ต้องเป็นร่างก่อน');
else if (!R6.onBoard)   fail('ใส่เรือแล้วกระดานไม่เห็นร่างนั้น · ' + R6.boat + ' ' + R6.future);
else if (!R6.offBoard)  fail('ถอดเรือแล้วกระดานยังเห็นอยู่ · ' + R6.boat + ' ' + R6.future);
else if (!R6.tripSame)  fail('ใส่/ถอดเรือในปฏิทินไปแตะ TRIPS จริงเข้าแล้ว');
else ok('ตารางเดินเรือในปฏิทินเป็นร่างล้วน · ' + R6.boat + ' → ' + R6.route + ' ' + R6.future
      + ' · ใส่ก็ร่าง ถอดก็ร่าง · TRIPS จริงไม่ขยับ');
/* ══ 7 · คิวซ่อม · แถบต้องบอกความจริงเรื่องวันเสร็จ ═══════════════════════ */
const R7 = await page.evaluate(() => {
  fdTab('fix');
  const w = document.getElementById('fl-deploy-wrap');
  const from = _fdFrom;
  const open = (FL_MAINT || []).filter(m => m && m.status !== 'done' && m.status !== 'cancelled');
  const wantNoEnd = open.filter(m => !m.endDate).length;
  const wantLate  = open.filter(m => m.endDate && m.endDate > from).length;
  return {
    rows: w.querySelectorAll('.fd-rw .rr').length,
    open: open.length, wantNoEnd, wantLate,
    gotOpen: w.querySelectorAll('.fd-rw .jb.open').length,
    gotLate: w.querySelectorAll('.fd-rw .jb.late').length,
    gotDated: w.querySelectorAll('.fd-rw .jb.dated').length,
    foot: (w.querySelector('.fd-rw .rwf') || {}).textContent || ''
  };
});
{
  /* แถบแสดงลำละไม่เกิน 3 งาน · จึงเทียบแบบ "ต้องไม่เกินของจริง และต้องไม่เป็นศูนย์ถ้าของจริงมี" */
  const bad7 = [];
  if (R7.wantNoEnd && !R7.gotOpen) bad7.push('มีงานไม่มีวันเสร็จ ' + R7.wantNoEnd + ' งาน แต่ไม่มีแถบลายทางสักอัน');
  if (R7.gotOpen > R7.wantNoEnd)   bad7.push('แถบลายทาง ' + R7.gotOpen + ' อัน มากกว่างานที่ไม่มีวันเสร็จจริง ' + R7.wantNoEnd);
  if (R7.wantLate && !R7.gotLate)  bad7.push('มีงานที่เสร็จหลังวันเปิดฤดู ' + R7.wantLate + ' งาน แต่ไม่ขึ้นสีเตือน');
  if (!/\d+\s*งานไม่มีวันเสร็จ/.test(R7.foot)) bad7.push('ท้ายตารางไม่ได้สรุปจำนวนงานที่ไม่มีวันเสร็จ');
  if (bad7.length) fail('คิวซ่อม · ' + bad7.join(' · '));
  else ok('คิวซ่อม ' + R7.rows + ' ลำ · งานค้าง ' + R7.open + ' งาน · ไม่มีวันเสร็จ ' + R7.wantNoEnd
        + ' (แถบลายทาง ' + R7.gotOpen + ') · เลยวันเปิดฤดู ' + R7.wantLate + ' (แถบเตือน ' + R7.gotLate + ')');
}

/* ══ 8 · ต้องอยู่ในทะเบียนสิทธิ์ ══════════════════════════════════════════
   laAllowed() ปล่อยผ่านเมนูที่ไม่รู้จัก · ลืมใส่ = หน้านี้เปิดให้ทุกคนเงียบ ๆ */
const R8 = await page.evaluate(async () => {
  /* ชุดทดสอบไม่มี /api/me ชั้น sync จึงถอยก่อนจะประกาศ laAllowed
     จึงตรวจที่ทะเบียนสิทธิ์โดยตรง · สองที่ ขาดที่ไหนก็เปิดให้ทุกคนเงียบ ๆ */
  let txt = '';
  try { txt = await (await fetch('js/01-auth-sync.js')).text(); } catch (e) { return { err: String(e) }; }
  return {
    err: '',
    inArea: /'fl-deployment'\s*:\s*'fleet'/.test(txt),
    inNav:  /\{\s*v\s*:\s*'fl-deployment'[^}]*a\s*:\s*'fleet'\s*\}/.test(txt),
    live:   (typeof laAllowed === 'function')
  };
});
if (R8.err) fail('อ่านทะเบียนสิทธิ์ไม่ได้ · ' + R8.err);
else if (!R8.inArea) fail('fl-deployment ไม่อยู่ใน LA_VIEW_AREA · หน้านี้จะไม่ถูกจัดเข้าพื้นที่ fleet');
else if (!R8.inNav)  fail('fl-deployment ไม่อยู่ใน LA_NAV · laAllowed() ปล่อยผ่านเมนูที่ไม่รู้จัก = เปิดให้ทุกคน');
else ok('อยู่ในทะเบียนสิทธิ์ครบทั้งสองที่ (LA_VIEW_AREA + LA_NAV) · พื้นที่ fleet');

/* ══ 9 · ไม่มี error บนหน้า ═══════════════════════════════════════════════ */
if (errors.length) fail('มี error ' + errors.length + ' ครั้ง · ' + errors.slice(0, 2).join(' | '));
else ok('ไม่มี error บนหน้าระหว่างทดสอบ');

console.log('\nพัง ' + bad);
await close();
process.exit(bad ? 1 : 0);
