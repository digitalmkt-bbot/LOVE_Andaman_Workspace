# ATTACHMENTS-API: operation-backend attachment adapter

## Input

Replace live legacy attachment transport in operation-backend mode only. Keep legacy mode unchanged; do not change the backend contract or `/api/mailimg`.

## Output

`js/ops/38-ops-attachments.js` routes legacy attachment fetch callers to authenticated `/v1/attachments`, translates `dataB64` to `data_b64`, and aliases the API response `name` to legacy `filename`. It also obtains view blobs through `laOpsFetch` and replaces attachment image/link URLs with object URLs, because browser URL loads cannot send the Bearer token. The adapter is loaded after existing ops adapters. Booking and PFM attachment cards opt into the blob URL helper.

No schema, operation-backend API, or mail-image changes were made.

## Verification

- `node --check allotment_v2/js/ops/38-ops-attachments.js` — passed.
- `node --check allotment_v2/js/booking/bookingV2AttachListHTML.js` — passed.
- `node --check allotment_v2/js/08-app.js` — passed.
- Static audit: remaining `/api/attach` strings are legacy-mode fallbacks/comments and callers intercepted only while `laOps.enabled()` is true. `/api/mailimg` was not changed.

## Risk

The legacy screens retain raw attachment URL construction. The adapter observes newly inserted image, iframe, and anchor attachment URLs and converts them to authenticated object URLs in ops mode; a browser-level end-to-end check remains desirable.

## Rollback

Remove the adapter script tag and `38-ops-attachments.js`; legacy paths remain unchanged.
