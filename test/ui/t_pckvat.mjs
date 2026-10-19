// §pckVat · popup เก็บเงินหน้าท่า บอกว่า Agent ของใบนี้ VAT หรือ No VAT
import { open } from './_harness.mjs';
let bad = 0; const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1400, height: 1000 });
const r = await page.evaluate(async () => {
  const z = ms => new Promise(f => setTimeout(f, ms));
  const el = document.querySelector('.nav-item[data-view="piercheckin"]'); if (el) { nav(el); await z(400); }
  const bks = (SB_BOOKINGS || []).filter(b => b.agentId && (b.trips || []).length);
  const dueBk = bks.find(b => { try { return pckMoney(b, b.trips[0].date).due > 0; } catch (_) { return false; } });
  if (dueBk) bks.sort((x, y) => (x === dueBk ? -1 : y === dueBk ? 1 : 0));
  const ag = [...new Set(bks.map(b => b.agentId))].map(id => sbGetAgent(id)).filter(a => a && a.id !== 'a_b2c' && a.id !== 'a_company');
  if (ag.length < 3) return { few: ag.length };
  if (dueBk) { const i = ag.findIndex(a => a.id === dueBk.agentId); if (i > 0) { const t = ag[i]; ag[i] = ag[1]; ag[1] = t; } else if (i === 0) { const t = ag[0]; ag[0] = ag[1]; ag[1] = t; } }
  ag[0].vatMode = 'include'; ag[1].vatMode = 'exclude'; ag[2].vatMode = 'none'; if (ag[3]) delete ag[3].vatMode;
  const out = {};
  for (const [k, a] of [['inc', ag[0]], ['none', ag[2]], ['gap', ag[3]], ['exc', ag[1]]]) {
    if (!a) continue; const b = (k === 'exc' && dueBk && dueBk.agentId === a.id) ? dueBk : bks.find(x => x.agentId === a.id);
    _pckDate = b.trips[0].date; pckPayOpen(b.id); await z(150);
    const v = document.querySelector('#acct-modal .pckp-vat');
    out[k] = v ? { txt: v.textContent, cls: v.querySelector('.tg').className, nm: a.name || a.code } : null;
    if (k === 'exc') { window.__shot = 1; break; }
    acctModalClose();
  }
  const wb = (SB_BOOKINGS || []).find(b => !b.agentId);
  return out;
});
await page.screenshot({ path: '/mnt/user-data/outputs/pckvat.png' });
const R = JSON.stringify(r);
if (r.inc && /VAT/.test(r.inc.txt) && /รวม VAT/.test(r.inc.txt) && /\bvat\b/.test(r.inc.cls) && r.inc.txt.includes(r.inc.nm)) ok('include · ชื่อ Agent + VAT · ราคารวม VAT แล้ว'); else fail('inc ' + R);
if (r.exc && /Net \+ VAT/.test(r.exc.txt) && /\bvat\b/.test(r.exc.cls)) ok('exclude · VAT · ราคา Net + 7%'); else fail('exc ' + R);
if (r.none && /No VAT/.test(r.none.txt) && /\bnov\b/.test(r.none.cls)) ok('none · No VAT'); else fail('none ' + R);
if (r.gap && /No VAT/.test(r.gap.txt) && /ยังไม่ได้ตั้ง/.test(r.gap.txt) && /\bgap\b/.test(r.gap.cls)) ok('ยังไม่ได้ตั้ง · No VAT สีส้ม + บอกให้ไปตั้งที่หน้า Agent'); else fail('gap ' + R);
if (bad === 0 && errors.length) console.log('    errors:', errors.slice(0, 3));
console.log(bad ? `FAIL ${bad}` : 'PASS'); await close(); process.exit(bad ? 1 : 0);
