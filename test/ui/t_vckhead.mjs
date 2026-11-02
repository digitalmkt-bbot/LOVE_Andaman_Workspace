// §vckHead · หัวเช็คอินรถโครงเดียวกับหน้าท่า · แถบวัน · การ์ดโปรแกรม (กาง variant · กรอง) · ชิปรถ · ค้นหา · ตัวกรอง
// blob: python3 test/ui/_mk_subset_vck.py → LAD=allotment_v2/data_exports/subset_vck.json (subset_ct + รถ 12 คัน + จัดรถวันที่ 15 ต.ค.)
import { open, goView } from './_harness.mjs';
let bad = 0; const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1700, height: 760 });
page.on('dialog', d => d.accept());
await goView(page, 'vancheckin', 1200);
const r = await page.evaluate(async () => { const z = ms => new Promise(f => setTimeout(f, ms));
  window._vanCkDate = '2026-10-15'; _vckFam = null; _vckRoute = null; renderVanCheckin(); await z(500);
  const H = () => document.getElementById('vancheckin-host'), q = s => H().querySelectorAll(s).length, t = s => (H().querySelector(s) || {}).textContent || '';
  const o = {};
  o.day = t('.vkh-day').replace(/\s+/g, ' ');
  o.cards = [...H().querySelectorAll('.vkh-card')].map(c => c.dataset.blk);
  o.progs = q('.pgf'); o.vars0 = q('.pgv'); o.chips = q('.vkh-vc'); o.search = !!H().querySelector('.vkh-fwrap #vck-q'); o.legendBtn = !!H().querySelector('.vkh-fwrap .vck-lgt');
  o.kpi = t('.vkh-fwrap').replace(/\s+/g, ' ');
  o.oldBar = q('.ck-unitbar') + q('.ck-hd'); o.piers = q('.pgf-pier'); o.pierTxt = [...H().querySelectorAll('.pgf-pier')].map(x => x.textContent).join(' · '); o.progNames = [...H().querySelectorAll('.pgf-nm')].map(x => x.textContent).join(', '); o.vrows = q('.vkh-vrow'); o.teams1 = [...H().querySelector('.vkh-vrow').querySelectorAll('.vkh-team')].map(t => t.title.split(' · ')[0]); o.timeAm = [...H().querySelectorAll('.vkh-vc .t')].filter(x => /a\.m|p\.m/.test(x.textContent)).length;
  // กาง variant โดยไม่กรอง
  H().querySelector('.pgf-cv').click(); await z(400); o.varsOpen = q('.pgv'); o.filtered = !!H().querySelector('.vkh-allbtn');
  // กรองโปรแกรม → ชิปรถเหลือเฉพาะคันของโปรแกรมนั้น · ชื่อกลางหัวเปลี่ยน
  H().querySelector('.pgf-h').click(); await z(500); o.brandFam = t('.vkh-brand'); o.chipsFam = q('.vkh-vc'); o.allbtn = !!H().querySelector('.vkh-allbtn'); o.groupsFam = q('tr.ck-ghd');
  // กรอง variant
  H().querySelector('.pgv').click(); await z(500); o.brandVar = t('.vkh-brand'); o.chipsVar = q('.vkh-vc');
  // ล้าง
  H().querySelector('.vkh-allbtn').click(); await z(500); o.chipsAll = q('.vkh-vc'); o.brandAll = t('.vkh-brand');
  // ชิปรถ → เด้งไปคันนั้น
  // §vckPier · ชิปกรองท่า · เลือกพันวา → เหลือโปรแกรมฝั่งพันวา · ชิปรถ/กลุ่มในตารางเหลือเฉพาะท่านั้น · หัวกลางเป็นชื่อท่า
  o.pierBtns = [...H().querySelectorAll('.vkh-pb')].map(x => x.textContent); const pb = [...H().querySelectorAll('.vkh-pb')].find(x => /พันวา/.test(x.textContent)); pb.click(); await z(500);
  o.pierProgs = [...H().querySelectorAll('.pgf-nm')].map(x => x.textContent); o.pierChips = q('.vkh-vc'); o.pierGroups = q('tr.ck-ghd'); o.pierBrand = t('.vkh-brand'); o.pierOn = (H().querySelector('.vkh-pb.on') || {}).textContent;
  H().querySelector('.vkh-pb').click(); await z(400); o.pierBack = q('.vkh-vc');
  // §ckJumpBox · กดชิปคันท้าย ๆ → กล่องตาราง (.vck-tw) ต้องเลื่อนไปหาหัวคันนั้น และหัวคันต้องโผล่ใต้ thead ไม่โดนบัง
  const chips = [...H().querySelectorAll('.vkh-vc')]; const c = chips[chips.length - 1]; const nm = c.querySelector('.n').textContent;
  const tw = H().querySelector('.vck-tw'); const sc0 = tw.scrollTop; c.click(); await z(900);
  const gid = c.getAttribute('onclick').match(/ckJump\('([^']+)'\)/)[1]; const g = document.getElementById(gid);
  const twR = tw.getBoundingClientRect(), gR = g.getBoundingClientRect(), thH = tw.querySelector('thead').getBoundingClientRect().height;
  o.chipName = nm; o.groupHas = !!g; o.jump = { moved: tw.scrollTop > sc0 + 50, visible: gR.top >= twR.top + thH - 2 && gR.bottom <= twR.bottom + 2, pageY: window.pageYOffset };
  // §vckStick · หัวตรึง · เลื่อนหน้าเว็บแล้วหัวยังอยู่บนสุด
  o.sticky = getComputedStyle(H().querySelector('.vkh')).position; o.pageOver = document.documentElement.scrollHeight - document.documentElement.clientHeight;
  // ค้นหา
  vckSetQ('RAKOWSKI'); await z(400); o.qRows = q('tr.ck-unassigned, tr.ck-row, tbody tr[data-bk]'); o.qText = H().querySelector('.vck-tw').textContent.includes('RAKOWSKI'); vckSetQ(''); await z(300);
  return o;
});
const J = JSON.stringify(r);
if (/15\s*Thursday\s*OCTOBER 2026/.test(r.day) && /LOVE ANDAMAN/.test(r.day) && /รถ 49 คัน · จอง 304 pax/.test(r.day) && /รวม 304 pax/.test(r.day)) ok('แถบวัน · เลขวันใหญ่ · แบรนด์ · KPI รถ/จอง/รวม'); else fail('day ' + r.day);
if (JSON.stringify(r.cards) === '["prog","vans","filters"]') ok('การ์ด 3 ใบ · โปรแกรมวันนี้ / รถ / ค้นหา+ตัวกรอง'); else fail('cards ' + J);
if (r.piers >= 4 && /ทับละมุ \d+/.test(r.pierTxt) && /พันวา \d+/.test(r.pierTxt)) ok('ชิปท่าเรือบนแถวโปรแกรม · ' + r.pierTxt.slice(0, 60)); else fail('piers ' + J);
if (!/Activities/.test(r.progNames) && !/Transfer/.test(r.progNames)) ok('โปรแกรมภาคพื้นที่ไม่มีรถรับ (Activities) ไม่ขึ้น · ' + r.progNames); else fail('land ' + r.progNames);
if (r.timeAm === 0) ok('ชิปรถไม่มีเวลา (ชื่อ · n/n)'); else fail('time ' + r.timeAm);
if (r.vrows === 7 && r.teams1[0] === 'รถบริษัท' && r.teams1.length === 4 && r.teams1.slice(1).join() === r.teams1.slice(1).sort((a, b) => a.localeCompare(b, 'th')).join()) ok('แถวละโปรแกรม 7 แถว · แถวแรก 4 ทีม · รถบริษัทก่อน แล้วรถร่วมเรียงชื่อ: ' + r.teams1.join(' / ')); else fail('rows ' + JSON.stringify({ vrows: r.vrows, teams1: r.teams1 }));
if (r.progs === 4 && r.vars0 === 0 && r.varsOpen === 4 && !r.filtered) ok('โปรแกรม 4 แถว · กาง variant ได้ 4 โดยยังไม่กรอง'); else fail('prog ' + J);
if (r.chips === 49 && r.oldBar === 0 && r.search && r.legendBtn) ok('ชิปรถ 49 คัน · ไม่มีแถบ/หัวแบบเดิม · ช่องค้นหา · ปุ่มแถบสี'); else fail('chips ' + J);
if (/ขึ้นรถแล้ว \d+\/\d+/.test(r.kpi) && /รอ \d+/.test(r.kpi)) ok('ตัวกรอง · ชิปสถานะ ' + r.kpi.slice(0, 40)); else fail('kpi ' + r.kpi);
if (r.brandFam === 'Similan Islands' && r.chipsFam === 33 && r.allbtn && r.groupsFam === 33) ok('กรองโปรแกรม · หัวเป็นชื่อโปรแกรม · ชิปรถ 33 = กลุ่มในตาราง 33 · ปุ่ม ✕ ทุกโปรแกรม'); else fail('fam ' + J);
if (/Similan Islands · /.test(r.brandVar) && r.chipsVar < r.chipsFam) ok('กรอง variant · หัว "' + r.brandVar + '" · ชิปรถ ' + r.chipsVar); else fail('var ' + J);
if (r.chipsAll === 49 && r.brandAll === 'LOVE ANDAMAN') ok('ล้างตัวกรอง · กลับครบ 49 คัน'); else fail('all ' + J);
if (r.pierBtns.length === 3 && /^ทุกท่า/.test(r.pierBtns[0]) && r.pierProgs.join() === 'Phi Phi Bamboo,Whale Shark Phi Phi Maiton' && r.pierChips > 0 && r.pierChips === r.pierGroups && r.pierChips < 49 && /พันวา/.test(r.pierOn) && r.pierBrand === 'ท่าพันวา' && r.pierBack === 49) ok('ชิปกรองท่า ' + r.pierBtns.join(' | ') + ' · เลือกพันวา → โปรแกรม 2 · รถ ' + r.pierChips + ' = กลุ่มตาราง · หัว "ท่าพันวา" · กลับทุกท่า 49'); else fail('pier ' + JSON.stringify({ b: r.pierBtns, p: r.pierProgs, c: r.pierChips, g: r.pierGroups, br: r.pierBrand, on: r.pierOn, back: r.pierBack }));
if (r.groupHas && r.jump.moved && r.jump.visible) ok('กดชิป "' + r.chipName + '" → กล่องตารางเลื่อนไปหัวคันนั้น · โผล่ใต้ thead'); else fail('jump ' + JSON.stringify(r.jump));
if (r.sticky === 'sticky' && r.pageOver <= 0) ok('หัวตรึง (sticky) · หน้าเว็บไม่มีแถบเลื่อนซ้อน (overflow ' + r.pageOver + ')'); else fail('sticky ' + r.sticky + ' over ' + r.pageOver);
if (r.qText) ok('ค้นหาชื่อแล้วเจอในตาราง'); else fail('search ' + J);
const errs = errors.filter(e => !/404|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED/.test(e));
if (errs.length) { fail('page errors'); console.log('    errors:', errs.slice(0, 3)); }
console.log(bad ? `FAIL ${bad}` : 'PASS'); await close(); process.exit(bad ? 1 : 0);
