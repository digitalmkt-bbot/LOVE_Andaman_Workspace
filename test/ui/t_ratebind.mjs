// §rateBind · การผูก Agent→Rate Type ถูกเก็บสองที่ · ห้ามเพี้ยนกัน และห้ามย้อนเงียบ ๆ
//
// ที่มา (2026-09-18) · การผูกเก็บที่ sb_agents[].rateTypeId และ sidecar sb_agents_rate_bindings
//   ตอนโหลด _rtRestore เอา sidecar เขียนทับเสมอ
//   แต่ตัวเขียนมีสองตัวและเขียนคนละที่ · rtPersist เขียนแต่ sidecar · sbAgentsPersist เขียนแต่ sb_agents
//   ผล = แก้ Rate Type จากหน้า Agents แล้วกดเซฟ พอโหลดใหม่ sidecar ทับกลับเป็นค่าเก่า เงียบ ๆ
//   ตอนพบ เพี้ยนกันอยู่ 32 เอเย่นต์ · เทสนี้กันไม่ให้กลับมา
//
// ⚠ ข้อที่ห้ามพลาดที่สุด · การแก้นี้ต้องไม่ทำให้ราคาของเอเย่นต์คนไหนขยับเลยสักคน
//   เอเย่นต์ที่เพี้ยนอยู่แล้วต้องคงใช้เรทเดิมที่ระบบใช้อยู่ (ฝั่ง sidecar) ต่อไป
import { open } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };
const warn = m => console.log('  ! ' + m);

const boot = async p => {
  // SB_AGENTS ประกาศด้วย let ที่ top level จึงไม่ได้อยู่บน window · ต้องอ้างชื่อตรง ๆ
  await p.waitForFunction(() => typeof window.nav === 'function'
                             && typeof SB_AGENTS !== 'undefined' && SB_AGENTS.length,
                          null, { timeout: 20000 });
  await p.waitForTimeout(500);
};

const { page, errors, close } = await open({ blob: process.env.LAD });

/* ── สภาพตั้งต้น ─────────────────────────────────────────────────────────── */
const S0 = await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('loveandaman_v2') || '{}');
  const F = {}; (raw.sb_agents || []).forEach(a => F[a.id] = a.rateTypeId || '');
  const S = {}; (raw.sb_agents_rate_bindings || []).forEach(b => S[b.id] = b.rateTypeId || '');
  const drift = Object.keys(S).filter(id => F[id] !== undefined && F[id] !== S[id]);
  const eff = {}; drift.forEach(id => { const a = SB_AGENTS.filter(x => x.id === id)[0]; eff[id] = a ? a.rateTypeId : '?'; });
  return { hasSidecar: Array.isArray(raw.sb_agents_rate_bindings), drift, eff,
           ready: (typeof _LA_RATE_BIND_READY !== 'undefined') ? _LA_RATE_BIND_READY : null,
           agents: SB_AGENTS.length };
});

console.log('Rate binding · ' + S0.agents + ' เอเย่นต์');

if (!S0.hasSidecar){ warn('subset ไม่มี sb_agents_rate_bindings · เทสนี้ตรวจอะไรไม่ได้'); }
else ok('subset มี sidecar · เพี้ยนกันอยู่ ' + S0.drift.length + ' เอเย่นต์');

if (S0.ready === null) fail('ไม่มีธง _LA_RATE_BIND_READY · กันลำดับการโหลดหายไป');
else if (S0.ready !== true) fail('โหลดเสร็จแล้วแต่ _LA_RATE_BIND_READY ยังเป็น false · sidecar จะไม่ถูกเขียนเลย');
else ok('ธงกันลำดับเปิดหลัง _rtRestore เท่านั้น');

/* ── 1 · แก้จากหน้า Agents แล้วต้องไม่ถูกย้อน ──────────────────────────── */
const pick = await page.evaluate(() => {
  // เอเย่นต์ที่มีรายการใน sidecar อยู่แล้ว (เคสที่เคยพัง) + เรทเป้าหมายคนละตัวกับของเดิม
  const raw = JSON.parse(localStorage.getItem('loveandaman_v2') || '{}');
  const S = new Set((raw.sb_agents_rate_bindings || []).map(b => b.id));
  const a = SB_AGENTS.filter(x => S.has(x.id) && x.rateTypeId)[0];
  if (!a) return null;
  const tgt = SB_RATE_TYPES.filter(r => r.id !== a.rateTypeId && r.active !== false)[0];
  if (!tgt) return null;
  const was = a.rateTypeId;
  a.rateTypeId = tgt.id;
  sbAgentsPersist();                        // ทางเซฟของหน้า Agents
  return { id:a.id, code:a.code, was, want:tgt.id, wantName:tgt.name };
});
if (!pick) warn('หาเอเย่นต์สำหรับทดสอบไม่ได้ · ข้ามข้อนี้');
else {
  await page.reload({ waitUntil:'load' }); await boot(page);
  const got = await page.evaluate(id => (SB_AGENTS.filter(x => x.id === id)[0] || {}).rateTypeId || '', pick.id);
  if (got !== pick.want)
    fail('แก้เรทจากหน้า Agents แล้วโดนย้อน · ' + pick.code + ' ตั้งเป็น '
       + pick.wantName + ' แต่หลังโหลดใหม่กลายเป็น ' + got);
  else ok('แก้เรทจากหน้า Agents แล้วอยู่ครบหลังโหลดใหม่ · ' + pick.code);
}

/* ── 2 · แก้จากหน้า Rate Types แล้วต้องลง sb_agents ด้วย ───────────────── */
const pick2 = await page.evaluate(() => {
  const a = SB_AGENTS.filter(x => x.rateTypeId)[1] || SB_AGENTS.filter(x => x.rateTypeId)[0];
  if (!a) return null;
  const tgt = SB_RATE_TYPES.filter(r => r.id !== a.rateTypeId && r.active !== false)[1];
  if (!tgt) return null;
  a.rateTypeId = tgt.id;
  rtPersist();                              // ทางเซฟของหน้า Rate Types
  const raw = JSON.parse(localStorage.getItem('loveandaman_v2') || '{}');
  const inAgents = ((raw.sb_agents || []).filter(x => x.id === a.id)[0] || {}).rateTypeId || '';
  const inSide   = ((raw.sb_agents_rate_bindings || []).filter(b => b.id === a.id)[0] || {}).rateTypeId || '';
  return { id:a.id, code:a.code, want:tgt.id, inAgents, inSide };
});
if (!pick2) warn('หาเอเย่นต์สำหรับข้อสองไม่ได้');
else if (pick2.inAgents !== pick2.want || pick2.inSide !== pick2.want)
  fail('rtPersist เขียนไม่ครบสองที่ · sb_agents=' + pick2.inAgents + ' sidecar=' + pick2.inSide
     + ' · ควรเป็น ' + pick2.want + ' ทั้งคู่');
else ok('แก้จากหน้า Rate Types ลงทั้ง sb_agents และ sidecar · ' + pick2.code);

/* ── 3 · ของเดิมห้ามขยับ · ข้อที่สำคัญที่สุด ──────────────────────────── */
if (!S0.drift.length) warn('subset นี้ไม่มีเอเย่นต์ที่เพี้ยนกัน · ข้ามข้อคุ้มกันราคาขยับ');
else {
  const moved = await page.evaluate(([ids, eff]) => {
    // ตัดสองตัวที่เทสข้างบนเพิ่งแก้ออก · ที่เหลือคือของเดิมล้วน ๆ
    return ids.filter(id => {
      const a = SB_AGENTS.filter(x => x.id === id)[0];
      return a && eff[id] && a.rateTypeId !== eff[id];
    });
  }, [S0.drift.filter(id => id !== (pick && pick.id) && id !== (pick2 && pick2.id)), S0.eff]);
  if (moved.length)
    fail('เอเย่นต์ที่เพี้ยนกันอยู่เดิม ราคาขยับไป ' + moved.length
       + ' เจ้า · การแก้นี้ห้ามทำให้ราคาของใครขยับ');
  else ok('เอเย่นต์ที่เพี้ยนกันอยู่เดิม ' + S0.drift.length + ' เจ้า · ยังใช้เรทเดิมทุกเจ้า ไม่มีราคาขยับ');
}

/* ── 3b · สัญญาของธงกันลำดับ ──────────────────────────
   บล็อก seed ที่เรียก sbAgentsPersist() ก่อน _rtRestore ยังไม่มีในข้อมูลชุดนี้
   แต่มีอยู่ในโค้ด และวันหนึ่งอาจทำงาน · จึงทดสัญญาของธงตรง ๆ แทน
   ธงปิด = ห้ามแตะ sidecar · ถ้าแตะ ค่าเก่าใน sb_agents จะกลืน sidecar ที่ใหม่กว่า
   → ราคาของเอเย่นต์กระโดดกลับไปฤดูก่อนโดยไม่มีใครสั่ง */
const guard = await page.evaluate(() => {
  const K = 'loveandaman_v2';
  const before = JSON.stringify((JSON.parse(localStorage.getItem(K) || '{}')).sb_agents_rate_bindings || null);
  const wasReady = _LA_RATE_BIND_READY;
  _LA_RATE_BIND_READY = false;                 // จำลองจังหวะก่อน restore
  const a = SB_AGENTS.filter(x => x.rateTypeId)[0];
  const keep = a.rateTypeId;
  a.rateTypeId = 'rt_bogus_should_not_reach_sidecar';
  sbAgentsPersist();
  const after = JSON.stringify((JSON.parse(localStorage.getItem(K) || '{}')).sb_agents_rate_bindings || null);
  a.rateTypeId = keep; _LA_RATE_BIND_READY = wasReady; sbAgentsPersist();   // คืนสภาพ
  return { untouched: before === after };
});
if (!guard.untouched)
  fail('ธงไม่ทำงาน · เซฟก่อน _rtRestore แล้ว sidecar ถูกทับ — ค่าเก่าจะกลืนการผูกที่ใช้จริง');
else ok('เซฟก่อน _rtRestore · sidecar ไม่ถูกแตะ ค่าที่ระบบใช้จริงปลอดภัย');

/* ── 4 · หลังเซฟ สองที่ต้องตรงกันเสมอ ─────────────────────────────────── */
const agree = await page.evaluate(() => {
  sbAgentsPersist();
  const raw = JSON.parse(localStorage.getItem('loveandaman_v2') || '{}');
  const F = {}; (raw.sb_agents || []).forEach(a => F[a.id] = a.rateTypeId || '');
  const S = {}; (raw.sb_agents_rate_bindings || []).forEach(b => S[b.id] = b.rateTypeId || '');
  return Object.keys(S).filter(id => F[id] !== undefined && F[id] !== S[id]).length;
});
if (agree) fail('หลังเซฟ สองที่ยังต่างกันอยู่ ' + agree + ' เอเย่นต์');
else ok('หลังเซฟ sb_agents กับ sidecar ตรงกันทุกเอเย่นต์');

/* เทสนี้ reload หน้าเองสองรอบ · ฮาร์เนสล้าง error ให้ครั้งเดียวตอนบูตแรก
   รอบ reload จึงเก็บ error ของ "โหลดไฟล์ไม่ได้" ติดมาด้วย (ฟอนต์/CDN ที่เน็ตในแซนด์บ็อกซ์บล็อก)
   พวกนั้นไม่ใช่เรื่องของโค้ด · กรองออกตามชนิด ไม่ใช่กรองทิ้งทั้งหมด
   error จริงของหน้า (pageerror / โค้ดโยน) ยังนับเต็มเหมือนเดิม */
const NOISE = /Failed to load resource|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|net::ERR_/;
const real = errors.filter(x => !NOISE.test(x));
const skipped = errors.length - real.length;
if (skipped) console.log('  · ข้าม ' + skipped + ' error ของการโหลดไฟล์จากเน็ต (ตอน reload)');
if (real.length) { bad += real.length; real.forEach(x => console.log('  ✗ ' + x)); }
console.log('พัง ' + bad);
await close();
process.exit(bad ? 1 : 0);
