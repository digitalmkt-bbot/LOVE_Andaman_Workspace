# LAM-79: Record the Next.js App Router + TypeScript architecture decision

## Input contract

- **Requested outcome:** Create `docs/adr/001-nextjs-app-router.md` recording why Next.js App Router and TypeScript were selected for the LOVE Andaman modernization front end, honestly comparing the React + Vite alternative, and documenting the strangler migration strategy, initial module boundaries, deployment implications, and rollback constraints.
- **Acceptance criteria:** The ADR is reviewed and linked from the architecture documentation (`SYSTEM_MAP.md`).
- **Allowed scope:** `docs/adr/**`, a surgical link-only edit to `SYSTEM_MAP.md`, this task report, and its manifest.
- **Constraints/invariants:** No application, test, database, persistence, API, or legacy `allotment_v2/allotment_v2.html` changes. `SYSTEM_MAP.md` may only gain the ADR link — no metadata, date, or version-string edits, no other line touched. Ground the ADR in this repository's real state (Railway auto-deploy from `main`, Postgres-backed persistence, real module boundaries) rather than generic Next.js boilerplate. LAM-76 is concurrently building `apps/web/**`; describe intended boundaries without asserting unverified specifics about its file layout.
- **Base branch:** `main`
- **Starting assumptions:** Worktree started clean at `origin/main` (`17a15c4`); no `docs/adr/`, `apps/web/`, or existing ADR tooling present in this repo yet; `SYSTEM_MAP.md`, `CLAUDE.md`, `README.md`, and `server.js` are the authoritative sources for architecture facts.

## Output contract

### Observable behavior

| Area | Before | After |
|---|---|---|
| Architecture decision records | No `docs/adr/` directory or ADR existed in the repo. | `docs/adr/001-nextjs-app-router.md` exists, documenting the Next.js App Router + TypeScript decision, the React+Vite alternative (including where Vite would honestly have been the better choice), strangler migration strategy, initial module-boundary table, deployment implications, and rollback constraints. |
| `SYSTEM_MAP.md` discoverability | No pointer to any ADR. | One new line under the header block links to `docs/adr/001-nextjs-app-router.md`; every pre-existing line (including the `Last updated` date) is unchanged. |

### Interfaces and contracts

- **Added:** `docs/adr/001-nextjs-app-router.md` (new documentation file, ADR-001).
- **Changed:** `SYSTEM_MAP.md` — one line added (ADR link); no other line modified.
- **Removed:** None.
- **Compatibility notes:** Documentation-only change. No code, schema, API, or runtime behavior is affected. Nothing in `allotment_v2/allotment_v2.html`, `server.js`, `package.json`, or `railway.json` was touched.

### Files changed

```text
A  docs/adr/001-nextjs-app-router.md
M  SYSTEM_MAP.md            (+1 line: ADR link, no other line touched)
A  docs/development/tasks/LAM-79.md
A  .agent-reports/LAM-79.json
```

### Data and persistence impact

- **Database/schema:** None.
- **API or mapper:** None.
- **Migration required:** No.
- **Rollback effect on data:** None — no data, schema, or API is touched by this task. Reverting the two documentation files fully reverses it.

## Verification evidence

| Command/check | Result |
|---|---|
| `git status --short --branch` (recorded before any change) | Passed — clean worktree at task start, confirmed no pre-existing modifications. |
| `git diff -- SYSTEM_MAP.md` (reviewed before staging) | Passed — diff shows exactly one added line (the ADR link); no other line, date, or metadata touched. |
| `git diff --stat` / `git diff --name-status` (full working-tree diff reviewed before staging) | Passed — only `SYSTEM_MAP.md` (modified) and the new `docs/adr/`, `docs/development/tasks/`, `.agent-reports/` files are present; nothing outside owned scope. |
| Manual read-through of `docs/adr/001-nextjs-app-router.md` against `CLAUDE.md`, `SYSTEM_MAP.md`, `README.md`, and `server.js` for factual grounding (deploy model, API surface, persistence modes, module catalog) | Passed — every concrete claim in the ADR (Railway/Nixpacks, `npm start`, blob vs. relational `DATA_BACKEND`, `/api/v1/*` mapping API, session cookie mechanics, module/store-key table) is traceable to a specific line or section in those source files. |
| `node --check` on any JS | Not run — no JavaScript file was added or modified by this task (documentation-only change), so there is nothing to check. |
| Markdown link path check (`docs/adr/001-nextjs-app-router.md` relative to `SYSTEM_MAP.md` at repo root) | Passed (manual) — path resolves correctly relative to the repo root where `SYSTEM_MAP.md` lives. |
| `npm install` / build / test suite | Not run — task scope is documentation-only; no build or test tooling applies. No claim is made about package installability in this sandbox. |

## Decisions, risks, and rollback

- **Decisions:**
  - ADR status set to "Proposed" (not "Accepted") since the acceptance criterion is "the ADR is reviewed and linked" — review by a human has not yet occurred as part of this task.
  - Recommended traffic-seam approach (path-prefix reverse proxy, same-origin, for session continuity) is recorded as a recommendation with implementation left to whichever task owns Railway/root infra configuration — this task does not own that config and does not decide it unilaterally.
  - Module-boundary table is framed explicitly as a starting point, not a binding contract, since LAM-76's actual `apps/web` layout was not verified from this worktree (per task instruction not to assert unverified specifics about it).
- **Known risks:** The ADR's module-boundary table and deployment recommendation could need revision once LAM-76's real `apps/web` structure lands; the ADR already frames these as non-binding starting points to reduce that risk.
- **Blockers:** None.
- **Dependencies:** LAM-76 (`apps/web/**` shell) — the ADR's module-boundary section explicitly depends on that work for concrete file-layout details not yet available here. The traffic-seam (reverse proxy vs. subdomain) decision depends on whoever owns Railway/root deployment configuration.
- **Follow-up work:** A human review/acceptance pass on the ADR (to flip Status from "Proposed" to "Accepted"); a follow-up task to decide and implement the traffic seam between the legacy app and `apps/web`; reconciling the manual GitHub-Desktop deploy ritual in `CLAUDE.md` with a normal CI/CD flow for `apps/web`, flagged in the ADR as an open question.
- **Rollback procedure:** `git revert` the commit, or manually: delete `docs/adr/001-nextjs-app-router.md` and remove the single added line from `SYSTEM_MAP.md`. No data, schema, or running service is affected either way.

## Agent handoff

- **Task:** LAM-79
- **Branch:** `agent/LAM-79-nextjs-architecture-adr`
- **Worktree:** `D:/projects/wt-sprint2/LAM-79-nextjs-architecture-adr`
- **HEAD at scaffold:** `17a15c46429b126d6e2eda9f2ebcd6b26cb31351`
- **Merge base:** `17a15c46429b126d6e2eda9f2ebcd6b26cb31351`
- **PR:** recorded after publish — see manifest `git.pr`.
- **Unrelated changes left untouched:** All other files in the worktree (`allotment_v2/**`, `server.js`, `package.json`, `railway.json`, `BACKLOG.md`, `README.md`, `CLAUDE.md`, `os-backend/**`, `db/**`, etc.) are untouched by this task. An older PR for this same Jira ticket exists on a different head branch from a previous run; it was not touched, closed, or updated.
