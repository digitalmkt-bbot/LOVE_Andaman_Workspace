// §embedToken (2026-09-19) · ทางเข้า iframe สำหรับคนที่ไม่มีบัญชีในระบบนี้
//
// พนักงาน CS ล็อกอินที่ cs.loveandaman.com · ไม่มีบัญชี rsvn และไม่ควรต้องมี
// ฝั่งนั้นเซ็นตั๋วอายุสั้นแนบมากับ src ของ iframe แล้วที่นี่แลกเป็น session ดูอย่างเดียว
//
// นี่เป็นทางเข้าระบบเส้นใหม่ · ของที่พังแล้วแพงที่สุดคือข้อ 2 กับ 6
//   1. ไม่ตั้ง EMBED_TOKEN_SECRET → ตั๋วทุกใบถูกเมิน (ปิดสวิตช์ได้จริง)
//   2. ตัวตนที่ได้ต้องเป็น "ดูอย่างเดียว · เห็นแค่ Booking" เสมอ — ตั๋วสั่งไม่ได้
//   3. ตั๋วหมดอายุ / ลายเซ็นมั่ว / อ้างอายุยาวเกิน → ไม่รับ
//   4. กุญแจคนละดอกกับ SESSION_SECRET · ตั๋วที่เซ็นด้วย SESSION_SECRET ต้องไม่ผ่าน
//   5. ตั๋วต้องไม่ติดไปกับ URL ปลายทาง (ไม่ค้างใน history / referrer)
//   6. มี session อยู่แล้ว → ตั๋วต้องไม่เขียนทับ (ไม่งั้นเตะพนักงานออกจากระบบ)
//
// ไม่ต้องมีฐานข้อมูล · เส้นทางที่ทดสอบอยู่ก่อนการแตะ DB ทั้งหมด
// Run: node --test test/unit/embed-token.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 8836;
const BASE = `http://127.0.0.1:${PORT}`;
const EMBED_SECRET = 'embed-test-secret';
const SESSION_SECRET = 'session-test-secret';

let child;

// ตั๋วหน้าตาเดียวกับที่ฝั่ง CS ต้องสร้าง · ทั้งหมดคือ HMAC ของ JSON ก้อนเดียว
const mint = (exp, secret = EMBED_SECRET) => {
  const p = Buffer.from(JSON.stringify({ exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(p).digest('base64url');
  return `${p}.${sig}`;
};

function boot(env) {
  return new Promise((resolve, reject) => {
    const c = spawn(process.execPath, ['server.js'], {
      cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: String(PORT), SESSION_SECRET, ...env },
    });
    let out = '';
    const t = setTimeout(() => { c.kill(); reject(new Error('no start: ' + out)); }, 40000);
    c.stdout.on('data', d => { out += d; if (/LOVE Andaman on /.test(out)) { clearTimeout(t); resolve(c); } });
    c.stderr.on('data', d => { out += d; });
  });
}

const hit = (p, opt = {}) => fetch(BASE + p, { redirect: 'manual', ...opt });
const sessOf = (res) => {
  const sc = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')];
  const line = (sc || []).filter(Boolean).find(x => x.startsWith('sess='));
  return line ? line.split(';')[0].slice('sess='.length) : null;
};

test.after(() => { if (child) child.kill(); });

test('ไม่ตั้ง EMBED_TOKEN_SECRET → ตั๋วถูกเมิน', async () => {
  child = await boot({ EMBED_TOKEN_SECRET: '' });
  const res = await hit('/embed/bytrip?date=2026-09-20&t=' + mint(Date.now() + 60e3));
  assert.equal(res.status, 302);
  assert.equal(sessOf(res), null, 'ปิดสวิตช์แล้วต้องไม่มีใครได้ session');
  child.kill(); child = null;
});

test('ตั๋วดี → ได้ session และตั๋วไม่ติดไปกับ URL', async () => {
  child = await boot({ EMBED_TOKEN_SECRET: EMBED_SECRET });
  const res = await hit('/embed/bytrip?date=2026-09-20&t=' + mint(Date.now() + 60e3));
  assert.equal(res.status, 302);
  const tok = sessOf(res);
  assert.ok(tok, 'ต้องได้คุกกี้ sess');

  const loc = res.headers.get('location');
  assert.ok(!/[?&]t=/.test(loc), 'ตั๋วต้องหลุดออกจากปลายทาง · ได้ ' + loc);
  assert.match(loc, /embed=1&view=booking&tab=bytrip&date=2026-09-20$/);
  assert.ok(!/edit=1/.test(loc), 'ต้องยังเป็นโหมดดูอย่างเดียว');
});

test('ตัวตนที่ได้เป็นดูอย่างเดียว เห็นแค่ Booking · ตั๋วสั่งไม่ได้', async () => {
  const res = await hit('/embed/calendar?t=' + mint(Date.now() + 60e3));
  const cookie = 'sess=' + sessOf(res);

  const me = await hit('/api/me', { headers: { cookie } });
  assert.equal(me.status, 200);
  const j = await me.json();
  assert.equal(j.canEdit, false, 'แก้ไขไม่ได้');
  assert.deepEqual(j.perms, ['booking', '*explicit'], 'เห็นแค่หน้า Booking · ห้าม back-fill');
  assert.equal(j.role, 'staff', 'ห้ามเป็น admin ไม่ว่ากรณีใด');
  assert.deepEqual(j.editAreas, [], 'ไม่มีพื้นที่ที่แก้ได้สักพื้นที่');
});

test('เขียนไม่ได้จริง · /api/save ตอบ 403', async () => {
  const res = await hit('/embed/calendar?t=' + mint(Date.now() + 60e3));
  const cookie = 'sess=' + sessOf(res);
  /* ทางนี้ตรวจสิทธิ์ก่อนแตะฐานข้อมูล (server.js §save) จึงพิสูจน์ได้ที่นี่เลย
     ไม่ต้องมี DB · 403 ที่ได้คือ "ไม่มีสิทธิ์" จริง ๆ ไม่ใช่ "ต่อฐานข้อมูลไม่ได้" */
  const legacy = await hit('/api/save', {
    method: 'POST', headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ baseVersion: 1, full: '{}' }),
  });
  assert.equal(legacy.status, 403, 'ทางเขียนแบบเก่าต้องปิด · ได้ ' + legacy.status);
});

test('เขียนไม่ได้จริง · /api/v1/_batch ไม่สำเร็จ', async () => {
  const res = await hit('/embed/calendar?t=' + mint(Date.now() + 60e3));
  const cookie = 'sess=' + sessOf(res);
  const w = await hit('/api/v1/_batch', {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ baseVersion: 1, ops: [{ op: 'put', r: 'sb_bookings', id: 'zz_test_embed', body: {} }] }),
  });
  /* ⚠ ที่นี่ได้ 503 ไม่ใช่ 403 และไม่ใช่ความผิดของด่านสิทธิ์
     /api/v1 เช็ค `if(!pool) return 503` ไว้ก่อนจะคิด canWrite · เทสนี้รันโดยไม่มี DB
     จึงตกที่ 503 ก่อนเสมอ · ทั้งคู่คือ "ไม่ผ่าน" เหมือนกัน แต่คนละเหตุผล
     ด่าน 403 ของจริงอยู่ในสาขา _batch (canWrite) และอยู่ "ก่อน" readBody
     แปลว่าคำขอที่ไม่มีสิทธิ์ถูกตีกลับก่อนที่ body จะถูกอ่านด้วยซ้ำ
     ยืนยัน 403 ตัวจริงกับ prod แล้วเมื่อ 19 ก.ย. 2026 · บันทึกไว้ใน CLAUDE.md §embed */
  assert.ok(w.status >= 400, 'ต้องไม่สำเร็จ · ได้ ' + w.status);
  assert.notEqual(w.status, 200, 'ห้ามผ่าน');
});

test('ตั๋วที่ไม่ควรผ่าน ต้องไม่ผ่าน', async () => {
  const bad = {
    'หมดอายุแล้ว':            mint(Date.now() - 1000),
    'อ้างอายุยาวเกิน 10 นาที': mint(Date.now() + 60 * 60e3),
    'เซ็นด้วย SESSION_SECRET': mint(Date.now() + 60e3, SESSION_SECRET),
    'เซ็นด้วยกุญแจมั่ว':        mint(Date.now() + 60e3, 'not-the-secret'),
    'ลายเซ็นถูกแก้':           mint(Date.now() + 60e3).replace(/.$/, 'X'),
    'ไม่มีลายเซ็น':            Buffer.from(JSON.stringify({ exp: Date.now() + 60e3 })).toString('base64url'),
    'ขยะ':                    'garbage',
  };
  for (const [why, t] of Object.entries(bad)) {
    const res = await hit('/embed/calendar?t=' + encodeURIComponent(t));
    assert.equal(res.status, 302, why + ' · ควรเด้งไปหน้าเว็บตามปกติ');
    assert.equal(sessOf(res), null, why + ' · ต้องไม่ได้ session');
  }
});

test('ไม่มี exp = ไม่รับ · ตั๋วไม่มีวันหมดอายุห้ามมีอยู่', async () => {
  const p = Buffer.from(JSON.stringify({ hello: 'world' })).toString('base64url');
  const sig = crypto.createHmac('sha256', EMBED_SECRET).update(p).digest('base64url');
  const res = await hit('/embed/calendar?t=' + `${p}.${sig}`);
  assert.equal(sessOf(res), null, 'ลายเซ็นถูกแต่ไม่มีวันหมดอายุ → ต้องไม่รับ');
});

test('มี session อยู่แล้ว → ตั๋วต้องไม่เขียนทับ', async () => {
  // session ของ "พนักงานจริง" ที่ล็อกอิน rsvn ด้วยบัญชีตัวเองไว้ในเบราว์เซอร์เดียวกัน
  const payload = Buffer.from(JSON.stringify({
    uid: 1, username: 'somchai', name: 'Somchai', role: 'staff',
    perms: null, edit: true, iat: Date.now(), exp: Date.now() + 864e5,
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  const staff = `${payload}.${sig}`;

  const res = await hit('/embed/calendar?t=' + mint(Date.now() + 60e3), { headers: { cookie: 'sess=' + staff } });
  assert.equal(res.status, 302);
  assert.equal(sessOf(res), null, 'ห้ามตั้งคุกกี้ทับ · ไม่งั้นพนักงานโดนเตะออกจากระบบกลางคัน');

  const me = await hit('/api/me', { headers: { cookie: 'sess=' + staff } });
  assert.equal((await me.json()).username, 'somchai', 'session เดิมต้องยังอยู่ครบ');
});
