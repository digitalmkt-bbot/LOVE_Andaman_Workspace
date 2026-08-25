type Discovery = {
  authorization_endpoint: string;
  token_endpoint: string;
  end_session_endpoint?: string;
};

export type OidcTokens = {
  accessToken: string;
  idToken?: string | undefined;
};

const TRANSACTION_KEY = 'la.ops.oidc.transaction';
const issuer = (import.meta.env.VITE_AUTH_ISSUER ?? '').trim().replace(/\/+$/, '');
const clientId = (import.meta.env.VITE_AUTH_CLIENT_ID ?? '').trim();
// The callback must be on the same deployed frontend origin. Deriving it avoids
// deploying a stale Railway hostname into the bundle when a service is renamed.
const redirectUri = `${window.location.origin}/auth/callback`;

function configured(): void {
  if (!issuer || !clientId) {
    throw new Error('Authentication is not configured. Set VITE_AUTH_ISSUER and VITE_AUTH_CLIENT_ID.');
  }
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomValue(): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

async function sha256(value: string): Promise<string> {
  return base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))));
}

function authentikEndpoints(): Discovery | null {
  const match = /^(https:\/\/[^/]+)\/application\/o\/[^/]+$/.exec(issuer);
  if (!match) return null;
  const base = `${match[1]}/application/o`;
  return {
    authorization_endpoint: `${base}/authorize/`,
    token_endpoint: `${base}/token/`,
    end_session_endpoint: `${issuer}/end-session/`,
  };
}

async function discovery(): Promise<Discovery> {
  configured();
  // Authentik's discovery document is not CORS-enabled, whereas its OAuth
  // authorization/token endpoints are. Its documented endpoint layout is
  // deterministic, so do not make a browser request that CORS will block.
  const authentik = authentikEndpoints();
  if (authentik) return authentik;
  const response = await fetch(`${issuer}/.well-known/openid-configuration`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Unable to load OIDC configuration (${response.status})`);
  return response.json() as Promise<Discovery>;
}

/** Redirect to Authentik using authorization code + PKCE. No client secret reaches the browser. */
export async function beginLogin(): Promise<void> {
  const [document, verifier, state] = await Promise.all([discovery(), Promise.resolve(randomValue()), Promise.resolve(randomValue())]);
  const challenge = await sha256(verifier);
  sessionStorage.setItem(TRANSACTION_KEY, JSON.stringify({ verifier, state }));

  const url = new URL(document.authorization_endpoint);
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid profile email',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString();
  window.location.assign(url.toString());
}

/** Exchanges the callback code. Tokens remain in memory after this function returns. */
export async function completeLogin(): Promise<OidcTokens> {
  configured();
  const params = new URLSearchParams(window.location.search);
  const providerError = params.get('error');
  if (providerError) throw new Error(params.get('error_description') ?? providerError);

  const code = params.get('code');
  const state = params.get('state');
  const saved = sessionStorage.getItem(TRANSACTION_KEY);
  sessionStorage.removeItem(TRANSACTION_KEY);
  if (!code || !state || !saved) throw new Error('Login callback is missing its authorization transaction. Start login again.');

  const transaction = JSON.parse(saved) as { verifier?: string; state?: string };
  if (!transaction.verifier || transaction.state !== state) throw new Error('Login callback state did not match. Start login again.');

  const document = await discovery();
  const response = await fetch(document.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      code,
      redirect_uri: redirectUri,
      code_verifier: transaction.verifier,
    }),
  });
  const body = (await response.json()) as { access_token?: string; id_token?: string; error_description?: string; error?: string };
  if (!response.ok || !body.access_token) throw new Error(body.error_description ?? body.error ?? `Token exchange failed (${response.status})`);
  return { accessToken: body.access_token, idToken: body.id_token };
}

export async function beginLogout(idToken?: string): Promise<void> {
  if (!issuer) return;
  const document = await discovery();
  if (!document.end_session_endpoint) return;
  const url = new URL(document.end_session_endpoint);
  if (idToken) url.searchParams.set('id_token_hint', idToken);
  url.searchParams.set('post_logout_redirect_uri', window.location.origin);
  window.location.assign(url.toString());
}
