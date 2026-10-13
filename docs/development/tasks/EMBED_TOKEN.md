# Embedding the Booking view in another app (`/embed/*` + embed token)

> For whoever builds `cs.loveandaman.com`. Everything here is implemented and tested
> (`test/unit/embed-token.test.mjs`, `test/ui/t_embed.mjs`, `test/ui/t_embed_csp.mjs`).

## What you get

```html
<iframe src="https://rsvn.loveandaman.com/embed/bytrip?date=2026-09-20&t=TOKEN"
        style="width:100%;height:820px;border:0"></iframe>
```

| page | shows |
|---|---|
| `/embed/calendar` | Booking → Calendar tab, month grid |
| `/embed/bytrip` | Booking → By trip · date |

Query params: `date=YYYY-MM-DD`, `route=<routeId>`, `t=<token>`, `edit=1` (opts the action
buttons back in — **don't**, unless you mean it), `chrome=1` (debug, keeps the sidebar).

Anything that doesn't match its expected shape is dropped rather than reflected into the
redirect — `date=NOT-A-DATE` and `route=../../etc/passwd` simply vanish.

## Why a token at all

The iframe is a normal page load on `rsvn.loveandaman.com`, so it runs as whoever holds an
rsvn session cookie in that browser. CS staff have no rsvn accounts and shouldn't need any.
The token is how your app vouches for the viewer without anybody logging in twice.

## Minting the token

One HMAC over one JSON object. ~10 lines in any language.

```js
const crypto = require('crypto');

function embedToken(secret) {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + 120_000 })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}
```

- `exp` is **milliseconds** since epoch (`Date.now()`, not Unix seconds), and is **required** —
  a token without it is rejected.
- Keep the life short. 2 minutes is plenty; anything claiming more than **10 minutes** ahead is
  rejected on the assumption you configured it wrong.
- Base64**url** (`-_`, no `=` padding), both parts, joined by a single `.`.

**Mint it on your server, per page render.** Never ship the secret to the browser, never bake a
token into static HTML — it goes stale in two minutes and you'd be handing out the key.

## Rules the rsvn side enforces

1. **The token does not say who the user is, and rsvn wouldn't believe it if it did.** It proves
   only "the CS app vouches for this viewer." The identity is fixed on the rsvn side:

   ```
   username 'embed:cs' · role staff · perms ['booking','*explicit'] · edit false
   ```

   There is no such row in the users table, and there doesn't need to be — every read path reads
   the signed cookie, never the database. **You cannot escalate through the token.**

2. **Read-only, enforced server-side.** `edit:false` ⇒ `/api/save` and `/api/v1/_batch` both
   return `403`. Not hidden buttons — refused requests. The embed *also* hides the Van/Boat/
   Re-confirm mode row and `+ New booking`, but that's cosmetic; the 403 is the real boundary.

3. **`EMBED_TOKEN_SECRET` is its own secret, never `SESSION_SECRET`.** If your app held the
   session secret it could sign itself an admin session. With a separate one, the worst case if
   it leaks is a read-only Booking view.

4. **An existing session always wins.** If the viewer already has an rsvn cookie — an actual
   staff member on that browser — the token is ignored and the frame runs as them. Otherwise the
   iframe would overwrite their real session and sign them out of their own tab.

5. **The token never reaches the final URL.** `/embed/*` redeems it and 302s without it, so it
   doesn't sit in history or leak through `Referer`.

6. **Replay within the token's lifetime is possible** — no nonce is stored. The short life plus
   the read-only outcome is the mitigation. If that's not good enough for you, say so and we'll
   add one-time use.

## Changing the date without reloading

A reload re-downloads ~2.26 MB of JS and re-fetches the whole dataset. Don't reload; re-aim:

```js
frame.contentWindow.postMessage(
  { type: 'la-embed', tab: 'bytrip', date: '2026-09-21' },
  'https://rsvn.loveandaman.com'
);
```

The frame posts `{type:'la-embed-ready', view, tab, date}` back to the parent once it's running —
use it to drop a spinner. The session cookie carries the identity from then on, so no new token
is needed for these.

## Two things that must be set on the rsvn side

```
EMBED_ORIGINS      = https://cs.loveandaman.com    # who may frame it (CSP frame-ancestors)
EMBED_TOKEN_SECRET = <shared with the CS app>      # unset = token entry disabled entirely
EMBED_SESS_HOURS   = 12                            # optional, default 12, capped at 24
```

`EMBED_ORIGINS` is an **origin** — scheme + host, no path, no wildcard. Same-site is not the same
as same-origin: `cs.` and `rsvn.` are the same *site* (so the cookie works) but different
*origins* (so CSP needs it listed).

## Kill switch

Unsetting `EMBED_TOKEN_SECRET` stops new sessions immediately. Cookies already issued stay valid
until they expire (`EMBED_SESS_HOURS`, default 12). There is no per-session revocation for
`embed:cs` today — if you need instant global revocation, rotate the secret **and** shorten
`EMBED_SESS_HOURS`.
