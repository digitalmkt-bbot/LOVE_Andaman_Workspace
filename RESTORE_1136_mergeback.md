# Restore to 11:36 ICT (2026-07-10) — merge-back checklist

Full pre-restore backup downloaded to user's Downloads:
`backup_PRERESTORE_2026-07-10T09-15-43-234Z.json` (3,587,101 bytes · server version 3130)

## Bookings created AFTER 11:36 (lost by an 11:36 restore → re-add these)
| Booking | Lead | Created (UTC) | Created (ICT) | Agent | Note |
|---|---|---|---|---|---|
| BK-26070267-3M3C | Mr.Mohan Shyam | 2026-07-10T04:36:03Z | 11:36:03 | a01 | before corruption (clean) |
| BK-26070268-BM3Z | คุณวชิรญาณ์ | 2026-07-10T04:39:15Z | 11:39:15 | a65 | before corruption (clean) |
| BK-26070269-WTDU | Nasonova SV | 2026-07-10T06:16:25Z | 13:16:25 | a36 | after corruption |

Full records for all 3 are inside the PRERESTORE backup file.

## Corruption facts (for reference)
- a01 last confirmed real (hpk/Hotel-Own Counter) at booking created 11:36:03.
- First corrupting save: POST /api/v1/_batch at **11:49:58 ICT** (per-entity, no username logged).
- Trigger: server restart from the 11:48:06 date-header deploy → client reload → loadData version-mismatch reseed.
- Reverted to dev seed: boats b4/b5 (fixed), routes (closures lost), agents a01/a02/a10/a11/a30/a50/a60 (7, ~468 bookings). a01/a10/a30 proven reverted via marketSnapshot.

## Must-do BEFORE restore (or it recurs)
1. Fix client `loadData` (stop boats/routes reseed on version mismatch) — allotment_v2.html ~line 4291.
2. Investigate + fix agent revert trigger (correlates with rateTypeId / sb_agents_rate_bindings).
3. (optional) revert §102 daily-reset to cut reload exposure.
4. Add username logging to /api/v1/_batch saves (traceability).
