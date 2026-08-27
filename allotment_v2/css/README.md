# allotment_v2/css — the app's stylesheets

Until 2026-08-27 these were 16 `<style>` blocks in `allotment_v2.html`'s `<head>`. They were lifted
out **verbatim**, in cascade order, and merged into two files:

| file | was | size |
|---|---|---|
| `01-base.css` | the two anonymous base blocks (html lines 13 + 485) | 228 KB |
| `02-skins.css` | the 14 `<style id="*-skin">` re-skin layers | 67 KB |

Two small `<style>` blocks remain inline in `<body>` (a `@keyframes` for the doc-check spinner, and
one other) — they are view-scoped and not worth a request.

## Reverting a skin

`02-skins.css` keeps every layer in its original cascade order behind a marker:

```css
/* ==== softui-ocean-skin ==== */
```

**Delete from one marker up to the next to revert that skin** — the same one-step revert the
`<style id="...-skin">` blocks gave you, which is why they were merged with markers rather than
flattened. Order matters: later layers override earlier ones. Current order:

`bkv2-buildaxis-skin` · `softui-ocean-skin` · `md-glass-skin` · `bkv2-liquid-skin` ·
`cal-liquid-skin` · `dash-glass-skin` · `bop-glass-skin` · `topbar-float-skin` ·
`bkv2-nb-glass-skin` · `sidebar-glass-skin` · `bkv2-cal-filter-skin` · `cost-v2-skin` ·
`bkv2-vc-skin` · `la-mobile`

## Why two files and not sixteen

`server.js` is HTTP/1.1 (`http.createServer`) and sends `Cache-Control: no-cache`, so every file is
revalidated on every load and stylesheets are render-blocking. Each extra `<link>` is another
round-trip on the critical path. Two files keeps the cascade intact at minimum cost; sixteen would
have traded the 54 KB/navigation saving straight back.

Nothing in the JS references these by id — no `getElementById('...-skin')`, no
`document.styleSheets[n]` indexing, no `insertRule`. The nine `createElement('style')` calls inject
their own new elements at runtime and are unaffected.

## Careful with

- **Order.** The `<link>` tags sit at html lines 13–14, ahead of every script. Moving either one, or
  reordering the layers inside `02-skins.css`, changes the cascade.
- `server.js` `prewarmStatic` brotli-warms this directory at boot (css first, since it is
  render-blocking). Renaming a file means touching that list.
