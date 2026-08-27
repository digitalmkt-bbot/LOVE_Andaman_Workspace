// Unit proof for auth/oidc.js — the Authentik SSO helpers (2026-08-27).
//
// DOM-free, DB-free, network-free: `fetch` is stubbed so discovery and JWKS are served from an
// in-test RSA key. Everything here is a security property, so each test states the attack it
// closes rather than just the happy path.
//
// Run: node --test test/unit/oidc.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const ISSUER = 'https://auth.example.test/application/o/loveandaman';
const CLIENT_ID = 'test-client-id';
process.env.AUTH_OIDC_ISSUER = ISSUER + '/';
process.env.AUTH_OIDC_CLIENT_ID = CLIENT_ID;

const { createRequire } = await import('node:module');
const require = createRequire(import.meta.url);

// ── an RSA signing key standing in for Authentik's ──
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-kid', alg: 'RS256', use: 'sig' };

const b64u = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
function makeIdToken(claims, { kid = 'test-kid', alg = 'RS256', key = privateKey } = {}) {
  const head = b64u({ alg, kid, typ: 'JWT' });
  const body = b64u(claims);
  const sig = crypto.sign('sha256', Buffer.from(head + '.' + body), key).toString('base64url');
  return `${head}.${body}.${sig}`;
}
function claims(over = {}) {
  const now = Math.floor(Date.now() / 1000);
  return { iss: ISSUER, aud: CLIENT_ID, exp: now + 300, iat: now, sub: 'u1',
           preferred_username: 'somchai', email: 'somchai@loveandaman.com', nonce: 'N', ...over };
}

globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes('.well-known')) return { ok: true, json: async () => ({
    authorization_endpoint: ISSUER + '/authorize/', token_endpoint: ISSUER + '/token/', jwks_uri: ISSUER + '/jwks/' }) };
  if (u.includes('/jwks/')) return { ok: true, json: async () => ({ keys: [jwk] }) };
  throw new Error('unexpected fetch ' + u);
};

const oidc = require('../../auth/oidc.js');
const { txSign, txVerify, verifyIdToken, safeNext } = oidc._internal;
const SECRET = 'session-secret-under-test';

test('enabled() reflects configuration', () => {
  assert.equal(oidc.enabled(), true);
  assert.equal(oidc.autocreateMode(), 'off', 'auto-provisioning must be off unless asked for');
});

test('transaction cookie round-trips and rejects tampering', () => {
  const tok = txSign(SECRET, { state: 's', verifier: 'v', exp: Date.now() + 60e3 });
  assert.equal(txVerify(SECRET, tok).state, 's');
  assert.equal(txVerify('a-different-secret', tok), null, 'must not verify under another secret');
  const [p, sig] = tok.split('.');
  assert.equal(txVerify(SECRET, b64u({ state: 'attacker' }) + '.' + sig), null, 'payload swap must fail');
  assert.equal(txVerify(SECRET, p + '.' + 'x'.repeat(sig.length)), null, 'signature forgery must fail');
  assert.equal(txVerify(SECRET, txSign(SECRET, { state: 's', exp: Date.now() - 1 })), null, 'expiry enforced');
  assert.equal(txVerify(SECRET, 'not-a-token'), null);
  assert.equal(txVerify(SECRET, ''), null);
});

// The bug this closes: if the transaction cookie were signed with SESSION_SECRET itself, its token
// would also be a validly-signed `sess` cookie. Its payload has no username, so server.js's
// session() would return a truthy object for a user that does not exist — auth bypass.
test('a transaction token is NOT a valid session token', () => {
  const sessVerify = (token) => {   // mirrors server.js verify()
    try {
      const [p, sig] = String(token).split('.');
      const want = crypto.createHmac('sha256', SECRET).update(p).digest('base64url');
      const a = Buffer.from(sig), b = Buffer.from(want);
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
      return JSON.parse(Buffer.from(p, 'base64url').toString());
    } catch { return null; }
  };
  const tx = txSign(SECRET, { state: 's', verifier: 'v', exp: Date.now() + 60e3 });
  assert.equal(sessVerify(tx), null, 'transaction token must not validate as a session');

  const sessSign = (o) => { const p = b64u(o);
    return p + '.' + crypto.createHmac('sha256', SECRET).update(p).digest('base64url'); };
  const sess = sessSign({ username: 'admin', role: 'admin', exp: Date.now() + 60e3 });
  assert.equal(txVerify(SECRET, sess), null, 'session token must not validate as a transaction');
});

test('safeNext blocks open redirects', () => {
  assert.equal(safeNext('/allotment_v2/allotment_v2.html'), '/allotment_v2/allotment_v2.html');
  assert.equal(safeNext('//evil.example/'), oidc.DEFAULT_NEXT, 'protocol-relative URL rejected');
  assert.equal(safeNext('https://evil.example/'), oidc.DEFAULT_NEXT, 'absolute URL rejected');
  assert.equal(safeNext(''), oidc.DEFAULT_NEXT);
  assert.equal(safeNext(undefined), oidc.DEFAULT_NEXT);
});

test('verifyIdToken accepts a well-formed token', async () => {
  const c = await verifyIdToken(makeIdToken(claims()), 'N');
  assert.equal(c.preferred_username, 'somchai');
});

test('verifyIdToken rejects every tampered claim', async () => {
  const bad = async (token, nonce, why) =>
    assert.rejects(() => verifyIdToken(token, nonce), undefined, why);

  // signature made by a key that is not in the JWKS
  const { privateKey: other } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  await bad(makeIdToken(claims(), { key: other }), 'N', 'foreign signing key must be rejected');

  await bad(makeIdToken(claims({ iss: 'https://evil.example' })), 'N', 'issuer mismatch');
  await bad(makeIdToken(claims({ aud: 'someone-elses-client' })), 'N', 'audience mismatch');
  await bad(makeIdToken(claims({ exp: Math.floor(Date.now() / 1000) - 3600 })), 'N', 'expired token');
  await bad(makeIdToken(claims({ nonce: 'different' })), 'N', 'nonce mismatch (replay)');
  await bad(makeIdToken(claims(), { alg: 'none' }), 'N', 'alg=none must be unsupported');
  await bad('not.a.jwt', 'N', 'malformed token');
  await bad(makeIdToken(claims()) .split('.').slice(0, 2).join('.'), 'N', 'missing signature segment');
});

test('an audience array containing our client id is accepted', async () => {
  const c = await verifyIdToken(makeIdToken(claims({ aud: ['other', CLIENT_ID] })), 'N');
  assert.equal(c.sub, 'u1');
});

test('buildAuthorize produces a PKCE S256 challenge bound to its own cookie', async () => {
  const req = { headers: { host: 'rsvn.loveandaman.com', 'x-forwarded-proto': 'https' } };
  const { url, cookie } = await oidc.buildAuthorize(req, SECRET, '/allotment_v2/allotment_v2.html');
  const parsed = new URL(url);
  assert.equal(parsed.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(parsed.searchParams.get('client_id'), CLIENT_ID);
  assert.equal(parsed.searchParams.get('redirect_uri'), 'https://rsvn.loveandaman.com/auth/callback');
  assert.ok(!parsed.searchParams.has('client_secret'), 'no secret may reach the authorize URL');

  const tx = txVerify(SECRET, cookie.split(';')[0].split('=').slice(1).join('='));
  const expected = crypto.createHash('sha256').update(tx.verifier).digest('base64url');
  assert.equal(parsed.searchParams.get('code_challenge'), expected, 'challenge must be S256(verifier)');
  assert.equal(parsed.searchParams.get('state'), tx.state);
  assert.equal(parsed.searchParams.get('nonce'), tx.nonce);
  assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Lax/); assert.match(cookie, /Secure/);
});

test('completeCallback refuses a mismatched or missing transaction', async () => {
  const req = { headers: { host: 'rsvn.loveandaman.com' } };
  await assert.rejects(() => oidc.completeCallback(req, SECRET, 'code=abc&state=s1', undefined),
    /expired or its cookie was lost/, 'no cookie => refuse');
  const tx = txSign(SECRET, { state: 's1', verifier: 'v', nonce: 'N', ru: 'x', next: '/', exp: Date.now() + 60e3 });
  await assert.rejects(() => oidc.completeCallback(req, SECRET, 'code=abc&state=WRONG', tx),
    /state did not match/, 'CSRF: attacker-supplied state must not match');
  await assert.rejects(() => oidc.completeCallback(req, SECRET, 'error=access_denied&error_description=Nope', tx),
    /Nope/, 'provider error is surfaced');
});
