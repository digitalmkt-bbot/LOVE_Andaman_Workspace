# ops-skip-legacy-api-v1-probe: Skip legacy API resource probe

## Input contract

- **Requested outcome:** Remove the expected `401` request to the frontend-origin legacy `/api/v1` endpoint.
- **Acceptance criteria:** In operation-backend-only mode, boot must not request `/api/v1`; operation-backend booking traffic remains unchanged.
- **Allowed scope:** `allotment_v2/js/01-auth-sync.js` and this handoff record.
- **Constraints/invariants:** Preserve the legacy probe when `LA_LEGACY_SYNC` is enabled; do not alter persistence or operation-backend bearer-token calls.
- **Base branch:** `origin/integration/operation-backend`
- **Starting assumptions:** `LA_LEGACY_SYNC` is `false` on this branch, and `/api/v1` is a legacy `server.js` endpoint requiring a retired cookie session.

## Output contract

### Observable behavior

| Area | Before | After |
|---|---|---|
| Operation-backend-only boot | Always requested frontend-origin `GET /api/v1`, producing an expected 401. | Does not request `/api/v1` when `LA_LEGACY_SYNC` is false. |
| Legacy-sync deployment | Requested `/api/v1`. | Continues to request `/api/v1` when `LA_LEGACY_SYNC` is true. |

### Interfaces and contracts

- **Added:** None.
- **Changed:** The legacy resource-index probe is conditional on `LA_LEGACY_SYNC`.
- **Removed:** Unnecessary operation-backend-only request to the frontend-origin legacy API.
- **Compatibility notes:** `REST_RESOURCES` remains `null` when legacy sync is off; auto-sync is already disabled because no legacy blob was loaded.

### Files changed

```text
modified  allotment_v2/js/01-auth-sync.js
added     docs/development/tasks/ops-skip-legacy-api-v1-probe.md
added     .agent-reports/ops-skip-legacy-api-v1-probe.json
```

### Data and persistence impact

- **Database/schema:** None.
- **API or mapper:** No operation-backend API contract changes; a legacy browser probe is skipped.
- **Migration required:** No.
- **Rollback effect on data:** None.

## Verification evidence

| Command/check | Result |
|---|---|
| `node --check allotment_v2/js/01-auth-sync.js` | Passed |
| `git diff --check` | Passed |

## Decisions, risks, and rollback

- **Decisions:** Reused the existing `LA_LEGACY_SYNC` feature flag instead of deleting code needed by legacy deployments.
- **Known risks:** Operation-backend-only screens not yet migrated remain unavailable by design; this change only removes an irrelevant request.
- **Blockers:** None.
- **Dependencies:** Deployment of this branch and browser reload are required before the network request disappears.
- **Follow-up work:** Replace remaining legacy sync paths as their corresponding operation-backend resources are integrated.
- **Rollback procedure:** Revert this commit to restore the unconditional legacy resource-index probe.

## Agent handoff

- **Task:** ops-skip-legacy-api-v1-probe
- **Branch:** `integration/operation-backend`
- **Worktree:** `D:/projects/wt-operation-backend-integration`
- **HEAD at scaffold:** `639e0101b481fd9b96f25c718c0276803bdfabbb`
- **Merge base:** `639e0101b481fd9b96f25c718c0276803bdfabbb`
- **PR:** None.
- **Unrelated changes left untouched:** None.
