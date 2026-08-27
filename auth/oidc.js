// LOVE Andaman · Authentik (OIDC) sign-in for the monolith.
//
// Why this lives on server.js and not in the ops-web SPA: the SPA runs on a different Railway
// origin and holds its Authentik token in memory, which means nothing to this server — its auth is
// the HMAC-signed `sess` cookie minted by /api/login. A browser redirected from the SPA would land
// on allotment_v2.html, get 401 from /api/me, and be shown the app's own login form. Two logins.
//
// So the whole authorization-code + PKCE exchange happens HERE, on the app's own origin: the code
// is redeemed server-side over TLS with the client secret, the id_token is verified against
// Authentik's JWKS, and the result is turned into the ordinary `sess` cookie. The browser never
// handles a token, and allotment_v2.html is reached already signed in.
//
// Configuration (all optional — with AUTH_OIDC_ISSUER or AUTH_OIDC_CLIENT_ID unset the routes are
// simply not registered and password login is unaffected):
//   AUTH_OIDC_ISSUER         https://auth.example.com/application/o/<slug>/
//   AUTH_OIDC_CLIENT_ID      the Authentik provider's client id
//   AUTH_OIDC_CLIENT_SECRET  confidential client secret (omit for a public client — PKCE still applies)
//   AUTH_OIDC_SCOPES         default "openid profile email"
//   AUTH_OIDC_REDIRECT_URI   override; normally derived from the request's own host
//   AUTH_OIDC_AUTOCREATE     "off" (default) | "full" — see resolveUser() in server.js
const crypto = require('crypto');

const ISSUER        = (process.env.AUTH_OIDC_ISSUER || '').trim().replace(/\/+$/, '');
const CLIENT_ID     = (process.env.AUTH_OIDC_CLIENT_ID || '').trim();
const CLIENT_SECRET = process.env.AUTH_OIDC_CLIENT_SECRET || '';
const SCOPES        = (process.env.AUTH_OIDC_SCOPES || 'openid profile email').trim();
const AUTOCREATE    = (process.env.AUTH_OIDC_AUTOCREATE || 'off').trim().toLowerCase();
const REDIRECT_OVERRIDE = (process.env.AUTH_OIDC_REDIRECT_URI || '').trim();

const CALLBACK_PATH = '/auth/callback';
// Escape hatch. With SSO on, an unauthenticated page load goes straight to Authentik — so if
// Authentik is down or misconfigured there is otherwise NO way into the app, including for the
// admin who needs to fix it. `?login=password` always serves the built-in form instead.
const PASSWORD_ESCAPE = 'login';
const TX_COOKIE     = 'oidc_tx';
const TX_TTL_MS     = 10 * 60e3;          // a login that takes longer than this starts over
const DEFAULT_NEXT  = '/allotment_v2/allotment_v2.html';

function enabled(){ return !!(ISSUER && CLIENT_ID); }
function autocreateMode(){ return AUTOCREATE; }

// ── small helpers ──
const b64u    = (buf) => Buffer.from(buf).toString('base64url');
const b64uBuf = (s)   => Buffer.from(String(s), 'base64url');
const rand    = ()    => b64u(crypto.randomBytes(32));

// The transaction cookie is signed with a key DERIVED from SESSION_SECRET, never with SESSION_SECRET
// itself. Sharing the session signer would make a transaction token a validly-signed token for the
// `sess` cookie too — and its payload has no username, so session() would hand back a truthy object
// for a user that does not exist. Domain-separating the key makes the two mutually unforgeable.
function txKey(secret){ return crypto.createHmac('sha256', String(secret)).update('la.oidc.tx.v1').digest(); }
function txSign(secret, obj){
  const p = b64u(JSON.stringify(obj));
  return p + '.' + crypto.createHmac('sha256', txKey(secret)).update(p).digest('base64url');
}
function txVerify(secret, token){
  try{
    const [p, sig] = String(token).split('.');
    if(!p || !sig) return null;
    const want = crypto.createHmac('sha256', txKey(secret)).update(p).digest('base64url');
    const a = Buffer.from(sig), b = Buffer.from(want);
    if(a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const o = JSON.parse(b64uBuf(p).toString());
    if(!o.exp || Date.now() > o.exp) return null;
    return o;
  }catch(e){ return null; }
}

// ── discovery ──
// Unlike the browser (Authentik's discovery document is not CORS-enabled, see ops-web/auth/oidc.ts)
// the server can just fetch it. The deterministic Authentik layout stays as a fallback so a blip on
// the discovery endpoint does not take sign-in down.
let _disc = null, _discAt = 0;
const DISC_TTL = 3600e3;
function authentikFallback(){
  const m = /^(https:\/\/[^/]+)\/application\/o\/[^/]+$/.exec(ISSUER);
  if(!m) return null;
  const base = m[1] + '/application/o';
  return { authorization_endpoint: base + '/authorize/', token_endpoint: base + '/token/',
           jwks_uri: ISSUER + '/jwks/', end_session_endpoint: ISSUER + '/end-session/' };
}
async function discovery(){
  if(_disc && Date.now() - _discAt < DISC_TTL) return _disc;
  try{
    const r = await fetch(ISSUER + '/.well-known/openid-configuration', { cache: 'no-store' });
    if(!r.ok) throw new Error('discovery HTTP ' + r.status);
    const d = await r.json();
    if(!d.authorization_endpoint || !d.token_endpoint) throw new Error('discovery document is incomplete');
    _disc = d; _discAt = Date.now();
    return d;
  }catch(e){
    const fb = authentikFallback();
    if(!fb) throw e;
    console.warn('[oidc] discovery failed (' + e.message + ') — using the Authentik endpoint layout');
    _disc = fb; _discAt = Date.now();
    return fb;
  }
}

// ── JWKS ──
let _jwks = null, _jwksAt = 0;
const JWKS_TTL = 3600e3;
async function keyFor(kid){
  const fetchKeys = async () => {
    const d = await discovery();
    if(!d.jwks_uri) throw new Error('the provider advertises no jwks_uri');
    const r = await fetch(d.jwks_uri, { cache: 'no-store' });
    if(!r.ok) throw new Error('JWKS HTTP ' + r.status);
    const body = await r.json();
    _jwks = Array.isArray(body.keys) ? body.keys : [];
    _jwksAt = Date.now();
  };
  if(!_jwks || Date.now() - _jwksAt > JWKS_TTL) await fetchKeys();
  let jwk = _jwks.find(k => !kid || k.kid === kid);
  // A rotated signing key is the normal reason for a miss — refetch once before giving up.
  if(!jwk){ await fetchKeys(); jwk = _jwks.find(k => !kid || k.kid === kid); }
  if(!jwk) throw new Error('no JWKS key matches kid ' + kid);
  return crypto.createPublicKey({ key: jwk, format: 'jwk' });
}

// ── id_token verification ──
// OIDC Core 3.1.3.7 permits skipping this when the token comes straight from the token endpoint
// over TLS, which it does here. Verified anyway: it is ~20 lines and it is what makes the claims
// trustworthy rather than merely well-sourced.
const ALGS = {
  RS256: { algorithm: 'sha256' },
  RS384: { algorithm: 'sha384' },
  RS512: { algorithm: 'sha512' },
  ES256: { algorithm: 'sha256', dsaEncoding: 'ieee-p1363' },
  ES384: { algorithm: 'sha384', dsaEncoding: 'ieee-p1363' },
};
async function verifyIdToken(idToken, nonce){
  const parts = String(idToken).split('.');
  if(parts.length !== 3) throw new Error('id_token is not a JWS');
  const [h, p, s] = parts;
  const header = JSON.parse(b64uBuf(h).toString());
  const claims = JSON.parse(b64uBuf(p).toString());

  const spec = ALGS[header.alg];
  if(!spec) throw new Error('unsupported id_token algorithm ' + header.alg);
  const key = await keyFor(header.kid);
  const opts = Object.assign({ key }, spec.dsaEncoding ? { dsaEncoding: spec.dsaEncoding } : {});
  if(!crypto.verify(spec.algorithm, Buffer.from(h + '.' + p), opts, b64uBuf(s)))
    throw new Error('id_token signature is not valid');

  const now = Math.floor(Date.now() / 1000);
  const SKEW = 120;
  const iss = String(claims.iss || '').replace(/\/+$/, '');
  if(iss !== ISSUER) throw new Error('id_token issuer mismatch');
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if(!aud.includes(CLIENT_ID)) throw new Error('id_token audience mismatch');
  if(typeof claims.exp !== 'number' || now > claims.exp + SKEW) throw new Error('id_token has expired');
  if(typeof claims.iat === 'number' && claims.iat > now + SKEW) throw new Error('id_token is not yet valid');
  // The nonce binds this token to the /auth/login that started the flow — it is what stops a token
  // obtained elsewhere from being replayed into this callback.
  if(nonce && claims.nonce !== nonce) throw new Error('id_token nonce mismatch');
  return claims;
}

// ── request helpers ──
// Behind Railway's proxy TLS is terminated upstream, so x-forwarded-proto is the only truth. Fall
// back to whether THIS socket is encrypted rather than assuming https, or a plain-http local run
// builds https:// URLs that Authentik will reject as an unregistered redirect.
function originOf(req){
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim()
             || (req.socket && req.socket.encrypted ? 'https' : 'http');
  const host  = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  return proto + '://' + host;
}
function redirectUri(req){
  if(REDIRECT_OVERRIDE) return REDIRECT_OVERRIDE;
  return originOf(req) + CALLBACK_PATH;
}
// Only same-site absolute paths may be returned to. "//evil.example" is a protocol-relative URL and
// would be an open redirect, so a second leading slash disqualifies it.
function safeNext(value){
  const v = String(value || '');
  if(!v.startsWith('/') || v.startsWith('//')) return DEFAULT_NEXT;
  return v;
}

/** Step 1 — build the Authentik authorize URL and the signed transaction cookie that pairs with it. */
async function buildAuthorize(req, secret, next){
  const d = await discovery();
  const verifier = rand(), state = rand(), nonce = rand();
  const challenge = b64u(crypto.createHash('sha256').update(verifier).digest());
  const ru = redirectUri(req);

  const url = new URL(d.authorization_endpoint);
  url.search = new URLSearchParams({
    client_id: CLIENT_ID, redirect_uri: ru, response_type: 'code', scope: SCOPES,
    state, nonce, code_challenge: challenge, code_challenge_method: 'S256',
  }).toString();

  const tx = txSign(secret, { verifier, state, nonce, ru, next: safeNext(next), exp: Date.now() + TX_TTL_MS });
  return { url: url.toString(), cookie: `${TX_COOKIE}=${tx}; HttpOnly; Path=/; SameSite=Lax; Secure; Max-Age=${TX_TTL_MS / 1000}` };
}

/** Step 2 — validate the callback, redeem the code, verify the id_token. Returns its claims. */
async function completeCallback(req, secret, query, txCookieValue){
  const params = new URLSearchParams(query || '');
  const err = params.get('error');
  if(err) throw new Error(params.get('error_description') || err);

  const code = params.get('code'), state = params.get('state');
  const tx = txVerify(secret, txCookieValue);
  if(!code || !state) throw new Error('the callback carried no authorization code');
  if(!tx) throw new Error('this login attempt expired or its cookie was lost — start again');
  if(tx.state !== state) throw new Error('callback state did not match — start again');

  const d = await discovery();
  const body = { grant_type: 'authorization_code', client_id: CLIENT_ID, code,
                 redirect_uri: tx.ru, code_verifier: tx.verifier };
  if(CLIENT_SECRET) body.client_secret = CLIENT_SECRET;
  const r = await fetch(d.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams(body),
  });
  const tok = await r.json().catch(() => ({}));
  if(!r.ok || !tok.id_token)
    throw new Error(tok.error_description || tok.error || ('token exchange failed (' + r.status + ')'));

  const claims = await verifyIdToken(tok.id_token, tx.nonce);
  return { claims, next: safeNext(tx.next) };
}

/** RP-initiated logout: end the session at Authentik too, then come back to `postLogout`.
 *  Without this, clearing the app's own cookie is pointless — the next page load bounces to
 *  /auth/login, Authentik still has its own session, and it signs the user straight back in. */
async function buildLogout(req, postLogout){
  let d = null;
  try{ d = await discovery(); }catch(e){ d = null; }
  if(!d || !d.end_session_endpoint) return null;
  const url = new URL(d.end_session_endpoint);
  url.searchParams.set('post_logout_redirect_uri', originOf(req) + safeNext(postLogout));
  return url.toString();
}

/** Cookie that clears the transaction — attributes must match the one set above or it will not overwrite. */
function clearTxCookie(){
  return `${TX_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Secure; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0`;
}

module.exports = {
  enabled, autocreateMode, buildAuthorize, completeCallback, buildLogout, clearTxCookie, discovery,
  CALLBACK_PATH, TX_COOKIE, DEFAULT_NEXT, PASSWORD_ESCAPE,
  _internal: { txSign, txVerify, verifyIdToken, safeNext, redirectUri },
};
